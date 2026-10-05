package com.grana3d.mlpro.data.local

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.grana3d.mlpro.core.Constants
import com.grana3d.mlpro.core.normalizeApiBase
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** Único DataStore de la app. Se declara a nivel de archivo para que sea un singleton. */
private val Context.mlProDataStore: DataStore<Preferences> by preferencesDataStore(name = "mlpro_session")

/**
 * Estado de la vinculación del dispositivo, tal como lo consume la UI.
 * La app **no** guarda credenciales de Mercado Libre: sólo el token de dispositivo.
 */
data class SessionState(
    val deviceToken: String? = null,
    val apiBase: String = Constants.DEFAULT_API_BASE,
    val userName: String? = null,
    val userEmail: String? = null,
    val userAvatar: String? = null,
    val deviceName: String? = null,
    val linkedAt: Long? = null,
    /**
     * Cursor del polling de novedades (epoch ms de la última consulta exitosa a
     * `GET /mobile/updates`). `null` = todavía no se consultó: la primera vez se guarda
     * el cursor sin notificar nada.
     */
    val lastUpdatesAt: Long? = null,
) {
    val isLinked: Boolean get() = !deviceToken.isNullOrBlank()
}

/**
 * Persistencia local de la sesión sobre `preferencesDataStore(name = "mlpro_session")`.
 *
 * Se guarda el token de dispositivo, la URL base del servidor, los datos básicos del
 * usuario (nombre, email y avatar, extraídos del `userJson` que devuelve `/pair/claim`),
 * el nombre del dispositivo y el momento de la vinculación. El `secret` del QR **nunca**
 * se persiste: se usa una sola vez y se descarta.
 *
 * Ninguna función lanza: si el DataStore falla (disco lleno, proceso reiniciado),
 * las escrituras se tragan el error y las lecturas devuelven el estado por defecto.
 */
class SessionStore(private val context: Context) {

    /** Estado de sesión reactivo: la UI se entera sola de la vinculación y la desvinculación. */
    val state: Flow<SessionState> = context.mlProDataStore.data.map { prefs ->
        SessionState(
            deviceToken = prefs[KEY_DEVICE_TOKEN]?.takeIf { it.isNotBlank() },
            apiBase = normalizeApiBase(prefs[KEY_API_BASE]),
            userName = prefs[KEY_USER_NAME]?.takeIf { it.isNotBlank() },
            userEmail = prefs[KEY_USER_EMAIL]?.takeIf { it.isNotBlank() },
            userAvatar = prefs[KEY_USER_AVATAR]?.takeIf { it.isNotBlank() },
            deviceName = prefs[KEY_DEVICE_NAME]?.takeIf { it.isNotBlank() },
            linkedAt = prefs[KEY_LINKED_AT]?.takeIf { it > 0L },
            lastUpdatesAt = prefs[KEY_LAST_UPDATES_AT]?.takeIf { it > 0L },
        )
    }

    /**
     * Guarda la vinculación completa. [userJson] es el objeto `user` crudo del backend;
     * si no se puede parsear, igual se guarda la sesión (con los datos de usuario vacíos)
     * porque el token es lo único imprescindible para operar.
     */
    suspend fun saveLink(deviceToken: String, apiBase: String, userJson: String, deviceName: String) {
        val user = parseUserJson(userJson)
        runCatching {
            context.mlProDataStore.edit { prefs ->
                prefs[KEY_DEVICE_TOKEN] = deviceToken.trim()
                prefs[KEY_API_BASE] = normalizeApiBase(apiBase)
                prefs[KEY_DEVICE_NAME] = deviceName.trim()
                prefs[KEY_LINKED_AT] = System.currentTimeMillis()
                user?.name?.let { prefs[KEY_USER_NAME] = it }
                user?.email?.let { prefs[KEY_USER_EMAIL] = it }
                user?.avatar?.let { prefs[KEY_USER_AVATAR] = it }
            }
        }
    }

    /** Cambia la URL del servidor sin tocar la vinculación (Ajustes → URL del servidor). */
    suspend fun setApiBase(apiBase: String) {
        runCatching {
            context.mlProDataStore.edit { prefs ->
                prefs[KEY_API_BASE] = normalizeApiBase(apiBase)
            }
        }
    }

    /** Guarda el cursor del polling de novedades (epoch ms de la última consulta exitosa). */
    suspend fun setLastUpdatesAt(now: Long) {
        runCatching {
            context.mlProDataStore.edit { prefs ->
                prefs[KEY_LAST_UPDATES_AT] = now
            }
        }
    }

    /**
     * Borra la vinculación: la app vuelve a la pantalla de vinculación.
     *
     * La URL del servidor se conserva a propósito: si alguien cambió el servidor a mano
     * (backend propio o de la LAN), no tiene que volver a escribirlo al revincular.
     */
    suspend fun clear() {
        runCatching {
            context.mlProDataStore.edit { prefs ->
                val apiBase = prefs[KEY_API_BASE]
                prefs.clear()
                if (!apiBase.isNullOrBlank()) prefs[KEY_API_BASE] = apiBase
            }
        }
    }

    /** Extrae nombre, email y avatar del `user` del backend sin romperse con JSON raro. */
    private fun parseUserJson(userJson: String): PersistedUser? {
        val texto = userJson.trim()
        if (texto.isEmpty()) return null

        val obj = runCatching {
            USER_JSON_LENIENT.parseToJsonElement(texto) as? JsonObject
        }.getOrNull() ?: return null

        return PersistedUser(
            name = obj.stringOrNull("name"),
            email = obj.stringOrNull("email"),
            avatar = obj.stringOrNull("avatar"),
        )
    }

    private data class PersistedUser(val name: String?, val email: String?, val avatar: String?)

    private companion object {
        val KEY_DEVICE_TOKEN = stringPreferencesKey("device_token")
        val KEY_API_BASE = stringPreferencesKey("api_base")
        val KEY_USER_NAME = stringPreferencesKey("user_name")
        val KEY_USER_EMAIL = stringPreferencesKey("user_email")
        val KEY_USER_AVATAR = stringPreferencesKey("user_avatar")
        val KEY_DEVICE_NAME = stringPreferencesKey("device_name")
        val KEY_LINKED_AT = longPreferencesKey("linked_at")
        val KEY_LAST_UPDATES_AT = longPreferencesKey("last_updates_at")

        val USER_JSON_LENIENT = Json {
            ignoreUnknownKeys = true
            isLenient = true
            coerceInputValues = true
            explicitNulls = false
        }
    }
}

/** Lee un campo de texto de un JSON crudo, sin romperse con nulos ni números. */
private fun JsonObject.stringOrNull(key: String): String? {
    val primitive = this[key] as? JsonPrimitive ?: return null
    return primitive.content.takeIf { it.isNotEmpty() && it != "null" }
}
