/// Extracts the single-use token from an emailed link. The backend puts it in
/// the fragment (`#token=…`) so it never reaches server logs; `?token=` is
/// accepted for links rewritten by mail clients.
String linkToken(Uri uri) {
  final queryToken = uri.queryParameters['token'];
  if (queryToken != null && queryToken.isNotEmpty) return queryToken;
  final fragment = uri.fragment;
  if (fragment.isEmpty) return '';
  if (!fragment.contains('=')) return Uri.decodeComponent(fragment);
  try {
    return Uri.splitQueryString(fragment)['token'] ?? '';
  } on FormatException {
    return '';
  }
}

/// Accepts a pasted invitation link or a bare token.
String tokenFromPastedText(String text) {
  final value = text.trim();
  if (value.isEmpty) return '';
  final uri = Uri.tryParse(value);
  if (uri != null && (uri.hasFragment || uri.hasQuery)) {
    final token = linkToken(uri);
    if (token.isNotEmpty) return token;
  }
  return RegExp(r'^[A-Za-z0-9_-]{32,256}$').hasMatch(value) ? value : '';
}
