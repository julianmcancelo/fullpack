# ML Pro Mobile — contrato de implementación

App Android nativa (Kotlin + Jetpack Compose) que se vincula a la cuenta de ML Pro
Suite escaneando un código QR y opera la **terminal de empaque** desde el celular.

Este documento es la fuente de verdad: **respetá los nombres, paquetes y firmas al
pie de la letra**, porque varias personas escriben archivos distintos en paralelo.

---

## 1. Toolchain (ya instalado en esta máquina)

| Pieza | Versión |
| --- | --- |
| Gradle | 8.14 |
| Android Gradle Plugin | 8.13.2 |
| Kotlin | 2.2.20 |
| compileSdk / targetSdk | 36 |
| minSdk | 24 |
| JVM target | 17 |
| SDK Android | `C:\Users\Julian\AppData\Local\Android\Sdk` |

Dependencias **exactas** (no agregar otras):

```
androidx.core:core-ktx:1.13.1
androidx.activity:activity-compose:1.10.1
androidx.lifecycle:lifecycle-runtime-compose:2.9.4
androidx.lifecycle:lifecycle-viewmodel-compose:2.9.4
androidx.navigation:navigation-compose:2.9.0
androidx.datastore:datastore-preferences:1.1.7
androidx.camera:camera-core:1.5.0
androidx.camera:camera-camera2:1.5.0
androidx.camera:camera-lifecycle:1.5.0
androidx.camera:camera-view:1.5.0
com.google.mlkit:barcode-scanning:17.3.0
com.squareup.okhttp3:okhttp:4.12.0
org.jetbrains.kotlinx:kotlinx-serialization-json:1.8.1
org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2
io.coil-kt:coil-compose:2.7.0
```

Compose: usar `platform("androidx.compose:compose-bom:2025.09.00")` y luego
`androidx.compose.ui:ui`, `ui-graphics`, `ui-tooling-preview`, `androidx.compose.material3:material3`.
`debugImplementation("androidx.compose.ui:ui-tooling")`.

**No** usar Accompanist: para permisos usar `rememberLauncherForActivityResult` +
`ActivityResultContracts.RequestPermission`.

**No** agregar archivos de tipografía: se usa la fuente del sistema con pesos y
tamaños ajustados (ver §4).

---

## 2. Estructura y dueños de archivos

Módulo único `:app`, paquete base `com.grana3d.mlpro`, `applicationId` `com.grana3d.mlpro`.

```
mobile/
  settings.gradle.kts
  build.gradle.kts
  gradle.properties
  gradle/wrapper/gradle-wrapper.properties
  local.properties
  app/build.gradle.kts
  app/proguard-rules.pro
  app/src/main/AndroidManifest.xml
  app/src/main/res/values/{strings,colors,themes}.xml
  app/src/main/res/xml/{network_security_config,backup_rules,data_extraction_rules}.xml
  app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml (+ ic_launcher_round.xml)
  app/src/main/res/drawable/ic_launcher_foreground.xml
  app/src/main/res/values/ic_launcher_background.xml
  app/src/main/java/com/grana3d/mlpro/
    MlProApp.kt
    MainActivity.kt
    core/Constants.kt
    core/ApiResult.kt
    core/Formatters.kt
    util/Beep.kt
    util/Vibrate.kt
    util/Notifications.kt
    data/local/SessionStore.kt
    data/local/ThemeStore.kt
    data/remote/dto/Dtos.kt
    data/remote/MlProApi.kt
    data/repository/MobileRepository.kt
    domain/Models.kt
    ui/theme/{Color,Theme,Type,Shape}.kt
    ui/components/Components.kt
    ui/navigation/AppNav.kt
    ui/pairing/{PairingScreen,PairingViewModel}.kt
    ui/camera/QrScannerView.kt
    ui/home/{HomeScreen,HomeViewModel}.kt
    ui/questions/{QuestionsScreen,QuestionsViewModel}.kt
    ui/terminal/{TerminalScreen,TerminalViewModel}.kt
    ui/shipments/{ShipmentsScreen,ShipmentsViewModel,ShipmentDetailScreen,ShipmentStatus}.kt
    ui/settings/{SettingsScreen,SettingsViewModel}.kt
```

