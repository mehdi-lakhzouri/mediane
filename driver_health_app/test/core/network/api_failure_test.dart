import 'dart:io';

import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_envelope.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_backend.dart';

void main() {
  final request = RequestOptions(path: 'auth/mobile/login');

  DioException badResponse(
    int status,
    Object? body, {
    Map<String, List<String>> headers = const {},
  }) {
    return DioException.badResponse(
      statusCode: status,
      requestOptions: request,
      response: Response<Object?>(
        requestOptions: request,
        statusCode: status,
        data: body,
        headers: Headers.fromMap(headers),
      ),
    );
  }

  test('decodes the envelope error with its field details', () {
    final failure = ApiFailure.from(
      badResponse(
        400,
        envelope(
          error: {
            'code': 'MFA_CODE_INVALID',
            'message': 'The verification code is not valid.',
            'details': [
              {'field': 'code', 'message': 'is not valid'},
            ],
          },
        ),
      ),
    );

    expect(failure.kind, ApiFailureKind.validation);
    expect(failure.code, 'MFA_CODE_INVALID');
    expect(failure.message, 'The verification code is not valid.');
    expect(failure.details.single.field, 'code');
  });

  test('reads Retry-After on rate-limited responses', () {
    final failure = ApiFailure.from(
      badResponse(
        429,
        envelope(error: {'code': 'RATE_LIMITED', 'message': 'Slow down.'}),
        headers: {
          'retry-after': ['120'],
        },
      ),
    );

    expect(failure.kind, ApiFailureKind.rateLimited);
    expect(failure.retryAfter, const Duration(minutes: 2));
  });

  test('falls back to a generic message for non-envelope errors', () {
    final failure = ApiFailure.from(badResponse(502, '<html>Bad gateway'));

    expect(failure.kind, ApiFailureKind.server);
    expect(failure.message, isNot(contains('html')));
  });

  test('treats socket errors and timeouts as connectivity problems', () {
    final offline = ApiFailure.from(
      DioException(
        requestOptions: request,
        error: const SocketException('unreachable'),
      ),
    );
    final timeout = ApiFailure.from(
      DioException.connectionTimeout(
        timeout: const Duration(seconds: 15),
        requestOptions: request,
      ),
    );

    expect(offline.kind, ApiFailureKind.offline);
    expect(timeout.kind, ApiFailureKind.timeout);
    expect(offline.isConnectivity && timeout.isConnectivity, isTrue);
  });

  test('rejects successful responses that carry no data', () {
    expect(
      () => ApiEnvelope.data(envelope()),
      throwsA(
        isA<ApiFailure>().having(
          (failure) => failure.kind,
          'kind',
          ApiFailureKind.protocol,
        ),
      ),
    );
  });
}
