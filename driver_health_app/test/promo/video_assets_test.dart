// Captures the real application widgets for the promo composition.
// Representative data is restricted to this offline capture harness.
// Needs the local Flutter font cache and writes into ../design: excluded from
// CI by its tag (see dart_test.yaml).
@Tags(['promo'])
library;

import 'dart:io';
import 'dart:ui' as ui;

import 'package:driver_health_app/app/app.dart';
import 'package:driver_health_app/app/router/app_router.dart';
import 'package:driver_health_app/features/auth/presentation/screens/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../helpers/fake_backend.dart';
import '../helpers/family_fixtures.dart';
import '../helpers/safety_fixtures.dart';
import '../helpers/test_app.dart';

void main() {
  testWidgets('capture current app screens for the Mediane film', (
    tester,
  ) async {
    await tester.runAsync(() async {
      final roboto = FontLoader('Roboto');
      final artifacts = File(Platform.resolvedExecutable).parent.parent.parent;
      final fontPath =
          Platform.environment['CABINGUARD_ROBOTO'] ??
          '${artifacts.path}/material_fonts/roboto-regular.ttf';
      roboto.addFont(File(fontPath).readAsBytes().then(ByteData.sublistView));
      await roboto.load();
      final icons = FontLoader('MaterialIcons')
        ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
      await icons.load();
    });

    final lastEvent = {
      'id': strokeEventId,
      'type': 'HEART_RHYTHM',
      'severity': 'URGENT',
      'detectedAt': iso(DateTime.now().subtract(const Duration(minutes: 12))),
      'incidentStatus': 'FALSE_ALARM',
      'contactsAlerted': false,
    };
    final mine = myFamilyJson(
      pendingRequestCount: 2,
      members: [
        memberJson(
          userId: meId,
          firstName: 'Amira',
          lastName: 'Haddad',
          role: 'OWNER',
        ),
        memberJson(userId: karimId, firstName: 'Karim'),
        memberJson(userId: nourId, firstName: 'Nour'),
      ],
      mySharing: const {'phone': false, 'incidents': true, 'health': false},
    );
    final backend = FakeBackend()
      ..on(
        'POST',
        'auth/mobile/login',
        (_) => FakeResponse.ok({'mfaRequired': false, ...sessionJson()}),
      )
      ..on(
        'GET',
        'auth/me',
        (_) => FakeResponse.ok({
          'userId': meId,
          'role': 'DRIVER',
          'accountState': 'ACTIVE',
          'email': 'amira@example.com',
          'firstName': 'Amira',
          'lastName': 'Haddad',
        }),
      )
      ..on(
        'GET',
        'mobile/dashboard',
        (_) => FakeResponse.ok(
          dashboardJson(
            familyState: 'OWNER',
            mfaEnabled: true,
            safetyFeatures: true,
            unreadNotifications: 2,
            monitoring: monitoringJson(latestEvent: lastEvent),
          ),
        ),
      )
      ..on('GET', 'families/mine', (_) => FakeResponse.ok(mine))
      ..on('GET', 'safety/family/incidents', (_) => FakeResponse.ok([]))
      ..on('GET', 'notifications', (_) {
        final now = DateTime.now().toUtc();
        final items = [
          {
            'id': 'preview-safety',
            'category': 'SAFETY',
            'type': 'FAMILY_MEMBER_NEEDS_HELP',
            'title': 'Karim may need help',
            'body':
                "Mediane alerted Karim's emergency contacts. "
                'Try to reach them now.',
            'link': '/family',
            'critical': true,
            'readAt': null,
            'createdAt': now.toIso8601String(),
          },
          {
            'id': 'preview-family',
            'category': 'FAMILY',
            'type': 'FAMILY_JOIN_REQUESTED',
            'title': 'New join request',
            'body': 'Nour Ben Salah asked to join your family.',
            'link': '/family',
            'critical': false,
            'readAt': null,
            'createdAt': now.toIso8601String(),
          },
          {
            'id': 'preview-security',
            'category': 'SECURITY',
            'type': 'NEW_SIGN_IN',
            'title': 'New sign-in',
            'body': 'Your account was used to sign in on Pixel 8 · Android 15.',
            'link': '/security/devices',
            'critical': false,
            'readAt': now.toIso8601String(),
            'createdAt': now
                .subtract(const Duration(days: 1))
                .toIso8601String(),
          },
        ];
        return FakeResponse(200, {
          'data': items,
          'meta': {
            'requestId': 'brand-preview',
            'timestamp': now.toIso8601String(),
            'pagination': {
              'page': 1,
              'pageSize': 30,
              'totalItems': items.length,
              'totalPages': 1,
            },
          },
          'error': null,
        });
      })
      ..on(
        'GET',
        'safety/incidents/$incidentId',
        (_) => FakeResponse.ok(
          incidentDetailJson(
            incident: incidentJson(
              triggerType: 'HEART_RHYTHM',
              severity: 'URGENT',
              openedAt: DateTime.now(),
              respondBy: DateTime.now().add(const Duration(seconds: 45)),
            ),
          ),
        ),
      );

    final container = await pumpCabinGuard(tester, backend: backend);
    final captureKey = GlobalKey();
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: RepaintBoundary(key: captureKey, child: const CabinGuardApp()),
      ),
    );
    await pumpSteps(tester, steps: 8);
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
      'capture-only-password',
    );
    await tester.tap(find.text('Sign in'));
    await pumpSteps(tester, steps: 20);

    final output = Directory(
      Platform.environment['CABINGUARD_CAPTURE_DIR'] ??
          '../design/promo/video/assets',
    );
    await tester.runAsync(() => output.create(recursive: true));

    Future<void> capture(String name) async {
      await pumpSteps(tester, steps: 12);
      final boundary =
          captureKey.currentContext!.findRenderObject()!
              as RenderRepaintBoundary;
      await tester.runAsync(() async {
        final image = await boundary.toImage(pixelRatio: 3);
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        await File('${output.path}/$name.png')
            .writeAsBytes(bytes!.buffer.asUint8List());
        image.dispose();
      });
    }

    expect(homeGreeting, findsOneWidget);
    await capture('mobile-home');
    container.read(appRouterProvider).go(AppRoutes.notifications);
    await capture('mobile-notifications');
    container.read(appRouterProvider).go(AppRoutes.family);
    await capture('mobile-family');
    expect(find.text('My family'), findsOneWidget);
    container.read(appRouterProvider).go(AppRoutes.familySharing);
    await capture('mobile-sharing');
    expect(find.text('Family sharing'), findsOneWidget);
    container.read(appRouterProvider).go(AppRoutes.incident(incidentId));
    await capture('mobile-alert');
    expect(find.text('Are you OK?'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
  });
}
