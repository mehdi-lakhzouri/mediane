import 'package:driver_health_app/features/auth/presentation/screens/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_backend.dart';
import '../../helpers/family_fixtures.dart';
import '../../helpers/test_app.dart';

Map<String, Object?> _profile({List<Map<String, Object?>>? contacts}) => {
  'phoneNumber': '+21612345678',
  'dateOfBirth': '1990-05-17',
  'gender': 'FEMALE',
  'emergencyContacts':
      contacts ??
      [
        {
          'fullName': 'Karim Ben Salah',
          'relationship': 'SIBLING',
          'phoneNumber': '+21655111222',
          'priority': 1,
        },
        {
          'fullName': 'Amira Ben Salah',
          'relationship': 'SPOUSE',
          'phoneNumber': '+21698765432',
          'priority': 2,
        },
      ],
  'avatar': null,
  'completedAt': '2026-10-01T10:00:00Z',
  'accountState': 'ACTIVE',
};

void main() {
  late FakeBackend backend;

  Future<void> tapVisible(WidgetTester tester, Finder finder) async {
    // Lists build lazily: scroll until the target exists, then reveal it.
    if (finder.evaluate().isEmpty) {
      await tester.scrollUntilVisible(
        finder,
        200,
        scrollable: find.byType(Scrollable).first,
      );
    }
    await tester.ensureVisible(finder);
    await tester.pump();
    await tester.tap(finder);
    await tester.pumpAndSettle();
  }

  Future<void> signIn(WidgetTester tester) async {
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
  }

  setUp(() {
    backend = FakeBackend()
      ..on(
        'POST',
        'auth/mobile/login',
        (_) => FakeResponse.ok({'mfaRequired': false, ...sessionJson()}),
      )
      ..on('GET', 'profile', (_) => FakeResponse.ok(_profile()))
      ..on(
        'GET',
        'auth/me',
        (_) => FakeResponse.ok({
          'userId': '7b0b8f8e-2f7a-4d6b-9a52-111111111111',
          'accountState': 'ACTIVE',
          'email': 'amira@example.com',
          'firstName': 'Amira',
          'lastName': 'Haddad',
        }),
      );
  });

  testWidgets('summarizes the driver and hides unavailable features', (
    tester,
  ) async {
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);

    expect(homeGreeting, findsOneWidget);
    expect(find.text('Amira Haddad'), findsOneWidget);
    expect(find.text('Safety plan ready'), findsOneWidget);
    expect(find.text('2 emergency contacts'), findsOneWidget);
    expect(
      find.text('Keep your family informed: create or join a family'),
      findsOneWidget,
    );
    expect(find.text('Protect your sign-in'), findsOneWidget);
    expect(find.text('SOS'), findsNothing);
    expect(find.textContaining('medical event'), findsNothing);
    expect(find.byTooltip('Notifications'), findsNothing);
  });

  testWidgets('points owners to waiting join requests', (tester) async {
    backend
      ..on(
        'GET',
        'families/mine',
        (_) => FakeResponse.ok(myFamilyJson(pendingRequestCount: 2)),
      )
      ..on(
        'GET',
        'mobile/dashboard',
        (_) => FakeResponse.ok(
          dashboardJson(
            familyState: 'OWNER',
            pendingJoinRequests: 2,
            mfaEnabled: true,
          ),
        ),
      );
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);

    expect(find.text('2 join requests are waiting for you'), findsOneWidget);
    expect(find.text('Protect your sign-in'), findsNothing);

    await tapVisible(tester, find.text('Review'));
    expect(find.text('My family'), findsOneWidget);
    expect(find.text('2 requests waiting'), findsOneWidget);
  });

  testWidgets('shows a pending request while waiting for approval', (
    tester,
  ) async {
    backend.on(
      'GET',
      'mobile/dashboard',
      (_) => FakeResponse.ok(dashboardJson(familyState: 'REQUEST_PENDING')),
    );
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);

    expect(
      find.text('Request sent to Ben Salah. Waiting for approval.'),
      findsOneWidget,
    );
  });

  testWidgets('recovers from a failed load', (tester) async {
    var calls = 0;
    backend.on('GET', 'mobile/dashboard', (_) {
      calls++;
      return calls == 1
          ? FakeResponse.error(503, 'SERVICE_UNAVAILABLE', 'Try later.')
          : FakeResponse.ok(dashboardJson());
    });
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);

    expect(find.text('Try later.'), findsOneWidget);
    await tapVisible(tester, find.text('Try again'));
    expect(homeGreeting, findsOneWidget);
  });

  testWidgets('edits personal details from the Profile tab', (tester) async {
    Map<String, Object?>? saved;
    backend.on('PUT', 'profile', (request) {
      saved = bodyOf(request);
      return FakeResponse.ok(_profile());
    });
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);

    await tapVisible(tester, find.text('Profile'));
    expect(find.text('amira@example.com'), findsOneWidget);
    await tapVisible(tester, find.text('Personal details'));
    expect(find.text('Save changes'), findsOneWidget);
    expect(find.text('Step 1 of 2'), findsNothing);

    await tapVisible(tester, find.text('Male'));
    await tapVisible(tester, find.text('Save changes'));

    expect(find.text('Your details were saved.'), findsOneWidget);
    expect(saved?['gender'], 'MALE');
    expect(
      (saved?['emergencyContacts'] as List?)?.length,
      2,
      reason: 'the full profile is replaced, contacts included',
    );
    expect(find.text('Personal details'), findsOneWidget);
    expect(backend.requestsTo('GET', 'mobile/dashboard').length, 2);
  });

  testWidgets('asks for consent again only when contacts change', (
    tester,
  ) async {
    Map<String, Object?>? saved;
    backend.on('PUT', 'profile', (request) {
      saved = bodyOf(request);
      return FakeResponse.ok(
        _profile(
          contacts: [
            {
              'fullName': 'Amira Ben Salah',
              'relationship': 'SPOUSE',
              'phoneNumber': '+21698765432',
              'priority': 1,
            },
          ],
        ),
      );
    });
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);

    await tapVisible(tester, find.text('Emergency contacts'));
    final save = find.widgetWithText(InkWell, 'Save contacts');
    expect(find.textContaining('I confirm these contacts'), findsNothing);

    await tapVisible(tester, find.byTooltip('Remove Karim Ben Salah'));
    await tapVisible(tester, find.text('Remove'));
    expect(find.textContaining('I confirm these contacts'), findsOneWidget);
    await tapVisible(tester, save);
    expect(saved, isNull);

    await tapVisible(tester, find.textContaining('I confirm these contacts'));
    await tapVisible(tester, save);

    expect(find.text('Emergency contacts saved.'), findsOneWidget);
    expect(
      (saved?['emergencyContacts'] as List?)?.map(
        (contact) => (contact as Map)['fullName'],
      ),
      ['Amira Ben Salah'],
    );
  });
}
