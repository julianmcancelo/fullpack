package com.grana3d.mlpro.ui.pairing

import android.os.Build
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.grana3d.mlpro.BuildConfig
import com.grana3d.mlpro.core.ApiResult
import com.grana3d.mlpro.core.Constants
import com.grana3d.mlpro.core.QrPayload
import com.grana3d.mlpro.core.parseQrPayload
import com.grana3d.mlpro.data.repository.MobileRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Estado de la pantalla de vinculación.
 *
 * [notice] es para mensajes suaves (por ejemplo, un QR que no es de ML Pro): no cortan
 * el escaneo, sólo avisan. [error] es para fallas reales de vinculación.
 */
data class PairingUiState(
    val connecting: Boolean = false,
    val error: String? = null,
    val notice: String? = null,
    val serverUrl: String = Constants.DEFAULT_API_BASE,
    val serverUrlDraft: String = Constants.DEFAULT_API_BASE,
    val manualEntryVisible: Boolean = false,
    val linked: Boolean = false,
    val linkedName: String? = null,
)

/**
 * Vinculación del celular contra el backend de ML Pro Suite.
 *
 * El QR trae el código, la clave y la URL del servidor; la app los canjea por un token
 * de dispositivo (`/pair/claim`). También acepta el código escrito a mano, para cuando
 * la cámara no puede leer el QR.
 */
class PairingViewModel(private val repository: MobileRepository) : ViewModel() {

    private val _state = MutableStateFlow(PairingUiState())
    val state: StateFlow<PairingUiState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            repository.sessionState.collect { session ->
                _state.update { current ->
                    // Mientras el usuario no edite la URL, seguimos la que está guardada.
                    val synced = current.serverUrlDraft == current.serverUrl
                    current.copy(
                        serverUrl = session.apiBase,
                        serverUrlDraft = if (synced) session.apiBase else current.serverUrlDraft,
                    )
                }
            }
        }
    }

    /** Procesa el texto crudo leído por la cámara. */
    fun claim(raw: String) {
        if (_state.value.connecting || _state.value.linked) return

        val payload = parseQrPayload(raw)
        if (payload == null) {
            _state.update {
                it.copy(notice = "Ese código no es un QR de vinculación de Fullpack. Buscá el QR en Vincular celular.")
            }
            return
        }

        claimWith(payload.code, payload.secret, payload.apiBase)
    }

    /**
     * Vinculación manual. [codeText] puede ser el código de 6 caracteres, el JSON completo
     * del QR o el texto `CODIGO:CLAVE`. Si viene separado, [secret] tiene la clave.
     */
    fun claimManual(codeText: String, secret: String) {
        if (_state.value.connecting || _state.value.linked) return

        val text = codeText.trim()
        if (text.isEmpty()) {
            _state.update { it.copy(error = "Escribí el código que muestra la web.") }
            return
        }

        // Con clave aparte: código simple. Sin clave: intentamos interpretar el texto pegado.
        if (secret.isBlank()) {
            val payload = parseQrPayload(text)
            if (payload == null) {
                _state.update {
                    it.copy(error = "El código no es válido. Copiá el código de 6 caracteres y su clave.")
                }
                return
            }
            claimWith(payload.code, payload.secret, payload.apiBase)
            return
        }

        claimWith(text.uppercase(), secret.trim(), null)
    }

    private fun claimWith(code: String, secret: String, apiBase: String?) {
        viewModelScope.launch {
            _state.update { it.copy(connecting = true, error = null, notice = null) }

            val target = apiBase?.takeIf { it.isNotBlank() } ?: _state.value.serverUrlDraft
            repository.setApiBase(target)

            val payload = QrPayload(code = code, secret = secret, apiBase = target, email = null)
            val result = repository.claim(payload, deviceName(), BuildConfig.VERSION_NAME)

            when (result) {
                is ApiResult.Ok -> _state.update {
                    it.copy(
                        connecting = false,
                        linked = true,
                        linkedName = result.value.name,
                        manualEntryVisible = false,
                        error = null,
                    )
                }

                is ApiResult.Err -> _state.update {
                    it.copy(connecting = false, error = result.message, manualEntryVisible = true)
                }
            }
        }
    }

    fun setServerUrlDraft(value: String) {
        _state.update { it.copy(serverUrlDraft = value) }
    }

    /** Guarda la URL del servidor escrita a mano (se usa para un backend local o propio). */
    fun applyServerUrl() {
        val url = _state.value.serverUrlDraft.trim().trimEnd('/')
        if (!url.startsWith("http://") && !url.startsWith("https://")) {
            _state.update { it.copy(error = "La URL tiene que empezar con http:// o https://") }
            return
        }
        viewModelScope.launch {
            repository.setApiBase(url)
            _state.update {
                it.copy(serverUrl = url, serverUrlDraft = url, error = null, notice = "Servidor actualizado.")
            }
        }
    }

    fun showManualEntry(visible: Boolean) {
        _state.update { it.copy(manualEntryVisible = visible, error = null) }
    }

    fun dismissError() {
        _state.update { it.copy(error = null) }
    }

    fun dismissNotice() {
        _state.update { it.copy(notice = null) }
    }

    private fun deviceName(): String {
        val name = "${Build.MANUFACTURER} ${Build.MODEL}".trim()
        return name.ifBlank { "Celular Android" }
    }
}
