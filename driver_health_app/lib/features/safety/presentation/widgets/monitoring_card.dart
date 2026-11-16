import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class MonitoringCard extends StatelessWidget {
  const new({required this.status, super.key});

  final String status;

  @override
  Widget build(BuildContext context) {
    final label = switch (status) {
      'READY' => 'Monitoring inputs ready',
      'WARMING_UP' => 'Monitoring is warming up',
      'DEGRADED' => 'Monitoring coverage is limited',
      _ => 'Monitoring is unavailable',
    };
    const detail =
        'Detections can open an alert. '
        'Readiness does not mean a medical all-clear.';
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
                const Text(detail, style: TextStyle(color: AppColors.slate)),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
