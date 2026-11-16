# AI integration plan: Python, NestJS, Flutter, and web

Status: implementation started on `integration/ai-features`. See [the implementation review](AI_INTEGRATION_REVIEW.md) for delivered scope, validation, and remaining phases. This plan describes the complete target, not a claim that all phases are finished.

Baseline: `origin/ai-features` at `1e8e21e`, compared with application commit `4df4636` and the current workspace. The AI branch adds an independent Python demonstration. Existing uncommitted application work must be preserved.

## Outcome and architecture

Deliver a traceable path from a sensor detection to an authenticated backend event, a driver incident, Flutter presentation, and authorized dashboard updates. Demonstrate this with recorded data before connecting physical sensors or enabling external alerts.

Working assumption: inference runs on an in-cabin gateway near the sensors. For development, that gateway is a Python process on a computer. Hardware, operating system, sensor transport, and resource limits remain deployment inputs; they do not block the recorded-data integration.

| Component | Responsibility |
| --- | --- |
| Python gateway | Acquire and normalize signals, assess quality, run models, group detections into episodes, persist an outbound queue, send signed events and heartbeats. |
| NestJS | Authenticate devices, resolve driver association, validate detections, persist events, own incident transitions and deadlines, authorize reads, dispatch notifications. |
| PostgreSQL | Durable event and incident records, association history, notification work, delivery attempts, and operational monitoring state. |
| Flutter | Present the driver's server state, support SOS and acknowledgement, receive push hints, refresh from authenticated REST endpoints. |
| Next.js dashboard | Device operations and runtime health; incident views only under explicit additional access policy. |
| Existing Python dashboard | Development and research diagnostics. Keep its scenario controls outside production operations. |

The gateway sends compact event summaries over HTTPS to NestJS. Flutter and the web application communicate with NestJS. Raw ECG, face landmarks, audio, and video remain on the gateway by default. Local detection continues during a cloud outage; remote notification requires connectivity. Any physical cabin warning is a separate gateway integration with its own acceptance tests.

If inference must run in the cloud, add authenticated, bounded sensor ingestion and one isolated runtime context per device/session. Reassess bandwidth, privacy, latency, and disconnected operation first. The current global `CarLoop` cannot serve multiple vehicles safely without that refactor.

## Existing capabilities to reuse

| Capability | Current implementation | Integration action |
| --- | --- | --- |
| Device provisioning and pairing | `backend/src/modules/devices/` and `/admin/devices` | Reuse registration, pairing, rotation, and revocation. |
| Signed ingestion | `POST /api/v1/device/events`; HMAC-SHA256, timestamp, nonce | Build a matching Python sender; retain server validation. |
| Device presence | `POST /api/v1/device/heartbeat` | Extend with bounded runtime-health metadata. |
| Cabin acknowledgement | `POST /api/v1/device/acknowledge` | Connect a real cabin button when available; keep Flutter acknowledgement. |
| Incident workflow | `backend/src/modules/safety/` | Reuse ingestion, locking, escalation, timelines, retention, and delivery claims. |
| Driver screens | `driver_health_app/lib/features/safety/` | Extend existing repositories, entities, controllers, and screens. |
| Mobile summary | `MobileDashboardService` | Add monitoring readiness and freshness. |
| Notifications | Notification center and `PushGateway` abstraction | Replace `NoopPushGateway`; add durable delivery. |
| Family alerts | Email channel and consent-scoped incident queries | Preserve existing redaction and sharing policy. |
| Emergency contacts | `LoggingContactChannel` | Implement a real provider before claiming contacts were reached. |
| Web health/incidents pages | Placeholders in `frontend/apps/web/app/dashboard/` | Implement operational health first; access policy precedes medical views. |
| Simulation and tests | `device:simulate`, `backend/test/safety.e2e-spec.ts` | Extend existing fixtures and workflows. |

Current timing differs across surfaces: the mobile summary considers a device online within two minutes, while the device offline policy uses ten minutes. Establish one configurable policy for connectivity, with separate freshness thresholds for sensor/model readiness.

## Contract and policy decisions

### Event semantics

