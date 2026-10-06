import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class StoredSession {
  const new({
    required this.userId,
    required this.accessToken,
    required this.refreshToken,
    required this.accessTokenExpiresAt,
    required this.refreshTokenExpiresAt,
  });

  final String userId;
  final String accessToken;
  final String refreshToken;
  final DateTime accessTokenExpiresAt;
  final DateTime refreshTokenExpiresAt;
}

/// The keystore held a partial or unreadable session. It has been wiped.
class SessionCorruptedException implements Exception {
  const new();

  @override
  String toString() => 'SessionCorruptedException';
}

class SecureSessionStore {
  const new(this._storage);

  static const _userIdKey = 'session.userId';
  static const _accessTokenKey = 'session.accessToken';
  static const _refreshTokenKey = 'session.refreshToken';
  static const _accessExpiresAtKey = 'session.accessTokenExpiresAt';
  static const _refreshExpiresAtKey = 'session.refreshTokenExpiresAt';
  static const List<String> _keys = [
    _userIdKey,
    _accessTokenKey,
    _refreshTokenKey,
    _accessExpiresAtKey,
    _refreshExpiresAtKey,
  ];

  final FlutterSecureStorage _storage;

  /// Returns `null` when no session was stored and throws
  /// [SessionCorruptedException] when one was stored but cannot be trusted.
  Future<StoredSession?> read() async {
    final Map<String, String> values;
    try {
      values = await _storage.readAll();
    } on PlatformException {
      await _clearQuietly();
      throw const SessionCorruptedException();
    }

    if (!_keys.any(values.containsKey)) return null;

    final userId = values[_userIdKey];
    final accessToken = values[_accessTokenKey];
    final refreshToken = values[_refreshTokenKey];
    final accessExpiresAt = DateTime.tryParse(
      values[_accessExpiresAtKey] ?? '',
    );
    final refreshExpiresAt = DateTime.tryParse(
      values[_refreshExpiresAtKey] ?? '',
    );

    if (userId == null ||
        accessToken == null ||
        refreshToken == null ||
        accessExpiresAt == null ||
        refreshExpiresAt == null) {
      await _clearQuietly();
      throw const SessionCorruptedException();
    }

    return StoredSession(
      userId: userId,
      accessToken: accessToken,
      refreshToken: refreshToken,
      accessTokenExpiresAt: accessExpiresAt,
      refreshTokenExpiresAt: refreshExpiresAt,
    );
  }

  Future<void> write(StoredSession session) async {
    await Future.wait([
      _storage.write(key: _userIdKey, value: session.userId),
      _storage.write(key: _accessTokenKey, value: session.accessToken),
      _storage.write(key: _refreshTokenKey, value: session.refreshToken),
      _storage.write(
        key: _accessExpiresAtKey,
        value: session.accessTokenExpiresAt.toUtc().toIso8601String(),
      ),
      _storage.write(
        key: _refreshExpiresAtKey,
        value: session.refreshTokenExpiresAt.toUtc().toIso8601String(),
      ),
    ]);
  }

  Future<void> clear() =>
      Future.wait([for (final key in _keys) _storage.delete(key: key)]);

  Future<void> _clearQuietly() async {
    try {
      await clear();
    } on PlatformException {
      // A keystore that cannot be read may not be writable either; the next
      // successful sign-in overwrites every key.
    }
  }
}
