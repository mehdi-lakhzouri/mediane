import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/presentation/widgets/confirm_dialog.dart';
import 'package:driver_health_app/core/presentation/widgets/content_page.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/session/auth_state.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/family/application/my_family_controller.dart';
import 'package:driver_health_app/features/family/domain/entities/family.dart';
import 'package:driver_health_app/features/family/presentation/family_actions.dart';
import 'package:driver_health_app/features/family/presentation/widgets/member_avatar.dart';
import 'package:driver_health_app/features/family/presentation/widgets/role_chip.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

/// A member's shared details, with owner actions (make owner, remove) and
/// the way out for the member themself.
class MemberDetailScreen extends ConsumerWidget {
  const new({required this.userId, super.key});

  final String userId;

  void _close(BuildContext context) =>
      context.canPop() ? context.pop() : context.go(AppRoutes.family);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final family = ref.watch(myFamilyControllerProvider).value?.family;
    final auth = ref.watch(authStateProvider);
    final myId = auth is AuthSignedIn ? auth.userId : null;
    final member = family?.members
        .where((candidate) => candidate.userId == userId)
        .firstOrNull;

    if (family == null || member == null) {
      return ContentPage(
        title: 'Family member',
        onBack: () => _close(context),
        children: const [
          InlineMessage(message: 'This person is no longer in the family.'),
        ],
      );
    }

    final isYou = member.userId == myId;
    return ContentPage(
      title: member.fullName,
      onBack: () => _close(context),
      backgroundAlignment: const Alignment(0.2, -0.4),
      children: [
        Center(
          child: MemberAvatar(
            initials: member.initials,
            avatar: member.avatar,
            size: 112,
          ),
        ),
        const SizedBox(height: 12),
        Center(
          child: RoleChip(
            [
              if (isYou) 'You',
              if (member.role == FamilyRole.owner) 'Owner' else 'Member',
            ].join(' · '),
          ),
        ),
        const SizedBox(height: 6),
        Center(
          child: Text(
            'Joined ${DateFormat.yMMMd().format(member.joinedAt.toLocal())}',
            style: const TextStyle(color: AppColors.slate),
          ),
        ),
        const SizedBox(height: 24),
        _SharedDetails(member: member, isYou: isYou),
        const SizedBox(height: 20),
        if (isYou)
          _Action(
            icon: Icons.tune_rounded,
            label: 'Change what I share',
            onTap: () => unawaited(context.push(AppRoutes.familySharing)),
          )
        else if (family.isOwner) ...[
          _Action(
            icon: Icons.workspace_premium_outlined,
            label: 'Make ${member.firstName} the owner',
            onTap: () => unawaited(_transfer(context, ref, member)),
          ),
          const SizedBox(height: 10),
          _Action(
            icon: Icons.person_remove_outlined,
            label: 'Remove from family',
            destructive: true,
            onTap: () => unawaited(_remove(context, ref, member, family)),
          ),
        ],
      ],
    );
  }

  Future<void> _transfer(
    BuildContext context,
    WidgetRef ref,
    FamilyMember member,
  ) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Make ${member.firstName} the owner?',
      message:
          '${member.firstName} will approve requests and manage the family. '
          'You will become a member.',
      confirmLabel: 'Transfer ownership',
      destructive: false,
    );
    if (!confirmed || !context.mounted) return;
    await runFamilyAction(
      context,
      () => ref
          .read(myFamilyControllerProvider.notifier)
          .transferOwnership(member.userId),
      successMessage: '${member.firstName} is now the owner.',
    );
  }

  Future<void> _remove(
    BuildContext context,
    WidgetRef ref,
    FamilyMember member,
    Family family,
  ) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Remove ${member.firstName}?',
      message:
          '${member.firstName} will leave ${family.name} and stop seeing what '
          'the family shares.',
      confirmLabel: 'Remove',
    );
    if (!confirmed || !context.mounted) return;
    final removed = await runFamilyAction(
      context,
      () => ref
          .read(myFamilyControllerProvider.notifier)
          .removeMember(member.userId),
      successMessage: '${member.firstName} was removed.',
    );
    if (removed && context.mounted) _close(context);
  }
}

class _SharedDetails extends StatelessWidget {
  const new({required this.member, required this.isYou});

  final FamilyMember member;
  final bool isYou;

  @override
  Widget build(BuildContext context) {
    final sharing = member.sharing;
    final phone = member.phoneNumber;
    return SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            isYou ? 'What you share' : 'What ${member.firstName} shares',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          _SharedItem(
            icon: Icons.phone_rounded,
            label: 'Phone number',
            value: sharing.phone ? (phone ?? 'Shared') : 'Not shared',
            shared: sharing.phone,
            trailing: !isYou && phone != null
                ? IconButton(
                    tooltip: 'Call ${member.firstName}',
                    color: AppColors.cyan,
                    onPressed: () =>
                        unawaited(launchUrl(Uri(scheme: 'tel', path: phone))),
                    icon: const Icon(Icons.call_rounded),
                  )
                : null,
          ),
          _SharedItem(
            icon: Icons.notifications_active_outlined,
            label: 'Incident alerts',
            value: sharing.incidents ? 'Shared' : 'Not shared',
            shared: sharing.incidents,
          ),
          _SharedItem(
            icon: Icons.monitor_heart_outlined,
            label: 'Recent health status',
            value: sharing.health ? 'Shared' : 'Not shared',
            shared: sharing.health,
          ),
        ],
      ),
    );
  }
}

class _SharedItem extends StatelessWidget {
  const new({
    required this.icon,
    required this.label,
    required this.value,
    required this.shared,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final String value;
  final bool shared;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Icon(icon, color: shared ? AppColors.cyan : AppColors.slate),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: AppColors.ice)),
                Text(
                  value,
                  style: TextStyle(
                    color: shared ? Colors.white : AppColors.slate,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }
}

class _Action extends StatelessWidget {
  const new({
    required this.icon,
    required this.label,
    required this.onTap,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color = destructive ? AppColors.coral : AppColors.cyan;
    return SurfaceCard(
      onTap: onTap,
      child: Row(
        children: [
          Icon(icon, color: color),
          const SizedBox(width: 14),
          Expanded(
            child: Text(
              label,
              style: TextStyle(color: color, fontWeight: FontWeight.w700),
            ),
          ),
          Icon(Icons.chevron_right_rounded, color: color),
        ],
      ),
    );
  }
}
