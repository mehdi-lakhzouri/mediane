import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/content_page.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/notifications/application/notifications_controller.dart';
import 'package:driver_health_app/features/notifications/domain/app_notification.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// What the driver hears about. Emergencies and security cannot be muted;
/// the screen says so instead of offering a switch that would not work.
class NotificationPreferencesScreen extends ConsumerStatefulWidget {
  const new({super.key});

  static const saveKey = Key('notificationPreferences.save');

  @override
  ConsumerState<NotificationPreferencesScreen> createState() =>
      _NotificationPreferencesScreenState();
}

class _NotificationPreferencesScreenState
    extends ConsumerState<NotificationPreferencesScreen> {
  NotificationPreferences? _draft;
  bool _saving = false;

  void _close() =>
      context.canPop() ? context.pop() : context.go(AppRoutes.notifications);

  Future<void> _save(NotificationPreferences preferences) async {
    setState(() => _saving = true);
    final failure = await ref
        .read(notificationPreferencesProvider.notifier)
        .save(preferences);
    if (!mounted) return;
    setState(() => _saving = false);
    final messenger = ScaffoldMessenger.of(context)..hideCurrentSnackBar();
    if (failure != null) {
      messenger.showSnackBar(SnackBar(content: Text(failure.message)));
      return;
    }
    setState(() => _draft = null);
    messenger.showSnackBar(
      const SnackBar(content: Text('Notification settings saved.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final saved = ref.watch(notificationPreferencesProvider);
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: ContentPage(
        title: 'Notification settings',
        entranceKey: saved.hasValue,
        subtitle: 'Choose what reaches your notification center.',
        onBack: _close,
        children: switch (saved) {
          AsyncData(:final value) => _content(value),
          AsyncError(:final error) => [
            InlineMessage(message: ApiFailure.from(error).message),
            TextButton(
              onPressed: () => ref.invalidate(notificationPreferencesProvider),
              child: const Text(
                'Try again',
                style: TextStyle(color: AppColors.cyan),
              ),
            ),
          ],
          _ => const [
            Center(child: CircularProgressIndicator(color: AppColors.cyan)),
          ],
        },
      ),
    );
  }

  List<Widget> _content(NotificationPreferences saved) {
    final draft = _draft ?? saved;
    void update(NotificationPreferences next) => setState(() => _draft = next);
    return [
      _Toggle(
        icon: Icons.health_and_safety_rounded,
        title: 'Safety alerts',
        message:
            'Your alert outcomes and cabin unit status. When a family member '
            'needs help, you are always told.',
        value: draft.safety,
        enabled: !_saving,
        onChanged: (value) => update(draft.copyWith(safety: value)),
      ),
      const SizedBox(height: 10),
      _Toggle(
        icon: Icons.groups_rounded,
        title: 'Family activity',
        message: 'Join requests, new members and ownership changes.',
        value: draft.family,
        enabled: !_saving,
        onChanged: (value) => update(draft.copyWith(family: value)),
      ),
      const SizedBox(height: 10),
      _Toggle(
        icon: Icons.campaign_rounded,
        title: 'CabinGuard news',
        message: 'Service announcements, such as planned maintenance.',
        value: draft.account,
        enabled: !_saving,
        onChanged: (value) => update(draft.copyWith(account: value)),
      ),
      const SizedBox(height: 10),
      const _Toggle(
        icon: Icons.shield_rounded,
        title: 'Security',
        message:
            'New sign-ins, password and two-step changes. Always on, so you '
            'notice anything unexpected.',
        value: true,
        enabled: false,
      ),
      const SizedBox(height: 24),
      Semantics(
        header: true,
        child: const Text(
          'Lock screen',
          style: TextStyle(
            color: Colors.white,
            fontSize: 20,
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      const SizedBox(height: 10),
      _Toggle(
        icon: Icons.lock_outline_rounded,
        title: 'Show names on the lock screen',
        message:
            'For example "Karim may need help". Off: the lock screen only '
            'says you have a new alert. Health details never appear there.',
        value: draft.showNamesOnLockScreen,
        enabled: !_saving,
        onChanged: (value) =>
            update(draft.copyWith(showNamesOnLockScreen: value)),
      ),
      const SizedBox(height: 10),
      const InlineMessage(
        tone: InlineMessageTone.info,
        icon: Icons.info_outline_rounded,
        message:
            'Push notifications are not available yet. Everything appears '
            'in the notification center.',
      ),
      const SizedBox(height: 20),
      GradientButton(
        key: NotificationPreferencesScreen.saveKey,
        label: 'Save settings',
        loading: _saving,
        onPressed: draft != saved ? () => unawaited(_save(draft)) : null,
      ),
    ];
  }
}

class _Toggle extends StatelessWidget {
  const new({
    required this.icon,
    required this.title,
    required this.message,
    required this.value,
    required this.enabled,
    this.onChanged,
  });

  final IconData icon;
  final String title;
  final String message;
  final bool value;
  final bool enabled;
  final ValueChanged<bool>? onChanged;

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
