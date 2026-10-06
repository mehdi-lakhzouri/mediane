import 'package:driver_health_app/core/network/network_providers.dart';
import 'package:driver_health_app/core/storage/storage_providers.dart';
import 'package:driver_health_app/features/driver_profile/data/data_sources/profile_draft_store.dart';
import 'package:driver_health_app/features/driver_profile/data/repositories/remote_profile_repository.dart';
import 'package:driver_health_app/features/driver_profile/domain/repositories/profile_repository.dart';
import 'package:driver_health_app/features/startup/domain/entities/mobile_bootstrap.dart';
import 'package:driver_health_app/features/startup/presentation/controllers/startup_controller.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return RemoteProfileRepository(ref.watch(dioProvider));
});

final profileDraftStoreProvider = Provider<ProfileDraftStore>((ref) {
  return ProfileDraftStore(ref.watch(secureStorageProvider));
});

/// Profile rules from the bootstrap fetched at startup. A deep link can skip
/// startup, in which case the bootstrap is fetched here instead. Startup is
/// never triggered from here because it would rotate the session.
final FutureProvider<ProfileRules> profileRulesProvider = FutureProvider((
  ref,
) async {
  if (ref.exists(startupControllerProvider)) {
    final decision = ref.read(startupControllerProvider).value;
    if (decision != null) return decision.bootstrap.profileRules;
  }
  final bootstrap = await ref.read(startupRepositoryProvider).fetchBootstrap();
  return bootstrap.profileRules;
});
