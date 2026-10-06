import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class RecoveryHero extends StatelessWidget {
  const new({
    required this.icon,
    this.badge,
    this.badgeColor = AppColors.mint,
    super.key,
  });

  final IconData icon;
  final IconData? badge;
  final Color badgeColor;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      image: true,
      excludeSemantics: true,
      child: SizedBox.square(
        dimension: 112,
        child: Stack(
          alignment: Alignment.center,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.navy900.withValues(alpha: 0.72),
                border: Border.all(color: AppColors.cyan, width: 2),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.cyan.withValues(alpha: 0.28),
                    blurRadius: 24,
                  ),
                ],
              ),
              child: SizedBox.square(
                dimension: 96,
                child: Icon(icon, color: AppColors.ice, size: 48),
              ),
            ),
            if (badge != null)
              Positioned(
                right: 4,
                bottom: 6,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: badgeColor,
                    boxShadow: [
                      BoxShadow(
                        color: badgeColor.withValues(alpha: 0.4),
                        blurRadius: 12,
                      ),
                    ],
                  ),
                  child: Padding(
                    padding: const EdgeInsets.all(7),
                    child: Icon(badge, color: AppColors.navy950, size: 22),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
