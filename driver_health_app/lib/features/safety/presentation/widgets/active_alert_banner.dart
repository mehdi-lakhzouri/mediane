import 'package:driver_health_app/core/presentation/motion/motion.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/safety/domain/entities/incident.dart';
import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';
import 'package:driver_health_app/features/safety/presentation/safety_copy.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// Red banner at the top of home while an alert is open, so a driver who
/// closed the alert screen can always get back to it.
class ActiveAlertBanner extends StatelessWidget {
  const new({
    required this.status,
    required this.triggerType,
    required this.onTap,
    super.key,
  });

  static const bannerKey = Key('home.activeAlert');

  final IncidentStatus status;
  final MedicalEventType triggerType;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final escalated = status == IncidentStatus.escalated;
    final title = escalated ? 'Help is on the way' : 'Are you OK?';
    final subtitle = escalated
        ? 'Your contacts have been alerted. Tap to follow.'
        : '${SafetyCopy.eventTitle(triggerType)}. Tap to answer.';
    final banner = Semantics(
      button: true,
      liveRegion: true,
      label: '$title. $subtitle',
      excludeSemantics: true,
      child: Material(
        key: bannerKey,
        color: AppColors.coral,
        borderRadius: BorderRadius.circular(22),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              children: [
                const Icon(
                  Icons.crisis_alert_rounded,
                  color: Colors.white,
                  size: 34,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: const TextStyle(color: Colors.white),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: Colors.white),
              ],
            ),
          ),
        ),
      ),
    );
    if (Motion.reduced(context)) return banner;
    // One sweep of light so the banner is noticed, then it stays still.
    return banner.animate().shimmer(
      delay: Motion.long,
      duration: 1200.ms,
      color: Colors.white.withValues(alpha: 0.35),
    );
  }
}
