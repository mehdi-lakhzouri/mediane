import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/features/family/presentation/family_messages.dart';
import 'package:flutter/material.dart';

/// Runs a family action and reports the outcome in a snackbar. Returns
/// `true` on success so callers can navigate on.
Future<bool> runFamilyAction(
  BuildContext context,
  Future<ApiFailure?> Function() action, {
  String? successMessage,
}) async {
  final messenger = ScaffoldMessenger.of(context);
  final failure = await action();
  // Show the latest outcome now rather than queueing behind an older one.
  messenger.hideCurrentSnackBar();
  if (failure != null) {
    messenger.showSnackBar(
      SnackBar(content: Text(familyFailureMessage(failure))),
    );
    return false;
  }
  if (successMessage != null) {
    messenger.showSnackBar(SnackBar(content: Text(successMessage)));
  }
  return true;
}
