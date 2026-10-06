import 'package:driver_health_app/core/session/account_state.dart';
import 'package:driver_health_app/core/storage/secure_session_store.dart';

/// Session issued by login, MFA challenge, refresh, and password change.
class MobileSession {
  const new({
    required this.userId,
    required this.accountState,
    required this.tokens,
  });

  factory fromJson(Map<String, Object?> json) {
    final userId = _string(json, 'userId');
    return MobileSession(
      userId: userId,
      accountState: AccountState.fromWireValue(_string(json, 'accountState')),
      tokens: StoredSession(
        userId: userId,
        accessToken: _string(json, 'accessToken'),
        refreshToken: _string(json, 'refreshToken'),
        accessTokenExpiresAt: _date(json, 'accessTokenExpiresAt'),
        refreshTokenExpiresAt: _date(json, 'refreshTokenExpiresAt'),
      ),
    );
  }

  final String userId;
  final AccountState accountState;
  final StoredSession tokens;

  static String _string(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is String && value.isNotEmpty) return value;
    throw FormatException('Missing session field: $key');
  }

  static DateTime _date(Map<String, Object?> json, String key) {
    final date = DateTime.tryParse(_string(json, key));
    if (date == null) throw FormatException('Invalid session date: $key');
    return date;
  }
}
