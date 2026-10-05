package com.grana3d.mlpro.ui.components

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.calculateEndPadding
import androidx.compose.foundation.layout.calculateStartPadding
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.SubcomposeAsyncImage
import com.grana3d.mlpro.R
import com.grana3d.mlpro.ui.theme.MlColors
import com.grana3d.mlpro.ui.theme.MlTheme
import kotlin.math.roundToInt

/**
 * Alto reservado por la barra inferior global (`ui/navigation/AppNav.kt`).
 * `MlScaffold` lo suma al padding del contenido para que la barra nunca tape la
 * última tarjeta de una lista.
 */
val LocalMlBottomInset = compositionLocalOf { 0.dp }

// ---------------------------------------------------------------------------
// Helpers de tono
// ---------------------------------------------------------------------------

/** Fondo suave por tono (badges, contenedores de iconos, KPIs). */
private fun MlColors.softFor(tone: MlTone): Color = when (tone) {
    MlTone.Neutral -> muted
    MlTone.Brand -> brandSoft
    MlTone.Success -> successSoft
    MlTone.Warning -> warningSoft
    MlTone.Danger -> dangerSoft
    MlTone.Info -> accentSoft
}

/** Texto/icono sobre el fondo suave. */
private fun MlColors.inkFor(tone: MlTone): Color = when (tone) {
    MlTone.Neutral -> inkMuted
    MlTone.Brand -> brandSoftInk
    MlTone.Success -> success
    MlTone.Warning -> warning
    MlTone.Danger -> danger
    MlTone.Info -> accent
}

/** Color pleno por tono (puntos de estado, badges sólidos). */
private fun MlColors.solidFor(tone: MlTone): Color = when (tone) {
    MlTone.Neutral -> inkMuted
    MlTone.Brand -> brand
    MlTone.Success -> success
    MlTone.Warning -> warning
    MlTone.Danger -> danger
    MlTone.Info -> accent
}

/** Texto sobre un color pleno (amarillo de marca siempre lleva tinta oscura). */
private fun MlColors.onSolidFor(tone: MlTone): Color = if (tone == MlTone.Brand) brandInk else Color.White

// ---------------------------------------------------------------------------
// Estructura
// ---------------------------------------------------------------------------

/**
 * Andamiaje de pantalla: barra superior propia + contenido.
 * Los insets se manejan de forma explícita (la Activity es edge-to-edge): la
 * barra superior suma el inset de la status bar y el contenido reserva el alto
 * de la barra inferior global.
 */
@Composable
fun MlScaffold(
    title: String,
    subtitle: String? = null,
    onBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
    bottomBar: @Composable () -> Unit = {},
    snackbarHostState: SnackbarHostState? = null,
    content: @Composable (PaddingValues) -> Unit,
) {
    Scaffold(
        containerColor = MlTheme.colors.app,
        contentWindowInsets = WindowInsets(0, 0, 0, 0),
        topBar = {
            MlTopBar(
                title = title,
                subtitle = subtitle,
                onBack = onBack,
                actions = actions,
            )
        },
        bottomBar = bottomBar,
        snackbarHost = {
            if (snackbarHostState != null) {
                SnackbarHost(hostState = snackbarHostState)
            }
        },
    ) { innerPadding ->
        val layoutDirection = LocalLayoutDirection.current
        val reservedBottom = LocalMlBottomInset.current
        content(
            PaddingValues(
                start = innerPadding.calculateStartPadding(layoutDirection),
                top = innerPadding.calculateTopPadding(),
                end = innerPadding.calculateEndPadding(layoutDirection),
                bottom = innerPadding.calculateBottomPadding() + reservedBottom,
            )
        )
    }
}

