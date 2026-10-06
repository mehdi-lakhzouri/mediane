import 'package:driver_health_app/core/presentation/motion/pressable.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Rounded navy card with an optional tap target, used for lists and
/// summaries on content screens.
class SurfaceCard extends StatelessWidget {
  const new({
    required this.child,
    this.onTap,
    this.highlighted = false,
    this.padding = const EdgeInsets.all(16),
    super.key,
  });

  final Widget child;
  final VoidCallback? onTap;
  final bool highlighted;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final card = Material(
      color: AppColors.navy900.withValues(alpha: 0.78),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
        side: BorderSide(
          color: AppColors.cyan.withValues(alpha: highlighted ? 0.7 : 0.28),
          width: highlighted ? 1.5 : 1,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(padding: padding, child: child),
      ),
    );
    return Pressable(enabled: onTap != null, scale: 0.98, child: card);
  }
}
