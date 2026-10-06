import 'package:driver_health_app/app/router/app_router.dart';
import 'package:driver_health_app/features/account_activation/presentation/screens/activate_account_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_backend.dart';
import '../../helpers/test_app.dart';

void main() {
  const token = 'invite-token-0000000000000000000000000000001';
  late FakeBackend backend;

  setUp(() {
    backend = FakeBackend()
      ..on('POST', 'invitations/mobile/accept', (request) {
        return bodyOf(request)['token'] == token
            ? FakeResponse.ok(null)
            : FakeResponse.error(
                422,
                'INVITATION_INVALID',
                'This invitation is invalid or has expired.',
              );
      });
  });

  Future<void> tapVisible(WidgetTester tester, String label) async {
    await tester.ensureVisible(find.text(label));
    await tester.tap(find.text(label));
    await tester.pumpAndSettle();
  }

  testWidgets('activates from the emailed link only after an explicit tap', (
    tester,
  ) async {
    final container = await pumpCabinGuard(tester, backend: backend);

    container.read(appRouterProvider).go('/accept-invitation#token=$token');
    await tester.pumpAndSettle();

    expect(find.text('Activate your account'), findsOneWidget);
    expect(backend.requestsTo('POST', 'invitations/mobile/accept'), isEmpty);

    await tapVisible(tester, 'Activate account');

    expect(find.text('You’re all set'), findsOneWidget);
    expect(
      bodyOf(backend.requestsTo('POST', 'invitations/mobile/accept').single),
      {'token': token},
    );

    await tapVisible(tester, 'Continue to sign in');
    expect(find.text('Welcome back'), findsOneWidget);
  });

  testWidgets('explains a used or expired invitation', (tester) async {
    final container = await pumpCabinGuard(tester, backend: backend);

    container
        .read(appRouterProvider)
        .go('/accept-invitation#token=expired-token-00000000000000000000000');
    await tester.pumpAndSettle();
    await tapVisible(tester, 'Activate account');

    expect(find.textContaining('already used, or expired'), findsOneWidget);
  });

  testWidgets('activates from a pasted link reached through sign-in', (
    tester,
  ) async {
    await pumpCabinGuard(tester, backend: backend);

    await tapVisible(tester, 'Activate your account');
    final field = find.descendant(
      of: find.byKey(ActivateAccountScreen.linkFieldKey),
      matching: find.byType(TextFormField),
    );

    await tester.enterText(field, 'not a link');
    await tapVisible(tester, 'Activate account');
    expect(
      find.text('Paste the full link from your invitation email.'),
      findsOneWidget,
    );

    await tester.enterText(
      field,
      'https://cabinguard.app/accept-invitation#token=$token',
    );
    await tapVisible(tester, 'Activate account');
    expect(find.text('You’re all set'), findsOneWidget);
  });
}
