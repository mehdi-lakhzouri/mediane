import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/features/safety/presentation/screens/event_detail_screen.dart';
import 'package:driver_health_app/features/safety/presentation/screens/incident_screen.dart';
import 'package:driver_health_app/features/safety/presentation/screens/sos_screen.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

/// Screens pushed above the tab shell. The History tab itself
/// ([AppRoutes.history]) lives in the shell's branches.
final List<RouteBase> safetyRoutes = [
  GoRoute(
    path: AppRoutes.historyEventPattern,
    name: 'historyEvent',
    builder: (context, state) =>
        EventDetailScreen(eventId: state.pathParameters['eventId'] ?? ''),
  ),
  GoRoute(
    path: AppRoutes.incidentPattern,
    name: 'incident',
    builder: (context, state) =>
        IncidentScreen(incidentId: state.pathParameters['incidentId'] ?? ''),
  ),
  GoRoute(
    path: AppRoutes.sos,
    name: 'sos',
    pageBuilder: (context, state) => MaterialPage(
      key: state.pageKey,
      fullscreenDialog: true,
      child: const SosScreen(),
    ),
  ),
];
