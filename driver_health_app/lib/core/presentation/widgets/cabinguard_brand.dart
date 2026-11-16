import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// The original Mediane artwork on the mobile app's dark surfaces.
class CabinGuardBrand extends StatelessWidget {
  const new({this.compact = false, this.showTagline = false, super.key});

  final bool compact;
  final bool showTagline;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: showTagline
          ? 'Mediane. Safer drivers. Smarter journeys.'
          : 'Mediane',
      image: true,
      child: ExcludeSemantics(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              'assets/images/mediane-wordmark-dark.png',
              width: compact ? 210 : 320,
              height: compact ? 44 : 67,
              fit: BoxFit.contain,
              filterQuality: FilterQuality.high,
            ),
            if (showTagline) ...[
              const SizedBox(height: 18),
              const Text(
                'Safer Drivers. Smarter Journeys.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: AppColors.ice,
                  fontSize: 17,
                  letterSpacing: 0.2,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