---

## 3. Contrato de API (backend real, ya implementado)

Base por defecto: `https://mercado-libre-manager.vercel.app/api` (configurable por el
usuario en Ajustes y guardada en `SessionStore`). Todas las respuestas son JSON.

### Vinculación
| Método | Ruta | Cuerpo / query | Respuesta |
| --- | --- | --- | --- |
| POST | `/pair/claim` | `{code, secret, deviceName, platform:"android", appVersion, deviceId?}` | `{success, deviceToken, device, user, apiBase, serverTime, message}` |
| GET | `/mobile/me` | header `X-Device-Token` | `{success, user, device, connection, serverTime}` |

Errores de `claim`: `404 invalid_code`, `409 already_claimed`, `410 expired_code`,
`403 account_not_active`. El cuerpo de error es `{error, message}`.

### Operación
| Método | Ruta | Cuerpo | Respuesta |
| --- | --- | --- | --- |
| GET | `/mobile/bootstrap` | — | `{success, serverTime, user, device, connection, summary, queue[], lowStock[], recentLogs[], errors}` |
| GET | `/mobile/queue` | — | `{success, total, readyToShip, packed, queue[], serverTime}` |
| GET | `/mobile/updates?since=ISO8601` | header `X-Device-Token` | `{success, serverTime, newOrders[], newQuestions[], counts:{orders, questions}}` (sin `since`: arrays vacíos + `isInitial:true` para guardar cursor) |
| POST | `/shipments/scan` | `{rawCode, autoPack:true, scanMode:"pack"\|"dispatch", carrierFilter:"all"}` | ver abajo |
| PUT | `/shipments/{id}/packing` | `{printed?, packed?, qualityChecked?, dispatchChecked?, note?, statusOverride?}` | `{success, packing}` |
| GET | `/mobile/label/{id}?format=pdf\|zpl` | header `X-Device-Token` | binario PDF |
| POST | `/mobile/unlink` | header `X-Device-Token` | `{success, message}` |
| GET | `/questions?status=UNANSWERED` | header `X-Device-Token` | `{questions[], total, unanswered_count}` |
| POST | `/questions/{id}/answer` | `{text}`, header `X-Device-Token` | `{success, result}` |
| GET | `/mobile/updates?since=ISO` | header `X-Device-Token` | `{success, serverTime, since, newOrders[], newQuestions[]}` |

Todas las rutas `/mobile/*` exigen `X-Device-Token`; sin él devuelven `401 device_not_linked`.
Las rutas `/questions/*` también reciben `X-Device-Token` (la app lo manda siempre).

`GET /questions` responde con las preguntas enriquecidas del backend (forma real de
Mercado Libre + `item` adjunto):
```json
{ "questions": [
    { "id": 123, "text": "¿Tenés stock?", "status": "UNANSWERED",
      "date_created": "2026-05-01T12:00:00.000Z", "item_id": "MLA123",
      "from": { "id": 456 }, "item": { "id": "MLA123", "title": "Producto" } } ],
  "total": 1, "unanswered_count": 1 }
```

`POST /questions/{id}/answer` con `{text}` responde `{success:true, result:{...}}`;
si el texto está vacío el backend devuelve `400 {error:"El texto de la respuesta…"}`.

`GET /mobile/updates?since=2026-05-01T12:00:00.000Z` responde sólo lo creado después
del cursor (fechas ISO 8601, claves camelCase como el resto de `/mobile/*`).
Sin `since` (primera sincronización) devuelve arrays vacíos con `isInitial:true` para
que el cliente guarde el cursor sin notificar nada viejo:
```json
{ "success": true, "serverTime": "2026-05-01T12:00:30.000Z",
  "newOrders": [
    { "id": "2000012345678901", "totalAmount": 15000, "itemTitle": "Producto",
      "itemThumbnail": "https://...", "buyerNickname": "juanp",
      "dateCreated": "2026-05-01T12:00:10.000Z" } ],
  "newQuestions": [
    { "id": "123", "itemId": "MLA123", "itemTitle": "Producto", "text": "¿Tenés stock?",
      "fromNickname": "juanp", "dateCreated": "2026-05-01T12:00:20.000Z" } ],
  "counts": { "orders": 1, "questions": 1 } }
```
La app tolera las claves extra (`counts`, `errors`, `isInitial`, `itemId` en preguntas)
gracias a `ignoreUnknownKeys`; el `itemId` de `newQuestions` se ignora en esta fase.

