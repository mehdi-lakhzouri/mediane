import 'package:driver_health_app/core/network/api_failure.dart';

/// Where a paginated list stands.
class PageInfo {
  const new({
    required this.page,
    required this.totalPages,
    required this.totalItems,
  });

  final int page;
  final int totalPages;
  final int totalItems;

  bool get hasMore => page < totalPages;
}

abstract final class ApiEnvelope {
  /// Returns the `data` object of a successful CabinGuard response.
  static Map<String, Object?> data(Object? payload) {
    final data = _envelope(payload)['data'];
    if (data is! Map) {
      throw const ApiFailure(
        kind: ApiFailureKind.protocol,
        message: 'The API response contains no data.',
      );
    }
    return Map<String, Object?>.from(data);
  }

  /// The `data` object, or `null` when the server answered "nothing" (for
  /// example no active incident).
  static Map<String, Object?>? optionalData(Object? payload) {
    final data = _envelope(payload)['data'];
    return data is Map ? Map<String, Object?>.from(data) : null;
  }

  /// Returns the `data` array of a list response, keeping object items only.
  static List<Map<String, Object?>> list(Object? payload) {
    final data = _envelope(payload)['data'];
    if (data is! List) {
      throw const ApiFailure(
        kind: ApiFailureKind.protocol,
        message: 'The API response contains no list.',
      );
    }
    return [
      for (final item in data)
        if (item is Map) Map<String, Object?>.from(item),
    ];
  }

  /// `meta.pagination` of a paginated list, if present.
  static PageInfo? page(Object? payload) {
    if (payload is! Map || payload['meta'] is! Map) return null;
    final pagination = (payload['meta']! as Map)['pagination'];
    if (pagination is! Map) return null;
    return PageInfo(
      page: pagination['page'] as int? ?? 1,
      totalPages: pagination['totalPages'] as int? ?? 1,
      totalItems: pagination['totalItems'] as int? ?? 0,
    );
  }

  /// Validates a successful response whose `data` is intentionally `null`.
  static void empty(Object? payload) => _envelope(payload);

  /// Server clock from `meta.timestamp`, used to correct device clock skew.
  static DateTime? serverTime(Object? payload) {
    if (payload is! Map || payload['meta'] is! Map) return null;
    final timestamp = (payload['meta']! as Map)['timestamp'];
    return timestamp is String ? DateTime.tryParse(timestamp) : null;
  }

  static Map<String, Object?> _envelope(Object? payload) {
    if (payload is! Map) {
      throw const ApiFailure(
        kind: ApiFailureKind.protocol,
        message: 'The API returned an invalid response.',
      );
    }

    final envelope = Map<String, Object?>.from(payload);
    final error = envelope['error'];
    if (error is Map) {
      throw ApiFailure.fromErrorBody(Map<String, Object?>.from(error));
    }
    return envelope;
  }
}
