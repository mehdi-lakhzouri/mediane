import 'package:driver_health_app/core/presentation/motion/motion.dart';
import 'package:driver_health_app/core/presentation/widgets/cabinguard_brand.dart';
import 'package:driver_health_app/features/startup/domain/entities/startup_decision.dart';
import 'package:driver_health_app/features/startup/presentation/controllers/startup_controller.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const new({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  static const _pages = [
    _OnboardingPageData(
      image: 'assets/images/onboarding-driver-protection.png',
      title: 'Protection on\nevery journey',
      description:
          'Stay connected to your health signals, journey history '
          'and safety alerts in one place.',
      features: [
        _FeatureData(Icons.monitor_heart_outlined, 'Health signals'),
        _FeatureData(Icons.history_rounded, 'Event history'),
        _FeatureData(Icons.notifications_active_outlined, 'Safety alerts'),
      ],
    ),
    _OnboardingPageData(
      image: 'assets/images/onboarding-emergency-response.png',
      title: 'Help when every\nsecond matters',
      description:
          'Get timely safety alerts and connect your emergency '
          'contacts with the context they need.',
      features: [
        _FeatureData(Icons.notifications_active_outlined, 'Safety alerts'),
        _FeatureData(Icons.location_on_outlined, 'Your location'),
        _FeatureData(Icons.people_alt_outlined, 'Trusted contacts'),
      ],
    ),
    _OnboardingPageData(
      image: 'assets/images/onboarding-family-connection.png',
      title: 'Your trusted circle,\nwithin reach',
      description:
          'Keep loved ones informed when it matters. Choose what '
          'you share and stay in control.',
      features: [
        _FeatureData(Icons.people_alt_outlined, 'Family access'),
        _FeatureData(Icons.admin_panel_settings_outlined, 'Private by default'),
        _FeatureData(Icons.tune_rounded, 'Sharing controls'),
      ],
    ),
  ];

  final _pageController = PageController();
  int _pageIndex = 0;
  bool _saving = false;
  bool _transitioning = false;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _goToPage(int index) async {
    if (_saving || _transitioning) return;
    if (Motion.reduced(context)) {
      _pageController.jumpToPage(index);
      return;
    }
    setState(() => _transitioning = true);
    try {
      await _pageController.animateToPage(
        index,
        duration: Motion.medium,
        curve: Motion.standard,
      );
    } finally {
      if (mounted) setState(() => _transitioning = false);
    }
  }

  Future<void> _continue() async {
    if (_saving || _transitioning) return;
    if (_pageIndex < _pages.length - 1) {
      await _goToPage(_pageIndex + 1);
    } else {
      await _finish();
    }
  }

  Future<void> _finish() async {
    if (_saving) return;
    setState(() => _saving = true);
    try {
      await ref.read(startupControllerProvider.notifier).completeOnboarding();
      if (mounted) context.goNamed(StartupDestination.login.name);
    } on Object {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Unable to save your preference. Try again.'),
        ),
      );
      setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
        systemNavigationBarColor: _Colors.surface,
        systemNavigationBarIconBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: _Colors.navy,
        body: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 600),
            child: Stack(
              children: [
                Column(
                  children: [
                    Expanded(
                      child: PageView.builder(
                        key: const ValueKey('onboarding-pages'),
                        controller: _pageController,
                        physics: _saving
                            ? const NeverScrollableScrollPhysics()
                            : null,
                        itemCount: _pages.length,
                        onPageChanged: (index) =>
                            setState(() => _pageIndex = index),
                        itemBuilder: (context, index) =>
                            _OnboardingPage(data: _pages[index], pages: _pages),
                      ),
                    ),
                    ColoredBox(
                      color: _Colors.surface,
                      child: SafeArea(
                        top: false,
                        child: Padding(
                          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              _PageIndicator(
                                count: _pages.length,
                                selected: _pageIndex,
                                onSelected: _saving || _transitioning
                                    ? null
                                    : _goToPage,
                              ),
                              const SizedBox(height: 12),
                              SizedBox(
                                width: double.infinity,
                                child: FilledButton(
                                  key: const ValueKey('onboarding-continue'),
                                  onPressed: _saving || _transitioning
                                      ? null
                                      : _continue,
                                  style: FilledButton.styleFrom(
                                    backgroundColor: _Colors.primary,
                                    foregroundColor: Colors.white,
                                    disabledBackgroundColor: _Colors.primary,
                                    disabledForegroundColor: Colors.white,
                                    minimumSize: const Size.fromHeight(56),
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 24,
                                      vertical: 16,
                                    ),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(18),
                                    ),
                                    textStyle: Theme.of(context)
                                        .textTheme
                                        .labelLarge
                                        ?.copyWith(
                                          fontSize: 17,
                                          fontWeight: FontWeight.w700,
                                        ),
                                  ),
                                  child: _saving
                                      ? Semantics(
                                          label: 'Saving your preference',
                                          child: const SizedBox.square(
                                            dimension: 22,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          ),
                                        )
                                      : Text(
                                          _pageIndex == _pages.length - 1
                                              ? 'Get started'
                                              : 'Continue',
                                        ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
                Positioned(
                  top: 0,
                  left: 24,
                  right: 16,
                  child: SafeArea(
                    bottom: false,
                    child: Padding(
                      padding: const EdgeInsets.only(top: 12),
                      child: Row(
                        children: [
                          const Expanded(
                            child: Align(
                              alignment: Alignment.centerLeft,
                              child: SizedBox(
                                width: 220,
                                height: 48,
                                child: FittedBox(
                                  alignment: Alignment.centerLeft,
                                  child: CabinGuardBrand(compact: true),
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          TextButton(
                            key: const ValueKey('onboarding-skip'),
                            onPressed: _saving ? null : _finish,
                            style: TextButton.styleFrom(
                              foregroundColor: Colors.white,
                              disabledForegroundColor: Colors.white70,
                              minimumSize: const Size(48, 48),
                              textStyle: Theme.of(context).textTheme.labelLarge
                                  ?.copyWith(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w500,
                                  ),
                            ),
                            child: const Text('Skip'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OnboardingPage extends StatelessWidget {
  const new({required this.data, required this.pages});

  final _OnboardingPageData data;
  final List<_OnboardingPageData> pages;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 360;
        final textScaler = MediaQuery.textScalerOf(context);
        final direction = Directionality.of(context);
        final contentWidth = constraints.maxWidth - 48;
        final bodyStyle = Theme.of(context).textTheme.bodyMedium!;
        final titleStyle = bodyStyle.copyWith(
          color: _Colors.ink,
          fontSize: compact ? 28 : 34,
          height: 1.08,
          fontWeight: FontWeight.w800,
          letterSpacing: -1.1,
        );
        final descriptionStyle = bodyStyle.copyWith(
          color: _Colors.muted,
          fontSize: 15,
          height: 1.45,
        );
        final featureStyle = bodyStyle.copyWith(
          color: _Colors.ink,
          fontSize: 13,
          height: 1.2,
          fontWeight: FontWeight.w600,
        );

        double textHeight(String text, TextStyle style, double width) {
          final painter = TextPainter(
            text: TextSpan(text: text, style: style),
            textDirection: direction,
            textScaler: textScaler,
          )..layout(maxWidth: width);
          final height = painter.height;
          painter.dispose();
          return height;
        }

        final tileWidth = (contentWidth - 20) / 3;
        final labelHeight = pages
            .expand((page) => page.features)
            .map(
              (feature) =>
                  textHeight(feature.label, featureStyle, tileWidth - 12),
            )
            .reduce((a, b) => a > b ? a : b);
        final tileHeight = 62 + labelHeight;
        final naturalPanelHeight = pages
            .map(
              (page) =>
                  44 +
                  textHeight(page.title, titleStyle, contentWidth) +
                  12 +
                  textHeight(page.description, descriptionStyle, contentWidth) +
                  18 +
                  tileHeight +
                  8,
            )
            .reduce((a, b) => a > b ? a : b);
        // Large system fonts can scroll while the photo stays visible.
        final panelHeight = naturalPanelHeight.clamp(
          0.0,
          constraints.maxHeight * 0.72,
        );

        return Stack(
          fit: StackFit.expand,
          children: [
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              bottom: panelHeight - 36,
              child: ExcludeSemantics(
                child: Image.asset(
                  data.image,
                  fit: BoxFit.cover,
                  alignment: Alignment.topCenter,
                  errorBuilder: (context, error, stackTrace) =>
                      const ColoredBox(color: _Colors.navy),
                ),
              ),
            ),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: MediaQuery.paddingOf(context).top + 100,
              child: const IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [Color(0x990B1020), Color(0x000B1020)],
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              height: panelHeight,
              child: ClipPath(
                clipper: const _PanelCurve(),
                child: ColoredBox(
                  color: _Colors.surface,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(24, 44, 24, 0),
                    child: SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Semantics(
                            header: true,
                            child: Text(data.title, style: titleStyle),
                          ),
                          const SizedBox(height: 12),
                          Text(data.description, style: descriptionStyle),
                          const SizedBox(height: 18),
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              for (
                                var i = 0;
                                i < data.features.length;
                                i++
                              ) ...[
                                if (i > 0) const SizedBox(width: 10),
                                Expanded(
                                  child: _FeatureTile(
                                    data: data.features[i],
                                    height: tileHeight,
                                    labelStyle: featureStyle,
                                  ),
                                ),
                              ],
                            ],
                          ),
                          const SizedBox(height: 8),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _FeatureTile extends StatelessWidget {
  const new({
    required this.data,
    required this.height,
    required this.labelStyle,
  });

  final _FeatureData data;
  final double height;
  final TextStyle labelStyle;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 12),
      decoration: BoxDecoration(
        color: _Colors.tile,
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          ExcludeSemantics(
            child: Icon(data.icon, color: _Colors.primary, size: 30),
          ),
          const SizedBox(height: 8),
          Text(data.label, textAlign: TextAlign.center, style: labelStyle),
        ],
      ),
    );
  }
}

class _PageIndicator extends StatelessWidget {
  const new({
    required this.count,
    required this.selected,
    required this.onSelected,
  });

  final int count;
  final int selected;
  final ValueChanged<int>? onSelected;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(
        count,
        (index) => Semantics(
          button: true,
          selected: index == selected,
          label: 'Onboarding page ${index + 1} of $count',
          child: Tooltip(
            message: 'Go to page ${index + 1}',
            child: InkResponse(
              key: ValueKey('onboarding-page-${index + 1}'),
              onTap: onSelected == null ? null : () => onSelected!(index),
              radius: 24,
              child: SizedBox(
                width: 40,
                height: 32,
                child: Center(
                  child: AnimatedContainer(
                    duration: Motion.reduced(context)
                        ? Duration.zero
                        : Motion.short,
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(
                      color: index == selected ? _Colors.primary : _Colors.dot,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _PanelCurve extends CustomClipper<Path> {
  const new();

  @override
  Path getClip(Size size) => Path()
    ..moveTo(0, 44)
    ..quadraticBezierTo(0, 20, 32, 20)
    ..lineTo(size.width * 0.66, 20)
    ..cubicTo(size.width * 0.72, 20, size.width * 0.72, 0, size.width * 0.81, 0)
    ..lineTo(size.width - 32, 0)
    ..quadraticBezierTo(size.width, 0, size.width, 24)
    ..lineTo(size.width, size.height)
    ..lineTo(0, size.height)
    ..close();

  @override
  bool shouldReclip(_PanelCurve oldClipper) => false;
}

abstract final class _Colors {
  static const primary = Color(0xFF3047D9);
  static const navy = Color(0xFF0B1020);
  static const surface = Color(0xFFF7F9FC);
  static const ink = Color(0xFF101828);
  static const muted = Color(0xFF667085);
  static const tile = Color(0xFFEAF2FF);
  static const dot = Color(0xFFD3E1F8);
}

class _OnboardingPageData {
  const new({
    required this.image,
    required this.title,
    required this.description,
    required this.features,
  });

  final String image;
  final String title;
  final String description;
  final List<_FeatureData> features;
}

class _FeatureData {
  const new(this.icon, this.label);

  final IconData icon;
  final String label;
}