### JSON de apoyo

`QueueItem`
```json
{ "id":"48164856585", "orderId":"2000012345678901", "status":"ready_to_ship",
  "substatus":"", "logisticType":"self_service", "logisticLabel":"FLEX",
  "trackingNumber":"", "buyerName":"Juan Pérez", "buyerNickname":"juanp",
  "city":"CABA", "state":"Buenos Aires", "zipCode":"1425",
  "itemTitle":"Producto", "itemThumbnail":"https://...", "itemSku":"SKU-1",
  "quantity":2, "totalAmount":15000, "orderDate":"2026-05-01T12:00:00.000Z",
  "packing":{ "printed":false, "packed":false, "qualityChecked":false,
              "dispatchChecked":false, "note":"", "scanCount":0,
              "firstScannedAt":null, "lastScannedAt":null } }
```

`summary` de bootstrap
```json
{ "pendingShipmentsCount":0, "unpackedCount":0, "packedCount":0,
  "inTransitShipmentsCount":0, "deliveredShipmentsCount":0, "paidOrdersCount":0,
  "totalOrdersCount":0, "totalSalesAmount":0, "totalItemsCount":0,
  "activeItemsCount":0, "pausedItemsCount":0, "lowStockCount":0, "outOfStockCount":0 }
```

`connection`: `{connected:boolean, nickname?, userId?, siteId?, message?}`

`lowStock[]`: `{id, title, thumbnail, sku, availableQuantity, price, status}`

`recentLogs[]`: `{id, barcode, shipmentId, action, details, createdAt}`

Respuesta de `GET /mobile/updates?since=ISO8601`:
```json
{ "success":true, "serverTime":"2026-05-01T12:00:00.000Z",
  "newOrders":[ { "id":"2000012345678901", "totalAmount":15000,
    "itemTitle":"Producto", "itemThumbnail":"https://...",
    "buyerNickname":"juanp", "dateCreated":"2026-05-01T12:00:00.000Z" } ],
  "newQuestions":[ { "id":"123", "itemId":"MLA1", "itemTitle":"Producto",
    "text":"¿Tiene stock?", "fromNickname":"comprador1",
    "dateCreated":"2026-05-01T12:00:00.000Z" } ],
  "counts":{ "orders":1, "questions":1 } }
```

Respuesta de `POST /shipments/scan`:
```json
{ "success":true, "found":true, "scanMode":"pack",
  "alreadyPacked":false, "scanCount":1, "firstScannedAt":"...", "lastScannedAt":"...",
  "shipment": { "id":48164856585, "order_id":2000012345678901, "status":"ready_to_ship",
    "substatus":"", "logistic_type":"self_service", "tracking_number":null,
    "receiver_address": { "city":{"name":"CABA"}, "state":{"name":"Buenos Aires"}, "zip_code":"1425" },
    "buyer": { "first_name":"Juan", "last_name":"Pérez", "nickname":"juanp" },
    "items": [ { "quantity":2, "item": { "id":"MLA1", "title":"Producto",
                 "thumbnail":"https://...", "seller_sku":"SKU-1" } } ],
    "total_amount":15000, "order_date":"2026-05-01T12:00:00.000Z",
    "packing": { "printed":false, "packed":true, "qualityChecked":true,
                 "dispatchChecked":false, "note":"", "scanCount":1,
                 "firstScannedAt":"...", "lastScannedAt":"..." } },
  "message":"✅ ¡Paquete #48164856585 verificado y marcado como EMPAQUETADO con éxito!" }
```
Variantes: `found:true, carrierMismatch:true, expectedCarrier, actualCarrier`;
`found:true, scanMode:"dispatch", alreadyDispatchChecked`; `found:false, scannedCode`.
Todos los importes son ARS y los conteos pueden venir como número o string: parsear
con tolerancia.

