import 'package:driver_health_app/core/presentation/widgets/cabinguard_text_field.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/phone_number_field.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';
import 'package:flutter/material.dart';

/// Add or edit one emergency contact. Returns the contact, or `null`.
Future<EmergencyContact?> showContactEditor(
  BuildContext context, {
  required String? driverPhone,
  required List<String> otherPhones,
  EmergencyContact? initial,
}) {
  return showModalBottomSheet<EmergencyContact>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: AppColors.navy900,
    builder: (context) => _ContactEditor(
      initial: initial,
      driverPhone: driverPhone,
      otherPhones: otherPhones,
    ),
  );
}

class _ContactEditor extends StatefulWidget {
  const new({
    required this.initial,
    required this.driverPhone,
    required this.otherPhones,
  });

  final EmergencyContact? initial;
  final String? driverPhone;
  final List<String> otherPhones;

  @override
  State<_ContactEditor> createState() => _ContactEditorState();
}

class _ContactEditorState extends State<_ContactEditor> {
  static const nameFieldKey = Key('contact.name');

  final _formKey = GlobalKey<FormState>();
  late final _name = TextEditingController(text: widget.initial?.fullName);
  late ContactRelationship? _relationship = widget.initial?.relationship;
  late String _phone = widget.initial?.phoneNumber ?? '';

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  void _save() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    Navigator.of(context).pop(
      EmergencyContact(
        fullName: _name.text.trim(),
        relationship: _relationship!,
        phoneNumber: _phone,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final editing = widget.initial != null;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
      child: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
          child: Material(
            type: MaterialType.transparency,
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Semantics(
                    header: true,
                    child: Text(
                      editing ? 'Edit contact' : 'Add emergency contact',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  CabinGuardTextField(
                    key: nameFieldKey,
                    label: 'Full name',
                    controller: _name,
                    prefixIcon: Icons.person_outline_rounded,
                    textCapitalization: TextCapitalization.words,
                    textInputAction: TextInputAction.next,
                    autofillHints: const [AutofillHints.name],
                    validator: (value) {
                      final name = value?.trim() ?? '';
                      if (name.isEmpty) return 'Enter the contact’s name.';
                      if (name.length > 200) return 'Use a shorter name.';
                      return null;
                    },
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Relationship',
                    style: TextStyle(
                      color: AppColors.ice,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: 8),
                  DropdownButtonFormField<ContactRelationship>(
                    initialValue: _relationship,
                    isExpanded: true,
                    dropdownColor: AppColors.navy800,
                    style: const TextStyle(color: Colors.white, fontSize: 16),
                    hint: const Text(
                      'Choose a relationship',
                      style: TextStyle(color: AppColors.slate),
                    ),
                    items: [
                      for (final relationship in ContactRelationship.values)
                        DropdownMenuItem(
                          value: relationship,
                          child: Text(relationship.label),
                        ),
                    ],
                    onChanged: (value) => setState(() => _relationship = value),
                    validator: (value) =>
                        value == null ? 'Choose a relationship.' : null,
                  ),
                  const SizedBox(height: 16),
                  PhoneNumberField(
                    label: 'Phone number',
                    initialValue: _phone,
                    textInputAction: TextInputAction.done,
                    onChanged: (value) => _phone = value,
                    extraValidator: (value) {
                      if (value == widget.driverPhone) {
                        return 'Use someone else’s number, not your own.';
                      }
                      if (widget.otherPhones.contains(value)) {
                        return 'This number is already one of your contacts.';
                      }
                      return null;
                    },
                  ),
                  const SizedBox(height: 22),
                  GradientButton(
                    label: editing ? 'Save contact' : 'Add contact',
                    onPressed: _save,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
