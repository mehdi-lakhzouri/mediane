import 'dart:async';

import 'package:dio/dio.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/network/auth_interceptor.dart';
import 'package:driver_health_app/core/session/account_state.dart';
import 'package:driver_health_app/core/session/auth_state.dart';
import 'package:driver_health_app/core/session/mobile_session.dart';
import 'package:driver_health_app/core/session/session_api.dart';
import 'package:driver_health_app/core/session/session_manager.dart';
import 'package:driver_health_app/core/storage/secure_session_store.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_backend.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late FakeBackend backend;
  late SessionManager sessions;
  late Dio dio;
  var now = DateTime.now();

  /// Accepts only [validToken]; everything else is a 401.
  FakeHandler protectedRoute(String Function() validToken) {
    return (request) => bearerOf(request) == validToken()
        ? FakeResponse.ok({'ok': true})
        : FakeResponse.error(401, 'SESSION_INVALID');
  }

  setUp(() async {
    FlutterSecureStorage.setMockInitialValues({});
    now = DateTime.now();
    backend = FakeBackend();
    sessions = SessionManager(
      api: SessionApi(fakeDio(backend)),
      store: const SecureSessionStore(FlutterSecureStorage()),
      clock: () => now,
    );
    dio = fakeDio(backend);
    dio.interceptors.add(AuthInterceptor(sessions, dio));
    await sessions.start(
      MobileSession.fromJson(sessionJson(now: now)),
      persist: true,
    );
  });

  tearDown(() => sessions.dispose());

  test('attaches the access token as a bearer header', () async {
    backend.on('GET', 'auth/me', protectedRoute(() => 'access-1'));

    await dio.get<Object?>('auth/me');

    expect(bearerOf(backend.requests.single), 'access-1');
  });

  test('never sends a token to endpoints marked public', () async {
    backend.on('POST', 'auth/mobile/login', (_) => FakeResponse.ok({}));

    await dio.post<Object?>(
      'auth/mobile/login',
      options: Options(extra: {AuthInterceptor.skipAuth: true}),
    );

    expect(bearerOf(backend.requests.single), isNull);
  });

  test('refreshes once and replays the rejected request', () async {
    backend
      ..on('GET', 'auth/me', protectedRoute(() => 'access-2'))
      ..on(
        'POST',
        'auth/mobile/refresh',
        (_) => FakeResponse.ok(sessionJson(accessToken: 'access-2', now: now)),
      );

    final response = await dio.get<Object?>('auth/me');

    expect(response.statusCode, 200);
    expect(backend.requestsTo('GET', 'auth/me').map(bearerOf), [
      'access-1',
      'access-2',
    ]);
    expect(backend.requestsTo('POST', 'auth/mobile/refresh'), hasLength(1));
  });

  test('parallel rejected requests trigger a single refresh', () async {
    final release = Completer<void>();
    backend
      ..on('GET', 'families/mine', protectedRoute(() => 'access-2'))
      ..on('GET', 'auth/me', protectedRoute(() => 'access-2'))
      ..on('POST', 'auth/mobile/refresh', (_) async {
        await release.future;
        return FakeResponse.ok(sessionJson(accessToken: 'access-2', now: now));
      });

    final requests = Future.wait([
      dio.get<Object?>('auth/me'),
      dio.get<Object?>('families/mine'),
    ]);
    await Future<void>.delayed(Duration.zero);
    release.complete();

    final responses = await requests;
    expect(responses.map((response) => response.statusCode), [200, 200]);
    expect(backend.requestsTo('POST', 'auth/mobile/refresh'), hasLength(1));
  });

  test('ends the session when the refresh token is rejected', () async {
    backend
      ..on('GET', 'auth/me', protectedRoute(() => 'never'))
      ..on(
        'POST',
        'auth/mobile/refresh',
        (_) => FakeResponse.error(401, 'SESSION_INVALID'),
      );

    await expectLater(
      dio.get<Object?>('auth/me'),
      throwsA(
        isA<DioException>().having(
          (error) => ApiFailure.from(error).kind,
          'failure kind',
          ApiFailureKind.unauthorized,
        ),
      ),
    );
    expect(sessions.state, isA<AuthSignedOut>());
    expect(
      (sessions.state as AuthSignedOut).reason,
      SignOutReason.sessionEnded,
    );
    expect(backend.requestsTo('GET', 'auth/me'), hasLength(1));
  });

  test('does not retry more than once', () async {
    backend
      ..on('GET', 'auth/me', protectedRoute(() => 'never'))
      ..on(
        'POST',
        'auth/mobile/refresh',
        (_) => FakeResponse.ok(sessionJson(accessToken: 'access-2', now: now)),
      );

    await expectLater(
      dio.get<Object?>('auth/me'),
      throwsA(isA<DioException>()),
    );
    expect(backend.requestsTo('GET', 'auth/me'), hasLength(2));
    expect(sessions.state, isA<AuthSignedOut>());
  });

  test('refreshes before sending an access token about to expire', () async {
    backend
      ..on('GET', 'auth/me', protectedRoute(() => 'access-2'))
      ..on(
        'POST',
        'auth/mobile/refresh',
        (_) => FakeResponse.ok(sessionJson(accessToken: 'access-2', now: now)),
      );
    now = now.add(const Duration(minutes: 14, seconds: 45));

    await dio.get<Object?>('auth/me');

    expect(backend.requestsTo('GET', 'auth/me').map(bearerOf), ['access-2']);
  });

  test('follows a server-reported onboarding step', () async {
    backend.on(
      'GET',
      'families/mine',
      (_) => FakeResponse.error(403, 'PASSWORD_CHANGE_REQUIRED'),
    );

    await expectLater(
      dio.get<Object?>('families/mine'),
      throwsA(isA<DioException>()),
    );
    expect(
      (sessions.state as AuthSignedIn).accountState,
      AccountState.passwordChangeRequired,
    );
  });
}