Formato del QR de vinculación (lo genera la web):
```json
{"v":1,"t":"mlpro-pair","c":"ABC123","s":"<hex>","a":"https://.../api","u":"email"}
```

---

## 4. Estética — mismos tokens que la web

`ui/theme/Color.kt` debe exponer una `data class MlColors` con estos valores exactos
(hex) y dos instancias, `LightColors` y `DarkColors`:

| Token | Claro | Oscuro |
| --- | --- | --- |
| app | `#F2F5FB` | `#080C16` |
| card | `#FFFFFF` | `#111625` |
| raised | `#FFFFFF` | `#171E30` |
| muted | `#F6F9FD` | `#1A2135` |
| field | `#FFFFFF` | `#161D2F` |
| line | `#E1E7F1` | `#242D44` |
| lineStrong | `#C8D2E2` | `#374360` |
| ink | `#0C1322` | `#EDF2FB` |
| inkMuted | `#475569` | `#A6B2C7` |
| inkSubtle | `#74839A` | `#808EA6` |
| brand | `#FFD600` | `#FFD600` |
| brandStrong | `#F0B800` | `#FFE254` |
| brandInk | `#141826` | `#111522` |
| brandSoft | `#FFFADB` | `#2E280C` |
| brandSoftInk | `#7A5A00` | `#FAE882` |
| accent | `#2D6EEB` | `#60A5FA` |
| accentSoft | `#EBF3FF` | `#16223A` |
| success | `#10A36C` | `#34D399` |
| successSoft | `#E8FAF1` | `#0E2B26` |
| warning | `#DB8A08` | `#FBBF24` |
| warningSoft | `#FFF6E2` | `#30240C` |
| danger | `#E03754` | `#FB7185` |
| dangerSoft | `#FFEEF1` | `#33141E` |

Se consumen con `CompositionLocal`: `val MlTheme.colors: MlColors`. También
`MlTheme.spacing` (4/8/12/16/20/24 dp) y `MlTheme.radius` (card 20.dp, control 14.dp,
pill 999.dp).

Tipografía (fuente del sistema): display 26sp/ExtraBold, title 17sp/Bold,
body 14sp/Normal, label 11sp/Bold con `letterSpacing = 0.08.em` y MAYÚSCULAS,
value 24sp/ExtraBold con `FontFeatureSetting("tnum")` para importes.
Los títulos llevan `letterSpacing = (-0.4).sp`.

`MaterialTheme` se configura con `lightColorScheme`/`darkColorScheme` mapeando
`primary = brand`, `onPrimary = brandInk`, `background = app`, `surface = card`,
`onSurface = ink`, `error = danger`, `outline = line`.

---

## 5. Capa de datos — firmas exactas

`core/ApiResult.kt`
```kotlin
sealed interface ApiResult<out T> {
    data class Ok<T>(val value: T) : ApiResult<T>
    data class Err(val message: String, val code: String? = null, val httpStatus: Int? = null) : ApiResult<Nothing>
}
```

`data/remote/dto/Dtos.kt` — `@Serializable` con `ignoreUnknownKeys = true`:
`PairClaimRequest`, `PairClaimResponse`, `UserDto`, `DeviceDto`, `ConnectionDto`,
`SummaryDto`, `PackingDto`, `QueueItemDto`, `LowStockDto`, `ScanLogDto`,
`BootstrapResponse`, `QueueResponse`, `MeResponse`, `RawShipmentDto`,
`RawReceiverAddressDto`, `RawCityDto`, `RawBuyerDto`, `RawOrderItemDto`,
`RawItemDto`, `ScanResponse`, `PackingUpdateRequest`, `PackingUpdateResponse`,
`QuestionDto` (+ `QuestionItemDto`, `QuestionFromDto`), `QuestionsResponse`,
`AnswerRequest`, `AnswerResponse`, `UpdateOrderDto`, `UpdateQuestionDto`,
`MobileUpdatesDto`, `ApiErrorDto`.
Los campos opcionales van con `= null` y valor por defecto; los numéricos que pueden
llegar como texto usan `@Serializable(with = ...)` o se declaran `JsonElement` y se
normalizan en el repositorio (elegí una estrategia y documentala).

