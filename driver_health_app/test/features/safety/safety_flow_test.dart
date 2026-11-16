import 'package:driver_health_app/features/auth/presentation/screens/login_screen.dart';
import 'package:driver_health_app/features/home/presentation/screens/home_screen.dart';
import 'package:driver_health_app/features/safety/presentation/screens/event_history_screen.dart';
import 'package:driver_health_app/features/safety/presentation/screens/incident_screen.dart';
import 'package:driver_health_app/features/safety/presentation/screens/sos_screen.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/family_incidents_section.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/sos_hold_button.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/fake_backend.dart';
import '../../helpers/family_fixtures.dart';
import '../../helpers/safety_fixtures.dart';
import '../../helpers/test_app.dart';

void main() {
  late FakeBackend backend;
  late Map<String, Object?> monitoring;

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
    // Alert and SOS screens animate continuously: step instead of settle.
    await pumpSteps(tester, steps: 15);
  }

  Future<void> scrollTo(WidgetTester tester, Finder finder) async {
    await tester.scrollUntilVisible(
      finder,
      300,
      scrollable: find.byType(Scrollable).first,
    );
    await tester.pump();
  }

  /// Presses and holds the SOS button for [duration].
  Future<void> holdSos(WidgetTester tester, Duration duration) async {
    final button = find.byKey(SosHoldButton.buttonKey);
    await scrollTo(tester, button);
    final gesture = await tester.startGesture(tester.getCenter(button));
    // The first frame starts the hold animation's clock.
    await tester.pump();
    await tester.pump(duration);
    await tester.pump();
    await gesture.up();
    await pumpSteps(tester, steps: 3);
  }

  setUp(() {
    monitoring = monitoringJson();
    backend = FakeBackend()
      ..on(
        'POST',
        'auth/mobile/login',
        (_) => FakeResponse.ok({'mfaRequired': false, ...sessionJson()}),
      )
      ..on(
        'GET',
        'mobile/dashboard',
        (_) => FakeResponse.ok(
          dashboardJson(safetyFeatures: true, monitoring: monitoring),
        ),
      );
  });

  testWidgets('home shows protection and the latest event with its details', (
    tester,
  ) async {
    monitoring = monitoringJson(
      latestEvent: {
        'id': strokeEventId,
        'type': 'STROKE',
        'severity': 'CRITICAL',
        'detectedAt': iso(DateTime.now()),
        'incidentStatus': 'FALSE_ALARM',
        'contactsAlerted': false,
      },
    );
    backend.on(
      'GET',
      'safety/events/$strokeEventId',
      (_) => FakeResponse.ok(
        eventJson(vitals: {'heartRateBpm': 112, 'rhythm': 'IRREGULAR'}),
      ),
    );
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);

    expect(find.text('Shadow monitoring'), findsOneWidget);
    expect(find.text('Mediane vehicle connected'), findsOneWidget);
    expect(find.text('Your safety plan is ready'), findsOneWidget);

    final card = find.byKey(HomeScreen.latestEventKey);
    await scrollTo(tester, card);
    expect(
      find.descendant(of: card, matching: find.text('Possible stroke')),
      findsOneWidget,
    );
    expect(find.text('Resolved safely'), findsOneWidget);
    expect(find.text('Emergency contacts were not required'), findsOneWidget);

    await tester.tap(card);
    await tester.pumpAndSettle();
    expect(find.text('Readings'), findsOneWidget);
    expect(find.text('112 bpm'), findsOneWidget);
    expect(find.text('Irregular'), findsOneWidget);
    expect(find.text('Detector score · 91%'), findsOneWidget);
    expect(find.text('Part of an alert. See what happened next.'), findsOne);
  });

  testWidgets('history groups events by day and filters by type', (
    tester,
  ) async {
    backend.on('GET', 'safety/events', (request) {
      final type = request.queryParameters['type'];
      return pagedResponse([
        if (type == null || type == 'STROKE') eventJson(),
        if (type == null || type == 'DROWSINESS')
          eventJson(
            id: drowsyEventId,
            type: 'DROWSINESS',
            severity: 'WARNING',
            incident: null,
            detectedAt: DateTime.now().subtract(const Duration(days: 1)),
          ),
      ]);
    });
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);

    await tester.tap(find.text('History').last);
    await tester.pumpAndSettle();
    expect(find.byType(EventHistoryScreen), findsOneWidget);
    expect(find.text('Today'), findsOneWidget);
    expect(find.text('Yesterday'), findsOneWidget);
    expect(find.text('Possible stroke'), findsOneWidget);
    expect(find.text('Drowsiness detected'), findsOneWidget);
    expect(find.byKey(EventHistoryScreen.loadMoreKey), findsNothing);

    final drowsiness = find.widgetWithText(ChoiceChip, 'Drowsiness');
    await tester.ensureVisible(drowsiness);
    await tester.pumpAndSettle();
    await tester.tap(drowsiness);
    await tester.pumpAndSettle();
    expect(
      backend.requestsTo('GET', 'safety/events').last.queryParameters['type'],
      'DROWSINESS',
    );
    expect(find.text('Possible stroke'), findsNothing);
    expect(find.text('Drowsiness detected'), findsOneWidget);
  });

  testWidgets('an alert opens by itself and "I\'m OK" cancels it', (
    tester,
  ) async {
    var status = 'AWAITING_RESPONSE';
    monitoring = monitoringJson(
      activeIncident: {
        'id': incidentId,
        'status': 'AWAITING_RESPONSE',
        'severity': 'CRITICAL',
        'triggerType': 'STROKE',
        'respondBy': iso(DateTime.now().add(const Duration(seconds: 30))),
        'escalatedAt': null,
      },
    );
    backend
      ..on(
        'GET',
        'safety/incidents/$incidentId',
        (_) => FakeResponse.ok(
          incidentDetailJson(
            incident: incidentJson(status: status),
            events: [eventJson()],
            timeline: [
              {'kind': 'OPENED', 'at': iso(DateTime.now()), 'detail': null},
              if (status == 'FALSE_ALARM')
                {
                  'kind': 'RESOLVED',
                  'at': iso(DateTime.now()),
                  'detail': {'outcome': 'FALSE_ALARM'},
                },
            ],
          ),
        ),
      )
      ..on('POST', 'safety/incidents/$incidentId/acknowledge', (_) {
        status = 'FALSE_ALARM';
        return FakeResponse.ok(incidentJson(status: status));
      });
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);

    expect(find.byType(IncidentScreen), findsOneWidget);
    expect(find.text('Are you OK?'), findsOneWidget);
    expect(find.textContaining('seconds left'), findsNothing);
    expect(find.bySemanticsLabel(RegExp(r'^\d+ seconds left$')), findsOne);

    await tester.tap(find.byKey(IncidentScreen.okKey));
    await pumpSteps(tester, steps: 5);
    expect(
      backend.requestsTo('POST', 'safety/incidents/$incidentId/acknowledge'),
      hasLength(1),
    );
    expect(find.text('Alert cancelled'), findsWidgets);
    expect(
      find.text('You answered in time. Nobody was contacted.'),
      findsOneWidget,
    );

    // Closing does not bring the same alert back on the next refresh.
    await tester.tap(find.byKey(IncidentScreen.doneKey));
    await pumpSteps(tester, steps: 5);
    expect(find.byType(IncidentScreen), findsNothing);
  });

  testWidgets('SOS needs a full hold, can be cancelled, then calls for help', (
    tester,
  ) async {
    backend
      ..on(
        'POST',
        'safety/sos',
        (_) => FakeResponse(
          201,
          envelope(
            data: incidentJson(
              status: 'ESCALATED',
              triggerType: 'SOS',
              escalatedAt: DateTime.now(),
            ),
          ),
        ),
      )
      ..on(
        'GET',
        'safety/incidents/$incidentId',
        (_) => FakeResponse.ok(
          incidentDetailJson(
            incident: incidentJson(
              status: 'ESCALATED',
              triggerType: 'SOS',
              escalatedAt: DateTime.now(),
            ),
            notifications: [
              notificationJson(name: 'Sami Contact'),
              notificationJson(name: 'Lina Contact', priority: 2),
            ],
          ),
        ),
      );
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);

    // A short press does nothing.
    await holdSos(tester, const Duration(milliseconds: 800));
    expect(find.byType(SosScreen), findsNothing);

    // A full hold opens the cancel window; cancelling calls nobody.
    await holdSos(tester, sosHoldDuration);
    expect(find.byType(SosScreen), findsOneWidget);
    expect(find.text('Calling for help'), findsOneWidget);
    await tester.tap(find.byKey(SosScreen.cancelKey));
    await pumpSteps(tester, steps: 5);
    expect(find.byType(SosScreen), findsNothing);
    await tester.pump(const Duration(seconds: 6));
    expect(backend.requestsTo('POST', 'safety/sos'), isEmpty);

    // Holding again and letting the window run out calls for help once.
    await holdSos(tester, sosHoldDuration);
    for (var second = 0; second < 6; second++) {
      await tester.pump(const Duration(seconds: 1));
    }
    await pumpSteps(tester);
    final calls = backend.requestsTo('POST', 'safety/sos');
    expect(calls, hasLength(1));
    expect(
      (calls.single.data as Map)['clientEventId'],
      matches(RegExp('^sos-')),
    );
    expect(find.byType(IncidentScreen), findsOneWidget);
    expect(find.text('Help is on the way'), findsOneWidget);
    expect(find.text('People alerted'), findsOneWidget);
    expect(find.text('Sami Contact'), findsOneWidget);
    expect(find.text('Lina Contact'), findsOneWidget);
  });

  testWidgets('family members see who needs help, never why', (tester) async {
    backend
      ..on('GET', 'families/mine', (_) => FakeResponse.ok(myFamilyJson()))
      ..on(
        'GET',
        'families/mine/incidents',
        (_) => FakeResponse.ok([
          {
            'incidentId': incidentId,
            'member': {
              'userId': karimId,
              'firstName': 'Karim',
              'lastName': 'Ben Salah',
            },
            'status': 'ESCALATED',
            'openedAt': iso(DateTime.now()),
            'escalatedAt': iso(DateTime.now()),
            'resolvedAt': null,
            'location': {'latitude': 36.8, 'longitude': 10.18},
          },
        ]),
      );
    await pumpCabinGuard(tester, backend: backend);
    await signIn(tester);

    await tester.tap(find.text('Family').last);
    await tester.pumpAndSettle();
    final banner = find.byKey(FamilyIncidentsSection.urgentKey);
    expect(banner, findsOneWidget);
    expect(
      find.descendant(of: banner, matching: find.text('Karim may need help')),
      findsOneWidget,
    );
    expect(find.text("See Karim's location"), findsOneWidget);
    expect(find.textContaining(RegExp('stroke|seizure|heart')), findsNothing);
  });
}
