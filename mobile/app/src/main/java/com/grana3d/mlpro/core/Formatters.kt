package com.grana3d.mlpro.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.net.URLDecoder
import java.text.NumberFormat
import java.text.ParsePosition
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

/**
 * Formateo de importes, fechas y del QR de vinculación (es-AR).
 *
 * minSdk es 24 y el proyecto **no** usa desugaring, así que se evitan a propósito
 * `java.time.*`, `Locale.forLanguageTag` (API 21+ pero innecesario) y cualquier API 26+.
 * Todo se resuelve con `NumberFormat` / `SimpleDateFormat` y `Locale("es", "AR")`.
 *
 * Ninguna función lanza: ante entradas raras devuelve un texto seguro (`"—"`, `""`, `null`).
 */

private val LOCALE_AR: Locale = Locale("es", "AR")

// ---------------------------------------------------------------------------
// Números
// ---------------------------------------------------------------------------

/**
 * Formatea un importe en pesos: `formatArs(15000.0) == "$ 15.000"`.
 * Los centavos sólo aparecen cuando existen; los negativos van como `"$ -1.500"`.
 */
fun formatArs(amount: Double): String {
    if (amount.isNaN() || amount.isInfinite()) return "$ 0"

    val sinCentavos = Math.abs(amount - Math.floor(Math.abs(amount))) < 0.005
    val pattern = if (sinCentavos) "\u00A4 #,##0" else "\u00A4 #,##0.00"
    val formatter = newArFormatter(pattern)
    val numero = formatter.format(if (amount < 0) -amount else amount)
    return if (amount < 0) "$ -${numero.trim()}" else numero.trim()
}

/**
 * Formatea un importe de forma compacta para KPIs:
 * `formatArsCompact(15000.0) == "$ 15,0 k"`, `formatArsCompact(1_200_000.0) == "$ 1,2 M"`.
 */
fun formatArsCompact(amount: Double): String {
    if (amount.isNaN() || amount.isInfinite()) return "$ 0"
    val abs = Math.abs(amount)
    val signo = if (amount < 0) "-" else ""
    return when {
        abs >= 1_000_000_000.0 -> "$ ${signo}${oneDecimal(abs / 1_000_000_000.0)} MM"
        abs >= 1_000_000.0 -> "$ ${signo}${oneDecimal(abs / 1_000_000.0)} M"
        abs >= 1_000.0 -> "$ ${signo}${oneDecimal(abs / 1_000.0)} k"
        else -> formatArs(amount)
    }
}

/** Un decimal con coma, redondeado (12.34 -> "12,3"). */
private fun oneDecimal(value: Double): String {
    val formatter = NumberFormat.getNumberInstance(LOCALE_AR) ?: NumberFormat.getInstance()
    formatter.maximumFractionDigits = 1
    formatter.minimumFractionDigits = 1
    formatter.isGroupingUsed = false
    return formatter.format(Math.round(value * 10.0) / 10.0)
}

/**
 * Formato de moneda explícito: el `NumberFormat` de `es-AR` no siempre trae
 * símbolo/agrupación de moneda consistente en todos los fabricantes, así que el
 * patrón se fija a mano (con `¤` = símbolo local, que en es-AR es `$`).
 */
private fun newArFormatter(pattern: String): NumberFormat {
    val base = NumberFormat.getCurrencyInstance(LOCALE_AR) ?: NumberFormat.getInstance(LOCALE_AR)
    base.isGroupingUsed = true
    if (base is java.text.DecimalFormat) {
        runCatching { base.applyPattern(pattern) }
        runCatching { base.currency = java.util.Currency.getInstance("ARS") }
    }
    return base
}

// ---------------------------------------------------------------------------
// Fechas
// ---------------------------------------------------------------------------

/** Zona horaria del dispositivo (se cachea porque `TimeZone.getDefault()` no es barato). */
private val DEVICE_TIME_ZONE: TimeZone
    get() = TimeZone.getDefault() ?: TimeZone.getTimeZone("UTC")

/**
 * Formatea una fecha ISO del backend: `formatDateTime("2026-05-01T12:00:00.000Z")`
 * devuelve `"01 may · 14:35"` (en hora local). Devuelve `"—"` si no se puede parsear.
 */
fun formatDateTime(iso: String?): String {
    val date = parseIso(iso) ?: return "—"
    val day = newDateFormatter("dd MMM", DEVICE_TIME_ZONE).format(date)
    val time = newDateFormatter("HH:mm", DEVICE_TIME_ZONE).format(date)
    return "$day · $time"
}

/** Formatea sólo la hora local: `"14:35"`. */
fun formatTime(iso: String?): String {
    val date = parseIso(iso) ?: return "—"
    return newDateFormatter("HH:mm", DEVICE_TIME_ZONE).format(date)
}

