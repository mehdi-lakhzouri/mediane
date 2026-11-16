import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:package_info_plus/package_info_plus.dart';

/// `Mediane/<version> (<OS> <release>; <model>)`, sent on every request so
/// "Active devices" can name this phone. `null` keeps Dio's default (tests,
/// web, where browsers own the header).
final userAgentProvider = Provider<String?>((ref) => null);

/// Builds the user agent at startup. Best effort: any failure falls back to
/// a generic value rather than delaying launch.
Future<String?> buildUserAgent() async {
  if (kIsWeb) return null;
  try {
    final version = (await PackageInfo.fromPlatform()).version;
    final info = DeviceInfoPlugin();
    final (os, model) = switch (defaultTargetPlatform) {
      TargetPlatform.android => await _android(info),
      TargetPlatform.iOS => await _ios(info),
      _ => (defaultTargetPlatform.name, 'Device'),
    };
    return 'Mediane/${_clean(version)} (${_clean(os)}; ${_clean(model)})';
  } on Object {
    return 'Mediane/unknown (${defaultTargetPlatform.name}; Device)';
  }
}

Future<(String, String)> _android(DeviceInfoPlugin info) async {
  final device = await info.androidInfo;
  final model =
      device.model.toLowerCase().startsWith(device.manufacturer.toLowerCase())
      ? device.model
      : '${device.manufacturer} ${device.model}';
  return ('Android ${device.version.release}', model);
}

Future<(String, String)> _ios(DeviceInfoPlugin info) async {
  final device = await info.iosInfo;
  return ('iOS ${device.systemVersion}', device.utsname.machine);
}

/// Header values must be ASCII and must not break the `(os; model)` shape.
String _clean(String value) {
  final ascii = value.replaceAll(RegExp(r'[^\x20-\x7E]'), '');
  final safe = ascii.replaceAll(RegExp('[();]'), ' ').trim();
  return safe.isEmpty ? 'unknown' : safe.replaceAll(RegExp(r'\s+'), ' ');
}
