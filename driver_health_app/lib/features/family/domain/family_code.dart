import 'package:driver_health_app/core/navigation/link_token.dart';

/// Family join codes: 8 letters or digits, shown as K7M4-QX9P. Matching is
/// case-insensitive and ignores the dash and spaces, like the backend.
abstract final class FamilyCode {
  static const length = 8;

  static final _allowed = RegExp(r'^[A-Z0-9]{8}$');

  /// Uppercase, without separators.
  static String normalize(String input) =>
      input.toUpperCase().replaceAll(RegExp('[^A-Z0-9]'), '');

  static bool isValid(String input) => _allowed.hasMatch(normalize(input));

  /// K7M4-QX9P, or the normalized input when it is not a full code.
  static String format(String input) {
    final code = normalize(input);
    return code.length == length
        ? '${code.substring(0, 4)}-${code.substring(4)}'
        : code;
  }

  /// Accepts a typed code, a pasted invitation link, or a scanned QR code.
  /// Returns `null` when no valid code can be found.
  static String? extract(String input) {
    final text = input.trim();
    final uri = Uri.tryParse(text);
    if (uri != null && uri.hasScheme) {
      final fromLink = linkToken(uri);
      return isValid(fromLink) ? format(fromLink) : null;
    }
    return isValid(text) ? format(text) : null;
  }
}
