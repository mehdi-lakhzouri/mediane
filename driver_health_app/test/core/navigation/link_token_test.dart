import 'package:driver_health_app/core/navigation/link_token.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const token = 'invite-token-0000000000000000000000000000001';

  test('reads the token from the fragment the backend emails', () {
    expect(
      linkToken(
        Uri.parse('https://cabinguard.app/accept-invitation#token=$token'),
      ),
      token,
    );
  });

  test('accepts links whose token was moved to the query', () {
    expect(linkToken(Uri.parse('/accept-invitation?token=$token')), token);
  });

  test('returns nothing for a link without a token', () {
    expect(linkToken(Uri.parse('/accept-invitation')), isEmpty);
  });

  test('extracts a token from pasted links or bare tokens only', () {
    expect(
      tokenFromPastedText(
        '  https://cabinguard.app/accept-invitation#token=$token ',
      ),
      token,
    );
    expect(tokenFromPastedText(token), token);
    expect(tokenFromPastedText('hello there'), isEmpty);
    expect(tokenFromPastedText('https://cabinguard.app/'), isEmpty);
  });
}
