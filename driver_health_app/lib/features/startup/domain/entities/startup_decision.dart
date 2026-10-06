import 'package:driver_health_app/features/startup/domain/entities/mobile_bootstrap.dart';

enum StartupDestination {
  onboarding,
  login,
  passwordChange,
  mfaSetup,
  profileSetup,
  home,
  maintenance,
  mandatoryUpdate,
  offline,
  unavailable,
  sessionEnded,
}

class StartupDecision {
  const new({required this.destination, required this.bootstrap});

  final StartupDestination destination;
  final MobileBootstrap bootstrap;
}
