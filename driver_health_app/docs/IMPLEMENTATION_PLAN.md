# CabinGuard Mobile Implementation Plan

This plan turns the 24 approved mockups in [`design/mobile-app`](../../design/mobile-app/README.md) into a production Flutter application. Each feature is delivered as a vertical slice: backend contract and tests, mobile data layer, state management, responsive UI, accessibility, analytics-safe observability, and automated tests.

## Product and technical decisions

- The NestJS API remains the source of truth for account state, permissions, family membership, and safety data.
- Access and refresh tokens are stored only in the platform keystore/keychain. Biometrics unlock the locally stored session; they do not replace server authentication.
- The application requests camera, photo, biometric, and notification permissions only when the user starts the related action.
- Full-screen mockup images are visual references. Production screens use native Flutter controls, semantic labels, dynamic type, safe areas, keyboard avoidance, and responsive constraints.
- Mobile mutations use bearer authentication and never depend on browser cookies or CSRF.
- Every API-backed screen has explicit initial, loading, empty, success, validation, offline, unauthorized, forbidden, and server-error states.
- Medical and incident data must never be written to logs, analytics payloads, crash breadcrumbs, or push-notification bodies.

## Delivery order

### Phase 0 — Mobile foundation

Branch: `feature/mobile-app-foundation`

Completed on this branch:

- Riverpod state management and dependency injection.
- GoRouter application shell.
- Dio client root, timeouts, JSON defaults, and environment-aware base URL.
- Keychain/Android Keystore session storage primitives.
- Compile-time environments through `APP_ENV` and `API_BASE_URL`.
- CabinGuard light/dark theme tokens and a responsive foundation screen.
- Very Good Analysis, a widget smoke test, immutable-model generators, integration-test dependency, launcher-icon tooling, and native-splash tooling.
- Native application identity `com.cabinguard.mobile`, portrait orientation, camera/photo/Face ID descriptions, and Android biometric support.

Complete these cross-cutting items inside the first feature slices, where they can be verified against real contracts and navigation states:

- Account-state route guards and deep-link entry points for password reset, account invitation, and family join links.
- CabinGuard response-envelope decoding, bearer attachment, single-flight refresh, retry of one failed request, and terminal session-expired handling.
- Optional biometric unlock after explicit opt-in.
- Reusable forms, buttons, glass cards, error views, skeletons, and responsive layout primitives extracted from implemented screens.
- Integration tests that exercise real user paths instead of mirroring the foundation implementation.

### Phase 1 — Startup and unauthenticated shell

Screens: **01 Splash**, **02 Onboarding**

Implement secure-session restoration, refresh-token rotation, first-launch persistence, maintenance/minimum-version handling, and deterministic redirect to onboarding, login, account onboarding, or home.

Backend addition:

```text
GET /api/v1/mobile/bootstrap
```

Recommended response:

```json
{
  "minimumSupportedVersion": "1.0.0",
  "latestVersion": "1.0.0",
  "maintenance": false,
  "termsVersion": "2026-10-01",
  "privacyVersion": "2026-10-01",
  "termsUrl": "https://cabinguard.app/terms",
  "privacyUrl": "https://cabinguard.app/privacy",
  "supportUrl": "https://cabinguard.app/support",
  "features": {
    "selfRegistration": false,
    "biometricUnlock": true,
    "familyJoin": true
  }
}
```

Add maintenance, mandatory-update, offline startup, and corrupted-session screens. Onboarding permissions must be contextual; the onboarding screen explains capabilities but does not request every permission at once.

Delivered (pending merge): `GET /mobile/bootstrap` driven by `MOBILE_*` environment variables with an e2e contract test; splash, three-page onboarding, and maintenance, mandatory-update, offline, service-unavailable, and session-ended screens. Connectivity failures and server failures are reported separately. A partial or unreadable keystore entry is wiped and routed to “Please sign in again”. An optional-update prompt for `latestVersion` is not built yet.

### Phase 2 — Login and session lifecycle

Screens: **03 Login**, **09 OTP / Verification** in authenticator mode

Existing APIs:

- `POST /auth/mobile/login`
- `POST /auth/mobile/mfa/challenge`
- `POST /auth/mobile/refresh`
- `POST /auth/mobile/logout`
- `GET /auth/me`
- `POST /auth/logout-all`

