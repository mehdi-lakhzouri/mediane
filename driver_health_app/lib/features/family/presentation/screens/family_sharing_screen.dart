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
import 'package:driver_health_app/features/family/presentation/family_actions.dart';
import 'package:driver_health_app/features/family/presentation/widgets/member_avatar.dart';
import 'package:driver_health_app/features/family/presentation/widgets/role_chip.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Screen 24: the member's own consent for what the family can see. Each
/// item is off by default and saved only when the member confirms.
class FamilySharingScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<FamilySharingScreen> createState() =>
      _FamilySharingScreenState();
}

class _FamilySharingScreenState extends ConsumerState<FamilySharingScreen> {
  FamilySharing? _draft;
  bool _saving = false;

  void _close() =>
      context.canPop() ? context.pop() : context.go(AppRoutes.family);

  Future<void> _save(FamilySharing sharing) async {
    setState(() => _saving = true);
    final saved = await runFamilyAction(
      context,
      () =>
          ref.read(myFamilyControllerProvider.notifier).updateSharing(sharing),
      successMessage: 'Sharing preferences saved.',
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (saved) _close();
  }

  @override
  Widget build(BuildContext context) {
    final family = ref.watch(myFamilyControllerProvider).value?.family;
    final auth = ref.watch(authStateProvider);
    final myId = auth is AuthSignedIn ? auth.userId : null;
    final me = family?.members.where((m) => m.userId == myId).firstOrNull;

    if (family == null) {
      return ContentPage(
        title: 'Family sharing',
        onBack: _close,
        children: const [
          InlineMessage(message: 'You’re not part of a family right now.'),
        ],
      );
    }

    final saved = family.mySharing;
    final draft = _draft ?? saved;
    final changed =
        draft.phone != saved.phone ||
        draft.incidents != saved.incidents ||
        draft.health != saved.health;

    return ContentPage(
      title: 'Family sharing',
      subtitle: 'Choose what your family can see.',
      onBack: _close,
      backgroundAlignment: const Alignment(-0.2, -0.3),
      children: [
        if (me != null)
          SurfaceCard(
            child: Row(
              children: [
                MemberAvatar(
                  initials: me.initials,
                  avatar: me.avatar,
                  size: 64,
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Wrap(
                        spacing: 8,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            me.fullName,
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const RoleChip('You'),
                        ],
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Name and photo are always visible to family members.',
                        style: TextStyle(color: AppColors.slate),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 24),
        Semantics(
          header: true,
          child: const Text(
            'Optional sharing',
            style: TextStyle(
              color: Colors.white,
              fontSize: 22,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const SizedBox(height: 12),
        _ConsentRow(
          icon: Icons.phone_rounded,
          title: 'Phone number',
          message: 'Let members call you directly.',
          value: draft.phone,
          enabled: !_saving,
          onChanged: (value) =>
              setState(() => _draft = draft.copyWith(phone: value)),
        ),
        const SizedBox(height: 10),
        _ConsentRow(
          icon: Icons.notifications_active_outlined,
          title: 'Incident alerts',
          message: 'Notify your family when CabinGuard detects an incident.',
          value: draft.incidents,
          enabled: !_saving,
          onChanged: (value) =>
              setState(() => _draft = draft.copyWith(incidents: value)),
        ),
        const SizedBox(height: 10),
        _ConsentRow(
          icon: Icons.monitor_heart_outlined,
          title: 'Recent health status',
          message: 'Share your latest safety status.',
          value: draft.health,
          enabled: !_saving,
          onChanged: (value) =>
              setState(() => _draft = draft.copyWith(health: value)),
        ),
        const SizedBox(height: 14),
        const InlineMessage(
          tone: InlineMessageTone.info,
          icon: Icons.verified_user_outlined,
          message:
              'You control this consent and can change it at any time. '
              'Changes apply as soon as you save.',
        ),
        const SizedBox(height: 20),
        GradientButton(
          label: 'Save preferences',
          loading: _saving,
          onPressed: changed ? () => unawaited(_save(draft)) : null,
        ),
        const SizedBox(height: 10),
        Text(
          'Visible only to members of ${family.name}',
          textAlign: TextAlign.center,
          style: const TextStyle(color: AppColors.slate, fontSize: 13),
        ),
      ],
    );
  }
}

class _ConsentRow extends StatelessWidget {
  const new({
    required this.icon,
    required this.title,
    required this.message,
    required this.value,
    required this.enabled,
    required this.onChanged,
  });

  final IconData icon;
  final String title;
  final String message;
  final bool value;
  final bool enabled;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      child: SwitchListTile(
        value: value,
        onChanged: enabled ? onChanged : null,
        activeThumbColor: Colors.white,
        activeTrackColor: AppColors.cyan,
        contentPadding: EdgeInsets.zero,
        secondary: CircleAvatar(
          backgroundColor: AppColors.cobalt.withValues(alpha: 0.25),
          child: Icon(icon, color: AppColors.cyan),
        ),
        title: Text(
          title,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w700,
          ),
        ),
        subtitle: Text(message, style: const TextStyle(color: AppColors.slate)),
      ),
    );
  }
}
