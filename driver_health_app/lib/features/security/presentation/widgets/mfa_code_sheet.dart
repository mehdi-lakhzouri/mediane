import 'dart:async';

import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_text_field.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

final _codePattern = RegExp(r'^(\d{6}|[A-Za-z0-9]{5}[\s-]?[A-Za-z0-9]{5})$');

/// Asks for a current authenticator or recovery code, then runs [onSubmit]
/// with it. The sheet stays open on failure so the user can retry. Returns
/// the action's result, or `null` when dismissed.
Future<T?> showMfaCodeSheet<T>(
  BuildContext context, {
  required String title,
  required String message,
  required String actionLabel,
  required Future<T> Function(String code) onSubmit,
  bool destructive = false,
}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: AppColors.navy900,
    builder: (context) => _MfaCodeSheet<T>(
      title: title,
      message: message,
      actionLabel: actionLabel,
      onSubmit: onSubmit,
      destructive: destructive,
    ),
  );
}

class _MfaCodeSheet<T> extends StatefulWidget {
  const new({
    required this.title,
    required this.message,
    required this.actionLabel,
    required this.onSubmit,
    required this.destructive,
  });

  final String title;
  final String message;
  final String actionLabel;
  final Future<T> Function(String code) onSubmit;
  final bool destructive;

  @override
  State<_MfaCodeSheet<T>> createState() => _MfaCodeSheetState<T>();
}

class _MfaCodeSheetState<T> extends State<_MfaCodeSheet<T>> {
  static const codeFieldKey = Key('mfa-sheet.code');

  final _formKey = GlobalKey<FormState>();
  final _code = TextEditingController();
  bool _submitting = false;
  ApiFailure? _failure;

  @override
  void dispose() {
    _code.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() {
      _submitting = true;
      _failure = null;
    });
    try {
      final result = await widget.onSubmit(_code.text.trim());
      if (mounted) Navigator.of(context).pop(result);
    } on Object catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _failure = ApiFailure.from(error);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final failure = _failure;
    final rejected = failure?.code == 'MFA_CODE_INVALID';
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
                      widget.title,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.message,
                    style: const TextStyle(color: AppColors.ice, height: 1.4),
                  ),
                  const SizedBox(height: 18),
                  if (failure != null && !rejected) ...[
                    InlineMessage(message: _messageFor(failure)),
                    const SizedBox(height: 14),
                  ],
                  CabinGuardTextField(
                    key: codeFieldKey,
                    label: 'Authenticator or recovery code',
                    controller: _code,
                    hintText: '123456',
                    prefixIcon: Icons.phonelink_lock_rounded,
                    keyboardType: TextInputType.visiblePassword,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    autocorrect: false,
                    enabled: !_submitting,
                    textInputAction: TextInputAction.done,
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(
                        RegExp(r'[A-Za-z0-9\s-]'),
                      ),
                      LengthLimitingTextInputFormatter(11),
                    ],
                    errorText: rejected
                        ? 'That code isn’t valid. Try a new one.'
                        : null,
                    onChanged: (_) {
                      if (_failure != null) setState(() => _failure = null);
                    },
                    onFieldSubmitted: (_) => unawaited(_submit()),
                    validator: (value) =>
                        _codePattern.hasMatch(value?.trim() ?? '')
                        ? null
                        : 'Enter the 6-digit code or a recovery code.',
                  ),
                  const SizedBox(height: 22),
                  if (widget.destructive)
                    FilledButton(
                      onPressed: _submitting
                          ? null
                          : () => unawaited(_submit()),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.coral,
                        foregroundColor: Colors.white,
                      ),
                      child: _submitting
                          ? const SizedBox.square(
                              dimension: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                color: Colors.white,
                              ),
                            )
                          : Text(widget.actionLabel),
                    )
                  else
                    GradientButton(
                      label: widget.actionLabel,
                      loading: _submitting,
                      onPressed: () => unawaited(_submit()),
                    ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  static String _messageFor(ApiFailure failure) => switch (failure.kind) {
    ApiFailureKind.rateLimited =>
      'Too many attempts. Wait a few minutes and try again.',
    ApiFailureKind.server || ApiFailureKind.protocol =>
      'This couldn’t be completed right now. Try again shortly.',
    _ => failure.message,
  };
}