Implementation notes:

- Route from the returned `accountState`, never from a locally inferred state.
- Reuse screen 09 for a six-digit authenticator code or a recovery code, but label the context clearly.
- Add “Use a recovery code”, remaining-attempt feedback when safe to expose, challenge expiry, resend only for email verification, and session-expired recovery.
- Show biometric login only after a successful login and explicit opt-in.

Delivered with Phase 1 (pending merge):

- `SessionManager` owns tokens: keystore persistence, single-flight refresh guarded against sign-out races, and terminal expiry. “Remember this device” off keeps the session in memory only.
- `AuthInterceptor` attaches the bearer token, refreshes proactively 30 s before expiry, replays a rejected request once, and follows `PASSWORD_CHANGE_REQUIRED`/`MFA_SETUP_REQUIRED`/`PROFILE_SETUP_REQUIRED` 403 codes.
- `authRedirect` route guard keyed on the server account state, plus a session-ended screen.
- Screen 03 and screen 09 in authenticator/recovery-code mode with a server-clock challenge countdown and an expired state. The backend does not expose remaining attempts, so exhaustion is shown as an expired attempt.
- `OtpCodeField` replaces `pinput`, whose 7.x release depends on the decoupled `material_ui` package and does not find the app’s `Material` ancestor.
- An interim home screen exercises `GET /auth/me`, sign-out, and logout-all until Phase 7.

Still open: biometric opt-in and unlock (pairs with the Phase 6 Security screen) and the Face ID button on screen 03.

### Phase 3 — Password recovery

Screens: **05 Forgot Password**, **06 Reset Email Sent**, **07 Reset Password**, **08 Reset Successful**

The web endpoints exist, but native clients should not obtain a CSRF cookie merely to call public recovery actions. Add mobile adapters that delegate to the existing use cases:

- `POST /auth/mobile/password/forgot`
- `POST /auth/mobile/password/reset`

Keep enumeration protection: the forgot response is identical whether the account exists or not. Reset links use an app/universal link with a web fallback. Add token-expired, token-used, weak-password, offline, cooldown, and open-email-app states.

Delivered (pending merge): mobile forgot, link-validation, and reset adapters reuse the existing recovery use cases without cookies or CSRF. Screens 05–08 now provide private request confirmation, a local resend cooldown, email-app launch, deep-link token intake, server-side link validation, password policy/match feedback, invalid or consumed-link recovery, and the signed-out success route. Android handles the production HTTPS reset path and the CabinGuard custom scheme; iOS handles the custom scheme. Production App Link/Universal Link association files remain part of Phase 11.

### Phase 4 — Account provisioning and email verification

Screens: **04 Register**, **09 OTP / Verification** in email mode

Current gap: driver self-registration and email verification controllers are not implemented. The existing product provisions users through administrator invitations. Resolve the product rule before enabling the Register button.

If self-registration is approved, add:

- `POST /auth/mobile/register`
- `POST /auth/mobile/email-verification/confirm`
- `POST /auth/mobile/email-verification/resend`

The registration contract should capture first name, last name, normalized email, E.164 phone number, password, accepted terms version, accepted privacy version, and locale. Never accept an arbitrary role from the client. New accounts start as `DRIVER` with an unverified email.

If invitation-only onboarding remains the rule, replace screen 04 with “Activate invited account” and use the existing invitation token plus temporary-password workflow.

Delivered (pending merge), invitation-only branch: `POST /invitations/mobile/accept` reuses the single-use acceptance without cookies or CSRF (e2e-tested, including replay). Screen 04 became “Activate your account”: an `accept-invitation#token=…` deep link (Android HTTPS + custom scheme) or a pasted invitation link, an explicit Activate tap so opening a link never consumes it, and a success state that sends the driver to sign in with the temporary password. The sign-in screen links to it. Self-registration and email verification (screen 09 in email mode) remain unbuilt until the product decision is made; the bootstrap flag stays `false`.

### Phase 5 — Mandatory driver onboarding

Screens: **13 Secure Account**, **14 Driver Profile**, **15 Emergency Contacts**, **16 Profile Photo**

Existing APIs:

