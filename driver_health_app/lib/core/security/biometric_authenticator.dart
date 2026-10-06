import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';

enum BiometricResult { success, cancelled, unavailable, lockedOut }

/// Device biometrics (or the device passcode as fallback). Only unlocks the
/// session already stored on this device; it never replaces server sign-in.
abstract interface class BiometricAuthenticator {
  Future<bool> isAvailable();

  Future<BiometricResult> authenticate(String reason);
}

class LocalBiometricAuthenticator implements BiometricAuthenticator {
  new([LocalAuthentication? auth]) : _auth = auth ?? LocalAuthentication();

  final LocalAuthentication _auth;

  @override
  Future<bool> isAvailable() async {
    try {
      return await _auth.isDeviceSupported() &&
          (await _auth.getAvailableBiometrics()).isNotEmpty;
    } on PlatformException {
      return false;
    } on MissingPluginException {
      return false;
    }
  }

  @override
  Future<BiometricResult> authenticate(String reason) async {
    try {
      final ok = await _auth.authenticate(
        localizedReason: reason,
        persistAcrossBackgrounding: true,
      );
      return ok ? BiometricResult.success : BiometricResult.cancelled;
    } on LocalAuthException catch (error) {
      return switch (error.code) {
        LocalAuthExceptionCode.temporaryLockout ||
        LocalAuthExceptionCode.biometricLockout => BiometricResult.lockedOut,
        LocalAuthExceptionCode.userCanceled ||
        LocalAuthExceptionCode.systemCanceled ||
        LocalAuthExceptionCode.timeout ||
        LocalAuthExceptionCode.authInProgress => BiometricResult.cancelled,
        _ => BiometricResult.unavailable,
      };
    } on PlatformException {
      return BiometricResult.unavailable;
    } on MissingPluginException {
      return BiometricResult.unavailable;
    }
  }
}