- A detector alarm is a suspected event, not a confirmed diagnosis. Product copy must reflect that distinction.
- Add proposed `CARDIAC_EMERGENCY` with critical severity for the binary cardiac detector. It cannot distinguish arrest from the other arrhythmias represented by its scenarios. Do not derive a medical subtype from a scenario name or automatically map every cardiac alarm to `CARDIAC_ARREST`.
- Map seizure and stroke alarms to existing `SEIZURE` and `STROKE`. The reconstructed seizure subtype stays experimental and excluded from escalation policy until verified.
- Keep severity, incident transitions, response windows, and notification eligibility server-owned.
- Preserve concurrent positive detections. Do not discard an alarm because another model has a higher uncalibrated score. NestJS can attach several event types to the same active incident under a deterministic, versioned policy.
- Do not present `1 - max(score)` as the probability of health. `NO_ALARM` is distinct from warming up, missing data, or detector failure.
- Returning to no alarm ends a detection episode; it does not automatically acknowledge or resolve an incident. Continue the existing explicit acknowledgement/auto-close rules, with auto-close labelled accurately rather than as confirmed recovery.

### Versioned device payloads

Extend the existing DTOs and Prisma records additively. Existing clients remain supported during rollout; production AI mode requires the new provenance and association fields. All endpoints below remain under `/api/v1`.

| Contract | Existing or proposed | Required behavior |
| --- | --- | --- |
| `POST /device/events` | Existing; extend | Add `schemaVersion`, device-scoped `episodeId`, association-session identifier, model identity/version/checksum, feature-pipeline and decision-policy versions, input window times, quality summary, and optional verified subtype. Keep current `clientEventId`, `detectedAt`, `type`, bounded `confidence`, vitals, and location. |
| `POST /device/heartbeat` | Existing; extend | Report boot identifier, association session, runtime version, loaded model versions, per-detector status, sensor freshness/quality, queue depth, and last successful inference. |
| `GET /safety/monitoring` | Proposed | Return the driver's current coverage, missing modalities, last update, and reasons for degraded/unavailable monitoring. |
| `GET /mobile/dashboard` | Existing | Include the same monitoring summary without making the home screen fan out. |
| `GET /admin/devices/:deviceId/monitoring` | Proposed | Operational diagnostics with no physiological values, detector scores, raw features, or medical labels. |
| Push-token registration/removal | Proposed; choose routes in contract PR | Bind installation tokens to the authenticated user/session; handle rotation, logout, invalid tokens, and account changes. |

Use nested, strictly validated metadata DTOs rather than arbitrary JSON supplied by the gateway. Bound field lengths, collection sizes, payload size, rate, and retention. Record raw model output as an uncalibrated score unless calibration is established; the legacy `confidence` field must not imply clinical certainty.

Define `detectedAt` as the UTC time when the required alarm rule first becomes satisfied; retain `windowStartAt` and `windowEndAt` separately. Use monotonic clocks for local scheduling. Preserve original detection times across retries. Keep receipt time server-generated.

Monitoring needs per-detector statuses such as `WARMING_UP`, `READY`, `DEGRADED`, `UNAVAILABLE`, and `ERROR`. A network heartbeat alone never establishes that all models have current inputs. Track freshness and modality coverage independently.

### Identity, retries, and offline behavior

- Decode the provisioned base64url secret before HMAC signing. Sign the exact body bytes and full API path using the existing canonical format. Publish a shared Python/TypeScript signing fixture.
- Persist immutable event payloads locally before attempting delivery, using a bounded SQLite queue with protected file permissions and storage encryption appropriate to the host. Remove or compact acknowledged entries according to retention policy.
- Retry timeouts, rate limits, and transient server errors with bounded exponential backoff and jitter; honor `Retry-After`. Reuse the event ID and immutable payload, but generate a fresh signing timestamp, nonce, and signature for each request.
- Stop or quarantine permanent failures such as revoked credentials, invalid schemas, or expired association sessions. Never silently regenerate a new event ID to bypass idempotency.
- Add a server-side device/event identity constraint and normalized payload fingerprint. A retry returns the original receipt; the same ID with different content returns a conflict. Preserve existing driver-source SOS semantics.
- Persist association history and issue a server-controlled association-session identifier when a device is paired. Buffered events from driver A must never be assigned to driver B after re-pairing. Heartbeat responses communicate the current association; stale sessions are rejected or routed to historical processing under a defined policy.
- Separate the maximum accepted historical age from the maximum age eligible to open/escalate a live incident. Define and test the live-age limit against measured pipeline latency. Expired buffered detections may be retained as delayed history, but cannot trigger a new stale emergency countdown.
- Gate acceptable model and policy versions server-side. Use distinct devices/credentials and isolated environments for replay or synthetic data. A gateway-supplied `simulated` flag alone cannot authorize suppression or activation of external alerts.

