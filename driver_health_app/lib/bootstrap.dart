import 'dart:async';

import 'package:driver_health_app/app/app.dart';
import 'package:driver_health_app/core/config/app_config.dart';
import 'package:driver_health_app/core/network/client_identity.dart';
import 'package:driver_health_app/core/network/retry_policy.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:logging/logging.dart';

Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  final config = AppConfig.fromEnvironment();
  _configureLogging(config);
  final userAgent = await buildUserAgent();

  FlutterError.onError = (details) {
    FlutterError.presentError(details);
    Logger('Flutter')
        .severe(details.exceptionAsString(), details.exception, details.stack);
  };
  PlatformDispatcher.instance.onError = (error, stackTrace) {
    Logger('Platform').severe('Uncaught platform error', error, stackTrace);
    return true;
  };

  runApp(
    ProviderScope(
      retry: retryConnectivityFailures,
      overrides: [
        appConfigProvider.overrideWithValue(config),
        userAgentProvider.overrideWithValue(userAgent),
      ],
      child: const CabinGuardApp(),
    ),
  );
}

void _configureLogging(AppConfig config) {
  hierarchicalLoggingEnabled = true;
  Logger.root.level = config.environment == AppEnvironment.production
      ? Level.WARNING
      : Level.INFO;
  Logger.root.onRecord.listen((record) {
    if (kDebugMode) {
      debugPrint(
        '${record.time.toIso8601String()} '
        '${record.level.name} ${record.loggerName}: ${record.message}',
      );
    }
  });
}