`data/local/SessionStore.kt`
```kotlin
class SessionStore(private val context: Context) {
    val state: Flow<SessionState>
    suspend fun saveLink(deviceToken: String, apiBase: String, userJson: String, deviceName: String)
    suspend fun setApiBase(apiBase: String)
    suspend fun clear()
}
data class SessionState(
    val deviceToken: String? = null,
    val apiBase: String = DEFAULT_API_BASE,
    val userName: String? = null,
    val userEmail: String? = null,
    val userAvatar: String? = null,
    val deviceName: String? = null,
    val linkedAt: Long? = null,
    val lastUpdatesAt: Long? = null,
) { val isLinked get() = !deviceToken.isNullOrBlank() }
```
`lastUpdatesAt` es el cursor del polling de novedades (epoch ms de la última consulta
exitosa a `GET /mobile/updates`; `null` = todavía no se consultó). Se escribe con
`suspend fun setLastUpdatesAt(now: Long)` (clave `last_updates_at`; se borra al
desvincular como el resto de la sesión, salvo la URL del servidor).
Persistencia con `preferencesDataStore(name = "mlpro_session")`.

`data/remote/MlProApi.kt`
```kotlin
class MlProApi(private val client: OkHttpClient, private val json: Json) {
    suspend fun claimPairing(apiBase: String, body: PairClaimRequest): ApiResult<PairClaimResponse>
    suspend fun me(apiBase: String, token: String): ApiResult<MeResponse>
    suspend fun bootstrap(apiBase: String, token: String): ApiResult<BootstrapResponse>
    suspend fun queue(apiBase: String, token: String): ApiResult<QueueResponse>
    suspend fun scan(apiBase: String, token: String, rawCode: String, scanMode: String, carrierFilter: String): ApiResult<ScanResponse>
    suspend fun updatePacking(apiBase: String, token: String, shipmentId: String, body: PackingUpdateRequest): ApiResult<PackingUpdateResponse>
    suspend fun unlink(apiBase: String, token: String): ApiResult<Unit>
    suspend fun listQuestions(apiBase: String, token: String, status: String = "UNANSWERED"): ApiResult<QuestionsResponse>
    suspend fun answerQuestion(apiBase: String, token: String, questionId: String, text: String): ApiResult<AnswerResponse>
    suspend fun mobileUpdates(apiBase: String, token: String, since: String?): ApiResult<MobileUpdatesDto>
    fun labelUrl(apiBase: String, token: String, shipmentId: String, format: String = "pdf"): String
}
```

`domain/Models.kt` — modelos limpios usados por la UI (sin anotaciones de
serialización): `LinkedAccount`, `LinkedDevice`, `ConnectionState`, `PackingState`,
`Shipment` (= QueueItem mapeado), `LowStockItem`, `ScanLogEntry`, `MobileSummary`,
`ScanOutcome` (`Found(shipment, alreadyPacked, scanCount, message)`,
`CarrierMismatch(expected, actual, shipment, message)`, `NotFound(code, message)`,
`Failure(message)`), `ServerConfig`, `Question`
(`id, title?, text, buyer?, itemId?, itemTitle?, dateCreated?, status?`),
`MobileUpdates(newOrders, newQuestions, serverTime?)` con
`UpdateOrder(id, totalAmount?, itemTitle?, itemThumbnail?, buyerNickname?, dateCreated?)`
y `UpdateQuestion(id, itemTitle?, text?, fromNickname?, dateCreated?)`.

