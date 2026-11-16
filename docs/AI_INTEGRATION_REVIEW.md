# AI integration: implementation review

Branch: `integration/ai-features`. No commit, push, pull request, or production deployment has been made.

Imported the 37 AI files from remote `ai-features` at `1e8e21e` using a working-tree import, preserving the current application history. GitHub authentication and the remote commit were verified using `gh`. The workspace already contained unrelated local changes; these have not been staged or committed.

## Delivered scope

This is the first usable integration slice, covering parts of phases 0, 1, 2, and 4 of [the plan](AI_INTEGRATION_PLAN.md).

- Python: a separate `gateway` package with exact-byte HMAC signing, HTTPS destination checks, model checksum verification, a bounded SQLite outbox, persistent alarm episodes, retries with fresh request nonces, reassignment quarantine, and a replay CLI. Each positive detector is sent independently; the research dashboard's winning score does not discard other alarms. Three clear model windows re-arm an episode. Delivery and heartbeat HTTP run outside the sensor event loop.
- NestJS: versioned, strictly validated AI ingestion with approved model hashes, immutable-event fingerprint checks, pairing identifiers, row locking against device changes, model provenance, and critical `CARDIAC_EMERGENCY` semantics. New devices default to server-owned `SHADOW`. Replay and delayed input are recorded without opening or joining actionable incidents, even when the device is active.
- Monitoring: signed runtime heartbeats and an administrator-only operational endpoint. Connectivity is separate from model readiness. Missing/stale runtime health is unavailable rather than healthy. Exiting the replay runner reports detectors unavailable; missed heartbeats also expire coverage.
- Flutter: cardiac emergency and unknown-type handling, monitoring readiness/mode, explicit shadow/replay history labels, and score wording that does not imply diagnostic certainty. Existing incident/countdown/acknowledgement workflows remain in use for active events. The home screen no longer equates connectivity with guaranteed protection.
- Web: `/dashboard/health` now shows paginated device and detector availability, shadow/active mode, queue depth, and heartbeat time. It refreshes while visible, marks stale/error states, supports English/French, and keeps medical predictions and readings out of the administrator projection. `/dashboard/incidents` remains a placeholder pending the access-policy work.

The new AI endpoints are separate from the legacy device event contract so existing cabin firmware and SOS clients remain compatible. A boolean supplied by a replay runner cannot activate live incidents. Device credentials still authorize legacy firmware event routes; the AI mode is not a replacement for device trust or revocation.

## API changes

All routes below are under `/api/v1`.

| Endpoint | Auth | Behavior |
| --- | --- | --- |
| `GET /device/ai/session` | Existing device HMAC | Returns current association, pairing availability, and server-owned mode. |
| `POST /device/ai/heartbeat` | Existing device HMAC | Accepts bounded runtime status for the current association. |
| `POST /device/ai/events` | Existing device HMAC | Validates provenance, type/model mapping, score and window, then records or opens an incident according to server policy. |
| `GET /admin/devices/:deviceId/monitoring` | Admin cookie session | Operational status only; no readings or scores. |
| `GET /mobile/dashboard` | Driver bearer session | Adds runtime readiness/mode and latest-event processing mode. |
| Existing event list/detail endpoints | Owning driver | Add processing mode and, in detail, model provenance. |

AI event provenance is nested in `ai`: schema version, association UUID, episode UUID, input kind, model identity/hash, feature and decision versions, and UTC input-window times. The event ID equals the episode ID. A changed payload under the same ID conflicts; a legitimate retry returns the original receipt. Server-selected processing mode is persisted separately from the sender fingerprint.

`REPLAY` data is always non-actionable. `SENSOR` data is actionable only on a server-configured active device and within the current 60-second live-age limit; the pre-existing 24-hour acceptance limit still bounds historical ingestion. A changed pairing rotates the association UUID and clears runtime health. Evidence acquired before the current pairing is rejected. No user-facing activation control was added in this slice.

## How to review locally

The additive migration is `backend/prisma/migrations/20261115000000_ai_gateway/migration.sql`. It adds the cardiac event enum, association/mode/health fields, provenance/fingerprint storage, and a per-device event key. It has been applied to the local development database and the isolated local test database; production was not touched. Prisma has been regenerated. Restart the backend if its running process does not watch generated code.

1. Start the existing NestJS and Next.js development servers, and run Flutter against the same API.
2. Register a separate demo unit and pair it with a test driver using the existing administrator API or CLI. For example, from `backend`:

   ```powershell
   npm run cli -- device:register --serial CG-AI-DEMO --label "AI replay" --driver <test-driver-email>
   ```

   Store the one-time signing secret locally. Do not paste it into source, command arguments, screenshots, or this review document.

