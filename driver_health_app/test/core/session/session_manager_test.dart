import 'dart:async';

import 'package:driver_health_app/core/network/api_failure.dart';
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
  late SecureSessionStore store;
  late SessionManager manager;

  const storedRefresh = 'refresh-token-stored-000000000000000000000000';

  SessionManager createManager() =>
      SessionManager(api: SessionApi(fakeDio(backend)), store: store);

  Future<void> storeSession({
    String accessToken = 'access-stored',
    Duration refreshTtl = const Duration(days: 30),
  }) {
    final now = DateTime.now().toUtc();
    return store.write(
      StoredSession(
        userId: 'user-1',
        accessToken: accessToken,
        refreshToken: storedRefresh,
        accessTokenExpiresAt: now.add(const Duration(minutes: 15)),
        refreshTokenExpiresAt: now.add(refreshTtl),
      ),
    );
  }

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    store = const SecureSessionStore(FlutterSecureStorage());
    backend = FakeBackend();
    manager = createManager();
  });

  tearDown(() => manager.dispose());

  group('restore', () {
    test('reports no session when nothing is stored', () async {
      expect(await manager.restore(), SessionRestoreResult.none);
      expect(manager.state, isA<AuthSignedOut>());
      expect(backend.requests, isEmpty);
    });

    test('rotates the stored session and persists the new tokens', () async {
      await storeSession();
      backend.on(
        'POST',
        'auth/mobile/refresh',
        (_) => FakeResponse.ok(
          sessionJson(
            accessToken: 'access-2',
            refreshToken: 'refresh-token-rotated-0000000000000000000000',
            accountState: 'PROFILE_SETUP_REQUIRED',
          ),
        ),
      );

      expect(await manager.restore(), SessionRestoreResult.restored);

      expect(bodyOf(backend.requests.single)['refreshToken'], storedRefresh);
      final state = manager.state as AuthSignedIn;
      expect(state.accountState, AccountState.profileSetupRequired);
      expect(manager.accessToken, 'access-2');
      final persisted = await store.read();
      expect(
        persisted?.refreshToken,
        'refresh-token-rotated-0000000000000000000000',
      );
    });

    test('wipes a partially stored session and reports it ended', () async {
      FlutterSecureStorage.setMockInitialValues({
        'session.accessToken': 'orphan',
      });

      expect(await manager.restore(), SessionRestoreResult.ended);

      expect(manager.state, isA<AuthSignedOut>());
      expect(
        (manager.state as AuthSignedOut).reason,
        SignOutReason.sessionEnded,
      );
      expect(await store.read(), isNull);
      expect(backend.requests, isEmpty);
    });

    test('ends a session whose refresh token expired locally', () async {
      await storeSession(refreshTtl: const Duration(seconds: -1));

      expect(await manager.restore(), SessionRestoreResult.ended);
      expect(backend.requests, isEmpty);
      expect(await store.read(), isNull);
    });

    test('ends and wipes a session the server rejects', () async {
      await storeSession();
      backend.on(
        'POST',
        'auth/mobile/refresh',
        (_) => FakeResponse.error(401, 'SESSION_INVALID'),
      );

      expect(await manager.restore(), SessionRestoreResult.ended);
      expect(await store.read(), isNull);
    });

    test('keeps the stored session when the device is offline', () async {
      await storeSession();
      backend.on('POST', 'auth/mobile/refresh', offline);

      await expectLater(
        manager.restore(),
        throwsA(
          isA<ApiFailure>().having(
            (failure) => failure.kind,
            'kind',
            ApiFailureKind.offline,
          ),
        ),
      );
      expect(manager.state, isA<AuthUnknown>());
      expect((await store.read())?.refreshToken, storedRefresh);
    });
  });

  group('refresh', () {
    test('concurrent rejections share a single refresh request', () async {
      final release = Completer<void>();
      backend.on('POST', 'auth/mobile/refresh', (_) async {
        await release.future;
        return FakeResponse.ok(sessionJson(accessToken: 'access-2'));
      });
      await manager.start(MobileSession.fromJson(sessionJson()), persist: true);

      final first = manager.refreshAfterRejection('access-1');
      final second = manager.refreshAfterRejection('access-1');
      release.complete();

      expect(await Future.wait([first, second]), ['access-2', 'access-2']);
      expect(backend.requestsTo('POST', 'auth/mobile/refresh'), hasLength(1));
    });

    test('reuses a token another request already rotated', () async {
      backend.on(
        'POST',
        'auth/mobile/refresh',
        (_) => FakeResponse.ok(sessionJson(accessToken: 'access-2')),
      );
      await manager.start(MobileSession.fromJson(sessionJson()), persist: true);
      await manager.refreshAfterRejection('access-1');

      expect(await manager.refreshAfterRejection('access-1'), 'access-2');
      expect(backend.requestsTo('POST', 'auth/mobile/refresh'), hasLength(1));
    });

    test(
      'a refresh finishing after sign-out cannot revive the session',
      () async {
        final release = Completer<void>();
        backend
          ..on('POST', 'auth/mobile/refresh', (_) async {
            await release.future;
            return FakeResponse.ok(sessionJson(accessToken: 'access-2'));
          })
          ..on('POST', 'auth/mobile/logout', (_) => FakeResponse.ok(null));
        await manager.start(
          MobileSession.fromJson(sessionJson()),
          persist: true,
        );

        final refresh = manager.refreshAfterRejection('access-1');
        await manager.signOut();
        release.complete();

        await expectLater(refresh, throwsA(isA<ApiFailure>()));
        expect(manager.state, isA<AuthSignedOut>());
        expect(manager.accessToken, isNull);
        expect(await store.read(), isNull);
      },
    );
  });

  test('a session that is not remembered never reaches the keystore', () async {
    await storeSession();
    await manager.start(MobileSession.fromJson(sessionJson()), persist: false);

    expect(manager.state, isA<AuthSignedIn>());
    expect(manager.accessToken, 'access-1');
    expect(await store.read(), isNull);
  });

  test('sign-out clears the device and revokes the server session', () async {
    backend.on('POST', 'auth/mobile/logout', (_) => FakeResponse.ok(null));
    await manager.start(MobileSession.fromJson(sessionJson()), persist: true);

    await manager.signOut();

    expect(
      (manager.state as AuthSignedOut).reason,
      SignOutReason.userInitiated,
    );
    expect(await store.read(), isNull);
    expect(bodyOf(backend.requestsTo('POST', 'auth/mobile/logout').single), {
      'refreshToken': 'refresh-token-0000000000000000000000000000001',
    });
  });
}
