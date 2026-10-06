import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class CabinGuardBackground extends StatelessWidget {
  const new({
    required this.child,
    this.alignment = const Alignment(-0.55, 0),
    this.overlayStrength = 0.42,
    super.key,
  });

  final Widget child;
  final Alignment alignment;
  final double overlayStrength;

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(
          'assets/images/cabinguard-road-dark.webp',
          fit: BoxFit.cover,
          alignment: alignment,
          filterQuality: FilterQuality.high,
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              stops: const [0, 0.46, 1],
              colors: [
                AppColors.navy950.withValues(alpha: overlayStrength * 0.65),
                AppColors.navy900.withValues(alpha: overlayStrength),
                AppColors.navy950.withValues(alpha: 0.96),
              ],
            ),
          ),
        ),
        child,
      ],
    );
  }
}
