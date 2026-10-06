import 'dart:async';

import 'package:driver_health_app/core/presentation/widgets/cabinguard_brand.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Keeps secrets such as recovery codes out of screenshots, recordings and
/// screen sharing (Android `FLAG_SECURE`) and out of app-switcher snapshots
/// (an opaque cover while the app is not in the foreground, which also covers
/// iOS). Flutter's `SensitiveContent` is not used: it renders nothing until a
/// platform round trip completes, and `FLAG_SECURE` already covers sharing.
class SecretScreenGuard extends StatefulWidget {
  const new({required this.child, super.key});

  static const channel = MethodChannel('com.cabinguard.mobile/secure_screen');

  final Widget child;

  @override
  State<SecretScreenGuard> createState() => _SecretScreenGuardState();
}

class _SecretScreenGuardState extends State<SecretScreenGuard>
    with WidgetsBindingObserver {
  bool _obscured = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_setSecure(enabled: true));
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    unawaited(_setSecure(enabled: false));
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final obscured = state != AppLifecycleState.resumed;
    if (obscured != _obscured) setState(() => _obscured = obscured);
  }

  static Future<void> _setSecure({required bool enabled}) async {
    try {
      await SecretScreenGuard.channel.invokeMethod<void>('setSecure', enabled);
    } on MissingPluginException {
      // Platforms without the channel (tests, iOS) rely on the cover.
    } on PlatformException {
      // Never block the screen because the flag could not be applied.
    }
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        if (_obscured)
          const Positioned.fill(
            child: ColoredBox(
              color: AppColors.navy950,
              child: Center(child: CabinGuardBrand(compact: true)),
            ),
          ),
      ],
    );
  }
}
