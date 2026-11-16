import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:dio/dio.dart';

const testApiBaseUrl = 'http://localhost:4000/api/v1/';
const _apiPrefix = '/api/v1/';

typedef FakeHandler = FutureOr<FakeResponse> Function(RequestOptions request);

class FakeResponse {
  const new(this.status, this.body, {this.headers = const {}});

  factory ok(Object? data, {DateTime? serverTime}) =>
      FakeResponse(200, envelope(data: data, serverTime: serverTime));

  factory error(int status, String code, [String message = 'Request failed']) =>
      FakeResponse(status, envelope(error: {'code': code, 'message': message}));

  final int status;
  final Object? body;
  final Map<String, List<String>> headers;
}

Map<String, Object?> envelope({
  Object? data,
  Map<String, Object?>? error,
  DateTime? serverTime,
}) {
  return {
    'data': data,
    'meta': {
      'requestId': 'test-request',
      'timestamp': (serverTime ?? DateTime.now()).toUtc().toIso8601String(),
    },
    'error': error,
  };
}

/// Session payload as returned by login, MFA, refresh, and password change.
Map<String, Object?> sessionJson({
  String accessToken = 'access-1',
  String refreshToken = 'refresh-token-0000000000000000000000000000001',
  String accountState = 'ACTIVE',
  Duration accessTtl = const Duration(minutes: 15),
  Duration refreshTtl = const Duration(days: 30),
  DateTime? now,
}) {
  final issuedAt = (now ?? DateTime.now()).toUtc();
  return {
    'userId': '7b0b8f8e-2f7a-4d6b-9a52-111111111111',
    'role': 'DRIVER',
    'accountState': accountState,
    'tokenType': 'Bearer',
    'accessToken': accessToken,
    'accessTokenExpiresAt': issuedAt.add(accessTtl).toIso8601String(),
    'refreshToken': refreshToken,
    'refreshTokenExpiresAt': issuedAt.add(refreshTtl).toIso8601String(),
  };
}

/// Serves canned Mediane responses keyed by `METHOD path` (relative to
/// `/api/v1/`) and records every request it receives.
class FakeBackend implements HttpClientAdapter {
  final _handlers = <String, FakeHandler>{};
  final requests = <RequestOptions>[];

  void on(String method, String path, FakeHandler handler) {
    _handlers['$method $path'] = handler;
  }

  bool handles(String method, String path) =>
      _handlers.containsKey('$method $path');

  List<RequestOptions> requestsTo(String method, String path) => [
    for (final request in requests)
      if (_key(request) == '$method $path') request,
  ];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    // Snapshot: retries reuse and mutate the same RequestOptions instance.
    requests.add(
      options.copyWith(
        headers: Map.of(options.headers),
        extra: Map.of(options.extra),
      ),
    );
    final handler = _handlers[_key(options)];
    final response = handler == null
        ? FakeResponse.error(404, 'NOT_FOUND')
        : await handler(options);
    return ResponseBody.fromString(
      jsonEncode(response.body),
      response.status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
        ...response.headers,
      },
    );
  }

  @override
  void close({bool force = false}) {}

  static String _key(RequestOptions options) {
    final path = options.uri.path;
    final relative = path.startsWith(_apiPrefix)
        ? path.substring(_apiPrefix.length)
        : path;
    return '${options.method} $relative';
  }
}

/// Handler that simulates a device without connectivity.
FakeResponse offline(RequestOptions request) =>
    throw const SocketException('Network is unreachable');

Dio fakeDio(FakeBackend backend) {
  return Dio(BaseOptions(baseUrl: testApiBaseUrl))..httpClientAdapter = backend;
}

String? bearerOf(RequestOptions request) {
  final header = request.headers['Authorization'];
  return header is String && header.startsWith('Bearer ')
      ? header.substring('Bearer '.length)
      : null;
}

Map<String, Object?> bodyOf(RequestOptions request) {
  final data = request.data;
  return data is Map ? Map<String, Object?>.from(data) : const {};
}
