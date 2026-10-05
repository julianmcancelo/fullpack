package com.grana3d.mlpro.ui.terminal

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.List
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.SwipeToDismissBox
import androidx.compose.material3.SwipeToDismissBoxValue
import androidx.compose.material3.rememberSwipeToDismissBoxState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.grana3d.mlpro.core.formatArs
import com.grana3d.mlpro.core.formatDateTime
import com.grana3d.mlpro.core.mlViewModelFactory
import com.grana3d.mlpro.domain.ScanMode
import com.grana3d.mlpro.domain.Shipment
import com.grana3d.mlpro.ui.camera.QrScannerView
import com.grana3d.mlpro.ui.components.MlBadge
import com.grana3d.mlpro.ui.components.MlButton
import com.grana3d.mlpro.ui.components.MlButtonVariant
import com.grana3d.mlpro.ui.components.MlCard
import com.grana3d.mlpro.ui.components.MlDivider
import com.grana3d.mlpro.ui.components.MlEmptyState
import com.grana3d.mlpro.ui.components.MlErrorBanner
import com.grana3d.mlpro.ui.components.MlLoadingList
import com.grana3d.mlpro.ui.components.MlProgressBar
import com.grana3d.mlpro.ui.components.MlScaffold
import com.grana3d.mlpro.ui.components.MlSectionHeader
import com.grana3d.mlpro.ui.components.MlStatusPill
import com.grana3d.mlpro.ui.components.MlTextField
import com.grana3d.mlpro.ui.components.MlThumbnail
import com.grana3d.mlpro.ui.components.MlTone
import com.grana3d.mlpro.ui.theme.MlTheme
import com.grana3d.mlpro.util.Beep
import com.grana3d.mlpro.util.vibrateError
import com.grana3d.mlpro.util.vibrateSuccess
import com.grana3d.mlpro.util.vibrateTick

/**
 * Terminal de empaque. Es la pantalla que más se usa en el depósito, así que
 * todo está pensado para una mano, con guantes y con el celular lejos:
 * botón gigante de escaneo, resultado a pantalla completa con color + sonido +
 * vibración, y acciones grandes.
 */
