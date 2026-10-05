package com.grana3d.mlpro.core

import android.content.Context
import com.grana3d.mlpro.data.local.SessionStore
import com.grana3d.mlpro.data.local.ThemeStore
import com.grana3d.mlpro.data.remote.MlProApi
import com.grana3d.mlpro.data.repository.MobileRepository
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/**
 * Inyección de dependencias manual (sin librerías), una sola instancia por proceso.
 *
 * `MlProApp.onCreate()` construye este contenedor y la fundación lo reparte a los
 * ViewModels con `mlViewModelFactory`. Acá viven el **único** `OkHttpClient` de la app
 * (cacheado, con timeouts de 20 s), el **único** `Json` tolerante y el `SessionStore`.
 */
class AppContainer(context: Context) {

    /** Contexto de aplicación (para notificaciones del sistema del polling en primer plano). */
    val appContext: Context = context.applicationContext

    /** Persistencia de la sesión (token de dispositivo, URL base, usuario, linkedAt). */
    val sessionStore: SessionStore = SessionStore(appContext)

    /** Preferencia de tema claro/oscuro (vive en su propio DataStore: sobrevive al desvincular). */
    val themeStore: ThemeStore = ThemeStore(appContext)

    /** Configuración JSON tolerante: el backend agrega campos y ML manda tipos variables. */
    val json: Json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
        isLenient = true
    }

    /**
     * Cliente HTTP compartido. Los timeouts de 20 s (conexión, lectura y escritura) están
     * pensados para el Wi-Fi del depósito: ni el operario espera de más ni se corta una
     * subida lenta.
     */
    val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(Constants.HTTP_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .readTimeout(Constants.HTTP_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .writeTimeout(Constants.HTTP_TIMEOUT_SECONDS, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    /** Cliente del backend de ML Pro Suite. */
    val api: MlProApi = MlProApi(client = okHttpClient, json = json)

    /** Única puerta de entrada de la UI a los datos. */
    val repository: MobileRepository = MobileRepository(api = api, session = sessionStore)
}
