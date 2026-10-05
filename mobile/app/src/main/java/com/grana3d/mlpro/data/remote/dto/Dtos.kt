package com.grana3d.mlpro.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull

/**
 * DTOs del backend de ML Pro Suite (rutas `/api/…`).
 *
 * ### Normalización de numéricos (decisión de diseño)
 * Mercado Libre es inconsistente: `order_id`, `total_amount`, `quantity` y, sobre todo,
 * `shipment.id` llegan **a veces como número y a veces como string** (los IDs de envío
 * superan el rango seguro de algunos serializadores y viajan citados). Si se declaran
 * `Long`/`Double`, `kotlinx.serialization` tira `SerializationException` y el operario
 * se queda sin poder escanear.
 *
 * Por eso esos campos se declaran `JsonElement?` y se normalizan **en el repositorio**
 * con los helpers de este archivo ([asStringOrNull], [asDoubleOrZero], [asIntOrZero],
 * [asBooleanOrFalse], [asIsoStringOrNull]). Ventajas:
 * - un solo lugar decide cómo tolerar el formato,
 * - los DTOs quedan sin serializadores custom,
 * - y ningún dato raro del backend puede hacer fallar el parseo de la respuesta entera.
 *
 * Los campos de texto "normales" (nombres, títulos, URLs) sí se declaran `String?`.
 * Todos los opcionales van con `= null` y valor por defecto.
 */

// ---------------------------------------------------------------------------
// Vinculación
// ---------------------------------------------------------------------------

@Serializable
data class PairClaimRequest(
    val code: String,
    val secret: String,
    val deviceName: String,
    val platform: String = "android",
    val appVersion: String = "",
    val deviceId: String? = null,
)

@Serializable
data class PairClaimResponse(
    val success: Boolean = false,
    val deviceToken: String? = null,
    val device: DeviceDto? = null,
    val user: UserDto? = null,
    val apiBase: String? = null,
    val serverTime: String? = null,
    val message: String? = null,
)

@Serializable
data class UserDto(
    val id: JsonElement? = null,
    val email: String? = null,
    val name: String? = null,
    val avatar: String? = null,
    val role: String? = null,
    val status: String? = null,
    val authProvider: String? = null,
    val createdAt: String? = null,
    val lastLoginAt: String? = null,
)

@Serializable
data class DeviceDto(
    val id: String? = null,
    val name: String? = null,
    val platform: String? = null,
    val appVersion: String? = null,
    val email: String? = null,
    val createdAt: String? = null,
    val lastSeenAt: String? = null,
)

@Serializable
data class ConnectionDto(
    val connected: Boolean = false,
    val nickname: String? = null,
    val userId: JsonElement? = null,
    val siteId: String? = null,
    val message: String? = null,
)

// ---------------------------------------------------------------------------
// Resumen y listas de apoyo
// ---------------------------------------------------------------------------

@Serializable
data class SummaryDto(
    val pendingShipmentsCount: Int = 0,
    val unpackedCount: Int = 0,
    val packedCount: Int = 0,
    val readyToShipCount: Int = 0,
    val inTransitShipmentsCount: Int = 0,
    val deliveredShipmentsCount: Int = 0,
    val paidOrdersCount: Int = 0,
    val totalOrdersCount: Int = 0,
    val totalSalesAmount: Double = 0.0,
    val totalItemsCount: Int = 0,
    val activeItemsCount: Int = 0,
    val pausedItemsCount: Int = 0,
    val lowStockCount: Int = 0,
    val outOfStockCount: Int = 0,
)

/** Checklist de empaque tal como lo devuelve el backend (mismas claves camelCase). */
@Serializable
data class PackingDto(
    val printed: Boolean = false,
    val packed: Boolean = false,
    val qualityChecked: Boolean = false,
    val dispatchChecked: Boolean = false,
    val note: String = "",
    val scanCount: Int = 0,
    val firstScannedAt: String? = null,
    val lastScannedAt: String? = null,
)

/** Envío ya "aplanado" por el backend para el celular (`GET /mobile/queue`, `bootstrap`). */
@Serializable
data class QueueItemDto(
    val id: String? = null,
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
    val quantity: JsonElement? = null,
    val totalAmount: JsonElement? = null,
    val orderDate: String? = null,
    val packing: PackingDto? = null,
)

@Serializable
data class LowStockDto(
    val id: JsonElement? = null,
    val title: String? = null,
    val thumbnail: String? = null,
    val sku: String? = null,
    val availableQuantity: JsonElement? = null,
    val price: JsonElement? = null,
    val status: String? = null,
)

/** Entrada del historial de escaneos. `details` es un objeto libre: se resume a texto. */
@Serializable
data class ScanLogDto(
    val id: String? = null,
    val barcode: String? = null,
    val shipmentId: String? = null,
    val action: String? = null,
    val details: JsonElement? = null,
    val createdAt: String? = null,
)