@Composable
private fun MlTopBar(
    title: String,
    subtitle: String?,
    onBack: (() -> Unit)?,
    actions: @Composable RowScope.() -> Unit,
) {
    val colors = MlTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(colors.app)
            .statusBarsPadding(),
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(
                    start = MlTheme.spacing.lg,
                    end = MlTheme.spacing.lg,
                    top = MlTheme.spacing.md,
                    bottom = MlTheme.spacing.md,
                ),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(MlTheme.spacing.sm),
        ) {
            if (onBack != null) {
                IconButton(
                    onClick = onBack,
                    modifier = Modifier.size(36.dp),
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Outlined.ArrowBack,
                        contentDescription = stringResource(R.string.action_back),
                        tint = colors.ink,
                        modifier = Modifier.size(22.dp),
                    )
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    style = MlTheme.type.display,
                    color = colors.ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                if (!subtitle.isNullOrBlank()) {
                    Text(
                        text = subtitle,
                        style = MlTheme.type.body,
                        color = colors.inkMuted,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(MlTheme.spacing.sm),
                content = actions,
            )
        }
        MlDivider()
    }
}

/**
 * Tarjeta base: borde `line`, esquina de 20 dp y sombra sutil.
 * Con [accent] toma el fondo amarillo suave de marca (destacados).
 */
@Composable
fun MlCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    accent: Boolean = false,
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = MlTheme.colors
    val shape = RoundedCornerShape(MlTheme.radius.card)
    val container = if (accent) colors.brandSoft else colors.card
    val stroke = if (accent) colors.brand else colors.line
    val base = modifier
        .shadow(
            elevation = 6.dp,
            shape = shape,
            clip = false,
            ambientColor = colors.ink.copy(alpha = 0.05f),
            spotColor = colors.ink.copy(alpha = 0.08f),
        )
        .clip(shape)
        .background(container, shape)
        .border(BorderStroke(1.dp, stroke), shape)
    Box(
        modifier = if (onClick != null) base.clickable { onClick() } else base,
    ) {
        Column(
            modifier = Modifier.padding(MlTheme.spacing.lg),
            content = content,
        )
    }
}

@Composable
fun MlSectionHeader(
    title: String,
    subtitle: String? = null,
    trailing: (@Composable () -> Unit)? = null,
) {
    val colors = MlTheme.colors
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = MlTheme.spacing.sm),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MlTheme.type.title,
                color = colors.ink,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (!subtitle.isNullOrBlank()) {
                Text(
                    text = subtitle,
                    style = MlTheme.type.body,
                    color = colors.inkMuted,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (trailing != null) {
            Spacer(Modifier.width(MlTheme.spacing.sm))
            trailing()
        }
    }
}

// ---------------------------------------------------------------------------
// Acciones
// ---------------------------------------------------------------------------

enum class MlButtonVariant { Primary, Accent, Outline, Ghost, Danger, Success }

/**
 * Botón de la app. El primario usa el degradado amarillo de marca
 * (`Brush.horizontalGradient(brand, brandStrong)`).
 */
