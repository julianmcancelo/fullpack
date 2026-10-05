package com.grana3d.mlpro.ui.shipments

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.grana3d.mlpro.core.ApiResult
import com.grana3d.mlpro.data.repository.MobileRepository
import com.grana3d.mlpro.domain.PackingState
import com.grana3d.mlpro.domain.Shipment
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Filtro segmentado de la lista de envíos. */
enum class ShipmentsFilter(val label: String) {
    ALL("Todos"),
    UNPACKED("Sin empaquetar"),
    PACKED("Empaquetados"),
    IN_TRANSIT("En tránsito"),
}

data class ShipmentsUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val message: String? = null,
    val query: String = "",
    val filter: ShipmentsFilter = ShipmentsFilter.ALL,
    val shipments: List<Shipment> = emptyList(),
    val busyId: String? = null,
) {
    /** Paquetes que pasan el filtro y la búsqueda. */
    val visible: List<Shipment>
        get() = shipments.filter { shipment ->
            matchesFilter(shipment, filter) && matchesQuery(shipment, query)
        }

    /** Texto del estado vacío, explicando por qué no hay nada que mostrar. */
    val emptyMessage: String
        get() = when (filter) {
            ShipmentsFilter.ALL -> if (query.isBlank()) {
                "Todavía no hay paquetes pendientes de empaque."
            } else {
                "Ningún paquete coincide con \"$query\"."
            }

            ShipmentsFilter.UNPACKED -> "No quedan paquetes sin empaquetar en la cola."
            ShipmentsFilter.PACKED -> "La cola móvil sólo devuelve paquetes pendientes: los ya empaquetados salen de la lista."
            ShipmentsFilter.IN_TRANSIT -> if (shipments.isNotEmpty()) {
                "Sin envíos en tránsito por ahora."
            } else {
                "Los envíos en tránsito todavía no se listan en la app móvil."
            }
        }
}

/**
 * Lista de envíos: búsqueda, filtro segmentado y acciones rápidas de empaque.
 *
 * La API móvil (`GET /mobile/queue`) devuelve la cola de paquetes pendientes de
 * empaque, así que los filtros "Empaquetados" y "En tránsito" quedan vacíos por
 * ahora: se conservan porque el filtro es parte del contrato de la pantalla.
 */
class ShipmentsViewModel(
    private val repository: MobileRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ShipmentsUiState())
    val state: StateFlow<ShipmentsUiState> = _state.asStateFlow()

    /** Última versión conocida de cada paquete, para abrir el detalle sin volver a pedirlo. */
    private val known = mutableMapOf<String, Shipment>()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.update {
                it.copy(
                    isLoading = it.shipments.isEmpty(),
                    isRefreshing = it.shipments.isNotEmpty(),
                    error = null,
                )
            }
            when (val result = repository.refreshQueue()) {
                is ApiResult.Ok -> {
                    result.value.forEach { shipment -> remember(shipment) }
                    _state.update {
                        it.copy(
                            isLoading = false,
                            isRefreshing = false,
                            error = null,
                            shipments = result.value,
                        )
                    }
                }

                is ApiResult.Err -> _state.update {
                    it.copy(isLoading = false, isRefreshing = false, error = result.message)
                }
            }
        }
    }

    private fun remember(shipment: Shipment) {
        val id = shipment.id ?: ""
        if (id.isNotBlank()) known[id] = shipment
    }

    /** Busca un paquete entre los que ya vimos. */
    fun findShipment(shipmentId: String): Shipment? =
        _state.value.shipments.firstOrNull { it.id == shipmentId } ?: known[shipmentId]

    fun setQuery(value: String) {
        _state.update { it.copy(query = value) }
    }

    fun setFilter(filter: ShipmentsFilter) {
        _state.update { it.copy(filter = filter) }
    }

    fun labelUrl(shipmentId: String): String? =
        if (shipmentId.isBlank()) null else repository.labelUrl(shipmentId, "pdf")

    fun markPacked(shipmentId: String, packed: Boolean) {
        if (shipmentId.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(busyId = shipmentId, error = null) }
            when (val result = repository.markPacked(shipmentId, packed)) {
                is ApiResult.Ok -> {
                    _state.update {
                        it.copy(
                            busyId = null,
                            message = if (packed) {
                                "Paquete marcado como empaquetado."
                            } else {
                                "Paquete devuelto a pendientes de empaque."
                            },
                        )
                    }
                    load()
                }

                is ApiResult.Err -> _state.update {
                    it.copy(busyId = null, error = result.message)
                }
            }
        }
    }

    fun reportMessage(text: String) {
        _state.update { it.copy(message = text) }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }

    fun dismissError() {
        _state.update { it.copy(error = null) }
    }
}

data class ShipmentDetailUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val message: String? = null,
    val shipment: Shipment? = null,
    val printed: Boolean = false,
    val packed: Boolean = false,
    val qualityChecked: Boolean = false,
    val dispatchChecked: Boolean = false,
    val note: String = "",
    val isBusy: Boolean = false,
    val isSavingNote: Boolean = false,
)

/**
 * Detalle de un paquete: datos completos, checklist de empaque y nota interna.
 *
 * El paquete se resuelve desde la cola móvil (`GET /mobile/queue`), que es el
 * único listado que expone la API para el celular.
 */