## Delivery phases and acceptance criteria

### Phase 0 — Reproducible baseline and boundaries

1. Integrate from a clean branch based on current `main`, carrying forward only the reviewed AI additions. Preserve unrelated workspace changes and the original notebooks as research artifacts.
2. Extract a maintained Python runtime package from `pipeline/` and `server/`, with separate replay and gateway entry points. Keep the research UI runnable independently.
3. Lock Python and transitive dependency versions. Preserve the export-compatible scikit-learn and LightGBM versions initially; verify model hashes and load only approved, read-only artifacts.
4. Define contract schemas, event semantics, pairing-session policy, monitoring states, and a permissions matrix. Document dataset acquisition and licences without committing private recordings.
5. Upgrade `check_scenarios.py` into an enforceable check: unexpected alarms, missed expected events, and runtime errors must produce machine-readable results and fail the appropriate test gate. Separate reproducible smoke fixtures from model evaluation.

Acceptance: all four model files load in a reproducible environment; known replay fixtures execute; syntax checks are supplemented by runtime checks; feature outputs match recorded baseline tolerances. Missing datasets are explicit, and fallback data is labelled.

### Phase 1 — One recorded detection through the whole application

1. Add the proposed cardiac event type and additive metadata fields across Prisma, NestJS DTOs/presenters, Dart parsing/copy, and TypeScript contracts. Ship tolerant client parsing before enabling new event types.
2. Implement the Python HMAC client, heartbeat sender, event serializer, and bounded persistent outbound queue. Connect confirmed per-detector alarm transitions to that sender.
3. Provision a test device and pair it with a test driver. Run one replay scenario against an isolated backend with simulated notification providers.
4. Reuse the existing ingestion service and Flutter incident/history screens. Carry original timestamps and model provenance to a restricted event detail view.
5. Make repeat delivery and concurrent reports safe. Add episode identifiers so repeated windows of the same alarm do not open new incidents or re-alert after acknowledgement until the documented re-arm condition is met.

Acceptance: replay -> signed API receipt -> one correct event/incident -> Flutter display -> acknowledgement -> durable outcome. Restarting the sender or retrying a timed-out response does not duplicate events, incidents, or dispatch work. A simulated run cannot reach real emergency contacts.

This phase is a complete integration demo using polling; it does not depend on sensor hardware, SSE, or push credentials.

### Phase 2 — Continuous gateway and truthful monitoring

1. Implement `GatewaySource.read()` against the selected sensor transport. Validate sample rate, units, timestamps, sequence gaps, clock drift, channel alignment, clipping, flatlines, and missing modalities before inference.
2. Replace finite scenario iteration with a cancellable continuous loop. Isolate runtime state per device/session and reset model history on association changes, restarts, or material data gaps.
3. Bound model queues and memory. Serialize work per stateful detector, reject stale results, and prevent late jobs from an old session from changing the current decision. Define an overload policy that reports degraded coverage rather than silently skipping relevant windows.
4. Preserve the cardiac warm-up requirement and explicit input-quality gates. Define maximum result age per detector and invalidate stale alarms; retain existing incidents independently.
5. Expose gateway liveness/readiness and the proposed monitoring summary. Standardize presence/freshness rules across mobile, API workers, and dashboard.
6. Implement association-session checks, delayed-history handling, persistent retries, and episode re-arm behavior for real disconnected operation.

Acceptance: disconnecting ECG, camera, or the network produces the correct degraded status; old model results expire; gateway/cloud restarts recover without driver mix-ups or duplicate alerts. Load and resource tests run on the selected gateway hardware.

### Phase 3 — Durable alerts and Flutter background delivery

