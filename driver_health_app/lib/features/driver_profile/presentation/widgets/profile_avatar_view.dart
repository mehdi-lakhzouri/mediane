import 'dart:typed_data';

import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';
import 'package:flutter/material.dart';

/// Circular avatar: a just-picked photo, the saved one, or a placeholder.
class ProfileAvatarView extends StatelessWidget {
  const new({
    required this.size,
    this.avatar,
    this.preview,
    this.showBadge = true,
    super.key,
  });

  final double size;
  final ProfileAvatar? avatar;
  final Uint8List? preview;
  final bool showBadge;

  @override
  Widget build(BuildContext context) {
    final placeholder = Icon(
      Icons.person_rounded,
      size: size * 0.5,
      color: AppColors.slate,
    );
    final image = preview != null
        ? Image.memory(
            preview!,
            fit: BoxFit.cover,
            gaplessPlayback: true,
            errorBuilder: (_, _, _) => placeholder,
          )
        : avatar != null
        ? Image.network(
            avatar!.url.toString(),
            fit: BoxFit.cover,
            errorBuilder: (_, _, _) => placeholder,
          )
        : placeholder;
    final hasPhoto = preview != null || avatar != null;

    return SizedBox.square(
      dimension: size,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Container(
            width: size,
            height: size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.navy800.withValues(alpha: 0.7),
              border: Border.all(
                color: hasPhoto
                    ? AppColors.cyan
                    : AppColors.slate.withValues(alpha: 0.5),
                width: hasPhoto ? 3 : 1.5,
              ),
            ),
            child: ClipOval(child: Center(child: image)),
          ),
          if (showBadge)
            Positioned(
              right: -2,
              bottom: 2,
              child: Container(
                width: size * 0.3,
                height: size * 0.3,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.cobalt,
                ),
                child: Icon(
                  hasPhoto ? Icons.edit_rounded : Icons.photo_camera_rounded,
                  color: Colors.white,
                  size: size * 0.15,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
