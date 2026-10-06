import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_envelope.dart';
import 'package:driver_health_app/features/security/domain/entities/active_session.dart';

class RemoteSessionsRepository {
  const new(this._dio);

  final Dio _dio;

  Future<List<ActiveSession>> list() async {
    final response = await _dio.get<Object?>('auth/sessions');
    return [for (final item in ApiEnvelope.list(response.data)) _session(item)];
  }

  Future<void> revoke(String sessionId) async {
    final response = await _dio.delete<Object?>(
      'auth/sessions/${Uri.encodeComponent(sessionId)}',
    );
    ApiEnvelope.empty(response.data);
  }

  /// Returns how many devices were signed out.
  Future<int> revokeOthers() async {
    final response = await _dio.post<Object?>('auth/sessions/revoke-others');
    return ApiEnvelope.data(response.data)['revoked'] as int? ?? 0;
  }

  static ActiveSession _session(Map<String, Object?> json) {
    final device = json['device'] is Map
        ? Map<String, Object?>.from(json['device']! as Map)
        : const <String, Object?>{};
    final signedInAt = DateTime.tryParse(json['signedInAt'] as String? ?? '');
    final id = json['id'];
    if (id is! String || signedInAt == null) {
      throw const FormatException('Invalid session');
    }
    return ActiveSession(
      id: id,
      label: device['label'] as String? ?? 'Unknown device',
      platform: switch (device['platform']) {
        'ANDROID' => SessionPlatform.android,
        'IOS' => SessionPlatform.ios,
        'WINDOWS' => SessionPlatform.windows,
        'MACOS' => SessionPlatform.macos,
        'LINUX' => SessionPlatform.linux,
        _ => SessionPlatform.unknown,
      },
      app: device['app'] == true,
      ipAddress: json['ipAddress'] as String?,
      signedInAt: signedInAt,
      lastActiveAt:
          DateTime.tryParse(json['lastActiveAt'] as String? ?? '') ??
          signedInAt,
      current: json['current'] == true,
    );
  }
}
