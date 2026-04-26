/// Subscription plans and feature gating configuration
class SubscriptionConfig {
  SubscriptionConfig._();

  // Plan names
  static const String planFree = 'free';
  static const String planPro = 'pro';

  // RevenueCat Product IDs (must match Google Play Console)
  static const String monthlyProductId = 'flowmind_pro_monthly';
  static const String yearlyProductId = 'flowmind_pro_yearly';

  // RevenueCat Entitlement
  static const String entitlementId = 'pro';

  // Free tier trial limits for premium features
  static const int freeVoiceTrialLimit = 2;
  static const int freeImageTrialLimit = 3;
  static const int freeInsightViews = 0; // Insights are premium-only

  // Pro tier limits
  static const int proVoiceMonthly = 999999; // unlimited
  static const int proImageMonthly = 999999;

  // AI usage
  static const int freeAiMonthlyQuota = 0;
  static const int proAiMonthlyQuota = 500;

  // Pricing (fallback when offerings aren't loaded)
  static const double proMonthlyPrice = 5.00;
  static const double proYearlyPrice = 48.00;
  static const String currency = 'USD';

  /// Features and which plan they require
  static const Map<String, String> featurePlanRequirement = {
    'text_input': planFree,
    'voice_input': planPro, // trial available
    'image_input': planPro, // trial available
    'ai_insights': planPro,
    'ai_forecast': planPro,
    'export_data': planPro,
    'custom_categories': planFree,
    'budgets': planFree,
    'multi_account': planFree,
    'alerts': planFree,
  };

  /// Features that have a free trial (limited uses)
  static const Map<String, int> trialLimits = {
    'voice_input': freeVoiceTrialLimit,
    'image_input': freeImageTrialLimit,
  };

  /// Display info for plans
  static List<PlanFeature> get proFeatures => [
    PlanFeature(
      icon: '🎤',
      title: 'Entrada por voz ilimitada',
      description: 'Dicta tus gastos sin límite',
    ),
    PlanFeature(
      icon: '📸',
      title: 'Escaneo de tickets ilimitado',
      description: 'Fotografía y clasifica automáticamente',
    ),
    PlanFeature(
      icon: '🧠',
      title: 'Insights con IA',
      description: 'Análisis inteligente de tus finanzas',
    ),
    PlanFeature(
      icon: '📊',
      title: 'Pronósticos financieros',
      description: 'Predicciones basadas en tus patrones',
    ),
    PlanFeature(
      icon: '📤',
      title: 'Exportar datos',
      description: 'Descarga tus datos en CSV o JSON',
    ),
    PlanFeature(
      icon: '⚡',
      title: 'Sin límites de IA',
      description: 'Hasta 500 consultas/mes',
    ),
  ];
}

class PlanFeature {
  final String icon;
  final String title;
  final String description;

  const PlanFeature({
    required this.icon,
    required this.title,
    required this.description,
  });
}
