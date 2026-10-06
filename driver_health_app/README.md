# CabinGuard Mobile

Flutter client for CabinGuard drivers. This package is being implemented as vertical feature slices against the versioned NestJS API.

## Current foundation

- Flutter 3.47 / Dart 3.13
- Riverpod for state and dependency injection
- GoRouter for guarded navigation and deep links
- Dio for the CabinGuard REST envelope and mobile bearer sessions
- Flutter Secure Storage for refresh/access tokens
- Freezed and JSON Serializable for immutable API models
- Local authentication, app links, international phone input, OTP input, camera/gallery upload, QR scanning, sharing, and connectivity support
- Very Good Analysis, Mocktail, HTTP mock adapter, widget tests, and integration-test support
- Native identifier `com.cabinguard.mobile`, portrait orientation, biometric host activity, and camera/photo/Face ID permission descriptions

The ordered screen and backend roadmap is in [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md). Approved visual references are in [`../design/mobile-app`](../design/mobile-app/README.md).

## Requirements

- Flutter 3.47.5 or a compatible stable release
- Dart 3.13.4 or later within the current SDK constraint
- Android API 24 or later
- iOS 15 or later
- Windows Developer Mode when resolving Flutter plugins on Windows

Enable Windows Developer Mode from **Settings → System → For developers**, then restart the terminal before running package or build commands.

## Install

```bash
flutter pub get
dart run build_runner build --delete-conflicting-outputs
```

## Run

Android emulator:

```bash
flutter run \
  --dart-define=APP_ENV=development \
  --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
```

iOS simulator:

```bash
flutter run \
  --dart-define=APP_ENV=development \
  --dart-define=API_BASE_URL=http://localhost:4000/api/v1
```

PowerShell:

```powershell
flutter run `
  --dart-define=APP_ENV=development `
  --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
```

Physical devices must use an HTTPS development endpoint or the computer's reachable LAN address. Production startup rejects a non-HTTPS API URL.

### Physical Android phone

Build settings live in `env/*.json`. Each machine has its own copy, which is gitignored; copy from the tracked `*.example.json` files.

| File | Use | API | APK |
| --- | --- | --- | --- |
| `env/dev-lan.json` | Phone on the same Wi-Fi as the PC | `http://<PC LAN IP>:4000/api/v1` | debug (cleartext HTTP is allowed in debug builds only) |
| `env/demo-tunnel.json` | Demo from any network | `https://<static domain>/api/v1` | release |

```powershell
Copy-Item env/dev-lan.example.json env/dev-lan.json   # then set your IP (ipconfig > Wi-Fi > IPv4)
flutter run --dart-define-from-file=env/dev-lan.json                        # phone over USB
flutter build apk --debug --dart-define-from-file=env/dev-lan.json          # installable APK
adb install -r build/app/outputs/flutter-apk/app-debug.apk
```

Release APK against the same LAN backend (smaller and faster, shareable through Google Drive). Release builds refuse plain HTTP unless the build opts in with `-P allowCleartext=true`; store builds never pass it. If Windows Smart App Control blocks Flutter's x86_64 snapshot tool, build for phones only with `--target-platform android-arm64`:

```powershell
flutter build apk --release --target-platform android-arm64 -P allowCleartext=true --dart-define-from-file=env/dev-lan.json
# -> build/app/outputs/flutter-apk/app-release.apk
```

On the backend, set `API_PUBLIC_URL=http://<PC LAN IP>:4000` in `backend/.env` so profile photo links work on the phone, then restart it. Allow port 4000 through the Windows firewall, and make sure the Wi-Fi is set to a Private network (the rule only applies there).

## Quality commands

```bash
dart format --output=none --set-exit-if-changed lib test
flutter analyze
flutter test
```

Run `flutter test integration_test` after the first device-level flow is added in Phase 1.

Generate immutable models and Riverpod providers after changing annotated sources:

```bash
dart run build_runner build --delete-conflicting-outputs
```

## Project structure

```text
lib/
├── app/                 Application widget, router, and route guards
├── core/                Configuration, networking, storage, theme, errors
└── features/            Vertical product slices
    └── <feature>/
        ├── data/        DTOs, remote/local sources, repository implementation
        ├── domain/      Entities, repository contracts, use cases
        └── presentation Widgets, controllers, and screen state
```

## Environment policy

- `APP_ENV`: `development`, `staging`, or `production`
- `API_BASE_URL`: full versioned API base, for example `https://api.cabinguard.app/api/v1`

Do not store secrets in Dart defines. API credentials are user/session data and belong in Keychain or Android Keystore through `flutter_secure_storage`.
