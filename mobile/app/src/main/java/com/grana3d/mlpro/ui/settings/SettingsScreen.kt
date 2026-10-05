package com.grana3d.mlpro.ui.settings

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ExitToApp
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.grana3d.mlpro.core.Constants
import com.grana3d.mlpro.core.formatDateTime
import com.grana3d.mlpro.core.formatRelative
import com.grana3d.mlpro.core.mlViewModelFactory
import com.grana3d.mlpro.data.local.ThemeMode
import com.grana3d.mlpro.domain.UpdateCheck
import com.grana3d.mlpro.ui.components.MlBadge
import com.grana3d.mlpro.ui.components.MlButton
import com.grana3d.mlpro.ui.components.MlButtonVariant
import com.grana3d.mlpro.ui.components.MlCard
import com.grana3d.mlpro.ui.components.MlEmptyState
import com.grana3d.mlpro.ui.components.MlErrorBanner
import com.grana3d.mlpro.ui.components.MlLoadingList
import com.grana3d.mlpro.ui.components.MlScaffold
import com.grana3d.mlpro.ui.components.MlSectionHeader
import com.grana3d.mlpro.ui.components.MlStatusPill
import com.grana3d.mlpro.ui.components.MlThumbnail
import com.grana3d.mlpro.ui.components.MlTone
import com.grana3d.mlpro.ui.theme.MlTheme

private const val DEVCENTER_URL = "https://developers.mercadolibre.com.ar/devcenter"

/**
 * Ajustes: cuenta vinculada, dispositivo, conexión con Mercado Libre, URL del
 * servidor editable y desvinculación del dispositivo.
 */
