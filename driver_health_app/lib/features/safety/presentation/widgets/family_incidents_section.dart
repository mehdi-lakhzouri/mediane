import 'dart:async';

import 'package:driver_health_app/core/presentation/motion/motion.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/safety/application/safety_providers.dart';
import 'package:driver_health_app/features/safety/domain/entities/incident.dart';
import 'package:driver_health_app/features/safety/presentation/safety_copy.dart';
import 'package:driver_health_app/features/safety/presentation/safety_links.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Alerts of family members who share them, on the Family tab. Says who
/// needed help and when, never why. Renders nothing when there is nothing to
/// show, or when the list cannot be loaded (the family screen stays usable).
class FamilyIncidentsSection extends ConsumerWidget {
  const new({super.key});

  static const urgentKey = Key('family.incident.urgent');

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final incidents = ref.watch(familyIncidentsProvider).value ?? const [];
    if (incidents.isEmpty) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Column(
        children: [
          for (final incident in incidents)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: incident.needsHelp
                  ? _attention(context, _UrgentCard(incident: incident))
                  : _ClosedRow(incident: incident),
            ),
        ],
      ),
    );
  }
}

/// Draws the eye once when someone needs help: a short shake, no loop.
Widget _attention(BuildContext context, Widget card) => Motion.reduced(context)
    ? card
    : card
          .animate()
          .fadeIn(duration: Motion.medium)
          .shakeX(delay: Motion.medium, duration: 600.ms, hz: 3, amount: 5);

class _UrgentCard extends StatelessWidget {
  const new({required this.incident});

  final FamilyIncident incident;

  @override
  Widget build(BuildContext context) {
    final name = incident.memberFirstName;
    final since = incident.escalatedAt ?? incident.openedAt;
    final location = incident.location;
    return Semantics(
      liveRegion: true,
      container: true,
      child: Material(
        key: FamilyIncidentsSection.urgentKey,
        color: AppColors.coral,
        borderRadius: BorderRadius.circular(22),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.crisis_alert_rounded,
                    color: Colors.white,
                    size: 30,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      '$name may need help',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 19,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              Text(
                'Mediane alerted ${SafetyCopy.whenInSentence(since)}. '
                'Try to reach $name. Their emergency contacts are being '
                'called.',
                style: const TextStyle(color: Colors.white, height: 1.4),
              ),
              if (location != null) ...[
                const SizedBox(height: 12),
                FilledButton.icon(
                  onPressed: () => unawaited(openInMaps(location)),
                  icon: const Icon(Icons.place_rounded),
                  label: Text("See $name's location"),
                  style: FilledButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.navy950,
                    minimumSize: const Size.fromHeight(48),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ClosedRow extends StatelessWidget {
  const new({required this.incident});

  final FamilyIncident incident;

  @override
  Widget build(BuildContext context) {
    final resolvedAt = incident.resolvedAt;
    return SurfaceCard(
      child: Row(
        children: [
          const Icon(Icons.verified_rounded, color: AppColors.mint),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              resolvedAt == null
                  ? "${incident.memberFirstName}'s alert has ended"
                  : '${incident.memberFirstName} is safe · alert ended '
                        '${SafetyCopy.whenInSentence(resolvedAt)}',
              style: const TextStyle(color: AppColors.ice),
            ),
          ),
        ],
      ),
    );
  }
}
