import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_envelope.dart';
import 'package:driver_health_app/features/startup/data/dto/mobile_bootstrap_dto.dart';

class StartupRemoteDataSource {
  const new(this._dio);

  final Dio _dio;

  Future<MobileBootstrapDto> fetchBootstrap() async {
    final response = await _dio.get<Object?>('mobile/bootstrap');
    return MobileBootstrapDto.fromJson(ApiEnvelope.data(response.data));
  }
}
