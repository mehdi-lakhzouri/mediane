import 'dart:async';

import 'package:driver_health_app/core/presentation/widgets/cabinguard_text_field.dart';
import 'package:driver_health_app/core/presentation/widgets/confirm_dialog.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/family/application/my_family_controller.dart';
import 'package:driver_health_app/features/family/domain/entities/family.dart';
import 'package:driver_health_app/features/family/presentation/family_actions.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Family settings behind the gear on screen 19: rename and dissolve
/// (owner), and leave (everyone).
Future<void> showFamilySettingsSheet(BuildContext context, Family family) {
  return showModalBottomSheet<void>(
    context: context,
    showDragHandle: true,
    backgroundColor: AppColors.navy900,
    builder: (_) => _FamilySettingsSheet(family: family, hostContext: context),
  );
}

class _FamilySettingsSheet extends ConsumerWidget {
  const new({required this.family, required this.hostContext});

  final Family family;

  /// The screen behind the sheet, which outlives it for snackbars.
  final BuildContext hostContext;

  MyFamilyController _controller(WidgetRef ref) =>
      ref.read(myFamilyControllerProvider.notifier);

  Future<void> _rename(BuildContext context, WidgetRef ref) async {
    // The sheet closes first; keep the controller, not its disposed ref.
    final controller = _controller(ref);
    Navigator.of(context).pop();
    final name = await showDialog<String>(
      context: hostContext,
      builder: (_) => _RenameDialog(initial: family.name),
    );
    if (name == null || name == family.name || !hostContext.mounted) return;
    await runFamilyAction(
      hostContext,
      () => controller.rename(name),
      successMessage: 'Family renamed.',
    );
  }

  Future<void> _leave(BuildContext context, WidgetRef ref) async {
    // The sheet closes first; keep the controller, not its disposed ref.
    final controller = _controller(ref);
    Navigator.of(context).pop();
    final alone = family.members.length == 1;
    final confirmed = await showConfirmDialog(
      hostContext,
      title: 'Leave ${family.name}?',
      message: alone
          ? 'You are the only member, so the family will be dissolved.'
          : family.isOwner
          ? 'Ownership passes to the longest-standing member. You can join '
                'again later with a new code.'
          : 'Your family will no longer see you or what you share.',
      confirmLabel: 'Leave family',
    );
    if (!confirmed || !hostContext.mounted) return;
    await runFamilyAction(
      hostContext,
      controller.leave,
      successMessage: 'You left the family.',
    );
  }

  Future<void> _dissolve(BuildContext context, WidgetRef ref) async {
    // The sheet closes first; keep the controller, not its disposed ref.
    final controller = _controller(ref);
    Navigator.of(context).pop();
    final confirmed = await showConfirmDialog(
      hostContext,
      title: 'Dissolve ${family.name}?',
      message:
          'Every member leaves and the family is deleted. This cannot be '
          'undone.',
      confirmLabel: 'Dissolve family',
    );
    if (!confirmed || !hostContext.mounted) return;
    await runFamilyAction(
      hostContext,
      controller.dissolve,
      successMessage: 'The family was dissolved.',
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SafeArea(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (family.isOwner)
            ListTile(
              leading: const Icon(Icons.edit_outlined, color: AppColors.cyan),
              title: const Text(
                'Rename family',
                style: TextStyle(color: Colors.white),
              ),
              onTap: () => unawaited(_rename(context, ref)),
            ),
          ListTile(
            leading: const Icon(Icons.logout_rounded, color: AppColors.coral),
            title: const Text(
              'Leave family',
              style: TextStyle(color: AppColors.coral),
            ),
            onTap: () => unawaited(_leave(context, ref)),
          ),
          if (family.isOwner && family.members.length > 1)
            ListTile(
              leading: const Icon(
                Icons.delete_forever_outlined,
                color: AppColors.coral,
              ),
              title: const Text(
                'Dissolve family',
                style: TextStyle(color: AppColors.coral),
              ),
              onTap: () => unawaited(_dissolve(context, ref)),
            ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _RenameDialog extends StatefulWidget {
  const new({required this.initial});

  final String initial;

  @override
  State<_RenameDialog> createState() => _RenameDialogState();
}

class _RenameDialogState extends State<_RenameDialog> {
  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _save() {
    if (_formKey.currentState?.validate() ?? false) {
      Navigator.of(context).pop(_name.text.trim());
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: AppColors.navy900,
      title: const Text('Rename family'),
      content: Form(
        key: _formKey,
        child: CabinGuardTextField(
          label: 'Family name',
          controller: _name,
          textCapitalization: TextCapitalization.words,
          textInputAction: TextInputAction.done,
          onFieldSubmitted: (_) => _save(),
          validator: (value) {
            final name = value?.trim() ?? '';
            if (name.isEmpty) return 'Give your family a name.';
            if (name.length > 80) return 'Use 80 characters or fewer.';
            return null;
          },
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        TextButton(onPressed: _save, child: const Text('Save')),
      ],
    );
  }
}
