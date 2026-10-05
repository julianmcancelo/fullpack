package com.grana3d.mlpro.core

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.CreationExtras
import com.grana3d.mlpro.MlProApp

/**
 * Fábrica de ViewModels sin librerías de inyección: resuelve el [AppContainer] de
 * la aplicación y delega la construcción en [create].
 *
 * Uso dentro de una pantalla:
 * ```
 * val vm: TerminalViewModel = viewModel(factory = mlViewModelFactory { TerminalViewModel(it.repository) })
 * ```
 */
inline fun <reified VM : ViewModel> mlViewModelFactory(
    crossinline create: (AppContainer) -> VM,
): ViewModelProvider.Factory = object : ViewModelProvider.Factory {

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T {
        val viewModel = create(MlProApp.container())
        check(modelClass.isInstance(viewModel)) {
            "La fábrica de ML Pro no puede crear ${modelClass.name}: recibió ${viewModel.javaClass.name}."
        }
        return viewModel as T
    }
}
