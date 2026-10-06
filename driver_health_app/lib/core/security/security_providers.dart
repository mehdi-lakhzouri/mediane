import 'package:driver_health_app/core/security/app_lock.dart';
import 'package:driver_health_app/core/security/biometric_authenticator.dart';
import 'package:driver_health_app/core/session/auth_state.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/core/storage/storage_providers.dart';
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final biometricAuthenticatorProvider = Provider<BiometricAuthenticator>(
  (ref) => LocalBiometricAuthenticator(),
);

final biometricPreferenceStoreProvider = Provider<BiometricPreferenceStore>(
  (ref) => BiometricPreferenceStore(ref.watch(secureStorageProvider)),
);

final appLockProvider = Provider<AppLock>((ref) {
  final lock = AppLock(
    preferences: ref.watch(biometricPreferenceStoreProvider),
    authenticator: ref.watch(biometricAuthenticatorProvider),
  );
  final sessions = ref.watch(sessionManagerProvider);

  void followSession() {
    final state = sessions.state;
    if (state is AuthSignedIn) {
      lock.attachUser(state.userId).ignore();
    } else if (state is AuthSignedOut) {
      lock.reset();
    }
  }

  sessions.addListener(followSession);
  WidgetsBinding.instance.addObserver(lock);
  ref.onDispose(() {
    sessions.removeListener(followSession);
    WidgetsBinding.instance.removeObserver(lock);
    lock.dispose();
  });
  return lock;
});
