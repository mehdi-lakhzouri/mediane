import 'package:driver_health_app/app/router/app_router.dart';
import 'package:driver_health_app/features/password_recovery/presentation/screens/forgot_password_screen.dart';
import 'package:driver_health_app/features/password_recovery/presentation/screens/reset_password_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_backend.dart';
import '../../helpers/test_app.dart';

void main() {
  late FakeBackend backend;

  setUp(() {
    backend = FakeBackend();
  });

  testWidgets(
    'requests private recovery instructions and shows the sent state',
    (tester) async {
      backend.on(
        'POST',
        'auth/mobile/password/forgot',
        (_) => const FakeResponse(202, {
          'data': null,
          'meta': {'requestId': 'request', 'timestamp': '2026-10-03T00:00:00Z'},
          'error': null,
        }),
      );
      await pumpCabinGuard(tester, backend: backend);

      await tester.tap(find.text('Forgot password?'));
      await tester.pumpAndSettle();
      expect(find.text('Reset your password'), findsOneWidget);

      await tester.tap(find.text('Send reset instructions'));
      await tester.pumpAndSettle();
      expect(find.text('Enter your email address.'), findsOneWidget);

      await tester.enterText(
        find.descendant(
          of: find.byKey(ForgotPasswordScreen.emailFieldKey),
          matching: find.byType(TextFormField),
        ),
        'driver@example.com',
      );
      await tester.tap(find.text('Send reset instructions'));
      await pumpSteps(tester);

      expect(find.text('Check your inbox'), findsOneWidget);
      expect(find.text('driver@example.com'), findsOneWidget);
      expect(find.textContaining('Available again in 00:'), findsOneWidget);
      expect(
        bodyOf(
          backend.requestsTo('POST', 'auth/mobile/password/forgot').single,
        ),
        {'email': 'driver@example.com'},
      );
    },
  );

  testWidgets('validates and consumes a deep-linked password reset', (
    tester,
  ) async {
    const token = 'reset-token-00000000000000000000000000000001';
    backend
      ..on(
        'POST',
        'auth/mobile/password/validate',
        (_) => FakeResponse.ok({
          'expiresAt': DateTime.now()
              .toUtc()
              .add(const Duration(minutes: 20))
              .toIso8601String(),
        }),
      )
      ..on('POST', 'auth/mobile/password/reset', (_) => FakeResponse.ok(null));
    final container = await pumpCabinGuard(tester, backend: backend);

    container.read(appRouterProvider).go('/reset-password#token=$token');
    await tester.pumpAndSettle();

    expect(find.text('Reset link verified'), findsOneWidget);
    expect(
      bodyOf(
        backend.requestsTo('POST', 'auth/mobile/password/validate').single,
      ),
      {'token': token},
    );

    final passwordField = find.descendant(
      of: find.byKey(ResetPasswordScreen.passwordFieldKey),
      matching: find.byType(TextFormField),
    );
    final confirmationField = find.descendant(
      of: find.byKey(ResetPasswordScreen.confirmationFieldKey),
      matching: find.byType(TextFormField),
    );
    await tester.enterText(passwordField, 'A new secure passphrase 2026!');
    await tester.enterText(confirmationField, 'A new secure passphrase 2026!');
    await tester.ensureVisible(find.text('Reset password'));
    await tester.tap(find.text('Reset password'));
    await pumpSteps(tester, steps: 20);

    expect(find.text('You’re ready to sign in'), findsOneWidget);
    expect(
      bodyOf(backend.requestsTo('POST', 'auth/mobile/password/reset').single),
      {'token': token, 'newPassword': 'A new secure passphrase 2026!'},
    );
  });

  testWidgets('explains an invalid or consumed reset link', (tester) async {
    backend.on(
      'POST',
      'auth/mobile/password/validate',
      (_) => FakeResponse.error(
        422,
        'PASSWORD_RESET_TOKEN_INVALID',
        'This password reset link is invalid or has expired.',
      ),
    );
    final container = await pumpCabinGuard(tester, backend: backend);

    container
        .read(appRouterProvider)
        .go('/reset-password#token=invalid-reset-token-00000000000000000');
    await tester.pumpAndSettle();

    expect(find.text('This link has expired'), findsOneWidget);
    expect(find.text('Request a new link'), findsOneWidget);
  });
}
