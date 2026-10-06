import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/content_page.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/safety/application/safety_providers.dart';
import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';
import 'package:driver_health_app/features/safety/presentation/safety_copy.dart';
import 'package:driver_health_app/features/safety/presentation/safety_links.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/event_tile.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/status_pill.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// One event: what was detected, how sure the unit was, the readings, where
/// (emergencies only) and the alert it belongs to.
class EventDetailScreen extends ConsumerWidget {
  const new({required this.eventId, super.key});

  final String eventId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final event = ref.watch(eventDetailProvider(eventId));
    void back() =>
        context.canPop() ? context.pop() : context.go(AppRoutes.history);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: switch (event) {
        AsyncData(:final value) => ContentPage(
          entranceKey: true,
          title: SafetyCopy.eventTitle(value.type),
          onBack: back,
          children: _content(context, value),
        ),
        AsyncError(:final error) => ContentPage(
          title: 'Event',
          onBack: back,
          children: [
            InlineMessage(message: ApiFailure.from(error).message),
            TextButton(
              onPressed: () => ref.invalidate(eventDetailProvider(eventId)),
              child: const Text(
                'Try again',
                style: TextStyle(color: AppColors.cyan),
              ),
            ),
          ],
        ),
        _ => ContentPage(
          title: 'Event',
          onBack: back,
          children: const [
            Center(child: CircularProgressIndicator(color: AppColors.cyan)),
          ],
        ),
      },
    );
  }

  List<Widget> _content(BuildContext context, MedicalEvent event) {
    final severityColor = SafetyCopy.severityColor(event.severity);
    return [
      SurfaceCard(
        child: Row(
          children: [
            EventIcon(type: event.type, severity: event.severity, size: 64),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  StatusPill(
                    label: SafetyCopy.severityLabel(event.severity),
                    color: severityColor,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    SafetyCopy.when(event.detectedAt),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    event.source == EventSource.driver
                        ? 'You pressed SOS'
                        : 'Detected by your cabin unit',
                    style: const TextStyle(color: AppColors.slate),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      if (event.confidence case final confidence?) ...[
        const SizedBox(height: 12),
        _Section(
          icon: Icons.insights_rounded,
          title: SafetyCopy.confidenceLabel(confidence),
          body:
              'How sure the cabin unit was. Even a low-confidence detection '
              'is worth a pause when it is safe to stop.',
        ),
      ],
      if (event.vitals case final vitals?) ...[
        const SizedBox(height: 12),
        _Readings(vitals: vitals),
      ],
      if (event.location case final location?) ...[
        const SizedBox(height: 12),
        _Section(
          icon: Icons.place_rounded,
          title: 'Location',
          body: _coordinates(location),
          action: TextButton(
            onPressed: () => unawaited(openInMaps(location)),
            child: const Text(
              'Open in maps',
              style: TextStyle(color: AppColors.cyan),
            ),
          ),
        ),
      ],
      if (event.incidentId case final incidentId?) ...[
        const SizedBox(height: 12),
        SurfaceCard(
          onTap: () => unawaited(context.push(AppRoutes.incident(incidentId))),
          child: const Row(
            children: [
              Icon(Icons.crisis_alert_rounded, color: AppColors.coral),
              SizedBox(width: 14),
              Expanded(
                child: Text(
                  'Part of an alert. See what happened next.',
                  style: TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Icon(Icons.chevron_right_rounded, color: AppColors.ice),
            ],
          ),
        ),
      ],
      const SizedBox(height: 16),
      const Text(
        'Only you can see these details. Your family sees alerts, never '
        'readings. Details are deleted after 90 days.',
        style: TextStyle(color: AppColors.slate, fontSize: 13, height: 1.4),
      ),
    ];
  }
}

String _coordinates(GeoPoint point) {
  final accuracy = point.accuracyM;
  return '${point.latitude.toStringAsFixed(5)}, '
      '${point.longitude.toStringAsFixed(5)}'
      '${accuracy == null ? '' : ' (±${accuracy.round()} m)'}';
}

class _Section extends StatelessWidget {
  const new({
    required this.icon,
    required this.title,
    required this.body,
    this.action,
  });

  final IconData icon;
  final String title;
  final String body;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppColors.cyan),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  body,
                  style: const TextStyle(color: AppColors.slate, height: 1.4),
                ),
                ?action,
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _Readings extends StatelessWidget {
  const new({required this.vitals});

  final Vitals vitals;

  @override
  Widget build(BuildContext context) {
    final readings = <(String, String)>[
      if (vitals.heartRateBpm case final value?)
        ('Heart rate', '${value.round()} bpm'),
      if (vitals.rhythm case final rhythm?)
        ('Rhythm', SafetyCopy.rhythmLabel(rhythm)),
      if (vitals.spo2Percent case final value?)
        ('Blood oxygen', '${value.round()} %'),
      if (vitals.respiratoryRateBpm case final value?)
        ('Breathing', '${value.round()} / min'),
      if (vitals.eyeClosurePercent case final value?)
        ('Eyes closed', '${value.round()} % of the time'),
    ];
    return SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Semantics(
            header: true,
            child: const Text(
              'Readings',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w800,
                fontSize: 16,
              ),
            ),
          ),
          const SizedBox(height: 10),
          for (final (label, value) in readings)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 5),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      label,
                      style: const TextStyle(color: AppColors.slate),
                    ),
                  ),
                  Flexible(
                    child: Text(
                      value,
                      textAlign: TextAlign.end,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
