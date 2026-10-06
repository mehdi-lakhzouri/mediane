import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/family/domain/family_code.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// One accessible field for an 8-character family code, shown as K7M4-QX9P.
/// Pasting a full invitation link also works.
class InviteCodeField extends StatelessWidget {
  const new({
    required this.controller,
    this.onSubmitted,
    this.onChanged,
    this.errorText,
    this.enabled = true,
    super.key,
  });

  final TextEditingController controller;
  final ValueChanged<String>? onSubmitted;
  final ValueChanged<String>? onChanged;
  final String? errorText;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    OutlineInputBorder border(Color color, [double width = 1]) =>
        OutlineInputBorder(
          borderRadius: BorderRadius.circular(16),
          borderSide: BorderSide(color: color, width: width),
        );

    return TextField(
      controller: controller,
      enabled: enabled,
      textAlign: TextAlign.center,
      textCapitalization: TextCapitalization.characters,
      autocorrect: false,
      enableSuggestions: false,
      keyboardType: TextInputType.visiblePassword,
      textInputAction: TextInputAction.go,
      inputFormatters: [_InviteCodeFormatter()],
      onChanged: onChanged,
      onSubmitted: onSubmitted,
      style: const TextStyle(
        color: Colors.white,
        fontSize: 28,
        fontWeight: FontWeight.w800,
        letterSpacing: 6,
      ),
      cursorColor: AppColors.cyan,
      decoration: InputDecoration(
        labelText: 'Family code',
        floatingLabelBehavior: FloatingLabelBehavior.always,
        labelStyle: const TextStyle(color: AppColors.ice, letterSpacing: 0),
        hintText: 'K7M4-QX9P',
        hintStyle: TextStyle(
          color: AppColors.slate.withValues(alpha: 0.5),
          letterSpacing: 6,
        ),
        errorText: errorText,
        errorMaxLines: 3,
        filled: true,
        fillColor: AppColors.navy950.withValues(alpha: 0.42),
        contentPadding: const EdgeInsets.symmetric(vertical: 18),
        border: border(AppColors.slate.withValues(alpha: 0.35)),
        enabledBorder: border(AppColors.slate.withValues(alpha: 0.35)),
        focusedBorder: border(AppColors.cyan, 1.5),
        errorBorder: border(AppColors.coral),
        focusedErrorBorder: border(AppColors.coral, 1.5),
      ),
    );
  }
}

/// Uppercases, keeps letters and digits, and inserts the dash after four.
/// A pasted invitation link is reduced to its code.
class _InviteCodeFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final fromLink = newValue.text.contains('/')
        ? FamilyCode.extract(newValue.text)
        : null;
    final raw = FamilyCode.normalize(fromLink ?? newValue.text);
    final code = raw.length > FamilyCode.length
        ? raw.substring(0, FamilyCode.length)
        : raw;
    final text = code.length > 4
        ? '${code.substring(0, 4)}-${code.substring(4)}'
        : code;
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
