import 'dart:math' as math;

import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// One accessible text field behind [length] visual digit cells. Screen
/// readers, autofill, and paste all see a single field; the cells are drawn
/// from its value.
class OtpCodeField extends StatefulWidget {
  const new({
    required this.controller,
    required this.focusNode,
    this.length = 6,
    this.enabled = true,
    this.error = false,
    this.autofocus = false,
    this.semanticLabel = 'Verification code',
    this.onChanged,
    this.onCompleted,
    super.key,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final int length;
  final bool enabled;
  final bool error;
  final bool autofocus;
  final String semanticLabel;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onCompleted;

  @override
  State<OtpCodeField> createState() => _OtpCodeFieldState();
}

class _OtpCodeFieldState extends State<OtpCodeField> {
  static const _gap = 8.0;

  late final Listenable _changes = Listenable.merge([
    widget.controller,
    widget.focusNode,
  ]);

  void _handleChanged(String value) {
    widget.onChanged?.call(value);
    if (value.length == widget.length) widget.onCompleted?.call(value);
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final cellWidth =
            ((constraints.maxWidth - _gap * (widget.length - 1)) /
                    widget.length)
                .clamp(36.0, 58.0);
        final cellHeight = math.max(56, cellWidth * 1.15).toDouble();

        return SizedBox(
          height: cellHeight,
          child: Stack(
            children: [
              ExcludeSemantics(
                child: ListenableBuilder(
                  listenable: _changes,
                  builder: (context, _) => _cells(cellWidth, cellHeight),
                ),
              ),
              Positioned.fill(
                child: TextField(
                  controller: widget.controller,
                  focusNode: widget.focusNode,
                  enabled: widget.enabled,
                  autofocus: widget.autofocus,
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.done,
                  autofillHints: const [AutofillHints.oneTimeCode],
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(widget.length),
                  ],
                  showCursor: false,
                  autocorrect: false,
                  enableSuggestions: false,
                  style: const TextStyle(color: Colors.transparent),
                  // Borders are drawn by the cells; the transparent hint is
                  // the field's accessible name.
                  decoration: InputDecoration(
                    isCollapsed: true,
                    filled: false,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                    errorBorder: InputBorder.none,
                    focusedErrorBorder: InputBorder.none,
                    hintText: widget.semanticLabel,
                    hintStyle: const TextStyle(color: Colors.transparent),
                  ),
                  onChanged: _handleChanged,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _cells(double width, double height) {
    final text = widget.controller.text;
    final focused = widget.focusNode.hasFocus;
    final activeIndex = math.min(text.length, widget.length - 1);

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        for (var i = 0; i < widget.length; i++) ...[
          if (i > 0) const SizedBox(width: _gap),
          _Cell(
            width: width,
            height: height,
            digit: i < text.length ? text[i] : '',
            borderColor: widget.error
                ? AppColors.coral
                : focused && i == activeIndex
                ? AppColors.cyan
                : i < text.length
                ? AppColors.cyan.withValues(alpha: 0.6)
                : AppColors.slate.withValues(alpha: 0.45),
            emphasized: widget.error || (focused && i == activeIndex),
          ),
        ],
      ],
    );
  }
}

class _Cell extends StatelessWidget {
  const new({
    required this.width,
    required this.height,
    required this.digit,
    required this.borderColor,
    required this.emphasized,
  });

  final double width;
  final double height;
  final String digit;
  final Color borderColor;
  final bool emphasized;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 160),
      width: width,
      height: height,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: AppColors.navy950.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: borderColor, width: emphasized ? 1.6 : 1.2),
      ),
      child: Text(
        digit,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 28,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
