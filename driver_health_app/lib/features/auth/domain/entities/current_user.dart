import 'package:driver_health_app/core/session/account_state.dart';

class CurrentUser {
  const new({
    required this.userId,
    required this.email,
    required this.firstName,
    required this.lastName,
    required this.accountState,
  });

  final String userId;
  final String email;
  final String firstName;
  final String lastName;
  final AccountState accountState;
}
