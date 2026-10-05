package com.grana3d.mlpro.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map

/** DataStore propio del tema: sobrevive a la desvinculación (no se borra en `clear`). */
private val Context.mlProThemeDataStore by preferencesDataStore(name = "mlpro_theme")

/** Modo de apariencia elegido en Ajustes. Vive acá para no sumar archivos. */
enum class ThemeMode { SYSTEM, LIGHT, DARK }

/**
 * Persistencia del modo de apariencia sobre `preferencesDataStore(name = "mlpro_theme")`.
 *
 * Usa un DataStore separado del de sesión a propósito: al desvincular se borra la
 * sesión pero el tema elegido se conserva.
 *
 * Ninguna función lanza: si el DataStore falla, las escrituras se tragan el error y
 * las lecturas devuelven el modo por defecto ([ThemeMode.SYSTEM]).
 */
class ThemeStore(private val context: Context) {

    /** Modo reactivo: la UI cambia entre claro y oscuro sin reiniciar la app. */
    val mode: Flow<ThemeMode> = context.mlProThemeDataStore.data
        .catch { emit(emptyPreferences()) }
        .map { prefs ->
            runCatching {
                ThemeMode.valueOf(prefs[KEY_THEME_MODE] ?: ThemeMode.SYSTEM.name)
            }.getOrDefault(ThemeMode.SYSTEM)
        }

    /** Guarda el modo elegido por el usuario. */
    suspend fun setMode(mode: ThemeMode) {
        runCatching {
            context.mlProThemeDataStore.edit { prefs ->
                prefs[KEY_THEME_MODE] = mode.name
            }
        }
    }

    private companion object {
        val KEY_THEME_MODE = stringPreferencesKey("theme_mode")
    }
}