`data/repository/MobileRepository.kt`
```kotlin
class MobileRepository(private val api: MlProApi, private val session: SessionStore) {
    val sessionState: Flow<SessionState>
    suspend fun claim(qr: QrPayload, deviceName: String, appVersion: String): ApiResult<LinkedAccount>
    suspend fun bootstrap(): ApiResult<MobileState>
    suspend fun refreshQueue(): ApiResult<List<Shipment>>
    suspend fun scan(rawCode: String, scanMode: ScanMode = ScanMode.PACK, carrierFilter: String = "all"): ApiResult<ScanOutcome>
    suspend fun markPacked(shipmentId: String, packed: Boolean): ApiResult<PackingState>
    suspend fun markPrinted(shipmentId: String, printed: Boolean): ApiResult<PackingState>
    suspend fun markDispatchChecked(shipmentId: String, checked: Boolean): ApiResult<PackingState>
    suspend fun saveNote(shipmentId: String, note: String): ApiResult<PackingState>
    suspend fun setApiBase(apiBase: String)
    suspend fun unlink(): ApiResult<Unit>
    suspend fun listQuestions(status: String = "UNANSWERED"): ApiResult<List<Question>>
    suspend fun answerQuestion(questionId: String, text: String): ApiResult<Unit>
    suspend fun checkMobileUpdates(sinceIso: String?): ApiResult<MobileUpdates>
    suspend fun saveUpdatesCursor(now: Long)
    fun labelUrl(shipmentId: String, format: String = "pdf"): String?
}
data class MobileState(
    val account: LinkedAccount?,
    val device: LinkedDevice?,
    val connection: ConnectionState,
    val summary: MobileSummary,
    val queue: List<Shipment>,
    val lowStock: List<LowStockItem>,
    val recentLogs: List<ScanLogEntry>,
    val errors: List<String> = emptyList(),
)
```

`checkMobileUpdates(null)` es el cursor inicial: no toca la red y devuelve
`MobileUpdates` con listas vacías (el llamador guarda el cursor sin notificar).
`answerQuestion` devuelve `Ok(Unit)` si el backend aceptó; el `Err` trae el mensaje
real del backend.

Notificaciones del sistema (`util/Notifications.kt`, sin FCM en esta fase):
```kotlin
object Notifications {
    const val EXTRA_OPEN_ROUTE: String // "open_route"
    const val ROUTE_TERMINAL: String    // "terminal"
    const val ROUTE_QUESTIONS: String  // "questions"
    fun ensureChannels(context: Context)
    fun showSale(context: Context, order: UpdateOrder)
    fun showQuestion(context: Context, q: UpdateQuestion)
}
```
Dos canales (`"Ventas"` importancia alta + sonido, `"Preguntas"` por defecto), icono
`ic_launcher`, `PendingIntent` a `MainActivity` con `open_route`. El polling de
novedades corre en primer plano desde `HomeViewModel.load()` (tras bootstrap exitoso,
cada 30 s): compara contra el cursor ISO de `lastUpdatesAt`, notifica sólo ids no
vistos (set en memoria del VM, tope 500) y persiste el cursor. La primera vez sólo
guarda el cursor. Todo silencioso: un `Err` (red, 404) no muestra banners.
`HomeViewModel` también refresca `unansweredCount: Int?` (conteo real de
`listQuestions`; `null` = sin dato, la tarjeta no muestra conteo falso).
`SettingsViewModel.load()` dispara `checkForUpdates()` automáticamente una vez si
`updateResult == null && !isCheckingUpdates` (además del botón manual).

`core/Formatters.kt`
```kotlin
fun formatArs(amount: Double): String        // "$ 15.000"
fun formatArsCompact(amount: Double): String // "$ 15,0 k" / "$ 1,2 M"
fun formatDateTime(iso: String?): String     // "01 may · 14:35"
fun formatRelative(iso: String?): String     // "hace 5 min"
fun parseQrPayload(raw: String): QrPayload?  // acepta el JSON del QR o una URL
data class QrPayload(val code: String, val secret: String, val apiBase: String, val email: String?)
```

`util/Vibrate.kt`: `fun Context.vibrateSuccess()`, `vibrateError()`, `vibrateTick()`.
`util/Beep.kt`: `object Beep { fun success(context: Context); fun error(context: Context) }`
usando `ToneGenerator` (`STREAM_MUSIC`), liberando el recurso siempre.

