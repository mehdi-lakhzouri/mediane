import 'package:driver_health_app/core/presentation/motion/motion.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

enum InlineMessageTone { error, info }

/// Announced message inside a panel: failed actions, offline, or expiry.
class InlineMessage extends StatelessWidget {
  const new({
    required this.message,
    this.tone = InlineMessageTone.error,
    this.icon,
    super.key,
  });

  final String message;
  final InlineMessageTone tone;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final color = tone == InlineMessageTone.error
        ? AppColors.coral
        : AppColors.cyan;
    final box = Semantics(
      liveRegion: true,
      container: true,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: color.withValues(alpha: 0.55)),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                icon ??
                    (tone == InlineMessageTone.error
                        ? Icons.error_outline_rounded
                        : Icons.info_outline_rounded),
                color: color,
                size: 22,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  message,
                  style: const TextStyle(
                    color: AppColors.ice,
                    fontSize: 14,
                    height: 1.4,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
    // Messages appear in answer to an action: slide in so the eye finds them.
    if (Motion.reduced(context)) return box;
    return box
        .animate()
        .fadeIn(duration: Motion.medium)
        .slideY(begin: -0.2, end: 0, curve: Motion.emphasized);
  }
}
