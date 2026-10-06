import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/state/data_changes.dart';
import 'package:driver_health_app/features/family/application/family_providers.dart';
import 'package:driver_health_app/features/family/domain/entities/family.dart';
import 'package:driver_health_app/features/family/domain/repositories/family_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The driver's family state (screens 19, 20, 22, 24). Every action adopts the
/// state the server returns and reports a failure instead of throwing, so
/// screens only decide how to present the outcome.
final AsyncNotifierProvider<MyFamilyController, MyFamily>
myFamilyControllerProvider = AsyncNotifierProvider.autoDispose(
  MyFamilyController.new,
);

class MyFamilyController extends AsyncNotifier<MyFamily> {
  FamilyRepository get _repository => ref.read(familyRepositoryProvider);

  @override
  Future<MyFamily> build() => ref.watch(familyRepositoryProvider).mine();

  Future<ApiFailure?> create(String name) => _run((r) => r.create(name));

  Future<ApiFailure?> rename(String name) => _run((r) => r.rename(name));

  Future<ApiFailure?> requestToJoin(String code) =>
      _run((r) => r.requestToJoin(code));

  Future<ApiFailure?> leave() => _run((r) => r.leave());

  Future<ApiFailure?> removeMember(String userId) =>
      _run((r) => r.removeMember(userId));

  Future<ApiFailure?> transferOwnership(String userId) =>
      _run((r) => r.transferOwnership(userId));

  Future<ApiFailure?> updateSharing(FamilySharing sharing) =>
      _run((r) => r.updateSharing(sharing));

  Future<ApiFailure?> dissolve() => _run((r) async {
    await r.dissolve();
    return const MyFamily();
  });

  Future<ApiFailure?> cancelJoinRequest() => _run((r) async {
    await r.cancelJoinRequest();
    return const MyFamily();
  });

  /// Adopts a state produced elsewhere, e.g. after approving a request.
  void adopt(MyFamily family) {
    state = AsyncData(family);
    ref.read(dataChangesProvider.notifier).markChanged();
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(_repository.mine);
  }

  Future<ApiFailure?> _run(
    Future<MyFamily> Function(FamilyRepository repository) action,
  ) async {
    try {
      final result = await action(_repository);
      if (ref.mounted) adopt(result);
      return null;
    } on Object catch (error) {
      final failure = ApiFailure.from(error);
      // Someone else changed the family meanwhile: show the real state.
      if (ref.mounted && _isStale(failure)) await refresh();
      return failure;
    }
  }

  static bool _isStale(ApiFailure failure) => switch (failure.code) {
    'ALREADY_IN_FAMILY' ||
    'NOT_IN_FAMILY' ||
    'FAMILY_NOT_FOUND' ||
    'FAMILY_OWNER_ONLY' ||
    'FAMILY_MEMBER_NOT_FOUND' ||
    'JOIN_REQUEST_ALREADY_PENDING' ||
    'JOIN_REQUEST_NOT_FOUND' => true,
    _ => false,
  };
}
