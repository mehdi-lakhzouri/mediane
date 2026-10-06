import 'dart:async';

import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/state/data_changes.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/driver_profile/data/data_sources/avatar_picker.dart';
import 'package:driver_health_app/features/driver_profile/presentation/controllers/profile_photo_controller.dart';
import 'package:driver_health_app/features/driver_profile/presentation/controllers/profile_providers.dart';
import 'package:driver_health_app/features/driver_profile/presentation/controllers/profile_setup_controller.dart';
import 'package:driver_health_app/features/driver_profile/presentation/widgets/profile_avatar_view.dart';
import 'package:driver_health_app/features/startup/domain/entities/mobile_bootstrap.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:permission_handler/permission_handler.dart';

/// Screen 16: optional profile photo, from the camera or the library.
class ProfilePhotoScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rules = ref.watch(profileRulesProvider);
    return AuthPanelLayout(
      onBack: () => context.pop(),
      backgroundAlignment: const Alignment(0.4, -0.2),
      child: switch (rules) {
        AsyncData(:final value) => _PhotoBody(rules: value),
        AsyncError(:final error) => InlineMessage(
          message: ApiFailure.from(error).message,
        ),
        _ => const Padding(
          padding: EdgeInsets.symmetric(vertical: 64),
          child: Center(
            child: CircularProgressIndicator(color: AppColors.cyan),
          ),
        ),
      },
    );
  }
}

class _PhotoBody extends ConsumerWidget {
  const new({required this.rules});

  final ProfileRules rules;

  Future<void> _save(BuildContext context, WidgetRef ref) async {
    final saved = await ref
        .read(profilePhotoControllerProvider.notifier)
        .upload();
    if (saved && context.mounted) {
      ref.read(dataChangesProvider.notifier).markChanged();
      ScaffoldMessenger.of(context)
          .showSnackBar(const SnackBar(content: Text('Profile photo saved.')));
      context.pop();
    }
  }

