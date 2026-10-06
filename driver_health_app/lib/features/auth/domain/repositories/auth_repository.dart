import 'package:driver_health_app/core/session/mobile_session.dart';
import 'package:driver_health_app/features/auth/domain/entities/current_user.dart';
import 'package:driver_health_app/features/auth/domain/entities/login_result.dart';

abstract interface class AuthRepository {
  Future<LoginResult> login({required String email, required String password});

  /// Accepts a six-digit authenticator code or a recovery code.
  Future<MobileSession> completeMfaChallenge({
    required String mfaToken,
    required String code,
  });

  Future<CurrentUser> currentUser();

  /// Replaces the password. The server revokes every session and returns a
  /// new one for this device. [mfaCode] is needed once MFA is enabled.
  Future<MobileSession> changePassword({
    required String currentPassword,
    required String newPassword,
    String? mfaCode,
  });

  /// Revokes every session of the user, including this device.
  Future<void> logoutAllDevices();
}
