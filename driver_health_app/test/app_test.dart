import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'helpers/fake_backend.dart';
import 'helpers/test_app.dart';

void main() {
  late FakeBackend backend;

  setUp(() => backend = FakeBackend());

  testWidgets('a first launch goes from splash to onboarding to sign-in', (
    tester,
  ) async {
    await pumpCabinGuard(tester, backend: backend, onboardingCompleted: false);

    expect(find.text('Protection on\nevery journey'), findsOneWidget);
    expect(find.text('Health signals'), findsOneWidget);

    await tester.tap(find.text('Skip'));
    await tester.pumpAndSettle();

    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('a returning user without a session goes straight to sign-in', (
    tester,
  ) async {
    await pumpCabinGuard(tester, backend: backend);

    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('a corrupted keystore explains why sign-in is needed', (
    tester,
  ) async {
    await pumpCabinGuard(
      tester,
      backend: backend,
      keystore: {'session.refreshToken': 'orphaned'},
    );

    expect(find.text('Please sign in again'), findsOneWidget);

    await tester.tap(find.widgetWithText(InkWell, 'Sign in'));
    await tester.pumpAndSettle();

    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('an unsupported version must update before anything else', (
    tester,
  ) async {
    await pumpCabinGuard(tester, backend: backend, appVersion: '0.9.0');

    expect(find.text('Update Mediane'), findsOneWidget);
  });

  testWidgets('an unreachable network shows the offline screen', (
    tester,
  ) async {
    backend.on('GET', 'mobile/bootstrap', offline);
    await pumpCabinGuard(tester, backend: backend);

    expect(find.text('You’re offline'), findsOneWidget);
  });

  testWidgets('a failing service is not reported as being offline', (
    tester,
  ) async {
    backend.on(
      'GET',
      'mobile/bootstrap',
      (_) => FakeResponse.error(503, 'SERVICE_UNAVAILABLE'),
    );
    await pumpCabinGuard(tester, backend: backend);

    expect(find.text('We’ll be right back'), findsOneWidget);
  });

  testWidgets('maintenance mode blocks startup with the server message', (
    tester,
  ) async {
    backend.on(
      'GET',
      'mobile/bootstrap',
      (_) => FakeResponse.ok(bootstrapJson(maintenance: true)),
    );
    await pumpCabinGuard(tester, backend: backend);

    expect(find.text('A quick safety update'), findsOneWidget);
    expect(
      find.text('Mediane is receiving a safety update.'),
      findsOneWidget,
    );
  });
}