1. Extend the existing database-backed dispatch/lease mechanism to cover durable driver-alert creation, in-app notification creation, push jobs, family email, and contact-provider attempts. Commit required work atomically with incident transitions; do not rely on a post-commit in-memory callback.
2. Deliver a driver alert when an incident enters `AWAITING_RESPONSE`, before its deadline. The current escalated-incident notification alone is too late for the initial countdown.
3. Implement the existing `PushGateway` port using FCM with the appropriate Apple push setup, plus authenticated token lifecycle endpoints. Send generic lock-screen text and opaque identifiers; fetch medical detail only after authentication and app unlock.
4. Handle foreground, background, and notification-open flows in Flutter. Deduplicate navigation, refresh from NestJS on resume, use server time/deadlines for countdowns, and retain bounded polling as fallback.
5. Make delivery state explicit: queued, provider accepted, failed, and confirmed delivered where supported. Provider acceptance is not proof that a person was contacted. Replace the current `contactsAlerted = escalatedAt != null` assumption and distinguish logging adapters from real sends.
6. Add a real SMS/voice provider through `EmergencyContactChannel`, provider callbacks, idempotency support where available, bounded retries, and recorded outcomes. Recheck membership/consent and current incident state before any delayed dispatch.
7. Keep local cabin response independent from app availability. Permission denial, a force-stopped app, or a push outage must remain visible as delivery limitations, not as a successful acknowledgement.

Acceptance: exercise a physical Android device and an iPhone in foreground, background, locked, denied-permission, offline, and notification-open states. Incident transitions remain correct when push fails. A resolved incident cannot generate an obsolete queued escalation. Worker retries do not create duplicate in-app entries; provider duplicate limitations are documented and tested.

### Phase 4 — Web dashboard and permission-scoped updates

1. Build device registration/pairing/rotation/revocation controls around existing `/admin/devices` endpoints. Show one-time secrets only during provisioning, and never in logs or routine detail responses.
2. Implement `/dashboard/health` as operational monitoring: connectivity, sensor availability, runtime versions, freshness, failures, and queued work. Display medical detail only when the viewer has an explicit entitlement.
3. Preserve the current boundary: account administrators do not automatically gain access to driver medical records. Ship aggregate/redacted incident information first; detailed incident views require a separately defined permission, scope checks, audited reads, and redaction rules.
4. Add filtered, paginated incident lists and timelines for authorized viewers. Keep family access to the existing consent-scoped, redacted projection; do not reuse a privileged dashboard endpoint for family data.
5. Add NestJS SSE for one-way updates once polling proves insufficient. Start with authenticated operational updates and authorized invalidation events, then refetch REST projections. Use opaque resource IDs, reconnect/backoff, heartbeats, and a durable cursor or full resync after gaps.
6. Preserve cookie/CSRF policy for web mutations. For cross-origin SSE, configure credentialed CORS/origin checks; do not put bearer tokens in URLs. Terminate or revalidate streams on expiry, logout, and permission changes. Clean up subscriptions and configure proxy buffering/timeouts.
7. Keep the Python diagnostic dashboard private. Any future raw-signal viewer requires a distinct opt-in, short retention, strict scope checks, and bounded/downsampled transport; it is outside the first production dashboard.

Acceptance: two viewers cannot receive each other's unauthorized updates; revocation takes effect on an open stream; refresh/reconnect restores accurate state. Browser tests cover filters, timelines, empty/error/stale states, keyboard access, and narrow screens.

### Phase 5 — Deployment, evidence, and staged activation

1. Package the gateway with non-root execution where supported, resource limits, watchdog restart, restricted networking, secret injection, read-only model files, and persistent queue storage. Integrate gateway and backend artifacts into existing CI/security workflows.
2. Add health probes and metrics for model readiness, inference age/duration, sensor gaps, queue age/depth, ingestion latency, rejected signatures, stale events, dispatch attempts, and notification failures. Use correlation identifiers without medical payloads or high-cardinality personal labels in metrics.
3. Exercise deployment/restart recovery, schema compatibility, key rotation, PostgreSQL outage, provider outage, and disk-full behavior. Use additive migrations and retain a rollback-compatible API/model manifest.
4. Run replay validation, then shadow mode that records predictions without opening actionable incidents or contacting people. Shadow/active mode must be enforced server-side for an allowlisted device cohort.
5. Establish model acceptance criteria on independent participants and realistic sensor placements: false alarms per hour, sensitivity, time to detection, missing-data behavior, and subgroup coverage. Separate those findings from software integration success. Current seizure/AVC training-data replay and reconstructed seizure subtype do not establish this evidence.
6. Activate selected devices gradually. Include server-controlled model allowlists, policy versions, cohort activation, and a kill switch for automated detections that preserves manual SOS and already-open incident handling.

