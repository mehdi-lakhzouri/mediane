/// Links meant for the app are published under `/mobile` on the web domain
/// (Android App Links), e.g. `https://mediane.example.com/mobile/accept-invitation`.
/// The web console owns every other path there.
const appLinkPrefix = '/mobile';

/// The in-app location for an app link: `/mobile/accept-invitation#token=x`
/// becomes `/accept-invitation#token=x`, keeping the query and the fragment
/// (where tokens and codes travel). Returns `null` for any other location.
String? appLinkLocation(Uri uri) {
  final path = uri.path;
  if (path != appLinkPrefix && !path.startsWith('$appLinkPrefix/')) {
    return null;
  }
  final inner = path.substring(appLinkPrefix.length);
  return Uri(
    path: inner.isEmpty ? '/' : inner,
    query: uri.hasQuery ? uri.query : null,
    fragment: uri.hasFragment ? uri.fragment : null,
  ).toString();
}
