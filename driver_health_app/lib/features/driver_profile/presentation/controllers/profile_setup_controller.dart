import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/session/auth_state.dart';
import 'package:driver_health_app/core/session/session_providers.dart';
import 'package:driver_health_app/features/driver_profile/data/data_sources/profile_draft_store.dart';
import 'package:driver_health_app/features/driver_profile/domain/entities/driver_profile.dart';
import 'package:driver_health_app/features/driver_profile/presentation/controllers/profile_providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

class ProfileSetupState {
  const new({
    this.phoneNumber,
    this.dateOfBirth,
    this.gender,
    this.contacts = const [],
    this.savedContacts = const [],
    this.avatar,
    this.contactsConsent = false,
    this.submitting = false,
    this.failure,
  });

  final String? phoneNumber;
  final DateTime? dateOfBirth;
  final Gender? gender;

  /// Priority order: the first contact is called first.
  final List<EmergencyContact> contacts;

  /// The list the server holds, to tell whether the driver changed it.
  final List<EmergencyContact> savedContacts;
  final ProfileAvatar? avatar;
  final bool contactsConsent;
  final bool submitting;
  final ApiFailure? failure;

  /// New or edited contacts need the driver to confirm their consent again.
  bool get contactsChanged {
    if (contacts.length != savedContacts.length) return true;
    for (var i = 0; i < contacts.length; i++) {
      final a = contacts[i];
      final b = savedContacts[i];
      if (a.fullName != b.fullName ||
          a.phoneNumber != b.phoneNumber ||
          a.relationship != b.relationship) {
        return true;
      }
    }
    return false;
  }

  bool get detailsComplete =>
      phoneNumber != null && dateOfBirth != null && gender != null;

  /// Server validation messages keyed by field path, such as `dateOfBirth`
  /// or `emergencyContacts.1.phoneNumber`.
  Map<String, String> get fieldErrors => {
    for (final detail in failure?.details ?? const <ApiFieldError>[])
      if (detail.field != null) detail.field!: detail.message,
  };

  ProfileSetupState copyWith({
    List<EmergencyContact>? contacts,
    List<EmergencyContact>? savedContacts,
    ProfileAvatar? Function()? avatar,
    bool? contactsConsent,
    bool? submitting,
    ApiFailure? Function()? failure,
  }) {
    return ProfileSetupState(
      phoneNumber: phoneNumber,
      dateOfBirth: dateOfBirth,
      gender: gender,
      contacts: contacts ?? this.contacts,
      savedContacts: savedContacts ?? this.savedContacts,
      avatar: avatar == null ? this.avatar : avatar(),
      contactsConsent: contactsConsent ?? this.contactsConsent,
      submitting: submitting ?? this.submitting,
      failure: failure == null ? this.failure : failure(),
    );
  }

  ProfileSetupState withDetails({
    required String phoneNumber,
    required DateTime dateOfBirth,
    required Gender gender,
  }) {
    return ProfileSetupState(
      phoneNumber: phoneNumber,
      dateOfBirth: dateOfBirth,
      gender: gender,
      contacts: contacts,
      savedContacts: savedContacts,
      avatar: avatar,
      contactsConsent: contactsConsent,
    );
  }
}

/// Keeps the multi-step answers (screens 14 and 15) for the signed-in user.
/// Answers are mirrored to an encrypted draft so an interrupted onboarding
/// resumes where it stopped.
final AsyncNotifierProvider<ProfileSetupController, ProfileSetupState>
profileSetupControllerProvider = AsyncNotifierProvider(
  ProfileSetupController.new,
);

class ProfileSetupController extends AsyncNotifier<ProfileSetupState> {
  String? _userId;

