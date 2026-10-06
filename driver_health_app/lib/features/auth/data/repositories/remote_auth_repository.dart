import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_envelope.dart';
import 'package:driver_health_app/core/network/auth_interceptor.dart';
import 'package:driver_health_app/core/session/account_state.dart';
import 'package:driver_health_app/core/session/mobile_session.dart';
import 'package:driver_health_app/features/auth/domain/entities/current_user.dart';
import 'package:driver_health_app/features/auth/domain/entities/login_result.dart';
import 'package:driver_health_app/features/auth/domain/entities/mfa_challenge.dart';
import 'package:driver_health_app/features/auth/domain/repositories/auth_repository.dart';

class RemoteAuthRepository implements AuthRepository {
  new(this._dio, {DateTime Function()? clock}) : _clock = clock ?? DateTime.now;

  static final _public = Options(extra: {AuthInterceptor.skipAuth: true});

  /// Used when the server omits a usable expiry; matches the backend default.
  static const _fallbackChallengeLifetime = Duration(minutes: 5);

  final Dio _dio;
  final DateTime Function() _clock;

  @override
  Future<LoginResult> login({
    required String email,
    required String password,
  }) async {
    final response = await _dio.post<Object?>(
      'auth/mobile/login',
      data: <String, Object?>{'email': email.trim(), 'password': password},
      options: _public,
    );
    final data = ApiEnvelope.data(response.data);

    if (data['mfaRequired'] == true) {
      return LoginRequiresMfa(_challenge(data, response.data));
    }
    return LoginSucceeded(MobileSession.fromJson(data));
  }

  @override
  Future<MobileSession> completeMfaChallenge({
    required String mfaToken,
    required String code,
  }) async {
    final response = await _dio.post<Object?>(
      'auth/mobile/mfa/challenge',
      data: <String, Object?>{'mfaToken': mfaToken, 'code': code.trim()},
      options: _public,
    );
    return MobileSession.fromJson(ApiEnvelope.data(response.data));
  }

  @override
  Future<CurrentUser> currentUser() async {
    final response = await _dio.get<Object?>('auth/me');
    final data = ApiEnvelope.data(response.data);
    return CurrentUser(
      userId: _string(data, 'userId'),
      email: _string(data, 'email'),
      firstName: data['firstName'] as String? ?? '',
      lastName: data['lastName'] as String? ?? '',
      accountState: AccountState.fromWireValue(_string(data, 'accountState')),
    );
  }

  @override
  Future<MobileSession> changePassword({
    required String currentPassword,
    required String newPassword,
    String? mfaCode,
  }) async {
    final response = await _dio.post<Object?>(
      'auth/mobile/password/change',
      data: <String, Object?>{
        'currentPassword': currentPassword,
        'newPassword': newPassword,
        if (mfaCode != null && mfaCode.trim().isNotEmpty)
          'mfaCode': mfaCode.trim(),
      },
    );
    return MobileSession.fromJson(ApiEnvelope.data(response.data));
  }

  @override
  Future<void> logoutAllDevices() async {
    final response = await _dio.post<Object?>('auth/logout-all');
    ApiEnvelope.empty(response.data);
  }

  MfaChallenge _challenge(Map<String, Object?> data, Object? payload) {
    final token = _string(data, 'mfaToken');
    final expiresAt = DateTime.tryParse(data['expiresAt'] as String? ?? '');
    final serverNow = ApiEnvelope.serverTime(payload);
    final lifetime = expiresAt != null && serverNow != null
        ? expiresAt.difference(serverNow)
        : _fallbackChallengeLifetime;

    return MfaChallenge(
      token: token,
      validFor: lifetime.isNegative ? Duration.zero : lifetime,
      receivedAt: _clock(),
    );
  }

  static String _string(Map<String, Object?> json, String key) {
    final value = json[key];
    if (value is String && value.isNotEmpty) return value;
    throw FormatException('Missing field: $key');
  }
}