@Composable
fun TerminalScreen(
    onBack: () -> Unit,
    onOpenShipments: () -> Unit,
) {
    val vm: TerminalViewModel = viewModel(factory = mlViewModelFactory { TerminalViewModel(it.repository) })
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    var hasCameraPermission by remember {
        mutableStateOf(
            context.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED,
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted ->
        hasCameraPermission = granted
        if (granted) vm.openScanner()
    }

    // Feedback imposible de ignorar: cada resultado suena y vibra una sola vez.
    val feedback = state.feedback
    LaunchedEffect(feedback?.seq) {
        val event = feedback ?: return@LaunchedEffect
        when (event.kind) {
            TerminalFeedbackKind.Success -> {
                Beep.success(context)
                context.vibrateSuccess()
            }

            TerminalFeedbackKind.Warning -> {
                Beep.error(context)
                context.vibrateError()
            }

            TerminalFeedbackKind.Error -> {
                Beep.error(context)
                context.vibrateError()
            }
        }
    }

    val message = state.message
    LaunchedEffect(message) {
        val text = message ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(text)
        vm.consumeMessage()
    }

    if (state.noteTarget != null) {
        NoteDialog(
            shipmentTitle = state.noteTarget?.itemTitle ?: "Paquete",
            draft = state.noteDraft,
            isBusy = state.isBusy,
            onDraftChange = vm::onNoteDraftChange,
            onConfirm = vm::saveNote,
            onDismiss = vm::closeNote,
        )
    }

    val openLabel: (String) -> Unit = { shipmentId ->
        val url = vm.labelUrl(shipmentId)
        if (url.isNullOrBlank()) {
            vm.reportMessage("No pudimos generar el enlace de la etiqueta.")
        } else {
            val launched = runCatching {
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            }
            if (launched.isFailure) {
                vm.reportMessage("No hay ninguna app instalada para abrir el PDF de la etiqueta.")
            }
        }
    }

    Box(modifier = Modifier.fillMaxSize()) {
        MlScaffold(
            title = "Terminal",
            subtitle = if (state.isDispatchMode) {
                "Despacho · salida a transporte"
            } else {
                "Empaque · preparación de paquetes"
            },
            onBack = onBack,
            actions = {
                MlButton(
                    text = "Envíos",
                    onClick = onOpenShipments,
                    variant = MlButtonVariant.Ghost,
                    icon = Icons.Outlined.List,
                )
            },
            snackbarHostState = snackbarHostState,
        ) { padding ->
            if (state.isLoading && state.queue.isEmpty() && state.error == null) {
                MlLoadingList(items = 4, modifier = Modifier.fillMaxSize().padding(padding))
                return@MlScaffold
            }

            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 40.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (state.error != null) {
                    item {
                        MlErrorBanner(
                            message = state.error ?: "No pudimos conectar con el servidor.",
                            onRetry = vm::load,
                            onDismiss = vm::dismissError,
                        )
                    }
                }

                item { TerminalProgressCard(state = state) }

                item {
                    TerminalModeSelector(
                        state = state,
                        onSelectMode = vm::setMode,
                        onSelectCarrier = vm::setCarrierFilter,
                        onToggleAutoPack = vm::setAutoPack,
                    )
                }

                item {
                    MlCard {
                        MlButton(
                            text = if (state.isBusy) "Procesando…" else "Escanear paquete",
                            onClick = {
                                if (hasCameraPermission) {
                                    context.vibrateTick()
                                    vm.openScanner()
                                } else {
                                    permissionLauncher.launch(Manifest.permission.CAMERA)
                                }
                            },
                            modifier = Modifier.fillMaxWidth().height(88.dp),
                            variant = MlButtonVariant.Accent,
                            icon = Icons.Outlined.Search,
                            enabled = !state.isBusy,
                            loading = state.isBusy,
                            fillWidth = true,
                        )
                        Spacer(Modifier.height(12.dp))
                        MlTextField(
                            value = state.manualCode,
                            onValueChange = vm::onManualCodeChange,
                            label = "Código manual",
                            placeholder = "Pedido, seguimiento o SKU",
                            trailing = {
                                MlButton(
                                    text = "Buscar",
                                    onClick = vm::submitManualCode,
                                    variant = MlButtonVariant.Success,
                                    enabled = state.manualCode.isNotBlank() && !state.isBusy,
                                )
                            },
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            text = if (state.isDispatchMode) {
                                "Despacho: confirmá la salida del paquete y que el transportista sea el correcto."
                            } else {
                                "Empaque: escaneá la etiqueta del paquete para marcarlo como empaquetado."
                            },
                            fontSize = 12.sp,
                            color = MlTheme.colors.inkSubtle,
                        )
                    }
                }

                val card = state.scanCard
                if (card != null) {
                    item(key = "scan-card") {
                        DismissibleScanCard(
                            card = card,
                            isBusy = state.isBusy,
                            onOpenLabel = openLabel,
                            onMarkPacked = { shipmentId -> vm.markPacked(shipmentId, true) },
                            onUnmarkPacked = { shipmentId -> vm.markPacked(shipmentId, false) },
                            onVerifyDispatch = { shipmentId -> vm.markDispatchChecked(shipmentId, true) },
                            onOpenNote = { shipment -> vm.openNote(shipment) },
                            onDismiss = vm::dismissScanCard,
                        )
                    }
                }

                item {
                    MlSectionHeader(
                        title = "Cola de paquetes",
                        subtitle = if (state.queue.isEmpty()) {
                            "Sin pendientes"
                        } else {
                            "${state.queue.size} pendientes de empaque"
                        },
                        trailing = {
                            MlButton(
                                text = "Actualizar",
                                onClick = vm::refresh,
                                variant = MlButtonVariant.Ghost,
                                icon = Icons.Outlined.Refresh,
                                loading = state.isRefreshing,
                            )
                        },
                    )
                }

                if (state.queue.isEmpty()) {
                    item {
                        MlEmptyState(
                            icon = Icons.Outlined.CheckCircle,
                            title = "Cola vacía",
                            message = "No hay paquetes pendientes de empaque. ¡Buen trabajo!",
                            action = {
                                MlButton(
                                    text = "Actualizar",
                                    onClick = vm::refresh,
                                    variant = MlButtonVariant.Outline,
                                    icon = Icons.Outlined.Refresh,
                                )
                            },
                        )
                    }
                } else {
                    items(items = state.queue) { shipment ->
                        TerminalQueueCard(shipment = shipment)
                    }
                }
            }
        }

        if (state.isScannerOpen) {
            TerminalScannerOverlay(
                isActive = state.isScannerOpen,
                hasCameraPermission = hasCameraPermission,
                onRequestPermission = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                onOpenAppSettings = {
                    val intent = Intent(
                        Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.fromParts("package", context.packageName, null),
                    )
                    try {
                        context.startActivity(intent)
                    } catch (error: Exception) {
                        vm.reportMessage("No pudimos abrir los ajustes de la app.")
                    }
                },
                onClose = vm::closeScanner,
                onQrDetected = vm::onQrDetected,
            )
        }
    }
}

