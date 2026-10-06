import 'dart:ui' as ui;

import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/driver_profile/domain/repositories/profile_repository.dart';
import 'package:flutter/services.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';

enum AvatarSource { camera, library }

class AvatarPickDenied implements Exception {
  const new(this.source);

  final AvatarSource source;
}

class PickedAvatar {
  const new({required this.upload, required this.width, required this.height});

  final AvatarUpload upload;
  final int width;
  final int height;
}

/// Lets the driver take or choose a photo and crop it to a square. The OS
/// asks for camera or photo access only at this moment.
abstract interface class AvatarPicker {
  /// Returns `null` when the user cancels.
  Future<PickedAvatar?> pick(AvatarSource source);
}

class DeviceAvatarPicker implements AvatarPicker {
  const new();

  @override
  Future<PickedAvatar?> pick(AvatarSource source) async {
    final XFile? picked;
    try {
      picked = await ImagePicker().pickImage(
        source: source == AvatarSource.camera
            ? ImageSource.camera
            : ImageSource.gallery,
        preferredCameraDevice: CameraDevice.front,
        maxWidth: 2048,
        maxHeight: 2048,
        imageQuality: 92,
      );
    } on PlatformException catch (error) {
      if (error.code.contains('access_denied')) {
        throw AvatarPickDenied(source);
      }
      rethrow;
    }
    if (picked == null) return null;

    final cropped = await ImageCropper().cropImage(
      sourcePath: picked.path,
      aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
      uiSettings: [
        AndroidUiSettings(
          toolbarTitle: 'Crop photo',
          toolbarColor: AppColors.navy900,
          toolbarWidgetColor: AppColors.ice,
          activeControlsWidgetColor: AppColors.cyan,
          lockAspectRatio: true,
          cropStyle: CropStyle.circle,
        ),
        IOSUiSettings(
          title: 'Crop photo',
          aspectRatioLockEnabled: true,
          resetAspectRatioEnabled: false,
          cropStyle: CropStyle.circle,
        ),
      ],
    );
    if (cropped == null) return null;

    final bytes = await cropped.readAsBytes();
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final image = frame.image;
    final picture = PickedAvatar(
      upload: AvatarUpload(
        bytes: bytes,
        fileName: 'avatar.jpg',
        mimeType: 'image/jpeg',
      ),
      width: image.width,
      height: image.height,
    );
    image.dispose();
    codec.dispose();
    return picture;
  }
}
