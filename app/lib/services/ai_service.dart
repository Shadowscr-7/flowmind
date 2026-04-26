import 'dart:io';
import 'dart:convert';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:http/http.dart' as http;
import '../core/config/app_config.dart';
import '../data/models/transaction.dart';

/// Service that communicates with Supabase Edge Functions for AI processing
class AiService {
  final SupabaseClient _client;

  AiService(this._client);

  String get _baseUrl => AppConfig.supabaseUrl;

  Map<String, String> get _headers => {
    'Authorization': 'Bearer ${_client.auth.currentSession?.accessToken ?? ''}',
    'apikey': AppConfig.supabaseAnonKey,
    'Content-Type': 'application/json',
  };

  /// Parse text input into a transaction draft
  Future<TransactionDraftResult> parseText(
    String text, {
    String? accountId,
  }) async {
    try {
      final response = await http
          .post(
            Uri.parse('$_baseUrl/functions/v1/ingest-text'),
            headers: _headers,
            body: jsonEncode({'text': text, 'account_id': accountId}),
          )
          .timeout(AppConfig.aiTimeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 429) {
        return TransactionDraftResult.quotaExceeded(
          data['error'] ?? 'Limite mensual alcanzado',
        );
      }

      if (response.statusCode != 200 || data['success'] != true) {
        return TransactionDraftResult.error(
          data['error'] ?? 'Error al procesar texto',
        );
      }

      return TransactionDraftResult.success(
        draft: TransactionDraft.fromJson(data['draft']),
        rawPayload: data['raw_payload'],
      );
    } catch (e) {
      return TransactionDraftResult.error('Error de conexión: $e');
    }
  }

  /// Parse voice audio into a transaction draft
  Future<TransactionDraftResult> parseVoice(
    File audioFile, {
    String? accountId,
  }) async {
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$_baseUrl/functions/v1/ingest-voice'),
      );

      request.headers.addAll({
        'Authorization':
            'Bearer ${_client.auth.currentSession?.accessToken ?? ''}',
        'apikey': AppConfig.supabaseAnonKey,
      });

      request.files.add(
        await http.MultipartFile.fromPath('audio', audioFile.path),
      );

      if (accountId != null) {
        request.fields['account_id'] = accountId;
      }

      final streamedResponse = await request.send().timeout(
        AppConfig.aiTimeout,
      );
      final response = await http.Response.fromStream(streamedResponse);
      final data = jsonDecode(response.body);

      if (response.statusCode == 429) {
        return TransactionDraftResult.quotaExceeded(
          data['error'] ?? 'Limite mensual de audios alcanzado',
        );
      }

      if (response.statusCode != 200 || data['success'] != true) {
        return TransactionDraftResult.error(
          data['error'] ?? 'Error al procesar audio',
        );
      }

