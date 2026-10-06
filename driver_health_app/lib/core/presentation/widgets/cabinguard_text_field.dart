import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Labelled form field used on every CabinGuard glass panel.
class CabinGuardTextField extends StatelessWidget {
  const new({
    required this.label,
    this.controller,
    this.focusNode,
    this.hintText,
    this.prefixIcon,
    this.prefix,
    this.suffix,
    this.validator,
    this.onChanged,
    this.onFieldSubmitted,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.inputFormatters,
    this.textCapitalization = TextCapitalization.none,
    this.obscureText = false,
    this.enabled = true,
    this.autocorrect = true,
    this.errorText,
    super.key,
  });

  final String label;
  final TextEditingController? controller;
  final FocusNode? focusNode;
  final String? hintText;
  final IconData? prefixIcon;

  /// Interactive prefix such as a country picker; replaces [prefixIcon].
  final Widget? prefix;
  final Widget? suffix;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onFieldSubmitted;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final List<TextInputFormatter>? inputFormatters;
  final TextCapitalization textCapitalization;
  final bool obscureText;
  final bool enabled;
  final bool autocorrect;

  /// Server-side error for this field, shown like a validation error.
  final String? errorText;

  @override
  Widget build(BuildContext context) {
    OutlineInputBorder border(Color color, [double width = 1]) {
      return OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: BorderSide(color: color, width: width),
      );
    }

    // A labelled container rather than MergeSemantics, so suffix actions such
    // as the password visibility toggle stay individually focusable.
    return Semantics(
      container: true,
      label: label,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ExcludeSemantics(
            child: Text(
              label,
              style: const TextStyle(
                color: AppColors.ice,
                fontSize: 15,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: controller,
            focusNode: focusNode,
            validator: validator,
            onChanged: onChanged,
            onFieldSubmitted: onFieldSubmitted,
            keyboardType: keyboardType,
            textInputAction: textInputAction,
            autofillHints: autofillHints,
            inputFormatters: inputFormatters,
            textCapitalization: textCapitalization,
            obscureText: obscureText,
            enabled: enabled,
            autocorrect: autocorrect && !obscureText,
            enableSuggestions: !obscureText,
            cursorColor: AppColors.cyan,
            style: const TextStyle(color: Colors.white, fontSize: 16),
            decoration: InputDecoration(
              hintText: hintText,
              hintStyle: TextStyle(
                color: AppColors.slate.withValues(alpha: 0.8),
              ),
              errorText: errorText,
              errorMaxLines: 3,
              errorStyle: const TextStyle(color: AppColors.coral, fontSize: 13),
              filled: true,
              fillColor: AppColors.navy950.withValues(alpha: 0.42),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 16,
                vertical: 18,
              ),
              prefixIcon:
                  prefix ??
                  (prefixIcon == null
                      ? null
                      : Icon(prefixIcon, color: AppColors.ice, size: 22)),
              suffixIcon: suffix,
              border: border(AppColors.slate.withValues(alpha: 0.35)),
              enabledBorder: border(AppColors.slate.withValues(alpha: 0.35)),
              disabledBorder: border(AppColors.slate.withValues(alpha: 0.18)),
              focusedBorder: border(AppColors.cyan, 1.5),
              errorBorder: border(AppColors.coral),
              focusedErrorBorder: border(AppColors.coral, 1.5),
            ),
          ),
        ],
      ),
    );
  }
}
