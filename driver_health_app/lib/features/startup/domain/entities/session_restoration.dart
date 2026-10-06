import 'package:driver_health_app/core/session/account_state.dart';

sealed class SessionRestoration {
  const new();
}

/// The device has never held a session, or the user signed out.
final class NoStoredSession extends SessionRestoration {
  const new();
}

final class SessionRestored extends SessionRestoration {
  const new(this.accountState);

  final AccountState accountState;
}

/// A stored session was expired, revoked, or corrupted and has been wiped.
final class StoredSessionEnded extends SessionRestoration {
  const new();
}
