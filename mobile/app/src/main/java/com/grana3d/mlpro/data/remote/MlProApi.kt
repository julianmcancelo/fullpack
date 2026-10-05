package com.grana3d.mlpro.data.remote

import com.grana3d.mlpro.core.ApiResult
import com.grana3d.mlpro.core.Constants
import com.grana3d.mlpro.core.normalizeApiBase
import com.grana3d.mlpro.data.remote.dto.ApiErrorDto
import com.grana3d.mlpro.data.remote.dto.AnswerRequest
import com.grana3d.mlpro.data.remote.dto.AnswerResponse
import com.grana3d.mlpro.data.remote.dto.BootstrapResponse
import com.grana3d.mlpro.data.remote.dto.GitHubReleaseDto
import com.grana3d.mlpro.data.remote.dto.MeResponse
import com.grana3d.mlpro.data.remote.dto.MobileUpdatesDto
import com.grana3d.mlpro.data.remote.dto.PackingUpdateRequest
import com.grana3d.mlpro.data.remote.dto.PackingUpdateResponse
import com.grana3d.mlpro.data.remote.dto.PairClaimRequest
import com.grana3d.mlpro.data.remote.dto.PairClaimResponse
import com.grana3d.mlpro.data.remote.dto.QueueResponse
import com.grana3d.mlpro.data.remote.dto.QuestionsResponse
import com.grana3d.mlpro.data.remote.dto.ScanResponse
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.net.SocketTimeoutException
import java.net.URLEncoder
import java.net.UnknownHostException

/**
 * Cliente HTTP del backend de ML Pro Suite.
 *
 * Contrato de la clase: **ninguna** función lanza excepciones hacia arriba. Todo fallo
 * (red caída, timeout, HTTP 4xx/5xx, JSON inválido) se convierte en [ApiResult.Err] con
 * un mensaje en español pensado para el operario, no para el programador.
 *
 * El [client] y el [json] llegan por constructor (los arma `AppContainer`) para que
 * exista un único `OkHttpClient` en toda la app, cacheado, con timeouts de 20 s.
 */
class MlProApi(private val client: OkHttpClient, private val json: Json) {

    // -----------------------------------------------------------------------
    // Vinculación
    // -----------------------------------------------------------------------

    suspend fun claimPairing(apiBase: String, body: PairClaimRequest): ApiResult<PairClaimResponse> =
        post(
            url = route(apiBase, Constants.PATH_PAIR_CLAIM),
            token = null,
            body = json.encodeToString(PairClaimRequest.serializer(), body).toJsonBody(),
            map = { element -> json.decodeFromJsonElement(PairClaimResponse.serializer(), element) },
        )

    suspend fun me(apiBase: String, token: String): ApiResult<MeResponse> =
        get(
            url = route(apiBase, Constants.PATH_MOBILE_ME),
            token = token,
            map = { element -> json.decodeFromJsonElement(MeResponse.serializer(), element) },
        )

    // -----------------------------------------------------------------------
    // Operación
    // -----------------------------------------------------------------------

    suspend fun bootstrap(apiBase: String, token: String): ApiResult<BootstrapResponse> =
        get(
            url = route(apiBase, Constants.PATH_MOBILE_BOOTSTRAP),
            token = token,
            map = { element -> json.decodeFromJsonElement(BootstrapResponse.serializer(), element) },
        )

    suspend fun queue(
        apiBase: String,
        token: String,
        status: String = "all",
        includePacked: Boolean = true,
    ): ApiResult<QueueResponse> {
        val url = route(apiBase, Constants.PATH_MOBILE_QUEUE) +
            "?status=${encode(status)}&includePacked=${if (includePacked) "true" else "false"}&limit=100"
        return get(
            url = url,
            token = token,
            map = { element -> json.decodeFromJsonElement(QueueResponse.serializer(), element) },
        )
    }

    suspend fun scan(
        apiBase: String,
        token: String,
        rawCode: String,
        scanMode: String,
        carrierFilter: String,
        autoPack: Boolean,
    ): ApiResult<ScanResponse> {
        // `autoPack` lo elige el operario desde la Terminal: si está apagado, el escaneo
        // sólo identifica el paquete y el empaque se marca con el botón.
        val payload = buildJsonObject {
            put("rawCode", JsonPrimitive(rawCode))
            put("autoPack", JsonPrimitive(autoPack))
            put("scanMode", JsonPrimitive(scanMode))
            put("carrierFilter", JsonPrimitive(carrierFilter))
        }
        return post(
            url = route(apiBase, Constants.PATH_SHIPMENTS_SCAN),
            token = token,
            body = payload.toString().toJsonBody(),
            map = { element -> json.decodeFromJsonElement(ScanResponse.serializer(), element) },
        )
    }

