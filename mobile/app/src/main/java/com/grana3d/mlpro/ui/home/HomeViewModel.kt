package com.grana3d.mlpro.ui.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.grana3d.mlpro.core.ApiResult
import com.grana3d.mlpro.core.Constants
import com.grana3d.mlpro.data.repository.MobileRepository
import com.grana3d.mlpro.domain.ConnectionState
import com.grana3d.mlpro.domain.LinkedAccount
import com.grana3d.mlpro.domain.LowStockItem
import com.grana3d.mlpro.domain.MobileSummary
import com.grana3d.mlpro.domain.ScanLogEntry
import com.grana3d.mlpro.domain.Shipment
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Estado inmutable de la pantalla de inicio.
 *
 * La UI nunca lee el repositorio: todo lo que necesita está acá. Los accesos
 * derivados (conteos, nombre a mostrar, importe de ventas) se calculan con
 * conversiones tolerantes porque los conteos de la API pueden llegar como
 * número o como texto.
 */
data class HomeUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val warnings: List<String> = emptyList(),
    val account: LinkedAccount? = null,
    val connection: ConnectionState? = null,
    val summary: MobileSummary? = null,
    val queue: List<Shipment> = emptyList(),
    val lowStock: List<LowStockItem> = emptyList(),
    val recentLogs: List<ScanLogEntry> = emptyList(),
    val sessionName: String? = null,
    val sessionEmail: String? = null,
    val sessionAvatar: String? = null,
) {
    val displayName: String
        get() = account?.name?.takeIf { it.isNotBlank() }
            ?: sessionName?.takeIf { it.isNotBlank() }
            ?: "Operador de depósito"

    val displayEmail: String
        get() = account?.email ?: sessionEmail ?: ""

    val displayAvatar: String?
        get() = account?.avatar?.takeIf { it.isNotBlank() } ?: sessionAvatar

    val isConnected: Boolean
        get() = connection?.connected == true

    val connectionDetail: String
        get() {
            val nickname = connection?.nickname
            if (!nickname.isNullOrBlank()) return "Cuenta $nickname"
            val message = connection?.message
            if (!message.isNullOrBlank()) return message
            return "Sincronizado con ML Pro Suite"
        }

    /** Paquetes por despachar (todo lo que sigue en la cola). */
    val pendingCount: Int
        get() = summary?.pendingShipmentsCount?.toInt() ?: queue.size

    /** Paquetes que todavía no están empaquetados. */
    val unpackedCount: Int
        get() = summary?.unpackedCount?.toInt() ?: queue.size

    /** Paquetes ya empaquetados. */
    val packedCount: Int
        get() = summary?.packedCount?.toInt() ?: 0

    /** Envíos en tránsito. */
    val inTransitCount: Int
        get() = summary?.inTransitShipmentsCount?.toInt() ?: 0

    /** Envíos entregados. */
    val deliveredCount: Int
        get() = summary?.deliveredShipmentsCount?.toInt() ?: 0

    /** Órdenes pagadas. */
    val paidOrdersCount: Int
        get() = summary?.paidOrdersCount?.toInt() ?: 0

    /** Publicaciones con stock bajo. */
    val lowStockCount: Int
        get() = summary?.lowStockCount?.toInt() ?: lowStock.size

    /** Total vendido cobrado, en ARS. */
    val totalSales: Double
        get() = summary?.totalSalesAmount?.toDouble() ?: 0.0
}

class HomeViewModel(
    private val repository: MobileRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    private var pollJob: Job? = null

    init {
        viewModelScope.launch {
            repository.sessionState.collect { session ->
                _state.update {
                    it.copy(
                        sessionName = session.userName,
                        sessionEmail = session.userEmail,
                        sessionAvatar = session.userAvatar,
                    )
                }
            }
        }
        load()
        startHomePolling()
    }

    /** Refresco silencioso del panel mientras el Home está abierto. */
    private fun startHomePolling() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (isActive) {
                delay(Constants.HOME_POLL_INTERVAL_MS)
                load(silent = true)
            }
        }
    }

    override fun onCleared() {
        pollJob?.cancel()
        super.onCleared()
    }

    /** Trae todo el panel en una sola llamada (`GET /mobile/bootstrap`). */
    fun load(silent: Boolean = false) {
        viewModelScope.launch {
            val yaHayDatos = _state.value.summary != null || _state.value.queue.isNotEmpty()
            _state.update {
                it.copy(isLoading = if (silent && yaHayDatos) it.isLoading else true)
            }
            when (val result = repository.bootstrap()) {
                is ApiResult.Ok -> {
                    val data = result.value
                    _state.update {
                        it.copy(
                            isLoading = false,
                            error = null,
                            warnings = data.errors,
                            account = data.account,
                            connection = data.connection,
                            summary = data.summary,
                            queue = data.queue,
                            lowStock = data.lowStock,
                            recentLogs = data.recentLogs,
                        )
                    }
                }

                is ApiResult.Err -> _state.update {
                    it.copy(isLoading = false, error = result.message)
                }
            }
        }
    }

    fun dismissError() {
        _state.update { it.copy(error = null) }
    }

    fun dismissWarnings() {
        _state.update { it.copy(warnings = emptyList()) }
    }
}
