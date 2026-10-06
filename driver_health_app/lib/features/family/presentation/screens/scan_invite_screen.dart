import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/family/domain/family_code.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

/// Scans a family invitation QR code. The camera is requested only here.
class ScanInviteScreen extends StatefulWidget {
  const new({super.key});

  @override
  State<ScanInviteScreen> createState() => _ScanInviteScreenState();
}

class _ScanInviteScreenState extends State<ScanInviteScreen> {
  final _controller = MobileScannerController(
    formats: const [BarcodeFormat.qrCode],
  );
  bool _handled = false;
  DateTime? _lastWarning;

  @override
  void dispose() {
    unawaited(_controller.dispose());
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_handled) return;
    for (final barcode in capture.barcodes) {
      final code = FamilyCode.extract(barcode.rawValue ?? '');
      if (code != null) {
        _handled = true;
        context.pushReplacement(AppRoutes.familyPreview(code));
        return;
      }
    }
    // Throttle the hint while the camera keeps seeing the wrong code.
    final now = DateTime.now();
    if (_lastWarning == null ||
        now.difference(_lastWarning!) > const Duration(seconds: 3)) {
      _lastWarning = now;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('This QR code isn’t a CabinGuard family invitation.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.white,
        title: const Text('Scan family code'),
        actions: [
          IconButton(
            tooltip: 'Flashlight',
            onPressed: () => unawaited(_controller.toggleTorch()),
            icon: const Icon(Icons.flashlight_on_outlined),
          ),
        ],
      ),
      extendBodyBehindAppBar: true,
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(
            controller: _controller,
            onDetect: _onDetect,
            errorBuilder: (context, error) => _CameraUnavailable(
              denied:
                  error.errorCode == MobileScannerErrorCode.permissionDenied,
            ),
          ),
          IgnorePointer(
            child: Center(
              child: Container(
                width: 240,
                height: 240,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: AppColors.cyan, width: 3),
                ),
              ),
            ),
          ),
          const Positioned(
            left: 24,
            right: 24,
            bottom: 48,
            child: Text(
              'Point your camera at the QR code on the family owner’s phone.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white, fontSize: 16),
            ),
          ),
        ],
      ),
    );
  }
}

class _CameraUnavailable extends StatelessWidget {
  const new({required this.denied});

  final bool denied;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: AppColors.navy950,
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.no_photography_outlined,
              color: AppColors.slate,
              size: 56,
            ),
            const SizedBox(height: 16),
            Text(
              denied
                  ? 'Camera access is off. Allow it in Settings, or type the '
                        'code instead.'
                  : 'The camera isn’t available. Type the code instead.',
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white, fontSize: 16),
            ),
            if (denied)
              TextButton(
                onPressed: () => unawaited(openAppSettings()),
                child: const Text(
                  'Open Settings',
                  style: TextStyle(color: AppColors.cyan),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