@Composable
fun MlButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    variant: MlButtonVariant = MlButtonVariant.Primary,
    icon: ImageVector? = null,
    enabled: Boolean = true,
    loading: Boolean = false,
    fillWidth: Boolean = false,
) {
    val colors = MlTheme.colors
    val shape = RoundedCornerShape(MlTheme.radius.control)
    val active = enabled && !loading

    val labelColor = when (variant) {
        MlButtonVariant.Primary -> colors.brandInk
        MlButtonVariant.Accent, MlButtonVariant.Danger, MlButtonVariant.Success -> Color.White
        MlButtonVariant.Outline, MlButtonVariant.Ghost -> colors.ink
    }

    val container = modifier
        .then(if (fillWidth) Modifier.fillMaxWidth() else Modifier)
        .height(48.dp)
        .clip(shape)
        .then(
            when (variant) {
                MlButtonVariant.Primary -> Modifier.background(
                    brush = Brush.horizontalGradient(listOf(colors.brand, colors.brandStrong)),
                    shape = shape,
                )
                MlButtonVariant.Accent -> Modifier.background(colors.accent, shape)
                MlButtonVariant.Danger -> Modifier.background(colors.danger, shape)
                MlButtonVariant.Success -> Modifier.background(colors.success, shape)
                MlButtonVariant.Outline -> Modifier
                    .background(colors.card, shape)
                    .border(BorderStroke(1.dp, colors.lineStrong), shape)
                MlButtonVariant.Ghost -> Modifier.background(Color.Transparent, shape)
            }
        )
        .alpha(if (active) 1f else 0.45f)
        .clickable(enabled = active, onClick = onClick)
        .padding(horizontal = MlTheme.spacing.lg)

    Box(
        modifier = container,
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (loading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    color = labelColor,
                    strokeWidth = 2.dp,
                )
                Spacer(Modifier.width(MlTheme.spacing.sm))
            } else if (icon != null) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = labelColor,
                    modifier = Modifier.size(18.dp),
                )
                Spacer(Modifier.width(MlTheme.spacing.sm))
            }
            Text(
                text = text,
                style = MlTheme.type.title.copy(fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
                color = labelColor,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

/** Acción chica de texto (se usa en banners para no comer ancho). */
@Composable
private fun MlCompactAction(
    text: String,
    onClick: () -> Unit,
    color: Color,
) {
    Text(
        text = text,
        style = MlTheme.type.title.copy(fontSize = 14.sp),
        color = color,
        maxLines = 1,
        modifier = Modifier
            .clip(RoundedCornerShape(MlTheme.radius.control))
            .clickable(onClick = onClick)
            .padding(horizontal = MlTheme.spacing.sm, vertical = MlTheme.spacing.xs),
    )
}

// ---------------------------------------------------------------------------
// Estados y datos
// ---------------------------------------------------------------------------

enum class MlTone { Neutral, Brand, Success, Warning, Danger, Info }

/** Etiqueta tipo pill, suave por defecto y sólida con [solid]. */
@Composable
fun MlBadge(
    text: String,
    tone: MlTone = MlTone.Neutral,
    solid: Boolean = false,
) {
    val colors = MlTheme.colors
    val background = if (solid) colors.solidFor(tone) else colors.softFor(tone)
    val foreground = if (solid) colors.onSolidFor(tone) else colors.inkFor(tone)
    Text(
        text = text.uppercase(),
        style = MlTheme.type.label,
        color = foreground,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
        modifier = Modifier
            .clip(RoundedCornerShape(MlTheme.radius.pill))
            .background(background)
            .padding(horizontal = MlTheme.spacing.sm, vertical = 4.dp),
    )
}

/** Estado con puntito opcional (conexión, servidor, empaque). */
@Composable
fun MlStatusPill(
    text: String,
    tone: MlTone,
    dot: Boolean = false,
) {
    val colors = MlTheme.colors
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(MlTheme.radius.pill))
            .background(colors.softFor(tone))
            .padding(horizontal = MlTheme.spacing.sm, vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (dot) {
            Box(
                modifier = Modifier
                    .size(6.dp)
                    .clip(CircleShape)
                    .background(colors.solidFor(tone)),
            )
            Spacer(Modifier.width(6.dp))
        }
        Text(
            text = text.uppercase(),
            style = MlTheme.type.label,
            color = colors.inkFor(tone),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}

/** Indicador grande: icono en contenedor suave, etiqueta y valor tabular. */
@Composable
fun MlKpiCard(
    label: String,
    value: String,
    icon: ImageVector,
    tone: MlTone,
    footline: String? = null,
    modifier: Modifier = Modifier,
) {
    val colors = MlTheme.colors
    MlCard(modifier = modifier) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(38.dp)
                    .clip(RoundedCornerShape(MlTheme.radius.control))
                    .background(colors.softFor(tone)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = colors.inkFor(tone),
                    modifier = Modifier.size(20.dp),
                )
            }
            Spacer(Modifier.width(MlTheme.spacing.md))
            Text(
                text = label.uppercase(),
                style = MlTheme.type.label,
                color = colors.inkSubtle,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Spacer(Modifier.height(MlTheme.spacing.sm))
        Text(
            text = value,
            style = MlTheme.type.value,
            color = colors.ink,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
        if (!footline.isNullOrBlank()) {
            Spacer(Modifier.height(2.dp))
            Text(
                text = footline,
                style = MlTheme.type.body,
                color = colors.inkMuted,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

@Composable
fun MlTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: String? = null,
    placeholder: String? = null,
    keyboardType: KeyboardType = KeyboardType.Text,
    singleLine: Boolean = true,
    trailing: (@Composable () -> Unit)? = null,
) {
    val colors = MlTheme.colors
    val shape = RoundedCornerShape(MlTheme.radius.control)
    val labelSlot: (@Composable () -> Unit)? =
        if (label != null) { { Text(text = label, color = colors.inkMuted) } } else null
    val placeholderSlot: (@Composable () -> Unit)? =
        if (placeholder != null) { { Text(text = placeholder, color = colors.inkSubtle) } } else null
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier.fillMaxWidth(),
        singleLine = singleLine,
        label = labelSlot,
        placeholder = placeholderSlot,
        trailingIcon = trailing,
        textStyle = MlTheme.type.body,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = shape,
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = colors.ink,
            unfocusedTextColor = colors.ink,
            focusedContainerColor = colors.field,
            unfocusedContainerColor = colors.field,
            focusedBorderColor = colors.brandStrong,
            unfocusedBorderColor = colors.line,
            focusedLabelColor = colors.inkMuted,
            unfocusedLabelColor = colors.inkSubtle,
            cursorColor = colors.brandStrong,
        ),
    )
}

@Composable
fun MlEmptyState(
    icon: ImageVector,
    title: String,
    message: String,
    action: (@Composable () -> Unit)? = null,
) {
    val colors = MlTheme.colors
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(MlTheme.spacing.xl),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .background(colors.muted),
            contentAlignment = Alignment.Center,
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = colors.inkSubtle,
                modifier = Modifier.size(26.dp),
            )
        }
        Spacer(Modifier.height(MlTheme.spacing.md))
        Text(
            text = title,
            style = MlTheme.type.title,
            color = colors.ink,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(MlTheme.spacing.xs))
        Text(
            text = message,
            style = MlTheme.type.body,
            color = colors.inkMuted,
            textAlign = TextAlign.Center,
        )
        if (action != null) {
            Spacer(Modifier.height(MlTheme.spacing.lg))
            action()
        }
    }
}

@Composable
fun MlErrorBanner(
    message: String,
    onRetry: (() -> Unit)? = null,
    onDismiss: (() -> Unit)? = null,
) {
    val colors = MlTheme.colors
    val shape = RoundedCornerShape(MlTheme.radius.control)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(colors.dangerSoft)
            .border(BorderStroke(1.dp, colors.danger.copy(alpha = 0.35f)), shape)
            .padding(MlTheme.spacing.md),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            imageVector = Icons.Outlined.ErrorOutline,
            contentDescription = null,
            tint = colors.danger,
            modifier = Modifier.size(20.dp),
        )
        Spacer(Modifier.width(MlTheme.spacing.sm))
        Text(
            text = message,
            style = MlTheme.type.body,
            color = colors.danger,
            modifier = Modifier.weight(1f),
        )
        if (onRetry != null) {
            MlCompactAction(
                text = stringResource(R.string.action_retry),
                onClick = onRetry,
                color = colors.danger,
            )
        }
        if (onDismiss != null) {
            IconButton(
                onClick = onDismiss,
                modifier = Modifier.size(28.dp),
            ) {
                Icon(
                    imageVector = Icons.Outlined.Close,
                    contentDescription = stringResource(R.string.action_dismiss),
                    tint = colors.danger,
                    modifier = Modifier.size(16.dp),
                )
            }
        }
    }
}

