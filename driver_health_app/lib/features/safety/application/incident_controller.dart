import 'dart:async';

import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/state/data_changes.dart';
import 'package:driver_health_app/core/state/polling.dart';
import 'package:driver_health_app/features/safety/application/client_event_id.dart';
import 'package:driver_health_app/features/safety/application/safety_providers.dart';
import 'package:driver_health_app/features/safety/domain/entities/incident.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';

/// How often an open incident is refreshed while on screen (no push yet).
const incidentPollInterval = Duration(seconds: 2);

/// One incident, kept fresh while it is open: the countdown, escalation and
/// contact statuses change on the server without the driver doing anything.
final AsyncNotifierProviderFamily<IncidentController, IncidentDetail, String>
incidentControllerProvider = AsyncNotifierProvider.autoDispose
    .family<IncidentController, IncidentDetail, String>(IncidentController.new);

class IncidentController extends AsyncNotifier<IncidentDetail> {
  new(this._incidentId);

  final String _incidentId;
  Timer? _poll;
  bool _acknowledging = false;

  /// One id per incident: tapping "Get help now" twice calls for help once.
  late final String _helpRequestId = newClientEventId('help');

  bool get acknowledging => _acknowledging;

  @override
  Future<IncidentDetail> build() async {
    ref.onDispose(() => _poll?.cancel());
    final detail = await ref
        .read(safetyRepositoryProvider)
        .incident(_incidentId);
    _schedule(detail);
    return detail;
  }

  /// "I'm OK". Returns the failure to show, or `null` once accepted.
  Future<ApiFailure?> acknowledge() async {
    if (_acknowledging) return null;
    _acknowledging = true;
    try {
      await ref.read(safetyRepositoryProvider).acknowledge(_incidentId);
      ref.read(dataChangesProvider.notifier).markChanged();
      if (ref.mounted) await _refresh();
      return null;
    } on Object catch (error) {
      return ApiFailure.from(error);
    } finally {
      _acknowledging = false;
    }
  }

  /// Calls for help without waiting for the countdown. Returns the failure
  /// to show, or `null` once help was called.
  Future<ApiFailure?> escalateNow() async {
    try {
      await ref
          .read(safetyRepositoryProvider)
          .sos(clientEventId: _helpRequestId);
      ref.read(dataChangesProvider.notifier).markChanged();
      if (ref.mounted) await _refresh();
      return null;
    } on Object catch (error) {
      return ApiFailure.from(error);
    }
  }

  Future<void> _refresh() async {
    try {
      final detail = await ref
          .read(safetyRepositoryProvider)
          .incident(_incidentId);
      if (!ref.mounted) return;
      final wasActive = state.value?.incident.isActive ?? false;
      state = AsyncData(detail);
      // Closed meanwhile (cabin button, auto-close): refresh summaries.
      if (wasActive && !detail.incident.isActive) {
        ref.read(dataChangesProvider.notifier).markChanged();
      }
      _schedule(detail);
    } on Object {
      // Keep the last known state and try again: a dropped poll must never
      // hide an open incident.
      if (ref.mounted) _schedule(state.value);
    }
  }

  void _schedule(IncidentDetail? detail) {
    _poll?.cancel();
    if (detail == null ||
        !detail.incident.isActive ||
        !ref.read(pollingEnabledProvider)) {
      return;
    }
    _poll = Timer(incidentPollInterval, () => unawaited(_refresh()));
  }
}
