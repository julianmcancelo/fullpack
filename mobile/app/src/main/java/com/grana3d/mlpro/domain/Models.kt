package com.grana3d.mlpro.domain

/**
 * Modelos de dominio que consume la UI.
 *
 * Reglas de esta capa:
 * - Nada de anotaciones de serialización: son objetos limpios.
 * - **Los campos opcionales son nullable a propósito.** Mercado Libre omite datos con
 *   frecuencia (tracking recién asignado, ciudad sin cargar, importes de órdenes con
 *   ítems no facturados) y el backend los manda como `null`. La UI ya está escrita
 *   contra esta forma (`shipment.city ?: ""`, `shipment.packing?.packed == true`),
 *   así que el repositorio **nunca** inventa valores: mapea `null` a `null`.
 * - Los numéricos que ML puede mandar como texto (`quantity`, `totalAmount` y los
 *   conteos del resumen) se exponen como [Number]: la UI los consume con
 *   `.toInt()` / `.toDouble()`, que toleran cualquier subtipo y el `null`.
 * - Ningún campo nulo obliga a la UI a mirar `JsonElement` ni strings crudos.
 */

// ---------------------------------------------------------------------------
// Cuenta y dispositivo
// ---------------------------------------------------------------------------

/** Cuenta de ML Pro Suite dueña de este dispositivo. */
data class LinkedAccount(
    val email: String,
    val name: String,
    val avatar: String? = null,
    val role: String = "user",
    val status: String = "active",
)

/** Celular vinculado (el que está usando el operario). */
data class LinkedDevice(
    val id: String,
    val name: String,
    val platform: String = "android",
    val appVersion: String = "",
    val createdAt: String? = null,
    val lastSeenAt: String? = null,
)

/** Estado de la conexión del backend con Mercado Libre (no la del celular con el backend). */
data class ConnectionState(
    val connected: Boolean = false,
    val nickname: String? = null,
    val userId: String? = null,
    val siteId: String? = null,
    val message: String? = null,
)

/**
 * Configuración del servidor: lo que se muestra y edita en Ajustes.
 * [apiBase] sale de `SessionStore`, así que sobrevive a los reinicios de la app.
 */
data class ServerConfig(
    val apiBase: String,
    val serverTime: String? = null,
    val appVersion: String = "1.0.0",
)

// ---------------------------------------------------------------------------
// Envíos
// ---------------------------------------------------------------------------

/**
 * Checklist de empaque de un envío. Es lo que la Terminal actualiza todo el tiempo.
 * Los booleanos no son nullable (la UI los compara con `== true`), pero [note] sí:
 * una nota puede no existir y la UI la lee con `packing?.note ?: ""`.
 */
data class PackingState(
    val printed: Boolean = false,
    val packed: Boolean = false,
    val qualityChecked: Boolean = false,
    val dispatchChecked: Boolean = false,
    val note: String? = null,
    val scanCount: Int = 0,
    val firstScannedAt: String? = null,
    val lastScannedAt: String? = null,
) {
    /** `true` cuando ya pasó por las dos validaciones de la Terminal. */
    val isComplete: Boolean get() = packed && dispatchChecked
}

/**
 * Envío listo para la Terminal: el `QueueItem` del backend ya mapeado.
 *
 * [id] nunca es `null` (los filtros y el detalle comparan `it.id == shipmentId`), pero
 * puede ser vacío si el backend no lo mandó. El resto de los campos de texto e importes
 * son nullable porque la UI los trata como tales; [packing] también puede faltar en un
 * envío que nunca se escaneó.
 */
data class Shipment(
    val id: String = "",
    val orderId: String? = null,
    val status: String? = null,
    val substatus: String? = null,
    val logisticType: String? = null,
    val logisticLabel: String? = null,
    val trackingNumber: String? = null,
    val buyerName: String? = null,
    val buyerNickname: String? = null,
    val city: String? = null,
    val state: String? = null,
    val zipCode: String? = null,
    val itemTitle: String? = null,
    val itemThumbnail: String? = null,
    val itemSku: String? = null,
    val quantity: Number? = null,
    val totalAmount: Number? = null,
    val orderDate: String? = null,
    val packing: PackingState? = null,
) {
    /** `ready_to_ship` y sin empaquetar: lo que el operario tiene que preparar. */
    val isPending: Boolean
        get() = status == "ready_to_ship" && packing?.packed != true

    /** Zona legible para las tarjetas: "CABA, Buenos Aires". */
    val location: String
        get() = listOfNotNull(city, state)
            .filter { it.isNotBlank() }
            .joinToString(", ")

    /** Cantidad de unidades ya normalizada, nunca menor a 1. */
    val units: Int
        get() = (quantity?.toInt() ?: 1).coerceAtLeast(1)

    /** Importe del envío ya normalizado a ARS. */
    val amount: Double
        get() = totalAmount?.toDouble() ?: 0.0
}

