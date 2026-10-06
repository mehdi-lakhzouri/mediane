import 'package:driver_health_app/core/network/api_failure.dart';
import 'package:driver_health_app/core/presentation/widgets/content_page.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/family/application/my_family_controller.dart';
import 'package:driver_health_app/features/family/domain/entities/family.dart';
import 'package:driver_health_app/features/family/presentation/family_messages.dart';
import 'package:driver_health_app/features/family/presentation/screens/create_or_join_view.dart';
import 'package:driver_health_app/features/family/presentation/screens/family_overview_view.dart';
import 'package:driver_health_app/features/family/presentation/screens/request_pending_view.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// The Family tab. Shows the family (19), the pending request (22), or the
/// create-or-join choice (20), depending on where the driver stands.
class FamilyScreen extends ConsumerWidget {
  const new({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(myFamilyControllerProvider);
    return switch (state) {
      AsyncData(value: MyFamily(family: final family?)) => FamilyOverviewView(
        family: family,
      ),
      AsyncData(value: MyFamily(pendingRequest: final request?)) =>
        RequestPendingView(request: request),
      AsyncData() => const CreateOrJoinView(),
      AsyncError(:final error) => ContentPage(
        title: 'Family',
        children: [
          InlineMessage(message: familyFailureMessage(ApiFailure.from(error))),
          TextButton(
            onPressed: () => ref.invalidate(myFamilyControllerProvider),
            child: const Text(
              'Try again',
              style: TextStyle(color: AppColors.cyan),
            ),
          ),
        ],
      ),
      _ => const ContentPage(
        title: 'Family',
        children: [
          Padding(
            padding: EdgeInsets.symmetric(vertical: 48),
            child: Center(
              child: CircularProgressIndicator(
                color: AppColors.cyan,
                semanticsLabel: 'Loading your family',
              ),
            ),
          ),
        ],
      ),
    };
  }
}
