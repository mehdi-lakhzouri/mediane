import 'package:driver_health_app/core/navigation/app_link.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  group('appLinkLocation', () {
    test('maps an app link to its in-app route, keeping the fragment', () {
      expect(
        appLinkLocation(Uri.parse('/mobile/accept-invitation#token=abc')),
        '/accept-invitation#token=abc',
      );
      expect(
        appLinkLocation(Uri.parse('/mobile/join-family#K7M4-QX9P')),
        '/join-family#K7M4-QX9P',
      );
    });

    test('keeps a query string', () {
      expect(
        appLinkLocation(Uri.parse('/mobile/reset-password?token=abc')),
        '/reset-password?token=abc',
      );
    });

    test('reads the path of a full https link', () {
      expect(
        appLinkLocation(
          Uri.parse(
            'https://app.vunlera.tn/mobile/accept-invitation#token=abc',
          ),
        ),
        '/accept-invitation#token=abc',
      );
    });

    test('leaves every other location alone', () {
      expect(appLinkLocation(Uri.parse('/accept-invitation#token=abc')), null);
      expect(appLinkLocation(Uri.parse('/mobileapp/accept-invitation')), null);
      expect(appLinkLocation(Uri.parse('/home')), null);
    });

    test('maps the bare prefix to the start of the app', () {
      expect(appLinkLocation(Uri.parse('/mobile')), '/');
    });
  });
}