Acceptance: restore/rollback drills pass; no known live-data failure is presented as healthy monitoring; alert channels have measured outcomes; model quality and system latency meet the documented release criteria before unattended live escalation.

## Suggested pull-request sequence

| PR | Scope | Depends on |
| --- | --- | --- |
| 1 | Contracts, cardiac semantics, access matrix, provenance, additive migrations | Baseline review |
| 2 | Reproducible Python package, artifact verification, runtime fixtures | PR 1 schemas |
| 3 | Signed sender, durable queue, ingestion/idempotency, replay through Flutter | PRs 1-2 |
| 4 | Continuous sources, quality/freshness, association sessions, offline handling | PR 3 |
| 5 | Durable dispatch, driver pre-escalation alert, push-token lifecycle/provider | PRs 1 and 3 |
| 6 | Flutter monitoring, push/resume flows, delivery-state corrections | PRs 4-5 |
| 7 | Operational web dashboard and permission-scoped incident APIs | PRs 1 and 4 |
| 8 | SSE where needed, deployment/observability, provider integration, rollout gates | PRs 5-7 |

Association/session contracts must be designed in PR 1 and enforced for the offline production rollout in PR 4. PR 3 can demonstrate the path with a fixed test pairing. Frontend work can use shared contract fixtures while dependent API changes land.

## Verification matrix

| Layer | Required evidence |
| --- | --- |
| Python | Model loading, feature regression tolerances, known replay outcomes, missing inputs, warm-up, continuous execution, bounded backlog, cancellation, offline queue/restart. |
| Cross-language contract | Exact-byte HMAC vectors, base64url secret decoding, timestamps/units, schema compatibility, model provenance, duplicate/conflicting events. |
| NestJS/PostgreSQL | Tampering/replay/revocation, wrong driver/session, simultaneous reports, episode re-arm, delayed history, incident state races, rollback and durable dispatch recovery. |
| Flutter | Unknown future event types, truthful coverage, stale/offline UI, countdown from server deadline, idempotent acknowledgement, deep links and push/resume behavior. |
| Web | API and stream authorization, medical-data redaction, consent changes, stream reconnect/expiry, filters/pagination, accessible layouts. |
| End to end | Every detector path into an incident, concurrent alarms, cabin/app acknowledgement race, unavailable providers, gateway reassignment with queued data, no real sends from replay. |

Measure detection latency separately from transport and presentation latency. Initial engineering targets to validate, not current guarantees: p95 ingestion-to-commit under one second at expected load, and foreground UI update within two seconds of commit when streaming is enabled. Model warm-up/windowing and mobile push delivery are separate measurements. Set device counts, load profiles, and resource budgets once hardware and rollout size are known.

## Implementation references

- [NestJS SSE](https://docs.nestjs.com/techniques/server-sent-events): native one-way streams and subscription cleanup. Authentication, replay, and projection rules above are application design decisions.
- [NestJS queues](https://docs.nestjs.com/techniques/queues): BullMQ is an available option if a dedicated queue becomes necessary. The initial plan extends existing PostgreSQL leases rather than requiring Redis, Kafka, or a second scheduling system.
- [Firebase Flutter message handling](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages): covers permissions, background handlers, notification-open paths, and platform restrictions after force-stop or app dismissal. Push is a hint to refetch authoritative state, not the incident state machine or a guaranteed delivery channel.
- [scikit-learn model persistence](https://scikit-learn.org/stable/model_persistence.html): pickle/joblib artifacts require a trusted source and matching dependency environments. Pinning, provenance, and approved artifact verification belong in the gateway build/release process.

Deployment inputs to confirm during implementation: gateway hardware/OS, sensor protocols and camera pipeline, intended device count, target platforms, alert-provider account, dashboard audience, and dataset access. Defaults above permit the first replay integration without waiting for those choices.
