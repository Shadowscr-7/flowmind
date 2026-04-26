/// Flowmind app configuration constants
class AppConfig {
  AppConfig._();

  static const String appName = 'Flowmind';
  static const String appVersion = '1.0.1';

  /// Whether the app is running in demo mode (no Supabase backend)
  static bool _isDemoMode = false;
  static bool get isDemoMode => _isDemoMode;
  static void enableDemoMode() => _isDemoMode = true;

  // Supabase — pass via: flutter run --dart-define-from-file=.env
  static const String supabaseUrl = String.fromEnvironment('SUPABASE_URL');
  static const String supabaseAnonKey = String.fromEnvironment(
    'SUPABASE_ANON_KEY',
  );

  // Google Sign-In
  static const String googleWebClientId = String.fromEnvironment(
    'GOOGLE_WEB_CLIENT_ID',
  );

  // AI quotas
  static const int aiMonthlyQuotaFree = 0;
  static const int aiMonthlyQuotaPro = 500;

  // Supported currencies
  static const List<String> supportedCurrencies = [
    'UYU',
    'ARS',
    'USD',
    'EUR',
    'BRL',
    'MXN',
    'CLP',
    'COP',
    'PEN',
  ];

  static const String defaultCurrency = 'UYU';
  static const String defaultTimezone = 'America/Montevideo';

  // Storage paths
  static const String receiptsBucket = 'receipts';
  static const String audioBucket = 'audio';

  // Timeouts
  static const Duration apiTimeout = Duration(seconds: 30);
  static const Duration aiTimeout = Duration(seconds: 60);

  // Performance
  static const int transactionsPageSize = 50;
  static const int insightsPageSize = 20;
}