    suspend fun updatePacking(
        apiBase: String,
        token: String,
        shipmentId: String,
        body: PackingUpdateRequest,
    ): ApiResult<PackingUpdateResponse> = send(
        // El backend monta esta ruta en /api/shipments/:id/packing y acepta PUT.
        method = HTTP_PUT,
        url = route(apiBase, "${Constants.PATH_SHIPMENTS_PACKING}/$shipmentId/packing"),
        token = token,
        body = json.encodeToString(PackingUpdateRequest.serializer(), body).toJsonBody(),
        map = { element -> json.decodeFromJsonElement(PackingUpdateResponse.serializer(), element) },
    )

    suspend fun unlink(apiBase: String, token: String): ApiResult<Unit> =
        post(
            url = route(apiBase, Constants.PATH_MOBILE_UNLINK),
            token = token,
            body = "\u007B\u007D".toJsonBody(),
            map = { Unit },
        )

    // -----------------------------------------------------------------------
    // Preguntas y novedades
    // -----------------------------------------------------------------------

    /**
     * Preguntas recibidas (`GET /questions?status=UNANSWERED`).
     * Se manda `X-Device-Token` como en el resto de las rutas de la app.
     */
    suspend fun listQuestions(
        apiBase: String,
        token: String,
        status: String = Constants.QUESTIONS_STATUS_UNANSWERED,
    ): ApiResult<QuestionsResponse> {
        val url = route(apiBase, Constants.PATH_QUESTIONS) + "?status=${encode(status)}"
        return get(
            url = url,
            token = token,
            map = { element -> json.decodeFromJsonElement(QuestionsResponse.serializer(), element) },
        )
    }

    /** Responde una pregunta (`POST /questions/{id}/answer` con `{text}`). */
    suspend fun answerQuestion(
        apiBase: String,
        token: String,
        questionId: String,
        text: String,
    ): ApiResult<AnswerResponse> {
        val payload = json.encodeToString(AnswerRequest.serializer(), AnswerRequest(text = text))
        return post(
            url = route(apiBase, "${Constants.PATH_QUESTIONS}/${encode(questionId)}/answer"),
            token = token,
            body = payload.toJsonBody(),
            map = { element -> json.decodeFromJsonElement(AnswerResponse.serializer(), element) },
        )
    }

    /**
     * Novedades desde el cursor (`GET /mobile/updates?since=ISO`).
     * Si [since] es null se pide sin cursor (el backend devuelve todo lo reciente y el
     * repositorio decide qué notificar).
     */
    suspend fun mobileUpdates(
        apiBase: String,
        token: String,
        since: String?,
    ): ApiResult<MobileUpdatesDto> {
        val base = route(apiBase, Constants.PATH_MOBILE_UPDATES)
        val url = if (since.isNullOrBlank()) base else "$base?since=${encode(since)}"
        return get(
            url = url,
            token = token,
            map = { element -> json.decodeFromJsonElement(MobileUpdatesDto.serializer(), element) },
        )
    }

    /**
     * Último GitHub Release publicado (`Ajustes → Buscar actualizaciones`).
     * El repo es público: no necesita token. GitHub exige `User-Agent`.
     */
    suspend fun checkLatestRelease(owner: String, repo: String): ApiResult<GitHubReleaseDto> =
        withContext(Dispatchers.IO) {
            try {
                val request = Request.Builder()
                    .url("https://api.github.com/repos/$owner/$repo/releases/latest")
                    .header("Accept", "application/vnd.github+json")
                    .header("User-Agent", USER_AGENT)
                    .get()
                    .build()
                client.newCall(request).execute().use { response ->
                    val raw = runCatching { response.body?.string() }.getOrNull().orEmpty()
                    if (response.code == 404) {
                        return@use ApiResult.Err(
                            message = "Todavía no hay versiones publicadas.",
                            code = "no_releases",
                            httpStatus = 404,
                        )
                    }
                    if (response.code == 403 || response.code == 429) {
                        return@use ApiResult.Err(
                            message = "GitHub limitó las consultas. Probá de nuevo en unos minutos.",
                            code = "rate_limited",
                            httpStatus = response.code,
                        )
                    }
                    if (response.code !in 200..299 || raw.isBlank()) {
                        return@use ApiResult.Err(
                            message = "No pudimos consultar las actualizaciones (HTTP ${response.code}).",
                            code = "http_${response.code}",
                            httpStatus = response.code,
                        )
                    }
                    val element = runCatching { json.parseToJsonElement(raw) }.getOrNull()
                        ?: return@use ApiResult.Err(Constants.MSG_BAD_RESPONSE, code = CODE_BAD_PAYLOAD)
                    runCatching {
                        ApiResult.Ok(json.decodeFromJsonElement(GitHubReleaseDto.serializer(), element))
                    }.getOrElse {
                        ApiResult.Err(Constants.MSG_BAD_RESPONSE, code = CODE_BAD_PAYLOAD)
                    }
                }
            } catch (e: SocketTimeoutException) {
                ApiResult.Err(Constants.MSG_TIMEOUT, code = CODE_TIMEOUT)
            } catch (e: UnknownHostException) {
                ApiResult.Err(Constants.MSG_NO_CONNECTION, code = CODE_NETWORK)
            } catch (e: IOException) {
                ApiResult.Err(Constants.MSG_NO_CONNECTION, code = CODE_NETWORK)
            } catch (e: Exception) {
                ApiResult.Err(Constants.MSG_BAD_RESPONSE, code = CODE_UNEXPECTED)
            }
        }

