import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';
import 'package:flutter/material.dart';

/// A person's photo, falling back to their initials.
class MemberAvatar extends StatelessWidget {
  const new({
    required this.initials,
    this.avatar,
    this.size = 56,
    this.ringColor,
    super.key,
  });

  final String initials;
  final ProfileAvatar? avatar;
  final double size;
  final Color? ringColor;

  @override
  Widget build(BuildContext context) {
    final fallback = Center(
      child: Text(
        initials,
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.34,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
    return ExcludeSemantics(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: AppColors.navy800,
          border: Border.all(
            color: ringColor ?? AppColors.cyan.withValues(alpha: 0.5),
            width: 2,
          ),
        ),
        child: ClipOval(
          child: avatar == null
              ? fallback
              : Image.network(
                  avatar!.url.toString(),
                  fit: BoxFit.cover,
                  width: size,
                  height: size,
                  errorBuilder: (_, _, _) => fallback,
                ),
        ),
      ),
    );
  }
}