- `POST /auth/mobile/password/change`
- `GET /profile`
- `PUT /profile`
- `PUT /profile/avatar`
- `DELETE /profile/avatar`

Implementation order:

1. Mandatory password change and full session replacement.
2. Profile draft with international phone input, calendar date, adult-driver validation, and gender values supported by the backend.
3. Emergency-contact editor with relationship, E.164 number, duplicate detection, reorder, minimum/maximum count, and consent copy.
4. Optional photo picker/camera, crop, upload progress, retry, and remove action.
5. Submit the complete profile and route only from the returned `accountState`.

Screen additions:

- Explain that emergency-contact order is call priority.
- Display the exact maximum number of contacts returned by configuration instead of hard-coding it.
- Preserve an unsaved draft locally, excluding passwords.
- Add standalone profile and emergency-contact editing screens after onboarding.

Delivered (pending merge):

- The bootstrap publishes `profileRules` (minimum driver age, contact minimum and maximum, avatar size and dimensions) from the backend constants, so the app hard-codes none of them.
- Screen 13 replaces the temporary password, keeps the device’s remember choice when adopting the new session, maps server field errors, and asks for an MFA code only when the server requires one. Composition hints are guidance; the server policy is length-based.
- Screens 14–15 share one controller: E.164 phone input with a country picker (replacing `phone_form_field`, which depends on `material_ui` like `pinput`), calendar date limited by the published minimum age, gender values supported by the backend, and contacts with call-priority badges, drag *and* screen-reader move actions, duplicate and own-number checks, the published maximum, and required consent. Answers are mirrored to a per-user keystore draft (never passwords) and cleared after the profile is saved; routing follows the returned `accountState`.
- Screen 16: camera or library, square crop (`UCropActivity` registered on Android), local format/size/dimension checks against the published rules, upload progress, retry, remove, and a Settings path when access is refused.

Still open: standalone profile and emergency-contact editing after onboarding (planned with the Phase 7 home shell and settings).

### Phase 6 — MFA enrollment and account security

Screens: **17 Authenticator Setup**, **09 OTP / Verification** in setup mode, **18 Recovery Codes**

Existing APIs:

- `GET /auth/mfa`
- `POST /auth/mfa/totp/setup`
- `POST /auth/mfa/totp/confirm`
- `POST /auth/mfa/recovery-codes`
- `POST /auth/mfa/totp/disable`

The QR screen shows the issuer, account name, manual key, expiry, algorithm, digit count, and period returned by the API. Screen 09 confirms the new six-digit TOTP. Screen 18 treats recovery codes as one-time sensitive data: obscure app-switcher snapshots, support copy/share/download, require acknowledgment, and never persist or log the codes.

Add a Security screen for MFA status, replacement, disabling, recovery-code count, logout-all, and biometric preference. Drivers may enable MFA voluntarily; administrators remain subject to the server’s required-MFA rule.

Delivered (pending merge), mobile only (the existing endpoints accept bearer requests without CSRF and are already e2e-covered for drivers):

- Security screen: MFA status, enabled date, remaining recovery codes with a low-codes warning, create new codes, replace authenticator, turn off (hidden when the server marks MFA required), biometric unlock, sign out of this device, and sign out everywhere (moved from home). Sensitive actions ask for a current authenticator or recovery code in a sheet that stays open on a wrong code.
- Screen 17: “Add to authenticator app” opens the `otpauth://` link on this phone, with a QR code for another device, the grouped setup key with copy, issuer, account, type, and a server-clock expiry countdown. Screen 09 in setup mode confirms the new code and handles expired setups. The mandatory `MFA_SETUP_REQUIRED` step uses the same screens without a back button.
- Screen 18: codes travel only in memory as route data, are hidden from screenshots, recordings and screen sharing (`FLAG_SECURE` through a `MainActivity` channel) and from app-switcher snapshots (an opaque cover, which also covers iOS); copy, save-as-file through the share sheet (the temporary file is deleted afterwards), required acknowledgment, and a warning before leaving unsaved. In mandatory setup the next account state is applied only after the codes are acknowledged.
- Biometric unlock: per-user opt-in stored in the keystore that requires a successful prompt to enable; locks a restored session at launch and after two minutes in the background; the unlock screen always offers a password sign-in; respects the bootstrap `biometricUnlock` flag. Biometrics only open the saved session, never replace server authentication. Flutter’s `SensitiveContent` widget is deliberately not used because it renders nothing until a platform round trip completes.

