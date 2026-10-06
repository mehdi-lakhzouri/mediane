import 'package:driver_health_app/core/network/network_providers.dart';
import 'package:driver_health_app/features/auth/data/repositories/remote_auth_repository.dart';
import 'package:driver_health_app/features/auth/domain/entities/current_user.dart';
import 'package:driver_health_app/features/auth/domain/repositories/auth_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return RemoteAuthRepository(ref.watch(dioProvider));
});

final FutureProvider<CurrentUser> currentUserProvider =
    FutureProvider.autoDispose((ref) {
      return ref.watch(authRepositoryProvider).currentUser();
    });
