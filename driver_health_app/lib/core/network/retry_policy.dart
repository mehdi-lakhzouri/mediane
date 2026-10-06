import 'package:driver_health_app/core/network/api_failure.dart';

/// Riverpod retry policy for failed providers: only connectivity problems
/// are worth retrying automatically, and only a few times. Server answers
/// (401, 403, validation, 5xx) are shown to the user with a retry action.
Duration? retryConnectivityFailures(int retryCount, Object error) {
  if (retryCount >= 3) return null;
  final failure = ApiFailure.from(error);
  if (!failure.isConnectivity) return null;
  return Duration(milliseconds: 500 * (1 << retryCount));
}