@Composable
private fun TerminalProgressCard(state: TerminalUiState) {
    val colors = MlTheme.colors
    val allPacked = state.pendingCount == 0 && state.totalCount > 0

    MlCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "PROGRESO DE EMPAQUE",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.08.em,
                    color = colors.inkSubtle,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "${state.packedCount} / ${state.totalCount}",
                    fontSize = 26.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.4).sp,
                    color = colors.ink,
                )
                Text(
                    text = "paquetes empaquetados",
                    fontSize = 13.sp,
                    color = colors.inkMuted,
                )
            }
            Spacer(Modifier.width(10.dp))
            MlStatusPill(
                text = if (allPacked) "Todo empaquetado" else "Faltan ${state.pendingCount}",
                tone = if (allPacked) MlTone.Success else MlTone.Warning,
                dot = true,
            )
        }
        Spacer(Modifier.height(12.dp))
        MlProgressBar(
            progress = state.progress,
            label = "paquetes empaquetados hoy",
        )
    }
}

@Composable
private fun TerminalModeSelector(
    state: TerminalUiState,
    onSelectMode: (ScanMode) -> Unit,
    onSelectCarrier: (String) -> Unit,
    onToggleAutoPack: (Boolean) -> Unit,
) {
    MlCard {
        Text(
            text = "MODO DE TRABAJO",
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            letterSpacing = 0.08.em,
            color = MlTheme.colors.inkSubtle,
        )
        Spacer(Modifier.height(8.dp))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            MlButton(
                text = "Empaque",
                onClick = { onSelectMode(ScanMode.PACK) },
                modifier = Modifier.weight(1f).height(52.dp),
                variant = if (state.isDispatchMode) MlButtonVariant.Outline else MlButtonVariant.Primary,
                icon = Icons.Outlined.CheckCircle,
            )
            MlButton(
                text = "Despacho",
                onClick = { onSelectMode(ScanMode.DISPATCH) },
                modifier = Modifier.weight(1f).height(52.dp),
                variant = if (state.isDispatchMode) MlButtonVariant.Accent else MlButtonVariant.Outline,
                icon = Icons.Outlined.Send,
            )
        }

        if (state.isDispatchMode) {
            Spacer(Modifier.height(12.dp))
            Text(
                text = "TRANSPORTISTA A CARGAR",
                fontSize = 11.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 0.08.em,
                color = MlTheme.colors.inkSubtle,
            )
            Spacer(Modifier.height(8.dp))
            Row(
                modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                val selected = state.carrierFilter
                MlButton(
                    text = "Todos",
                    onClick = { onSelectCarrier(CARRIER_ALL) },
                    variant = if (selected == CARRIER_ALL) MlButtonVariant.Primary else MlButtonVariant.Ghost,
                )
                MlButton(
                    text = "FLEX",
                    onClick = { onSelectCarrier(CARRIER_FLEX) },
                    variant = if (selected == CARRIER_FLEX) MlButtonVariant.Primary else MlButtonVariant.Ghost,
                )
                MlButton(
                    text = "COLECTA",
                    onClick = { onSelectCarrier(CARRIER_COLECTA) },
                    variant = if (selected == CARRIER_COLECTA) MlButtonVariant.Primary else MlButtonVariant.Ghost,
                )
                MlButton(
                    text = "CORREO",
                    onClick = { onSelectCarrier(CARRIER_CORREO) },
                    variant = if (selected == CARRIER_CORREO) MlButtonVariant.Primary else MlButtonVariant.Ghost,
                )
            }
            Spacer(Modifier.height(8.dp))
            Text(
                text = "El sistema rechaza los paquetes que no sean de este transportista.",
                fontSize = 12.sp,
                color = MlTheme.colors.inkMuted,
            )
        }

        // Control explícito del empaque automático: nada cambia sin que el operario lo sepa.
        if (!state.isDispatchMode) {
            Spacer(Modifier.height(14.dp))
            MlDivider()
            Spacer(Modifier.height(10.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Empaquetar al escanear",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = MlTheme.colors.ink,
                    )
                    Text(
                        text = if (state.autoPack) {
                            "Escaneás y el paquete queda empaquetado."
                        } else {
                            "Escaneás y sólo se identifica el paquete."
                        },
                        fontSize = 12.sp,
                        color = MlTheme.colors.inkMuted,
                    )
                }
                Spacer(Modifier.width(12.dp))
                Switch(
                    checked = state.autoPack,
                    onCheckedChange = onToggleAutoPack,
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = MlTheme.colors.brandInk,
                        checkedTrackColor = MlTheme.colors.brand,
                    ),
                )
            }
        }
    }
}