### Phase 6b — Passkey sign-in for drivers

Decision (2026-10-03): authenticator codes are a poor fit on a phone. The generator usually lives on the same device, enrollment needs a second app and app switching, and the codes are phishable. Drivers move to **passkeys first**: after one password sign-in the app offers to create a passkey, and from then on signing in is a single Face ID, fingerprint, or device-PIN prompt. The password stays as the fallback, authenticator codes become an advanced option in Security, and administrators keep codes on the web console.

Product rules:

- A passkey sign-in satisfies two-step verification (possession of the device plus biometrics or PIN). The password path still asks for the code when codes are enabled.
- Enrollment: one skippable “Sign in faster with Face ID” screen right after first-time setup, one reminder after the next password sign-in if skipped, and always available in Security.
- Synced passkeys (iCloud Keychain, Google Password Manager) are accepted, so a replacement phone keeps working without recovery.
- The Phase 6 biometric app lock stays as an off-by-default privacy option: it protects an already open session and works offline.

Backend (`passkeys` module, `@simplewebauthn/server` 13.x):

- Prisma: `PasskeyCredential` (user, base64url credential ID unique, public key, signature counter, transports, device type, backed-up flag, AAGUID, editable name, created, last used) and `WebAuthnChallenge` (hashed challenge, purpose, user for registration, channel, remember flag, expiry about 5 minutes, consumed at), following the `MfaChallenge` pattern.
- Configuration: `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGINS` (`https://<rp>` plus one `android:apk-key-hash:<base64url SHA-256>` per signing certificate), `ANDROID_CERT_SHA256`, `APPLE_APP_IDS`.
- Domain association served by the API at the domain root (outside `/api/v1`): `/.well-known/assetlinks.json` (passkeys and Android App Links for `/reset-password` and `/accept-invitation`) and `/.well-known/apple-app-site-association` (`webcredentials` and `applinks`).
- Endpoints:
  - `POST /auth/mobile/passkeys/registration/options` and `/registration/verify` (bearer; resident key and user verification required, attestation `none`, existing credentials excluded).
  - `POST /auth/mobile/passkeys/authentication/options` and `/authentication/verify` (public, usernameless discoverable credentials, so no account enumeration). Verify returns the same `MobileSessionResponse` through `openLoginSession` with `mfaMethod: PASSKEY`, enforcing the channel rule (drivers only), account state, lockout, and rate limits.
  - `GET /auth/passkeys`, `PATCH /auth/passkeys/:id` (rename), `DELETE /auth/passkeys/:id`.
- Security: single-use challenges bound to purpose and channel, signature-counter regression rejected and audited, audit actions for registered, removed, and passkey sign-in, credentials unusable while the account cannot authenticate.
- Tests: unit tests for the verification service and an e2e suite driven by a software authenticator (ES256, `none` attestation) covering registration, sign-in, replayed challenges, unknown credentials, counter regression, and a suspended account.

Mobile (`passkeys` Flutter package 2.23.x, any WebAuthn server):

- Login (screen 03): “Sign in with Face ID” (label from device capability) when passkeys are available; cancellation is silent; a missing passkey explains “Sign in with your password, then add one in Security”.
- New enrollment screen after onboarding and after a password sign-in reminder; per-user snooze stored locally; the default passkey name comes from `device_info_plus`.
- Security: a Passkeys section first (list, add, rename, remove, last used); authenticator codes and recovery codes move under “Advanced”; screens 17 and 18 stay as they are.

Development domain: an ngrok static domain until `cabinguard.app` exists. The API serves the association files; the RP ID, origins, and `API_BASE_URL` come from configuration. Android needs the debug keystore SHA-256 in both `assetlinks.json` and `WEBAUTHN_ORIGINS`. iOS needs the Associated Domains entitlement (`webcredentials:<domain>`, `?mode=developer` while testing), which requires a paid Apple Developer team. A `docs/PASSKEYS_DEV_SETUP.md` guide accompanies the slice.

