import 'dart:async';

import 'package:driver_health_app/core/network/network_providers.dart';
import 'package:driver_health_app/core/state/data_changes.dart';
import 'package:driver_health_app/core/state/polling.dart';
import 'package:driver_health_app/features/safety/data/remote_safety_repository.dart';
import 'package:driver_health_app/features/safety/domain/entities/incident.dart';
import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';
import 'package:driver_health_app/features/safety/domain/repositories/safety_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';

final safetyRepositoryProvider = Provider<SafetyRepository>(
  (ref) => RemoteSafetyRepository(ref.watch(dioProvider)),
);

/// One event with its readings and location.
final FutureProviderFamily<MedicalEvent, String> eventDetailProvider =
    FutureProvider.autoDispose.family<MedicalEvent, String>(
      (ref, eventId) => ref.watch(safetyRepositoryProvider).event(eventId),
    );

/// Family members' incidents (no medical details). Refreshed on data
/// changes and polled while visible, faster while someone needs help.
final FutureProvider<List<FamilyIncident>> familyIncidentsProvider =
    FutureProvider.autoDispose((ref) async {
      ref.watch(dataChangesProvider);
      final incidents = await ref
          .watch(safetyRepositoryProvider)
          .familyIncidents();
      if (ref.read(pollingEnabledProvider)) {
        final urgent = incidents.any((incident) => incident.needsHelp);
        final timer = Timer(
          urgent ? const Duration(seconds: 10) : const Duration(seconds: 60),
          ref.invalidateSelf,
        );
        ref.onDispose(timer.cancel);
      }
      return incidents;
    });

/// Incidents the app already brought to the screen in this session, so a
/// driver who closes the alert is not pushed back to it on every refresh.
final NotifierProvider<PresentedIncidents, Set<String>>
presentedIncidentsProvider = NotifierProvider(PresentedIncidents.new);

class PresentedIncidents extends Notifier<Set<String>> {
  @override
  Set<String> build() => const {};

  /// Returns `true` the first time [incidentId] is seen.
  bool markPresented(String incidentId) {
    if (state.contains(incidentId)) return false;
    state = {...state, incidentId};
    return true;
  }
}
