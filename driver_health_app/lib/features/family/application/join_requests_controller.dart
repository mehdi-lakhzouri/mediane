import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/features/family/application/family_providers.dart';
import 'package:driver_health_app/features/family/application/my_family_controller.dart';
import 'package:driver_health_app/features/family/domain/entities/family_invite.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// Requests waiting for the owner's decision (screen 23).
final AsyncNotifierProvider<JoinRequestsController, List<IncomingJoinRequest>>
joinRequestsControllerProvider = AsyncNotifierProvider.autoDispose(
  JoinRequestsController.new,
);

class JoinRequestsController extends AsyncNotifier<List<IncomingJoinRequest>> {
  @override
  Future<List<IncomingJoinRequest>> build() =>
      ref.watch(familyRepositoryProvider).joinRequests();

  Future<ApiFailure?> approve(String requestId) async {
    try {
      final family = await ref
          .read(familyRepositoryProvider)
          .approve(requestId);
      ref.read(myFamilyControllerProvider.notifier).adopt(family);
      _drop(requestId);
      return null;
    } on Object catch (error) {
      return await _handle(error);
    }
  }

  Future<ApiFailure?> reject(String requestId) async {
    try {
      await ref.read(familyRepositoryProvider).reject(requestId);
      _drop(requestId);
      await ref.read(myFamilyControllerProvider.notifier).refresh();
      return null;
    } on Object catch (error) {
      return await _handle(error);
    }
  }

  void _drop(String requestId) {
    final current = state.value;
    if (current == null || !ref.mounted) return;
    state = AsyncData([
      for (final request in current)
        if (request.id != requestId) request,
    ]);
  }

  /// A request decided elsewhere or expired is removed by reloading.
  Future<ApiFailure> _handle(Object error) async {
    final failure = ApiFailure.from(error);
    if (ref.mounted &&
        (failure.code == 'JOIN_REQUEST_CLOSED' ||
            failure.code == 'JOIN_REQUEST_NOT_FOUND' ||
            failure.code == 'FAMILY_FULL')) {
      ref.invalidateSelf();
    }
    return failure;
  }
}
