import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class StepIndicator extends StatelessWidget {
  const new({required this.step, required this.total, super.key});

  /// 1-based.
  final int step;
  final int total;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Step $step of $total',
      excludeSemantics: true,
      child: Column(
        children: [
          Text(
            'Step $step of $total',
            style: const TextStyle(color: AppColors.ice, fontSize: 14),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 1; i <= total; i++) ...[
                if (i > 1) const SizedBox(width: 8),
                Container(
                  width: 48,
                  height: 6,
                  decoration: BoxDecoration(
                    color: i <= step
                        ? AppColors.cyan
                        : AppColors.slate.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
