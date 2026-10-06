import 'package:driver_health_app/core/network/network_providers.dart';
import 'package:driver_health_app/core/security/security_providers.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/core/storage/storage_providers.dart';
import 'package:driver_health_app/features/startup/application/resolve_startup.dart';
import 'package:driver_health_app/features/startup/data/data_sources/onboarding_preferences.dart';
import 'package:driver_health_app/features/startup/data/data_sources/startup_remote_data_source.dart';
import 'package:driver_health_app/features/startup/data/repositories/startup_repository_impl.dart';
import 'package:driver_health_app/features/startup/domain/entities/startup_decision.dart';
import 'package:driver_health_app/features/startup/domain/repositories/startup_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final startupRemoteDataSourceProvider = Provider<StartupRemoteDataSource>((
  ref,
) {
  return StartupRemoteDataSource(ref.watch(publicDioProvider));
});

final onboardingPreferencesProvider = Provider<OnboardingPreferences>((ref) {
  return OnboardingPreferences(ref.watch(sharedPreferencesProvider));
});

final startupRepositoryProvider = Provider<StartupRepository>((ref) {
  return StartupRepositoryImpl(
    ref.watch(startupRemoteDataSourceProvider),
    ref.watch(sessionManagerProvider),
    ref.watch(onboardingPreferencesProvider),
    appLock: ref.watch(appLockProvider),
  );
});

final resolveStartupProvider = Provider<ResolveStartup>((ref) {
  return ResolveStartup(ref.watch(startupRepositoryProvider));
});

final startupControllerProvider =
    AsyncNotifierProvider<StartupController, StartupDecision>(
      StartupController.new,
    );

final minimumSplashDurationProvider = Provider<Duration>((ref) {
  return const Duration(milliseconds: 1300);
});

class StartupController extends AsyncNotifier<StartupDecision> {
  @override
  Future<StartupDecision> build() => ref.watch(resolveStartupProvider).call();

  Future<void> retry() async {
    state = const AsyncLoading();
    state = await AsyncValue.guard(ref.read(resolveStartupProvider).call);
  }

  Future<void> completeOnboarding() async {
    await ref.read(startupRepositoryProvider).completeOnboarding();
  }
}
