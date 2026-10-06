import 'package:dio/dio.dart';
import 'package:driver_health_app/core/config/app_config.dart';
import 'package:driver_health_app/core/network/auth_interceptor.dart';
import 'package:driver_health_app/core/network/client_identity.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Overridden in tests to serve a fake backend through the real Dio stack.
final httpClientAdapterProvider = Provider<HttpClientAdapter?>((ref) => null);

/// Client for public endpoints and token rotation. Never sends a bearer token.
final publicDioProvider = Provider<Dio>((ref) {
  final dio = _createDio(ref);
  ref.onDispose(() => dio.close(force: true));
  return dio;
});

/// Client for authenticated endpoints.
final dioProvider = Provider<Dio>((ref) {
  final dio = _createDio(ref);
  dio.interceptors.add(AuthInterceptor(ref.watch(sessionManagerProvider), dio));
  ref.onDispose(() => dio.close(force: true));
  return dio;
});

Dio _createDio(Ref ref) {
  final config = ref.watch(appConfigProvider);
  final configuredBaseUrl = config.apiBaseUrl.toString();
  final userAgent = ref.watch(userAgentProvider);
  final baseUrl = configuredBaseUrl.endsWith('/')
      ? configuredBaseUrl
      : '$configuredBaseUrl/';
  final dio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      sendTimeout: const Duration(seconds: 20),
      headers: {
        Headers.acceptHeader: Headers.jsonContentType,
        Headers.contentTypeHeader: Headers.jsonContentType,
        'User-Agent': ?userAgent,
      },
    ),
  );
  final adapter = ref.watch(httpClientAdapterProvider);
  if (adapter != null) dio.httpClientAdapter = adapter;
  return dio;
}
