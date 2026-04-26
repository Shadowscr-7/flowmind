import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:record/record.dart';
import 'package:path_provider/path_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/router/app_router.dart';
import '../../../services/analytics_service.dart';
import '../../providers/app_providers.dart';
import '../../providers/connectivity_provider.dart';
import '../../providers/subscription_provider.dart';
import '../../../core/config/subscription_config.dart';

class AddTransactionScreen extends ConsumerStatefulWidget {
  const AddTransactionScreen({super.key});

  @override
  ConsumerState<AddTransactionScreen> createState() =>
      _AddTransactionScreenState();
}

class _AddTransactionScreenState extends ConsumerState<AddTransactionScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _textController = TextEditingController();
  bool _isProcessing = false;
  String? _error;

  // Voice
  final _audioRecorder = AudioRecorder();
  bool _isRecording = false;
  String? _recordingPath;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final args =
        ModalRoute.of(context)?.settings.arguments as Map<String, dynamic>?;
    if (args != null) {
      final mode = args['mode'] as String?;
      if (mode == 'voice') _tabController.index = 1;
      if (mode == 'receipt') _tabController.index = 2;
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _textController.dispose();
    _audioRecorder.dispose();
    super.dispose();
  }

  // ─── Process Methods ─────────────────────────────────────

  Future<void> _processText() async {
    if (_textController.text.trim().isEmpty) return;

    setState(() {
      _isProcessing = true;
      _error = null;
    });

    final isOnline = ref.read(isOnlineProvider);
    final primaryAccount = await ref.read(primaryAccountProvider.future);

    // If offline, queue for later
    if (!isOnline) {
      final queue = ref.read(offlineQueueProvider);
      await queue.enqueueTextParse(
        text: _textController.text.trim(),
        accountId: primaryAccount?.id,
      );
      if (!mounted) return;
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Sin conexión. Se procesará cuando vuelvas a estar online.',
          ),
          backgroundColor: Color(0xFFFBBF24),
        ),
      );
      Navigator.pop(context);
      return;
    }

    final aiService = ref.read(aiServiceProvider);
    await AnalyticsService().logAiParseText();

    final result = await aiService.parseText(
      _textController.text.trim(),
      accountId: primaryAccount?.id,
    );

    if (!mounted) return;
    setState(() => _isProcessing = false);

    if (result.success && result.draft != null) {
      Navigator.pushNamed(
        context,
        AppRouter.confirmTransaction,
        arguments: {
          'draft': result.draft!.toJson(),
          'source': 'text',
          'rawPayload': result.rawPayload,
        },
      );
    } else {
      if (result.quotaExceeded) {
        _showUpgradePaywall(result.error);
        return;
      }
      setState(() => _error = result.error ?? 'Error al procesar');
    }
  }

  Future<void> _toggleRecording() async {
    if (_isRecording) {
      final path = await _audioRecorder.stop();
      setState(() {
        _isRecording = false;
        _recordingPath = path;
      });

      if (path != null) {
        await _processVoice(File(path));
      }
    } else {
      if (await _audioRecorder.hasPermission()) {
        final dir = await getTemporaryDirectory();
        final path =
            '${dir.path}/flowmind_voice_${DateTime.now().millisecondsSinceEpoch}.m4a';

        await _audioRecorder.start(
          const RecordConfig(encoder: AudioEncoder.aacLc, sampleRate: 16000),
          path: path,
        );

        setState(() => _isRecording = true);
      }
    }
  }

  Future<void> _processVoice(File audioFile) async {
    setState(() {
      _isProcessing = true;
      _error = null;
    });

    final isOnline = ref.read(isOnlineProvider);
    final primaryAccount = await ref.read(primaryAccountProvider.future);

    if (!isOnline) {
      final queue = ref.read(offlineQueueProvider);
      await queue.enqueueVoiceParse(
        audioFilePath: audioFile.path,
        accountId: primaryAccount?.id,
      );
      if (!mounted) return;
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Sin conexión. Se procesará cuando vuelvas a estar online.',
          ),
          backgroundColor: Color(0xFFFBBF24),
        ),
      );
      Navigator.pop(context);
      return;
    }

    final aiService = ref.read(aiServiceProvider);
    await AnalyticsService().logAiParseVoice();

    final result = await aiService.parseVoice(
      audioFile,
      accountId: primaryAccount?.id,
    );

    if (!mounted) return;
    setState(() => _isProcessing = false);

    if (result.success && result.draft != null) {
      Navigator.pushNamed(
        context,
        AppRouter.confirmTransaction,
        arguments: {
          'draft': result.draft!.toJson(),
          'source': 'voice',
          'transcript': result.transcript,
          'rawPayload': result.rawPayload,
        },
      );
    } else {
      if (result.quotaExceeded) {
        _showUpgradePaywall(result.error);
        return;
      }
      setState(() => _error = result.error ?? 'Error al procesar audio');
    }
  }

  Future<void> _captureReceipt() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(
      source: ImageSource.camera,
      maxWidth: 1280,
      maxHeight: 1280,
      imageQuality: 75,
    );

    if (image == null) return;
    await _processReceipt(File(image.path));
  }

  Future<void> _pickReceiptFromGallery() async {
    final picker = ImagePicker();
    final image = await picker.pickImage(
      source: ImageSource.gallery,
      maxWidth: 1280,
      maxHeight: 1280,
      imageQuality: 75,
    );

    if (image == null) return;
    await _processReceipt(File(image.path));
  }

  Future<void> _processReceipt(File imageFile) async {
    setState(() {
      _isProcessing = true;
      _error = null;
    });

    final isOnline = ref.read(isOnlineProvider);
    final primaryAccount = await ref.read(primaryAccountProvider.future);

    if (!isOnline) {
      final queue = ref.read(offlineQueueProvider);
      await queue.enqueueReceiptParse(
        imageFilePath: imageFile.path,
        accountId: primaryAccount?.id,
      );
      if (!mounted) return;
      setState(() => _isProcessing = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Sin conexión. Se procesará cuando vuelvas a estar online.',
          ),
          backgroundColor: Color(0xFFFBBF24),
        ),
      );
      Navigator.pop(context);
      return;
    }

    final aiService = ref.read(aiServiceProvider);
    await AnalyticsService().logAiParseReceipt();

    final result = await aiService.parseReceipt(
      imageFile,
      accountId: primaryAccount?.id,
    );

    if (!mounted) return;
    setState(() => _isProcessing = false);

    if (result.success && result.draft != null) {
      Navigator.pushNamed(
        context,
        AppRouter.confirmTransaction,
        arguments: {
          'draft': result.draft!.toJson(),
          'source': 'receipt',
          'receiptId': result.receiptId,
          'rawPayload': result.rawPayload,
        },
      );
    } else {
      if (result.quotaExceeded) {
        _showUpgradePaywall(result.error);
        return;
      }
      setState(() => _error = result.error ?? 'Error al procesar ticket');
    }
  }

  void _showUpgradePaywall(String? message) {
    Navigator.pushNamed(
      context,
      AppRouter.paywall,
      arguments: {
        'feature': 'free_plan_limit',
        'message':
            message ??
            'Tu plan Free ya alcanzo el limite mensual. Pasate a Pro mensual o anual para seguir enviando audios y fotos.',
      },
    );
  }

  // ─── Build ───────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F0F23),
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                // ─── Header ────────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 0),
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: () => Navigator.pop(context),
                        child: Container(
                          width: 42,
                          height: 42,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(14),
                            color: Colors.white.withOpacity(0.06),
                            border: Border.all(
                              color: Colors.white.withOpacity(0.08),
                            ),
                          ),
                          child: Icon(
                            Icons.arrow_back_ios_new_rounded,
                            color: Colors.white.withOpacity(0.6),
                            size: 18,
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Text(
                          'Agregar Movimiento',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // ─── AI Quota Badge ────────────────────────
                Consumer(
                  builder: (context, ref, _) {
                    final profileAsync = ref.watch(profileProvider);
                    return profileAsync.when(
                      data: (profile) {
                        if (profile == null) return const SizedBox.shrink();
                        final isPro = ref.watch(isProProvider);
                        final maxQuota = isPro
                            ? SubscriptionConfig.proAiMonthlyQuota
                            : SubscriptionConfig.freeAiMonthlyQuota;
                        final used = profile.aiUsageCount;
                        final remaining = (maxQuota - used).clamp(0, maxQuota);
                        final isLow = remaining <= 5;

                        return Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 20),
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 8,
                            ),
                            decoration: BoxDecoration(
                              color:
                                  (isLow
                                          ? const Color(0xFFF87171)
                                          : AppTheme.primary)
                                      .withOpacity(0.08),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(
                                color:
                                    (isLow
                                            ? const Color(0xFFF87171)
                                            : AppTheme.primary)
                                        .withOpacity(0.15),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  isLow
                                      ? Icons.warning_amber_rounded
                                      : Icons.auto_awesome,
                                  size: 14,
                                  color: isLow
                                      ? const Color(0xFFF87171)
                                      : AppTheme.primary,
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  'IA: $remaining consulta${remaining == 1 ? '' : 's'} restante${remaining == 1 ? '' : 's'}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w500,
                                    color: isLow
                                        ? const Color(0xFFF87171)
                                        : Colors.white.withOpacity(0.6),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                      loading: () => const SizedBox.shrink(),
                      error: (_, __) => const SizedBox.shrink(),
                    );
                  },
                ),
                const SizedBox(height: 12),

                // ─── Tab Bar ───────────────────────────────
                Container(
                  margin: const EdgeInsets.symmetric(horizontal: 20),
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.04),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.white.withOpacity(0.06)),
                  ),
                  child: TabBar(
                    controller: _tabController,
                    indicator: BoxDecoration(
                      color: AppTheme.primary.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: AppTheme.primary.withOpacity(0.3),
                      ),
                    ),
                    indicatorSize: TabBarIndicatorSize.tab,
                    dividerColor: Colors.transparent,
                    labelColor: Colors.white,
                    unselectedLabelColor: Colors.white.withOpacity(0.35),
                    labelStyle: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                    unselectedLabelStyle: const TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w400,
                    ),
                    tabs: const [
                      Tab(
                        height: 44,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.keyboard_rounded, size: 16),
                            SizedBox(width: 6),
                            Text('Texto'),
                          ],
                        ),
                      ),
                      Tab(
                        height: 44,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.mic_rounded, size: 16),
                            SizedBox(width: 6),
                            Text('Voz'),
                          ],
                        ),
                      ),
                      Tab(
                        height: 44,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.camera_alt_rounded, size: 16),
                            SizedBox(width: 6),
                            Text('Ticket'),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 24),

                // ─── Tab Views ─────────────────────────────
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildTextTab(),
                      _buildVoiceTab(),
                      _buildReceiptTab(),
                    ],
                  ),
                ),
              ],
            ),

            // ─── Processing Overlay ────────────────────────
            if (_isProcessing) _buildProcessingOverlay(),
          ],
        ),
      ),
    );
  }

  // ─── Text Tab ────────────────────────────────────────────

  Widget _buildTextTab() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            '¿Qué registrar?',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            'Escribe como hablarías naturalmente',
            style: TextStyle(
              fontSize: 14,
              color: Colors.white.withOpacity(0.4),
            ),
          ),
          const SizedBox(height: 24),

          // Text field
          Container(
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.04),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withOpacity(0.08)),
            ),
            child: TextField(
              controller: _textController,
              maxLines: 3,
              textInputAction: TextInputAction.done,
              onSubmitted: (_) => _processText(),
              style: const TextStyle(color: Colors.white, fontSize: 15),
              decoration: InputDecoration(
                hintText:
                    'Ej: "Gasté 350 en el super hoy"\n"Me pagaron 45000 de sueldo"\n"Uber 180 pesos"',
                hintStyle: TextStyle(
                  color: Colors.white.withOpacity(0.2),
                  fontSize: 14,
                  height: 1.5,
                ),
                contentPadding: const EdgeInsets.all(18),
                border: InputBorder.none,
                enabledBorder: InputBorder.none,
                focusedBorder: InputBorder.none,
              ),
            ),
          ),
          const SizedBox(height: 16),

          if (_error != null) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF87171).withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(0xFFF87171).withOpacity(0.15),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.error_outline_rounded,
                    color: const Color(0xFFF87171).withOpacity(0.8),
                    size: 18,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      _error!,
                      style: const TextStyle(
                        color: Color(0xFFF87171),
                        fontSize: 13,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          // Process button
          GestureDetector(
            onTap: _isProcessing ? null : _processText,
            child: Container(
              height: 54,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: const LinearGradient(
                  colors: [AppTheme.primary, Color(0xFF9B8FFF)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.primary.withOpacity(0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.auto_awesome, color: Colors.white, size: 20),
                  SizedBox(width: 10),
                  Text(
                    'Procesar con IA',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),

          const Spacer(),

          // Example chips
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _ExampleChip(
                text: 'Gasté 350 en super',
                onTap: () => _textController.text = 'Gasté 350 en super',
              ),
              _ExampleChip(
                text: 'Almuerzo 280',
                onTap: () => _textController.text = 'Almuerzo 280',
              ),
              _ExampleChip(
                text: 'Cobré 45000 de sueldo',
                onTap: () => _textController.text = 'Cobré 45000 de sueldo',
              ),
              _ExampleChip(
                text: 'Nafta 1500',
                onTap: () => _textController.text = 'Nafta 1500',
              ),
            ],
          ),
          const SizedBox(height: 20),
        ],
      ),
    );
  }

  // ─── Voice Tab ───────────────────────────────────────────

  Widget _buildVoiceTab() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            _isRecording ? 'Escuchando...' : 'Habla tu gasto',
            style: const TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _isRecording
                ? 'Toca para detener'
                : 'Toca el micrófono y di tu gasto',
            style: TextStyle(
              fontSize: 14,
              color: Colors.white.withOpacity(0.4),
            ),
          ),
          const SizedBox(height: 48),

          // Mic button
          GestureDetector(
            onTap: _isProcessing ? null : _toggleRecording,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              width: _isRecording ? 120 : 100,
              height: _isRecording ? 120 : 100,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: _isRecording
                      ? [const Color(0xFFF87171), const Color(0xFFDC2626)]
                      : [AppTheme.secondary, const Color(0xFF059669)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color:
                        (_isRecording
                                ? const Color(0xFFF87171)
                                : AppTheme.secondary)
                            .withOpacity(0.35),
                    blurRadius: _isRecording ? 40 : 24,
                    spreadRadius: _isRecording ? 8 : 0,
                  ),
                ],
              ),
              child: Icon(
                _isRecording ? Icons.stop_rounded : Icons.mic_rounded,
                color: Colors.white,
                size: 44,
              ),
            ),
          ),
          const SizedBox(height: 32),

          if (_isRecording)
            Text(
              '●  Grabando...',
              style: TextStyle(
                color: const Color(0xFFF87171).withOpacity(0.8),
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),

          if (_error != null) ...[
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF87171).withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _error!,
                style: const TextStyle(color: Color(0xFFF87171), fontSize: 13),
              ),
            ),
          ],
        ],
      ),
    );
  }

  // ─── Receipt Tab ─────────────────────────────────────────

  Widget _buildReceiptTab() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(24),
              gradient: LinearGradient(
                colors: [
                  const Color(0xFFFBBF24).withOpacity(0.15),
                  const Color(0xFFFBBF24).withOpacity(0.05),
                ],
              ),
            ),
            child: const Icon(
              Icons.receipt_long_rounded,
              size: 36,
              color: Color(0xFFFBBF24),
            ),
          ),
          const SizedBox(height: 20),
          const Text(
            'Escanear Ticket',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Toma una foto de tu ticket y la IA\nextraerá los datos automáticamente',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: Colors.white.withOpacity(0.4),
              height: 1.5,
            ),
          ),
          const SizedBox(height: 36),

          // Camera button
          GestureDetector(
            onTap: _isProcessing ? null : _captureReceipt,
            child: Container(
              width: double.infinity,
              height: 54,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                gradient: const LinearGradient(
                  colors: [Color(0xFFFBBF24), Color(0xFFF59E0B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFFFBBF24).withOpacity(0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.camera_alt_rounded, color: Colors.white, size: 20),
                  SizedBox(width: 10),
                  Text(
                    'Tomar Foto',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 12),

          // Gallery button
          GestureDetector(
            onTap: _isProcessing ? null : _pickReceiptFromGallery,
            child: Container(
              width: double.infinity,
              height: 54,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                color: Colors.white.withOpacity(0.04),
                border: Border.all(
                  color: const Color(0xFFFBBF24).withOpacity(0.2),
                ),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.photo_library_rounded,
                    color: const Color(0xFFFBBF24).withOpacity(0.8),
                    size: 20,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'Elegir de Galería',
                    style: TextStyle(
                      color: const Color(0xFFFBBF24).withOpacity(0.8),
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),

          if (_error != null)
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFF87171).withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                _error!,
                style: const TextStyle(color: Color(0xFFF87171), fontSize: 13),
              ),
            ),
        ],
      ),
    );
  }

  // ─── Processing Overlay ──────────────────────────────────

  Widget _buildProcessingOverlay() {
    return Container(
      color: const Color(0xFF0F0F23).withOpacity(0.85),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 36),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A3E),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: Colors.white.withOpacity(0.08)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.3),
                blurRadius: 32,
                spreadRadius: 4,
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                width: 48,
                height: 48,
                child: CircularProgressIndicator(
                  strokeWidth: 3,
                  valueColor: AlwaysStoppedAnimation(
                    AppTheme.primary.withOpacity(0.8),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              const Text(
                'Procesando con IA...',
                style: TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Extrayendo información',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.white.withOpacity(0.4),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Example Chip ──────────────────────────────────────────
class _ExampleChip extends StatelessWidget {
  final String text;
  final VoidCallback onTap;

  const _ExampleChip({required this.text, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: AppTheme.primary.withOpacity(0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: AppTheme.primary.withOpacity(0.12)),
        ),
        child: Text(
          text,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w500,
            color: AppTheme.primary.withOpacity(0.8),
          ),
        ),
      ),
    );
  }
}