/**
 * Resultado de escaneo descartable con una mano: se cierra con el botón visible
 * "Cerrar resultado" o deslizando la tarjeta hacia cualquier costado.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DismissibleScanCard(
    card: ScanCardUi,
    isBusy: Boolean,
    onOpenLabel: (String) -> Unit,
    onMarkPacked: (String) -> Unit,
    onUnmarkPacked: (String) -> Unit,
    onVerifyDispatch: (String) -> Unit,
    onOpenNote: (Shipment) -> Unit,
    onDismiss: () -> Unit,
) {
    val swipeState = rememberSwipeToDismissBoxState()

    // Cada tarjeta nueva vuelve a su posición: el estado de swipe no se hereda.
    LaunchedEffect(card) {
        swipeState.reset()
    }
    // El gesto confirma el descarte: avisa al ViewModel una sola vez.
    LaunchedEffect(swipeState.currentValue) {
        if (swipeState.currentValue != SwipeToDismissBoxValue.Settled) {
            onDismiss()
        }
    }

    SwipeToDismissBox(
        state = swipeState,
        backgroundContent = {},
        enableDismissFromStartToEnd = true,
        enableDismissFromEndToStart = true,
    ) {
        TerminalScanCard(
            card = card,
            isBusy = isBusy,
            onOpenLabel = onOpenLabel,
            onMarkPacked = onMarkPacked,
            onUnmarkPacked = onUnmarkPacked,
            onVerifyDispatch = onVerifyDispatch,
            onOpenNote = onOpenNote,
            onDismiss = onDismiss,
        )
    }
}

@Composable
private fun TerminalScanCard(
    card: ScanCardUi,
    isBusy: Boolean,
    onOpenLabel: (String) -> Unit,
    onMarkPacked: (String) -> Unit,
    onUnmarkPacked: (String) -> Unit,
    onVerifyDispatch: (String) -> Unit,
    onOpenNote: (Shipment) -> Unit,
    onDismiss: () -> Unit,
) {
    val colors = MlTheme.colors
    val container = when (card.kind) {
        ScanCardKind.Packed -> colors.successSoft
        ScanCardKind.Identified -> colors.accentSoft
        ScanCardKind.AlreadyPacked, ScanCardKind.Duplicate, ScanCardKind.Ambiguous -> colors.warningSoft
        ScanCardKind.CarrierMismatch, ScanCardKind.NotFound, ScanCardKind.Error -> colors.dangerSoft
    }
    val accent = when (card.kind) {
        ScanCardKind.Packed -> colors.success
        ScanCardKind.Identified -> colors.accent
        ScanCardKind.AlreadyPacked, ScanCardKind.Duplicate, ScanCardKind.Ambiguous -> colors.warning
        ScanCardKind.CarrierMismatch, ScanCardKind.NotFound, ScanCardKind.Error -> colors.danger
    }
    val icon: ImageVector = when (card.kind) {
        ScanCardKind.Packed -> Icons.Outlined.CheckCircle
        ScanCardKind.Identified -> Icons.Outlined.Search
        ScanCardKind.AlreadyPacked -> Icons.Outlined.Warning
        ScanCardKind.Duplicate -> Icons.Outlined.Info
        ScanCardKind.Ambiguous -> Icons.Outlined.Warning
        ScanCardKind.CarrierMismatch -> Icons.Outlined.Send
        ScanCardKind.NotFound -> Icons.Outlined.Search
        ScanCardKind.Error -> Icons.Outlined.Info
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(container)
            .border(width = 3.dp, color = accent, shape = RoundedCornerShape(20.dp))
            .padding(16.dp),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = accent,
                    modifier = Modifier.size(38.dp),
                )
                Spacer(Modifier.width(12.dp))
                Text(
                    text = card.headline.uppercase(),
                    fontSize = 22.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.4).sp,
                    color = colors.ink,
                    modifier = Modifier.weight(1f),
                )
            }

            if (card.message.isNotBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = card.message,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.ink,
                )
            }

            // Qué se leyó y con qué campo del envío coincidió: sin esto, el operario no
            // puede entender por qué apareció un paquete y no otro.
            val leido = card.readCode?.takeIf { it.isNotBlank() }
            if (leido != null) {
                Spacer(Modifier.height(10.dp))
                Text(
                    text = "Leído: $leido",
                    fontSize = 12.sp,
                    fontFamily = FontFamily.Monospace,
                    color = colors.inkMuted,
                )
            }
            if (leido == null && card.code != null && card.shipment == null) {
                Spacer(Modifier.height(8.dp))
                Text(
                    text = "Código leído: ${card.code ?: ""}",
                    fontSize = 14.sp,
                    color = colors.inkMuted,
                )
            }
            card.matchedBy?.let { campo ->
                Text(
                    text = "Coincide con ${etiquetaDeCampo(campo)}",
                    fontSize = 12.sp,
                    color = colors.inkMuted,
                )
            }

            // Sólo tiene sentido mostrar el acumulado cuando hubo más de una lectura.
            if (card.scanCount > 1) {
                Spacer(Modifier.height(6.dp))
                Text(
                    text = "Escaneos acumulados de este paquete: ${card.scanCount}",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.inkMuted,
                )
            }

            val shipment = card.shipment
            if (shipment != null) {
                Spacer(Modifier.height(12.dp))
                MlDivider()
                Spacer(Modifier.height(12.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    MlThumbnail(url = shipment.itemThumbnail, size = 64.dp)
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = shipment.itemTitle ?: "Producto",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold,
                            color = colors.ink,
                            maxLines = 2,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Spacer(Modifier.height(6.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            MlBadge(
                                text = shipment.logisticLabel ?: "CORREO",
                                tone = MlTone.Info,
                                solid = true,
                            )
                            MlStatusPill(
                                text = if (card.packed) "Empaquetado" else "Sin empaquetar",
                                tone = if (card.packed) MlTone.Success else MlTone.Warning,
                                dot = true,
                            )
                        }
                    }
                }

                Spacer(Modifier.height(12.dp))
                TerminalDataRow(label = "Pedido", value = shipment.orderId ?: "—")
                TerminalDataRow(label = "Comprador", value = shipment.buyerName ?: "Comprador")
                TerminalDataRow(
                    label = "Destino",
                    value = listOfNotNull(
                        shipment.city?.takeIf { it.isNotBlank() },
                        shipment.state?.takeIf { it.isNotBlank() },
                    ).joinToString(", ").ifBlank { "—" },
                )
                TerminalDataRow(label = "Publicación", value = shipment.itemTitle ?: "—")
                TerminalDataRow(label = "SKU", value = shipment.itemSku?.takeIf { it.isNotBlank() } ?: "—")
                TerminalDataRow(label = "Cantidad", value = "${shipment.quantity?.toInt() ?: 1}")
                TerminalDataRow(label = "Importe", value = formatArs(shipment.totalAmount?.toDouble() ?: 0.0))
                TerminalDataRow(
                    label = "Seguimiento",
                    value = shipment.trackingNumber?.takeIf { it.isNotBlank() } ?: "Sin asignar",
                )
                TerminalDataRow(label = "Compra", value = formatDateTime(shipment.orderDate))
                TerminalDataRow(
                    label = "Checklist",
                    value = buildString {
                        append(if (card.printed) "Impreso" else "Sin imprimir")
                        append(" · ")
                        append(if (card.packed) "Empaquetado" else "Sin empaquetar")
                        append(" · ")
                        append(if (card.qualityChecked) "Controlado" else "Sin control")
                        append(" · ")
                        append(if (card.dispatchChecked) "Despacho OK" else "Sin despacho")
                    },
                )
                if (card.expectedCarrier != null || card.actualCarrier != null) {
                    TerminalDataRow(
                        label = "Transportista",
                        value = "Este paquete es de ${card.actualCarrier ?: "—"} y estás cargando ${card.expectedCarrier ?: "—"}.",
                    )
                }

                Spacer(Modifier.height(14.dp))
                val id = shipment.id ?: ""
                MlButton(
                    text = "Abrir etiqueta PDF",
                    onClick = { onOpenLabel(id) },
                    modifier = Modifier.fillMaxWidth().height(60.dp),
                    variant = MlButtonVariant.Primary,
                    icon = Icons.Outlined.Share,
                    enabled = !isBusy,
                    fillWidth = true,
                )
                Spacer(Modifier.height(8.dp))
                if (!card.packed) {
                    MlButton(
                        text = "Marcar empaquetado",
                        onClick = { onMarkPacked(id) },
                        modifier = Modifier.fillMaxWidth().height(64.dp),
                        variant = MlButtonVariant.Success,
                        icon = Icons.Outlined.CheckCircle,
                        enabled = !isBusy,
                        fillWidth = true,
                    )
                } else {
                    MlButton(
                        text = "Devolver a pendientes",
                        onClick = { onUnmarkPacked(id) },
                        modifier = Modifier.fillMaxWidth().height(56.dp),
                        variant = MlButtonVariant.Outline,
                        icon = Icons.Outlined.Refresh,
                        enabled = !isBusy,
                        fillWidth = true,
                    )
                }
                Spacer(Modifier.height(8.dp))
                MlButton(
                    text = if (card.dispatchChecked) "Despacho ya verificado" else "Verificación de despacho",
                    onClick = { onVerifyDispatch(id) },
                    modifier = Modifier.fillMaxWidth().height(64.dp),
                    variant = MlButtonVariant.Accent,
                    icon = Icons.Outlined.Send,
                    enabled = !isBusy && !card.dispatchChecked,
                    fillWidth = true,
                )
                Spacer(Modifier.height(8.dp))
                MlButton(
                    text = "Nota",
                    onClick = { onOpenNote(shipment) },
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    variant = MlButtonVariant.Outline,
                    icon = Icons.Outlined.Edit,
                    enabled = !isBusy,
                    fillWidth = true,
                )
            }

            Spacer(Modifier.height(10.dp))
            MlButton(
                text = "Cerrar resultado",
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth(),
                variant = MlButtonVariant.Ghost,
                icon = Icons.Outlined.Close,
                fillWidth = true,
            )
        }
    }
}

@Composable
private fun TerminalDataRow(label: String, value: String) {
    val colors = MlTheme.colors
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
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

@Composable
private fun TerminalQueueCard(shipment: Shipment) {
    val colors = MlTheme.colors
    val packed = shipment.packing?.packed == true
    val printed = shipment.packing?.printed == true

    MlCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            MlThumbnail(url = shipment.itemThumbnail, size = 56.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = shipment.itemTitle ?: "Producto",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.ink,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = buildString {
                        append(shipment.buyerName ?: "Comprador")
                        val city = shipment.city ?: ""
                        if (city.isNotBlank()) {
                            append(" · ")
                            append(city)
                        }
                    },
                    fontSize = 13.sp,
                    color = colors.inkMuted,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    MlBadge(
                        text = shipment.logisticLabel ?: "CORREO",
                        tone = MlTone.Info,
                    )
                    MlStatusPill(
                        text = if (packed) "Empaquetado" else "Sin empaquetar",
                        tone = if (packed) MlTone.Success else MlTone.Warning,
                        dot = true,
                    )
                    if (printed) {
                        MlBadge(text = "Impreso", tone = MlTone.Neutral)
                    }
                }
            }
        }
    }
}

@Composable
private fun TerminalScannerOverlay(
    isActive: Boolean,
    hasCameraPermission: Boolean,
    onRequestPermission: () -> Unit,
    onOpenAppSettings: () -> Unit,
    onClose: () -> Unit,
    onQrDetected: (String) -> Unit,
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.Black),
    ) {
        if (hasCameraPermission) {
            QrScannerView(
                modifier = Modifier.fillMaxSize(),
                isActive = isActive,
                onQrDetected = onQrDetected,
            )
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(20.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Escanear paquete",
                        fontSize = 22.sp,
                        fontWeight = FontWeight.ExtraBold,
                        letterSpacing = (-0.4).sp,
                        color = Color.White,
                    )
                    Text(
                        text = "Apuntá al código de barras o QR de la etiqueta",
                        fontSize = 13.sp,
                        color = Color.White.copy(alpha = 0.75f),
                    )
                }
                Spacer(Modifier.width(12.dp))
                MlButton(
                    text = "Cerrar",
                    onClick = onClose,
                    variant = MlButtonVariant.Danger,
                    icon = Icons.Outlined.Close,
                )
            }

            Spacer(Modifier.weight(1f))

            if (!hasCameraPermission) {
                MlCard {
                    Text(
                        text = "Necesitamos la cámara",
                        fontSize = 17.sp,
                        fontWeight = FontWeight.Bold,
                        color = MlTheme.colors.ink,
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = "Sin permiso de cámara no podemos leer las etiquetas. Podés habilitarlo desde los ajustes del sistema.",
                        fontSize = 13.sp,
                        color = MlTheme.colors.inkMuted,
                    )
                    Spacer(Modifier.height(12.dp))
                    MlButton(
                        text = "Conceder permiso",
                        onClick = onRequestPermission,
                        variant = MlButtonVariant.Primary,
                        fillWidth = true,
                    )
                    Spacer(Modifier.height(8.dp))
                    MlButton(
                        text = "Abrir ajustes de la app",
                        onClick = onOpenAppSettings,
                        variant = MlButtonVariant.Outline,
                        fillWidth = true,
                    )
                }
                Spacer(Modifier.height(16.dp))
            }

            Text(
                text = "Al detectar el código cerramos la cámara y mostramos el resultado con color, sonido y vibración.",
                fontSize = 12.sp,
                color = Color.White.copy(alpha = 0.7f),
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun NoteDialog(
    shipmentTitle: String,
    draft: String,
    isBusy: Boolean,
    onDraftChange: (String) -> Unit,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = MlTheme.colors.card,
        title = {
            Text(
                text = "Nota interna",
                fontSize = 17.sp,
                fontWeight = FontWeight.Bold,
                color = MlTheme.colors.ink,
            )
        },
        text = {
            Column {
                Text(
                    text = shipmentTitle,
                    fontSize = 13.sp,
                    color = MlTheme.colors.inkMuted,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(10.dp))
                MlTextField(
                    value = draft,
                    onValueChange = onDraftChange,
                    label = "Nota del operario",
                    placeholder = "Ej.: falta cinta, etiqueta dañada, revisar con el chofer",
                    singleLine = false,
                )
            }
        },
        confirmButton = {
            MlButton(
                text = "Guardar nota",
                onClick = onConfirm,
                variant = MlButtonVariant.Success,
                enabled = !isBusy,
                loading = isBusy,
                icon = Icons.Outlined.CheckCircle,
            )
        },
        dismissButton = {
            MlButton(
                text = "Cancelar",
                onClick = onDismiss,
                variant = MlButtonVariant.Ghost,
            )
        },
    )
}
