package com.grana3d.mlpro.ui.home

import android.content.Context
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
import com.grana3d.mlpro.util.Notifications
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

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
    /**
     * Preguntas sin responder (`GET /questions`). `null` = todavía no se consultó:
     * la tarjeta de Preguntas no muestra conteo en lugar de mostrar un número falso.
     */
    val unansweredCount: Int? = null,
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
            return "Sincronizado con Fullpack"
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
    private val appContext: Context,
) : ViewModel() {

    private val _state = MutableStateFlow(HomeUiState())
    val state: StateFlow<HomeUiState> = _state.asStateFlow()

    private var pollJob: Job? = null

    /**
     * Ids ya notificados (`sale_<id>`, `question_<id>`): el backend puede repetir una
     * novedad entre polls y el cursor sólo avanza en consultas exitosas, así que el set
     * en memoria evita duplicados. Vive lo que vive el Home (primer plano, sin FCM).
     */
    private val seenUpdateIds = mutableSetOf<String>()

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
                    // Tras el panel, en segundo plano: conteo de preguntas y novedades.
                    // Ninguno rompe el panel si falla: son silenciosos a propósito.
                    refreshUnansweredCount()
                    pollUpdates()
                }

                is ApiResult.Err -> _state.update {
                    it.copy(isLoading = false, error = result.message)
                }
            }
        }
    }

    /**
     * Conteo real de preguntas sin responder para la tarjeta de Preguntas.
     * Si falla se conserva el valor anterior (o `null` = sin conteo, nunca un falso).
     */
    private suspend fun refreshUnansweredCount() {
        when (val result = repository.listQuestions(Constants.QUESTIONS_STATUS_UNANSWERED)) {
            is ApiResult.Ok -> _state.update { it.copy(unansweredCount = result.value.size) }
            is ApiResult.Err -> { /* silencioso: el conteo queda como estaba */ }
        }
    }

    /**
     * Consulta `GET /mobile/updates` con el cursor de `SessionStore` y notifica cada
     * novedad no vista. La primera vez (sin cursor) sólo guarda el cursor sin notificar.
     * Nunca muestra errores: un 404 (backend sin la ruta) o la red caída no molestan.
     */
    private suspend fun pollUpdates() {
        val sinceEpoch = runCatching { repository.sessionState.first().lastUpdatesAt }.getOrNull()
        val sinceIso = sinceEpoch?.takeIf { it > 0L }?.let { millisToIso(it) }
        when (val result = repository.checkMobileUpdates(sinceIso)) {
            is ApiResult.Ok -> {
                if (sinceIso != null) {
                    result.value.newOrders.forEach { order ->
                        if (seenUpdateIds.add("sale_" + order.id)) {
                            Notifications.showSale(appContext, order)
                        }
                    }
                    result.value.newQuestions.forEach { question ->
                        if (seenUpdateIds.add("question_" + question.id)) {
                            Notifications.showQuestion(appContext, question)
                        }
                    }
                    trimSeenIds()
                }
                repository.saveUpdatesCursor(System.currentTimeMillis())
            }

            is ApiResult.Err -> { /* silencioso: se reintenta en el próximo poll */ }
        }
    }

    /** El set de ids vistos no crece sin cota: el cursor ya avanzó, lo viejo no vuelve. */
    private fun trimSeenIds() {
        if (seenUpdateIds.size <= MAX_SEEN_IDS) return
        val iterator = seenUpdateIds.iterator()
        var drop = seenUpdateIds.size - MAX_SEEN_IDS
        while (drop > 0 && iterator.hasNext()) {
            iterator.next()
            iterator.remove()
            drop--
        }
    }

    fun dismissError() {
        _state.update { it.copy(error = null) }
    }

    fun dismissWarnings() {
        _state.update { it.copy(warnings = emptyList()) }
    }

    private companion object {
        const val MAX_SEEN_IDS: Int = 500

        /** Epoch ms → ISO 8601 UTC, el formato que espera `?since=` del backend. */
        fun millisToIso(millis: Long): String {
            val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            format.timeZone = TimeZone.getTimeZone("UTC")
            return format.format(java.util.Date(millis))
        }
    }
}
