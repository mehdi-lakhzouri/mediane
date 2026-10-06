import 'dart:typed_data';

import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/features/driver_profile/data/data_sources/avatar_picker.dart';
import 'package:driver_health_app/features/driver_profile/presentation/controllers/profile_providers.dart';
import 'package:driver_health_app/features/driver_profile/presentation/controllers/profile_setup_controller.dart';
import 'package:driver_health_app/features/startup/domain/entities/mobile_bootstrap.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final avatarPickerProvider = Provider<AvatarPicker>(
  (ref) => const DeviceAvatarPicker(),
);

class ProfilePhotoState {
  const new({
    this.picked,
    this.uploading = false,
    this.removing = false,
    this.progress = 0,
    this.problem,
    this.permissionDenied = false,
    this.failure,
    this.saved = false,
  });

  /// New photo waiting to be saved.
  final PickedAvatar? picked;
  final bool uploading;
  final bool removing;

  /// Upload progress from 0 to 1.
  final double progress;

  /// Local problem with the chosen photo or permissions.
  final String? problem;

  /// Camera or photo access was refused; offer a way to Settings.
  final bool permissionDenied;
  final ApiFailure? failure;
  final bool saved;

  bool get busy => uploading || removing;

  Uint8List? get previewBytes =>
      picked == null ? null : Uint8List.fromList(picked!.upload.bytes);
}

final NotifierProvider<ProfilePhotoController, ProfilePhotoState>
profilePhotoControllerProvider = NotifierProvider.autoDispose(
  ProfilePhotoController.new,
);

/// Screen 16: optional photo, validated against the server's published
/// rules before upload. The server re-encodes it and strips metadata.
class ProfilePhotoController extends Notifier<ProfilePhotoState> {
  @override
  ProfilePhotoState build() => const ProfilePhotoState();

  Future<void> pick(AvatarSource source, ProfileRules rules) async {
    if (state.busy) return;
    final PickedAvatar? picked;
    try {
      picked = await ref.read(avatarPickerProvider).pick(source);
    } on AvatarPickDenied catch (denied) {
      state = ProfilePhotoState(
        permissionDenied: true,
        problem: denied.source == AvatarSource.camera
            ? 'Camera access is off. Allow it in Settings to take a photo.'
            : 'Photo access is off. Allow it in Settings to choose a photo.',
      );
      return;
    } on Object {
      state = const ProfilePhotoState(
        problem: 'That photo couldn’t be opened. Try another one.',
      );
      return;
    }
    if (picked == null || !ref.mounted) return;

    final problem = _validate(picked, rules);
    state = problem == null
        ? ProfilePhotoState(picked: picked)
        : ProfilePhotoState(problem: problem);
  }

  Future<bool> upload() async {
    final picked = state.picked;
    if (picked == null || state.busy) return false;
    state = ProfilePhotoState(picked: picked, uploading: true);
    try {
      final profile = await ref
          .read(profileRepositoryProvider)
          .uploadAvatar(
            picked.upload,
            onProgress: (progress) {
              if (ref.mounted && state.uploading) {
                state = ProfilePhotoState(
                  picked: picked,
                  uploading: true,
                  progress: progress,
                );
              }
            },
          );
      ref
          .read(profileSetupControllerProvider.notifier)
          .avatarChanged(profile.avatar);
      if (ref.mounted) state = const ProfilePhotoState(saved: true);
      return true;
    } on Object catch (error) {
      if (ref.mounted) {
        state = ProfilePhotoState(
          picked: picked,
          failure: ApiFailure.from(error),
        );
      }
      return false;
    }
  }

  Future<bool> remove() async {
    if (state.busy) return false;
    state = const ProfilePhotoState(removing: true);
    try {
      await ref.read(profileRepositoryProvider).removeAvatar();
      ref.read(profileSetupControllerProvider.notifier).avatarChanged(null);
      if (ref.mounted) state = const ProfilePhotoState();
      return true;
    } on Object catch (error) {
      if (ref.mounted) {
        state = ProfilePhotoState(failure: ApiFailure.from(error));
      }
      return false;
    }
  }

  static String? _validate(PickedAvatar picked, ProfileRules rules) {
    const types = {'image/jpeg', 'image/png', 'image/webp'};
    if (!types.contains(picked.upload.mimeType)) {
      return 'Use a JPEG, PNG or WebP photo.';
    }
    if (picked.upload.bytes.length > rules.avatarMaxBytes) {
      final megabytes = (rules.avatarMaxBytes / (1024 * 1024)).round();
      return 'That photo is larger than $megabytes MB. Choose a smaller one.';
    }
    final side = rules.avatarMinSidePx;
    if (picked.width < side || picked.height < side) {
      return 'That photo is too small. Use one at least $side × $side px.';
    }
    return null;
  }
}