/** Bloque `errors` de `bootstrap`: una clave por fuente que falló, con su mensaje. */
@Serializable
data class BootstrapErrorsDto(
    val shipments: String? = null,
    val items: String? = null,
    val orders: String? = null,
)

@Serializable
data class BootstrapResponse(
    val success: Boolean = false,
    val serverTime: String? = null,
    val user: UserDto? = null,
    val device: DeviceDto? = null,
    val connection: ConnectionDto? = null,
    val summary: SummaryDto? = null,
    val queue: List<QueueItemDto> = emptyList(),
    val queueFull: List<QueueItemDto> = emptyList(),
    val lowStock: List<LowStockDto> = emptyList(),
    val recentLogs: List<ScanLogDto> = emptyList(),
    val errors: BootstrapErrorsDto? = null,
    /** `bootstrap` también devuelve `error` (string) cuando falla entero. */
    val error: String? = null,
)

@Serializable
data class QueueResponse(
    val success: Boolean = false,
    val total: Int = 0,
    val readyToShip: Int = 0,
    val packed: Int = 0,
    val shipped: Int = 0,
    val delivered: Int = 0,
    val queue: List<QueueItemDto> = emptyList(),
    val queueFull: List<QueueItemDto> = emptyList(),
    val all: List<QueueItemDto> = emptyList(),
    val serverTime: String? = null,
    val error: String? = null,
)

@Serializable
data class MeResponse(
    val success: Boolean = false,
    val user: UserDto? = null,
    val device: DeviceDto? = null,
    val connection: ConnectionDto? = null,
    val serverTime: String? = null,
)

// ---------------------------------------------------------------------------
// Envío crudo de Mercado Libre (respuesta de `/shipments/scan`)
// ---------------------------------------------------------------------------

@Serializable
data class RawShipmentDto(
    val id: JsonElement? = null,
    @SerialName("order_id") val orderId: JsonElement? = null,
    val status: String? = null,
    val substatus: String? = null,
    @SerialName("logistic_type") val logisticType: String? = null,
    @SerialName("tracking_number") val trackingNumber: String? = null,
    @SerialName("receiver_address") val receiverAddress: RawReceiverAddressDto? = null,
    val buyer: RawBuyerDto? = null,
    val items: List<RawOrderItemDto> = emptyList(),
    @SerialName("total_amount") val totalAmount: JsonElement? = null,
    @SerialName("order_date") val orderDate: String? = null,
    val packing: PackingDto? = null,
)

@Serializable
data class RawReceiverAddressDto(
    val city: RawCityDto? = null,
    val state: RawCityDto? = null,
    @SerialName("zip_code") val zipCode: String? = null,
)

@Serializable
data class RawCityDto(
    val id: String? = null,
    val name: String? = null,
)

@Serializable
data class RawBuyerDto(
    val id: JsonElement? = null,
    @SerialName("first_name") val firstName: String? = null,
    @SerialName("last_name") val lastName: String? = null,
    val nickname: String? = null,
)

@Serializable
data class RawOrderItemDto(
    val quantity: JsonElement? = null,
    val item: RawItemDto? = null,
)

@Serializable
data class RawItemDto(
    val id: String? = null,
    val title: String? = null,
    val thumbnail: String? = null,
    @SerialName("seller_sku") val sellerSku: String? = null,
)

/**
 * Respuesta de `POST /shipments/scan`. Cubre las cuatro variantes del contrato:
 * encontrado, ya empaquetado (mismo cuerpo + `alreadyPacked`), transportista incorrecto
 * (`carrierMismatch`) y no encontrado (`found = false`). En modo despacho agrega
 * `alreadyDispatchChecked`.
 */
@Serializable
data class ScanResponse(
    val success: Boolean = false,
    val found: Boolean = false,
    val scanMode: String? = null,
    val alreadyPacked: Boolean = false,
    val alreadyDispatchChecked: Boolean = false,
    val carrierMismatch: Boolean = false,
    /** Relectura del mismo paquete dentro de la ventana de deduplicación. */
    val duplicateRead: Boolean = false,
    /** El código coincide con más de un paquete. */
    val ambiguous: Boolean = false,
    /** Cantidad de paquetes que coincidieron cuando [ambiguous] es `true`. */
    val count: JsonElement? = null,
    /** Con qué campo del envío coincidió el código (`shipment_id`, `order_id`, `tracking`, `sku`). */
    val matchedBy: String? = null,
    val expectedCarrier: String? = null,
    val actualCarrier: String? = null,
    val scanCount: JsonElement? = null,
    val firstScannedAt: String? = null,
    val lastScannedAt: String? = null,
    val scannedCode: String? = null,
    val shipment: RawShipmentDto? = null,
    val message: String? = null,
    val error: String? = null,
)

// ---------------------------------------------------------------------------
// Actualización del checklist de empaque
// ---------------------------------------------------------------------------

