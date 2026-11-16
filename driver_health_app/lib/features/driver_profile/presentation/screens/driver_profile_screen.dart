import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/auth_panel_layout.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/phone_number_field.dart';
import 'package:driver_health_app/core/presentation/widgets/step_indicator.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/core/state/data_changes.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';
import 'package:driver_health_app/features/driver_profile/presentation/controllers/profile_providers.dart';
import 'package:driver_health_app/features/driver_profile/presentation/controllers/profile_setup_controller.dart';
import 'package:driver_health_app/features/driver_profile/presentation/widgets/profile_avatar_view.dart';
import 'package:driver_health_app/features/startup/domain/entities/mobile_bootstrap.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

/// Screen 14, step 1 of 2: details Mediane needs during an incident.
/// With [editing], the same form updates an active driver's details.
class DriverProfileScreen extends ConsumerWidget {
  const new({this.editing = false, super.key});

  final bool editing;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final setup = ref.watch(profileSetupControllerProvider);
    final rules = ref.watch(profileRulesProvider);

    return AuthPanelLayout(
      backgroundAlignment: const Alignment(0.3, -0.3),
      onBack: editing ? () => context.pop() : null,
      footer: editing
          ? null
          : TextButton(
              onPressed: () =>
                  unawaited(ref.read(sessionManagerProvider).signOut()),
              child: const Text(
                'Sign out',
                style: TextStyle(
                  color: AppColors.cyan,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
      child: switch ((setup, rules)) {
        (AsyncData(value: final state), AsyncData(value: final rules)) =>
          _ProfileForm(initial: state, rules: rules, editing: editing),
        (AsyncError(:final error), _) ||
        (_, AsyncError(:final error)) => _LoadFailure(
          failure: ApiFailure.from(error),
          onRetry: () {
            ref
              ..invalidate(profileSetupControllerProvider)
              ..invalidate(profileRulesProvider);
          },
        ),
        _ => const Padding(
          padding: EdgeInsets.symmetric(vertical: 64),
          child: Center(
            child: CircularProgressIndicator(
              color: AppColors.cyan,
              semanticsLabel: 'Loading your profile',
            ),
          ),
        ),
      },
    );
  }
}

class _ProfileForm extends ConsumerStatefulWidget {
  const new({
    required this.initial,
    required this.rules,
    required this.editing,
  });

  final ProfileSetupState initial;
  final ProfileRules rules;
  final bool editing;

  @override
  ConsumerState<_ProfileForm> createState() => _ProfileFormState();
}

class _ProfileFormState extends ConsumerState<_ProfileForm> {
  final _formKey = GlobalKey<FormState>();
  late String _phone = widget.initial.phoneNumber ?? '';
  late DateTime? _dateOfBirth = widget.initial.dateOfBirth;
  late Gender? _gender = widget.initial.gender;

  DateTime get _latestBirthDate {
    final today = DateTime.now();
    return DateTime(
      today.year - widget.rules.driverMinimumAge,
      today.month,
      today.day,
    );
  }

  Future<void> _pickDate() async {
    final latest = _latestBirthDate;
    final initial = _dateOfBirth ?? DateTime(latest.year - 12);
    final picked = await showDatePicker(
      context: context,
      initialDate: initial.isAfter(latest) ? latest : initial,
      firstDate: DateTime(latest.year - 82),
      lastDate: latest,
      initialEntryMode: DatePickerEntryMode.calendarOnly,
      helpText: 'Date of birth',
    );
    if (picked != null) setState(() => _dateOfBirth = picked);
  }

  Future<void> _continue() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    await ref
        .read(profileSetupControllerProvider.notifier)
        .saveDetails(
          phoneNumber: _phone,
          dateOfBirth: _dateOfBirth!,
          gender: _gender!,
        );
    if (!mounted) return;
    if (!widget.editing) {
      unawaited(context.push(AppRoutes.profileContacts));
      return;
    }
    final saved = await ref
        .read(profileSetupControllerProvider.notifier)
        .submit();
    if (!saved || !mounted) return;
    ref.read(dataChangesProvider.notifier).markChanged();
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(const SnackBar(content: Text('Your details were saved.')));
    context.pop();
  }

  @override
  Widget build(BuildContext context) {
    final serverErrors = ref.watch(
      profileSetupControllerProvider.select(
        (value) => value.value?.fieldErrors ?? const <String, String>{},
      ),
    );
    final avatar = ref.watch(
      profileSetupControllerProvider.select((value) => value.value?.avatar),
    );
    final submitting = ref.watch(
      profileSetupControllerProvider.select(
        (value) => value.value?.submitting ?? false,
      ),
    );
    final failure = ref.watch(
      profileSetupControllerProvider.select((value) => value.value?.failure),
    );
    final editing = widget.editing;

    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (!editing) ...[
            const StepIndicator(step: 1, total: 2),
            const SizedBox(height: 18),
          ],
          Semantics(
            header: true,
            child: Text(
              editing ? 'Personal details' : 'Complete your profile',
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 30,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.6,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            editing
                ? 'Keep these up to date so help reaches you quickly.'
                : 'This helps Mediane protect you during an incident.',
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: AppColors.ice,
              fontSize: 16,
              height: 1.4,
            ),
          ),
          if (editing && failure != null && serverErrors.isEmpty) ...[
            const SizedBox(height: 16),
            InlineMessage(message: failure.message),
          ],
          const SizedBox(height: 20),
          Center(
            child: Semantics(
              button: true,
              label: avatar == null
                  ? 'Add profile photo, optional'
                  : 'Change profile photo',
              excludeSemantics: true,
              child: InkWell(
                customBorder: const CircleBorder(),
                onTap: () => context.push(AppRoutes.profilePhoto),
                child: ProfileAvatarView(avatar: avatar, size: 112),
              ),
            ),
          ),
          const SizedBox(height: 8),
          Text(
            avatar == null ? 'Add photo · Optional' : 'Change photo',
            textAlign: TextAlign.center,
            style: const TextStyle(color: AppColors.slate),
          ),
          const SizedBox(height: 20),
          PhoneNumberField(
            label: 'Phone number',
            initialValue: _phone,
            errorText: _serverMessage(serverErrors['phoneNumber']),
            textInputAction: TextInputAction.done,
            onChanged: (value) => _phone = value,
          ),
          const SizedBox(height: 18),
          _DateOfBirthField(
            value: _dateOfBirth,
            minimumAge: widget.rules.driverMinimumAge,
            latest: _latestBirthDate,
            serverError: _serverMessage(serverErrors['dateOfBirth']),
            onTap: () => unawaited(_pickDate()),
          ),
          const SizedBox(height: 18),
          _GenderField(
            value: _gender,
            onChanged: (gender) => setState(() => _gender = gender),
          ),
          const SizedBox(height: 18),
          const Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.lock_outline_rounded, color: AppColors.slate),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Your personal details are only used for Mediane safety '
                  'services.',
                  style: TextStyle(color: AppColors.slate, height: 1.4),
                ),
              ),
            ],
          ),
          const SizedBox(height: 22),
          GradientButton(
            label: editing ? 'Save changes' : 'Continue',
            loading: submitting,
            onPressed: () => unawaited(_continue()),
          ),
        ],
      ),
    );
  }
}

