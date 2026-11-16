import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class MonitoringCard extends StatelessWidget {
  const new({required this.status, required this.mode, super.key});

  final String status;
  final String mode;

  @override
  Widget build(BuildContext context) {
    final label = switch (status) {
      'READY' => 'Monitoring inputs ready',
      'WARMING_UP' => 'Monitoring is warming up',
      'DEGRADED' => 'Monitoring coverage is limited',
      _ => 'Monitoring is unavailable',
    };
    final detail = mode == 'ACTIVE'
        ? 'Detections can open an alert. '
              'Readiness does not mean a medical all-clear.'
        : 'Shadow mode records detections without opening emergency alerts.';
    return SurfaceCard(
      child: Row(
        children: [
          Icon(
            Icons.sensors_rounded,
            color: status == 'READY' ? AppColors.mint : AppColors.slate,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                Text(detail, style: const TextStyle(color: AppColors.slate)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