3. From `AI module/dashboard_ai_models`, use Python 3.12 and an isolated environment:

   ```powershell
   python -m venv .venv
   .venv\Scripts\python -m pip install -r requirements.lock
   # Set CABINGUARD_DEVICE_SECRET securely in this terminal's environment.
   .venv\Scripts\python -m gateway.replay --api http://localhost:4000/api/v1 --serial CG-AI-DEMO --scenario Stroke
   ```

   `--fast` accelerates replay for integration checks. `--scenario all` exercises every scenario. The queue defaults to an ignored `.gateway/outbox-<API-device-hash>.sqlite` per API/device; keep it across retries. A permanent failure or obsolete association is quarantined and reported rather than silently reassigned. The lock file records the Python 3.12 Windows environment used for validation; other platforms need their own compatibility run.

4. Sign in as the paired driver. History and the latest-event card label replay/shadow recordings; replay cannot start the emergency countdown. Sign in as an administrator and open `/dashboard/health` to inspect availability. Use the normal-speed replay to observe updates; accelerated replay may finish before the next UI poll.

## Verification performed

| Check | Result |
| --- | --- |
| Backend type check | Passed. |
| Backend unit tests | 145 passed across 21 suites. |
| Safety PostgreSQL integration suite | 25 passed, including real Python model replay over signed HTTP, active/shadow/replay/delayed policy, concurrent alarms, owner-only reads, immutable retries, and reassignment rejection. |
| Python gateway tests | 8 passed, including restart persistence, event-loop responsiveness, retry timing, capacity, signing, and quarantine. |
| Flutter analysis | Passed with no issues. |
| Flutter safety/home tests | 21 passed. |
| Web TypeScript check | Passed. |
| Browser monitoring test | Passed: shadow state, warm-up, stale devices, refresh failure, and a narrow viewport. API responses are mocked in this browser test; backend authorization is covered by the PostgreSQL suite. |
| Backend changed-file ESLint | Passed after formatting. |
| Web changed-file lint | Checked with an explicit TypeScript parser and file selectors. The repository's existing ESLint configuration otherwise skips `.ts`/`.tsx` and its Babel configuration cannot parse the selected TSX correctly; that shared tooling issue was not changed here. |
| Four real exported model files | Loaded and executed in the isolated Python environment. |
| Eight synthetic scenario quality checks | Failed for known prediction/decision problems; see below. |

Database tests use a separate local `cabinguard_ai_test` database with all migrations applied. Python replay uses only test credentials and a temporary queue. No real recipient delivery or live device activation was performed. Backend test drivers and devices are cleaned up by the suite.

To rerun the cross-language test, set `TEST_DATABASE_URL` to an isolated migrated local database and `AI_GATEWAY_PYTHON` to the interpreter containing the locked model dependencies, then run `npm run test:e2e -- --runInBand safety.e2e-spec.ts` from `backend`. Without the interpreter setting, the actual-model child-process test is skipped explicitly.

## Model quality findings

[The captured baseline](ai-synthetic-baseline.json) contains eight synthetic scenarios, no runtime errors, and nine quality findings. Synthetic healthy faces generated stroke alarms; the final research decision missed the labelled asystole case despite the cardiac detector firing; the synthetic stroke final alarm started before its labelled onset. These results demonstrate runtime execution, not detection quality on real drivers.

`check_scenarios.py` now exits unsuccessfully on missed expected decisions, unexpected final alarms, or early final decisions. `--json-report <path>` saves machine-readable evidence. `--smoke` checks execution while still reporting the quality failures; it does not turn them into model validation. No model weights or alarm thresholds were tuned to make the scenarios pass.

## Remaining implementation

- Physical gateway transport, continuous acquisition, input-quality controls, per-modality freshness, and load/resource validation on selected hardware. `GatewaySource.read()` remains unimplemented.
- Durable driver alerts before escalation, real FCM/APNs delivery and installation-token lifecycle, real contact SMS/voice delivery, delivery-state corrections, and physical-device background tests. Existing no-op push and logging contact adapters remain in place.
- An explicit policy and authorization model for medical incident access in the web console; incident pages and optional SSE updates.
- Independent model evaluation and calibrated decision policy. Seizure subtype reconstruction and current seizure/stroke training-data reuse remain research limitations.
- Deployment artifacts, broader observability, association history beyond rejection of obsolete sessions, automated cohort controls/model manifests, and rollback drills. There is no production deployment or unattended-alert readiness claim.

Review the imported AI files and application changes before selecting files for a commit. Existing local branding/security edits share a few touched screens/tests and should remain distinguishable from this integration during that review.
