package com.grana3d.mlpro

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.grana3d.mlpro.ui.navigation.AppNav
import com.grana3d.mlpro.ui.theme.MlTheme

/**
 * Única Activity de ML Pro Suite: hospeda todo el árbol Compose.
 *
 * Se usa edge-to-edge y los insets se resuelven dentro de la UI
 * (`ui/components/Components.kt` + `ui/navigation/AppNav.kt`) para que la barra
 * inferior nunca quede tapada por la barra de gestos.
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MlTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MlTheme.colors.app,
                ) {
                    AppNav()
                }
            }
        }
    }
}
