import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/features/family/application/family_providers.dart';
import 'package:driver_health_app/features/family/domain/entities/family_invite.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The owner's current join code (screen 21). The server renews an expired
/// code on read; rotating invalidates the previous one immediately.
final AsyncNotifierProvider<InviteController, FamilyInvite>
inviteControllerProvider = AsyncNotifierProvider.autoDispose(
  InviteController.new,
);

class InviteController extends AsyncNotifier<FamilyInvite> {
  @override
  Future<FamilyInvite> build() => ref.watch(familyRepositoryProvider).invite();

  Future<ApiFailure?> rotate() async {
    try {
      final invite = await ref.read(familyRepositoryProvider).rotateInvite();
      if (ref.mounted) state = AsyncData(invite);
      return null;
    } on Object catch (error) {
      return ApiFailure.from(error);
    }
  }
}
