package com.grana3d.mlpro.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Shapes
import androidx.compose.runtime.Immutable
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * Radios de la app (§4): tarjetas 20 dp, controles 14 dp y píldoras 999 dp.
 * Se consumen con `MlTheme.radius`.
 */
@Immutable
data class MlRadius(
    val card: Dp = 20.dp,
    val control: Dp = 14.dp,
    val pill: Dp = 999.dp,
)

/** Traducción de los radios propios a los `Shapes` de Material 3. */
internal fun MlRadius.toMaterialShapes(): Shapes = Shapes(
    extraSmall = RoundedCornerShape(control),
    small = RoundedCornerShape(control),
    medium = RoundedCornerShape(card),
    large = RoundedCornerShape(card),
    extraLarge = RoundedCornerShape(card),
)
