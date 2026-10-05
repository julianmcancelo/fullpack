package com.grana3d.mlpro.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Aire de la app (§4): 4 / 8 / 12 / 16 / 20 / 24 dp. Se consume con `MlTheme.spacing`.
 */
@Immutable
data class MlSpacing(
    val xs: Dp = 4.dp,
    val sm: Dp = 8.dp,
    val md: Dp = 12.dp,
    val lg: Dp = 16.dp,
    val xl: Dp = 20.dp,
    val xxl: Dp = 24.dp,
)

/** Tokens de color activos. */
val LocalMlColors = staticCompositionLocalOf { LightColors }

/** Tokens de espaciado activos. */
val LocalMlSpacing = staticCompositionLocalOf { MlSpacing() }

/** Tokens de radios activos. */
val LocalMlRadius = staticCompositionLocalOf { MlRadius() }

/** Tokens tipográficos activos. */
val LocalMlType = staticCompositionLocalOf { MlType() }

/**
 * Acceso a la estética de ML Pro Suite: `MlTheme.colors`, `MlTheme.spacing`,
 * `MlTheme.radius` y `MlTheme.type`.
 */
object MlTheme {

    val colors: MlColors
        @Composable @ReadOnlyComposable get() = LocalMlColors.current

    val spacing: MlSpacing
        @Composable @ReadOnlyComposable get() = LocalMlSpacing.current

    val radius: MlRadius
        @Composable @ReadOnlyComposable get() = LocalMlRadius.current

    val type: MlType
        @Composable @ReadOnlyComposable get() = LocalMlType.current
}

/**
 * Tema de la app: lee el modo oscuro del sistema, publica los tokens propios y
 * mapea Material 3 a la paleta de marca (§4).
 */
@Composable
fun MlTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    val colors = if (darkTheme) DarkColors else LightColors
    val spacing = MlSpacing()
    val radius = MlRadius()
    val type = MlType()

    // Texto sobre colores plenos (accent/success/danger): blanco en claro y tinta
    // oscura en oscuro, porque ahí los tonos de marca son claros.
    val onStrong = if (darkTheme) colors.brandInk else Color.White

    val colorScheme = if (darkTheme) {
        darkColorScheme(
            primary = colors.brand,
            onPrimary = colors.brandInk,
            primaryContainer = colors.brandSoft,
            onPrimaryContainer = colors.brandSoftInk,
            secondary = colors.accent,
            onSecondary = onStrong,
            secondaryContainer = colors.accentSoft,
            onSecondaryContainer = colors.accent,
            tertiary = colors.success,
            onTertiary = onStrong,
            tertiaryContainer = colors.successSoft,
            onTertiaryContainer = colors.success,
            background = colors.app,
            onBackground = colors.ink,
            surface = colors.card,
            onSurface = colors.ink,
            surfaceVariant = colors.muted,
            onSurfaceVariant = colors.inkMuted,
            error = colors.danger,
            onError = onStrong,
            errorContainer = colors.dangerSoft,
            onErrorContainer = colors.danger,
            outline = colors.line,
            outlineVariant = colors.lineStrong,
        )
    } else {
        lightColorScheme(
            primary = colors.brand,
            onPrimary = colors.brandInk,
            primaryContainer = colors.brandSoft,
            onPrimaryContainer = colors.brandSoftInk,
            secondary = colors.accent,
            onSecondary = onStrong,
            secondaryContainer = colors.accentSoft,
            onSecondaryContainer = colors.accent,
            tertiary = colors.success,
            onTertiary = onStrong,
            tertiaryContainer = colors.successSoft,
            onTertiaryContainer = colors.success,
            background = colors.app,
            onBackground = colors.ink,
            surface = colors.card,
            onSurface = colors.ink,
            surfaceVariant = colors.muted,
            onSurfaceVariant = colors.inkMuted,
            error = colors.danger,
            onError = onStrong,
            errorContainer = colors.dangerSoft,
            onErrorContainer = colors.danger,
            outline = colors.line,
            outlineVariant = colors.lineStrong,
        )
    }

    CompositionLocalProvider(
        LocalMlColors provides colors,
        LocalMlSpacing provides spacing,
        LocalMlRadius provides radius,
        LocalMlType provides type,
    ) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = type.toMaterialTypography(),
            shapes = radius.toMaterialShapes(),
            content = content,
        )
    }
}