Delivery order: (1) backend module, association files, configuration, e2e; (2) mobile repository and passkey sign-in on screen 03; (3) enrollment prompt and Security passkey management, with codes moved to Advanced; (4) the ngrok setup guide and a real-device checklist (Android 9+ with Google Play services, iOS 16+).

### Phase 7 — Home shell and driver profile

Screen: **12 Home / Dashboard**

Current gap: there is no driver dashboard, medical-event, incident, or emergency-alert API. Add an aggregation endpoint so the home screen does not fan out across many services:

```text
GET /api/v1/mobile/dashboard
```

Recommended data:

- Driver name, avatar URL and account safety status.
- Latest medical event with ID, type, severity, lifecycle status, detected timestamp, vehicle context, and acknowledgment status.
- Counts for events, contacts, family members, pending family actions, and unread notifications.
- Server time and a signed/expiring avatar contract.
- Emergency feature availability and the server-authorized actions for the current user.

The SOS shortcut needs a press-and-hold confirmation, an accidental-trigger cancellation window, location/vehicle availability feedback, and a clear description of what will happen. It remains hidden or disabled until an emergency workflow exists on the backend.

Delivered (pending merge):

- `GET /mobile/dashboard` (drivers, `ACTIVE` only) aggregates the caller's own data in one read: identity and signed avatar, safety-plan readiness and contact count, recommendations (turn on two-step, regenerate recovery codes, join or create a family), family state (`NONE`, `REQUEST_PENDING`, `MEMBER`, `OWNER`) with members and owner-only pending join requests, security status, server time, and a `features` block. Medical events, emergency alerts, notifications, and vehicle telemetry are reported as unavailable until Phases 9–10, and the app hides those parts instead of showing invented data. Covered by an e2e suite with two drivers, a family, and a join request.
- Tab shell (Home, Family, Profile; History joins with Phase 9). Screen 12 shows the greeting, driver card, family banner by state, recommendations, and quick access, with pull-to-refresh, a skeleton while loading, and an error state with retry. The SOS button stays hidden until the emergency workflow exists.
- Profile tab with standalone editing of personal details and emergency contacts (the Phase 5 screens in edit mode), photo, Security, and sign out. Editing contacts asks for consent again only when the list changed. Changes refresh the dashboard.
- App-wide Riverpod retry policy: only connectivity failures retry automatically, at most three times; server answers surface immediately with a retry action.
- The Family tab is a read-only summary until Phase 8.

### Phase 8 — Family management

Screens: **19 Family Overview**, **20 Create or Join**, **21 Invite Code**, **22 Request Pending**, **23 Join Requests**, **24 Family Sharing**

Existing APIs:

- `GET /families/mine`
- `POST /families`
- `PATCH /families/mine`
- `DELETE /families/mine`
- `GET /families/mine/invite`
- `POST /families/mine/invite/rotate`
- `GET /families/invites/:code`
- `POST /families/join`
- `DELETE /families/join-request`
- `GET /families/mine/join-requests`
- approve/reject join-request endpoints
- remove member, transfer ownership, leave family, and update sharing endpoints

Implement in this order: read-only overview, create/preview/join, pending request, invite share/scan, owner approvals, sharing consent, then destructive membership actions.

The original screens **10 Accept Invitation** and **11 Reject Invitation** do not match the current family model: an eight-character code creates a request and the owner approves it. Adapt them as “Preview family and request access” and “Cancel preview”. Do not show a proposed custom role or permission bundle because the backend supports only `OWNER` and `MEMBER`; sharing consent belongs to screen 24.

Additional screens required:

- Family member detail with visible shared data.
- Owner actions: remove member and transfer ownership.
- Rename family, dissolve family, and leave family confirmations.
- Full-family, expired-code, expired-request, already-in-family, and concurrent-decision states.

Delivered (pending merge), mobile only (every family endpoint already existed):

