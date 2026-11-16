import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/confirm_dialog.dart';
import 'package:driver_health_app/core/presentation/widgets/content_page.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/family/application/invite_controller.dart';
import 'package:driver_health_app/features/family/application/my_family_controller.dart';
import 'package:driver_health_app/features/family/domain/entities/family_invite.dart';
import 'package:driver_health_app/features/family/presentation/family_actions.dart';
import 'package:driver_health_app/features/family/presentation/family_messages.dart';
import 'package:driver_health_app/features/family/presentation/widgets/role_chip.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

/// Screen 21: the owner's private join code, shared as a link or QR code.
class InviteCodeScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final invite = ref.watch(inviteControllerProvider);
    final familyName =
        ref.watch(myFamilyControllerProvider).value?.family?.name ?? '';

    return ContentPage(
      entranceKey: invite.hasValue,
      title: 'Invite your family',
      subtitle: 'Share this private code with someone you trust.',
      onBack: () =>
          context.canPop() ? context.pop() : context.go(AppRoutes.family),
      backgroundAlignment: const Alignment(0.4, -0.4),
      children: [
        switch (invite) {
          AsyncData(:final value) => _InviteBody(
            invite: value,
            familyName: familyName,
          ),
          AsyncError(:final error) => Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              InlineMessage(
                message: familyFailureMessage(ApiFailure.from(error)),
              ),
              TextButton(
                onPressed: () => ref.invalidate(inviteControllerProvider),
                child: const Text(
                  'Try again',
                  style: TextStyle(color: AppColors.cyan),
                ),
              ),
            ],
          ),
          _ => const Padding(
            padding: EdgeInsets.symmetric(vertical: 48),
            child: Center(
              child: CircularProgressIndicator(color: AppColors.cyan),
            ),
          ),
        },
      ],
    );
  }
}

class _InviteBody extends ConsumerWidget {
  const new({required this.invite, required this.familyName});

  final FamilyInvite invite;
  final String familyName;

  String get _shareText =>
      'Join my family on Mediane: ${invite.link} '
      '(code ${invite.code}). I’ll approve your request.';

  Future<void> _copy(BuildContext context) async {
    await Clipboard.setData(ClipboardData(text: invite.link.toString()));
    if (!context.mounted) return;
    ScaffoldMessenger.of(context)
        .showSnackBar(const SnackBar(content: Text('Invitation link copied.')));
  }

  Future<void> _rotate(BuildContext context, WidgetRef ref) async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Generate a new code?',
      message:
          'The current code and link stop working immediately. Requests '
          'already sent are not affected.',
      confirmLabel: 'New code',
      destructive: false,
    );
    if (!confirmed || !context.mounted) return;
    await runFamilyAction(
      context,
      () => ref.read(inviteControllerProvider.notifier).rotate(),
      successMessage: 'New code ready. The previous one no longer works.',
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final expires = DateFormat.yMMMd().add_jm().format(
      invite.expiresAt.toLocal(),
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SurfaceCard(
          highlighted: true,
          child: Column(
            children: [
              const Icon(Icons.groups_rounded, color: AppColors.cyan, size: 40),
              const SizedBox(height: 8),
              Text(
                familyName,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              const RoleChip('Owner'),
              const SizedBox(height: 16),
              Semantics(
                label: 'Family code ${invite.code.split('').join(' ')}',
                excludeSemantics: true,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: SelectableText(
                    invite.code,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 40,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 4,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Semantics(
                image: true,
                label: 'QR code for the invitation link',
                excludeSemantics: true,
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: QrImageView(
                    data: invite.link.toString(),
                    size: 160,
                    padding: EdgeInsets.zero,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Expires $expires',
                style: const TextStyle(color: AppColors.slate),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        GradientButton(
          label: 'Share invitation',
          onPressed: () => unawaited(
            SharePlus.instance.share(
              ShareParams(
                text: _shareText,
                subject: 'Join my Mediane family',
              ),
            ),
          ),
        ),
        const SizedBox(height: 10),
        OutlinedButton.icon(
          onPressed: () => unawaited(_copy(context)),
          icon: const Icon(Icons.link_rounded),
          label: const Text('Copy link'),
          style: OutlinedButton.styleFrom(
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(54),
            side: const BorderSide(color: AppColors.cyan),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            textStyle: Theme.of(context).textTheme.labelLarge
                ?.copyWith(fontSize: 16, fontWeight: FontWeight.w700),
          ),
        ),
        const SizedBox(height: 14),
        const InlineMessage(
          tone: InlineMessageTone.info,
          message:
              'They can preview your family, then request to join. You '
              'approve every request.',
        ),
        const SizedBox(height: 10),
        TextButton.icon(
          onPressed: () => unawaited(_rotate(context, ref)),
          icon: const Icon(Icons.autorenew_rounded),
          label: const Text('Generate a new code'),
          style: TextButton.styleFrom(foregroundColor: AppColors.cyan),
        ),
        const Text(
          'The current code will stop working.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.slate, fontSize: 13),
        ),
      ],
    );
  }
}
