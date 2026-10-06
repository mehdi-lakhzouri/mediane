import 'package:driver_health_app/core/network/api_failure.dart';

/// User-facing wording for family failures. Server messages are safe to show
/// but generic; these explain what happened and what to do next.
String familyFailureMessage(ApiFailure failure) {
  return switch (failure.code) {
    'FAMILY_INVITE_INVALID' =>
      'This code doesn’t match an active family. Check it with the family '
          'owner, or ask them for a new one.',
    'FAMILY_FULL' =>
      'This family is full. The owner needs to free a place first.',
    'ALREADY_IN_FAMILY' =>
      'You’re already part of a family. Leave it before joining another.',
    'JOIN_REQUEST_ALREADY_PENDING' =>
      'You already have a request waiting. Withdraw it to ask another family.',
    'JOIN_REQUEST_CLOSED' || 'JOIN_REQUEST_NOT_FOUND' =>
      'This request was already answered or has expired.',
    'FAMILY_OWNER_ONLY' => 'Only the family owner can do this.',
    'FAMILY_MEMBER_NOT_FOUND' => 'This person is no longer in the family.',
    'NOT_IN_FAMILY' ||
    'FAMILY_NOT_FOUND' => 'You’re no longer part of this family.',
    _ => switch (failure.kind) {
      ApiFailureKind.rateLimited =>
        'Too many attempts. Wait a little and try again.',
      ApiFailureKind.server || ApiFailureKind.protocol =>
        'This couldn’t be completed right now. Try again shortly.',
      _ => failure.message,
    },
  };
}
