import 'package:driver_health_app/core/security/app_lock.dart';
import 'package:driver_health_app/core/security/biometric_authenticator.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_biometrics.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late FakeBiometrics biometrics;
  late BiometricPreferenceStore preferences;
  late DateTime now;
  late AppLock lock;

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    biometrics = FakeBiometrics();
    preferences = const BiometricPreferenceStore(FlutterSecureStorage());
    now = DateTime(2026, 10, 3, 12);
    lock = AppLock(
      preferences: preferences,
      authenticator: biometrics,
      clock: () => now,
    );
  });

  tearDown(() => lock.dispose());

  test('locks a restored session only after the user opted in', () async {
    await lock.lockIfEnabled('user-1', featureAvailable: true);
    expect(lock.locked, isFalse);

    await preferences.setEnabled('user-1', enabled: true);
    await lock.lockIfEnabled('user-1', featureAvailable: true);
    expect(lock.locked, isTrue);
  });

  test('never locks when the server turned the feature off', () async {
    await preferences.setEnabled('user-1', enabled: true);
    await lock.lockIfEnabled('user-1', featureAvailable: false);
    expect(lock.locked, isFalse);
  });

  test('stays locked until biometrics succeed', () async {
    await preferences.setEnabled('user-1', enabled: true);
    await lock.lockIfEnabled('user-1', featureAvailable: true);
    biometrics.results.add(BiometricResult.cancelled);

    expect(await lock.unlock(), BiometricResult.cancelled);
    expect(lock.locked, isTrue);
    expect(await lock.unlock(), BiometricResult.success);
    expect(lock.locked, isFalse);
  });

  test('locks again after enough time in the background', () async {
    await preferences.setEnabled('user-1', enabled: true);
    await lock.attachUser('user-1');

    lock.didChangeAppLifecycleState(AppLifecycleState.paused);
    now = now.add(const Duration(seconds: 30));
    lock.didChangeAppLifecycleState(AppLifecycleState.resumed);
    expect(lock.locked, isFalse);

    lock.didChangeAppLifecycleState(AppLifecycleState.paused);
    now = now.add(lock.relockAfter);
    lock.didChangeAppLifecycleState(AppLifecycleState.resumed);
    expect(lock.locked, isTrue);
  });

  test('turning it on requires a successful prompt first', () async {
    await lock.attachUser('user-1');
    biometrics.results.add(BiometricResult.cancelled);

    expect(await lock.setEnabled(enabled: true), BiometricResult.cancelled);
    expect(await preferences.isEnabled('user-1'), isFalse);

    expect(await lock.setEnabled(enabled: true), BiometricResult.success);
    expect(await preferences.isEnabled('user-1'), isTrue);
    expect(lock.enabled, isTrue);
  });

  test('signing out removes the lock', () async {
    await preferences.setEnabled('user-1', enabled: true);
    await lock.lockIfEnabled('user-1', featureAvailable: true);

    lock.reset();

    expect(lock.locked, isFalse);
    expect(lock.enabled, isFalse);
  });
}
