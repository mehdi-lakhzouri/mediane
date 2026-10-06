import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/network/network_providers.dart';
import 'package:driver_health_app/features/account_activation/data/repositories/remote_account_activation_repository.dart';
import 'package:driver_health_app/features/account_activation/domain/repositories/account_activation_repository.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final accountActivationRepositoryProvider =
    Provider<AccountActivationRepository>(
      (ref) => RemoteAccountActivationRepository(ref.watch(publicDioProvider)),
    );

class AccountActivationState {
  const new({this.submitting = false, this.activated = false, this.failure});

  final bool submitting;
  final bool activated;
  final ApiFailure? failure;

  /// Unknown, expired, revoked, and used invitations share this code.
  bool get invitationInvalid => failure?.code == 'INVITATION_INVALID';
}

final NotifierProvider<AccountActivationController, AccountActivationState>
accountActivationControllerProvider = NotifierProvider.autoDispose(
  AccountActivationController.new,
);

class AccountActivationController extends Notifier<AccountActivationState> {
  @override
  AccountActivationState build() => const AccountActivationState();

  Future<bool> activate(String token) async {
    if (state.submitting || state.activated) return false;
    state = const AccountActivationState(submitting: true);
    try {
      await ref
          .read(accountActivationRepositoryProvider)
          .acceptInvitation(token);
      if (ref.mounted) state = const AccountActivationState(activated: true);
      return true;
    } on Object catch (error) {
      if (ref.mounted) {
        state = AccountActivationState(failure: ApiFailure.from(error));
      }
      return false;
    }
  }

  void clearFailure() {
    if (state.failure != null) state = const AccountActivationState();
  }
}
