package com.grana3d.mlpro.ui.theme

import androidx.compose.runtime.Immutable
import androidx.compose.ui.graphics.Color

/**
 * Tokens de color de ML Pro Suite: espejo exacto de la estética de la web (§4).
 *
 * Este es el ÚNICO archivo del proyecto donde se declaran colores hexadecimales;
 * todo lo demás se consume vía `MlTheme.colors`.
 */
@Immutable
data class MlColors(
    val app: Color,
    val card: Color,
    val raised: Color,
    val muted: Color,
    val field: Color,
    val line: Color,
    val lineStrong: Color,
    val ink: Color,
    val inkMuted: Color,
    val inkSubtle: Color,
    val brand: Color,
    val brandStrong: Color,
    val brandInk: Color,
    val brandSoft: Color,
    val brandSoftInk: Color,
    val accent: Color,
    val accentSoft: Color,
    val success: Color,
    val successSoft: Color,
    val warning: Color,
    val warningSoft: Color,
    val danger: Color,
    val dangerSoft: Color,
)

/** Paleta clara. */
val LightColors: MlColors = MlColors(
    app = Color(0xFFF2F5FB),
    card = Color(0xFFFFFFFF),
    raised = Color(0xFFFFFFFF),
    muted = Color(0xFFF6F9FD),
    field = Color(0xFFFFFFFF),
    line = Color(0xFFE1E7F1),
    lineStrong = Color(0xFFC8D2E2),
    ink = Color(0xFF0C1322),
    inkMuted = Color(0xFF475569),
    inkSubtle = Color(0xFF74839A),
    brand = Color(0xFFFFD600),
    brandStrong = Color(0xFFF0B800),
    brandInk = Color(0xFF141826),
    brandSoft = Color(0xFFFFFADB),
    brandSoftInk = Color(0xFF7A5A00),
    accent = Color(0xFF2D6EEB),
    accentSoft = Color(0xFFEBF3FF),
    success = Color(0xFF10A36C),
    successSoft = Color(0xFFE8FAF1),
    warning = Color(0xFFDB8A08),
    warningSoft = Color(0xFFFFF6E2),
    danger = Color(0xFFE03754),
    dangerSoft = Color(0xFFFFEEF1),
)

/** Paleta oscura. */
val DarkColors: MlColors = MlColors(
    app = Color(0xFF080C16),
    card = Color(0xFF111625),
    raised = Color(0xFF171E30),
    muted = Color(0xFF1A2135),
    field = Color(0xFF161D2F),
    line = Color(0xFF242D44),
    lineStrong = Color(0xFF374360),
    ink = Color(0xFFEDF2FB),
    inkMuted = Color(0xFFA6B2C7),
    inkSubtle = Color(0xFF808EA6),
    brand = Color(0xFFFFD600),
    brandStrong = Color(0xFFFFE254),
    brandInk = Color(0xFF111522),
    brandSoft = Color(0xFF2E280C),
    brandSoftInk = Color(0xFFFAE882),
    accent = Color(0xFF60A5FA),
    accentSoft = Color(0xFF16223A),
    success = Color(0xFF34D399),
    successSoft = Color(0xFF0E2B26),
    warning = Color(0xFFFBBF24),
    warningSoft = Color(0xFF30240C),
    danger = Color(0xFFFB7185),
    dangerSoft = Color(0xFF33141E),
)