    /**
     * URL de descarga de la etiqueta. Se abre en un visor externo (Chrome, visor de PDF),
     * que **no** puede mandar headers, así que el token viaja como query
     * (`?deviceToken=...`): el backend lo acepta desde `extractToken`.
     */
    fun labelUrl(apiBase: String, token: String, shipmentId: String, format: String = "pdf"): String {
        val base = route(apiBase, "/mobile/label/$shipmentId")
        val formato = if (format.equals("zpl", ignoreCase = true)) "zpl" else "pdf"
        return "$base?format=$formato&deviceToken=${encode(token)}"
    }

    // -----------------------------------------------------------------------
    // Núcleo HTTP
    // -----------------------------------------------------------------------

    private suspend fun <T> get(url: String, token: String?, map: (JsonElement) -> T): ApiResult<T> =
        send(method = HTTP_GET, url = url, token = token, body = null, map = map)

    private suspend fun <T> post(url: String, token: String?, body: RequestBody?, map: (JsonElement) -> T): ApiResult<T> =
        send(method = HTTP_POST, url = url, token = token, body = body, map = map)

    /**
     * Ejecuta la petición en [Dispatchers.IO] y traduce **cualquier** desenlace a
     * [ApiResult]: nunca propaga excepciones.
     */
    private suspend fun <T> send(
        method: String,
        url: String,
        token: String?,
        body: RequestBody?,
        map: (JsonElement) -> T,
    ): ApiResult<T> = withContext(Dispatchers.IO) {
        try {
            val builder = Request.Builder()
                .url(url.trim())
                .header("Accept", "application/json")
                .header("User-Agent", USER_AGENT)

            token?.takeIf { it.isNotBlank() }?.let { builder.header(Constants.HEADER_DEVICE_TOKEN, it) }

            val request = if (body == null) {
                builder.get().build()
            } else {
                builder.method(method, body).build()
            }

            client.newCall(request).execute().use { response -> readResponse(response, token, map) }
        } catch (e: SocketTimeoutException) {
            ApiResult.Err(Constants.MSG_TIMEOUT, code = CODE_TIMEOUT)
        } catch (e: UnknownHostException) {
            ApiResult.Err(Constants.MSG_NO_CONNECTION, code = CODE_NETWORK)
        } catch (e: IOException) {
            ApiResult.Err(Constants.MSG_NO_CONNECTION, code = CODE_NETWORK)
        } catch (e: Exception) {
            ApiResult.Err(Constants.MSG_BAD_RESPONSE, code = CODE_UNEXPECTED)
        }
    }

    /** Interpreta la respuesta: 2xx parsea el cuerpo, el resto arma el error legible. */
    private fun <T> readResponse(response: Response, token: String?, map: (JsonElement) -> T): ApiResult<T> {
        val crudo = runCatching { response.body?.string() }.getOrNull().orEmpty()
        val status = response.code

        if (status !in 200..299) {
            val error = parseError(crudo)
            return ApiResult.Err(
                message = errorMessage(error, status, token),
                code = error?.error?.takeIf { it.isNotBlank() } ?: "http_$status",
                httpStatus = status,
            )
        }

        // Respuestas sin cuerpo (204, unlink): se mapea un objeto vacío.
        if (crudo.isBlank()) {
            return runCatching { ApiResult.Ok(map(JsonObject(emptyMap()))) }
                .getOrElse { ApiResult.Err(Constants.MSG_EMPTY_RESPONSE, code = CODE_EMPTY, httpStatus = status) }
        }

        val element = runCatching { json.parseToJsonElement(crudo) }.getOrNull()
            ?: return ApiResult.Err(Constants.MSG_BAD_RESPONSE, code = CODE_BAD_JSON, httpStatus = status)

        // Error lógico con HTTP 200: el backend responde `{success:false, error/ message}`.
        val exito = (element as? JsonObject)?.get("success")?.let { it as? JsonPrimitive }?.content
        if (exito != null && exito.equals("false", ignoreCase = true)) {
            val error = parseError(crudo)
            return ApiResult.Err(
                message = errorMessage(error, status, token),
                code = error?.error?.takeIf { it.isNotBlank() } ?: CODE_UNSUCCESSFUL,
                httpStatus = status,
            )
        }

        return runCatching { ApiResult.Ok(map(element)) }.getOrElse {
            ApiResult.Err(Constants.MSG_BAD_RESPONSE, code = CODE_BAD_PAYLOAD, httpStatus = status)
        }
    }

