package com.grana3d.mlpro.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.grana3d.mlpro.core.ApiResult
import com.grana3d.mlpro.core.normalizeApiBase
import com.grana3d.mlpro.data.repository.MobileRepository
import com.grana3d.mlpro.domain.ConnectionState
import com.grana3d.mlpro.domain.LinkedAccount
import com.grana3d.mlpro.domain.LinkedDevice
import com.grana3d.mlpro.domain.UpdateCheck
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SettingsUiState(
    val isLoading: Boolean = true,
    val error: String? = null,
    val message: String? = null,
    val account: LinkedAccount? = null,
    val device: LinkedDevice? = null,
    val connection: ConnectionState? = null,
    val apiBase: String = "",
    val apiBaseError: String? = null,
    val isSavingBase: Boolean = false,
    val isUnlinking: Boolean = false,
    val unlinked: Boolean = false,
    val linkedAt: Long? = null,
    val sessionName: String? = null,
    val sessionEmail: String? = null,
    val sessionAvatar: String? = null,
    /** Hora del servidor del último `bootstrap`: indica cuán frescos están los datos. */
    val serverTime: String? = null,
    /** Búsqueda de actualizaciones en GitHub Releases. */
    val isCheckingUpdates: Boolean = false,
    val updateResult: UpdateCheck? = null,
) {
    val displayName: String
        get() = account?.name?.takeIf { it.isNotBlank() }
            ?: sessionName?.takeIf { it.isNotBlank() }
            ?: "Sin cuenta vinculada"

    val displayEmail: String
        get() = account?.email?.takeIf { it.isNotBlank() } ?: sessionEmail ?: "—"

    val displayAvatar: String?
        get() = account?.avatar?.takeIf { it.isNotBlank() } ?: sessionAvatar

    val role: String
        get() = account?.role?.takeIf { it.isNotBlank() } ?: "user"

    val isLinked: Boolean
        get() = account != null || !sessionEmail.isNullOrBlank()

    val isConnected: Boolean
        get() = connection?.connected == true

    val connectionDetail: String
        get() {
            val nickname = connection?.nickname
            if (!nickname.isNullOrBlank()) return "Cuenta $nickname"
            val message = connection?.message
            if (!message.isNullOrBlank()) return message
            return "Sin detalle de la conexión"
        }

    val deviceName: String
        get() = device?.name?.takeIf { it.isNotBlank() } ?: "Dispositivo Android"

    val devicePlatform: String
        get() = device?.platform?.takeIf { it.isNotBlank() } ?: "android"

    val deviceLastSeen: String?
        get() = device?.lastSeenAt

    /** Texto de frescura: fecha legible de la última sincronización con el servidor. */
    val lastSyncLabel: String
        get() = serverTime?.takeIf { it.isNotBlank() } ?: ""
}

/**
 * Ajustes: cuenta vinculada, dispositivo, conexión con Mercado Libre, URL del
 * servidor y desvinculación.
 */
class SettingsViewModel(
    private val repository: MobileRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(SettingsUiState())
    val state: StateFlow<SettingsUiState> = _state.asStateFlow()

    /** El auto-chequeo de actualizaciones se dispara una sola vez por vida del VM. */
    private var autoUpdateCheckDone: Boolean = false

    init {
        viewModelScope.launch {
            repository.sessionState.collect { session ->
                _state.update {
                    it.copy(
                        apiBase = session.apiBase,
                        linkedAt = session.linkedAt,
                        sessionName = session.userName,
                        sessionEmail = session.userEmail,
                        sessionAvatar = session.userAvatar,
                    )
                }
            }
        }
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = it.account == null && it.device == null, error = null) }
            when (val result = repository.bootstrap()) {
                is ApiResult.Ok -> {
                    val data = result.value
                    _state.update {
                        it.copy(
                            isLoading = false,
                            error = null,
                            account = data.account,
                            device = data.device,
                            connection = data.connection,
                            serverTime = data.serverTime,
                        )
                    }
                }

                is ApiResult.Err -> _state.update {
                    it.copy(isLoading = false, error = result.message)
                }
            }
            // Además del botón manual: al abrir Ajustes se busca actualización una vez,
            // sin pisar una búsqueda en curso ni un resultado ya mostrado.
            if (!autoUpdateCheckDone &&
                _state.value.updateResult == null &&
                !_state.value.isCheckingUpdates
            ) {
                autoUpdateCheckDone = true
                checkForUpdates()
            }
        }
    }

    fun onApiBaseChange(value: String) {
        _state.update { it.copy(apiBase = value, apiBaseError = null) }
    }

    /** Valida y guarda la URL del servidor en `SessionStore`. */
    fun saveApiBase() {
        val raw = _state.value.apiBase.trim()
        val problem = apiBaseProblem(raw)
        if (problem != null) {
            _state.update { it.copy(apiBaseError = problem) }
            return
        }
        // `normalizeApiBase` saca las barras finales para que nunca quede "//" en las rutas.
        val candidate = normalizeApiBase(raw)
        viewModelScope.launch {
            _state.update { it.copy(isSavingBase = true, apiBaseError = null) }
            repository.setApiBase(candidate)
            _state.update {
                it.copy(
                    isSavingBase = false,
                    apiBase = candidate,
                    message = "URL del servidor guardada.",
                )
            }
        }
    }

    /** Desvincula el dispositivo y avisa a la pantalla para que navegue. */
    fun unlink() {
        viewModelScope.launch {
            _state.update { it.copy(isUnlinking = true, error = null) }
            when (val result = repository.unlink()) {
                is ApiResult.Ok -> _state.update { it.copy(isUnlinking = false, unlinked = true) }

                is ApiResult.Err -> _state.update {
                    it.copy(isUnlinking = false, error = result.message)
                }
            }
        }
    }

    /** Consulta los GitHub Releases públicos y guarda el resultado para la pantalla. */
    fun checkForUpdates() {
        if (_state.value.isCheckingUpdates) return
        viewModelScope.launch {
            _state.update { it.copy(isCheckingUpdates = true, updateResult = null) }
            val result = repository.checkForUpdates()
            _state.update { it.copy(isCheckingUpdates = false, updateResult = result) }
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

/**
 * Reglas de validación de la URL del servidor: tiene que empezar con `http://`
 * o `https://` y terminar en `/api`. Devuelve `null` cuando está bien.
 */
internal fun apiBaseProblem(value: String): String? {
    val candidate = value.trim()
    if (candidate.isEmpty()) return "Ingresá la URL del servidor."
    if (!candidate.startsWith("http://") && !candidate.startsWith("https://")) {
        return "La URL tiene que empezar con http:// o https://"
    }
    if (!candidate.trimEnd('/').endsWith("/api")) {
        return "La URL tiene que terminar en /api"
    }
    return null
}
