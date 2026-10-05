package com.grana3d.mlpro.util

import android.content.Context
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * Vibración háptica del operario: el resultado de un escaneo se tiene que sentir
 * sin mirar la pantalla.
 *
 * - Éxito: dos pulsos cortos y firmes.
 * - Error: un pulso largo (se nota aunque el celular esté en el bolsillo).
 * - Tick: un pulso mínimo para confirmaciones y navegación.
 *
 * Usa `VibratorManager` en API 31+ y `Vibrator` en el resto. La vibración se dispara
 * en el hilo principal (algunos fabricantes lo exigen) y nunca lanza excepción:
 * si el dispositivo no tiene vibrador, simplemente no hace nada.
 * El permiso `android.permission.VIBRATE` ya está declarado en el manifest.
 */

fun Context.vibrateSuccess() = vibrate(
    timings = longArrayOf(0L, 45L, 70L, 45L),
    amplitudes = intArrayOf(0, 170, 0, 255),
    fallbackMs = 50L,
)

fun Context.vibrateError() = vibrate(
    timings = longArrayOf(0L, 110L, 90L, 320L),
    amplitudes = intArrayOf(0, 255, 0, 255),
    fallbackMs = 320L,
)

fun Context.vibrateTick() = vibrate(
    timings = longArrayOf(0L, 18L),
    amplitudes = intArrayOf(0, 90),
    fallbackMs = 18L,
)

/**
 * Dispara la vibración con un patrón de ondas. Si el equipo no soporta amplitudes
 * (API < 26) o falla algo, cae a una vibración simple de [fallbackMs].
 */
private fun Context.vibrate(timings: LongArray, amplitudes: IntArray, fallbackMs: Long) {
    val vibrator = systemVibrator() ?: return
    if (!runCatching { vibrator.hasVibrator() }.getOrDefault(false)) return

    Handler(Looper.getMainLooper()).post {
        val conForma = runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(timings, amplitudes, -1))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(timings, -1)
            }
            true
        }.getOrDefault(false)

        if (conForma) return@post

        runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(fallbackMs, VibrationEffect.DEFAULT_AMPLITUDE))
            } else {
                @Suppress("DEPRECATION")
                vibrator.vibrate(fallbackMs)
            }
        }
    }
}

/** Obtiene el vibrador del sistema según la versión de Android. */
private fun Context.systemVibrator(): Vibrator? = runCatching {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        val manager = getSystemService(VibratorManager::class.java)
        manager?.defaultVibrator ?: legacyVibrator()
    } else {
        legacyVibrator()
    }
}.getOrNull()

@Suppress("DEPRECATION")
private fun Context.legacyVibrator(): Vibrator? =
    runCatching { getSystemService(Context.VIBRATOR_SERVICE) as? Vibrator }.getOrNull()
