import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/confirm_dialog.dart';
import 'package:driver_health_app/core/presentation/widgets/content_page.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/safety/presentation/safety_copy.dart';
import 'package:driver_health_app/features/security/domain/entities/active_session.dart';
import 'package:driver_health_app/features/security/presentation/controllers/active_sessions_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Every device signed in to the account, with a way to sign any other one
/// out, or all of them at once. This phone signs out from Profile.
class ActiveDevicesScreen extends ConsumerStatefulWidget {
  const new({super.key});

  static const revokeOthersKey = Key('devices.revokeOthers');
  static Key revokeKey(String sessionId) => Key('devices.revoke.$sessionId');

  @override
  ConsumerState<ActiveDevicesScreen> createState() =>
      _ActiveDevicesScreenState();
}

class _ActiveDevicesScreenState extends ConsumerState<ActiveDevicesScreen> {
  bool _busy = false;

  ActiveSessionsController get _controller =>
      ref.read(activeSessionsControllerProvider.notifier);

  Future<void> _confirmAndRun({
    required String title,
    required String message,
    required String confirmLabel,
    required Future<ApiFailure?> Function() action,
    required String success,
  }) async {
    final confirmed = await showConfirmDialog(
      context,
      title: title,
      message: message,
      confirmLabel: confirmLabel,
    );
    if (!confirmed || !mounted) return;
    setState(() => _busy = true);
    final failure = await action();
    if (!mounted) return;
    setState(() => _busy = false);
    ScaffoldMessenger.of(context)
      ..hideCurrentSnackBar()
      ..showSnackBar(SnackBar(content: Text(failure?.message ?? success)));
  }

  @override
  Widget build(BuildContext context) {
    final sessions = ref.watch(activeSessionsControllerProvider);
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: ContentPage(
        title: 'Active devices',
        entranceKey: sessions.hasValue,
        subtitle: 'Phones and browsers signed in to your account.',
        onBack: () =>
            context.canPop() ? context.pop() : context.go(AppRoutes.security),
        onRefresh: _controller.refresh,
        children: switch (sessions) {
          AsyncData(:final value) => _content(value),
          AsyncError(:final error) => [
            InlineMessage(message: ApiFailure.from(error).message),
            TextButton(
              onPressed: () => unawaited(_controller.refresh()),
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

  List<Widget> _content(List<ActiveSession> sessions) {
    final others = sessions.where((s) => !s.current).toList();
    return [
      for (final session in sessions)
        Padding(
          padding: const EdgeInsets.only(bottom: 10),
          child: _SessionCard(
            session: session,
            onSignOut: session.current || _busy
                ? null
                : () => unawaited(
                    _confirmAndRun(
                      title: 'Sign out ${session.label}?',
                      message:
                          'That device will need your password to sign in '
                          'again.',
                      confirmLabel: 'Sign out',
                      action: () => _controller.revoke(session.id),
                      success: '${session.label} was signed out.',
                    ),
                  ),
          ),
        ),
      const SizedBox(height: 10),
      if (others.isNotEmpty)
        OutlinedButton.icon(
          key: ActiveDevicesScreen.revokeOthersKey,
          onPressed: _busy
              ? null
              : () => unawaited(
                  _confirmAndRun(
                    title: 'Sign out of all other devices?',
                    message:
                        '${others.length} '
                        '${others.length == 1 ? 'device' : 'devices'} will '
                        'need your password to sign in again. This phone '
                        'stays signed in.',
                    confirmLabel: 'Sign out others',
                    action: _controller.revokeOthers,
                    success: 'Other devices were signed out.',
                  ),
                ),
          icon: const Icon(Icons.phonelink_erase_rounded),
          label: const Text('Sign out of all other devices'),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.coral,
            minimumSize: const Size.fromHeight(52),
            side: const BorderSide(color: AppColors.coral),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        )
      else
        const InlineMessage(
          tone: InlineMessageTone.info,
          icon: Icons.verified_user_outlined,
          message: 'Only this phone is signed in to your account.',
        ),
      const SizedBox(height: 14),
      const Text(
        'Don’t recognize a device? Sign it out, then change your password '
        'in Security.',
        style: TextStyle(color: AppColors.slate, fontSize: 13, height: 1.4),
      ),
    ];
  }
}

class _SessionCard extends StatelessWidget {
  const new({required this.session, required this.onSignOut});

  final ActiveSession session;
  final VoidCallback? onSignOut;

  IconData get _icon => switch (session.platform) {
    SessionPlatform.android || SessionPlatform.ios => Icons.smartphone_rounded,
    SessionPlatform.windows ||
    SessionPlatform.macos ||
    SessionPlatform.linux => Icons.laptop_rounded,
    SessionPlatform.unknown =>
      session.app ? Icons.smartphone_rounded : Icons.devices_other_rounded,
  };

  @override
  Widget build(BuildContext context) {
    final details = [
      if (session.current)
        'This phone'
      else
        'Active ${SafetyCopy.whenInSentence(session.lastActiveAt)}',
      'Signed in ${SafetyCopy.whenInSentence(session.signedInAt)}',
      if (session.ipAddress case final ip?) 'IP $ip',
    ];
    return SurfaceCard(
      highlighted: session.current,
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: AppColors.cobalt.withValues(alpha: 0.25),
            child: Icon(_icon, color: AppColors.cyan),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 4),
                for (final line in details)
                  Text(
                    line,
                    style: TextStyle(
                      color: session.current && line == details.first
                          ? AppColors.mint
                          : AppColors.slate,
                      fontSize: 13,
                    ),
                  ),
              ],
            ),
          ),
          if (onSignOut != null)
            TextButton(
              key: ActiveDevicesScreen.revokeKey(session.id),
              onPressed: onSignOut,
              child: const Text(
                'Sign out',
                style: TextStyle(color: AppColors.coral),
              ),
            ),
        ],
      ),
    );
  }
}
