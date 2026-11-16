import 'package:driver_health_app/features/safety/domain/entities/medical_event.dart';
import 'package:url_launcher/url_launcher.dart';

/// Emergency medical services (SAMU, Tunisia). Shown when the app cannot
/// reach Mediane or the driver wants to call directly.
const emergencyNumber = '190';

/// Opens the phone dialer. Returns `false` when no dialer is available.
Future<bool> callNumber(String number) =>
    launchUrl(Uri(scheme: 'tel', path: number));

/// Opens the location in a maps app (or the browser).
Future<bool> openInMaps(GeoPoint point) => launchUrl(
  Uri.https('www.google.com', '/maps/search/', {
    'api': '1',
    'query': '${point.latitude},${point.longitude}',
  }),
  mode: LaunchMode.externalApplication,
);
