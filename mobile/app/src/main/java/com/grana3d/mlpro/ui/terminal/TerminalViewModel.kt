package com.grana3d.mlpro.ui.terminal

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.grana3d.mlpro.core.ApiResult
import com.grana3d.mlpro.core.Constants
import com.grana3d.mlpro.data.repository.MobileRepository
import com.grana3d.mlpro.domain.ScanMode
import com.grana3d.mlpro.domain.ScanOutcome
import com.grana3d.mlpro.domain.Shipment
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Valores de `carrierFilter` que acepta `POST /shipments/scan`
 * (`all` viene de [Constants] para no duplicar el valor de la capa de datos).
 */
internal const val CARRIER_ALL = Constants.CARRIER_FILTER_ALL
internal const val CARRIER_FLEX = "self_service"
internal const val CARRIER_COLECTA = "cross_docking"
internal const val CARRIER_CORREO = "drop_off"

/** Tipo de feedback sensorial que dispara la pantalla (beep + vibración). */
enum class TerminalFeedbackKind { Success, Warning, Error }

/** Nombre legible del campo del envío con el que coincidió un código leído. */
internal fun etiquetaDeCampo(campo: String): String = when (campo) {
    "shipment_id" -> "el número de envío"
    "order_id" -> "el número de orden"
    "tracking" -> "el número de seguimiento"
    "sku" -> "el SKU del producto"
    else -> campo
}

/** Evento sensorial: cada `seq` nuevo se reproduce una sola vez. */
data class TerminalFeedback(val seq: Long, val kind: TerminalFeedbackKind)

/** Estados posibles de la tarjeta grande de resultado del escaneo. */
enum class ScanCardKind { Packed, AlreadyPacked, Identified, Duplicate, Ambiguous, CarrierMismatch, NotFound, Error }

/**
 * Resultado del escaneo ya normalizado para la UI: la pantalla no necesita
 * volver a interpretar `ScanOutcome` ni el `packing` del envío.
 */
data class ScanCardUi(
    val kind: ScanCardKind,
    val headline: String,
    val message: String,
    val shipment: Shipment? = null,
    val code: String? = null,
    /** Código tal cual se leyó (para mostrar qué se escaneó). */
    val readCode: String? = null,
    /** Campo del envío con el que coincidió: `shipment_id`, `order_id`, `tracking`, `sku`. */
    val matchedBy: String? = null,
    val scanCount: Int = 0,
    val printed: Boolean = false,
    val packed: Boolean = false,
    val qualityChecked: Boolean = false,
    val dispatchChecked: Boolean = false,
    val expectedCarrier: String? = null,
    val actualCarrier: String? = null,
)

data class TerminalUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val message: String? = null,
    val mode: ScanMode = ScanMode.PACK,
    val carrierFilter: String = CARRIER_ALL,
    val manualCode: String = "",
    val packedCount: Int = 0,
    val totalCount: Int = 0,
    val queue: List<Shipment> = emptyList(),
    val scanCard: ScanCardUi? = null,
    val isBusy: Boolean = false,
    val isScannerOpen: Boolean = false,
    /** Si está encendido, escanear ya deja el paquete empaquetado. */
    val autoPack: Boolean = true,
    /**
     * Ráfaga: con el overlay abierto, cada lectura deja la cámara prendida para
     * la etiqueta siguiente en vez de cerrar el escáner.
     */
    val continuousScan: Boolean = false,
    /** Lecturas de la sesión continua actual (no cuenta fallas técnicas). */
    val continuousCount: Int = 0,
    /** Linterna del escáner (la pantalla la consume, el ViewModel la guarda). */
    val isTorchOn: Boolean = false,
    val noteTarget: Shipment? = null,
    val noteDraft: String = "",
    val feedback: TerminalFeedback? = null,
) {
    /** Progreso 0..1 de paquetes empaquetados sobre el total del día. */
    val progress: Float
        get() = if (totalCount <= 0) 0f else (packedCount.toFloat() / totalCount.toFloat()).coerceIn(0f, 1f)

    val pendingCount: Int
        get() = (totalCount - packedCount).coerceAtLeast(0)

    val isDispatchMode: Boolean
        get() = mode == ScanMode.DISPATCH
}

/**
 * Terminal de empaque: escaneo de paquetes, resultado a pantalla completa,
 * acciones de empaque / despacho y cola de pendientes.
 */
