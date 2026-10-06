import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/network/network_providers.dart';
import 'package:driver_health_app/features/security/data/repositories/remote_sessions_repository.dart';
import 'package:driver_health_app/features/security/domain/entities/active_session.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final sessionsRepositoryProvider = Provider<RemoteSessionsRepository>(
  (ref) => RemoteSessionsRepository(ref.watch(dioProvider)),
);

/// Devices signed in to the account, this one first.
final AsyncNotifierProvider<ActiveSessionsController, List<ActiveSession>>
activeSessionsControllerProvider = AsyncNotifierProvider.autoDispose(
  ActiveSessionsController.new,
);

class ActiveSessionsController extends AsyncNotifier<List<ActiveSession>> {
  RemoteSessionsRepository get _repository =>
      ref.read(sessionsRepositoryProvider);

  @override
  Future<List<ActiveSession>> build() async =>
      _currentFirst(await ref.read(sessionsRepositoryProvider).list());

  Future<void> refresh() async {
    state = await AsyncValue.guard(
      () async => _currentFirst(await _repository.list()),
    );
  }

  /// Returns the failure to show, or `null` once the device is signed out.
  Future<ApiFailure?> revoke(String sessionId) => _run(() async {
    await _repository.revoke(sessionId);
  });

  Future<ApiFailure?> revokeOthers() => _run(() async {
    await _repository.revokeOthers();
  });

  Future<ApiFailure?> _run(Future<void> Function() action) async {
    try {
      await action();
      if (ref.mounted) await refresh();
      return null;
    } on Object catch (error) {
      final failure = ApiFailure.from(error);
      // Already gone elsewhere: show the real list.
      if (ref.mounted && failure.code == 'SESSION_NOT_FOUND') await refresh();
      return failure;
    }
  }

  static List<ActiveSession> _currentFirst(List<ActiveSession> sessions) => [
    ...sessions.where((s) => s.current),
    ...sessions.where((s) => !s.current),
  ];
}
