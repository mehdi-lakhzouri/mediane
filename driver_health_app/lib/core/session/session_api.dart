import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_envelope.dart';
import 'package:driver_health_app/core/session/mobile_session.dart';

/// Token endpoints. Uses a Dio instance without the auth interceptor so a
/// refresh can never recurse into another refresh.
class SessionApi {
  const new(this._dio);

  final Dio _dio;

  Future<MobileSession> refresh(String refreshToken) async {
    final response = await _dio.post<Object?>(
      'auth/mobile/refresh',
      data: <String, Object?>{'refreshToken': refreshToken},
    );
    return MobileSession.fromJson(ApiEnvelope.data(response.data));
  }

  Future<void> logout(String refreshToken) async {
    final response = await _dio.post<Object?>(
      'auth/mobile/logout',
      data: <String, Object?>{'refreshToken': refreshToken},
      options: Options(
        sendTimeout: const Duration(seconds: 5),
        receiveTimeout: const Duration(seconds: 5),
      ),
    );
    ApiEnvelope.empty(response.data);
  }
}
