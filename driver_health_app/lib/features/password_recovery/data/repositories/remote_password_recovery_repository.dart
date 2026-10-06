import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_envelope.dart';
import 'package:driver_health_app/features/password_recovery/domain/entities/password_reset_link.dart';
import 'package:driver_health_app/features/password_recovery/domain/repositories/password_recovery_repository.dart';

class RemotePasswordRecoveryRepository implements PasswordRecoveryRepository {
  const new(this._dio);

  final Dio _dio;

  @override
  Future<void> requestInstructions(String email) async {
    final response = await _dio.post<Object?>(
      'auth/mobile/password/forgot',
      data: <String, Object?>{'email': email.trim()},
    );
    ApiEnvelope.empty(response.data);
  }

  @override
  Future<PasswordResetLink> validateLink(String token) async {
    final response = await _dio.post<Object?>(
      'auth/mobile/password/validate',
      data: <String, Object?>{'token': token},
    );
    final data = ApiEnvelope.data(response.data);
    final expiresAt = DateTime.tryParse(data['expiresAt'] as String? ?? '');
    if (expiresAt == null) {
      throw const FormatException('Missing password-reset expiry');
    }
    return PasswordResetLink(expiresAt: expiresAt);
  }

  @override
  Future<void> resetPassword({
    required String token,
    required String newPassword,
  }) async {
    final response = await _dio.post<Object?>(
      'auth/mobile/password/reset',
      data: <String, Object?>{'token': token, 'newPassword': newPassword},
    );
    ApiEnvelope.empty(response.data);
  }
}