/** Ítem con stock crítico. */
data class LowStockItem(
    val id: String? = null,
    val title: String? = null,
    val thumbnail: String? = null,
    val sku: String? = null,
    val availableQuantity: Number? = null,
    val price: Number? = null,
    val status: String? = null,
) {
    val isOutOfStock: Boolean get() = (availableQuantity?.toInt() ?: 0) <= 0
}

/** Registro de auditoría de escaneos. */
data class ScanLogEntry(
    val id: String? = null,
    val barcode: String? = null,
    val shipmentId: String? = null,
    val action: String? = null,
    val details: String? = null,
    val createdAt: String? = null,
)

/**
 * Resumen que alimenta los KPIs del Home. Los conteos son [Number] porque el backend
 * los puede mandar como número o como string; la UI los convierte con `.toInt()`.
 */
data class MobileSummary(
    val pendingShipmentsCount: Number? = null,
    /** Envíos listos para despachar: empaquetados + sin empaquetar. */
    val readyToShipCount: Number? = null,
    val unpackedCount: Number? = null,
    val packedCount: Number? = null,
    val inTransitShipmentsCount: Number? = null,
    val deliveredShipmentsCount: Number? = null,
    val paidOrdersCount: Number? = null,
    val totalOrdersCount: Number? = null,
    val totalSalesAmount: Number? = null,
    val totalItemsCount: Number? = null,
    val activeItemsCount: Number? = null,
    val pausedItemsCount: Number? = null,
    val lowStockCount: Number? = null,
    val outOfStockCount: Number? = null,
)

// ---------------------------------------------------------------------------
// Escaneo
// ---------------------------------------------------------------------------

/** Modo de la Terminal. */
enum class ScanMode(val wire: String) {
    /** Empaque y preparación: el flujo normal del día. */
    PACK("pack"),

    /** Control de salida: se verifica que el paquete suba al transporte correcto. */
    DISPATCH("dispatch"),
    ;

    companion object {
        /** Convierte el valor que llega del backend; por defecto [PACK]. */
        fun fromWire(value: String?): ScanMode =
            entries.firstOrNull { it.wire == value?.trim()?.lowercase() } ?: PACK
    }
}

/**
 * Resultado de un escaneo. La UI decide color, sonido y vibración según la variante:
 * - [Found] verde (o ámbar si `alreadyPacked`).
 * - [CarrierMismatch] rojo.
 * - [NotFound] rojo.
 * - [Failure] error de red, de sesión o de lectura (no es un problema del paquete).
 *
 * En modo despacho exitoso se devuelve [Found] con el `packing` del envío ya actualizado
 * (`dispatchChecked = true`) y `alreadyPacked` reflejando `alreadyDispatchChecked`, para
 * que la UI muestre la tarjeta de despacho sin casos nuevos.
 */
sealed interface ScanOutcome {

    /** Paquete reconocido. */
    data class Found(
        val shipment: Shipment,
        val alreadyPacked: Boolean? = null,
        val scanCount: Number? = null,
        /** Campo del envío con el que coincidió el código (`shipment_id`, `order_id`…). */
        val matchedBy: String? = null,
        val message: String? = null,
    ) : ScanOutcome

    /**
     * El mismo paquete se volvió a leer hace instantes (una etiqueta trae QR *y* código
     * de barras): el backend no lo contó de nuevo y la UI lo avisa sin alarmar.
     */
    data class DuplicateRead(
        val shipment: Shipment? = null,
        val code: String? = null,
        val scanCount: Int = 0,
        val message: String? = null,
    ) : ScanOutcome

    /** El código coincide con más de un paquete: no se adivina cuál es. */
    data class Ambiguous(
        val code: String? = null,
        val matchedBy: String? = null,
        val count: Int = 0,
        val message: String? = null,
    ) : ScanOutcome

    /** El paquete pertenece a otro transportista: no se entrega. */
    data class CarrierMismatch(
        val expected: String? = null,
        val actual: String? = null,
        val shipment: Shipment? = null,
        val message: String? = null,
    ) : ScanOutcome

    /** El código no corresponde a ningún envío activo. */
    data class NotFound(val code: String? = null, val message: String? = null) : ScanOutcome

    /** Falla técnica (red, sesión, servidor) o código vacío. */
    data class Failure(val message: String? = null) : ScanOutcome
}
