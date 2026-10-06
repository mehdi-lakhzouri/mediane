import 'dart:async';

import 'package:driver_health_app/features/safety/presentation/safety_links.dart';
import 'package:flutter/material.dart';

/// Direct line to emergency services, for when the app cannot help.
class CallEmergencyButton extends StatelessWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      onPressed: () => unawaited(callNumber(emergencyNumber)),
      icon: const Icon(Icons.local_hospital_rounded),
      label: const Text('Call emergency services ($emergencyNumber)'),
      style: OutlinedButton.styleFrom(
        foregroundColor: Colors.white,
        minimumSize: const Size.fromHeight(52),
        side: BorderSide(color: Colors.white.withValues(alpha: 0.5)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    );
  }
}
