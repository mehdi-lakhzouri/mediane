import 'dart:async';

import 'package:driver_health_app/app/router/app_router.dart';
import 'package:driver_health_app/features/auth/presentation/screens/login_screen.dart';
import 'package:driver_health_app/features/family/presentation/screens/create_or_join_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_backend.dart';
import '../../helpers/family_fixtures.dart';
import '../../helpers/test_app.dart';

void main() {
  late FakeBackend backend;
  late Map<String, Object?> mine;

  Future<void> tap(WidgetTester tester, Finder finder) async {
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

  Future<void> openFamilyTab(WidgetTester tester) async {
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
    await tester.tap(find.text('Family').last);
    await tester.pumpAndSettle();
  }

  setUp(() {
    mine = myFamilyJson();
    backend = FakeBackend()
      ..on(
        'POST',
        'auth/mobile/login',
        (_) => FakeResponse.ok({'mfaRequired': false, ...sessionJson()}),
      )
      ..on('GET', 'families/mine', (_) => FakeResponse.ok(mine));
  });

  group('without a family', () {
    setUp(() => mine = Map.of(noFamilyJson));

    testWidgets('creates a family and moves on to inviting', (tester) async {
      backend
        ..on('POST', 'families', (request) {
          mine = myFamilyJson(
            members: [
              memberJson(userId: meId, firstName: 'Amira', role: 'OWNER'),
            ],
          );
          return FakeResponse(201, envelope(data: mine));
        })
        ..on(
          'GET',
          'families/mine/invite',
          (_) => FakeResponse.ok({
            'code': 'K7M4-QX9P',
            'link': 'https://cabinguard.app/join-family#K7M4-QX9P',
            'expiresAt': '2026-10-10T09:41:00Z',
          }),
        );
      await pumpCabinGuard(tester, backend: backend);
      await openFamilyTab(tester);
      expect(find.text('Create a family'), findsOneWidget);

      await tap(tester, find.text('Create family'));
      expect(find.text('Give your family a name.'), findsOneWidget);

      await tester.enterText(
        find.descendant(
          of: find.byKey(CreateOrJoinView.nameFieldKey),
          matching: find.byType(TextFormField),
        ),
        'Ben Salah',
      );
      await tap(tester, find.text('Create family'));

      expect(bodyOf(backend.requestsTo('POST', 'families').single), {
        'name': 'Ben Salah',
      });
      expect(find.text('Invite your family'), findsOneWidget);
      expect(find.text('K7M4-QX9P'), findsOneWidget);

      await tap(tester, find.byTooltip('Back'));
      expect(find.text('My family'), findsOneWidget);
      expect(find.text('1 of 10 members'), findsOneWidget);
    });

    testWidgets('previews a code, requests to join, then withdraws', (
      tester,
    ) async {
      backend
        ..on(
          'GET',
          'families/invites/K7M4QX9P',
          (_) => FakeResponse.ok({
            'familyName': 'Ben Salah',
            'ownerFirstName': 'Karim',
            'memberCount': 3,
            'maxMembers': 10,
            'full': false,
          }),
        )
        ..on('POST', 'families/join', (_) {
          mine = myFamilyJson(inFamily: false, pendingRequest: true);
          return FakeResponse.ok(mine);
        })
        ..on('DELETE', 'families/join-request', (_) {
          mine = Map.of(noFamilyJson);
          return FakeResponse.ok(null);
        });
      await pumpCabinGuard(tester, backend: backend);
      await openFamilyTab(tester);

      final codeField = find.descendant(
        of: find.byKey(CreateOrJoinView.codeFieldKey),
        matching: find.byType(EditableText),
      );
      await tester.enterText(codeField, 'k7m4');
      await tap(tester, find.text('Preview family'));
      expect(
        find.text('Enter the 8-character code, like K7M4-QX9P.'),
        findsOneWidget,
      );

      await tester.enterText(codeField, 'k7m4qx9p');
      await tap(tester, find.text('Preview family'));
      expect(find.text('Owned by Karim'), findsOneWidget);
      expect(find.text('3 of 10 members'), findsOneWidget);

      await tap(tester, find.text('Request to join'));
      expect(bodyOf(backend.requestsTo('POST', 'families/join').single), {
        'code': 'K7M4-QX9P',
      });
      expect(
        find.text('The family owner will review your request.'),
        findsOneWidget,
      );
      expect(find.text('Waiting for owner approval'), findsOneWidget);

      await tap(tester, find.text('Withdraw request'));
      await tap(tester, find.text('Withdraw'));
      expect(find.text('Create a family'), findsOneWidget);
    });

    testWidgets('explains an invalid or full family', (tester) async {
      backend
        ..on(
          'GET',
          'families/invites/AAAABBBB',
          (_) => FakeResponse.error(422, 'FAMILY_INVITE_INVALID'),
        )
        ..on(
          'GET',
          'families/invites/CCCCDDDD',
          (_) => FakeResponse.ok({
            'familyName': 'Full house',
            'ownerFirstName': null,
            'memberCount': 10,
            'maxMembers': 10,
            'full': true,
          }),
        );
      final container = await pumpCabinGuard(tester, backend: backend);
      await openFamilyTab(tester);

      unawaited(
        container
            .read(appRouterProvider)
            .push(AppRoutes.familyPreview('AAAABBBB')),
      );
      await tester.pumpAndSettle();
      expect(
        find.textContaining('doesn’t match an active family'),
        findsOneWidget,
      );

      await tap(tester, find.text('Try another code'));
      unawaited(
        container
            .read(appRouterProvider)
            .push(AppRoutes.familyPreview('CCCCDDDD')),
      );
      await tester.pumpAndSettle();
      expect(find.textContaining('This family is full'), findsOneWidget);
      await tap(tester, find.text('Request to join'));
      expect(backend.requestsTo('POST', 'families/join'), isEmpty);
    });

    testWidgets('resumes a link opened while signed out after sign-in', (
      tester,
    ) async {
      backend.on(
        'GET',
        'families/invites/K7M4QX9P',
        (_) => FakeResponse.ok({
          'familyName': 'Ben Salah',
          'ownerFirstName': 'Karim',
          'memberCount': 3,
          'maxMembers': 10,
          'full': false,
        }),
      );
      final container = await pumpCabinGuard(tester, backend: backend);
      container.read(appRouterProvider).go('/join-family#K7M4-QX9P');
      await tester.pumpAndSettle();
      expect(find.text('Welcome back'), findsOneWidget);

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

      expect(find.text('Code K7M4-QX9P'), findsOneWidget);
      expect(find.text('Owned by Karim'), findsOneWidget);
    });

    testWidgets('opens the preview from a shared link', (tester) async {
      backend.on(
        'GET',
        'families/invites/K7M4QX9P',
        (_) => FakeResponse.ok({
          'familyName': 'Ben Salah',
          'ownerFirstName': 'Karim',
          'memberCount': 3,
          'maxMembers': 10,
          'full': false,
        }),
      );
      final container = await pumpCabinGuard(tester, backend: backend);
      await openFamilyTab(tester);

      container.read(appRouterProvider).go('/join-family#K7M4-QX9P');
      await tester.pumpAndSettle();

      expect(find.text('Code K7M4-QX9P'), findsOneWidget);
      expect(find.text('Owned by Karim'), findsOneWidget);
    });

    testWidgets('opens the preview from the web app link it was shared as', (
      tester,
    ) async {
      backend.on(
        'GET',
        'families/invites/K7M4QX9P',
        (_) => FakeResponse.ok({
          'familyName': 'Ben Salah',
          'ownerFirstName': 'Karim',
          'memberCount': 3,
          'maxMembers': 10,
          'full': false,
        }),
      );
      final container = await pumpCabinGuard(tester, backend: backend);
      await openFamilyTab(tester);

      // https://app.vunlera.tn/mobile/join-family#K7M4-QX9P, as Android
      // hands it to the app.
      container.read(appRouterProvider).go('/mobile/join-family#K7M4-QX9P');
      await tester.pumpAndSettle();

      expect(find.text('Code K7M4-QX9P'), findsOneWidget);
      expect(find.text('Owned by Karim'), findsOneWidget);
    });
  });

  group('as the owner', () {
    testWidgets('approves a request and handles one decided elsewhere', (
      tester,
    ) async {
      mine = myFamilyJson(pendingRequestCount: 2);
      backend
        ..on(
          'GET',
          'families/mine/join-requests',
          (_) => FakeResponse.ok([
            {
              'id': 'request-nour',
              'userId': nourId,
              'firstName': 'Nour',
              'lastName': 'Ben Salah',
              'avatar': null,
              'createdAt': DateTime.now()
                  .subtract(const Duration(minutes: 12))
                  .toUtc()
                  .toIso8601String(),
              'expiresAt': DateTime.now()
                  .add(const Duration(days: 6, hours: 1))
                  .toUtc()
                  .toIso8601String(),
            },
            {
              'id': 'request-youssef',
              'userId': 'youssef',
              'firstName': 'Youssef',
              'lastName': 'Trabelsi',
              'avatar': null,
              'createdAt': '2026-10-02T10:00:00Z',
              'expiresAt': '2026-10-09T10:00:00Z',
            },
          ]),
        )
        ..on('POST', 'families/mine/join-requests/request-nour/approve', (_) {
          mine = myFamilyJson(pendingRequestCount: 1);
          return FakeResponse.ok(mine);
        })
        ..on(
          'POST',
          'families/mine/join-requests/request-youssef/approve',
          (_) => FakeResponse.error(422, 'JOIN_REQUEST_CLOSED'),
        );
      await pumpCabinGuard(tester, backend: backend);
      await openFamilyTab(tester);

      await tap(tester, find.text('2 requests waiting'));
      expect(find.text('Requested 12 min ago'), findsOneWidget);
      expect(find.text('Expires in 6 days'), findsOneWidget);

      await tap(tester, find.widgetWithText(InkWell, 'Approve').first);
      expect(find.text('Nour joined your family.'), findsOneWidget);
      expect(find.text('Nour Ben Salah'), findsNothing);

      await tap(tester, find.widgetWithText(InkWell, 'Approve').first);
      expect(
        find.text('This request was already answered or has expired.'),
        findsOneWidget,
      );
      expect(
        backend.requestsTo('GET', 'families/mine/join-requests').length,
        2,
        reason: 'the list reloads after a concurrent decision',
      );
    });

    testWidgets('removes a member after confirmation', (tester) async {
      backend.on('DELETE', 'families/mine/members/$karimId', (_) {
        mine = myFamilyJson(
          members: [
            memberJson(userId: meId, firstName: 'Amira', role: 'OWNER'),
          ],
        );
        return FakeResponse.ok(mine);
      });
      await pumpCabinGuard(tester, backend: backend);
      await openFamilyTab(tester);
      expect(find.text('Amira Haddad'), findsOneWidget);

      await tap(tester, find.text('Karim Ben Salah'));
      expect(find.text('+21655111222'), findsOneWidget);
      expect(find.byTooltip('Call Karim'), findsOneWidget);

      await tap(tester, find.text('Remove from family'));
      await tap(tester, find.text('Remove'));

      expect(find.text('Karim was removed.'), findsOneWidget);
      expect(find.text('Karim Ben Salah'), findsNothing);
      expect(find.text('1 of 10 members'), findsOneWidget);
    });
  });

  group('as a member', () {
    setUp(() => mine = myFamilyJson(owner: false));

    testWidgets('changes sharing consent', (tester) async {
      backend.on('PUT', 'families/mine/sharing', (request) {
        mine = myFamilyJson(
          owner: false,
          mySharing: Map<String, Object?>.from(bodyOf(request)),
        );
        return FakeResponse.ok(mine);
      });
      await pumpCabinGuard(tester, backend: backend);
      await openFamilyTab(tester);
      expect(find.text('Invite member'), findsNothing);

      await tap(tester, find.text('What I share'));
      final save = find.widgetWithText(InkWell, 'Save preferences');
      await tap(tester, save);
      expect(backend.requestsTo('PUT', 'families/mine/sharing'), isEmpty);

      await tap(tester, find.text('Phone number'));
      await tap(tester, save);

      expect(
        bodyOf(backend.requestsTo('PUT', 'families/mine/sharing').single),
        {'phone': true, 'incidents': false, 'health': false},
      );
      expect(find.text('Sharing preferences saved.'), findsOneWidget);
      expect(find.text('Phone shared'), findsWidgets);
    });

    testWidgets('leaves the family from settings', (tester) async {
      backend.on('POST', 'families/mine/leave', (_) {
        mine = Map.of(noFamilyJson);
        return FakeResponse.ok(mine);
      });
      await pumpCabinGuard(tester, backend: backend);
      await openFamilyTab(tester);

      await tap(tester, find.byTooltip('Family settings'));
      expect(find.text('Rename family'), findsNothing);
      await tap(tester, find.text('Leave family'));
      await tap(tester, find.text('Leave family').last);

      expect(find.text('You left the family.'), findsOneWidget);
      expect(find.text('Create a family'), findsOneWidget);
    });
  });
}
