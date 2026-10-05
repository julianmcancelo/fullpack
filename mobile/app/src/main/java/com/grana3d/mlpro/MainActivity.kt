package com.grana3d.mlpro

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.grana3d.mlpro.data.local.ThemeMode
import com.grana3d.mlpro.ui.navigation.AppNav
import com.grana3d.mlpro.ui.theme.MlTheme
import com.grana3d.mlpro.util.Notifications

/**
 * Única Activity de ML Pro Suite: hospeda todo el árbol Compose.
 *
 * Se usa edge-to-edge y los insets se resuelven dentro de la UI
 * (`ui/components/Components.kt` + `ui/navigation/AppNav.kt`) para que la barra
 * inferior nunca quede tapada por la barra de gestos.
 *
 * Las notificaciones del sistema abren esta Activity con el extra `open_route`
 * (`"terminal"` o `"questions"`): se reenvía a [AppNav] como ruta inicial y también se
 * atiende en [onNewIntent] (la Activity es `singleTop`) para navegar sin recrear la pila.
 */
class MainActivity : ComponentActivity() {

    private var openRoute: String? by mutableStateOf(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        openRoute = requestedRoute(intent)
        enableEdgeToEdge()
        setContent {
            val themeMode by MlProApp.container().themeStore.mode
                .collectAsStateWithLifecycle(initialValue = ThemeMode.SYSTEM)
            val darkTheme = when (themeMode) {
                ThemeMode.LIGHT -> false
                ThemeMode.DARK -> true
                ThemeMode.SYSTEM -> isSystemInDarkTheme()
            }
            MlTheme(darkTheme = darkTheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MlTheme.colors.app,
                ) {
                    AppNav(startRoute = openRoute ?: "home")
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        requestedRoute(intent)?.let { openRoute = it }
    }

    private fun requestedRoute(intent: Intent?): String? =
        intent?.getStringExtra(Notifications.EXTRA_OPEN_ROUTE)?.takeIf { it.isNotBlank() }
}
