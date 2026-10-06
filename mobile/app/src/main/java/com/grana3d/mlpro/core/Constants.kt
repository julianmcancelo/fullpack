package com.grana3d.mlpro.core

/**
 * Constantes globales de ML Pro Suite Mobile.
 * Todo valor que viaje al backend o gobierne el ritmo del operario vive acá.
 */
object Constants {

    /**
     * URL base del backend en producción (CONTRACT.md §3). Es sólo el valor por defecto:
     * se puede cambiar desde Ajustes o desde la pantalla de vinculación, y el QR de
     * vinculación puede sobreescribirlo (campo `a` del QR / `apiBase` de `/pair/claim`).
     */
    const val DEFAULT_API_BASE: String = "https://mercado-libre-manager.vercel.app/api"

    /** Versión de la app (se envía en `POST /pair/claim` como `appVersion`). */
    const val APP_VERSION: String = "1.1.0"

    /** Version code: se compara con el `+N` del tag del GitHub Release (`v1.1.0+6`). */
    const val APP_VERSION_CODE: Int = 6

    /** Repo público donde se publican los APK (`Ajustes → Buscar actualizaciones`). */
    const val GITHUB_OWNER: String = "julianmcancelo"
    const val GITHUB_REPO: String = "fullpack"

    /** Plataforma informada al backend al vincular el dispositivo. */
    const val PLATFORM: String = "android"

    /** Antirrebote del escáner: evita procesar el mismo cuadro/código dos veces seguidas. */
    const val SCAN_THROTTLE_MS: Long = 1200L

    /**
     * Enfriamiento global del escáner después de CUALQUIER lectura.
     *
     * Una etiqueta de Mercado Libre trae el QR **y** códigos de barras: ML Kit devuelve
     * los dos y, sin este enfriamiento, un solo apunte contaba como dos escaneos.
     */
    const val SCAN_COOLDOWN_MS: Long = 2000L
    /** Intervalo de refresco silencioso de la cola de empaque en la Terminal. */
    const val POLL_INTERVAL_MS: Long = 20000L
    /** Cada cuántos polls de cola se refresca bootstrap (contadores) en la Terminal. */
    const val POLL_SUMMARY_EVERY_N: Int = 3
    /** Intervalo de refresco silencioso del Home. */
    const val HOME_POLL_INTERVAL_MS: Long = 30000L

    /** Timeout (conexión/lectura/escritura) del único [okhttp3.OkHttpClient] de la app. */
    const val HTTP_TIMEOUT_SECONDS: Long = 20L

    // ---------------------------------------------------------------------
    // Modos de escaneo
    // ---------------------------------------------------------------------

    /** Empaque y preparación (comportamiento por defecto de la Terminal). */
    const val SCAN_MODE_PACK: String = "pack"

    /** Control de salida a transporte (verificación de despacho). */
    const val SCAN_MODE_DISPATCH: String = "dispatch"

    /** Sin filtro de transportista. */
    const val CARRIER_FILTER_ALL: String = "all"

    /** Estado de preguntas pendientes en `GET /questions` (tal como lo pide el backend). */
    const val QUESTIONS_STATUS_UNANSWERED: String = "UNANSWERED"

    // ---------------------------------------------------------------------
    // Rutas del backend
    // ---------------------------------------------------------------------

    const val PATH_PAIR_CLAIM: String = "/pair/claim"
    const val PATH_MOBILE_ME: String = "/mobile/me"
    const val PATH_MOBILE_BOOTSTRAP: String = "/mobile/bootstrap"
    const val PATH_MOBILE_QUEUE: String = "/mobile/queue"
    const val PATH_MOBILE_UNLINK: String = "/mobile/unlink"
    const val PATH_SHIPMENTS_SCAN: String = "/shipments/scan"
    const val PATH_SHIPMENTS_PACKING: String = "/shipments"
    const val PATH_QUESTIONS: String = "/questions"
    const val PATH_MOBILE_UPDATES: String = "/mobile/updates"

    /** Header obligatorio en todas las rutas moviles y en la descarga de etiquetas. */
    const val HEADER_DEVICE_TOKEN: String = "X-Device-Token"

    // ---------------------------------------------------------------------
    // Códigos de error del backend (cuerpo `{error, message}`)
    // ---------------------------------------------------------------------

    const val ERROR_INVALID_CODE: String = "invalid_code"
    const val ERROR_ALREADY_CLAIMED: String = "already_claimed"
    const val ERROR_EXPIRED_CODE: String = "expired_code"
    const val ERROR_ACCOUNT_NOT_ACTIVE: String = "account_not_active"
    const val ERROR_DEVICE_NOT_LINKED: String = "device_not_linked"
    const val ERROR_USER_NOT_FOUND: String = "user_not_found"

    // ---------------------------------------------------------------------
    // Mensajes transversales (es-AR, mismos términos que la web)
    // ---------------------------------------------------------------------

    const val MSG_NO_SESSION: String = "Dispositivo no vinculado"
    const val MSG_NO_CONNECTION: String = "No hay conexión con el servidor"
    const val MSG_TIMEOUT: String = "El servidor tardó demasiado en responder. Reintentá."
    const val MSG_BAD_RESPONSE: String = "El servidor devolvió una respuesta inesperada."
    const val MSG_EMPTY_RESPONSE: String = "El servidor no devolvió datos."
    const val MSG_QR_EXPIRED: String = "El código QR venció, generá uno nuevo"
    const val MSG_QR_ALREADY_USED: String = "Este código QR ya fue usado. Generá uno nuevo desde la web."

    /** Pasos de ayuda que muestra la pantalla de vinculación. */
    val PAIRING_HELP_STEPS: List<String> = listOf(
        "Abrí Fullpack en la computadora e iniciá sesión.",
        "Entrá a Vincular celular y dejá el código QR en pantalla.",
        "Escaneá el QR con esta app: el teléfono queda vinculado al instante.",
    )
}