- Module `features/family` with `domain` (entities, `FamilyCode` rules, repository contract), `data` (`FamilyJson` mapping, remote repository), `application` (`MyFamilyController`, `JoinRequestsController`, `InviteController`, invite preview), and `presentation` (one file per screen and widget, `familyFailureMessage`, `runFamilyAction`). The module owns its routes (`family_routes.dart`).
- The Family tab shows the overview (19), the pending request (22), or create-or-join (20) from the server state. Every mutation adopts the state the server returns; stale-state errors (already in a family, owner only, request decided elsewhere) refresh the view instead of leaving it wrong.
- Join by typed code, pasted link, QR scan (`mobile_scanner`, camera requested only there), or the `/join-family#CODE` deep link (Android HTTPS + custom scheme). Screens 10/11 became a preview with “Request to join” and “Not now”; full families, invalid codes, and a driver already in a family or with a pending request are explained before anything is sent.
- Owner: invite code with QR, share, copy, and rotation (21); join requests with approve/decline, capacity check, and reload after a concurrent decision (23); member detail with transfer ownership and removal; rename and dissolve. Everyone: sharing consent saved only on confirmation (24), member detail with a call button when the phone is shared, and leave (with the ownership hand-over explained).
- No join-request history, usernames, or member health status are shown: the backend has none.
- Cross-feature refresh goes through `core/state/data_changes.dart` (profile, photo, family, and MFA changes refresh the dashboard without features importing each other). New shared widgets: `ContentPage`, `SurfaceCard`, and `showConfirmDialog`.

Resolved since: a family link opened while signed out, starting up, or locked is remembered in memory and opened once the driver reaches home (`route_guard.dart` `resolveRedirect`, `core/navigation/pending_deep_link.dart`).

### Phase 9 — Medical events and emergency response

**Delivered (pending merge).**

Product rules:

- Events come from in-cabin units registered and paired by administrators (one unit per driver). Units sign every request with their own secret: HMAC-SHA256 over method, path, timestamp, nonce, and body hash, with a ±5 min window and single-use nonces. Secrets are AES-256-GCM encrypted at rest and bound to the device id.
- The server decides severity from the event type. Cardiac arrest, stroke, seizure, and SOS are critical (30 s to answer). Heart rhythm is urgent (60 s). Drowsiness is a warning only and never calls anyone. Both countdowns are configurable (`SAFETY_*_RESPONSE_SECONDS`).
- "I'm OK" from the app or the cabin button: before escalation the alarm is cancelled (`FALSE_ALARM`); after it, the incident is resolved and everyone alerted gets an all-clear. Family members cannot cancel.
- Manual SOS: hold 2 s, then a 5 s cancel window in the app; the server escalates at once. One idempotency key per press, reused on retries.
- Escalation alerts emergency contacts in priority order through a pluggable channel (log only for now; SMS/voice plugs in later), then emails family members who were given incident sharing. Delivery is at least once (lease + sent markers), so a crash never loses an alert. Escalations nobody closes are auto-closed after 24 h without an all-clear.
- Family visibility: only incidents that escalated, with who and when; never the type, readings, or history. Location is visible only while help is being called.
- Retention: event details 90 days (incident location goes too), incident summaries 365 days, expired nonces hourly.
- Administrators manage units only (register, pair, unpair, revoke, rotate secret, health). They never see medical data.

Backend: `modules/devices` (admin API `/admin/devices`, signed `/device/heartbeat`) and `modules/safety`. Driver routes: `/safety/events`, `/safety/events/:id`, `/safety/incidents`, `/safety/incidents/active`, `/safety/incidents/:id`, `/safety/incidents/:id/acknowledge`, `/safety/sos`. Family route: `/families/mine/incidents`. Unit routes: `/device/events`, `/device/acknowledge`. A worker (disabled in tests) escalates, dispatches, auto-closes, and purges. `/mobile/dashboard` gains `monitoring` (unit online, active incident, latest event with outcome), and `features.medicalEvents`/`emergencyAlerts` are now true. CLI for demos: `device:register` (prints the secret once) and `device:simulate` (signed heartbeat/event/acknowledge; the secret comes from stdin or `CABINGUARD_DEVICE_SECRET`, never an argument).

Mobile (`features/safety`):

- History tab with filters and day groups, event detail, and the alert screen (countdown on server time with haptics, help-on-the-way with contact status, summary with timeline).
- SOS hold and cancel screen, and the family alert banner.
- Home per screen 12: protection and unit status, latest event, Event history tile, SOS.
- Without push, the dashboard polls (15 s, 5 s while an incident is open) and opens a new alert by itself once. Open alerts poll every 2 s. `pollingEnabledProvider` turns polling off in tests.

