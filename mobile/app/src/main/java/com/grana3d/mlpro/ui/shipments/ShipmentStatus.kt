package com.grana3d.mlpro.ui.shipments

import com.grana3d.mlpro.ui.components.MlTone
import com.grana3d.mlpro.domain.Shipment

/**
 * Mapeo ÚNICO estado → etiqueta / tono para envíos (es-AR, tokens [MlTone]).
 *
 * Lo usan la Terminal (`TerminalQueueCard`), la lista de Envíos, el detalle del
 * paquete y el preview de cola del Home: el mismo `status` siempre muestra el
 * mismo texto en todas las pantallas.
 *
 * El badge "Manual" se muestra cuando el estado fue fijado a mano desde la web
 * (`manualStatus`, que el backend deriva del override local).
 */

/** Etiqueta legible del estado del envío (`ready_to_ship` → "Por despachar"). */
fun Shipment.statusLabel(): String = when (status) {
    "ready_to_ship" -> "Por despachar"
    "shipped" -> "En camino"
    "delivered" -> "Entregado"
    "cancelled" -> "Cancelado"
    else -> status?.takeIf { it.isNotBlank() } ?: "—"
}

/**
 * Tono del estado. `ready_to_ship` es advertencia hasta que el paquete queda
 * empaquetado (ahí pasa a éxito): el operario ve de un vistazo qué falta.
 */
fun Shipment.statusTone(): MlTone = when (status) {
    "ready_to_ship" -> if (packing?.packed == true) MlTone.Success else MlTone.Warning
    "shipped" -> MlTone.Info
    "delivered" -> MlTone.Success
    "cancelled" -> MlTone.Danger
    else -> MlTone.Neutral
}
