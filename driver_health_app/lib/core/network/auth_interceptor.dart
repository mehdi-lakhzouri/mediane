import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/session/account_state.dart';
import 'package:driver_health_app/core/session/session_manager.dart';

/// Attaches the bearer token, refreshes it once when the API rejects it, and
/// replays the failed request a single time with the rotated token.
class AuthInterceptor extends Interceptor {
  new(this._sessions, this._retryClient);

  /// Set to `true` in [RequestOptions.extra] for public endpoints.
  static const skipAuth = 'cabinguard.skipAuth';
  static const _retried = 'cabinguard.retried';
  static const _sentToken = 'cabinguard.sentToken';

  final SessionManager _sessions;
  final Dio _retryClient;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (options.extra[skipAuth] == true) return handler.next(options);

    final String? token;
    try {
      token = await _sessions.validAccessToken();
    } on ApiFailure catch (failure) {
      return handler.reject(_wrap(options, failure));
    }

    if (token != null) {
      options.headers['Authorization'] = 'Bearer $token';
      options.extra[_sentToken] = token;
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final options = err.requestOptions;
    final status = err.response?.statusCode;

    if (status == 403) _syncAccountState(err.response?.data);

    final sentToken = options.extra[_sentToken];
    if (status != 401 ||
        sentToken is! String ||
        options.extra[_retried] == true) {
      return handler.next(err);
    }

    final String token;
    try {
      token = await _sessions.refreshAfterRejection(sentToken);
    } on ApiFailure catch (failure) {
      return handler.next(_wrap(options, failure, response: err.response));
    }

    options
      ..headers['Authorization'] = 'Bearer $token'
      ..extra[_sentToken] = token
      ..extra[_retried] = true;
    try {
      handler.resolve(await _retryClient.fetch<Object?>(options));
    } on DioException catch (retryError) {
      // A freshly rotated token was still rejected: the session is unusable.
      if (retryError.response?.statusCode == 401) {
        await _sessions.endSession();
      }
      handler.next(retryError);
    }
  }

  void _syncAccountState(Object? payload) {
    if (payload is! Map || payload['error'] is! Map) return;
    final code = (payload['error']! as Map)['code'];
    final state = switch (code) {
      'PASSWORD_CHANGE_REQUIRED' => AccountState.passwordChangeRequired,
      'MFA_SETUP_REQUIRED' => AccountState.mfaSetupRequired,
      'PROFILE_SETUP_REQUIRED' => AccountState.profileSetupRequired,
      _ => null,
    };
    if (state != null) _sessions.syncAccountState(state);
  }

  static DioException _wrap(
    RequestOptions options,
    ApiFailure failure, {
    Response<Object?>? response,
  }) {
    return DioException(
      requestOptions: options,
      response: response,
      error: failure,
      message: failure.message,
    );
  }
}
