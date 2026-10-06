import 'package:driver_health_app/core/network/network_providers.dart';
import 'package:driver_health_app/features/password_recovery/data/repositories/remote_password_recovery_repository.dart';
import 'package:driver_health_app/features/password_recovery/domain/repositories/password_recovery_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final passwordRecoveryRepositoryProvider = Provider<PasswordRecoveryRepository>(
  (ref) => RemotePasswordRecoveryRepository(ref.watch(publicDioProvider)),
);
