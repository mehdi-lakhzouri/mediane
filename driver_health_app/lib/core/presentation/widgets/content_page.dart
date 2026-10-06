import 'package:driver_health_app/core/presentation/motion/entrance.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_background.dart';
import 'package:driver_health_app/core/theme/app_colors.dart';
import 'package:flutter/material.dart';

/// Scrollable content screen over the road artwork: optional back button,
/// a large title with subtitle, then [children]. Used by list-style screens
/// (family, settings) as opposed to the centered auth panels.
///
/// The title and content enter with a short stagger, once. Screens that load
/// their content pass an [entranceKey] that changes when it arrives (for
/// example the loading state), so the content enters instead of popping in.
class ContentPage extends StatelessWidget {
  const new({
    required this.title,
    required this.children,
    this.subtitle,
    this.onBack,
    this.trailing,
    this.onRefresh,
    this.backgroundAlignment = const Alignment(0, -0.4),
    this.entranceKey,
    super.key,
  });

  final String title;
  final String? subtitle;
  final VoidCallback? onBack;
  final Widget? trailing;
  final List<Widget> children;

  /// Enables pull-to-refresh.
  final Future<void> Function()? onRefresh;
  final Alignment backgroundAlignment;

  /// Replays the entrance when it changes.
  final Object? entranceKey;

  @override
  Widget build(BuildContext context) {
    final list = ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        SizedBox(
          height: 48,
          child: Row(
            children: [
              if (onBack != null)
                IconButton(
                  onPressed: onBack,
                  tooltip: 'Back',
                  color: AppColors.ice,
                  icon: const Icon(Icons.chevron_left_rounded, size: 30),
                ),
              const Spacer(),
              ?trailing,
            ],
          ),
        ),
        const SizedBox(height: 8),
        Entrance(
          child: Semantics(
            header: true,
            child: Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 32,
                fontWeight: FontWeight.w900,
                letterSpacing: -0.6,
              ),
            ),
          ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 6),
          Entrance(
            index: 1,
            child: Text(
              subtitle!,
              style: const TextStyle(
                color: AppColors.slate,
                fontSize: 16,
                height: 1.4,
              ),
            ),
          ),
        ],
        const SizedBox(height: 20),
        ...staggered(children, from: 2),
      ],
    );

    return Scaffold(
      backgroundColor: AppColors.navy950,
      body: CabinGuardBackground(
        alignment: backgroundAlignment,
        overlayStrength: 0.35,
        child: SafeArea(
          bottom: false,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 600),
              child: EntranceScope(
                key: ValueKey(entranceKey),
                child: onRefresh == null
                    ? list
                    : RefreshIndicator(
                        color: AppColors.cyan,
                        backgroundColor: AppColors.navy900,
                        onRefresh: onRefresh!,
                        child: list,
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