/**
 * Diferencia legible contra ahora: `"hace 5 min"`, `"hace 2 h"`, `"hace 3 días"`.
 * Si la fecha es futura devuelve `"en 5 min"`; si es muy vieja, `"01 may · 14:35"`.
 */
fun formatRelative(iso: String?): String {
    val date = parseIso(iso) ?: return "—"
    val diffMs = System.currentTimeMillis() - date.time
    val futuro = diffMs < 0
    val abs = Math.abs(diffMs)

    if (abs < 60_000L) return if (futuro) "en unos segundos" else "hace unos segundos"

    val texto = when {
        abs < 3_600_000L -> {
            val minutos = Math.round(abs / 60_000.0)
            if (minutos <= 1L) "1 min" else "$minutos min"
        }

        abs < 86_400_000L -> {
            val horas = Math.round(abs / 3_600_000.0)
            if (horas <= 1L) "1 h" else "$horas h"
        }

        abs < 2_592_000_000L -> {
            val dias = Math.round(abs / 86_400_000.0)
            if (dias <= 1L) "1 día" else "$dias días"
        }

        else -> return formatDateTime(iso)
    }
    return if (futuro) "en $texto" else "hace $texto"
}

/** Antigüedad exacta para la cola de empaque: `"5 min"`, `"1 h 20 min"`, `"2 días"`. */
fun formatAge(iso: String?): String {
    val date = parseIso(iso) ?: return "—"
    val abs = Math.abs(System.currentTimeMillis() - date.time)
    if (abs < 60_000L) return "recién"
    val minutos = abs / 60_000L
    if (minutos < 60L) return "$minutos min"
    val horas = minutos / 60L
    if (horas < 24L) {
        val resto = minutos % 60L
        return if (resto == 0L) "$horas h" else "$horas h $resto min"
    }
    val dias = horas / 24L
    return if (dias == 1L) "1 día" else "$dias días"
}

/**
 * Parsea una fecha ISO-8601 del backend sin depender de `java.time`.
 * Acepta los milisegundos (`.000Z`) y las variantes con offset (`+00:00`).
 * Devuelve `null` si el texto es nulo, vacío o inválido.
 */
fun parseIsoDate(iso: String?): Date? = parseIso(iso)

private fun parseIso(iso: String?): Date? {
    val text = iso?.trim().orEmpty()
    if (text.isEmpty() || text == "null") return null

    val conOffset = Regex("([+-]\\d{2}):?(\\d{2})$").find(text)
    val normalizado = if (conOffset != null) {
        text.substring(0, conOffset.range.first) + conOffset.groupValues[1] + conOffset.groupValues[2]
    } else {
        text
    }

    val patrones = listOf(
        "yyyy-MM-dd'T'HH:mm:ss.SSSZ",
        "yyyy-MM-dd'T'HH:mm:ssZ",
        "yyyy-MM-dd'T'HH:mmZ",
        "yyyy-MM-dd HH:mm:ss.SSSZ",
        "yyyy-MM-dd HH:mm:ssZ",
        "yyyy-MM-dd HH:mmZ",
    )

    for (patron in patrones) {
        val formatter = newDateFormatter(patron, TimeZone.getTimeZone("UTC"))
        val position = ParsePosition(0)
        val parsed = runCatching { formatter.parse(normalizado, position) }.getOrNull()
        if (parsed != null && position.index >= normalizado.length) return parsed
    }

    // Último recurso: sólo fecha (sin hora), interpretada a medianoche UTC.
    return runCatching {
        SimpleDateFormat("yyyy-MM-dd", LOCALE_AR).apply {
            timeZone = TimeZone.getTimeZone("UTC")
            isLenient = true
        }.parse(text)
    }.getOrNull()
}

private fun newDateFormatter(pattern: String, zone: TimeZone): SimpleDateFormat =
    SimpleDateFormat(pattern, LOCALE_AR).apply {
        timeZone = zone
        isLenient = true
    }

// ---------------------------------------------------------------------------
// QR de vinculación
// ---------------------------------------------------------------------------

/** Contenido útil del QR de vinculación (nunca se guarda el `secret`). */
data class QrPayload(
    val code: String,
    val secret: String,
    val apiBase: String,
    val email: String?,
)

private val QR_JSON_LENIENT: Json = Json {
    ignoreUnknownKeys = true
    isLenient = true
    coerceInputValues = true
    explicitNulls = false
}

/**
 * Interpreta el contenido de un QR de vinculación. Acepta:
 *
 * 1. El JSON crudo: `{"v":1,"t":"mlpro-pair","c":"ABC123","s":"<hex>","a":"https://…/api","u":"email"}`.
 * 2. El mismo JSON envuelto en una URL: `mlpro://pair?d=<json urlencoded>`,
 *    `https://…/?pair=<json urlencoded>`, `?payload=` o `?qr=`.
 * 3. El texto a mano: `CODIGO:CLAVE` o `CODIGO CLAVE` (la URL base queda en el valor por defecto).
 *
 * Devuelve `null` si no es un QR de vinculación válido (tiene que ser `t == "mlpro-pair"`
 * y traer `c` y `s`).
 */
