import 'package:driver_health_app/core/storage/secure_session_store.dart';
import 'package:driver_health_app/features/auth/presentation/screens/login_screen.dart';
import 'package:driver_health_app/features/auth/presentation/screens/mfa_verification_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_backend.dart';
import '../../helpers/test_app.dart';

void main() {
  late FakeBackend backend;

  const store = SecureSessionStore(FlutterSecureStorage());

  Map<String, Object?> me() => {
    'userId': '7b0b8f8e-2f7a-4d6b-9a52-111111111111',
    'role': 'DRIVER',
    'accountState': 'ACTIVE',
    'email': 'amira@example.com',
    'firstName': 'Amira',
    'lastName': 'Haddad',
  };

  FakeHandler mfaChallenge() => (_) {
    final now = DateTime.now().toUtc();
    return FakeResponse.ok({
      'mfaRequired': true,
      'mfaToken': 'mfa-token-000000000000000000000000000000000001',
      'expiresAt': now.add(const Duration(minutes: 5)).toIso8601String(),
    }, serverTime: now);
  };

  Future<void> signIn(
    WidgetTester tester, {
    String email = 'amira@example.com',
    String password = 'correct horse battery',
  }) async {
    await tester.enterText(
      find.descendant(
        of: find.byKey(LoginScreen.emailFieldKey),
        matching: find.byType(TextFormField),
      ),
      email,
    );
    await tester.enterText(
      find.descendant(
        of: find.byKey(LoginScreen.passwordFieldKey),
        matching: find.byType(TextFormField),
      ),
      password,
    );
    await tester.tap(find.text('Sign in'));
  }

  setUp(() {
    backend = FakeBackend()
      ..on('GET', 'auth/me', (request) {
        return bearerOf(request) == null
            ? FakeResponse.error(401, 'AUTHENTICATION_REQUIRED')
            : FakeResponse.ok(me());
      })
      ..on('POST', 'auth/mobile/logout', (_) => FakeResponse.ok(null));
  });

  testWidgets('signs in, remembers the device, and opens home', (tester) async {
    backend.on(
      'POST',
      'auth/mobile/login',
      (_) => FakeResponse.ok({'mfaRequired': false, ...sessionJson()}),
    );
    await pumpCabinGuard(tester, backend: backend);

    await signIn(tester);
    await tester.pumpAndSettle();

    expect(homeGreeting, findsOneWidget);
    expect(bodyOf(backend.requestsTo('POST', 'auth/mobile/login').single), {
      'email': 'amira@example.com',
      'password': 'correct horse battery',
    });
    expect(
      bearerOf(backend.requestsTo('GET', 'mobile/dashboard').single),
      'access-1',
    );
    final stored = await store.read();
    expect(stored?.refreshToken, sessionJson()['refreshToken']);
  });

  testWidgets('keeps an unremembered session out of the keystore', (
    tester,
  ) async {
    backend.on(
      'POST',
      'auth/mobile/login',
      (_) => FakeResponse.ok({'mfaRequired': false, ...sessionJson()}),
    );
    await pumpCabinGuard(tester, backend: backend);

    await tester.tap(find.text('Remember this device'));
    await signIn(tester);
    await tester.pumpAndSettle();

    expect(homeGreeting, findsOneWidget);
    expect(await store.read(), isNull);
  });

  testWidgets('validates the form before contacting the server', (
    tester,
  ) async {
    await pumpCabinGuard(tester, backend: backend);

    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
    expect(find.text('Enter your email address.'), findsOneWidget);
    expect(find.text('Enter your password.'), findsOneWidget);

    await signIn(tester, email: 'not-an-email');
    await tester.pumpAndSettle();
    expect(find.text('Enter a valid email address.'), findsOneWidget);
    expect(backend.requestsTo('POST', 'auth/mobile/login'), isEmpty);
  });

  testWidgets('shows the server message for rejected credentials', (
    tester,
  ) async {
    backend.on(
      'POST',
      'auth/mobile/login',
      (_) => FakeResponse.error(
        401,
        'INVALID_CREDENTIALS',
        'Invalid email or password.',
      ),
    );
    await pumpCabinGuard(tester, backend: backend);

    await signIn(tester);
    await tester.pumpAndSettle();

    expect(find.text('Invalid email or password.'), findsOneWidget);
    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('explains sign-in throttling', (tester) async {
    backend.on(
      'POST',
      'auth/mobile/login',
      (_) => FakeResponse.error(429, 'RATE_LIMITED'),
    );
    await pumpCabinGuard(tester, backend: backend);

    await signIn(tester);
    await tester.pumpAndSettle();

    expect(
      find.text('Too many sign-in attempts. Wait a few minutes and try again.'),
      findsOneWidget,
    );
  });

  testWidgets('routes a temporary password to the secure-account step', (
    tester,
  ) async {
    backend.on(
      'POST',
      'auth/mobile/login',
      (_) => FakeResponse.ok({
        'mfaRequired': false,
        ...sessionJson(accountState: 'PASSWORD_CHANGE_REQUIRED'),
      }),
    );
    await pumpCabinGuard(tester, backend: backend);

    await signIn(tester);
    await tester.pumpAndSettle();

    expect(find.text('Secure your account'), findsOneWidget);

    await tester.ensureVisible(find.text('Sign out'));
    await tester.tap(find.text('Sign out'));
    await tester.pumpAndSettle();
    expect(find.text('Welcome back'), findsOneWidget);
    expect(backend.requestsTo('POST', 'auth/mobile/logout'), hasLength(1));
  });

  group('two-step verification', () {
    testWidgets('rejects a wrong code, then accepts the right one', (
      tester,
    ) async {
      backend
        ..on('POST', 'auth/mobile/login', mfaChallenge())
        ..on('POST', 'auth/mobile/mfa/challenge', (request) {
          return bodyOf(request)['code'] == '123456'
              ? FakeResponse.ok(sessionJson())
              : FakeResponse.error(
                  400,
                  'MFA_CODE_INVALID',
                  'The verification code is not valid.',
                );
        });
      await pumpCabinGuard(tester, backend: backend);

      await signIn(tester);
      await pumpSteps(tester);
      expect(find.text('Enter your code'), findsOneWidget);
      expect(find.textContaining('expires in 0'), findsOneWidget);

      final codeField = find.descendant(
        of: find.byKey(MfaVerificationScreen.codeFieldKey),
        matching: find.byType(EditableText),
      );
      await tester.enterText(codeField, '000000');
      await pumpSteps(tester);
      expect(find.text('That code is invalid. Try again.'), findsOneWidget);

      await tester.enterText(codeField, '123456');
      await pumpSteps(tester, steps: 20);

      expect(homeGreeting, findsOneWidget);
      final challenges = backend.requestsTo(
        'POST',
        'auth/mobile/mfa/challenge',
      );
      expect(challenges.map((request) => bodyOf(request)['code']), [
        '000000',
        '123456',
      ]);
      expect(
        bodyOf(challenges.last)['mfaToken'],
        'mfa-token-000000000000000000000000000000000001',
      );
    });

    testWidgets('accepts a recovery code instead', (tester) async {
      backend
        ..on('POST', 'auth/mobile/login', mfaChallenge())
        ..on(
          'POST',
          'auth/mobile/mfa/challenge',
          (_) => FakeResponse.ok(sessionJson()),
        );
      await pumpCabinGuard(tester, backend: backend);

      await signIn(tester);
      await pumpSteps(tester);
      await tester.tap(find.text('Use a recovery code'));
      await pumpSteps(tester);

      final recoveryField = find.descendant(
        of: find.byKey(MfaVerificationScreen.recoveryFieldKey),
        matching: find.byType(TextFormField),
      );
      await tester.enterText(recoveryField, 'abc');
      await tester.ensureVisible(find.text('Verify code'));
      await tester.tap(find.text('Verify code'));
      await pumpSteps(tester);
      expect(
        find.text('Recovery codes have 10 letters and numbers.'),
        findsOneWidget,
      );

      await tester.enterText(recoveryField, 'ABCDE-12345');
      await tester.ensureVisible(find.text('Verify code'));
      await tester.tap(find.text('Verify code'));
      await pumpSteps(tester, steps: 20);

      expect(homeGreeting, findsOneWidget);
      expect(
        bodyOf(
          backend.requestsTo('POST', 'auth/mobile/mfa/challenge').single,
        )['code'],
        'ABCDE-12345',
      );
    });

    testWidgets('an expired attempt sends the driver back to sign in', (
      tester,
    ) async {
      backend
        ..on('POST', 'auth/mobile/login', mfaChallenge())
        ..on(
          'POST',
          'auth/mobile/mfa/challenge',
          (_) => FakeResponse.error(
            401,
            'MFA_CHALLENGE_INVALID',
            'This sign-in attempt has expired. Sign in again.',
          ),
        );
      await pumpCabinGuard(tester, backend: backend);

      await signIn(tester);
      await pumpSteps(tester);
      await tester.enterText(
        find.descendant(
          of: find.byKey(MfaVerificationScreen.codeFieldKey),
          matching: find.byType(EditableText),
        ),
        '123456',
      );
      await pumpSteps(tester);

      expect(find.textContaining('has expired'), findsOneWidget);
      await tester.ensureVisible(find.text('Sign in again'));
      await tester.tap(find.text('Sign in again'));
      await tester.pumpAndSettle();
      expect(find.text('Welcome back'), findsOneWidget);
    });
  });

  testWidgets('restores a remembered session and ends it when revoked', (
    tester,
  ) async {
    var refreshes = 0;
    backend
      ..on('POST', 'auth/mobile/refresh', (_) {
        refreshes++;
        return refreshes == 1
            ? FakeResponse.ok(sessionJson(accessToken: 'access-2'))
            : FakeResponse.error(401, 'SESSION_INVALID');
      })
      // The session was revoked from another device after startup.
      ..on(
        'GET',
        'mobile/dashboard',
        (_) => FakeResponse.error(401, 'SESSION_INVALID'),
      );
    final now = DateTime.now().toUtc();

    await pumpCabinGuard(
      tester,
      backend: backend,
      keystore: {
        'session.userId': 'user-1',
        'session.accessToken': 'access-1',
        'session.refreshToken': 'refresh-token-stored-000000000000000000000000',
        'session.accessTokenExpiresAt': now.toIso8601String(),
        'session.refreshTokenExpiresAt': now
            .add(const Duration(days: 30))
            .toIso8601String(),
      },
    );

    expect(find.text('Please sign in again'), findsOneWidget);
    expect(refreshes, 2);
    expect(
      bearerOf(backend.requestsTo('GET', 'mobile/dashboard').single),
      'access-2',
    );
    expect(await store.read(), isNull);
  });
}
