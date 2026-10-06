import 'dart:async';

import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/step_indicator.dart';
import 'package:driver_health_app/core/state/data_changes.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';
import 'package:driver_health_app/features/driver_profile/presentation/controllers/profile_providers.dart';
import 'package:driver_health_app/features/driver_profile/presentation/controllers/profile_setup_controller.dart';
import 'package:driver_health_app/features/driver_profile/presentation/widgets/contact_editor_sheet.dart';
import 'package:driver_health_app/features/startup/domain/entities/mobile_bootstrap.dart';
import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Screen 15, step 2 of 2: who CabinGuard calls, in priority order.
class EmergencyContactsScreen extends ConsumerWidget {
  const new({this.editing = false, super.key});

  /// Editing an active driver's contacts instead of onboarding step 2.
  final bool editing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final setup = ref.watch(profileSetupControllerProvider).value;
    final rules = ref.watch(profileRulesProvider).value;

    return AuthPanelLayout(
      onBack: () => context.pop(),
      backgroundAlignment: const Alignment(0, -0.2),
      child: setup == null || rules == null
          ? const Padding(
              padding: EdgeInsets.symmetric(vertical: 64),
              child: Center(
                child: CircularProgressIndicator(color: AppColors.cyan),
              ),
            )
          : _ContactsBody(state: setup, rules: rules, editing: editing),
    );
  }
}

class _ContactsBody extends ConsumerWidget {
  const new({required this.state, required this.rules, required this.editing});

  final bool editing;

  final ProfileSetupState state;
  final ProfileRules rules;

  ProfileSetupController _controller(WidgetRef ref) =>
      ref.read(profileSetupControllerProvider.notifier);

  Future<void> _edit(BuildContext context, WidgetRef ref, [int? index]) async {
    final contacts = state.contacts;
    final contact = await showContactEditor(
      context,
      initial: index == null ? null : contacts[index],
      driverPhone: state.phoneNumber,
      otherPhones: [
        for (var i = 0; i < contacts.length; i++)
          if (i != index) contacts[i].phoneNumber,
      ],
    );
    if (contact != null) {
      await _controller(ref).saveContact(contact, index: index);
    }
  }

