package com.grana3d.mlpro.util

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.grana3d.mlpro.MainActivity
import com.grana3d.mlpro.R
import com.grana3d.mlpro.core.formatArs
import com.grana3d.mlpro.domain.UpdateOrder
import com.grana3d.mlpro.domain.UpdateQuestion

/**
 * Notificaciones del sistema por ventas y preguntas nuevas.
 *
 * El polling vive en `HomeViewModel` (primer plano, sin FCM en esta fase): cada vez que
 * `GET /mobile/updates` trae ids no vistos, se muestra una notificación de alta prioridad
 * (ventas) o por defecto (preguntas). Tocar la notificación abre `MainActivity` con el
 * extra [EXTRA_OPEN_ROUTE] (`"terminal"` o `"questions"`).
 *
 * Nada lanza: sin permiso de notificaciones (API 33+) o sin canal, simplemente no se
 * muestra nada.
 */
object Notifications {

    /** Extra que `MainActivity` lee para abrir la ruta pedida. */
    const val EXTRA_OPEN_ROUTE: String = "open_route"

    /** Valores válidos de [EXTRA_OPEN_ROUTE]. */
    const val ROUTE_TERMINAL: String = "terminal"
    const val ROUTE_QUESTIONS: String = "questions"

    private const val CHANNEL_SALES: String = "mlpro_sales"
    private const val CHANNEL_QUESTIONS: String = "mlpro_questions"

    /** Crea los canales en API 26+; idempotente, seguro llamarlo en cada arranque. */
    fun ensureChannels(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java) ?: return
        runCatching {
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_SALES,
                    "Ventas",
                    NotificationManager.IMPORTANCE_HIGH,
                ).apply {
                    description = "Avisos de ventas nuevas cobradas"
                    enableVibration(true)
                },
            )
            manager.createNotificationChannel(
                NotificationChannel(
                    CHANNEL_QUESTIONS,
                    "Preguntas",
                    NotificationManager.IMPORTANCE_DEFAULT,
                ).apply {
                    description = "Preguntas nuevas de compradores"
                    enableVibration(true)
                },
            )
        }
    }

    /** Aviso de venta nueva: abre la Terminal al tocarlo. */
    fun showSale(context: Context, order: UpdateOrder) {
        ensureChannels(context)
        val importe = order.totalAmount?.toDouble()?.let { formatArs(it) } ?: ""
        val titulo = order.itemTitle?.takeIf { it.isNotBlank() } ?: "Nueva venta cobrada"
        val detalle = listOfNotNull(
            importe.takeIf { it.isNotBlank() },
            order.buyerNickname?.takeIf { it.isNotBlank() },
        ).joinToString(" · ").ifBlank { "Revisá la terminal para empaquetarla." }
        show(
            context = context,
            channelId = CHANNEL_SALES,
            notificationId = ("sale_" + order.id).hashCode(),
            title = "¡Nueva venta! $titulo",
            text = detalle,
            route = ROUTE_TERMINAL,
        )
    }

    /** Aviso de pregunta nueva: abre Preguntas al tocarlo. */
    fun showQuestion(context: Context, question: UpdateQuestion) {
        ensureChannels(context)
        val titulo = question.itemTitle?.takeIf { it.isNotBlank() } ?: "Nueva pregunta"
        val detalle = listOfNotNull(
            question.text?.takeIf { it.isNotBlank() },
            question.fromNickname?.takeIf { it.isNotBlank() },
        ).joinToString(" · ").ifBlank { "Un comprador necesita tu respuesta." }
        show(
            context = context,
            channelId = CHANNEL_QUESTIONS,
            notificationId = ("question_" + question.id).hashCode(),
            title = titulo,
            text = detalle,
            route = ROUTE_QUESTIONS,
        )
    }

    private fun show(
        context: Context,
        channelId: String,
        notificationId: Int,
        title: String,
        text: String,
        route: String,
    ) {
        if (!canNotify(context)) return
        val intent = Intent(context, MainActivity::class.java)
            .putExtra(EXTRA_OPEN_ROUTE, route)
            .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val pending = PendingIntent.getActivity(
            context,
            notificationId,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setPriority(
                if (channelId == CHANNEL_SALES) {
                    NotificationCompat.PRIORITY_HIGH
                } else {
                    NotificationCompat.PRIORITY_DEFAULT
                },
            )
            .build()
        runCatching {
            val manager = context.getSystemService(NotificationManager::class.java) ?: return
            manager.notify(notificationId, notification)
        }
    }

    /** En API 33+ hace falta `POST_NOTIFICATIONS`; abajo siempre se puede notificar. */
    private fun canNotify(context: Context): Boolean {
        if (Build.VERSION.SDK_INT < 33) return true
        return ContextCompat.checkSelfPermission(
            context,
            Manifest.permission.POST_NOTIFICATIONS,
        ) == PackageManager.PERMISSION_GRANTED
    }
}
