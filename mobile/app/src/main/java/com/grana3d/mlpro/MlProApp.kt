package com.grana3d.mlpro

import android.app.Application
import com.grana3d.mlpro.core.AppContainer
import com.grana3d.mlpro.util.Notifications

/**
 * Aplicación de ML Pro Suite.
 *
 * Es el punto donde se construye el contenedor de dependencias manual (`AppContainer`,
 * dueño de la capa de datos) y se deja accesible para las fábricas de ViewModel
 * (`core/ViewModelFactory.kt`), que no reciben un Context por parámetro.
 */
class MlProApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        instance = this
        Notifications.ensureChannels(this)
    }

    companion object {

        @Volatile
        private var instance: MlProApp? = null

        /**
         * Contenedor de dependencias de la aplicación.
         * Falla con un mensaje claro sólo si se pidió antes de `onCreate`.
         */
        fun container(): AppContainer {
            val app = instance
                ?: error("MlProApp todavía no se inicializó: llamá a container() después de onCreate().")
            return app.container
        }
    }
}
