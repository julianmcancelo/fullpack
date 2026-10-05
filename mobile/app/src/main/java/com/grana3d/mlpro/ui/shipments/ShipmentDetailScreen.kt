package com.grana3d.mlpro.ui.shipments

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.grana3d.mlpro.core.formatArs
import com.grana3d.mlpro.core.formatDateTime
import com.grana3d.mlpro.core.mlViewModelFactory
import com.grana3d.mlpro.domain.Shipment
import com.grana3d.mlpro.ui.components.MlBadge
import com.grana3d.mlpro.ui.components.MlButton
import com.grana3d.mlpro.ui.components.MlButtonVariant
import com.grana3d.mlpro.ui.components.MlCard
import com.grana3d.mlpro.ui.components.MlDivider
import com.grana3d.mlpro.ui.components.MlEmptyState
import com.grana3d.mlpro.ui.components.MlErrorBanner
import com.grana3d.mlpro.ui.components.MlLoadingList
import com.grana3d.mlpro.ui.components.MlScaffold
import com.grana3d.mlpro.ui.components.MlSectionHeader
import com.grana3d.mlpro.ui.components.MlStatusPill
import com.grana3d.mlpro.ui.components.MlTextField
import com.grana3d.mlpro.ui.components.MlThumbnail
import com.grana3d.mlpro.ui.components.MlTone
import com.grana3d.mlpro.ui.theme.MlTheme

/**
 * Detalle completo de un paquete: datos del envío, checklist de empaque
 * (impreso, empaquetado, control de calidad, verificación de despacho), nota
 * interna editable y descarga de la etiqueta.
 */
@Composable
fun ShipmentDetailScreen(
    shipmentId: String,
    onBack: () -> Unit,
) {
    val vm: ShipmentDetailViewModel = viewModel(factory = mlViewModelFactory { ShipmentDetailViewModel(it.repository) })
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(shipmentId) {
        vm.load(shipmentId)
    }

    val message = state.message
    LaunchedEffect(message) {
        val text = message ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(text)
        vm.consumeMessage()
    }

    val openLabel: () -> Unit = {
        val url = vm.labelUrl()
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

    MlScaffold(
        title = "Paquete",
        subtitle = "Pedido #${state.shipment?.orderId ?: shipmentId}",
        onBack = onBack,
        actions = {
            MlButton(
                text = "Etiqueta",
                onClick = openLabel,
                variant = MlButtonVariant.Primary,
                icon = Icons.Outlined.Share,
                enabled = state.shipment != null,
            )
        },
        snackbarHostState = snackbarHostState,
    ) { padding ->
        val shipment = state.shipment

        if (state.isLoading) {
            MlLoadingList(items = 4, modifier = Modifier.fillMaxSize().padding(padding))
            return@MlScaffold
        }

        if (shipment == null) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(padding)
                    .padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (state.error != null) {
                    MlErrorBanner(
                        message = state.error ?: "No pudimos cargar el paquete.",
                        onRetry = { vm.load(shipmentId) },
                        onDismiss = vm::dismissError,
                    )
                } else {
                    MlEmptyState(
                        icon = Icons.Outlined.Info,
                        title = "Sin datos del paquete",
                        message = "No pudimos encontrar el paquete #$shipmentId en la cola de empaque.",
                        action = {
                            MlButton(
                                text = "Reintentar",
                                onClick = { vm.load(shipmentId) },
                                variant = MlButtonVariant.Outline,
                                icon = Icons.Outlined.Refresh,
                            )
                        },
                    )
                }
            }
            return@MlScaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 48.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                ShipmentDetailHeader(shipment = shipment, packed = state.packed)
            }

            item { MlSectionHeader(title = "Datos del envío") }
            item {
                MlCard {
                    ShipmentDetailDataRow(label = "Pedido", value = shipment.orderId ?: "—")
                    ShipmentDetailDataRow(label = "Estado", value = shipment.status ?: "—")
                    ShipmentDetailDataRow(label = "Subestado", value = shipment.substatus ?: "—")
                    ShipmentDetailDataRow(label = "Comprador", value = shipment.buyerName ?: "—")
                    ShipmentDetailDataRow(label = "Usuario ML", value = shipment.buyerNickname ?: "—")
                    ShipmentDetailDataRow(
                        label = "Destino",
                        value = listOfNotNull(
                            shipment.city?.takeIf { it.isNotBlank() },
                            shipment.state?.takeIf { it.isNotBlank() },
                        ).joinToString(", ").ifBlank { "—" },
                    )
                    ShipmentDetailDataRow(label = "Código postal", value = shipment.zipCode ?: "—")
                    ShipmentDetailDataRow(
                        label = "Seguimiento",
                        value = shipment.trackingNumber?.takeIf { it.isNotBlank() } ?: "Sin asignar",
                    )
                    ShipmentDetailDataRow(label = "Transportista", value = shipment.logisticLabel ?: "—")
                    ShipmentDetailDataRow(label = "Compra", value = formatDateTime(shipment.orderDate))
                    ShipmentDetailDataRow(
                        label = "Primera lectura",
                        value = formatDateTime(shipment.packing?.firstScannedAt),
                    )
                    ShipmentDetailDataRow(
                        label = "Última lectura",
                        value = formatDateTime(shipment.packing?.lastScannedAt),
                    )
                    ShipmentDetailDataRow(
                        label = "Lecturas",
                        value = "${shipment.packing?.scanCount?.toInt() ?: 0}",
                    )
                }
            }

            item {
                MlSectionHeader(
                    title = "Checklist de empaque",
                    subtitle = "Marcá cada paso a medida que lo completás",
                )
            }
            item {
                MlCard {
                    ShipmentDetailCheckRow(
                        title = "Etiqueta impresa",
                        subtitle = "La etiqueta ya salió por la impresora",
                        checked = state.printed,
                        enabled = !state.isBusy,
                        onCheckedChange = vm::setPrinted,
                    )
                    MlDivider()
                    ShipmentDetailCheckRow(
                        title = "Paquete empaquetado",
                        subtitle = "El producto está dentro y sellado",
                        checked = state.packed,
                        enabled = !state.isBusy,
                        onCheckedChange = vm::setPacked,
                    )
                    MlDivider()
                    ShipmentDetailCheckRow(
                        title = "Control de calidad",
                        subtitle = "El producto pasó la revisión",
                        checked = state.qualityChecked,
                        enabled = !state.isBusy,
                        onCheckedChange = vm::setQualityChecked,
                    )
                    MlDivider()
                    ShipmentDetailCheckRow(
                        title = "Verificación de despacho",
                        subtitle = "Sale con el transportista correcto",
                        checked = state.dispatchChecked,
                        enabled = state.packed && !state.isBusy,
                        onCheckedChange = vm::setDispatchChecked,
                    )
                }
            }

            item { MlSectionHeader(title = "Nota interna") }
            item {
                MlCard {
                    MlTextField(
                        value = state.note,
                        onValueChange = vm::onNoteChange,
                        label = "Nota del operario",
                        placeholder = "Ej.: falta cinta, revisar con el chofer",
                        singleLine = false,
                    )
                    Spacer(Modifier.height(10.dp))
                    MlButton(
                        text = "Guardar nota",
                        onClick = vm::saveNote,
                        variant = MlButtonVariant.Success,
                        icon = Icons.Outlined.CheckCircle,
                        enabled = !state.isSavingNote,
                        loading = state.isSavingNote,
                        fillWidth = true,
                    )
                }
            }

            item {
                MlButton(
                    text = "Abrir etiqueta PDF",
                    onClick = openLabel,
                    modifier = Modifier.fillMaxWidth().height(60.dp),
                    variant = MlButtonVariant.Primary,
                    icon = Icons.Outlined.Share,
                    fillWidth = true,
                )
            }
        }
    }
}