class TerminalViewModel(
    private val repository: MobileRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(TerminalUiState())
    val state: StateFlow<TerminalUiState> = _state.asStateFlow()

    private var feedbackSeq: Long = 0L
    private var lastScanCode: String = ""
    private var lastScanAt: Long = 0L

    init {
        load()
        startQueuePolling()
    }

    /**
     * Refresco silencioso de la cola mientras la Terminal está abierta: el
     * depósito cambia desde la web y el operario no tiene que tocar nada.
     * Cada [Constants.POLL_SUMMARY_EVERY_N] polls también refresca contadores
     * vía bootstrap (el backend manda `readyToShip` actualizado).
     */
    private var pollCount: Int = 0

    private fun startQueuePolling() {
        viewModelScope.launch {
            while (true) {
                delay(Constants.POLL_INTERVAL_MS)
                pollCount += 1
                refreshQueueSilently()
                if (pollCount % Constants.POLL_SUMMARY_EVERY_N == 0) {
                    refreshSummarySilently()
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Carga de datos
    // ------------------------------------------------------------------

    /** Primera carga: resuelve cola + progreso en una sola llamada. */
    fun load() {
        fetch(initial = true)
    }

    /** Recarga manual (mantiene la lista visible). */
    fun refresh() {
        fetch(initial = false)
    }

    private fun fetch(initial: Boolean) {
        viewModelScope.launch {
            _state.update {
                it.copy(
                    isLoading = initial && it.queue.isEmpty(),
                    isRefreshing = !initial,
                    error = null,
                )
            }
            when (val result = repository.bootstrap()) {
                is ApiResult.Ok -> {
                    val data = result.value
                    val packed = data.summary?.packedCount?.toInt() ?: 0
                    val unpacked = data.summary?.unpackedCount?.toInt() ?: data.queue.size
                    // El total del día es "listos para despachar" (empaquetados + sin
                    // empaquetar): así el progreso no cambia de universo entre refrescos.
                    val total = data.summary?.readyToShipCount?.toInt() ?: (packed + unpacked)
                    _state.update {
                        it.copy(
                            isLoading = false,
                            isRefreshing = false,
                            error = null,
                            queue = data.queue,
                            packedCount = packed,
                            totalCount = maxOf(total, packed),
                        )
                    }
                }

                is ApiResult.Err -> _state.update {
                    it.copy(isLoading = false, isRefreshing = false, error = result.message)
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Selectores
    // ------------------------------------------------------------------

    fun setMode(mode: ScanMode) {
        _state.update { it.copy(mode = mode, error = null, continuousCount = 0) }
    }

    fun setCarrierFilter(filter: String) {
        _state.update { it.copy(carrierFilter = filter, error = null) }
    }

    /**
     * Empaque automático al escanear. Con el interruptor apagado, escanear sólo
     * identifica el paquete y el empaque se marca con el botón: así nada cambia sin
     * que el operario lo pida.
     */
    fun setAutoPack(enabled: Boolean) {
        _state.update { it.copy(autoPack = enabled, message = if (enabled) {
            "Al escanear, el paquete queda empaquetado."
        } else {
            "Al escanear, el paquete sólo se identifica."
        }) }
    }

    fun onManualCodeChange(value: String) {
        _state.update { it.copy(manualCode = value) }
    }

    fun submitManualCode() {
        val code = _state.value.manualCode.trim()
        if (code.isEmpty()) return
        scan(code)
    }

    // ------------------------------------------------------------------
    // Escáner
    // ------------------------------------------------------------------

    fun openScanner() {
        _state.update { it.copy(isScannerOpen = true, error = null) }
    }

    fun closeScanner() {
        _state.update { it.copy(isScannerOpen = false) }
    }

    /**
     * Prende o apaga la ráfaga: al cambiar de modo se empieza a contar de cero.
     */
    fun setContinuousScan(enabled: Boolean) {
        _state.update { it.copy(continuousScan = enabled, continuousCount = 0) }
    }

    /** Prende o apaga la linterna del escáner. */
    fun toggleTorch() {
        _state.update { it.copy(isTorchOn = !it.isTorchOn) }
    }

    /**
     * Un QR detectado dispara el escaneo. En modo simple cierra el overlay: el
     * operario tiene que ver la tarjeta de resultado gigante, no la cámara. En
     * ráfaga la cámara queda prendida para la etiqueta siguiente.
     */
    fun onQrDetected(rawCode: String) {
        if (!_state.value.continuousScan) {
            _state.update { it.copy(isScannerOpen = false) }
        }
        scan(rawCode)
    }

    fun scan(rawCode: String) {
        val code = rawCode.trim()
        if (code.isEmpty() || _state.value.isBusy) return

        // Antirrebote: la cámara puede entregar el mismo código dos veces seguidas.
        val now = System.currentTimeMillis()
        if (code == lastScanCode && now - lastScanAt < Constants.SCAN_THROTTLE_MS) return
        lastScanCode = code
        lastScanAt = now

        viewModelScope.launch {
            _state.update {
                // En ráfaga el overlay queda abierto; en modo simple se cierra.
                // Se conserva `isScannerOpen` AND continuo para no abrir la cámara
                // desde el ingreso manual (ahí el escáner ya estaba cerrado).
                it.copy(
                    isBusy = true,
                    isScannerOpen = it.isScannerOpen && it.continuousScan,
                    error = null,
                    manualCode = "",
                )
            }
            val current = _state.value
            when (val result = repository.scan(code, current.mode, current.carrierFilter, current.autoPack)) {
                is ApiResult.Ok -> applyOutcome(
                    outcome = result.value,
                    dispatchMode = current.isDispatchMode,
                    readCode = code,
                )

                is ApiResult.Err -> showCard(
                    card = ScanCardUi(
                        kind = ScanCardKind.Error,
                        headline = "No pudimos leer el paquete",
                        message = result.message,
                        code = code,
                    ),
                    feedback = TerminalFeedbackKind.Error,
                )
            }
            _state.update { it.copy(isBusy = false) }
        }
    }

    private fun applyOutcome(outcome: ScanOutcome, dispatchMode: Boolean, readCode: String) {
        // En ráfaga cada resultado (salvo falla técnica) suma una lectura de sesión.
        val countContinuous = _state.value.continuousScan && outcome !is ScanOutcome.Failure
        when (outcome) {
            is ScanOutcome.Found -> {
                val shipment = outcome.shipment
                val packaging = shipment.packing
                val yaEmpaquetado = outcome.alreadyPacked == true
                // Lo que manda es lo que el servidor dejó grabado, no lo que suponemos.
                val empaquetadoAhora = packaging?.packed == true

                val card = ScanCardUi(
                    kind = when {
                        yaEmpaquetado -> ScanCardKind.AlreadyPacked
                        !empaquetadoAhora -> ScanCardKind.Identified
                        else -> ScanCardKind.Packed
                    },
                    headline = when {
                        dispatchMode && yaEmpaquetado -> "Ya verificado para despacho"
                        dispatchMode -> "Despacho verificado"
                        yaEmpaquetado -> "Ya estaba empaquetado"
                        !empaquetadoAhora -> "Paquete identificado"
                        else -> "Empaquetado"
                    },
                    message = outcome.message ?: "",
                    shipment = shipment,
                    code = shipment.id,
                    readCode = readCode,
                    matchedBy = outcome.matchedBy,
                    scanCount = outcome.scanCount?.toInt() ?: 0,
                    printed = packaging?.printed == true,
                    packed = empaquetadoAhora,
                    qualityChecked = packaging?.qualityChecked == true,
                    dispatchChecked = packaging?.dispatchChecked == true,
                )

                // Contadores: se mueve sólo lo que realmente cambió en el servidor, y el
                // total del día queda igual (pasa de "sin empaquetar" a "empaquetado").
                val id = shipment.id ?: ""
                val estabaEnCola = _state.value.queue.any { item -> item.id == id }
                if (estabaEnCola && empaquetadoAhora) {
                    _state.update {
                        it.copy(
                            queue = it.queue.filterNot { item -> item.id == id },
                            packedCount = it.packedCount + 1,
                        )
                    }
                }

                showCard(
                    card = card,
                    feedback = when {
                        dispatchMode -> TerminalFeedbackKind.Success
                        yaEmpaquetado -> TerminalFeedbackKind.Warning
                        empaquetadoAhora -> TerminalFeedbackKind.Success
                        else -> TerminalFeedbackKind.Warning
                    },
                )
            }

            is ScanOutcome.DuplicateRead -> showCard(
                card = ScanCardUi(
                    kind = ScanCardKind.Duplicate,
                    headline = "Ya lo leímos recién",
                    message = outcome.message
                        ?: "Este paquete ya se escaneó hace instantes. No se volvió a contar.",
                    shipment = outcome.shipment,
                    code = outcome.code,
                    readCode = readCode,
                    scanCount = outcome.scanCount,
                    packed = outcome.shipment?.packing?.packed == true,
                    printed = outcome.shipment?.packing?.printed == true,
                    qualityChecked = outcome.shipment?.packing?.qualityChecked == true,
                    dispatchChecked = outcome.shipment?.packing?.dispatchChecked == true,
                ),
                feedback = TerminalFeedbackKind.Warning,
            )

            is ScanOutcome.Ambiguous -> showCard(
                card = ScanCardUi(
                    kind = ScanCardKind.Ambiguous,
                    headline = "Código ambiguo",
                    message = outcome.message
                        ?: "Ese código coincide con varios paquetes. Escaneá el QR de la etiqueta.",
                    code = outcome.code,
                    readCode = readCode,
                    matchedBy = outcome.matchedBy,
                ),
                feedback = TerminalFeedbackKind.Warning,
            )

            is ScanOutcome.CarrierMismatch -> showCard(
                card = ScanCardUi(
                    kind = ScanCardKind.CarrierMismatch,
                    headline = "Transportista incorrecto",
                    message = outcome.message ?: "",
                    shipment = outcome.shipment,
                    readCode = readCode,
                    expectedCarrier = outcome.expected,
                    actualCarrier = outcome.actual,
                    printed = outcome.shipment?.packing?.printed == true,
                    packed = outcome.shipment?.packing?.packed == true,
                    qualityChecked = outcome.shipment?.packing?.qualityChecked == true,
                    dispatchChecked = outcome.shipment?.packing?.dispatchChecked == true,
                ),
                feedback = TerminalFeedbackKind.Error,
            )

            is ScanOutcome.NotFound -> showCard(
                card = ScanCardUi(
                    kind = ScanCardKind.NotFound,
                    headline = "Paquete no encontrado",
                    message = outcome.message ?: "",
                    code = outcome.code,
                    readCode = readCode,
                ),
                feedback = TerminalFeedbackKind.Error,
            )

            is ScanOutcome.Failure -> showCard(
                card = ScanCardUi(
                    kind = ScanCardKind.Error,
                    headline = "Error al escanear",
                    message = outcome.message ?: "",
                    readCode = readCode,
                ),
                feedback = TerminalFeedbackKind.Error,
            )
        }
        if (countContinuous) {
            _state.update { it.copy(continuousCount = it.continuousCount + 1) }
        }
    }

    private fun showCard(card: ScanCardUi, feedback: TerminalFeedbackKind) {
        feedbackSeq += 1L
        _state.update {
            it.copy(scanCard = card, feedback = TerminalFeedback(seq = feedbackSeq, kind = feedback))
        }
    }

    fun dismissScanCard() {
        _state.update { it.copy(scanCard = null, feedback = null) }
    }

    // ------------------------------------------------------------------
    // Acciones de empaque / despacho
    // ------------------------------------------------------------------

    fun markPacked(shipmentId: String, packed: Boolean = true) {
        if (shipmentId.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(isBusy = true, error = null) }
            when (val result = repository.markPacked(shipmentId, packed)) {
                is ApiResult.Ok -> {
                    val packing = result.value
                    _state.update { current ->
                        current.copy(
                            isBusy = false,
                            message = if (packed) {
                                "Paquete marcado como empaquetado."
                            } else {
                                "Paquete devuelto a pendientes de empaque."
                            },
                            packedCount = if (packed) {
                                current.packedCount + 1
                            } else {
                                (current.packedCount - 1).coerceAtLeast(0)
                            },
                            scanCard = current.scanCard?.copy(
                                packed = packing.packed == true,
                                printed = packing.printed == true,
                                qualityChecked = packing.qualityChecked == true,
                                dispatchChecked = packing.dispatchChecked == true,
                            ),
                        )
                    }
                    refreshQueueSilently()
                }

                is ApiResult.Err -> _state.update {
                    it.copy(isBusy = false, error = result.message)
                }
            }
        }
    }

    fun markDispatchChecked(shipmentId: String, checked: Boolean = true) {
        if (shipmentId.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(isBusy = true, error = null) }
            when (val result = repository.markDispatchChecked(shipmentId, checked)) {
                is ApiResult.Ok -> {
                    val packing = result.value
                    _state.update {
                        it.copy(
                            isBusy = false,
                            message = if (checked) {
                                "Paquete verificado para salida a transporte."
                            } else {
                                "Verificación de despacho quitada."
                            },
                            scanCard = it.scanCard?.copy(
                                dispatchChecked = packing.dispatchChecked == true,
                                packed = packing.packed == true,
                                printed = packing.printed == true,
                                qualityChecked = packing.qualityChecked == true,
                            ),
                        )
                    }
                    refreshQueueSilently()
                }

                is ApiResult.Err -> _state.update {
                    it.copy(isBusy = false, error = result.message)
                }
            }
        }
    }

    /** URL absoluta del PDF de la etiqueta, generada por el repositorio. */
    fun labelUrl(shipmentId: String): String? {
        if (shipmentId.isBlank()) return null
        return repository.labelUrl(shipmentId, "pdf")
    }

    // ------------------------------------------------------------------
    // Nota interna
    // ------------------------------------------------------------------

    fun openNote(shipment: Shipment) {
        _state.update {
            it.copy(noteTarget = shipment, noteDraft = shipment.packing?.note ?: "")
        }
    }

    fun closeNote() {
        _state.update { it.copy(noteTarget = null, noteDraft = "") }
    }

    fun onNoteDraftChange(value: String) {
        _state.update { it.copy(noteDraft = value) }
    }

    fun saveNote() {
        val target = _state.value.noteTarget ?: return
        val id = target.id ?: return
        val note = _state.value.noteDraft.trim()
        viewModelScope.launch {
            _state.update { it.copy(isBusy = true, error = null) }
            when (val result = repository.saveNote(id, note)) {
                is ApiResult.Ok -> {
                    val packing = result.value
                    _state.update {
                        it.copy(
                            isBusy = false,
                            noteTarget = null,
                            noteDraft = "",
                            message = "Nota guardada.",
                            scanCard = it.scanCard?.copy(
                                packed = packing.packed == true,
                                printed = packing.printed == true,
                                qualityChecked = packing.qualityChecked == true,
                                dispatchChecked = packing.dispatchChecked == true,
                            ),
                        )
                    }
                }

                is ApiResult.Err -> _state.update {
                    it.copy(isBusy = false, noteTarget = null, error = result.message)
                }
            }
        }
    }

    // ------------------------------------------------------------------
    // Mensajes
    // ------------------------------------------------------------------

    /** Muestra un aviso transitorio (snackbar) desde la pantalla. */
    fun reportMessage(text: String) {
        _state.update { it.copy(message = text) }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }

    fun dismissError() {
        _state.update { it.copy(error = null) }
    }

    private fun refreshQueueSilently() {
        viewModelScope.launch {
            when (val result = repository.refreshQueue()) {
                is ApiResult.Ok -> {
                    val previos = _state.value.queue.map { it.id }.toSet()
                    val hayNuevos = previos.isNotEmpty() &&
                        result.value.any { it.id !in previos }
                    _state.update {
                        it.copy(
                            queue = result.value,
                            message = if (hayNuevos) "Nuevas ventas sincronizadas" else it.message,
                        )
                    }
                }
                is ApiResult.Err -> Unit // se reintenta en la próxima recarga manual
            }
        }
    }

    /** Refresca contadores + cola desde bootstrap sin tocar `isLoading`. */
    private fun refreshSummarySilently() {
        viewModelScope.launch {
            when (val result = repository.refreshSummary()) {
                is ApiResult.Ok -> {
                    val data = result.value
                    val packed = data.summary?.packedCount?.toInt()
                        ?: _state.value.packedCount
                    val unpacked = data.summary?.unpackedCount?.toInt()
                        ?: data.queue.size
                    val total = data.summary?.readyToShipCount?.toInt()
                        ?: (packed + unpacked)
                    _state.update {
                        it.copy(
                            queue = data.queue,
                            packedCount = packed,
                            totalCount = maxOf(total, packed),
                        )
                    }
                }
                is ApiResult.Err -> Unit // se reintenta en el próximo ciclo
            }
        }
    }
}