Still open: the admin console (`frontend`) device screens; phone GPS on app SOS (the unit sends location today); a real SMS/voice provider behind `EmergencyContactChannel`; push delivery (Phase 10).

### Phase 10 — Notifications and device management

**Delivered (pending merge), in-app only.** Push is deferred until a provider is chosen; the notification center and polling carry everything.

- **Notification center** (`modules/notifications`): one catalog owns every message, so wording stays consistent and never carries medical details. Producers:
  - Safety: family member needs help or is safe, the driver's own alert escalated or auto-closed, cabin unit offline (once per silence, after 10 min).
  - Family: join request, approved, declined, member joined or left, removed, ownership received, added by an administrator, family dissolved.
  - Security: new sign-in while another device is signed in, password changed (not the forced first change), two-step on or off, recovery codes low.
  - Account: administrator announcements (`POST /admin/announcements`).
  - Entries are written in the producer's transaction and purged after 90 days.
- **Mute rules:** safety, family and account can be muted. Family emergencies always arrive. Security has no switch.
- **Lock-screen previews** are generic by default: "CabinGuard: you have a new safety alert". With opt-in they show the title (a name) but never the body. `PushGateway` is a no-op today; an FCM/APNs adapter and device-token registration plug in there.
- **Endpoints:** `GET /notifications`, `GET /notifications/unread-count`, `POST /notifications/:id/read`, `POST /notifications/read-all`, `GET/PUT /notification-preferences`. `/mobile/dashboard` gains `notifications.unread`, and `features.notifications` is true.
- **Active devices:** `GET /auth/sessions`, `DELETE /auth/sessions/:id` (another device; the current one ends with logout), `POST /auth/sessions/revoke-others`. Revocation takes effect immediately, because access tokens are checked against the session. The app now sends `CabinGuard/<version> (<OS>; <model>)` as its user agent, so sessions are named, e.g. "Pixel 8 · Android 15".
- **Mobile:**
  - Bell with an unread badge on home, notification center (grouped by day, opens the linked screen, mark one or all read), notification settings, and Active devices (from Security), all with sign-out confirmations.
  - Notifications entry in Profile.

Still open: push delivery (provider, token registration, permission education screen).

Original scope, kept for reference:

- `POST /mobile/devices` to register an APNs/FCM token.
- `DELETE /mobile/devices/:deviceId` on logout.
- `GET /notifications` and mark-read operations.
- `GET/PUT /notification-preferences`.
- `GET /auth/sessions` and `DELETE /auth/sessions/:sessionId` for device management.

Required screens: notification center, notification preferences, active devices, revoke-device confirmation, and notification permission education. Push bodies must remain generic on the lock screen unless the user explicitly opts in to sensitive previews.

### Motion system (between Phases 10 and 11)

**Delivered (pending merge).** Libraries: `animations` (Material motion) and `flutter_animate`. Everything lives in `core/presentation/motion/` and is applied through shared widgets, so new screens inherit it.

- **Tokens:** `Motion`: short 140 ms, medium 320 ms, long 480 ms, a 45 ms stagger capped at 8 items, and Material 3 emphasized-decelerate curves.
- **Reduced motion:** with the OS "remove animations" setting (`MediaQuery.disableAnimations`) every effect shows its final state at once.
- **Page transitions:** a shared horizontal axis on Android (theme-wide `pageTransitionsTheme`); iOS keeps the native transition and swipe-back.
- **Tabs:** `AnimatedBranches` fade-through, with every tab kept alive.
- **Entrances:** `EntranceScope` and `Entrance` give a staggered fade-and-rise that plays once per page, so items scrolled into view later appear at rest. Built into `ContentPage` (14 screens), `AuthPanelLayout` (16 screens), home, profile, onboarding pages and startup status. Async screens pass `entranceKey` so content enters when it arrives instead of popping in.
- **Feedback:** `Pressable` press scale on every tappable `SurfaceCard` and `GradientButton`; inline messages slide in; the bell badge pops on change; the home skeleton shimmers while loading.
- **Safety screens:**
  - The incident and SOS screens cross-fade between states item by item (`switchedItems`), so each element keeps its own screen-reader node.
  - The countdown scales in over a slow breathing halo, contacts slide in as they are reached, and the resolved mark lands with a small overshoot.
  - A family emergency card shakes once, and the active-alert banner gets one shimmer sweep. Nothing loops outside the alert screens.