    /**
     * Lee el cuerpo `{error, message}` en sus dos formas reales del backend:
     * `{error:"expired_code", message:"El código QR venció…"}` y `{error:"detalle"}`.
     */
    private fun parseError(crudo: String): ApiErrorDto? {
        val texto = crudo.trim()
        if (texto.isEmpty()) return null

        return runCatching { json.decodeFromString(ApiErrorDto.serializer(), texto) }.getOrNull()
            ?: runCatching {
                val objeto = json.parseToJsonElement(texto).jsonObject
                ApiErrorDto(error = (objeto["error"] as? JsonPrimitive)?.content)
            }.getOrNull()
    }

    /** Traduce el error del backend a un mensaje accionable, en español. */
    private fun errorMessage(error: ApiErrorDto?, status: Int, token: String?): String {
        val codigo = error?.error?.trim().orEmpty()
        val mensajeServidor = error?.message?.trim().orEmpty()

        val porCodigo = when (codigo) {
            Constants.ERROR_DEVICE_NOT_LINKED -> if (token.isNullOrBlank()) {
                Constants.MSG_NO_SESSION
            } else {
                "El dispositivo dejó de estar vinculado. Volvé a escanear el QR desde la web."
            }

            Constants.ERROR_INVALID_CODE -> "El código QR no es válido."
            Constants.ERROR_ALREADY_CLAIMED -> Constants.MSG_QR_ALREADY_USED
            Constants.ERROR_EXPIRED_CODE -> Constants.MSG_QR_EXPIRED
            Constants.ERROR_ACCOUNT_NOT_ACTIVE -> "La cuenta todavía no está autorizada por administración."
            Constants.ERROR_USER_NOT_FOUND -> "El usuario de esta vinculación ya no existe."
            CODE_TIMEOUT -> Constants.MSG_TIMEOUT
            CODE_NETWORK -> Constants.MSG_NO_CONNECTION
            else -> null
        }
        if (porCodigo != null) return porCodigo
        if (mensajeServidor.isNotEmpty()) return mensajeServidor

        return when (status) {
            401 -> "La sesión del dispositivo venció. Volvé a vincular el celular."
            403 -> "La cuenta no está autorizada para operar desde el celular."
            404 -> "El servidor no encontró el recurso solicitado."
            in 500..599 -> "El servidor tuvo un problema. Reintentá en unos segundos."
            else -> "El servidor rechazó la operación (HTTP $status)."
        }
    }

    // -----------------------------------------------------------------------
    // Utilidades
    // -----------------------------------------------------------------------

    /** Une la base normalizada con la ruta, sin duplicar barras. */
    private fun route(apiBase: String, path: String): String {
        val base = normalizeApiBase(apiBase)
        val sufijo = if (path.startsWith("/")) path else "/$path"
        return base + sufijo
    }

    private fun String.toJsonBody(): RequestBody = toRequestBody(JSON_MEDIA_TYPE)

    private fun encode(value: String): String =
        runCatching { URLEncoder.encode(value, "UTF-8") }.getOrDefault(value)

    private companion object {
        const val HTTP_GET = "GET"
        const val HTTP_POST = "POST"
        const val HTTP_PUT = "PUT"

        /** Identificación ante la API de GitHub (obligatoria) y el backend. */
        const val USER_AGENT = "MLPro-Android"

        const val CODE_TIMEOUT = "timeout"
        const val CODE_NETWORK = "network"
        const val CODE_UNEXPECTED = "unexpected"
        const val CODE_EMPTY = "empty_response"
        const val CODE_BAD_JSON = "bad_json"
        const val CODE_BAD_PAYLOAD = "bad_payload"
        const val CODE_UNSUCCESSFUL = "unsuccessful"

        val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    }
}
