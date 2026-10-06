import 'package:driver_health_app/features/password_recovery/domain/entities/password_reset_link.dart';

abstract interface class PasswordRecoveryRepository {
  /// Always succeeds with the same public response, whether the email exists.
  Future<void> requestInstructions(String email);

  /// Checks that the single-use link is currently valid without consuming it.
  Future<PasswordResetLink> validateLink(String token);

  /// Consumes the link and revokes every existing session for the account.
  Future<void> resetPassword({
    required String token,
    required String newPassword,
  });
}
