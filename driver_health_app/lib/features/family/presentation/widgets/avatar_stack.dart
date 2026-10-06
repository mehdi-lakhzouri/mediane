import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/family/domain/entities/family.dart';
import 'package:driver_health_app/features/family/presentation/widgets/member_avatar.dart';
import 'package:flutter/material.dart';

/// Overlapping member photos with a “+N” for the rest (screen 19 header).
class AvatarStack extends StatelessWidget {
  const new({
    required this.members,
    this.visible = 4,
    this.size = 44,
    super.key,
  });

  final List<FamilyMember> members;
  final int visible;
  final double size;

  @override
  Widget build(BuildContext context) {
    final shown = members.take(visible).toList();
    final hidden = members.length - shown.length;
    final step = size * 0.72;
    final count = shown.length + (hidden > 0 ? 1 : 0);

    return Semantics(
      label: '${members.length} ${members.length == 1 ? 'member' : 'members'}',
      excludeSemantics: true,
      child: SizedBox(
        height: size,
        width: count == 0 ? 0 : step * (count - 1) + size,
        child: Stack(
          children: [
            for (var i = 0; i < shown.length; i++)
              Positioned(
                left: step * i,
                child: MemberAvatar(
                  initials: shown[i].initials,
                  avatar: shown[i].avatar,
                  size: size,
                  ringColor: AppColors.navy950,
                ),
              ),
            if (hidden > 0)
              Positioned(
                left: step * shown.length,
                child: Container(
                  width: size,
                  height: size,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.navy900,
                    border: Border.all(color: AppColors.slate),
                  ),
                  child: Text(
                    '+$hidden',
                    style: const TextStyle(color: AppColors.ice),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
