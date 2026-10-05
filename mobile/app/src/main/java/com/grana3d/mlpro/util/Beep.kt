package com.grana3d.mlpro.util

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper

/**
 * Señal sonora del escáner: el operario escucha el resultado sin mirar la pantalla.
 *
 * - Éxito: dos tonos ascendentes (770 Hz y después 852 Hz).
 * - Error: un tono grave y largo.
 *
 * `ToneGenerator` reserva recursos del sistema, así que **siempre** se libera
 * (`release()`), tanto al terminar la secuencia como si falla la creación.
 * Si el equipo está en silencio o sin audio, no pasa nada: todo va envuelto en
 * `runCatching` y ninguna función propaga excepciones.
 */
object Beep {

    /** Duración de cada tono, en milisegundos. */
    private const val TONO_CORTO_MS = 110
    private const val TONO_MEDIO_MS = 160
    private const val TONO_LARGO_MS = 600

    /** Volumen relativo del tono (0..100). */
    private const val VOLUMEN = 95

    /** Silencio entre el fin de un tono y la liberación del recurso. */
    private const val COLA_MS = 80L

    fun success(context: Context) = emit(
        // Ascendente: 4 (770 Hz) -> 8 (852 Hz).
        firstTone = ToneGenerator.TONE_DTMF_4,
        firstDuration = TONO_CORTO_MS,
        secondTone = ToneGenerator.TONE_DTMF_8,
        secondDuration = TONO_MEDIO_MS,
    )

    fun error(context: Context) = emit(
        // Un solo tono grave y largo: se distingue del éxito incluso con ruido de depósito.
        firstTone = ToneGenerator.TONE_SUP_ERROR,
        firstDuration = TONO_LARGO_MS,
        secondTone = null,
        secondDuration = 0,
    )

    /** Confirmación breve (marcar empaquetado, guardar nota, etc.). */
    fun tick(context: Context) = emit(
        firstTone = ToneGenerator.TONE_PROP_BEEP,
        firstDuration = 60,
        secondTone = null,
        secondDuration = 0,
    )

    /**
     * Crea el [ToneGenerator] en `STREAM_MUSIC`, reproduce hasta dos tonos y libera
     * el recurso pase lo que pase. [context] no se usa hoy (el tono no necesita
     * contexto) pero se mantiene por contrato, para poder respetar el modo silencio
     * más adelante sin cambiar la firma.
     */
    @Suppress("UNUSED_PARAMETER")
    private fun emit(firstTone: Int, firstDuration: Int, secondTone: Int?, secondDuration: Int) {
        val generator = runCatching { ToneGenerator(AudioManager.STREAM_MUSIC, VOLUMEN) }.getOrNull()

        if (generator == null) {
            // Sin audio disponible: la vibración sigue avisando al operario.
            return
        }

        val handler = Handler(Looper.getMainLooper())
        val liberado = java.util.concurrent.atomic.AtomicBoolean(false)

        fun liberar() {
            if (liberado.compareAndSet(false, true)) {
                runCatching { generator.stopTone() }
                runCatching { generator.release() }
            }
        }

        val arrancado = runCatching { generator.startTone(firstTone, firstDuration) }
            .getOrDefault(false)

        if (!arrancado) {
            liberar()
            return
        }

        if (secondTone == null || secondDuration <= 0) {
            handler.postDelayed({ liberar() }, firstDuration.toLong() + COLA_MS)
            return
        }

        handler.postDelayed({
            val segundoOk = runCatching { generator.startTone(secondTone, secondDuration) }
                .getOrDefault(false)
            if (!segundoOk) {
                liberar()
                return@postDelayed
            }
            handler.postDelayed({ liberar() }, secondDuration.toLong() + COLA_MS)
        }, firstDuration.toLong() + 30L)
    }
}