/** `null` significa "no tocar este campo" (el backend sólo aplica lo que llega definido). */
@Serializable
data class PackingUpdateRequest(
    val printed: Boolean? = null,
    val packed: Boolean? = null,
    val qualityChecked: Boolean? = null,
    val dispatchChecked: Boolean? = null,
    val note: String? = null,
    val statusOverride: String? = null,
)

@Serializable
data class PackingUpdateResponse(
    val success: Boolean = false,
    val packing: PackingDto? = null,
    val error: String? = null,
)

/** Cuerpo estándar de error del backend: `{error, message}`. */
@Serializable
data class ApiErrorDto(
    val error: String? = null,
    val message: String? = null,
)

/** Release de GitHub (`GET repos/{owner}/{repo}/releases/latest`). */
@Serializable
data class GitHubReleaseDto(
    @SerialName("tag_name") val tagName: String? = null,
    @SerialName("html_url") val htmlUrl: String? = null,
    val body: String? = null,
    val assets: List<GitHubAssetDto> = emptyList(),
)

@Serializable
data class GitHubAssetDto(
    val name: String? = null,
    @SerialName("browser_download_url") val downloadUrl: String? = null,
)

// ---------------------------------------------------------------------------
// Helpers de normalización (usados por MobileRepository)
// ---------------------------------------------------------------------------

/** Texto del elemento: sirve tanto para IDs numéricos como para strings y decimales. */
internal fun JsonElement?.asStringOrNull(): String? {
    val element = this ?: return null
    if (element is JsonNull) return null
    val primitive = element as? JsonPrimitive ?: return null
    val texto = primitive.content
    return texto.takeIf { it.isNotEmpty() && it != "null" }
}

/** Número decimal tolerante: acepta `15000`, `"15000"`, `"15000.50"` y también comas. */
internal fun JsonElement?.asDoubleOrZero(): Double {
    val element = this ?: return 0.0
    if (element is JsonNull) return 0.0
    val primitive = element as? JsonPrimitive ?: return 0.0

    if (!primitive.isString) {
        return primitive.doubleOrNull
            ?: primitive.longOrNull?.toDouble()
            ?: 0.0
    }

    val texto = primitive.content.trim().replace(" ", "")
    if (texto.isEmpty()) return 0.0

    // "15.000,50" (formato es-AR) se interpreta en consecuencia; "15000.50" queda igual.
    val normalizado = if (texto.contains(',') && texto.contains('.')) {
        texto.replace(".", "").replace(',', '.')
    } else {
        texto.replace(',', '.')
    }

    return normalizado.toDoubleOrNull()
        ?: texto.replace(Regex("[^0-9-]"), "").toDoubleOrNull()
        ?: 0.0
}

/** Entero tolerante: trunca los decimales que a veces manda ML en `quantity`. */
internal fun JsonElement?.asIntOrZero(): Int {
    val valor = asDoubleOrZero()
    return when {
        valor.isNaN() || valor.isInfinite() -> 0
        valor > Int.MAX_VALUE.toDouble() -> Int.MAX_VALUE
        valor < Int.MIN_VALUE.toDouble() -> Int.MIN_VALUE
        else -> valor.toInt()
    }
}

/** Booleano tolerante: acepta `true`, `"true"`, `1`, `"1"`, `"si"`. */
internal fun JsonElement?.asBooleanOrFalse(): Boolean {
    val element = this ?: return false
    if (element is JsonNull) return false
    val primitive = element as? JsonPrimitive ?: return false

    primitive.booleanOrNull?.let { return it }

    return when (primitive.content.trim().lowercase()) {
        "true", "1", "yes", "si", "sí" -> true
        else -> false
    }
}

/** Fecha ISO de un `JsonElement` (para campos que pueden venir citados o nulos). */
internal fun JsonElement?.asIsoStringOrNull(): String? = asStringOrNull()

/** ID de un envío como texto, sin notación científica ni `.0` al final. */
internal fun JsonElement?.asIdStringOrNull(): String? {
    val element = this ?: return null
    if (element is JsonNull) return null
    val primitive = element as? JsonPrimitive ?: return null

    if (primitive.isString) return primitive.content.takeIf { it.isNotEmpty() }

    val largo = primitive.longOrNull
    if (largo != null) return largo.toString()

    val decimal = primitive.doubleOrNull
    if (decimal != null) {
        return if (decimal % 1.0 == 0.0) decimal.toLong().toString() else decimal.toString()
    }

    return primitive.content.takeIf { it.isNotEmpty() && it != "null" }
}

/** Resumen legible de un `details` libre, para el historial de escaneos. */
internal fun JsonElement?.asDetailsSummary(): String {
    val element = this ?: return ""
    if (element is JsonNull) return ""
    if (element is JsonPrimitive) return element.content

    return runCatching { element.toString() }
        .getOrDefault("")
        .take(220)
}

/** Atajo para `id` numérico de usuario (`connection.userId`). */
internal fun JsonElement?.asIntOrNull(): Int? {
    val texto = asStringOrNull() ?: return null
    return texto.toIntOrNull() ?: texto.toDoubleOrNull()?.toInt()
}
