/// Remembers a link the driver opened before they could see it (signed out,
/// still starting up, or locked) so it opens once they are fully signed in.
/// Kept in memory only: a link is an intent for this app session.
class PendingDeepLink {
  /// The link waiting to be opened, if any.
  Uri? value;

  /// Returns the link once and forgets it.
  Uri? take() {
    final uri = value;
    value = null;
    return uri;
  }
}
