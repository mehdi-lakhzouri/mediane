import 'dart:async';

import 'package:driver_health_app/core/network/network_providers.dart';
import 'package:driver_health_app/core/state/data_changes.dart';
import 'package:driver_health_app/core/state/polling.dart';
import 'package:driver_health_app/features/home/data/remote_dashboard_repository.dart';
import 'package:driver_health_app/features/home/domain/entities/dashboard.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final dashboardRepositoryProvider = Provider<RemoteDashboardRepository>(
  (ref) => RemoteDashboardRepository(ref.watch(dioProvider)),
);

/// How often the home summary refreshes while shown. Without push
/// notifications (Phase 10) this is how a new incident reaches the screen.
const dashboardPollInterval = Duration(seconds: 15);
const dashboardActivePollInterval = Duration(seconds: 5);

/// Home screen summary. Refetched whenever a feature reports a change
/// through [dataChangesProvider], and polled while watched.
final FutureProvider<Dashboard> dashboardProvider = FutureProvider.autoDispose((
  ref,
) async {
  ref.watch(dataChangesProvider);
  final polling = ref.watch(pollingEnabledProvider);
  Timer? poll;
  ref.onDispose(() => poll?.cancel());
  void scheduleRefresh(Duration after) {
    if (polling) poll = Timer(after, ref.invalidateSelf);
  }

  try {
    final dashboard = await ref.watch(dashboardRepositoryProvider).fetch();
    scheduleRefresh(
      dashboard.monitoring.activeIncident == null
          ? dashboardPollInterval
          : dashboardActivePollInterval,
    );
    return dashboard;
  } on Object {
    scheduleRefresh(dashboardPollInterval);
    rethrow;
  }
});