  Future<void> _remove(BuildContext context, WidgetRef ref, int index) async {
    final contact = state.contacts[index];
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.navy900,
        title: const Text('Remove contact?'),
        content: Text(
          '${contact.fullName} will no longer be called after an incident.',
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
    if (confirmed ?? false) await _controller(ref).removeContact(index);
  }

  Future<void> _save(BuildContext context, WidgetRef ref) async {
    final saved = await _controller(ref).submit();
    // During onboarding the router moves on from the returned account state.
    if (!saved || !editing || !context.mounted) return;
    ref.read(dataChangesProvider.notifier).markChanged();
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Emergency contacts saved.')));
    context.pop();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contacts = state.contacts;
    final errors = state.fieldErrors;
    final canAdd = contacts.length < rules.maxEmergencyContacts;
    final enoughContacts = contacts.length >= rules.minEmergencyContacts;
    final failure = state.failure;
    final generalError = _generalError(failure, errors);
    // Editing only asks again when the list itself changed.
    final needsConsent = !editing || state.contactsChanged;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (!editing) ...[
          const StepIndicator(step: 2, total: 2),
          const SizedBox(height: 18),
        ],
        Semantics(
          header: true,
          child: const Text(
            'Emergency contacts',
            style: TextStyle(
              color: Colors.white,
              fontSize: 30,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.6,
            ),
          ),
        ),
        const SizedBox(height: 8),
        const Text(
          'Choose who CabinGuard should call first after an incident.',
          style: TextStyle(color: AppColors.ice, fontSize: 16, height: 1.4),
        ),
        const SizedBox(height: 16),
        InlineMessage(
          tone: InlineMessageTone.info,
          message:
              'Add at least ${rules.minEmergencyContacts} contact '
              '(up to ${rules.maxEmergencyContacts}). The order is the call '
              'priority: drag a card, or use the move actions, to change it.',
        ),
        if (generalError != null) ...[
          const SizedBox(height: 12),
          InlineMessage(message: generalError),
        ],
        const SizedBox(height: 14),
        ReorderableListView.builder(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          buildDefaultDragHandles: false,
          itemCount: contacts.length,
          onReorderItem: (from, to) =>
              unawaited(_controller(ref).moveContact(from, to)),
          proxyDecorator: (child, _, _) =>
              Material(color: Colors.transparent, child: child),
          itemBuilder: (context, index) => _ContactCard(
            key: ValueKey('${contacts[index].phoneNumber}-$index'),
            index: index,
            count: contacts.length,
            contact: contacts[index],
            error: errors['emergencyContacts.$index.phoneNumber'],
            onEdit: () => unawaited(_edit(context, ref, index)),
            onRemove: () => unawaited(_remove(context, ref, index)),
            onMove: (to) => unawaited(_controller(ref).moveContact(index, to)),
          ),
        ),
        const SizedBox(height: 4),
        OutlinedButton.icon(
          onPressed: canAdd && !state.submitting
              ? () => unawaited(_edit(context, ref))
              : null,
          icon: const Icon(Icons.add_rounded),
          label: Text(
            canAdd
                ? 'Add emergency contact'
                : 'Maximum of ${_contactCount(rules.maxEmergencyContacts)} '
                      'reached',
          ),
          style: OutlinedButton.styleFrom(
            foregroundColor: AppColors.cyan,
            disabledForegroundColor: AppColors.slate,
            minimumSize: const Size.fromHeight(56),
            side: BorderSide(color: canAdd ? AppColors.cyan : AppColors.slate),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(18),
            ),
            textStyle: Theme.of(context).textTheme.labelLarge
                ?.copyWith(fontSize: 17, fontWeight: FontWeight.w700),
          ),
        ),
        const SizedBox(height: 16),
        if (needsConsent)
          MergeSemantics(
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Checkbox(
                  value: state.contactsConsent,
                  activeColor: AppColors.cobalt,
                  side: const BorderSide(color: AppColors.slate),
                  onChanged: state.submitting
                      ? null
                      : (value) =>
                            _controller(ref)
                                .setConsent(accepted: value ?? false),
                ),
                Expanded(
                  child: GestureDetector(
                    onTap: state.submitting
                        ? null
                        : () =>
                              _controller(ref)
                                  .setConsent(accepted: !state.contactsConsent),
                    child: const Padding(
                      padding: EdgeInsets.only(top: 12),
                      child: Text(
                        'I confirm these contacts agreed to be reached by '
                        'CabinGuard in an emergency.',
                        style: TextStyle(color: AppColors.ice, height: 1.4),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 18),
        GradientButton(
          label: editing ? 'Save contacts' : 'Finish setup',
          loading: state.submitting,
          onPressed:
              enoughContacts &&
                  (!needsConsent || state.contactsConsent) &&
                  (!editing || state.contactsChanged)
              ? () => unawaited(_save(context, ref))
              : null,
        ),
      ],
    );
  }

  static String _contactCount(int count) =>
      count == 1 ? '1 contact' : '$count contacts';

  /// Errors that are not shown on a contact card.
  static String? _generalError(
    ApiFailure? failure,
    Map<String, String> errors,
  ) {
    if (failure == null) return null;
    if (errors.containsKey('phoneNumber') ||
        errors.containsKey('dateOfBirth')) {
      return 'Some profile details need attention. Go back to step 1 to '
          'review them.';
    }
    final cardErrors = errors.keys.where(
      (key) => RegExp(r'^emergencyContacts\.\d+\.').hasMatch(key),
    );
    if (cardErrors.isNotEmpty && cardErrors.length == errors.length) {
      return null;
    }
    return switch (failure.kind) {
      ApiFailureKind.rateLimited =>
        'Too many attempts. Wait a few minutes and try again.',
      ApiFailureKind.server || ApiFailureKind.protocol =>
        'Your profile couldn’t be saved right now. Your answers are kept; '
            'try again shortly.',
      _ => failure.message,
    };
  }
}

class _ContactCard extends StatelessWidget {
  const new({
    required this.index,
    required this.count,
    required this.contact,
    required this.error,
    required this.onEdit,
    required this.onRemove,
    required this.onMove,
    super.key,
  });

  final int index;
  final int count;
  final EmergencyContact contact;
  final String? error;
  final VoidCallback onEdit;
  final VoidCallback onRemove;
  final ValueChanged<int> onMove;

  @override
  Widget build(BuildContext context) {
    final first = index == 0;
    return Semantics(
      container: true,
      label:
          'Priority ${index + 1}${first ? ', first to call' : ''}. '
          '${contact.fullName}, ${contact.relationship.label}, '
          '${contact.phoneNumber}',
      customSemanticsActions: {
        if (index > 0)
          const CustomSemanticsAction(label: 'Move up'): () =>
              onMove(index - 1),
        if (index < count - 1)
          const CustomSemanticsAction(label: 'Move down'): () =>
              onMove(index + 1),
      },
      child: Padding(
        padding: const EdgeInsets.only(bottom: 12),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: AppColors.navy800.withValues(alpha: 0.55),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: error != null
                  ? AppColors.coral
                  : AppColors.cyan.withValues(alpha: first ? 0.55 : 0.25),
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(4, 12, 10, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    ReorderableDragStartListener(
                      index: index,
                      child: const Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 8,
                        ),
                        child: ExcludeSemantics(
                          child: Icon(
                            Icons.drag_indicator_rounded,
                            color: AppColors.slate,
                          ),
                        ),
                      ),
                    ),
                    ExcludeSemantics(
                      child: CircleAvatar(
                        radius: 21,
                        backgroundColor: AppColors.navy950,
                        child: Text(
                          contact.initials,
                          style: const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: ExcludeSemantics(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _PriorityBadge(position: index + 1),
                            const SizedBox(height: 4),
                            Text(
                              contact.fullName,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            Text(
                              contact.relationship.label,
                              style: const TextStyle(color: AppColors.slate),
                            ),
                            Text(
                              contact.phoneNumber,
                              style: const TextStyle(color: AppColors.slate),
                            ),
                          ],
                        ),
                      ),
                    ),
                    Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        IconButton(
                          tooltip: 'Edit ${contact.fullName}',
                          onPressed: onEdit,
                          color: AppColors.ice,
                          icon: const Icon(Icons.edit_outlined),
                        ),
                        IconButton(
                          tooltip: 'Remove ${contact.fullName}',
                          onPressed: onRemove,
                          color: AppColors.coral,
                          icon: const Icon(Icons.delete_outline_rounded),
                        ),
                      ],
                    ),
                  ],
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.fromLTRB(12, 8, 0, 0),
                    child: Text(
                      'This number ${error!.replaceAll(RegExp(r'\.$'), '')}.',
                      style: const TextStyle(
                        color: AppColors.coral,
                        fontSize: 13,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _PriorityBadge extends StatelessWidget {
  const new({required this.position});

  final int position;

  @override
  Widget build(BuildContext context) {
    final first = position == 1;
    return DecoratedBox(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: first ? AppColors.cyan : AppColors.slate),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
        child: Text(
          first ? '1 · First to call' : '$position',
          maxLines: 1,
          softWrap: false,
          overflow: TextOverflow.fade,
          style: TextStyle(
            color: first ? Colors.white : AppColors.ice,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
    );
  }
}
