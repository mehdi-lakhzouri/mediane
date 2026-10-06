import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Asks before an irreversible or destructive action. Returns `true` only
/// when the user confirms.
Future<bool> showConfirmDialog(
  BuildContext context, {
  required String title,
  required String message,
  required String confirmLabel,
  String cancelLabel = 'Cancel',
  bool destructive = true,
}) async {
  final confirmed = await showDialog<bool>(
    context: context,
    builder: (context) => AlertDialog(
      backgroundColor: AppColors.navy900,
      title: Text(title),
      content: Text(message),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: Text(cancelLabel),
        ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(true),
          child: Text(
            confirmLabel,
            style: TextStyle(
              color: destructive ? AppColors.coral : AppColors.cyan,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ],
    ),
  );
  return confirmed ?? false;
}
