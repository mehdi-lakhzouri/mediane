import 'package:driver_health_app/core/security/biometric_authenticator.dart';

/// Answers biometric prompts from [results] in order, then succeeds.
class FakeBiometrics implements BiometricAuthenticator {
  new({this.available = true, List<BiometricResult>? results})
    : results = results ?? [];

  final bool available;
  final List<BiometricResult> results;
  int prompts = 0;

  @override
  Future<bool> isAvailable() async => available;

  @override
  Future<BiometricResult> authenticate(String reason) async {
    prompts++;
    return results.isEmpty ? BiometricResult.success : results.removeAt(0);
  }
}
