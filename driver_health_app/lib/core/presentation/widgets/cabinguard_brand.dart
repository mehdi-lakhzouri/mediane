import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

class CabinGuardBrand extends StatelessWidget {
  const new({this.compact = false, this.showTagline = false, super.key});

  final bool compact;
  final bool showTagline;

  @override
  Widget build(BuildContext context) {
    final markSize = compact ? 54.0 : 96.0;
    final fontSize = compact ? 27.0 : 44.0;

    return Semantics(
      label: 'CabinGuard. Safer drivers. Smarter journeys.',
      child: ExcludeSemantics(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: markSize,
                    height: markSize,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        ShaderMask(
                          shaderCallback: (bounds) => const LinearGradient(
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                            colors: [
                              Colors.white,
                              AppColors.cyan,
                              AppColors.cobalt,
                            ],
                          ).createShader(bounds),
                          child: Icon(
                            Icons.shield_rounded,
                            color: Colors.white,
                            size: markSize,
                            shadows: [
                              Shadow(
                                color: AppColors.cyan.withValues(alpha: 0.45),
                                blurRadius: compact ? 14 : 24,
                              ),
                            ],
                          ),
                        ),
                        Icon(
                          Icons.alt_route_rounded,
                          color: AppColors.navy950,
                          size: markSize * 0.46,
                        ),
                      ],
                    ),
                  ),
                  SizedBox(width: compact ? 12 : 18),
                  Text.rich(
                    TextSpan(
                      style: TextStyle(
                        fontSize: fontSize,
                        height: 1,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -1.2,
                      ),
                      children: const [
                        TextSpan(
                          text: 'Cabin',
                          style: TextStyle(color: Colors.white),
                        ),
                        TextSpan(
                          text: 'Guard',
                          style: TextStyle(color: AppColors.cyan),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
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
