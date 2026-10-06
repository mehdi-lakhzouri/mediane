import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/features/safety/application/safety_providers.dart';
import 'package:driver_health_app/features/safety/application/sos_controller.dart';
import 'package:driver_health_app/features/safety/data/safety_json.dart';
import 'package:driver_health_app/features/safety/domain/entities/incident.dart';
import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';
import 'package:driver_health_app/features/safety/domain/repositories/safety_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import '../../helpers/safety_fixtures.dart';

/// Records SOS calls; fails the first [failures] of them.
class _RecordingRepository implements SafetyRepository {
  new({this.failures = 0});

  int failures;
  final ids = <String>[];

  @override
  Future<Incident> sos({required String clientEventId}) async {
    ids.add(clientEventId);
    if (failures > 0) {
      failures--;
      throw const ApiFailure(
        kind: ApiFailureKind.offline,
        message: 'No connection.',
      );
    }
    return SafetyJson.incident(
      incidentJson(status: 'ESCALATED', triggerType: 'SOS'),
    );
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  late _RecordingRepository repository;
  late ProviderContainer container;
  late ProviderSubscription<SosState> subscription;

  void start({int failures = 0}) {
    repository = _RecordingRepository(failures: failures);
    container = ProviderContainer(
      overrides: [safetyRepositoryProvider.overrideWithValue(repository)],
    );
    // Keep the auto-disposed controller alive for the test.
    subscription = container.listen(sosControllerProvider, (_, _) {});
  }

  tearDown(() {
    subscription.close();
    container.dispose();
  });

  SosState state() => container.read(sosControllerProvider);
  SosController controller() => container.read(sosControllerProvider.notifier);

  testWidgets('counts down five seconds, then calls for help once', (
    tester,
  ) async {
    start();
    controller().arm();
    expect(state(), isA<SosCountdown>());
    expect((state() as SosCountdown).secondsLeft, sosCancelWindow);

    await tester.pump(const Duration(seconds: 3));
    expect((state() as SosCountdown).secondsLeft, 2);
    expect(repository.ids, isEmpty);

    await tester.pump(const Duration(seconds: 2));
    await tester.pump();
    expect(state(), isA<SosSent>());
    expect(repository.ids, hasLength(1));
    expect(repository.ids.single, matches(RegExp(r'^sos-[A-Za-z0-9]{20}$')));

    // Arming again is ignored once help is on the way.
    controller().arm();
    await tester.pump(const Duration(seconds: 6));
    expect(repository.ids, hasLength(1));
  });

  testWidgets('cancelling in the window never calls anyone', (tester) async {
    start();
    controller().arm();
    await tester.pump(const Duration(seconds: 2));
    controller().cancel();
    expect(state(), isA<SosIdle>());

    await tester.pump(const Duration(seconds: 10));
    expect(repository.ids, isEmpty);
  });

  testWidgets('retries a failed call with the same id', (tester) async {
    start(failures: 1);
    controller().arm();
    await controller().sendNow();
    expect(state(), isA<SosFailed>());

    await controller().retry();
    expect(state(), isA<SosSent>());
    expect(repository.ids, hasLength(2));
    expect(repository.ids.toSet(), hasLength(1));
  });

  test('maps SOS incidents to the SOS type', () {
    final incident = SafetyJson.incident(incidentJson(triggerType: 'SOS'));
    expect(incident.triggerType, MedicalEventType.sos);
  });
}
