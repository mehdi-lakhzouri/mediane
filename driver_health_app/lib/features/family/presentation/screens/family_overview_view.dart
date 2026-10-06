import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/presentation/widgets/content_page.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/session/auth_state.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/family/application/my_family_controller.dart';
import 'package:driver_health_app/features/family/domain/entities/family.dart';
import 'package:driver_health_app/features/family/presentation/screens/family_settings_sheet.dart';
import 'package:driver_health_app/features/family/presentation/widgets/avatar_stack.dart';
import 'package:driver_health_app/features/family/presentation/widgets/member_tile.dart';
import 'package:driver_health_app/features/family/presentation/widgets/role_chip.dart';
import 'package:driver_health_app/features/safety/presentation/widgets/family_incidents_section.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Screen 19: the family, its members, and the owner's shortcuts.
class FamilyOverviewView extends ConsumerWidget {
  const new({required this.family, super.key});

  final Family family;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authStateProvider);
    final myId = auth is AuthSignedIn ? auth.userId : null;
    final me = family.members.where((m) => m.userId == myId).firstOrNull;
    final pending = family.pendingRequestCount;

    return ContentPage(
      title: 'My family',
      backgroundAlignment: const Alignment(0.3, -0.5),
      onRefresh: () => ref.read(myFamilyControllerProvider.notifier).refresh(),
      trailing: IconButton(
        tooltip: 'Family settings',
        color: AppColors.ice,
        onPressed: () => unawaited(showFamilySettingsSheet(context, family)),
        icon: const Icon(Icons.settings_outlined),
      ),
      children: [
        const FamilyIncidentsSection(),
        _Header(
          family: family,
          onRequests: () => unawaited(context.push(AppRoutes.familyRequests)),
        ),
        const SizedBox(height: 24),
        Semantics(
          header: true,
          child: const Text(
            'Family members',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(height: 12),
        for (final member in family.members) ...[
          MemberTile(
            member: member,
            isYou: member.userId == myId,
            onTap: () =>
                unawaited(context.push(AppRoutes.familyMember(member.userId))),
          ),
          const SizedBox(height: 10),
        ],
        if (me != null) ...[
          const SizedBox(height: 4),
          SurfaceCard(
            onTap: () => unawaited(context.push(AppRoutes.familySharing)),
            child: Row(
              children: [
                const Icon(Icons.tune_rounded, color: AppColors.cyan),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'What I share',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        family.mySharing.summary,
                        style: const TextStyle(color: AppColors.slate),
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.chevron_right_rounded, color: AppColors.ice),
              ],
            ),
          ),
        ],
        if (family.isOwner) ...[
          const SizedBox(height: 20),
          if (family.isFull)
            const InlineMessage(
              tone: InlineMessageTone.info,
              message:
                  'Your family is full. Remove a member to invite someone '
                  'new.',
            )
          else
            GradientButton(
              label: 'Invite member',
              onPressed: () => unawaited(context.push(AppRoutes.familyInvite)),
            ),
          if (pending == 0) ...[
            const SizedBox(height: 8),
            TextButton(
              onPressed: () =>
                  unawaited(context.push(AppRoutes.familyRequests)),
              child: const Text(
                'Join requests',
                style: TextStyle(color: AppColors.cyan),
              ),
            ),
          ],
        ],
      ],
    );
  }
}

class _Header extends StatelessWidget {
  const new({required this.family, required this.onRequests});

  final Family family;
  final VoidCallback onRequests;

  @override
  Widget build(BuildContext context) {
    final pending = family.pendingRequestCount;
    return SurfaceCard(
      highlighted: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.verified_user_outlined,
                color: AppColors.cyan,
                size: 32,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  family.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              RoleChip(family.isOwner ? 'Owner' : 'Member'),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            '${family.members.length} of ${family.maxMembers} members',
            style: const TextStyle(color: AppColors.slate),
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            crossAxisAlignment: WrapCrossAlignment.center,
            alignment: WrapAlignment.spaceBetween,
            children: [
              AvatarStack(members: family.members),
              if (family.isOwner && pending > 0)
                OutlinedButton.icon(
                  onPressed: onRequests,
                  icon: const Icon(Icons.person_add_alt_1_outlined),
                  label: Text(
                    pending == 1
                        ? '1 request waiting'
                        : '$pending requests '
                              'waiting',
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Colors.white,
                    side: const BorderSide(color: AppColors.cyan),
                    shape: const StadiumBorder(),
                    textStyle: Theme.of(context).textTheme.labelLarge
                        ?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}
