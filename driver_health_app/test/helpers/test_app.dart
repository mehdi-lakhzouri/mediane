import 'package:driver_health_app/app/app.dart';
import 'package:driver_health_app/core/config/app_config.dart';
import 'package:driver_health_app/core/network/network_providers.dart';
import 'package:driver_health_app/core/network/retry_policy.dart';
import 'package:driver_health_app/core/security/biometric_authenticator.dart';
import 'package:driver_health_app/core/security/security_providers.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/core/state/polling.dart';
import 'package:driver_health_app/features/home/presentation/screens/home_screen.dart';
import 'package:driver_health_app/features/startup/data/data_sources/onboarding_preferences.dart';
import 'package:driver_health_app/features/startup/data/repositories/startup_repository_impl.dart';
import 'package:driver_health_app/features/startup/presentation/controllers/startup_controller.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import 'fake_backend.dart';
import 'fake_biometrics.dart';

Map<String, Object?> bootstrapJson({
  String minimumSupportedVersion = '1.0.0',
  bool maintenance = false,
  int maxEmergencyContacts = 20,
  bool biometricUnlock = true,
}) {
  return {
    'minimumSupportedVersion': minimumSupportedVersion,
    'latestVersion': '1.0.0',
    'maintenance': maintenance,
    'maintenanceMessage': 'Mediane is receiving a safety update.',
    'maintenanceEndsAt': null,
    'termsVersion': '2026-10-01',
    'privacyVersion': '2026-10-01',
    'termsUrl': 'https://cabinguard.app/terms',
    'privacyUrl': 'https://cabinguard.app/privacy',
    'supportUrl': 'https://cabinguard.app/support',
    'features': {
      'selfRegistration': false,
      'biometricUnlock': biometricUnlock,
      'familyJoin': true,
    },
    'profileRules': {
      'driverMinimumAge': 18,
      'minEmergencyContacts': 1,
      'maxEmergencyContacts': maxEmergencyContacts,
      'avatarMaxBytes': 5 * 1024 * 1024,
      'avatarMinSidePx': 128,
    },
  };
}

/// Finds the home screen greeting, whatever the time of day.
final Finder homeGreeting = find.byKey(HomeScreen.greetingKey);

Map<String, Object?> dashboardJson({
  String firstName = 'Amira',
  String familyState = 'NONE',
  int pendingJoinRequests = 0,
  bool mfaEnabled = false,
  int emergencyContactCount = 2,
  bool safetyFeatures = false,
  Map<String, Object?>? monitoring,
  int? unreadNotifications,
}) {
  return {
    'serverTime': DateTime.now().toUtc().toIso8601String(),
    'driver': {
      'userId': '7b0b8f8e-2f7a-4d6b-9a52-111111111111',
      'firstName': firstName,
      'lastName': 'Haddad',
      'role': 'DRIVER',
      'avatar': null,
    },
    'safety': {
      'ready': true,
      'emergencyContactCount': emergencyContactCount,
      'recommendations': [
        if (!mfaEnabled) 'ENABLE_TWO_STEP',
        if (familyState == 'NONE') 'JOIN_OR_CREATE_FAMILY',
      ],
    },
    'family': {
      'state': familyState,
      'name': familyState == 'OWNER' || familyState == 'MEMBER'
          ? 'Ben Salah'
          : null,
      'memberCount': familyState == 'OWNER' || familyState == 'MEMBER'
          ? 3
          : null,
      'maxMembers': 8,
      'pendingJoinRequests': familyState == 'OWNER'
          ? pendingJoinRequests
          : null,
      'pendingRequest': familyState == 'REQUEST_PENDING'
          ? {'familyName': 'Ben Salah', 'expiresAt': '2026-10-10T00:00:00Z'}
          : null,
    },
    'security': {'mfaEnabled': mfaEnabled, 'recoveryCodesLow': false},
    'monitoring': ?monitoring,
    if (unreadNotifications != null)
      'notifications': {'unread': unreadNotifications},
    'features': {
      'medicalEvents': safetyFeatures,
      'emergencyAlerts': safetyFeatures,
      'notifications': unreadNotifications != null,
      'vehicleTelemetry': false,
    },
  };
}

class MemoryOnboardingPreferences implements OnboardingPreferences {
  new({this.completed = false});

  bool completed;

  @override
  Future<bool> isCompleted() async => completed;

  @override
  Future<void> complete() async => completed = true;
}

/// Pumps the real app (router, session manager, Dio stack) against [backend]
/// on a phone-sized surface. Only platform services are replaced.
Future<ProviderContainer> pumpCabinGuard(
  WidgetTester tester, {
  required FakeBackend backend,
  bool onboardingCompleted = true,
  OnboardingPreferences? onboardingPreferences,
  Map<String, String> keystore = const {},
  String appVersion = '1.0.0',
  int maxEmergencyContacts = 20,
  bool biometricUnlock = true,
  BiometricAuthenticator? biometrics,
  bool polling = false,
  List<Override> overrides = const [],
}) async {
  tester.view
    ..physicalSize = const Size(1179, 2556)
    ..devicePixelRatio = 3;
  addTearDown(tester.view.reset);

  FlutterSecureStorage.setMockInitialValues(Map.of(keystore));
  if (!backend.handles('GET', 'mobile/dashboard')) {
    backend.on(
      'GET',
      'mobile/dashboard',
      (_) => FakeResponse.ok(dashboardJson()),
    );
  }
  if (!backend.handles('GET', 'mobile/bootstrap')) {
    backend.on(
      'GET',
      'mobile/bootstrap',
      (_) => FakeResponse.ok(
        bootstrapJson(
          maxEmergencyContacts: maxEmergencyContacts,
          biometricUnlock: biometricUnlock,
        ),
      ),
    );
  }
  final onboarding =
      onboardingPreferences ??
      MemoryOnboardingPreferences(completed: onboardingCompleted);

  final container = ProviderContainer(
    retry: retryConnectivityFailures,
    overrides: [
      appConfigProvider.overrideWithValue(
        AppConfig(
          environment: AppEnvironment.development,
          apiBaseUrl: Uri.parse(testApiBaseUrl),
        ),
      ),
      httpClientAdapterProvider.overrideWithValue(backend),
      onboardingPreferencesProvider.overrideWithValue(onboarding),
      minimumSplashDurationProvider.overrideWithValue(Duration.zero),
      startupRepositoryProvider.overrideWith(
        (ref) => StartupRepositoryImpl(
          ref.watch(startupRemoteDataSourceProvider),
          ref.watch(sessionManagerProvider),
          ref.watch(onboardingPreferencesProvider),
          appLock: ref.watch(appLockProvider),
          appVersion: () async => appVersion,
        ),
      ),
      biometricAuthenticatorProvider.overrideWithValue(
        biometrics ?? FakeBiometrics(available: false),
      ),
      pollingEnabledProvider.overrideWithValue(polling),
      ...overrides,
    ],
  );
  addTearDown(container.dispose);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: const CabinGuardApp(),
    ),
  );
  await tester.pumpAndSettle();
  return container;
}

/// Advances time in steps for screens with endless animations or timers,
/// where `pumpAndSettle` would never return.
Future<void> pumpSteps(WidgetTester tester, {int steps = 10}) async {
  for (var i = 0; i < steps; i++) {
    await tester.pump(const Duration(milliseconds: 100));
  }
}
