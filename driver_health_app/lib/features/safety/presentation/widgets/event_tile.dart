import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';
import 'package:driver_health_app/features/safety/presentation/safety_copy.dart';
import 'package:flutter/material.dart';

/// Rounded icon tile colored by severity.
class EventIcon extends StatelessWidget {
  const new({
    required this.type,
    required this.severity,
    this.size = 52,
    super.key,
  });

  final MedicalEventType type;
  final EventSeverity severity;
  final double size;

  @override
  Widget build(BuildContext context) {
    final color = SafetyCopy.severityColor(severity);
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(size * 0.3),
        border: Border.all(color: color.withValues(alpha: 0.35)),
      ),
      child: Icon(SafetyCopy.eventIcon(type), color: color, size: size * 0.5),
    );
  }
}

/// One row of the history list.
class EventTile extends StatelessWidget {
  const new({required this.event, required this.onTap, super.key});

  final MedicalEvent event;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final title = SafetyCopy.eventTitle(event.type);
    final when = SafetyCopy.when(event.detectedAt);
    final severity = event.isNonActionable
        ? event.processingMode!
        : SafetyCopy.severityLabel(event.severity);
    return Semantics(
      button: true,
      label: '$title, $severity, $when',
      excludeSemantics: true,
      child: SurfaceCard(
        onTap: onTap,
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            EventIcon(type: event.type, severity: event.severity),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(when, style: const TextStyle(color: AppColors.slate)),
                ],
              ),
            ),
            const SizedBox(width: 8),
            Text(
              severity,
              style: TextStyle(
                color: SafetyCopy.severityColor(event.severity),
                fontWeight: FontWeight.w700,
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.ice),
          ],
        ),
      ),
    );
  }
}
