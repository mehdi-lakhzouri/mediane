import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_envelope.dart';
import 'package:driver_health_app/features/account_activation/domain/repositories/account_activation_repository.dart';

class RemoteAccountActivationRepository implements AccountActivationRepository {
  const new(this._dio);

  final Dio _dio;

  @override
  Future<void> acceptInvitation(String token) async {
    final response = await _dio.post<Object?>(
      'invitations/mobile/accept',
      data: <String, Object?>{'token': token},
    );
    ApiEnvelope.empty(response.data);
  }
}
