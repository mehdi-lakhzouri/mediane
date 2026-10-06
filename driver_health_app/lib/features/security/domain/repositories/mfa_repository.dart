import 'package:driver_health_app/features/security/domain/entities/mfa.dart';

abstract interface class MfaRepository {
  Future<MfaStatus> status();

  /// Starts an enrollment. Replacing an active authenticator needs
  /// [currentCode]: a code from it, or a recovery code.
  Future<TotpSetup> startSetup({String? currentCode});

  /// Confirms with a code from the new authenticator and returns the
  /// recovery codes, shown once.
  Future<RecoveryCodes> confirmSetup(String code);

  /// Voids every recovery code and returns new ones.
  Future<RecoveryCodes> regenerateRecoveryCodes(String code);

  Future<MfaStatus> disable(String code);
}