@Composable
private fun ShipmentDetailHeader(shipment: Shipment, packed: Boolean) {
    val colors = MlTheme.colors

    MlCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            MlThumbnail(url = shipment.itemThumbnail, size = 72.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = shipment.itemTitle ?: "Producto",
                    fontSize = 17.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.ink,
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "SKU ${shipment.itemSku ?: "—"} · ${shipment.quantity?.toInt() ?: 1} u.",
                    fontSize = 13.sp,
                    color = colors.inkMuted,
                )
                Spacer(Modifier.height(8.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    MlBadge(
                        text = shipment.logisticLabel ?: "CORREO",
                        tone = MlTone.Info,
                        solid = true,
                    )
                    MlStatusPill(
                        text = if (packed) "Empaquetado" else "Sin empaquetar",
                        tone = if (packed) MlTone.Success else MlTone.Warning,
                        dot = true,
                    )
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        MlDivider()
        Spacer(Modifier.height(12.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Importe",
                fontSize = 13.sp,
                color = colors.inkMuted,
                modifier = Modifier.weight(1f),
            )
            Text(
                text = formatArs(shipment.totalAmount?.toDouble() ?: 0.0),
                fontSize = 24.sp,
                fontWeight = FontWeight.ExtraBold,
                color = colors.ink,
            )
        }
    }
}

@Composable
private fun ShipmentDetailDataRow(label: String, value: String) {
    val colors = MlTheme.colors
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

@Composable
private fun ShipmentDetailCheckRow(
    title: String,
    subtitle: String,
    checked: Boolean,
    enabled: Boolean,
    onCheckedChange: (Boolean) -> Unit,
) {
    val colors = MlTheme.colors
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = colors.ink,
            )
            Spacer(Modifier.height(2.dp))
            Text(
                text = subtitle,
                fontSize = 12.sp,
                color = colors.inkMuted,
            )
        }
        Spacer(Modifier.width(12.dp))
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = enabled,
        )
    }
}
