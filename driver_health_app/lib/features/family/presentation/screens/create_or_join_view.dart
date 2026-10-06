import 'dart:async';

import 'package:driver_health_app/app/router/app_routes.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_text_field.dart';
import 'package:driver_health_app/core/presentation/widgets/content_page.dart';
import 'package:driver_health_app/core/presentation/widgets/gradient_button.dart';
import 'package:driver_health_app/core/presentation/widgets/inline_message.dart';
import 'package:driver_health_app/core/presentation/widgets/surface_card.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:driver_health_app/features/family/application/my_family_controller.dart';
import 'package:driver_health_app/features/family/domain/family_code.dart';
import 'package:driver_health_app/features/family/presentation/family_messages.dart';
import 'package:driver_health_app/features/family/presentation/widgets/invite_code_field.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

/// Screen 20: start a family, or preview one from its code before asking.
class CreateOrJoinView extends ConsumerStatefulWidget {
  const new({super.key});

  static const nameFieldKey = Key('family.create.name');
  static const codeFieldKey = Key('family.join.code');

  @override
  ConsumerState<CreateOrJoinView> createState() => _CreateOrJoinViewState();
}

class _CreateOrJoinViewState extends ConsumerState<CreateOrJoinView> {
  static const _nameMaxLength = 80;

  final _nameForm = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _code = TextEditingController();
  bool _creating = false;
  String? _createError;
  String? _codeError;

  @override
  void dispose() {
    _name.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _create() async {
    if (!(_nameForm.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    setState(() {
      _creating = true;
      _createError = null;
    });
    final failure = await ref
        .read(myFamilyControllerProvider.notifier)
        .create(_name.text);
    if (!mounted) return;
    if (failure != null) {
      setState(() {
        _creating = false;
        _createError = familyFailureMessage(failure);
      });
      return;
    }
    // The tab now shows the new family; inviting is the natural next step.
    unawaited(context.push(AppRoutes.familyInvite));
  }

  void _preview() {
    final code = FamilyCode.extract(_code.text);
    if (code == null) {
      setState(
        () => _codeError = 'Enter the 8-character code, like K7M4-QX9P.',
      );
      return;
    }
    FocusScope.of(context).unfocus();
    unawaited(context.push(AppRoutes.familyPreview(code)));
  }

  @override
  Widget build(BuildContext context) {
    return ContentPage(
      title: 'Family',
      subtitle: 'Stay connected with the people who matter.',
      backgroundAlignment: const Alignment(0, -0.5),
      children: [
        SurfaceCard(
          child: Form(
            key: _nameForm,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const _CardHeading(
                  icon: Icons.shield_outlined,
                  title: 'Create a family',
                  message:
                      'Start a private family group and invite the people you '
                      'trust.',
                ),
                const SizedBox(height: 16),
                if (_createError case final error?) ...[
                  InlineMessage(message: error),
                  const SizedBox(height: 12),
                ],
                CabinGuardTextField(
                  key: CreateOrJoinView.nameFieldKey,
                  label: 'Family name',
                  controller: _name,
                  hintText: 'Ben Salah family',
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.done,
                  enabled: !_creating,
                  onFieldSubmitted: (_) => unawaited(_create()),
                  validator: (value) {
                    final name = value?.trim() ?? '';
                    if (name.isEmpty) return 'Give your family a name.';
                    if (name.length > _nameMaxLength) {
                      return 'Use $_nameMaxLength characters or fewer.';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),
                GradientButton(
                  label: 'Create family',
                  loading: _creating,
                  onPressed: () => unawaited(_create()),
                ),
              ],
            ),
          ),
        ),
        const _OrDivider(),
        SurfaceCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const _CardHeading(
                icon: Icons.link_rounded,
                title: 'Join a family',
                message:
                    'Enter the 8-character code shared by the family owner.',
              ),
              const SizedBox(height: 16),
              InviteCodeField(
                key: CreateOrJoinView.codeFieldKey,
                controller: _code,
                errorText: _codeError,
                onChanged: (_) {
                  if (_codeError != null) setState(() => _codeError = null);
                },
                onSubmitted: (_) => _preview(),
              ),
              const SizedBox(height: 14),
              OutlinedButton.icon(
                onPressed: _preview,
                icon: const Icon(Icons.arrow_forward_rounded),
                label: const Text('Preview family'),
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.cyan,
                  minimumSize: const Size.fromHeight(54),
                  side: const BorderSide(color: AppColors.cyan),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(18),
                  ),
                  textStyle: Theme.of(context).textTheme.labelLarge
                      ?.copyWith(fontSize: 16),
                ),
              ),
              TextButton.icon(
                onPressed: () => unawaited(context.push(AppRoutes.familyScan)),
                icon: const Icon(Icons.qr_code_scanner_rounded),
                label: const Text('Scan a QR code instead'),
                style: TextButton.styleFrom(foregroundColor: AppColors.cyan),
              ),
              const SizedBox(height: 4),
              const Row(
                children: [
                  Icon(
                    Icons.lock_outline_rounded,
                    color: AppColors.slate,
                    size: 18,
                  ),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Joining requires approval from the family owner.',
                      style: TextStyle(color: AppColors.slate, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _CardHeading extends StatelessWidget {
  const new({required this.icon, required this.title, required this.message});

  final IconData icon;
  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 52,
          height: 52,
          decoration: BoxDecoration(
            color: AppColors.cobalt.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.cyan.withValues(alpha: 0.3)),
          ),
          child: Icon(icon, color: AppColors.cyan),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Semantics(
                header: true,
                child: Text(
                  title,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 19,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              const SizedBox(height: 4),
              Text(message, style: const TextStyle(color: AppColors.slate)),
            ],
          ),
        ),
      ],
    );
  }
}

class _OrDivider extends StatelessWidget {
  const new();

  @override
  Widget build(BuildContext context) {
    final line = Expanded(
      child: Divider(color: AppColors.slate.withValues(alpha: 0.3)),
    );
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14),
      child: Row(
        children: [
          line,
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 12),
            child: Text('or', style: TextStyle(color: AppColors.slate)),
          ),
          line,
        ],
      ),
    );
  }
}