String? _serverMessage(String? detail) =>
    detail == null ? null : 'This ${detail.replaceAll(RegExp(r'\.$'), '')}.';

class _DateOfBirthField extends StatelessWidget {
  const new({
    required this.value,
    required this.minimumAge,
    required this.latest,
    required this.serverError,
    required this.onTap,
  });

  final DateTime? value;
  final int minimumAge;
  final DateTime latest;
  final String? serverError;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return FormField<DateTime>(
      initialValue: value,
      validator: (_) {
        if (value == null) return 'Choose your date of birth.';
        if (value!.isAfter(latest)) {
          return 'Drivers must be at least $minimumAge years old.';
        }
        return null;
      },
      builder: (field) {
        final error = field.errorText ?? serverError;
        final text = value == null
            ? 'Select a date'
            : DateFormat.yMMMMd().format(value!);
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const ExcludeSemantics(
              child: Text(
                'Date of birth',
                style: TextStyle(
                  color: AppColors.ice,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Semantics(
              button: true,
              label: 'Date of birth',
              value: value == null ? 'Not set' : text,
              excludeSemantics: true,
              child: InkWell(
                borderRadius: BorderRadius.circular(16),
                onTap: () {
                  onTap();
                  field.didChange(value);
                },
                child: Container(
                  constraints: const BoxConstraints(minHeight: 58),
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    color: AppColors.navy950.withValues(alpha: 0.42),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(
                      color: error == null
                          ? AppColors.slate.withValues(alpha: 0.35)
                          : AppColors.coral,
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.calendar_month_outlined,
                        color: AppColors.ice,
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Text(
                          text,
                          style: TextStyle(
                            color: value == null
                                ? AppColors.slate
                                : Colors.white,
                            fontSize: 16,
                          ),
                        ),
                      ),
                      const Icon(
                        Icons.expand_more_rounded,
                        color: AppColors.slate,
                      ),
                    ],
                  ),
                ),
              ),
            ),
            if (error != null)
              Padding(
                padding: const EdgeInsets.only(left: 16, top: 6),
                child: Text(
                  error,
                  style: const TextStyle(color: AppColors.coral, fontSize: 13),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _GenderField extends StatelessWidget {
  const new({required this.value, required this.onChanged});

  final Gender? value;
  final ValueChanged<Gender> onChanged;

  @override
  Widget build(BuildContext context) {
    return FormField<Gender>(
      initialValue: value,
      validator: (_) => value == null ? 'Choose an option.' : null,
      builder: (field) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Gender',
              style: TextStyle(
                color: AppColors.ice,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 8),
            DecoratedBox(
              decoration: BoxDecoration(
                color: AppColors.navy950.withValues(alpha: 0.42),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: field.hasError
                      ? AppColors.coral
                      : AppColors.slate.withValues(alpha: 0.35),
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: Row(
                  children: [
                    for (final gender in Gender.values)
                      Expanded(
                        child: _GenderOption(
                          gender: gender,
                          selected: gender == value,
                          onTap: () {
                            onChanged(gender);
                            field.didChange(gender);
                          },
                        ),
                      ),
                  ],
                ),
              ),
            ),
            if (field.errorText case final error?)
              Padding(
                padding: const EdgeInsets.only(left: 16, top: 6),
                child: Text(
                  error,
                  style: const TextStyle(color: AppColors.coral, fontSize: 13),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _GenderOption extends StatelessWidget {
  const new({
    required this.gender,
    required this.selected,
    required this.onTap,
  });

  final Gender gender;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      selected: selected,
      label: gender.label,
      excludeSemantics: true,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          constraints: const BoxConstraints(minHeight: 52),
          decoration: BoxDecoration(
            gradient: selected
                ? const LinearGradient(
                    colors: [AppColors.cobalt, Color(0xFF0B4FC4)],
                  )
                : null,
            borderRadius: BorderRadius.circular(14),
            border: selected ? Border.all(color: AppColors.cyan) : null,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.person_rounded,
                color: selected ? Colors.white : AppColors.slate,
              ),
              const SizedBox(width: 8),
              Text(
                gender.label,
                style: TextStyle(
                  color: selected ? Colors.white : AppColors.ice,
                  fontSize: 16,
                  fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LoadFailure extends StatelessWidget {
  const new({required this.failure, required this.onRetry});

  final ApiFailure failure;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        InlineMessage(message: failure.message),
        const SizedBox(height: 16),
        GradientButton(label: 'Try again', onPressed: onRetry),
      ],
    );
  }
}