fun parseQrPayload(raw: String): QrPayload? {
    val text = raw.trim()
    if (text.isEmpty()) return null

    // (2) QR envuelto en URL, o (1) JSON crudo.
    val jsonText = extractQrJson(text) ?: text
    val payload = payloadFromJson(jsonText)
    if (payload != null) return payload

    // (3) Código a mano.
    return payloadFromManualText(text)
}

/**
 * Busca el JSON dentro de un texto que puede ser una URL de vinculación.
 * Devuelve `null` si el texto no trae un JSON reconocible.
 */
private fun extractQrJson(text: String): String? {
    val candidates = mutableListOf<String>()

    val marcadores = listOf("?d=", "&d=", "?pair=", "&pair=", "?payload=", "&payload=", "?qr=", "&qr=")
    for (marcador in marcadores) {
        val index = text.indexOf(marcador, ignoreCase = true)
        if (index >= 0) {
            val value = text.substring(index + marcador.length).substringBefore('&').substringBefore('#')
            candidates += value
            decodeUrlComponent(value)?.let { candidates += it }
        }
    }

    // Caso `mlpro://pair/<json>` o cualquier texto que contenga el JSON embebido.
    val inicio = text.indexOf('{')
    val fin = text.lastIndexOf('}')
    if (inicio >= 0 && fin > inicio) candidates += text.substring(inicio, fin + 1)

    for (candidate in candidates) {
        if (jsonObjectOrNull(candidate) != null) return candidate
    }
    return null
}

/** Convierte el JSON del QR en [QrPayload], validando tipo y campos obligatorios. */
private fun payloadFromJson(jsonText: String): QrPayload? {
    val obj = jsonObjectOrNull(jsonText) ?: return null

    val tipo = obj.stringOrNull("t")
    if (tipo != null && tipo != "mlpro-pair") return null

    val code = obj.stringOrNull("c")?.trim()?.uppercase(LOCALE_AR)
    val secret = obj.stringOrNull("s")?.trim()
    if (code.isNullOrEmpty() || secret.isNullOrEmpty()) return null

    val apiBase = obj.stringOrNull("a")?.trim()?.let { normalizeApiBase(it) }
        ?.takeIf { it.isNotEmpty() }
        ?: Constants.DEFAULT_API_BASE

    return QrPayload(
        code = code,
        secret = secret,
        apiBase = apiBase,
        email = obj.stringOrNull("u")?.trim()?.takeIf { it.isNotEmpty() },
    )
}

/** Interpreta `CODIGO:CLAVE` o `CODIGO CLAVE` (formato de carga manual). */
private fun payloadFromManualText(text: String): QrPayload? {
    if (text.contains('{') || text.contains("://")) return null

    val token = text.substringBefore('?').trim()
    val partes = when {
        token.contains(':') -> token.split(':', limit = 2)
        token.contains(' ') || token.contains('\t') -> token.split(Regex("\\s+"), limit = 2)
        else -> return null
    }
    if (partes.size < 2) return null

    val code = partes[0].trim().uppercase(LOCALE_AR)
    val secret = partes[1].trim().trimEnd(',', ';')
    if (code.isEmpty() || secret.isEmpty()) return null
    // El código del backend son 6 caracteres alfanuméricos; una clave nunca tiene espacios.
    if (code.length !in 4..20) return null
    if (secret.any { it.isWhitespace() }) return null

    return QrPayload(
        code = code,
        secret = secret,
        apiBase = Constants.DEFAULT_API_BASE,
        email = null,
    )
}

private fun jsonObjectOrNull(text: String): JsonObject? {
    val limpio = text.trim()
    if (!limpio.startsWith("{")) return null
    return runCatching { QR_JSON_LENIENT.parseToJsonElement(limpio) as? JsonObject }.getOrNull()
}

private fun JsonObject.stringOrNull(key: String): String? {
    val element = this[key] ?: return null
    val primitive = element as? JsonPrimitive ?: return null
    if (primitive.isString) return primitive.content
    val content = primitive.content
    return content.takeIf { it.isNotEmpty() && it != "null" }
}

/** Decodifica `%7B…%7D`; devuelve `null` si el texto no estaba codificado. */
private fun decodeUrlComponent(value: String): String? {
    if (!value.contains('%') && !value.contains('+')) return null
    return runCatching { URLDecoder.decode(value, "UTF-8") }.getOrNull()
}

/**
 * Normaliza la URL base del servidor: saca espacios y barras finales para que
 * concatenar rutas (`"$base/shipments/scan"`) nunca produzca `//`.
 */
fun normalizeApiBase(apiBase: String?): String {
    val limpio = (apiBase ?: "").trim().trimEnd('/')
    return if (limpio.isEmpty()) Constants.DEFAULT_API_BASE else limpio
}
