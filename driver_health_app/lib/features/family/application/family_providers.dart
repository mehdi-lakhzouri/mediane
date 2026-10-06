import 'package:driver_health_app/core/network/network_providers.dart';
import 'package:driver_health_app/features/family/data/remote_family_repository.dart';
import 'package:driver_health_app/features/family/domain/entities/family_invite.dart';
import 'package:driver_health_app/features/family/domain/repositories/family_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart';

final familyRepositoryProvider = Provider<FamilyRepository>(
  (ref) => RemoteFamilyRepository(ref.watch(dioProvider)),
);

/// The family a code belongs to, fetched before asking to join.
final FutureProviderFamily<FamilyInvitePreview, String> invitePreviewProvider =
    FutureProvider.autoDispose.family<FamilyInvitePreview, String>(
      (ref, code) => ref.watch(familyRepositoryProvider).preview(code),
    );