### Phase 11 — Release hardening

- Accessibility review at 200% text scale, screen-reader flow, contrast, reduced motion, and minimum touch sizes.
- Golden tests for compact phone, large phone, tablet, light mode, dark mode, and error states.
- Integration tests for login, refresh race, mandatory onboarding, recovery links, family approval, session expiry, and offline recovery.
- Android App Links and iOS Universal Links using production association files.
- Release signing, obfuscation/symbol upload, privacy manifests, store disclosures, certificate pinning decision, and dependency audit.
- Performance budgets for cold start, image memory, dashboard rendering, and network retries.

## Screen-to-API matrix

| # | Screen | API status | Contract/action |
|---:|---|---|---|
| 01 | Splash | Partial | refresh, `/auth/me`; add `/mobile/bootstrap` |
| 02 | Onboarding | Local + gap | local completion; terms/privacy/config from bootstrap |
| 03 | Login | Ready | `/auth/mobile/login`, MFA challenge, refresh |
| 04 | Register | Missing/decision | add registration or replace with invitation activation |
| 05 | Forgot Password | Implemented | mobile wrapper around forgot-password use case |
| 06 | Reset Email Sent | Implemented | resend through forgot endpoint with local cooldown |
| 07 | Reset Password | Implemented | validate/reset adapters and deep-link handling |
| 08 | Reset Successful | Implemented | clear recovery state and route to login |
| 09 | OTP / Verification | Partial | MFA ready; email verification missing |
| 10 | Accept Invitation | Redesign | preview family code, then `POST /families/join` |
| 11 | Reject Invitation | Redesign/local | dismiss preview; cancel pending request if already sent |
| 12 | Home Dashboard | Missing | add `/mobile/dashboard` and safety-event services |
| 13 | Secure Account | Ready | `POST /auth/mobile/password/change` |
| 14 | Driver Profile | Ready | `GET/PUT /profile` |
| 15 | Emergency Contacts | Ready | included in full `PUT /profile` |
| 16 | Profile Photo | Ready | `PUT/DELETE /profile/avatar` |
| 17 | Authenticator Setup | Ready | start and confirm TOTP setup |
| 18 | Recovery Codes | Ready | confirm response and regenerate endpoint |
| 19 | Family Overview | Ready | `GET /families/mine` |
| 20 | Create or Join | Ready | create, preview code, request join |
| 21 | Invite Code | Ready | get/rotate code; share and QR are local |
| 22 | Request Pending | Ready | `GET /families/mine`, cancel request |
| 23 | Join Requests | Ready | list, approve, reject |
| 24 | Family Sharing | Ready | `PUT /families/mine/sharing` |

## Definition of done for every screen

1. Contract is documented in Swagger and covered by backend unit/e2e tests.
2. Generated mobile DTOs map the API envelope without leaking domain models into widgets.
3. Repository and Riverpod controller are independently testable.
4. UI matches the approved mockup at the reference viewport and adapts to smaller/larger screens.
5. Keyboard, safe area, rotation policy, text scaling, semantics, focus order, and screen reader labels are verified.
6. Loading, empty, validation, offline, timeout, unauthorized, forbidden, conflict, rate-limit, and retry states are deliberate.
7. Secrets and medical/personal data are excluded from logs and analytics.
8. Widget/golden tests cover visual states; integration tests cover the critical user path.
9. Backend and mobile changes ship together behind a feature flag when the contract is new.
10. Product copy and legal consent versions are reviewed before release.

## Branch sequence

After this foundation branch is merged, create short-lived branches from the updated `main`:

1. `feature/mobile-startup-shell`
2. `feature/mobile-auth-session`
3. `feature/mobile-password-recovery`
4. `feature/mobile-account-provisioning`
5. `feature/mobile-driver-onboarding`
6. `feature/mobile-mfa-security`
7. `feature/mobile-dashboard`
8. `feature/mobile-family`
9. `feature/mobile-safety-events`
10. `feature/mobile-notifications-devices`

Each branch should contain the backend contract changes and the consuming Flutter slice so an endpoint is not merged without its tested client flow.
