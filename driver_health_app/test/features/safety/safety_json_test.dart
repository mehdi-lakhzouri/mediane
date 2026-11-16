import 'package:driver_health_app/features/safety/data/safety_json.dart';
import 'package:driver_health_app/features/safety/domain/entities/incident.dart';
import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/safety_fixtures.dart';

void main() {
  group('SafetyJson', () {
    test('maps an event with readings and location', () {
      final event = SafetyJson.event(
        eventJson(
          vitals: {'heartRateBpm': 112, 'rhythm': 'IRREGULAR', 'extra': 1},
          location: {'latitude': 36.8, 'longitude': 10.18, 'accuracyM': 8},
        ),
      );
      expect(event.type, MedicalEventType.stroke);
      expect(event.severity, EventSeverity.critical);
      expect(event.source, EventSource.device);
      expect(event.confidence, 0.91);
      expect(event.vitals?.heartRateBpm, 112);
      expect(event.vitals?.rhythm, HeartRhythm.irregular);
      expect(event.location?.accuracyM, 8);
      expect(event.incidentId, incidentId);
    });

    test('treats unknown types from a newer server with the most care', () {
      final event = SafetyJson.event(
        eventJson(type: 'SOMETHING_NEW', severity: 'UNKNOWN'),
      );
      expect(event.type, MedicalEventType.unknown);
      expect(event.severity, EventSeverity.critical);
    });

    test('maps an incident detail and skips unknown timeline entries', () {
      final opened = DateTime.utc(2026, 10, 3, 10);
      final detail = SafetyJson.incidentDetail(
        incidentDetailJson(
          incident: incidentJson(
            status: 'ESCALATED',
            openedAt: opened,
            escalatedAt: opened.add(const Duration(seconds: 30)),
          ),
          timeline: [
            {'kind': 'OPENED', 'at': iso(opened), 'detail': null},
            {'kind': 'FUTURE_KIND', 'at': iso(opened)},
            {
              'kind': 'NOTIFIED',
              'at': iso(opened),
              'detail': {'kind': 'ALERT', 'contacts': 2, 'family': 1},
            },
          ],
          notifications: [
            notificationJson(name: 'Sami'),
            notificationJson(
              name: 'Bilel Driver',
              recipientType: 'FAMILY_MEMBER',
              priority: null,
              channel: 'EMAIL',
            ),
            notificationJson(name: 'Sami', kind: 'ALL_CLEAR'),
          ],
        ),
      );
      expect(detail.incident.status, IncidentStatus.escalated);
      expect(detail.incident.contactsAlerted, isTrue);
      expect(detail.timeline.map((e) => e.kind), [
        TimelineKind.opened,
        TimelineKind.notified,
      ]);
      expect(detail.alerts.map((n) => n.recipientName), [
        'Sami',
        'Bilel Driver',
      ]);
      expect(detail.alerts.last.channel, NotificationChannel.email);
    });

    test(
      'keeps cardiac alarms distinct from arrest and labels replay history',
      () {
        final event = SafetyJson.event({
          ...eventJson(type: 'CARDIAC_EMERGENCY'),
          'processingMode': 'REPLAY',
          'detection': {'featureVersion': '1'},
        });
        expect(event.type, MedicalEventType.cardiacEmergency);
        expect(event.isNonActionable, isTrue);
        expect(event.modelVersion, '1');
      },
    );
  });

  group('IncidentDetail countdown', () {
    IncidentDetail awaiting({
      required DateTime serverTime,
      required DateTime fetchedAt,
    }) => SafetyJson.incidentDetail(
      incidentDetailJson(
        incident: incidentJson(
          openedAt: serverTime,
          respondBy: serverTime.add(const Duration(seconds: 30)),
        ),
        serverTime: serverTime,
      ),
      fetchedAt: fetchedAt,
    );

    test('counts down on server time, whatever the phone clock says', () {
      final server = DateTime.utc(2026, 10, 3, 10);
      // The phone runs 7 minutes ahead of the server.
      final phone = server.add(const Duration(minutes: 7));
      final detail = awaiting(serverTime: server, fetchedAt: phone);

      expect(detail.remaining(phone), const Duration(seconds: 30));
      expect(
        detail.remaining(phone.add(const Duration(seconds: 12))),
        const Duration(seconds: 18),
      );
      expect(
        detail.remaining(phone.add(const Duration(minutes: 1))),
        Duration.zero,
      );
    });

    test('has no countdown once escalated or closed', () {
      final detail = SafetyJson.incidentDetail(
        incidentDetailJson(incident: incidentJson(status: 'ESCALATED')),
      );
      expect(detail.remaining(DateTime.now()), isNull);
    });
  });
}
