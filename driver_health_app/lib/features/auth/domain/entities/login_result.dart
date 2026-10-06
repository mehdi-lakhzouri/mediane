import 'package:driver_health_app/core/session/mobile_session.dart';
import 'package:driver_health_app/features/auth/domain/entities/mfa_challenge.dart';

sealed class LoginResult {
  const new();
}

final class LoginSucceeded extends LoginResult {
  const new(this.session);

  final MobileSession session;
}

final class LoginRequiresMfa extends LoginResult {
  const new(this.challenge);

  final MfaChallenge challenge;
}