/** Skeletons con brillo (shimmer) para listas mientras se cargan datos. */
@Composable
fun MlLoadingList(items: Int = 4, modifier: Modifier = Modifier) {
    val transition = rememberInfiniteTransition(label = "ml-skeleton")
    val progress by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "ml-shimmer",
    )
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(MlTheme.spacing.md),
    ) {
        repeat(items.coerceAtLeast(1)) { index ->
            // Pequeño desfase por tarjeta para que el brillo se sienta natural.
            MlSkeletonCard(shimmer = (progress + index * 0.15f) % 1f)
        }
    }
}

@Composable
private fun MlSkeletonCard(shimmer: Float) {
    val colors = MlTheme.colors
    val shape = RoundedCornerShape(MlTheme.radius.card)
    val brush = Brush.horizontalGradient(
        colors = listOf(colors.muted, colors.line, colors.muted),
        startX = -400f + shimmer * 1200f,
        endX = shimmer * 1200f,
    )
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(colors.card)
            .border(BorderStroke(1.dp, colors.line), shape)
            .padding(MlTheme.spacing.lg),
        verticalArrangement = Arrangement.spacedBy(MlTheme.spacing.md),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(0.55f)
                .height(14.dp)
                .clip(RoundedCornerShape(7.dp))
                .background(brush),
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(10.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(brush),
        )
        Box(
            modifier = Modifier
                .fillMaxWidth(0.78f)
                .height(10.dp)
                .clip(RoundedCornerShape(5.dp))
                .background(brush),
        )
    }
}