---

## 5.bis Componentes de UI — firmas exactas (`ui/components/Components.kt`)

Todo se consume desde `ui/components/Components.kt`. Las pantallas **sólo** usan estos
componentes más los de Compose (`Column`, `Row`, `Text`, `LazyColumn`, …).

```kotlin
@Composable fun MlScaffold(
    title: String,
    subtitle: String? = null,
    onBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
    bottomBar: @Composable () -> Unit = {},
    snackbarHostState: SnackbarHostState? = null,
    content: @Composable (PaddingValues) -> Unit,
)

@Composable fun MlCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    accent: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
)

@Composable fun MlSectionHeader(
    title: String,
    subtitle: String? = null,
    trailing: (@Composable () -> Unit)? = null,
)

enum class MlButtonVariant { Primary, Accent, Outline, Ghost, Danger, Success }

@Composable fun MlButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: MlButtonVariant = MlButtonVariant.Primary,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    loading: Boolean = false,
    fillWidth: Boolean = false,
)

enum class MlTone { Neutral, Brand, Success, Warning, Danger, Info }

@Composable fun MlBadge(text: String, tone: MlTone = MlTone.Neutral, solid: Boolean = false)

@Composable fun MlStatusPill(text: String, tone: MlTone, dot: Boolean = false)

@Composable fun MlKpiCard(
    label: String,
    value: String,
    icon: ImageVector,
    tone: MlTone,
    footline: String? = null,
    modifier: Modifier = Modifier,
)

@Composable fun MlTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
    trailing: (@Composable () -> Unit)? = null,
)

@Composable fun MlEmptyState(
    icon: ImageVector,
    title: String,
    message: String,
    action: (@Composable () -> Unit)? = null,
)

@Composable fun MlErrorBanner(message: String, onRetry: (() -> Unit)? = null, onDismiss: (() -> Unit)? = null)

@Composable fun MlLoadingList(items: Int = 4, modifier: Modifier = Modifier)

@Composable fun MlProgressBar(progress: Float, label: String? = null)

@Composable fun MlDivider()

@Composable fun MlThumbnail(url: String?, size: Dp = 48.dp, modifier: Modifier = Modifier, fallbackIcon: ImageVector = Icons.Outlined.Inventory2)
```

Contratos de las pantallas que `AppNav` invoca:

```kotlin
@Composable fun PairingScreen(onLinked: () -> Unit)
@Composable fun HomeScreen(onOpenTerminal: () -> Unit, onOpenShipments: () -> Unit, onOpenSettings: () -> Unit, onOpenQuestions: () -> Unit = {})
@Composable fun QuestionsScreen(onBack: () -> Unit)
@Composable fun TerminalScreen(onBack: () -> Unit, onOpenShipments: () -> Unit)
@Composable fun ShipmentsScreen(onBack: () -> Unit, onOpenDetail: (String) -> Unit)
@Composable fun ShipmentDetailScreen(shipmentId: String, onBack: () -> Unit)
@Composable fun SettingsScreen(onUnlinked: () -> Unit)
```

Rutas de navegación (string): `pairing`, `home`, `terminal`, `shipments`,
`shipments/{shipmentId}`, `questions`, `settings`.
`AppNav(onFinish: () -> Unit = {}, startRoute: String = "home")`: `startRoute` es el
deep-link de las notificaciones (`"terminal"` o `"questions"`); si no es válida o no
hay sesión, se usa `home` / `pairing`. `MainActivity` (singleTop) lee el extra
`open_route` en `onCreate` y `onNewIntent` y lo reenvía a `AppNav`. El Home pide el
permiso `POST_NOTIFICATIONS` (API 33+) con `rememberLauncherForActivityResult`.

Inyección de dependencias manual (sin librerías):