      return TransactionDraftResult.success(
        draft: TransactionDraft.fromJson(data['draft']),
        transcript: data['transcript'],
        rawPayload: data['raw_payload'],
      );
    } catch (e) {
      return TransactionDraftResult.error('Error de conexión: $e');
    }
  }

  /// Parse receipt image into a transaction draft
  Future<TransactionDraftResult> parseReceipt(
    File imageFile, {
    String? accountId,
  }) async {
    try {
      final request = http.MultipartRequest(
        'POST',
        Uri.parse('$_baseUrl/functions/v1/ingest-receipt'),
      );

      request.headers.addAll({
        'Authorization':
            'Bearer ${_client.auth.currentSession?.accessToken ?? ''}',
        'apikey': AppConfig.supabaseAnonKey,
      });

      request.files.add(
        await http.MultipartFile.fromPath('image', imageFile.path),
      );

      if (accountId != null) {
        request.fields['account_id'] = accountId;
      }

      final streamedResponse = await request.send().timeout(
        AppConfig.aiTimeout,
      );
      final response = await http.Response.fromStream(streamedResponse);
      final data = jsonDecode(response.body);

      if (response.statusCode == 429) {
        return TransactionDraftResult.quotaExceeded(
          data['error'] ?? 'Limite mensual de fotos alcanzado',
        );
      }

      if (response.statusCode != 200 || data['success'] != true) {
        return TransactionDraftResult.error(
          data['error'] ?? 'Error al procesar ticket',
        );
      }

      return TransactionDraftResult.success(
        draft: TransactionDraft.fromJson(data['draft']),
        receiptId: data['receipt_id'],
        rawPayload: data['raw_payload'],
      );
    } catch (e) {
      return TransactionDraftResult.error('Error de conexión: $e');
    }
  }

  /// Confirm a transaction draft and persist it
  Future<Map<String, dynamic>?> confirmTransaction(
    TransactionDraft draft,
  ) async {
    try {
      final response = await http
          .post(
            Uri.parse('$_baseUrl/functions/v1/confirm-transaction'),
            headers: _headers,
            body: jsonEncode({
              'type': draft.type,
              'amount': draft.amount,
              'currency': draft.currency,
              'date': draft.date.toIso8601String(),
              'merchant': draft.merchant,
              'category_id': draft.categoryId,
              'account_id': draft.accountId,
              'notes': draft.notes,
              'source': draft.source,
              'confidence': draft.confidence,
              'raw_payload': draft.rawPayload,
              'receipt_id': draft.receiptId,
              'is_recurring': draft.isRecurring,
              if (draft.isRecurring) ...{
                'recurring_frequency': draft.recurringFrequency ?? 'monthly',
                if (draft.recurringDay != null)
                  'recurring_day': draft.recurringDay,
                if (draft.recurringEndDate != null)
                  'recurring_end_date': draft.recurringEndDate,
              },
              if (draft.transferToAccountId != null)
                'transfer_to_account_id': draft.transferToAccountId,
            }),
          )
          .timeout(AppConfig.apiTimeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        return data['transaction'];
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  /// Get insights summary for a given month
  Future<InsightsSummaryResult> getInsightsSummary({
    int? year,
    int? month,
    bool refresh = false,
  }) async {
    try {
      final now = DateTime.now();
      final y = year ?? now.year;
      final m = month ?? now.month;
      final monthStr = '$y-${m.toString().padLeft(2, '0')}';

      var url = '$_baseUrl/functions/v1/insights-summary?month=$monthStr';
      if (refresh) url += '&refresh=true';

      final response = await http
          .get(Uri.parse(url), headers: _headers)
          .timeout(AppConfig.aiTimeout);

      final data = jsonDecode(response.body);

      if (response.statusCode == 200 && data['success'] == true) {
        return InsightsSummaryResult(
          success: true,
          summary: data['summary'],
          insights: data['insights'],
        );
      }

      return InsightsSummaryResult(
        success: false,
        error: data['error'] ?? 'Error al obtener insights',
      );
    } catch (e) {
      return InsightsSummaryResult(
        success: false,
        error: 'Error de conexión: $e',
      );
    }
  }
}

/// Result class for transaction draft parsing
class TransactionDraftResult {
  final bool success;
  final bool quotaExceeded;
  final TransactionDraft? draft;
  final String? transcript;
  final String? receiptId;
  final Map<String, dynamic>? rawPayload;
  final String? error;

  TransactionDraftResult._({
    required this.success,
    this.quotaExceeded = false,
    this.draft,
    this.transcript,
    this.receiptId,
    this.rawPayload,
    this.error,
  });

  factory TransactionDraftResult.success({
    required TransactionDraft draft,
    String? transcript,
    String? receiptId,
    Map<String, dynamic>? rawPayload,
  }) {
    return TransactionDraftResult._(
      success: true,
      draft: draft,
      transcript: transcript,
      receiptId: receiptId,
      rawPayload: rawPayload,
    );
  }

  factory TransactionDraftResult.error(String message) {
    return TransactionDraftResult._(success: false, error: message);
  }

  factory TransactionDraftResult.quotaExceeded([String? message]) {
    return TransactionDraftResult._(
      success: false,
      quotaExceeded: true,
      error: message ?? 'Limite mensual alcanzado',
    );
  }
}

/// Result class for insights summary
class InsightsSummaryResult {
  final bool success;
  final Map<String, dynamic>? summary;
  final List<dynamic>? insights;
  final String? error;

  InsightsSummaryResult({
    required this.success,
    this.summary,
    this.insights,
    this.error,
  });
}
