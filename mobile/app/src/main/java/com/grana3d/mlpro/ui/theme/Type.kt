package com.grana3d.mlpro.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.runtime.Immutable
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp

/**
 * Tipografía de ML Pro Suite (§4): fuente del sistema con pesos y tamaños
 * ajustados, sin archivos de fuentes propios.
 *
 * - [display] 26sp ExtraBold (títulos de pantalla)
 * - [title] 17sp Bold (títulos de tarjeta y botones)
 * - [body] 14sp Normal (texto corriente)
 * - [label] 11sp Bold, tracking 0.08 em: se usa SIEMPRE sobre texto en MAYÚSCULAS
 *   (los componentes ya llaman a `uppercase()`).
 * - [value] 24sp ExtraBold con cifras tabulares (`tnum`, equivalente a
 *   `FontFeatureSetting("tnum")`) para que los importes no bailen.
 */
@Immutable
data class MlType(
    val display: TextStyle = TextStyle(
        fontSize = 26.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = (-0.4).sp,
        lineHeight = 32.sp,
    ),
    val title: TextStyle = TextStyle(
        fontSize = 17.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = (-0.4).sp,
        lineHeight = 23.sp,
    ),
    val body: TextStyle = TextStyle(
        fontSize = 14.sp,
        fontWeight = FontWeight.Normal,
        lineHeight = 20.sp,
    ),
    val label: TextStyle = TextStyle(
        fontSize = 11.sp,
        fontWeight = FontWeight.Bold,
        letterSpacing = 0.08.em,
        lineHeight = 15.sp,
    ),
    val value: TextStyle = TextStyle(
        fontSize = 24.sp,
        fontWeight = FontWeight.ExtraBold,
        letterSpacing = (-0.4).sp,
        lineHeight = 29.sp,
        fontFeatureSettings = "tnum",
    ),
)

/** Traducción de los estilos propios a los `Typography` de Material 3. */
internal fun MlType.toMaterialTypography(): Typography = Typography(
    displayLarge = display,
    displayMedium = display,
    displaySmall = display,
    headlineLarge = display,
    headlineMedium = display,
    headlineSmall = title,
    titleLarge = title,
    titleMedium = title,
    titleSmall = title,
    bodyLarge = body,
    bodyMedium = body,
    bodySmall = body,
    labelLarge = title,
    labelMedium = label,
    labelSmall = label,
)
