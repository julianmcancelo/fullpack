package com.grana3d.mlpro.data.repository

import android.os.Build
import com.grana3d.mlpro.core.ApiResult
import com.grana3d.mlpro.core.Constants
import com.grana3d.mlpro.core.QrPayload
import com.grana3d.mlpro.core.normalizeApiBase
import com.grana3d.mlpro.data.local.SessionState
import com.grana3d.mlpro.data.local.SessionStore
import com.grana3d.mlpro.data.remote.MlProApi
import com.grana3d.mlpro.data.remote.dto.BootstrapResponse
import com.grana3d.mlpro.data.remote.dto.ConnectionDto
import com.grana3d.mlpro.data.remote.dto.DeviceDto
import com.grana3d.mlpro.data.remote.dto.LowStockDto
import com.grana3d.mlpro.data.remote.dto.PackingDto
import com.grana3d.mlpro.data.remote.dto.PackingUpdateRequest
import com.grana3d.mlpro.data.remote.dto.PairClaimRequest
import com.grana3d.mlpro.data.remote.dto.QueueItemDto
import com.grana3d.mlpro.data.remote.dto.QueueResponse
import com.grana3d.mlpro.data.remote.dto.RawOrderItemDto
import com.grana3d.mlpro.data.remote.dto.RawShipmentDto
import com.grana3d.mlpro.data.remote.dto.ScanLogDto
import com.grana3d.mlpro.data.remote.dto.ScanResponse
import com.grana3d.mlpro.data.remote.dto.SummaryDto
import com.grana3d.mlpro.data.remote.dto.UserDto
import com.grana3d.mlpro.data.remote.dto.asDetailsSummary
import com.grana3d.mlpro.data.remote.dto.asDoubleOrZero
import com.grana3d.mlpro.data.remote.dto.asIdStringOrNull
import com.grana3d.mlpro.data.remote.dto.asIntOrNull
import com.grana3d.mlpro.data.remote.dto.asIntOrZero
import com.grana3d.mlpro.data.remote.dto.asStringOrNull
import com.grana3d.mlpro.domain.ConnectionState
import com.grana3d.mlpro.domain.LinkedAccount
import com.grana3d.mlpro.domain.LinkedDevice
import com.grana3d.mlpro.domain.LowStockItem
import com.grana3d.mlpro.domain.MobileSummary
import com.grana3d.mlpro.domain.PackingState
import com.grana3d.mlpro.domain.ScanLogEntry
import com.grana3d.mlpro.domain.ScanMode
import com.grana3d.mlpro.domain.ScanOutcome
import com.grana3d.mlpro.domain.Shipment
import com.grana3d.mlpro.domain.UpdateCheck
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull

/**
 * Estado completo que la app necesita al abrir: una sola llamada a `/mobile/bootstrap`
 * y todo el Home, la Terminal y Ajustes quedan alimentados.
 */
data class MobileState(
    val account: LinkedAccount?,
    val device: LinkedDevice?,
    val connection: ConnectionState,
    val summary: MobileSummary,
    val queue: List<Shipment>,
    val lowStock: List<LowStockItem>,
    val recentLogs: List<ScanLogEntry>,
    val errors: List<String> = emptyList(),
    /** Hora del servidor (`serverTime` de `bootstrap`): indica cuán frescos están los datos. */
    val serverTime: String? = null,
)

/**
 * Única puerta de entrada de la UI a los datos.
 *
 * Responsabilidades:
 * - Pedirle al backend por [MlProApi] y traducir DTO → modelos de dominio.
 * - Resolver la sesión ([SessionStore]) y contestar [ApiResult.Err] con
 *   "Dispositivo no vinculado" cuando no hay token.
 * - Interpretar **todas** las variantes del escaneo y devolver el [ScanOutcome] correcto.
 *
 * Ninguna función lanza excepciones: si algo sale mal, la UI recibe un `Err` con texto
 * en español o un [ScanOutcome.Failure].
 */