  Future<void> _remove(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.navy900,
        title: const Text('Remove your photo?'),
        content: const Text(
          'Your family will see your initials instead of a photo.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text(
              'Remove',
              style: TextStyle(color: AppColors.coral),
            ),
          ),
        ],
      ),
    );
    if (confirmed ?? false) {
      final removed = await ref
          .read(profilePhotoControllerProvider.notifier)
          .remove();
      if (removed) ref.read(dataChangesProvider.notifier).markChanged();
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(profilePhotoControllerProvider);
    final avatar = ref.watch(
      profileSetupControllerProvider.select((value) => value.value?.avatar),
    );
    final controller = ref.read(profilePhotoControllerProvider.notifier);
    final megabytes = (rules.avatarMaxBytes / (1024 * 1024)).round();
    final side = rules.avatarMinSidePx;
    final failure = state.failure;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Semantics(
          header: true,
          child: const Text(
            'Profile photo',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 30,
              fontWeight: FontWeight.w900,
            ),
          ),
        ),
        const SizedBox(height: 6),
        const Text(
          'Help your family recognize you quickly.',
          textAlign: TextAlign.center,
          style: TextStyle(color: AppColors.ice, fontSize: 16),
        ),
        const SizedBox(height: 22),
        Center(
          child: Semantics(
            image: true,
            label: state.picked != null
                ? 'New photo, not saved yet'
                : avatar != null
                ? 'Current profile photo'
                : 'No profile photo',
            excludeSemantics: true,
            child: ProfileAvatarView(
              size: 180,
              avatar: avatar,
              preview: state.previewBytes,
              showBadge: false,
            ),
          ),
        ),
        const SizedBox(height: 22),
        if (state.problem case final problem?) ...[
          InlineMessage(message: problem),
          if (state.permissionDenied)
            TextButton(
              onPressed: () => unawaited(openAppSettings()),
              child: const Text(
                'Open Settings',
                style: TextStyle(color: AppColors.cyan),
              ),
            ),
          const SizedBox(height: 12),
        ],
        if (failure != null) ...[
          InlineMessage(message: _messageFor(failure)),
          const SizedBox(height: 12),
        ],
        _SourceButton(
          icon: Icons.photo_camera_outlined,
          label: 'Take a photo',
          highlighted: true,
          onPressed: state.busy
              ? null
              : () => unawaited(controller.pick(AvatarSource.camera, rules)),
        ),
        const SizedBox(height: 12),
        _SourceButton(
          icon: Icons.photo_library_outlined,
          label: 'Choose from library',
          onPressed: state.busy
              ? null
              : () => unawaited(controller.pick(AvatarSource.library, rules)),
        ),
        const SizedBox(height: 16),
        DecoratedBox(
          decoration: BoxDecoration(
            color: AppColors.navy950.withValues(alpha: 0.38),
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: AppColors.slate.withValues(alpha: 0.3)),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const _Requirement('JPEG, PNG or WebP'),
                _Requirement('At least $side × $side px'),
                _Requirement('Maximum $megabytes MB'),
                const _Requirement('Location data is removed automatically'),
              ],
            ),
          ),
        ),
        if (avatar != null && state.picked == null) ...[
          const SizedBox(height: 8),
          TextButton.icon(
            onPressed: state.busy
                ? null
                : () => unawaited(_remove(context, ref)),
            icon: state.removing
                ? const SizedBox.square(
                    dimension: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.delete_outline_rounded),
            label: const Text('Remove current photo'),
            style: TextButton.styleFrom(foregroundColor: AppColors.coral),
          ),
        ],
        const SizedBox(height: 10),
        const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.photo_camera_outlined, color: AppColors.slate, size: 18),
            SizedBox(width: 8),
            Flexible(
              child: Text(
                'Camera access is used only when you take a profile photo.',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.slate, fontSize: 13),
              ),
            ),
          ],
        ),
        const SizedBox(height: 18),
        if (state.uploading) ...[
          Semantics(
            label: 'Uploading photo',
            value: '${(state.progress * 100).round()} percent',
            child: LinearProgressIndicator(
              value: state.progress,
              color: AppColors.cyan,
              backgroundColor: AppColors.slate.withValues(alpha: 0.2),
              minHeight: 6,
              borderRadius: BorderRadius.circular(99),
            ),
          ),
          const SizedBox(height: 12),
        ],
        GradientButton(
          label: failure != null && state.picked != null
              ? 'Retry upload'
              : 'Save photo',
          loading: state.uploading,
          onPressed: state.picked == null
              ? null
              : () => unawaited(_save(context, ref)),
        ),
      ],
    );
  }

  static String _messageFor(ApiFailure failure) => switch (failure.kind) {
    ApiFailureKind.rateLimited =>
      'Too many uploads. Wait a few minutes and try again.',
    ApiFailureKind.server || ApiFailureKind.protocol =>
      'Your photo couldn’t be saved right now. Try again shortly.',
    _ when failure.statusCode == 413 =>
      'That photo is too large. Choose a smaller one.',
    _ => failure.message,
  };
}

class _SourceButton extends StatelessWidget {
  const new({
    required this.icon,
    required this.label,
    required this.onPressed,
    this.highlighted = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onPressed;
  final bool highlighted;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 26),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: highlighted ? AppColors.cyan : Colors.white,
        backgroundColor: AppColors.navy950.withValues(alpha: 0.35),
        minimumSize: const Size.fromHeight(58),
        side: BorderSide(
          color: highlighted
              ? AppColors.cyan
              : AppColors.slate.withValues(alpha: 0.4),
          width: highlighted ? 1.5 : 1,
        ),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(29)),
        textStyle: Theme.of(context).textTheme.labelLarge
            ?.copyWith(fontSize: 17, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _Requirement extends StatelessWidget {
  const new(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          const Icon(Icons.check_rounded, color: AppColors.mint, size: 20),
          const SizedBox(width: 10),
          Expanded(
            child: Text(label, style: const TextStyle(color: AppColors.ice)),
          ),
        ],
      ),
    );
  }
}
