import 'package:driver_health_app/core/session/account_state.dart';

enum SignOutReason {
  /// No session has been established on this device yet.
  none,

  /// The user signed out.
  userInitiated,

  /// The server rejected the session, it expired, or local storage was corrupt.
  sessionEnded,
}

sealed class AuthState {
  const new();
}

/// Startup has not finished restoring the stored session.
final class AuthUnknown extends AuthState {
  const new();
}

final class AuthSignedOut extends AuthState {
  const new({this.reason = SignOutReason.none});

  final SignOutReason reason;
}

final class AuthSignedIn extends AuthState {
  const new({required this.userId, required this.accountState});

  final String userId;
  final AccountState accountState;
}