@Composable
fun SettingsScreen(onUnlinked: () -> Unit) {
    val vm: SettingsViewModel = viewModel(factory = mlViewModelFactory { SettingsViewModel(it.repository, it.themeStore) })
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val colors = MlTheme.colors
    val snackbarHostState = remember { SnackbarHostState() }
    var showUnlinkDialog by remember { mutableStateOf(false) }

    val message = state.message
    LaunchedEffect(message) {
        val text = message ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(text)
        vm.consumeMessage()
    }

    LaunchedEffect(state.unlinked) {
        if (state.unlinked) onUnlinked()
    }

    if (showUnlinkDialog) {
        AlertDialog(
            onDismissRequest = { showUnlinkDialog = false },
            containerColor = colors.card,
            title = {
                Text(
                    text = "¿Desvincular este dispositivo?",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.ink,
                )
            },
            text = {
                Text(
                    text = "Este celular va a dejar de tener acceso a tu cuenta. Para volver a usarlo vas a necesitar un código QR nuevo generado desde la web.",
                    fontSize = 14.sp,
                    color = colors.inkMuted,
                )
            },
            confirmButton = {
                MlButton(
                    text = "Sí, desvincular",
                    onClick = {
                        showUnlinkDialog = false
                        vm.unlink()
                    },
                    variant = MlButtonVariant.Danger,
                    icon = Icons.Outlined.ExitToApp,
                    enabled = !state.isUnlinking,
                    loading = state.isUnlinking,
                )
            },
            dismissButton = {
                MlButton(
                    text = "Cancelar",
                    onClick = { showUnlinkDialog = false },
                    variant = MlButtonVariant.Ghost,
                )
            },
        )
    }

    MlScaffold(
        title = "Ajustes",
        subtitle = "Cuenta, dispositivo y apariencia",
        actions = {
            MlButton(
                text = "Actualizar",
                onClick = vm::load,
                variant = MlButtonVariant.Ghost,
                icon = Icons.Outlined.Refresh,
                loading = state.isLoading,
            )
        },
        snackbarHostState = snackbarHostState,
    ) { padding ->
        if (state.isLoading) {
            MlLoadingList(items = 4, modifier = Modifier.fillMaxSize().padding(padding))
            return@MlScaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 48.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (state.error != null) {
                item {
                    MlErrorBanner(
                        message = state.error ?: "No pudimos cargar la configuración.",
                        onRetry = vm::load,
                        onDismiss = vm::dismissError,
                    )
                }
            }

            if (!state.isLinked && state.account == null && !state.isLoading) {
                item {
                    MlEmptyState(
                        icon = Icons.Outlined.Info,
                        title = "Sin cuenta vinculada",
                        message = "Todavía no hay un dispositivo asociado a tu cuenta. Vinculá el celular con el QR de la web para ver los datos acá.",
                        action = {
                            MlButton(
                                text = "Reintentar",
                                onClick = vm::load,
                                variant = MlButtonVariant.Outline,
                                icon = Icons.Outlined.Refresh,
                            )
                        },
                    )
                }
            }

            item { MlSectionHeader(title = "Cuenta vinculada") }
            item {
                MlCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        MlThumbnail(
                            url = state.displayAvatar,
                            size = 64.dp,
                            fallbackIcon = Icons.Outlined.Person,
                        )
                        Spacer(Modifier.width(14.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = state.displayName,
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                color = colors.ink,
                                maxLines = 2,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Spacer(Modifier.height(2.dp))
                            Text(
                                text = state.displayEmail,
                                fontSize = 13.sp,
                                color = colors.inkMuted,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            Spacer(Modifier.height(8.dp))
                            MlBadge(
                                text = state.role.uppercase(),
                                tone = MlTone.Brand,
                                solid = true,
                            )
                        }
                    }
                }
            }

            item { MlSectionHeader(title = "Dispositivo") }
            item {
                MlCard {
                    SettingsRow(label = "Nombre", value = state.deviceName)
                    SettingsRow(
                        label = "Plataforma",
                        value = state.devicePlatform.replaceFirstChar { it.uppercase() },
                    )
                    SettingsRow(label = "Vinculado", value = if (state.isLinked) "Sí" else "No")
                    SettingsRow(label = "Vinculado desde", value = formatEpoch(state.linkedAt))
                    SettingsRow(label = "Último acceso", value = formatDateTime(state.deviceLastSeen))
                }
            }

            item { MlSectionHeader(title = "Conexión con Mercado Libre") }
            item {
                MlCard {
                    MlStatusPill(
                        text = if (state.isConnected) "Conectado" else "Desconectado",
                        tone = if (state.isConnected) MlTone.Success else MlTone.Danger,
                        dot = true,
                    )
                    Spacer(Modifier.height(10.dp))
                    Text(
                        text = state.connectionDetail,
                        fontSize = 13.sp,
                        color = colors.inkMuted,
                    )
                    Spacer(Modifier.height(6.dp))
                    SettingsRow(
                        label = "Usuario ML",
                        value = state.connection?.userId?.toString() ?: "—",
                    )
                    Spacer(Modifier.height(6.dp))
                    val lastSync = state.lastSyncLabel
                    if (lastSync.isNotBlank()) {
                        SettingsRow(label = "Última sincronización", value = formatDateTime(lastSync))
                        SettingsRow(label = "Frescura de los datos", value = formatRelative(lastSync))
                    } else {
                        SettingsRow(label = "Última sincronización", value = "Todavía sin sincronizar")
                    }
                }
            }

            item { MlSectionHeader(title = "Apariencia") }
            item {
                MlCard {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        ThemeModeOption(
                            text = "Sistema",
                            selected = state.themeMode == ThemeMode.SYSTEM,
                            onClick = { vm.setThemeMode(ThemeMode.SYSTEM) },
                            modifier = Modifier.weight(1f),
                        )
                        ThemeModeOption(
                            text = "Claro",
                            selected = state.themeMode == ThemeMode.LIGHT,
                            onClick = { vm.setThemeMode(ThemeMode.LIGHT) },
                            modifier = Modifier.weight(1f),
                        )
                        ThemeModeOption(
                            text = "Oscuro",
                            selected = state.themeMode == ThemeMode.DARK,
                            onClick = { vm.setThemeMode(ThemeMode.DARK) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "Se mantiene aunque desvincules el dispositivo.",
                        fontSize = 12.sp,
                        color = colors.inkSubtle,
                    )
                }
            }

            item { MlSectionHeader(title = "Desvincular dispositivo") }
            item {
                MlCard {
                    Text(
                        text = "Al desvincular, la app deja de operar con tu cuenta de Mercado Libre. Vas a necesitar un código QR nuevo desde la web de Fullpack.",
                        fontSize = 13.sp,
                        color = colors.inkMuted,
                    )
                    Spacer(Modifier.height(12.dp))
                    MlButton(
                        text = "Desvincular dispositivo",
                        onClick = { showUnlinkDialog = true },
                        variant = MlButtonVariant.Danger,
                        icon = Icons.Outlined.ExitToApp,
                        enabled = !state.isUnlinking,
                        loading = state.isUnlinking,
                        fillWidth = true,
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        MlBadge(text = "Token de dispositivo", tone = MlTone.Neutral)
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "La app nunca guarda credenciales de Mercado Libre.",
                            fontSize = 11.sp,
                            color = colors.inkSubtle,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            item { MlSectionHeader(title = "Acerca de") }
            item {
                MlCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(MlTheme.radius.control))
                                .background(colors.brand),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Inventory2,
                                contentDescription = "Logo de Fullpack",
                                tint = colors.brandInk,
                                modifier = Modifier.size(24.dp),
                            )
                        }
                        Spacer(Modifier.width(12.dp))
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "Fullpack",
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = (-0.4).sp,
                                color = colors.ink,
                            )
                            Spacer(Modifier.height(2.dp))
                            Text(
                                text = "Tu depósito de Mercado Libre en el bolsillo",
                                fontSize = 13.sp,
                                color = colors.inkMuted,
                            )
                        }
                    }
                    Spacer(Modifier.height(10.dp))
                    SettingsRow(label = "Versión de la app", value = Constants.APP_VERSION)
                    Spacer(Modifier.height(10.dp))
                    UpdateSection(
                        isChecking = state.isCheckingUpdates,
                        result = state.updateResult,
                        onCheck = vm::checkForUpdates,
                        onDownload = { url ->
                            val launched = runCatching {
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                            }
                            if (launched.isFailure) {
                                vm.reportMessage("No hay ninguna app para abrir el navegador.")
                            }
                        },
                    )
                    Spacer(Modifier.height(10.dp))
                    MlButton(
                        text = "Abrir DevCenter de Mercado Libre",
                        onClick = {
                            val launched = runCatching {
                                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(DEVCENTER_URL)))
                            }
                            if (launched.isFailure) {
                                vm.reportMessage("No hay ninguna app para abrir el navegador.")
                            }
                        },
                        variant = MlButtonVariant.Outline,
                        icon = Icons.Outlined.Share,
                        fillWidth = true,
                    )
                    Spacer(Modifier.height(8.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        MlBadge(text = "DevCenter", tone = MlTone.Info)
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = DEVCENTER_URL,
                            fontSize = 12.sp,
                            color = colors.inkMuted,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    Spacer(Modifier.height(10.dp))
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        MlBadge(text = "Soporte", tone = MlTone.Warning)
                        Spacer(Modifier.width(8.dp))
                        Text(
                            text = "Si un paquete no aparece en la cola, actualizá la pantalla o revisá la conexión con Mercado Libre.",
                            fontSize = 11.sp,
                            color = colors.inkSubtle,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }

            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    MlBadge(text = "Depósito", tone = MlTone.Neutral)
                    Spacer(Modifier.width(8.dp))
                    Text(
                        text = "Fullpack · gestor de Mercado Libre",
                        fontSize = 12.sp,
                        color = colors.inkSubtle,
                        textAlign = TextAlign.Start,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
    }
}

/**
 * Actualizaciones desde GitHub Releases: busca, informa y abre la descarga del APK.
 * Composable privado: no forma parte del contrato de pantallas.
 */
@Composable
private fun UpdateSection(
    isChecking: Boolean,
    result: UpdateCheck?,
    onCheck: () -> Unit,
    onDownload: (String) -> Unit,
) {
    val colors = MlTheme.colors
    Text(
        text = "Actualizaciones de la app",
        fontSize = 13.sp,
        fontWeight = FontWeight.Bold,
        color = colors.ink,
    )
    Spacer(Modifier.height(4.dp))
    when (result) {
        null -> Text(
            text = "Tocá para ver si hay una versión nueva publicada.",
            fontSize = 12.sp,
            color = colors.inkSubtle,
        )

        is UpdateCheck.Available -> {
            MlStatusPill(text = "Nueva versión ${result.versionName}", tone = MlTone.Brand, dot = true)
            Spacer(Modifier.height(6.dp))
            val notes = result.notes?.trim().orEmpty()
            if (notes.isNotBlank()) {
                Text(
                    text = notes.take(280),
                    fontSize = 12.sp,
                    color = colors.inkMuted,
                    maxLines = 4,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(6.dp))
            }
        }

        UpdateCheck.UpToDate -> Text(
            text = "Tenés la última versión instalada.",
            fontSize = 12.sp,
            color = colors.inkSubtle,
        )

        is UpdateCheck.Unavailable -> Text(
            text = result.message,
            fontSize = 12.sp,
            color = colors.warning,
        )
    }
    Spacer(Modifier.height(8.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        MlButton(
            text = if (isChecking) "Buscando…" else "Buscar actualizaciones",
            onClick = onCheck,
            variant = MlButtonVariant.Outline,
            icon = Icons.Outlined.Refresh,
            enabled = !isChecking,
            loading = isChecking,
            modifier = Modifier.weight(1f),
        )
        val available = result as? UpdateCheck.Available
        if (available != null) {
            MlButton(
                text = "Descargar",
                onClick = { onDownload(available.downloadUrl) },
                variant = MlButtonVariant.Primary,
                icon = Icons.Outlined.Share,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun ThemeModeOption(
    text: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    MlButton(
        text = text,
        onClick = onClick,
        modifier = modifier,
        variant = if (selected) MlButtonVariant.Primary else MlButtonVariant.Outline,
    )
}

@Composable
private fun SettingsRow(label: String, value: String) {    val colors = MlTheme.colors
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Text(
            text = label,
            fontSize = 13.sp,
            color = colors.inkMuted,
            modifier = Modifier.weight(1f),
        )
        Text(
            text = value,
            fontSize = 14.sp,
            fontWeight = FontWeight.Bold,
            color = colors.ink,
            textAlign = TextAlign.End,
        )
    }
}

/** Fecha de vinculación guardada como epoch en `SessionStore`. */
private fun formatEpoch(millis: Long?): String {
    if (millis == null || millis <= 0L) return "—"
    val format = java.text.SimpleDateFormat("dd MMM · HH:mm", java.util.Locale("es", "AR"))
    return format.format(java.util.Date(millis))
}
