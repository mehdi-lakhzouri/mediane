import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/safety/domain/entities/incident.dart';
import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';
import 'package:driver_health_app/features/safety/presentation/safety_copy.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/event_tile.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/status_pill.dart';
import 'package:flutter/material.dart';

/// "Latest medical event" on the home screen (screen 12).
class LatestEventCard extends StatelessWidget {
  const new({
    required this.type,
    required this.severity,
    required this.detectedAt,
    required this.incidentStatus,
    required this.contactsAlerted,
    required this.onTap,
    this.processingMode,
    super.key,
  });

  final MedicalEventType type;
  final EventSeverity severity;
  final DateTime detectedAt;
  final IncidentStatus? incidentStatus;
  final bool contactsAlerted;
  final VoidCallback onTap;
  final String? processingMode;

  @override
  Widget build(BuildContext context) {
    final nonActionable = processingMode != null && processingMode != 'ACTIVE';
    final (label, color) = nonActionable
        ? (processingMode!, AppColors.slate)
        : SafetyCopy.outcome(severity, incidentStatus);
    final title = SafetyCopy.eventTitle(type);
    final when = SafetyCopy.when(detectedAt);
    final detail = nonActionable
        ? 'Recorded without opening an emergency alert'
        : SafetyCopy.outcomeDetail(
            severity: severity,
            status: incidentStatus,
            contactsAlerted: contactsAlerted,
          );
    return Semantics(
      button: true,
      label: '$title, $when. $label. $detail. View details',
      excludeSemantics: true,
      child: SurfaceCard(
        onTap: onTap,
        padding: EdgeInsets.zero,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  EventIcon(type: type, severity: severity, size: 60),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Wrap(
                          spacing: 8,
                          runSpacing: 6,
                          crossAxisAlignment: WrapCrossAlignment.center,
                          children: [
                            Text(
                              title,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            StatusPill(
                              label: label,
                              color: color,
                              icon: color == AppColors.mint
                                  ? Icons.check_circle_rounded
                                  : null,
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          when,
                          style: const TextStyle(color: AppColors.slate),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          detail,
                          style: const TextStyle(color: AppColors.ice),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: AppColors.cyan.withValues(alpha: 0.18)),
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'View details',
                      style: TextStyle(
                        color: AppColors.cyan,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  Icon(Icons.chevron_right_rounded, color: AppColors.ice),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
