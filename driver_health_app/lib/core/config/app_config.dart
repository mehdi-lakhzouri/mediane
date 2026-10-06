import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AppEnvironment { development, staging, production }

class AppConfig {
  const new({required this.environment, required this.apiBaseUrl});

  factory fromEnvironment() {
    const environmentName = String.fromEnvironment(
      'APP_ENV',
      defaultValue: 'development',
    );
    const configuredApiUrl = String.fromEnvironment('API_BASE_URL');

    final environment = AppEnvironment.values.firstWhere(
      (value) => value.name == environmentName,
      orElse: () => AppEnvironment.development,
    );
    final apiBaseUrl = configuredApiUrl.isNotEmpty
        ? configuredApiUrl
        : _developmentApiUrl();

    if (environment == AppEnvironment.production &&
        !apiBaseUrl.startsWith('https://')) {
      throw StateError('Production API_BASE_URL must use HTTPS.');
    }

    return AppConfig(
      environment: environment,
      apiBaseUrl: Uri.parse(apiBaseUrl),
    );
  }

  final AppEnvironment environment;
  final Uri apiBaseUrl;

  static String _developmentApiUrl() {
    if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
      return 'http://10.0.2.2:4000/api/v1';
    }
    return 'http://localhost:4000/api/v1';
  }
}

final appConfigProvider = Provider<AppConfig>((ref) {
  throw UnimplementedError('AppConfig must be overridden during bootstrap.');
});