```kotlin
// core/AppContainer.kt   (dueño: capa de datos)
class AppContainer(context: Context) {
    val appContext: Context // contexto de aplicación (notificaciones del polling)
    val sessionStore: SessionStore
    val themeStore: ThemeStore
    val api: MlProApi
    val repository: MobileRepository
}

// MlProApp.kt  (dueño: fundación)
class MlProApp : Application() {
    lateinit var container: AppContainer
    override fun onCreate() { super.onCreate(); container = AppContainer(this) }
}

// core/ViewModelFactory.kt  (dueño: fundación)
inline fun <reified VM : ViewModel> mlViewModelFactory(
    crossinline create: (AppContainer) -> VM,
): ViewModelProvider.Factory

// uso dentro de una pantalla
val vm: TerminalViewModel = viewModel(factory = mlViewModelFactory { TerminalViewModel(it.repository) })
```

---

## 6. Pantallas
**Pairing** — si no hay sesión, es la pantalla inicial. Video de cámara a pantalla
completa con marco de escaneo (4 esquinas `brand`), permiso de cámara pedido con
`rememberLauncherForActivityResult` y estado "permiso denegado" con botón a Ajustes.
Al detectar un QR válido: vibración + navegación a la terminal. Debajo, tarjeta
`.card` con: campo editable de URL del servidor, botón "Ingresar código a mano",
estado del servidor (ping a `/pair/claim` con código inválido muestra que el server
responde), y texto de ayuda de 3 pasos. Nunca dejar la cámara prendida en background.

**Home** — saludo con avatar y nombre, chip de conexión, grilla de 4 KPIs
(`Por despachar`, `Empaquetados`, `En tránsito`, `Ventas cobradas`), accesos grandes a
"Terminal de empaque", "Envíos" y "Preguntas" (con badge de pendientes sólo si hay
conteo real), lista de stock crítico y últimos escaneos.

**Preguntas** — lista de sin responder con skeleton/vacío/error+reintento, buscador y
pull-to-refresh; cada tarjeta muestra comprador, fecha, texto y publicación, con botón
"Responder" que abre el campo inline y envía (loading; éxito = snackbar + recarga).

**Terminal** (el corazón) — barra superior con contador de progreso
(`empaquetados / total`) y `LinearProgressIndicator`; botón enorme "Escanear paquete"
que abre el escáner; campo de código manual; resultado del escaneo como tarjeta
grande con color por estado (verde empaquetado, ámbar duplicado, rojo no encontrado /
transportista incorrecto), datos del paquete y acciones grandes: "Abrir etiqueta PDF",
"Marcar empaquetado", "Verificación de despacho", "Nota". Lista de la cola con
tarjetas: miniatura, título, comprador, ciudad, badge logístico y estado de empaque.
Sonido + vibración + color en cada resultado: el operario no debería mirar la pantalla.

**Shipments** — buscador, filtro segmentado (Todos / Sin empaquetar / Empaquetados /
En tránsito), lista de tarjetas y detalle con datos completos, acciones de empaque y
descarga de etiqueta.

**Settings** — cuenta vinculada (avatar, nombre, email, rol), dispositivo
(nombre, plataforma, vinculado, último acceso), conexión con Mercado Libre,
URL del servidor editable, botón "Desvincular dispositivo", versión de la app y
enlaces al DevCenter.

---

## 7. Reglas

- **Todo el texto de UI en español** (es-AR), con el mismo vocabulario que la web.
- Estética = tokens de §4. Nada de colores Material por defecto ni hex sueltos fuera
  de `Color.kt`.
- Manejá estados: cargando (skeleton), vacío (`.empty` equivalentes), error (banner
  con reintento). Nunca una pantalla en blanco.
- La app **no** guarda credenciales de Mercado Libre: sólo el token de dispositivo.
- Un solo `OkHttpClient` con timeouts de 20 s; `Json { ignoreUnknownKeys = true;
  explicitNulls = false; coerceInputValues = true }`.
- Nada de `!!`: usá `?:` y `requireNotNull` sólo donde sea demostrable.
- **No ejecutes `gradle`/`gradlew`**: el APK lo compila y ajusta el agente principal.
  Verificá releyendo el código.
- No crees archivos fuera de `mobile/`.
