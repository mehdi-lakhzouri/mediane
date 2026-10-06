import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/session/account_state.dart';
import 'package:driver_health_app/core/session/auth_state.dart';
import 'package:driver_health_app/core/session/mobile_session.dart';
import 'package:driver_health_app/core/session/session_api.dart';
import 'package:driver_health_app/core/storage/secure_session_store.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

enum SessionRestoreResult {
  /// Nothing was stored: the user has never signed in or signed out.
  none,

  /// The stored session was rotated and the user is signed in again.
  restored,

  /// A stored session existed but was expired, rejected, or corrupted.
  ended,
}

/// Owns the device session: the only place tokens are read, rotated,
/// persisted, or discarded. Listeners are notified on every [AuthState]
/// change, which drives the router guards.
///
/// Refresh tokens are single use and replaying one revokes the session on the
/// server, so every refresh goes through one in-flight future.
class SessionManager extends ChangeNotifier {
  new({required this._api, required this._store, DateTime Function()? clock})
    : _clock = clock ?? DateTime.now;

  /// Access tokens closer than this to expiry are refreshed before use.
  static const refreshLeeway = Duration(seconds: 30);

  static const sessionEndedFailure = ApiFailure(
    kind: ApiFailureKind.unauthorized,
    code: 'SESSION_INVALID',
    message: 'Your session has ended. Sign in again to continue.',
  );

  final SessionApi _api;
  final SecureSessionStore _store;
  final DateTime Function() _clock;

  AuthState _state = const AuthUnknown();
  StoredSession? _tokens;
  bool _persist = false;
  Future<StoredSession>? _refreshing;

  /// Incremented whenever a session starts or ends so a refresh that resolves
  /// afterwards cannot resurrect a discarded session.
  int _generation = 0;

  AuthState get state => _state;

  String? get accessToken => _tokens?.accessToken;

  /// Whether the current session is kept in the keystore across launches.
  bool get remembersDevice => _persist;

  Future<SessionRestoreResult> restore() async {
    final StoredSession? stored;
    try {
      stored = await _store.read();
    } on SessionCorruptedException {
      _discardInMemory();
      _setState(const AuthSignedOut(reason: SignOutReason.sessionEnded));
      return SessionRestoreResult.ended;
    }

    if (stored == null) {
      _setState(const AuthSignedOut());
      return SessionRestoreResult.none;
    }
    if (!stored.refreshTokenExpiresAt.isAfter(_clock())) {
      await endSession();
      return SessionRestoreResult.ended;
    }

    _tokens = stored;
    _persist = true;
    try {
      await _refresh();
      return SessionRestoreResult.restored;
    } on ApiFailure {
      if (_state is AuthSignedOut) return SessionRestoreResult.ended;
      // Offline or server trouble: keep the keystore copy for the next try.
      _tokens = null;
      rethrow;
    }
  }

  /// Adopts a session returned by login, MFA, or password change.
  Future<void> start(MobileSession session, {required bool persist}) async {
    _generation++;
    _refreshing = null;
    _persist = persist;
    if (persist) {
      await _store.write(session.tokens);
    } else {
      await _clearStore();
    }
    _tokens = session.tokens;
    _setState(
      AuthSignedIn(userId: session.userId, accountState: session.accountState),
    );
  }

  /// Returns an access token that is not about to expire, refreshing first
  /// when needed, or `null` when signed out.
  Future<String?> validAccessToken() async {
    final tokens = _tokens;
    if (tokens == null) return null;
    if (tokens.accessTokenExpiresAt.isAfter(_clock().add(refreshLeeway))) {
      return tokens.accessToken;
    }
    return (await _refresh()).accessToken;
  }

  /// Called after the API returned 401 for [rejectedToken]. When another
  /// request already rotated the session, the current token is reused.
  Future<String> refreshAfterRejection(String rejectedToken) async {
    final current = _tokens;
    if (current != null && current.accessToken != rejectedToken) {
      return current.accessToken;
    }
    return (await _refresh()).accessToken;
  }

  /// The server reported a different onboarding step (403 with a state code).
  void syncAccountState(AccountState accountState) {
    final current = _state;
    if (current is AuthSignedIn && current.accountState != accountState) {
      _setState(
        AuthSignedIn(userId: current.userId, accountState: accountState),
      );
    }
  }

  /// Signs out locally at once, then revokes the device session best-effort.
  Future<void> signOut() async {
    final tokens = _tokens;
    await endSession(reason: SignOutReason.userInitiated);
    if (tokens == null) return;
    try {
      await _api.logout(tokens.refreshToken);
    } on Object {
      // Already signed out locally; the server session expires on its own.
    }
  }

  /// Discards the session everywhere on this device.
  Future<void> endSession({
    SignOutReason reason = SignOutReason.sessionEnded,
  }) async {
    _discardInMemory();
    await _clearStore();
    _setState(AuthSignedOut(reason: reason));
  }

  Future<StoredSession> _refresh() {
    return _refreshing ??= _performRefresh().whenComplete(() {
      _refreshing = null;
    });
  }

  Future<StoredSession> _performRefresh() async {
    final tokens = _tokens;
    if (tokens == null) throw sessionEndedFailure;
    final generation = _generation;

    final MobileSession session;
    try {
      session = await _api.refresh(tokens.refreshToken);
    } on Object catch (error) {
      final failure = ApiFailure.from(error);
      if (generation == _generation && _isTerminal(failure)) {
        await endSession();
        throw sessionEndedFailure;
      }
      throw failure;
    }

    if (generation != _generation) throw sessionEndedFailure;
    if (_persist) await _store.write(session.tokens);
    _tokens = session.tokens;
    _setState(
      AuthSignedIn(userId: session.userId, accountState: session.accountState),
    );
    return session.tokens;
  }

  static bool _isTerminal(ApiFailure failure) {
    return switch (failure.kind) {
      ApiFailureKind.unauthorized ||
      ApiFailureKind.forbidden ||
      ApiFailureKind.validation ||
      ApiFailureKind.protocol => true,
      _ => false,
    };
  }

  void _discardInMemory() {
    _generation++;
    _refreshing = null;
    _tokens = null;
    _persist = false;
  }

  Future<void> _clearStore() async {
    try {
      await _store.clear();
    } on PlatformException {
      // The keystore entry is unusable either way; a later write replaces it.
    }
  }

  void _setState(AuthState next) {
    _state = next;
    notifyListeners();
  }
}