  @override
  Future<ProfileSetupState> build() async {
    _userId = ref.watch(
      authStateProvider.select(
        (state) => state is AuthSignedIn ? state.userId : null,
      ),
    );
    final userId = _userId;
    if (userId == null) return const ProfileSetupState();

    final profile = await ref.read(profileRepositoryProvider).fetch();
    final draft = await ref.read(profileDraftStoreProvider).read(userId);
    final contacts = draft?.emergencyContacts ?? const <EmergencyContact>[];
    return ProfileSetupState(
      phoneNumber: draft?.phoneNumber ?? profile.phoneNumber,
      dateOfBirth: draft?.dateOfBirth ?? profile.dateOfBirth,
      gender: draft?.gender ?? profile.gender,
      contacts: contacts.isNotEmpty ? contacts : profile.emergencyContacts,
      savedContacts: profile.emergencyContacts,
      avatar: profile.avatar,
    );
  }

  Future<void> saveDetails({
    required String phoneNumber,
    required DateTime dateOfBirth,
    required Gender gender,
  }) async {
    final current = state.value;
    if (current == null) return;
    await _update(
      current.withDetails(
        phoneNumber: phoneNumber,
        dateOfBirth: dateOfBirth,
        gender: gender,
      ),
    );
  }

  Future<void> saveContact(EmergencyContact contact, {int? index}) async {
    final current = state.value;
    if (current == null) return;
    final contacts = [...current.contacts];
    if (index == null) {
      contacts.add(contact);
    } else {
      contacts[index] = contact;
    }
    await _update(current.copyWith(contacts: contacts, failure: () => null));
  }

  Future<void> removeContact(int index) async {
    final current = state.value;
    if (current == null) return;
    final contacts = [...current.contacts]..removeAt(index);
    await _update(current.copyWith(contacts: contacts, failure: () => null));
  }

  Future<void> moveContact(int from, int to) async {
    final current = state.value;
    if (current == null || from == to) return;
    final contacts = [...current.contacts];
    final moved = contacts.removeAt(from);
    contacts.insert(to.clamp(0, contacts.length), moved);
    await _update(current.copyWith(contacts: contacts, failure: () => null));
  }

  void setConsent({required bool accepted}) {
    final current = state.value;
    if (current != null) {
      state = AsyncData(current.copyWith(contactsConsent: accepted));
    }
  }

  void avatarChanged(ProfileAvatar? avatar) {
    final current = state.value;
    if (current != null) {
      state = AsyncData(current.copyWith(avatar: () => avatar));
    }
  }

  /// Saves the complete profile. Routing then follows the account state the
  /// server returns.
  Future<bool> submit() async {
    final current = state.value;
    if (current == null || current.submitting || !current.detailsComplete) {
      return false;
    }
    state = AsyncData(current.copyWith(submitting: true, failure: () => null));

    try {
      final profile = await ref
          .read(profileRepositoryProvider)
          .save(
            ProfileDetails(
              phoneNumber: current.phoneNumber!,
              dateOfBirth: current.dateOfBirth!,
              gender: current.gender!,
              emergencyContacts: current.contacts,
            ),
          );
      final userId = _userId;
      if (userId != null) {
        await ref.read(profileDraftStoreProvider).clear(userId);
      }
      if (ref.mounted) {
        state = AsyncData(
          current.copyWith(
            submitting: false,
            savedContacts: profile.emergencyContacts,
            contactsConsent: false,
          ),
        );
      }
      ref.read(sessionManagerProvider).syncAccountState(profile.accountState);
      return true;
    } on Object catch (error) {
      if (ref.mounted) {
        state = AsyncData(
          current.copyWith(
            submitting: false,
            failure: () => ApiFailure.from(error),
          ),
        );
      }
      return false;
    }
  }

  Future<void> _update(ProfileSetupState next) async {
    state = AsyncData(next);
    final userId = _userId;
    if (userId == null) return;
    await ref
        .read(profileDraftStoreProvider)
        .write(
          userId,
          ProfileDraft(
            phoneNumber: next.phoneNumber,
            dateOfBirth: next.dateOfBirth,
            gender: next.gender,
            emergencyContacts: next.contacts,
          ),
        );
  }
}
