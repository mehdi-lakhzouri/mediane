import 'dart:async';

import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/state/data_changes.dart';
import 'package:driver_health_app/features/safety/application/client_event_id.dart';
import 'package:driver_health_app/features/safety/application/safety_providers.dart';
import 'package:driver_health_app/features/safety/domain/entities/incident.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Seconds the driver has to cancel after the hold completes.
const sosCancelWindow = 5;

sealed class SosState {
  const new();
}

class SosIdle extends SosState {
  const new();
}

/// Counting down; the driver can still cancel.
class SosCountdown extends SosState {
  const new(this.secondsLeft);

  final int secondsLeft;
}

class SosSending extends SosState {
  const new();
}

class SosSent extends SosState {
  const new(this.incident);

  final Incident incident;
}

class SosFailed extends SosState {
  const new(this.failure);

  final ApiFailure failure;
}

/// Manual SOS after press-and-hold: a short cancel window, then one request
/// whose id stays the same across retries, so help is never called twice.
final NotifierProvider<SosController, SosState> sosControllerProvider =
    NotifierProvider.autoDispose(SosController.new);

class SosController extends Notifier<SosState> {
  Timer? _ticker;
  String? _clientEventId;

  @override
  SosState build() {
    ref.onDispose(() => _ticker?.cancel());
    return const SosIdle();
  }

  /// Called when the hold completes.
  void arm() {
    if (state is! SosIdle) return;
    _clientEventId = newClientEventId('sos');
    state = const SosCountdown(sosCancelWindow);
    _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void cancel() {
    if (state is! SosCountdown) return;
    _ticker?.cancel();
    _clientEventId = null;
    state = const SosIdle();
  }

  /// Skips the rest of the countdown.
  Future<void> sendNow() async {
    if (state is! SosCountdown) return;
    _ticker?.cancel();
    await _send();
  }

  Future<void> retry() async {
    if (state is SosFailed) await _send();
  }

  void _tick() {
    final current = state;
    if (current is! SosCountdown) return;
    if (current.secondsLeft <= 1) {
      _ticker?.cancel();
      unawaited(_send());
    } else {
      state = SosCountdown(current.secondsLeft - 1);
    }
  }

  Future<void> _send() async {
    final clientEventId = _clientEventId;
    if (clientEventId == null) return;
    state = const SosSending();
    try {
      final incident = await ref
          .read(safetyRepositoryProvider)
          .sos(clientEventId: clientEventId);
      ref.read(dataChangesProvider.notifier).markChanged();
      if (ref.mounted) state = SosSent(incident);
    } on Object catch (error) {
      if (ref.mounted) state = SosFailed(ApiFailure.from(error));
    }
  }
}
