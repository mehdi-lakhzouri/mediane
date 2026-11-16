import 'dart:io';

import 'package:dio/dio.dart';

enum ApiFailureKind {
  offline,
  timeout,
  unauthorized,
  forbidden,
  validation,
  notFound,
  conflict,
  businessRule,
  rateLimited,
  server,
  protocol,
  cancelled,
}

class ApiFieldError {
  const new({required this.message, this.field});

  final String? field;
  final String message;
}

/// Every failure a Mediane request can produce, decoded from Dio errors and
/// the `{ data, meta, error }` envelope. [message] is safe to show to users:
/// the backend guarantees it for envelope errors and the fallbacks are generic.
class ApiFailure implements Exception {
  const new({
    required this.kind,
    required this.message,
    this.code,
    this.statusCode,
    this.details = const [],
    this.retryAfter,
  });

  factory fromErrorBody(
    Map<String, Object?> body, {
    int? statusCode,
    Duration? retryAfter,
  }) {
    final rawDetails = body['details'];
    return ApiFailure(
      kind: _kindForStatus(statusCode) ?? ApiFailureKind.server,
      code: body['code'] as String?,
      message:
          body['message'] as String? ?? 'The request could not be completed.',
      statusCode: statusCode,
      retryAfter: retryAfter,
      details: [
        if (rawDetails is List)
          for (final detail in rawDetails.whereType<Map<Object?, Object?>>())
            ApiFieldError(
              field: detail['field'] as String?,
              message: detail['message'] as String? ?? 'is invalid',
            ),
      ],
    );
  }

  factory from(Object error) {
    return switch (error) {
      ApiFailure() => error,
      DioException() => ApiFailure._fromDio(error),
      FormatException() => const ApiFailure(
        kind: ApiFailureKind.protocol,
        message: 'The API returned an unexpected response.',
      ),
      _ => const ApiFailure(
        kind: ApiFailureKind.server,
        message: 'Something went wrong. Please try again.',
      ),
    };
  }

  factory _fromDio(DioException error) {
    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return const ApiFailure(
          kind: ApiFailureKind.timeout,
          message: 'Mediane is taking too long to respond. Try again.',
        );
      case DioExceptionType.connectionError:
        return _offline;
      case DioExceptionType.cancel:
        return const ApiFailure(
          kind: ApiFailureKind.cancelled,
          message: 'The request was cancelled.',
        );
      case DioExceptionType.badCertificate:
        return const ApiFailure(
          kind: ApiFailureKind.server,
          message: 'A secure connection to Mediane could not be verified.',
        );
      case DioExceptionType.unknown:
        final cause = error.error;
        if (cause is SocketException) return _offline;
        return ApiFailure.from(cause ?? error.message ?? 'unknown');
      case DioExceptionType.badResponse:
        return ApiFailure._fromResponse(error.response);
    }
  }

  factory _fromResponse(Response<Object?>? response) {
    final status = response?.statusCode;
    final payload = response?.data;
    final retryAfter = _retryAfter(response?.headers.value('retry-after'));

    if (payload is Map && payload['error'] is Map) {
      return ApiFailure.fromErrorBody(
        Map<String, Object?>.from(payload['error']! as Map),
        statusCode: status,
        retryAfter: retryAfter,
      );
    }

    return ApiFailure(
      kind: _kindForStatus(status) ?? ApiFailureKind.server,
      message: switch (status) {
        429 => 'Too many attempts. Please wait a moment and try again.',
        503 => 'Mediane is temporarily unavailable. Try again shortly.',
        _ => 'Something went wrong. Please try again.',
      },
      statusCode: status,
      retryAfter: retryAfter,
    );
  }

  static const _offline = ApiFailure(
    kind: ApiFailureKind.offline,
    message: 'You’re offline. Check your connection and try again.',
  );

  final ApiFailureKind kind;
  final String message;
  final String? code;
  final int? statusCode;
  final List<ApiFieldError> details;
  final Duration? retryAfter;

  bool get isConnectivity =>
      kind == ApiFailureKind.offline || kind == ApiFailureKind.timeout;

  static ApiFailureKind? _kindForStatus(int? status) {
    return switch (status) {
      null => null,
      400 => ApiFailureKind.validation,
      401 => ApiFailureKind.unauthorized,
      403 => ApiFailureKind.forbidden,
      404 => ApiFailureKind.notFound,
      409 => ApiFailureKind.conflict,
      422 => ApiFailureKind.businessRule,
      429 => ApiFailureKind.rateLimited,
      _ when status >= 500 => ApiFailureKind.server,
      _ => ApiFailureKind.validation,
    };
  }

  static Duration? _retryAfter(String? header) {
    final seconds = int.tryParse(header ?? '');
    return seconds == null || seconds < 0 ? null : Duration(seconds: seconds);
  }

  @override
  String toString() =>
      'ApiFailure(${kind.name}${code == null ? '' : ', $code'})';
}