class MobileRepository(
    private val api: MlProApi,
    private val session: SessionStore,
) {

    /** Estado de la vinculación, reactivo: la navegación se cuelga de acá. */
    val sessionState: Flow<SessionState> = session.state

    // -----------------------------------------------------------------------
    // Vinculación
    // -----------------------------------------------------------------------

    suspend fun claim(qr: QrPayload, deviceName: String, appVersion: String): ApiResult<LinkedAccount> {
        val apiBase = normalizeApiBase(qr.apiBase)
        val nombre = deviceName.trim().ifEmpty { defaultDeviceName() }

        val body = PairClaimRequest(
            code = qr.code,
            secret = qr.secret,
            deviceName = nombre,
            platform = Constants.PLATFORM,
            appVersion = appVersion.ifBlank { Constants.APP_VERSION },
            deviceId = null,
        )

        return when (val result = api.claimPairing(apiBase, body)) {
            is ApiResult.Ok -> {
                val response = result.value
                val token = response.deviceToken?.trim().orEmpty()
                if (token.isEmpty()) {
                    ApiResult.Err(
                        message = "El servidor no devolvió el token del dispositivo. Reintentá la vinculación.",
                        code = "missing_device_token",
                    )
                } else {
                    val user = response.user ?: UserDto(email = qr.email, name = qr.email)
                    val baseFinal = normalizeApiBase(response.apiBase ?: apiBase)
                    val deviceFinal = response.device?.name?.trim().orEmpty().ifEmpty { nombre }

                    // Se guarda la sesión sólo cuando hay token: el secret del QR se descarta.
                    session.saveLink(
                        deviceToken = token,
                        apiBase = baseFinal,
                        userJson = APP_JSON.encodeToString(UserDto.serializer(), user),
                        deviceName = deviceFinal,
                    )
                    ApiResult.Ok(mapAccount(user))
                }
            }

            is ApiResult.Err -> {
                invalidateIfUnlinked(result)
                result
            }
        }
    }

    // -----------------------------------------------------------------------
    // Lectura
    // -----------------------------------------------------------------------

    /** Todo lo que necesita la app al abrir, en una sola llamada. */
    suspend fun bootstrap(): ApiResult<MobileState> {
        val state = firstSession()
        val token = state.deviceToken
        if (token.isNullOrBlank()) return noSession()

        return when (val result = api.bootstrap(state.apiBase, token)) {
            is ApiResult.Ok -> {
                val response = result.value
                ApiResult.Ok(
                    MobileState(
                        account = response.user?.let { mapAccount(it) } ?: accountFromSession(state),
                        device = response.device?.let { mapDevice(it) } ?: deviceFromSession(state),
                        connection = mapConnection(response.connection),
                        summary = mapSummary(response.summary),
                        queue = mergeQueueLists(response).map { mapQueueItem(it) },
                        lowStock = response.lowStock.map { mapLowStock(it) },
                        recentLogs = response.recentLogs.map { mapScanLog(it) },
                        errors = collectErrors(response),
                        serverTime = response.serverTime?.takeIf { it.isNotBlank() },
                    ),
                )
            }

            is ApiResult.Err -> {
                invalidateIfUnlinked(result)
                result
            }
        }
    }

    /** Refresco liviano de la cola de empaque (la Terminal lo llama cada [Constants.POLL_INTERVAL_MS]).
     * Pide todo (`status=all&includePacked=true`): el backend nuevo devuelve también
     * empaquetados (`queueFull`/`all` + contadores) y el backend viejo ignora la query
     * y devuelve pendientes, así que en ambos casos funciona. */
    suspend fun refreshQueue(): ApiResult<List<Shipment>> {
        val state = firstSession()
        val token = state.deviceToken
        if (token.isNullOrBlank()) return noSession()

        return when (val result = api.queue(state.apiBase, token, status = "all", includePacked = true)) {
            is ApiResult.Ok -> ApiResult.Ok(mergeQueueLists(result.value).map { mapQueueItem(it) })
            is ApiResult.Err -> {
                invalidateIfUnlinked(result)
                result
            }
        }
    }

    /** Alias de [bootstrap] para que la Terminal refresque contadores sin tocar su loader. */
    suspend fun refreshSummary(): ApiResult<MobileState> = bootstrap()

    // -----------------------------------------------------------------------
    // Escaneo
    // -----------------------------------------------------------------------

    /**
     * Escanea un código y traduce la respuesta del backend a [ScanOutcome]:
     * encontrado, ya empaquetado, transportista incorrecto o no encontrado.
     */
    suspend fun scan(
        rawCode: String,
        scanMode: ScanMode = ScanMode.PACK,
        carrierFilter: String = Constants.CARRIER_FILTER_ALL,
        autoPack: Boolean = true,
    ): ApiResult<ScanOutcome> {
        val codigo = rawCode.trim()
        if (codigo.isEmpty()) {
            return ApiResult.Ok(ScanOutcome.Failure("No se leyó ningún código. Probá de nuevo."))
        }

        val state = firstSession()
        val token = state.deviceToken
        if (token.isNullOrBlank()) return noSession()

        val result = api.scan(
            apiBase = state.apiBase,
            token = token,
            rawCode = codigo,
            scanMode = scanMode.wire,
            carrierFilter = carrierFilter.ifBlank { Constants.CARRIER_FILTER_ALL },
            autoPack = autoPack,
        )

        return when (result) {
            is ApiResult.Ok -> ApiResult.Ok(mapScanResponse(result.value, codigo, scanMode))
            is ApiResult.Err -> {
                invalidateIfUnlinked(result)
                ApiResult.Ok(ScanOutcome.Failure(result.message))
            }
        }
    }

    // -----------------------------------------------------------------------
    // Escritura del checklist de empaque (siempre PUT /shipments/{id}/packing)
    // -----------------------------------------------------------------------

    suspend fun markPacked(shipmentId: String, packed: Boolean): ApiResult<PackingState> =
        updatePacking(shipmentId, PackingUpdateRequest(packed = packed))

    suspend fun markPrinted(shipmentId: String, printed: Boolean): ApiResult<PackingState> =
        updatePacking(shipmentId, PackingUpdateRequest(printed = printed))

    suspend fun markDispatchChecked(shipmentId: String, checked: Boolean): ApiResult<PackingState> =
        updatePacking(shipmentId, PackingUpdateRequest(dispatchChecked = checked))

    suspend fun saveNote(shipmentId: String, note: String): ApiResult<PackingState> =
        updatePacking(shipmentId, PackingUpdateRequest(note = note))

    /** Marca además la verificación de calidad (lo usa el flujo de empaque completo). */
    suspend fun markQualityChecked(shipmentId: String, checked: Boolean): ApiResult<PackingState> =
        updatePacking(shipmentId, PackingUpdateRequest(qualityChecked = checked))

    // -----------------------------------------------------------------------
    // Servidor y desvinculación
    // -----------------------------------------------------------------------

    suspend fun setApiBase(apiBase: String) {
        session.setApiBase(apiBase)
    }

    /** Desvincula el dispositivo en el backend y borra la sesión local, pase lo que pase. */
    suspend fun unlink(): ApiResult<Unit> {
        val state = firstSession()
        val token = state.deviceToken
        if (token.isNullOrBlank()) {
            session.clear()
            return noSession()
        }

        val result = api.unlink(state.apiBase, token)
        // Aunque el backend falle, el celular se desvincula localmente: es lo que pidió el usuario.
        session.clear()
        return result
    }

    /**
     * Busca actualizaciones en los GitHub Releases públicos.
     * Compara el `versionCode` del tag (`v1.1.0+2`) con el instalado.
     * Nunca lanza: sin red o sin releases devuelve [UpdateCheck.Unavailable].
     */
    suspend fun checkForUpdates(): UpdateCheck {
        val current = Constants.APP_VERSION_CODE
        return when (
            val result = api.checkLatestRelease(Constants.GITHUB_OWNER, Constants.GITHUB_REPO)
        ) {
            is ApiResult.Err -> UpdateCheck.Unavailable(result.message)
            is ApiResult.Ok -> {
                val release = result.value
                val tag = release.tagName?.trim().orEmpty()
                val remoteCode = tag.substringAfterLast('+', "").toIntOrNull()
                val remoteName = tag.removePrefix("v").substringBefore('+').ifBlank { tag }
                val apkUrl = release.assets
                    .firstOrNull { it.downloadUrl?.endsWith(".apk", ignoreCase = true) == true }
                    ?.downloadUrl
                    ?: release.htmlUrl
                if (apkUrl.isNullOrBlank()) {
                    UpdateCheck.Unavailable("La versión publicada no trae APK para descargar.")
                } else if (remoteCode != null) {
                    if (remoteCode > current) {
                        UpdateCheck.Available(remoteName, remoteCode, release.body, apkUrl)
                    } else {
                        UpdateCheck.UpToDate
                    }
                } else if (remoteName.isNotBlank() && remoteName != Constants.APP_VERSION &&
                    remoteName != "v${Constants.APP_VERSION}"
                ) {
                    // Tag viejo sin código: se ofrece igual para no bloquear una mejora.
                    UpdateCheck.Available(remoteName, current, release.body, apkUrl)
                } else {
                    UpdateCheck.UpToDate
                }
            }
        }
    }

    /** URL de la etiqueta para abrir en un visor externo, o `null` si no hay sesión. */
    fun labelUrl(shipmentId: String, format: String = "pdf"): String? {
        val state = currentSession() ?: return null
        val token = state.deviceToken?.takeIf { it.isNotBlank() } ?: return null
        if (shipmentId.isBlank()) return null
        return api.labelUrl(state.apiBase, token, shipmentId, format)
    }

    // -----------------------------------------------------------------------
    // Internos: sesión
    // -----------------------------------------------------------------------

    private suspend fun firstSession(): SessionState = session.state.first()

    /**
     * Si el backend rechazó el token (por ejemplo, el dispositivo se desvinculó desde la
     * web), la sesión local ya no sirve: se limpia para que la app vuelva sola a la
     * pantalla de vinculación en lugar de llenarse de errores.
     */
    private suspend fun invalidateIfUnlinked(result: ApiResult.Err) {
        val desvinculado =
            result.code == Constants.ERROR_DEVICE_NOT_LINKED || result.httpStatus == 401
        if (desvinculado) {
            runCatching { session.clear() }
        }
    }

    /**
     * Lectura sincrónica del estado de sesión: la UI necesita la URL en el acto para
     * abrir un Intent. Es una única suspensión sobre un DataStore cacheado en memoria,
     * así que no bloquea de forma perceptible.
     */
    private fun currentSession(): SessionState? =
        runCatching { runBlocking { session.state.first() } }.getOrNull()

    /** Error uniforme cuando todavía no hay dispositivo vinculado. */
    private fun <T> noSession(): ApiResult<T> =
        ApiResult.Err(Constants.MSG_NO_SESSION, code = Constants.ERROR_DEVICE_NOT_LINKED)

    private suspend fun updatePacking(
        shipmentId: String,
        body: PackingUpdateRequest,
    ): ApiResult<PackingState> {
        if (shipmentId.isBlank()) {
            return ApiResult.Err("No se indicó qué envío actualizar.", code = "missing_shipment_id")
        }

        val state = firstSession()
        val token = state.deviceToken
        if (token.isNullOrBlank()) return noSession()

        return when (val result = api.updatePacking(state.apiBase, token, shipmentId, body)) {
            is ApiResult.Ok -> mapPacking(result.value.packing)
                ?.let { ApiResult.Ok(it) }
                ?: ApiResult.Err(
                    message = "El servidor no confirmó el cambio de empaque. Reintentá.",
                    code = "missing_packing",
                )

            is ApiResult.Err -> {
                invalidateIfUnlinked(result)
                result
            }
        }
    }

    private fun defaultDeviceName(): String {
        val fabricante = runCatching { Build.MANUFACTURER }.getOrNull().orEmpty()
        val modelo = runCatching { Build.MODEL }.getOrNull().orEmpty()
        val nombre = "$fabricante $modelo".trim()
        return nombre.ifEmpty { "Celular Android" }
    }

    // -----------------------------------------------------------------------
    // Internos: mapeo DTO → dominio
    // -----------------------------------------------------------------------

    private fun mapScanResponse(response: ScanResponse, scannedCode: String, mode: ScanMode): ScanOutcome {
        val shipment = response.shipment?.let { mapRawShipment(it) }
        val notFound = {
            ScanOutcome.NotFound(
                code = response.scannedCode?.takeIf { it.isNotBlank() } ?: scannedCode,
                message = notFoundMessage(response.message, response.scannedCode ?: scannedCode),
            )
        }
        val enModoDespacho = ScanMode.fromWire(response.scanMode) == ScanMode.DISPATCH || mode == ScanMode.DISPATCH

        return when {
            // El mismo paquete se volvió a leer hace instantes: no se contó de nuevo.
            response.duplicateRead -> ScanOutcome.DuplicateRead(
                shipment = shipment,
                code = response.scannedCode?.takeIf { it.isNotBlank() } ?: scannedCode,
                scanCount = response.scanCount?.let { jsonElementToInt(it) } ?: 0,
                message = response.message?.takeIf { it.isNotBlank() }
                    ?: "Este paquete ya se escaneó hace instantes. No se volvió a contar.",
            )

            // El código apunta a más de un paquete: no adivinamos.
            response.ambiguous -> ScanOutcome.Ambiguous(
                code = response.scannedCode?.takeIf { it.isNotBlank() } ?: scannedCode,
                matchedBy = response.matchedBy,
                count = response.count?.let { jsonElementToInt(it) } ?: 0,
                message = response.message?.takeIf { it.isNotBlank() },
            )

            // El paquete pertenece a otro transportista: nunca se entrega.
            response.carrierMismatch -> ScanOutcome.CarrierMismatch(
                expected = response.expectedCarrier,
                actual = response.actualCarrier,
                shipment = shipment,
                message = response.message?.takeIf { it.isNotBlank() }
                    ?: "El paquete pertenece a otro transportista. No lo entregues.",
            )

            // Modo despacho: se devuelve `Found` con el packing ya actualizado; la UI no
            // tiene un caso aparte, así que `alreadyPacked` refleja `alreadyDispatchChecked`.
            response.found && enModoDespacho -> if (shipment == null) {
                notFound()
            } else {
                val yaVerificado = response.alreadyDispatchChecked
                ScanOutcome.Found(
                    shipment = shipment,
                    alreadyPacked = yaVerificado,
                    scanCount = resolveScanCount(response, shipment),
                    matchedBy = response.matchedBy,
                    message = response.message?.takeIf { it.isNotBlank() } ?: if (yaVerificado) {
                        "El paquete #${shipment.id} ya estaba verificado para despacho."
                    } else {
                        "Paquete #${shipment.id} verificado para salida a transporte."
                    },
                )
            }

            // Empaque: encontrado (y posiblemente ya empaquetado).
            response.found && shipment != null -> {
                val yaEmpaquetado = response.alreadyPacked
                ScanOutcome.Found(
                    shipment = shipment,
                    alreadyPacked = yaEmpaquetado,
                    scanCount = resolveScanCount(response, shipment),
                    matchedBy = response.matchedBy,
                    message = response.message?.takeIf { it.isNotBlank() } ?: if (yaEmpaquetado) {
                        "El paquete #${shipment.id} ya estaba empaquetado."
                    } else {
                        "Paquete #${shipment.id} empaquetado y verificado."
                    },
                )
            }

            // El backend dijo "encontrado" pero no mandó el envío: se trata como no hallado.
            else -> notFound()
        }
    }

    /** Convierte un `JsonElement` numérico (o numérico en texto) a `Int`. */
    private fun jsonElementToInt(element: JsonElement): Int =
        element.asIntOrZero()

    /** El conteo puede venir en la raíz de la respuesta o dentro del `packing`. */
    private fun resolveScanCount(response: ScanResponse, shipment: Shipment): Number? {
        val raiz = response.scanCount
        if (raiz != null) {
            val valor = raiz.asIntOrZero()
            if (valor > 0) return valor
        }
        return shipment.packing?.scanCount ?: 0
    }

    private fun notFoundMessage(message: String?, scannedCode: String): String =
        message?.takeIf { it.isNotBlank() }
            ?: "El código \"$scannedCode\" no corresponde a ningún envío activo pendiente."

    /**
     * Envío "aplanado" del backend (`/mobile/queue`, `bootstrap`).
     * Los campos opcionales se preservan como `null`: la UI decide qué mostrar.
     */
    private fun mapQueueItem(dto: QueueItemDto): Shipment = Shipment(
        id = dto.id.orEmpty(),
        orderId = dto.orderId?.takeIf { it.isNotBlank() },
        status = dto.status?.takeIf { it.isNotBlank() },
        substatus = dto.substatus?.takeIf { it.isNotBlank() },
        logisticType = dto.logisticType?.takeIf { it.isNotBlank() } ?: DEFAULT_LOGISTIC_TYPE,
        logisticLabel = dto.logisticLabel?.takeIf { it.isNotBlank() } ?: "CORREO",
        trackingNumber = dto.trackingNumber?.takeIf { it.isNotBlank() },
        buyerName = dto.buyerName?.takeIf { it.isNotBlank() } ?: "Comprador",
        buyerNickname = dto.buyerNickname?.takeIf { it.isNotBlank() },
        city = dto.city?.takeIf { it.isNotBlank() },
        state = dto.state?.takeIf { it.isNotBlank() },
        zipCode = dto.zipCode?.takeIf { it.isNotBlank() },
        itemTitle = dto.itemTitle?.takeIf { it.isNotBlank() } ?: "Producto de Mercado Libre",
        itemThumbnail = dto.itemThumbnail?.takeIf { it.isNotBlank() },
        itemSku = dto.itemSku?.takeIf { it.isNotBlank() },
        quantity = dto.quantity?.let { if (it is JsonNull) null else it.asIntOrZero().coerceAtLeast(1) },
        totalAmount = dto.totalAmount?.let { if (it is JsonNull) null else it.asDoubleOrZero() },
        orderDate = dto.orderDate?.takeIf { it.isNotBlank() },
        packing = mapPacking(dto.packing),
    )

    /**
     * Envío crudo de Mercado Libre (respuesta de `/shipments/scan`).
     * El nombre del comprador se rearma igual que en el backend; la ciudad y la provincia
     * viven anidadas en `receiver_address`.
     */
    private fun mapRawShipment(dto: RawShipmentDto): Shipment {
        val primerItem: RawOrderItemDto? = dto.items.firstOrNull()
        val item = primerItem?.item

        val nombreComprador = listOfNotNull(
            dto.buyer?.firstName?.takeIf { it.isNotBlank() },
            dto.buyer?.lastName?.takeIf { it.isNotBlank() },
        ).joinToString(" ").trim().ifBlank { dto.buyer?.nickname.orEmpty() }

        val logisticType = dto.logisticType?.takeIf { it.isNotBlank() } ?: DEFAULT_LOGISTIC_TYPE
        val cantidad = primerItem?.quantity?.let { if (it is JsonNull) null else it.asIntOrZero() }

        return Shipment(
            id = dto.id.asIdStringOrNull().orEmpty(),
            orderId = dto.orderId.asIdStringOrNull()?.takeIf { it.isNotBlank() },
            status = dto.status?.takeIf { it.isNotBlank() },
            substatus = dto.substatus?.takeIf { it.isNotBlank() },
            logisticType = logisticType,
            logisticLabel = logisticLabelFor(logisticType),
            trackingNumber = dto.trackingNumber?.takeIf { it.isNotBlank() },
            buyerName = nombreComprador.ifBlank { "Comprador" },
            buyerNickname = dto.buyer?.nickname?.takeIf { it.isNotBlank() },
            city = dto.receiverAddress?.city?.name?.takeIf { it.isNotBlank() },
            state = dto.receiverAddress?.state?.name?.takeIf { it.isNotBlank() },
            zipCode = dto.receiverAddress?.zipCode?.takeIf { it.isNotBlank() },
            itemTitle = item?.title?.takeIf { it.isNotBlank() } ?: "Producto de Mercado Libre",
            itemThumbnail = item?.thumbnail?.takeIf { it.isNotBlank() },
            itemSku = item?.sellerSku?.takeIf { it.isNotBlank() },
            quantity = cantidad?.coerceAtLeast(1),
            totalAmount = dto.totalAmount?.let { if (it is JsonNull) null else it.asDoubleOrZero() },
            orderDate = dto.orderDate?.takeIf { it.isNotBlank() },
            packing = mapPacking(dto.packing),
        )
    }

    /** `null` en la entrada significa "el envío nunca pasó por la Terminal": se preserva. */
    private fun mapPacking(dto: PackingDto?): PackingState? {
        if (dto == null) return null
        return PackingState(
            printed = dto.printed,
            packed = dto.packed,
            qualityChecked = dto.qualityChecked,
            dispatchChecked = dto.dispatchChecked,
            note = dto.note.takeIf { it.isNotBlank() },
            scanCount = dto.scanCount,
            firstScannedAt = dto.firstScannedAt?.takeIf { it.isNotBlank() },
            lastScannedAt = dto.lastScannedAt?.takeIf { it.isNotBlank() },
        )
    }

    private fun mapSummary(dto: SummaryDto?): MobileSummary {
        if (dto == null) return MobileSummary()
        return MobileSummary(
            pendingShipmentsCount = dto.pendingShipmentsCount,
            readyToShipCount = dto.readyToShipCount,
            unpackedCount = dto.unpackedCount,
            packedCount = dto.packedCount,
            inTransitShipmentsCount = dto.inTransitShipmentsCount,
            deliveredShipmentsCount = dto.deliveredShipmentsCount,
            paidOrdersCount = dto.paidOrdersCount,
            totalOrdersCount = dto.totalOrdersCount,
            totalSalesAmount = dto.totalSalesAmount,
            totalItemsCount = dto.totalItemsCount,
            activeItemsCount = dto.activeItemsCount,
            pausedItemsCount = dto.pausedItemsCount,
            lowStockCount = dto.lowStockCount,
            outOfStockCount = dto.outOfStockCount,
        )
    }

    private fun mapLowStock(dto: LowStockDto): LowStockItem = LowStockItem(
        id = dto.id.asIdStringOrNull()?.takeIf { it.isNotBlank() },
        title = dto.title?.takeIf { it.isNotBlank() } ?: "Publicación",
        thumbnail = dto.thumbnail?.takeIf { it.isNotBlank() },
        sku = dto.sku?.takeIf { it.isNotBlank() },
        availableQuantity = dto.availableQuantity?.let { if (it is JsonNull) null else it.asIntOrZero() },
        price = dto.price?.let { if (it is JsonNull) null else it.asDoubleOrZero() },
        status = dto.status?.takeIf { it.isNotBlank() },
    )

    private fun mapScanLog(dto: ScanLogDto): ScanLogEntry = ScanLogEntry(
        id = dto.id.orEmpty(),
        barcode = dto.barcode.orEmpty(),
        shipmentId = dto.shipmentId?.takeIf { it.isNotBlank() },
        action = dto.action?.takeIf { it.isNotBlank() },
        details = dto.details.asDetailsSummary().takeIf { it.isNotBlank() },
        createdAt = dto.createdAt?.takeIf { it.isNotBlank() },
    )

    private fun mapAccount(dto: UserDto): LinkedAccount = LinkedAccount(
        email = dto.email.orEmpty(),
        name = dto.name.orEmpty().ifBlank { dto.email.orEmpty() }.ifBlank { "Operario" },
        avatar = dto.avatar?.takeIf { it.isNotBlank() },
        role = dto.role.orEmpty().ifBlank { "user" },
        status = dto.status.orEmpty().ifBlank { "active" },
    )

    private fun mapDevice(dto: DeviceDto): LinkedDevice = LinkedDevice(
        id = dto.id.orEmpty(),
        name = dto.name.orEmpty().ifBlank { "Celular Android" },
        platform = dto.platform.orEmpty().ifBlank { Constants.PLATFORM },
        appVersion = dto.appVersion.orEmpty(),
        createdAt = dto.createdAt,
        lastSeenAt = dto.lastSeenAt,
    )

    private fun mapConnection(dto: ConnectionDto?): ConnectionState {
        if (dto == null) {
            return ConnectionState(connected = false, message = "Sin datos de conexión con Mercado Libre.")
        }
        val userId = dto.userId.asIntOrNull()?.toString() ?: dto.userId.asStringOrNull()
        return ConnectionState(
            connected = dto.connected,
            nickname = dto.nickname?.takeIf { it.isNotBlank() },
            userId = userId?.takeIf { it.isNotBlank() },
            siteId = dto.siteId?.takeIf { it.isNotBlank() },
            message = dto.message?.takeIf { it.isNotBlank() },
        )
    }

    /** Reconstruye la cuenta desde lo persistido cuando `bootstrap` no manda `user`. */
    private fun accountFromSession(state: SessionState): LinkedAccount? {
        val email = state.userEmail ?: return null
        return LinkedAccount(
            email = email,
            name = state.userName.orEmpty().ifBlank { email },
            avatar = state.userAvatar,
        )
    }

    /** Reconstruye el dispositivo desde lo persistido cuando `bootstrap` no manda `device`. */
    private fun deviceFromSession(state: SessionState): LinkedDevice? {
        val nombre = state.deviceName ?: return null
        return LinkedDevice(
            id = "",
            name = nombre,
            platform = Constants.PLATFORM,
        )
    }

    /**
     * Lista completa de envíos: prefiere `queueFull`/`all` cuando el backend nuevo los
     * manda, y cae a `queue` con el backend viejo. Deduplica por `id` sin reordenar.
     */
    private fun mergeQueueLists(response: QueueResponse): List<QueueItemDto> {
        val completa = when {
            response.queueFull.isNotEmpty() -> response.queueFull + response.all + response.queue
            response.all.isNotEmpty() -> response.all + response.queue
            else -> response.queue
        }
        return completa.distinctBy { it.id.orEmpty() + "|" + it.orderId.orEmpty() }
    }

    private fun mergeQueueLists(response: BootstrapResponse): List<QueueItemDto> {
        val completa = if (response.queueFull.isNotEmpty()) {
            response.queueFull + response.queue
        } else {
            response.queue
        }
        return completa.distinctBy { it.id.orEmpty() + "|" + it.orderId.orEmpty() }
    }

    /**
     * `errors` puede venir como objeto (`{shipments, items, orders}`) o como lista de textos.
     * En los dos casos se aplana a una lista de mensajes para el banner de la UI.
     */
    private fun collectErrors(response: BootstrapResponse): List<String> {
        val errores = mutableListOf<String>()

        response.error?.takeIf { it.isNotBlank() }?.let { errores += it }

        val detalle = response.errors
        if (detalle != null) {
            detalle.shipments?.takeIf { it.isNotBlank() }?.let { errores += "Envíos: $it" }
            detalle.items?.takeIf { it.isNotBlank() }?.let { errores += "Publicaciones: $it" }
            detalle.orders?.takeIf { it.isNotBlank() }?.let { errores += "Ventas: $it" }
        }

        return errores
    }

    /** Mismo mapa logístico que usa la web, para que las etiquetas coincidan. */
    private fun logisticLabelFor(logisticType: String): String = when (logisticType) {
        "self_service" -> "FLEX"
        "cross_docking" -> "COLECTA"
        "fulfillment" -> "FULL"
        "drop_off", "xd_drop_off" -> "CORREO"
        else -> "CORREO"
    }

    private companion object {
        /** Mismo valor por defecto que usa el backend cuando ML no informa el tipo logístico. */
        const val DEFAULT_LOGISTIC_TYPE = "default"

        /** Configuración tolerante para el `userJson` que se persiste en la sesión. */
        val APP_JSON = Json {
            ignoreUnknownKeys = true
            explicitNulls = false
            coerceInputValues = true
            isLenient = true
        }
    }
}
