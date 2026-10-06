import 'package:driver_health_app/core/network/network_providers.dart';
import 'package:driver_health_app/core/session/auth_state.dart';
import 'package:driver_health_app/core/session/session_api.dart';
import 'package:driver_health_app/core/session/session_manager.dart';
import 'package:driver_health_app/core/storage/storage_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final sessionApiProvider = Provider<SessionApi>((ref) {
  return SessionApi(ref.watch(publicDioProvider));
});

final sessionManagerProvider = Provider<SessionManager>((ref) {
  final manager = SessionManager(
    api: ref.watch(sessionApiProvider),
    store: ref.watch(secureSessionStoreProvider),
  );
  ref.onDispose(manager.dispose);
  return manager;
});

/// Rebuilds dependents whenever the session signs in, out, or changes step.
final authStateProvider = Provider<AuthState>((ref) {
  final manager = ref.watch(sessionManagerProvider);
  void onChange() => ref.invalidateSelf();
  manager.addListener(onChange);
  ref.onDispose(() => manager.removeListener(onChange));
  return manager.state;
});
