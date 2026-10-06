import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/presentation/widgets/confirm_dialog.dart';
import 'package:driver_health_app/core/presentation/widgets/content_page.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/family/application/my_family_controller.dart';
import 'package:driver_health_app/features/family/domain/entities/family.dart';
import 'package:driver_health_app/features/family/presentation/family_messages.dart';
import 'package:driver_health_app/features/family/presentation/widgets/role_chip.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

/// Screen 22: the driver's request, waiting for the owner.
class RequestPendingView extends ConsumerStatefulWidget {
  const new({required this.request, super.key});

  final PendingJoinRequest request;

  @override
  ConsumerState<RequestPendingView> createState() => _RequestPendingViewState();
}

class _RequestPendingViewState extends ConsumerState<RequestPendingView> {
  static const _amber = Color(0xFFFFC857);
  bool _withdrawing = false;

  Future<void> _withdraw() async {
    final confirmed = await showConfirmDialog(
      context,
      title: 'Withdraw your request?',
      message:
          'The owner of ${widget.request.familyName} will no longer see it. '
          'You can ask again later with the same code.',
      confirmLabel: 'Withdraw',
    );
    if (!confirmed || !mounted) return;
    setState(() => _withdrawing = true);
    final failure = await ref
        .read(myFamilyControllerProvider.notifier)
        .cancelJoinRequest();
    if (!mounted) return;
    setState(() => _withdrawing = false);
    if (failure != null) {
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(familyFailureMessage(failure))));
    }
  }

  @override
  Widget build(BuildContext context) {
    final request = widget.request;
    return ContentPage(
      title: 'Request sent',
      subtitle: 'The family owner will review your request.',
      backgroundAlignment: const Alignment(-0.2, -0.3),
      onRefresh: () => ref.read(myFamilyControllerProvider.notifier).refresh(),
      children: [
        SurfaceCard(
          child: Row(
            children: [
              const Icon(
                Icons.home_work_outlined,
                color: AppColors.cyan,
                size: 36,
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Text(
                  request.familyName,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const RoleChip('Pending', color: _amber),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const _Step(label: 'Invitation code verified', done: true),
        const _Step(label: 'Request sent', done: true),
        const _Step(label: 'Waiting for owner approval', done: false),
        const SizedBox(height: 16),
        SurfaceCard(
          child: Row(
            children: [
              const Icon(Icons.schedule_rounded, color: AppColors.slate),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  'Your request expires on '
                  '${DateFormat.yMMMd().format(request.expiresAt.toLocal())}.',
                  style: const TextStyle(color: AppColors.ice),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        OutlinedButton(
          onPressed: _withdrawing ? null : () => unawaited(_withdraw()),
          style: OutlinedButton.styleFrom(
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(54),
            side: BorderSide(color: AppColors.slate.withValues(alpha: 0.5)),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
          ),
          child: _withdrawing
              ? const SizedBox.square(
                  dimension: 22,
                  child: CircularProgressIndicator(strokeWidth: 2.5),
                )
              : const Text('Withdraw request'),
        ),
        const SizedBox(height: 10),
        TextButton(
          onPressed: () => context.go(AppRoutes.home),
          child: const Text(
            'Back to home',
            style: TextStyle(color: AppColors.cyan),
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Pull down to check for an answer.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.slate, fontSize: 13),
        ),
      ],
    );
  }
}

class _Step extends StatelessWidget {
  const new({required this.label, required this.done});

  final String label;
  final bool done;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: '$label, ${done ? 'done' : 'in progress'}',
      excludeSemantics: true,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 6),
        child: Row(
          children: [
            Icon(
              done ? Icons.check_circle_rounded : Icons.radio_button_checked,
              color: done ? AppColors.mint : AppColors.cyan,
              size: 28,
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: done ? FontWeight.w500 : FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
