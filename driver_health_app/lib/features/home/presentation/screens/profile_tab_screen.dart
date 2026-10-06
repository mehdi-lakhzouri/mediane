import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/presentation/motion/entrance.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_background.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/auth/presentation/controllers/auth_providers.dart';
import 'package:driver_health_app/features/driver_profile/presentation/controllers/profile_setup_controller.dart';
import 'package:driver_health_app/features/driver_profile/presentation/widgets/profile_avatar_view.dart';
import 'package:driver_health_app/features/home/presentation/controllers/dashboard_providers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// The Profile tab: the driver's details, contacts, photo and security.
class ProfileTabScreen extends ConsumerWidget {
  const new({super.key});

  static String _contactsDetail(int? count) => switch (count) {
    null => 'Who is called after an incident',
    1 => '1 contact · in call order',
    _ => '$count contacts · in call order',
  };

  /// Editing starts from the server's current profile, not an old draft.
  void _openEditor(BuildContext context, WidgetRef ref, String route) {
    ref.invalidate(profileSetupControllerProvider);
    unawaited(context.push(route));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(dashboardProvider).value;
    final email = ref.watch(currentUserProvider).value?.email;
    final contacts = dashboard?.emergencyContactCount;

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: CabinGuardBackground(
        alignment: const Alignment(0.2, -0.4),
        child: SafeArea(
          bottom: false,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 600),
              child: EntranceScope(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                  children: staggered([
                    Semantics(
                      header: true,
                      child: const Text(
                        'Profile',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 32,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      children: [
                        ProfileAvatarView(
                          size: 72,
                          avatar: dashboard?.avatar,
                          showBadge: false,
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                dashboard?.fullName ?? '',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 20,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              if (email != null)
                                Text(
                                  email,
                                  style: const TextStyle(
                                    color: AppColors.slate,
                                  ),
                                ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),
                    _Group(
                      children: [
                        _Row(
                          icon: Icons.badge_outlined,
                          label: 'Personal details',
                          detail: 'Phone, date of birth, gender',
                          onTap: () =>
                              _openEditor(context, ref, AppRoutes.editProfile),
                        ),
                        _Row(
                          icon: Icons.contact_phone_outlined,
                          label: 'Emergency contacts',
                          detail: _contactsDetail(contacts),
                          onTap: () =>
                              _openEditor(context, ref, AppRoutes.editContacts),
                        ),
                        _Row(
                          icon: Icons.photo_camera_outlined,
                          label: 'Profile photo',
                          detail: dashboard?.avatar == null
                              ? 'Optional'
                              : 'Change or remove',
                          onTap: () =>
                              _openEditor(context, ref, AppRoutes.profilePhoto),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    _Group(
                      children: [
                        _Row(
                          icon: Icons.shield_outlined,
                          label: 'Security',
                          detail: dashboard == null
                              ? 'Two-step verification, unlock, sessions'
                              : dashboard.mfaEnabled
                              ? 'Two-step verification is on'
                              : 'Two-step verification is off',
                          onTap: () =>
                              unawaited(context.push(AppRoutes.security)),
                        ),
                        _Row(
                          icon: Icons.notifications_outlined,
                          label: 'Notifications',
                          detail: 'Alerts, family news and settings',
                          onTap: () =>
                              unawaited(context.push(AppRoutes.notifications)),
                        ),
                        _Row(
                          icon: Icons.logout_rounded,
                          label: 'Sign out',
                          destructive: true,
                          onTap: () => unawaited(
                            ref.read(sessionManagerProvider).signOut(),
                          ),
                        ),
                      ],
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Group extends StatelessWidget {
  const new({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.navy900.withValues(alpha: 0.8),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(22),
        side: BorderSide(color: AppColors.cyan.withValues(alpha: 0.22)),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0)
              Divider(
                height: 1,
                indent: 56,
                color: AppColors.slate.withValues(alpha: 0.2),
              ),
            children[i],
          ],
        ],
      ),
    );
  }
}

class _Row extends StatelessWidget {
  const new({
    required this.icon,
    required this.label,
    required this.onTap,
    this.detail,
    this.destructive = false,
  });

  final IconData icon;
  final String label;
  final String? detail;
  final VoidCallback onTap;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final color = destructive ? AppColors.coral : Colors.white;
    return ListTile(
      onTap: onTap,
      minTileHeight: 64,
      leading: Icon(
        icon,
        color: destructive ? AppColors.coral : AppColors.cyan,
      ),
      title: Text(
        label,
        style: TextStyle(color: color, fontWeight: FontWeight.w600),
      ),
      subtitle: detail == null
          ? null
          : Text(detail!, style: const TextStyle(color: AppColors.slate)),
      trailing: destructive
          ? null
          : const Icon(Icons.chevron_right_rounded, color: AppColors.slate),
    );
  }
}