@Composable
fun MlProgressBar(progress: Float, label: String? = null) {
    val colors = MlTheme.colors
    val safeProgress = progress.coerceIn(0f, 1f)
    Column(modifier = Modifier.fillMaxWidth()) {
        if (!label.isNullOrBlank()) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = label.uppercase(),
                    style = MlTheme.type.label,
                    color = colors.inkMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "${(safeProgress * 100).roundToInt()}%",
                    style = MlTheme.type.label,
                    color = colors.ink,
                )
            }
            Spacer(Modifier.height(MlTheme.spacing.xs))
        }
        LinearProgressIndicator(
            progress = { safeProgress },
            modifier = Modifier
                .fillMaxWidth()
                .height(8.dp)
                .clip(RoundedCornerShape(MlTheme.radius.pill)),
            color = colors.brand,
            trackColor = colors.muted,
        )
    }
}

@Composable
fun MlDivider() {
    HorizontalDivider(
        modifier = Modifier.fillMaxWidth(),
        thickness = 1.dp,
        color = MlTheme.colors.line,
    )
}

/** Miniatura de producto con Coil; cae al icono de [fallbackIcon] si falla. */
@Composable
fun MlThumbnail(
    url: String?,
    size: Dp = 48.dp,
    modifier: Modifier = Modifier,
    fallbackIcon: ImageVector = Icons.Outlined.Inventory2,
) {
    val colors = MlTheme.colors
    val shape = RoundedCornerShape(MlTheme.radius.control)
    Box(
        modifier = modifier
            .size(size)
            .clip(shape)
            .background(colors.muted)
            .border(BorderStroke(1.dp, colors.line), shape),
        contentAlignment = Alignment.Center,
    ) {
        if (url.isNullOrBlank()) {
            MlThumbnailFallback(icon = fallbackIcon, size = size)
        } else {
            SubcomposeAsyncImage(
                model = url,
                contentDescription = null,
                modifier = Modifier.fillMaxSize(),
                contentScale = ContentScale.Crop,
                loading = { MlThumbnailPlaceholder() },
                error = { MlThumbnailFallback(icon = fallbackIcon, size = size) },
            )
        }
    }
}

@Composable
private fun MlThumbnailPlaceholder() {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MlTheme.colors.muted),
    )
}

@Composable
private fun MlThumbnailFallback(icon: ImageVector, size: Dp) {
    Icon(
        imageVector = icon,
        contentDescription = null,
        tint = MlTheme.colors.inkSubtle,
        modifier = Modifier.size(size * 0.5f),
    )
}
