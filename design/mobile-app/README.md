# CabinGuard Mobile UI

Production-oriented mobile mockups for the CabinGuard authentication, family invitation, and dashboard flows.

- Format: PNG
- Size: 853 × 1844 px
- Theme: automotive safety, Alpine roads, deep navy glass surfaces, cyan highlights
- Generation mode: OpenAI built-in ImageGen

## Screens

| # | Screen | Asset | Main state |
|---:|---|---|---|
| 01 | Splash | [01-splash.png](./01-splash.png) | Branding and application initialization |
| 02 | Onboarding | [02-onboarding.png](./02-onboarding.png) | Product benefits and permission context |
| 03 | Login | [03-login.png](./03-login.png) | Credentials, remembered session, biometric access |
| 04 | Register | [04-register.png](./04-register.png) | Account creation and legal consent |
| 05 | Forgot Password | [05-forgot-password.png](./05-forgot-password.png) | Reset request |
| 06 | Reset Email Sent | [06-forgot-password-sent.png](./06-forgot-password-sent.png) | Confirmation, timer, and resend action |
| 07 | Reset Password | [07-reset-password.png](./07-reset-password.png) | Verified link and new password entry |
| 08 | Reset Successful | [08-reset-password-success.png](./08-reset-password-success.png) | Success and return to Login |
| 09 | OTP Verification | [09-otp-verification.png](./09-otp-verification.png) | Six-digit code with invalid-code state |
| 10 | Accept Invitation | [10-family-invitation-accept.png](./10-family-invitation-accept.png) | Family, inviter, role, and permissions |
| 11 | Decline Invitation | [11-family-invitation-decline.png](./11-family-invitation-decline.png) | Destructive confirmation sheet |
| 12 | Home Dashboard | [12-home-dashboard.png](./12-home-dashboard.png) | Driver status, latest event, shortcuts, invite, SOS |

## Backend-aligned screens

These screens extend the first concept set with flows that are already exposed by the NestJS backend.

| # | Screen | Asset | Backend operation |
|---:|---|---|---|
| 13 | Mandatory password change | [13-secure-account.png](./13-secure-account.png) | `POST /auth/mobile/password/change` |
| 14 | Driver profile setup | [14-driver-profile.png](./14-driver-profile.png) | `GET /profile`, `PUT /profile` |
| 15 | Emergency contact priority | [15-emergency-contacts.png](./15-emergency-contacts.png) | `PUT /profile` full replacement |
| 16 | Profile photo | [16-profile-photo.png](./16-profile-photo.png) | `PUT /profile/avatar`, `DELETE /profile/avatar` |
| 17 | Authenticator setup | [17-mfa-authenticator-setup.png](./17-mfa-authenticator-setup.png) | `POST /auth/mfa/totp/setup`, `POST /auth/mfa/totp/confirm` |
| 18 | Recovery codes | [18-mfa-recovery-codes.png](./18-mfa-recovery-codes.png) | TOTP confirmation response, `POST /auth/mfa/recovery-codes` |
| 19 | Family overview | [19-family-overview.png](./19-family-overview.png) | `GET /families/mine` |
| 20 | Create or join a family | [20-family-create-join.png](./20-family-create-join.png) | `POST /families`, `GET /families/invites/:code`, `POST /families/join` |
| 21 | Share family invite | [21-family-invite-code.png](./21-family-invite-code.png) | `GET /families/mine/invite`, `POST /families/mine/invite/rotate` |
| 22 | Pending join request | [22-family-request-pending.png](./22-family-request-pending.png) | `GET /families/mine`, `DELETE /families/join-request` |
| 23 | Review join requests | [23-family-join-requests.png](./23-family-join-requests.png) | list, approve, and reject join-request endpoints |
| 24 | Family sharing consent | [24-family-sharing.png](./24-family-sharing.png) | `PUT /families/mine/sharing` |

The backend models family sharing as explicit opt-in flags for phone number, incidents, and health. A family supports eight members, join codes contain eight characters, and joining always creates a request that the owner must approve.

## Suggested flow

```text
Splash
├── First launch → Onboarding → Login / Register
├── Signed out → Login
└── Valid secure session → Home

Login
├── Forgot Password → Email Sent → Reset Password → Success → Login
├── Register → OTP Verification → Home
├── Temporary password → Secure Account → Driver Profile → Emergency Contacts → Home
├── Optional MFA → Authenticator Setup → Recovery Codes → Home
└── Valid credentials / biometrics → Home

Home
└── Family
    ├── Create Family → Share Invite
    ├── Join Family → Request Pending
    ├── Owner → Review Join Requests
    └── Member → Family Sharing
```

## Implementation direction

Keep the road and vehicle artwork decorative and build the interface controls as native components. Use secure storage for sessions and biometric opt-in, a single accessible field behind the six visual OTP cells, explicit loading and error states for every authentication action, and a confirmation gesture for the SOS action.
