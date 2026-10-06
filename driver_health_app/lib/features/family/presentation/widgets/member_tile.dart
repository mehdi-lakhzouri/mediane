import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/family/domain/entities/family.dart';
import 'package:driver_health_app/features/family/presentation/widgets/member_avatar.dart';
import 'package:driver_health_app/features/family/presentation/widgets/role_chip.dart';
import 'package:flutter/material.dart';

/// One family member in the overview list (screen 19).
class MemberTile extends StatelessWidget {
  const new({
    required this.member,
    required this.isYou,
    required this.onTap,
    super.key,
  });

  final FamilyMember member;
  final bool isYou;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final role = member.role == FamilyRole.owner ? 'Owner' : 'Member';
    final label = isYou ? 'You · $role' : role;
    return Semantics(
      button: true,
      label: '${member.fullName}, $label. ${member.sharing.summary}.',
      excludeSemantics: true,
      child: SurfaceCard(
        onTap: onTap,
        child: Row(
          children: [
            MemberAvatar(initials: member.initials, avatar: member.avatar),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    member.fullName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 17,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 4),
                  RoleChip(
                    label,
                    color: isYou ? AppColors.cyan : AppColors.slate,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    member.sharing.summary,
                    style: const TextStyle(color: AppColors.slate),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: AppColors.ice),
          ],
        ),
      ),
    );
  }
}
