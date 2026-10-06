import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Small pill such as “Owner”, “You · Member” or “Pending”.
class RoleChip extends StatelessWidget {
  const new(this.label, {this.color = AppColors.cyan, super.key});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: color.withValues(alpha: 0.7)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
        child: Text(
          label,
          style: TextStyle(
            color: color,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
