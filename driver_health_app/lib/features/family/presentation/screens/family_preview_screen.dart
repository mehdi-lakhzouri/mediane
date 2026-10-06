import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/content_page.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/family/application/family_providers.dart';
import 'package:driver_health_app/features/family/application/my_family_controller.dart';
import 'package:driver_health_app/features/family/domain/entities/family_invite.dart';
import 'package:driver_health_app/features/family/domain/family_code.dart';
import 'package:driver_health_app/features/family/presentation/family_messages.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Screens 10 and 11 adapted to the join-code model: see which family a code
/// belongs to, then ask to join or step back. Nothing is shared until the
/// owner approves, and then only name and photo by default.
class FamilyPreviewScreen extends ConsumerStatefulWidget {
  const new({required this.code, super.key});

  final String code;

  @override
  ConsumerState<FamilyPreviewScreen> createState() =>
      _FamilyPreviewScreenState();
}

class _FamilyPreviewScreenState extends ConsumerState<FamilyPreviewScreen> {
  bool _requesting = false;
  ApiFailure? _failure;

  String? get _code => FamilyCode.extract(widget.code);

  void _close() =>
      context.canPop() ? context.pop() : context.go(AppRoutes.family);

  Future<void> _request(String code) async {
    setState(() {
      _requesting = true;
      _failure = null;
    });
    final failure = await ref
        .read(myFamilyControllerProvider.notifier)
        .requestToJoin(code);
    if (!mounted) return;
    if (failure == null) {
      context.go(AppRoutes.family);
      return;
    }
    setState(() {
      _requesting = false;
      _failure = failure;
    });
  }

  @override
  Widget build(BuildContext context) {
    final code = _code;
    final mine = ref.watch(myFamilyControllerProvider).value;
    final alreadyEngaged = mine?.family != null || mine?.pendingRequest != null;

    return ContentPage(
      title: 'Family invitation',
      subtitle: code == null ? null : 'Code $code',
      onBack: _close,
      backgroundAlignment: const Alignment(-0.3, -0.4),
      children: [
        if (code == null)
          const InlineMessage(
            message:
                'This invitation link is incomplete. Ask the family owner to '
                'share it again.',
          )
        else
          switch (ref.watch(invitePreviewProvider(code))) {
            AsyncData(:final value) => _Preview(
              preview: value,
              requesting: _requesting,
              failure: _failure,
              blockedReason: alreadyEngaged
                  ? mine?.family != null
                        ? 'You’re already part of a family. Leave it before '
                              'joining another.'
                        : 'You already have a request waiting. Withdraw it '
                              'to ask this family instead.'
                  : null,
              onRequest: () => unawaited(_request(code)),
              onCancel: _close,
            ),
            AsyncError(:final error) => Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                InlineMessage(
                  message: familyFailureMessage(ApiFailure.from(error)),
                ),
                const SizedBox(height: 16),
                GradientButton(label: 'Try another code', onPressed: _close),
              ],
            ),
            _ => const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(
                child: CircularProgressIndicator(
                  color: AppColors.cyan,
                  semanticsLabel: 'Checking the code',
                ),
              ),
            ),
          },
      ],
    );
  }
}

class _Preview extends StatelessWidget {
  const new({
    required this.preview,
    required this.requesting,
    required this.failure,
    required this.blockedReason,
    required this.onRequest,
    required this.onCancel,
  });

  final FamilyInvitePreview preview;
  final bool requesting;
  final ApiFailure? failure;
  final String? blockedReason;
  final VoidCallback onRequest;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    final owner = preview.ownerFirstName;
    final reason =
        blockedReason ??
        (preview.full
            ? 'This family is full. The owner needs to free a place first.'
            : null);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SurfaceCard(
          highlighted: true,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Icon(Icons.groups_rounded, color: AppColors.cyan, size: 40),
              const SizedBox(height: 12),
              Semantics(
                header: true,
                child: Text(
                  preview.familyName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 24,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              if (owner != null) ...[
                const SizedBox(height: 4),
                Text(
                  'Owned by $owner',
                  style: const TextStyle(color: AppColors.ice),
                ),
              ],
              const SizedBox(height: 4),
              Text(
                '${preview.memberCount} of ${preview.maxMembers} members',
                style: const TextStyle(color: AppColors.slate),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const InlineMessage(
          tone: InlineMessageTone.info,
          message:
              'The owner approves every request. Once you join, your family '
              'sees your name and photo; anything more is your choice in '
              'Family sharing.',
        ),
        if (failure case final failure?) ...[
          const SizedBox(height: 12),
          InlineMessage(message: familyFailureMessage(failure)),
        ],
        if (reason != null) ...[
          const SizedBox(height: 12),
          InlineMessage(message: reason),
        ],
        const SizedBox(height: 20),
        GradientButton(
          label: 'Request to join',
          loading: requesting,
          onPressed: reason == null ? onRequest : null,
        ),
        const SizedBox(height: 8),
        TextButton(
          onPressed: requesting ? null : onCancel,
          child: const Text('Not now', style: TextStyle(color: AppColors.cyan)),
        ),
      ],
    );
  }
}
