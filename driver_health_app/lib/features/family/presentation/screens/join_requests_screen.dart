import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/confirm_dialog.dart';
import 'package:driver_health_app/core/presentation/widgets/content_page.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/family/application/join_requests_controller.dart';
import 'package:driver_health_app/features/family/application/my_family_controller.dart';
import 'package:driver_health_app/features/family/domain/entities/family_invite.dart';
import 'package:driver_health_app/features/family/presentation/family_actions.dart';
import 'package:driver_health_app/features/family/presentation/family_messages.dart';
import 'package:driver_health_app/features/family/presentation/widgets/member_avatar.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Screen 23: the owner approves or declines each request.
class JoinRequestsScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requests = ref.watch(joinRequestsControllerProvider);
    final family = ref.watch(myFamilyControllerProvider).value?.family;

    return ContentPage(
      entranceKey: requests.hasValue,
      title: 'Join requests',
      subtitle: family == null ? null : 'Review who can join ${family.name}.',
      onBack: () =>
          context.canPop() ? context.pop() : context.go(AppRoutes.family),
      backgroundAlignment: const Alignment(0.2, -0.4),
      onRefresh: () => ref.refresh(joinRequestsControllerProvider.future),
      children: [
        switch (requests) {
          AsyncData(:final value) when value.isEmpty => const _Empty(),
          AsyncData(:final value) => Column(
            children: [
              for (final request in value) ...[
                _RequestCard(
                  key: ValueKey(request.id),
                  request: request,
                  familyFull: family?.isFull ?? false,
                ),
                const SizedBox(height: 12),
              ],
            ],
          ),
          AsyncError(:final error) => InlineMessage(
            message: familyFailureMessage(ApiFailure.from(error)),
          ),
          _ => const Padding(
            padding: EdgeInsets.symmetric(vertical: 48),
            child: Center(
              child: CircularProgressIndicator(color: AppColors.cyan),
            ),
          ),
        },
        const SizedBox(height: 8),
        const InlineMessage(
          tone: InlineMessageTone.info,
          icon: Icons.verified_user_outlined,
          message: 'Only approve people you recognize.',
        ),
        if (family != null) ...[
          const SizedBox(height: 12),
          Text(
            'Family capacity: ${family.members.length} of '
            '${family.maxMembers} members',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.slate),
          ),
        ],
      ],
    );
  }
}

class _Empty extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    return SurfaceCard(
      child: Column(
        children: [
          const Icon(Icons.inbox_outlined, color: AppColors.slate, size: 40),
          const SizedBox(height: 10),
          const Text(
            'No requests waiting',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Share your family code and requests will appear here.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.slate),
          ),
          TextButton(
            onPressed: () => unawaited(context.push(AppRoutes.familyInvite)),
            child: const Text(
              'Share family code',
              style: TextStyle(color: AppColors.cyan),
            ),
          ),
        ],
      ),
    );
  }
}

class _RequestCard extends ConsumerStatefulWidget {
  const new({required this.request, required this.familyFull, super.key});

  final IncomingJoinRequest request;
  final bool familyFull;

  @override
  ConsumerState<_RequestCard> createState() => _RequestCardState();
}

class _RequestCardState extends ConsumerState<_RequestCard> {
  bool _busy = false;

  JoinRequestsController get _controller =>
      ref.read(joinRequestsControllerProvider.notifier);

  Future<void> _approve() async {
    setState(() => _busy = true);
    await runFamilyAction(
      context,
      () => _controller.approve(widget.request.id),
      successMessage: '${widget.request.firstName} joined your family.',
    );
    if (mounted) setState(() => _busy = false);
  }

  Future<void> _decline() async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Decline ${widget.request.firstName}?',
      message: 'They can ask again later with a valid code.',
      confirmLabel: 'Decline',
    );
    if (!confirmed || !mounted) return;
    setState(() => _busy = true);
    await runFamilyAction(
      context,
      () => _controller.reject(widget.request.id),
      successMessage: 'Request declined.',
    );
    if (mounted) setState(() => _busy = false);
  }

  static String _ago(DateTime value) {
    final elapsed = DateTime.now().difference(value);
    if (elapsed.inMinutes < 1) return 'just now';
    if (elapsed.inHours < 1) return '${elapsed.inMinutes} min ago';
    if (elapsed.inDays < 1) return '${elapsed.inHours} h ago';
    return elapsed.inDays == 1 ? 'yesterday' : '${elapsed.inDays} days ago';
  }

  static String _expiresIn(DateTime value) {
    final days = value.difference(DateTime.now()).inDays;
    return days <= 0
        ? 'Expires today'
        : 'Expires in $days ${days == 1 ? 'day' : 'days'}';
  }

  @override
  Widget build(BuildContext context) {
    final request = widget.request;
    final initials =
        '${request.firstName.isEmpty ? '' : request.firstName[0]}'
                '${request.lastName.isEmpty ? '' : request.lastName[0]}'
            .toUpperCase();
    return SurfaceCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              MemberAvatar(
                initials: initials,
                avatar: request.avatar,
                size: 64,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      request.fullName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      'Requested ${_ago(request.createdAt)}',
                      style: const TextStyle(color: AppColors.slate),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(
                          Icons.schedule_rounded,
                          color: AppColors.cyan,
                          size: 16,
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            _expiresIn(request.expiresAt),
                            style: const TextStyle(color: AppColors.cyan),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _busy ? null : () => unawaited(_decline()),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.coral,
                    minimumSize: const Size.fromHeight(58),
                    side: const BorderSide(color: AppColors.coral),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                    ),
                  ),
                  child: const Text('Decline'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: GradientButton(
                  label: 'Approve',
                  loading: _busy,
                  onPressed: widget.familyFull
                      ? null
                      : () => unawaited(_approve()),
                ),
              ),
            ],
          ),
          if (widget.familyFull) ...[
            const SizedBox(height: 8),
            const Text(
              'Your family is full. Remove a member to approve.',
              style: TextStyle(color: AppColors.slate, fontSize: 13),
            ),
          ],
        ],
      ),
    );
  }
}
