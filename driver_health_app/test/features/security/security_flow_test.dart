import 'package:driver_health_app/core/security/biometric_authenticator.dart';
import 'package:driver_health_app/core/security/secret_screen_guard.dart';
import 'package:driver_health_app/features/auth/presentation/screens/login_screen.dart';
import 'package:driver_health_app/features/security/presentation/screens/authenticator_confirm_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_backend.dart';
import '../../helpers/fake_biometrics.dart';
import '../../helpers/test_app.dart';

const _userId = '7b0b8f8e-2f7a-4d6b-9a52-111111111111';
const _codes = [
  'K7M4Q-X9PRT',
  'B2NV8-QL6CW',
  'R5TKA-4MH2D',
  'Y8PC3-WN7GX',
  'F6JQD-9L2VB',
  'M4XRT-8CK5N',
  'H9W2K-P7DQM',
  'Q3VNB-5T8LR',
  'C7G4M-X2JPA',
  'N6R8Y-K4WQF',
];

void main() {
  late FakeBackend backend;
  late bool mfaEnabled;
  late List<bool> secureFlags;

  FakeResponse invalidCode() => const FakeResponse(400, {
    'data': null,
    'meta': {'requestId': 'r', 'timestamp': '2026-10-03T10:00:00Z'},
    'error': {
      'code': 'MFA_CODE_INVALID',
      'message': 'The verification code is not valid.',
      'details': [
        {'field': 'code', 'message': 'is not valid'},
      ],
    },
  });

  Map<String, Object?> status() => {
    'enabled': mfaEnabled,
    'enabledAt': mfaEnabled ? '2026-10-03T09:00:00Z' : null,
    'required': false,
    'recoveryCodesRemaining': mfaEnabled ? 10 : 0,
    'recoveryCodesLow': false,
  };

  Future<void> tapVisible(WidgetTester tester, Finder finder) async {
    await tester.ensureVisible(finder);
    await tester.pump();
    await tester.tap(finder);
  }

  Future<void> signInAndOpenSecurity(WidgetTester tester) async {
    await tester.enterText(
      find.descendant(
        of: find.byKey(LoginScreen.emailFieldKey),
        matching: find.byType(TextFormField),
      ),
      'amira@example.com',
    );
    await tester.enterText(
      find.descendant(
        of: find.byKey(LoginScreen.passwordFieldKey),
        matching: find.byType(TextFormField),
      ),
      'correct horse battery',
    );
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('Security'),
      200,
      scrollable: find.byType(Scrollable).first,
    );
    await tapVisible(tester, find.text('Security'));
    await tester.pumpAndSettle();
  }

  Future<void> enterSheetCode(WidgetTester tester, String code) async {
    await tester.enterText(
      find.descendant(
        of: find.byType(BottomSheet),
        matching: find.byType(TextFormField),
      ),
      code,
    );
  }

  setUp(() {
    mfaEnabled = false;
    secureFlags = [];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SecretScreenGuard.channel, (call) async {
          secureFlags.add(call.arguments as bool);
          return null;
        });
    backend = FakeBackend()
      ..on(
        'POST',
        'auth/mobile/login',
        (_) => FakeResponse.ok({'mfaRequired': false, ...sessionJson()}),
      )
      ..on(
        'GET',
        'auth/me',
        (_) => FakeResponse.ok({
          'userId': _userId,
          'accountState': 'ACTIVE',
          'email': 'amira@example.com',
          'firstName': 'Amira',
          'lastName': 'Haddad',
        }),
      )
      ..on('GET', 'auth/mfa', (_) => FakeResponse.ok(status()))
      ..on('POST', 'auth/mfa/totp/setup', (_) {
        final now = DateTime.now().toUtc();
        return FakeResponse.ok({
          'secret': 'JBSWY3DPEHPK3PXP',
          'otpauthUri':
              'otpauth://totp/CabinGuard:amira%40example.com'
              '?secret=JBSWY3DPEHPK3PXP&issuer=CabinGuard',
          'issuer': 'CabinGuard',
          'accountName': 'amira@example.com',
          'algorithm': 'SHA1',
          'digits': 6,
          'period': 30,
          'expiresAt': now.add(const Duration(minutes: 15)).toIso8601String(),
        }, serverTime: now);
      })
      ..on('POST', 'auth/mfa/totp/confirm', (request) {
        if (bodyOf(request)['code'] != '123456') return invalidCode();
        mfaEnabled = true;
        return FakeResponse.ok({
          'recoveryCodes': _codes,
          'accountState': 'ACTIVE',
        });
      })
      ..on('POST', 'auth/mfa/recovery-codes', (request) {
        return bodyOf(request)['code'] == '123456'
            ? FakeResponse.ok({
                'recoveryCodes': _codes.reversed.toList(),
                'accountState': 'ACTIVE',
              })
            : invalidCode();
      })
      ..on('POST', 'auth/mfa/totp/disable', (request) {
        if (bodyOf(request)['code'] != '123456') return invalidCode();
        mfaEnabled = false;
        return FakeResponse.ok(status());
      });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(SecretScreenGuard.channel, null);
  });

  testWidgets('enrolls an authenticator and shows recovery codes once', (
    tester,
  ) async {
    await pumpCabinGuard(tester, backend: backend);
    await signInAndOpenSecurity(tester);
    expect(find.text('Off'), findsOneWidget);

    await tapVisible(tester, find.text('Set up authenticator'));
    await pumpSteps(tester);
    expect(find.text('Security setup · 1 of 2'), findsOneWidget);
    expect(
      tester.widget<SelectableText>(find.byType(SelectableText)).data,
      'JBSW Y3DP EHPK 3PXP',
    );
    expect(
      find.textContaining('amira@example.com', findRichText: true),
      findsOneWidget,
    );
    expect(secureFlags, [true]);

    await tapVisible(tester, find.text('I’ve added the account'));
    await pumpSteps(tester);
    final codeField = find.descendant(
      of: find.byKey(AuthenticatorConfirmScreen.codeFieldKey),
      matching: find.byType(EditableText),
    );
    await tester.enterText(codeField, '000000');
    await pumpSteps(tester);
    expect(find.textContaining('That code didn’t match'), findsOneWidget);

    await tester.enterText(codeField, '123456');
    await pumpSteps(tester, steps: 15);
    expect(find.text('Save your recovery codes'), findsOneWidget);
    expect(find.text('Security setup · 2 of 2'), findsOneWidget);
    expect(find.text('K7M4Q-X9PRT'), findsOneWidget);

    await tapVisible(tester, find.text('Finish security setup'));
    await pumpSteps(tester);
    expect(find.text('Save your recovery codes'), findsOneWidget);

    await tapVisible(tester, find.text('I saved these codes somewhere safe'));
    await pumpSteps(tester);
    await tapVisible(tester, find.text('Finish security setup'));
    await tester.pumpAndSettle();

    expect(find.text('On'), findsOneWidget);
    expect(find.text('10 recovery codes left'), findsOneWidget);
    expect(find.text('K7M4Q-X9PRT'), findsNothing);
    expect(secureFlags.last, isFalse);
  });

  testWidgets('regenerates recovery codes after a valid code', (tester) async {
    mfaEnabled = true;
    await pumpCabinGuard(tester, backend: backend);
    await signInAndOpenSecurity(tester);

    await tapVisible(tester, find.text('Create new recovery codes'));
    await tester.pumpAndSettle();
    await enterSheetCode(tester, '000000');
    await tapVisible(tester, find.text('Create new codes'));
    await tester.pumpAndSettle();
    expect(find.text('That code isn’t valid. Try a new one.'), findsOneWidget);

    await enterSheetCode(tester, '123456');
    await tapVisible(tester, find.text('Create new codes'));
    await pumpSteps(tester, steps: 15);

    expect(find.text('New recovery codes'), findsOneWidget);
    expect(find.text('N6R8Y-K4WQF'), findsOneWidget);
    await tapVisible(tester, find.text('I saved these codes somewhere safe'));
    await pumpSteps(tester);
    await tapVisible(tester, find.text('Done'));
    await tester.pumpAndSettle();
    expect(find.text('Security'), findsOneWidget);
  });

  testWidgets('turns two-step verification off with a code', (tester) async {
    mfaEnabled = true;
    await pumpCabinGuard(tester, backend: backend);
    await signInAndOpenSecurity(tester);
    expect(find.text('On'), findsOneWidget);

    await tapVisible(tester, find.text('Turn off two-step verification'));
    await tester.pumpAndSettle();
    await enterSheetCode(tester, '123456');
    await tapVisible(tester, find.text('Turn off'));
    await tester.pumpAndSettle();

    expect(find.text('Off'), findsOneWidget);
    expect(find.text('Set up authenticator'), findsOneWidget);
  });

  group('biometric unlock', () {
    Map<String, String> savedSession({bool optedIn = true}) {
      final now = DateTime.now().toUtc();
      return {
        'session.userId': _userId,
        'session.accessToken': 'access-1',
        'session.refreshToken': 'refresh-token-stored-000000000000000000000000',
        'session.accessTokenExpiresAt': now.toIso8601String(),
        'session.refreshTokenExpiresAt': now
            .add(const Duration(days: 30))
            .toIso8601String(),
        if (optedIn) 'biometricUnlock.$_userId': 'true',
      };
    }

    setUp(() {
      backend.on(
        'POST',
        'auth/mobile/refresh',
        (_) => FakeResponse.ok(sessionJson(accessToken: 'access-2')),
      );
    });

    testWidgets('opting in requires a successful prompt', (tester) async {
      final biometrics = FakeBiometrics(results: [BiometricResult.cancelled]);
      await pumpCabinGuard(tester, backend: backend, biometrics: biometrics);
      await signInAndOpenSecurity(tester);

      await tapVisible(tester, find.byType(Switch));
      await tester.pumpAndSettle();
      expect(tester.widget<Switch>(find.byType(Switch)).value, isFalse);

      await tapVisible(tester, find.byType(Switch));
      await tester.pumpAndSettle();
      expect(tester.widget<Switch>(find.byType(Switch)).value, isTrue);
      expect(biometrics.prompts, 2);
      expect(
        await const FlutterSecureStorage().read(
          key: 'biometricUnlock.$_userId',
        ),
        'true',
      );
    });

    testWidgets('a saved session waits for biometrics at launch', (
      tester,
    ) async {
      final biometrics = FakeBiometrics(results: [BiometricResult.cancelled]);
      await pumpCabinGuard(
        tester,
        backend: backend,
        biometrics: biometrics,
        keystore: savedSession(),
      );

      expect(find.text('Unlock CabinGuard'), findsOneWidget);
      expect(homeGreeting, findsNothing);
      expect(backend.requestsTo('GET', 'mobile/dashboard'), isEmpty);

      await tapVisible(tester, find.text('Unlock'));
      await tester.pumpAndSettle();
      expect(homeGreeting, findsOneWidget);
    });

    testWidgets('the password remains a way back in', (tester) async {
      backend.on('POST', 'auth/mobile/logout', (_) => FakeResponse.ok(null));
      await pumpCabinGuard(
        tester,
        backend: backend,
        biometrics: FakeBiometrics(results: [BiometricResult.lockedOut]),
        keystore: savedSession(),
      );

      expect(find.textContaining('Too many attempts'), findsOneWidget);
      await tapVisible(tester, find.text('Sign in with your password instead'));
      await tester.pumpAndSettle();
      expect(find.text('Welcome back'), findsOneWidget);
    });

    testWidgets('no lock when the server disables the feature', (tester) async {
      await pumpCabinGuard(
        tester,
        backend: backend,
        biometrics: FakeBiometrics(),
        biometricUnlock: false,
        keystore: savedSession(),
      );

      expect(homeGreeting, findsOneWidget);
    });
  });
}
