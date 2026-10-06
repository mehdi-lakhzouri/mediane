import 'package:driver_health_app/core/session/account_state.dart';
import 'package:driver_health_app/features/startup/application/resolve_startup.dart';
import 'package:driver_health_app/features/startup/domain/entities/mobile_bootstrap.dart';
import 'package:driver_health_app/features/startup/domain/entities/session_restoration.dart';
import 'package:driver_health_app/features/startup/domain/entities/startup_decision.dart';
import 'package:driver_health_app/features/startup/domain/repositories/startup_repository.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('ResolveStartup', () {
    test('requires an update before reading a stored session', () async {
      final repository = _FakeRepository(
        version: '1.9.9',
        bootstrap: _bootstrap(minimumVersion: '2.0.0'),
        restoration: const SessionRestored(AccountState.active),
      );

      final result = await ResolveStartup(repository)();

      expect(result.destination, StartupDestination.mandatoryUpdate);
      expect(repository.sessionRead, isFalse);
    });

    test('routes an active restored session directly to home', () async {
      final repository = _FakeRepository(
        version: '1.0.0',
        bootstrap: _bootstrap(),
        restoration: const SessionRestored(AccountState.active),
      );

      final result = await ResolveStartup(repository)();

      expect(result.destination, StartupDestination.home);
      expect(repository.onboardingRead, isFalse);
    });

    test('routes a restored onboarding account to its required step', () async {
      final repository = _FakeRepository(
        version: '1.0.0',
        bootstrap: _bootstrap(),
        restoration: const SessionRestored(AccountState.passwordChangeRequired),
      );

      final result = await ResolveStartup(repository)();

      expect(result.destination, StartupDestination.passwordChange);
    });

    test('reports a rejected or corrupted stored session', () async {
      final repository = _FakeRepository(
        version: '1.0.0',
        bootstrap: _bootstrap(),
        restoration: const StoredSessionEnded(),
      );

      final result = await ResolveStartup(repository)();

      expect(result.destination, StartupDestination.sessionEnded);
      expect(repository.onboardingRead, isFalse);
    });

    test('shows maintenance before checking the version or session', () async {
      final repository = _FakeRepository(
        version: '0.1.0',
        bootstrap: _bootstrap(maintenance: true),
        restoration: const SessionRestored(AccountState.active),
      );

      final result = await ResolveStartup(repository)();

      expect(result.destination, StartupDestination.maintenance);
      expect(repository.sessionRead, isFalse);
    });

    test('routes a first launch without a session to onboarding', () async {
      final repository = _FakeRepository(
        version: '1.0.0',
        bootstrap: _bootstrap(),
        onboardingCompleted: false,
      );

      final result = await ResolveStartup(repository)();

      expect(result.destination, StartupDestination.onboarding);
    });
  });
}

class _FakeRepository implements StartupRepository {
  new({
    required this.version,
    required this.bootstrap,
    this.restoration = const NoStoredSession(),
    this.onboardingCompleted = true,
  });

  final String version;
  final MobileBootstrap bootstrap;
  final SessionRestoration restoration;
  final bool onboardingCompleted;
  bool sessionRead = false;
  bool onboardingRead = false;

  @override
  Future<void> completeOnboarding() async {}

  @override
  Future<String> currentAppVersion() async => version;

  @override
  Future<MobileBootstrap> fetchBootstrap() async => bootstrap;

  @override
  Future<bool> hasCompletedOnboarding() async {
    onboardingRead = true;
    return onboardingCompleted;
  }

  bool lockApplied = false;

  @override
  Future<void> applyAppLock({required bool featureAvailable}) async {
    lockApplied = true;
  }

  @override
  Future<SessionRestoration> restoreSession() async {
    sessionRead = true;
    return restoration;
  }
}

MobileBootstrap _bootstrap({
  String minimumVersion = '1.0.0',
  bool maintenance = false,
}) {
  return MobileBootstrap(
    minimumSupportedVersion: minimumVersion,
    latestVersion: '2.0.0',
    maintenance: maintenance,
    maintenanceMessage: 'Maintenance',
    maintenanceEndsAt: null,
    termsVersion: '2026-10-01',
    privacyVersion: '2026-10-01',
    termsUrl: Uri.parse('https://cabinguard.app/terms'),
    privacyUrl: Uri.parse('https://cabinguard.app/privacy'),
    supportUrl: Uri.parse('https://cabinguard.app/support'),
    features: const MobileFeatureFlags(
      selfRegistration: false,
      biometricUnlock: true,
      familyJoin: true,
    ),
    profileRules: const ProfileRules(
      driverMinimumAge: 18,
      minEmergencyContacts: 1,
      maxEmergencyContacts: 20,
      avatarMaxBytes: 5242880,
      avatarMinSidePx: 128,
    ),
  );
}