class ShipmentDetailViewModel(
    private val repository: MobileRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(ShipmentDetailUiState())
    val state: StateFlow<ShipmentDetailUiState> = _state.asStateFlow()

    private var shipmentId: String = ""

    fun load(shipmentId: String) {
        this.shipmentId = shipmentId
        viewModelScope.launch {
            _state.update { it.copy(isLoading = it.shipment == null, error = null) }
            when (val result = repository.refreshQueue()) {
                is ApiResult.Ok -> {
                    val found = result.value.firstOrNull { it.id == shipmentId }
                    if (found == null) {
                        _state.update {
                            it.copy(
                                isLoading = false,
                                error = "No encontramos el paquete #$shipmentId en la cola de empaque. Puede estar ya despachado.",
                            )
                        }
                    } else {
                        applyShipment(shipment = found, keepDraft = false)
                    }
                }

                is ApiResult.Err -> _state.update {
                    it.copy(isLoading = false, error = result.message)
                }
            }
        }
    }

    private fun applyShipment(shipment: Shipment, keepDraft: Boolean) {
        val packing = shipment.packing
        _state.update {
            it.copy(
                isLoading = false,
                error = null,
                shipment = shipment,
                printed = packing?.printed == true,
                packed = packing?.packed == true,
                qualityChecked = packing?.qualityChecked == true,
                dispatchChecked = packing?.dispatchChecked == true,
                note = if (keepDraft) it.note else (packing?.note ?: ""),
            )
        }
    }

    fun setPrinted(value: Boolean) = runPackingAction(
        successMessage = if (value) "Etiqueta marcada como impresa." else "Etiqueta marcada como no impresa.",
    ) {
        repository.markPrinted(shipmentId, value)
    }

    fun setPacked(value: Boolean) = runPackingAction(
        successMessage = if (value) "Paquete marcado como empaquetado." else "Paquete devuelto a pendientes.",
    ) {
        repository.markPacked(shipmentId, value)
    }

    /** Control de calidad: `PUT /shipments/{id}/packing` con `qualityChecked`. */
    fun setQualityChecked(value: Boolean) = runPackingAction(
        successMessage = if (value) "Control de calidad registrado." else "Control de calidad desmarcado.",
    ) {
        repository.markQualityChecked(shipmentId, value)
    }

    fun setDispatchChecked(value: Boolean) = runPackingAction(
        successMessage = if (value) "Verificación de despacho registrada." else "Verificación de despacho quitada.",
    ) {
        repository.markDispatchChecked(shipmentId, value)
    }

    private fun runPackingAction(
        successMessage: String,
        action: suspend () -> ApiResult<PackingState>,
    ) {
        if (shipmentId.isBlank()) return
        viewModelScope.launch {
            _state.update { it.copy(isBusy = true, error = null) }
            when (val result = action()) {
                is ApiResult.Ok -> {
                    val packing = result.value
                    _state.update {
                        it.copy(
                            isBusy = false,
                            message = successMessage,
                            printed = packing.printed == true,
                            packed = packing.packed == true,
                            qualityChecked = packing.qualityChecked == true,
                            dispatchChecked = packing.dispatchChecked == true,
                        )
                    }
                }

                is ApiResult.Err -> _state.update {
                    it.copy(isBusy = false, error = result.message)
                }
            }
        }
    }

    fun onNoteChange(value: String) {
        _state.update { it.copy(note = value) }
    }

    fun saveNote() {
        if (shipmentId.isBlank()) return
        val note = _state.value.note.trim()
        viewModelScope.launch {
            _state.update { it.copy(isSavingNote = true, error = null) }
            when (val result = repository.saveNote(shipmentId, note)) {
                is ApiResult.Ok -> _state.update {
                    it.copy(isSavingNote = false, message = "Nota interna guardada.")
                }

                is ApiResult.Err -> _state.update {
                    it.copy(isSavingNote = false, error = result.message)
                }
            }
        }
    }

    fun labelUrl(): String? =
        if (shipmentId.isBlank()) null else repository.labelUrl(shipmentId, "pdf")

    fun reportMessage(text: String) {
        _state.update { it.copy(message = text) }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }

    fun dismissError() {
        _state.update { it.copy(error = null) }
    }
}

private fun matchesFilter(shipment: Shipment, filter: ShipmentsFilter): Boolean = when (filter) {
    ShipmentsFilter.ALL -> true
    ShipmentsFilter.UNPACKED -> shipment.packing?.packed != true
    ShipmentsFilter.PACKED -> shipment.packing?.packed == true
    // En tránsito = `shipped`, igual que el mapeo único (`statusTone`/`statusLabel`):
    // ningún otro estado cuenta como tránsito.
    ShipmentsFilter.IN_TRANSIT -> shipment.status == "shipped"
}

private fun matchesQuery(shipment: Shipment, query: String): Boolean {
    val needle = query.trim().lowercase()
    if (needle.isEmpty()) return true
    val haystack = listOfNotNull(
        shipment.id,
        shipment.orderId,
        shipment.itemTitle,
        shipment.itemSku,
        shipment.buyerName,
        shipment.buyerNickname,
        shipment.city,
        shipment.state,
        shipment.trackingNumber,
        shipment.logisticLabel,
    ).joinToString(separator = " ").lowercase()
    return haystack.contains(needle)
}
