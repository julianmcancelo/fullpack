package com.grana3d.mlpro.ui.shipments

import android.content.Intent
import android.net.Uri
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowForward
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Clear
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Share
import androidx.compose.material3.Icon
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.grana3d.mlpro.core.formatArs
import com.grana3d.mlpro.core.mlViewModelFactory
import com.grana3d.mlpro.domain.Shipment
import com.grana3d.mlpro.ui.components.MlBadge
import com.grana3d.mlpro.ui.components.MlButton
import com.grana3d.mlpro.ui.components.MlButtonVariant
import com.grana3d.mlpro.ui.components.MlCard
import com.grana3d.mlpro.ui.components.MlEmptyState
import com.grana3d.mlpro.ui.components.MlErrorBanner
import com.grana3d.mlpro.ui.components.MlLoadingList
import com.grana3d.mlpro.ui.components.MlScaffold
import com.grana3d.mlpro.ui.components.MlStatusPill
import com.grana3d.mlpro.ui.components.MlTextField
import com.grana3d.mlpro.ui.components.MlThumbnail
import com.grana3d.mlpro.ui.components.MlTone
import com.grana3d.mlpro.ui.theme.MlTheme

/**
 * Lista de envíos con buscador, filtro segmentado (Todos / Sin empaquetar /
 * Empaquetados / En tránsito), tarjetas con estado y acciones rápidas.
 */
@Composable
fun ShipmentsScreen(
    onBack: () -> Unit,
    onOpenDetail: (String) -> Unit,
) {
    val vm: ShipmentsViewModel = viewModel(factory = mlViewModelFactory { ShipmentsViewModel(it.repository) })
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val snackbarHostState = remember { SnackbarHostState() }

    val message = state.message
    LaunchedEffect(message) {
        val text = message ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(text)
        vm.consumeMessage()
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

    MlScaffold(
        title = "Envíos",
        subtitle = "${state.visible.size} de ${state.shipments.size} paquetes",
        onBack = onBack,
        actions = {
            MlButton(
                text = "Actualizar",
                onClick = vm::load,
                variant = MlButtonVariant.Ghost,
                icon = Icons.Outlined.Refresh,
                loading = state.isRefreshing,
            )
        },
        snackbarHostState = snackbarHostState,
    ) { padding ->
        Column(modifier = Modifier.fillMaxSize().padding(padding)) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 4.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                MlTextField(
                    value = state.query,
                    onValueChange = vm::setQuery,
                    label = "Buscar paquete",
                    placeholder = "Pedido, comprador, SKU o ciudad",
                    trailing = {
                        if (state.query.isNotBlank()) {
                            MlButton(
                                text = "Limpiar",
                                onClick = { vm.setQuery("") },
                                variant = MlButtonVariant.Ghost,
                                icon = Icons.Outlined.Clear,
                            )
                        }
                    },
                )

                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    ShipmentsFilter.entries.forEach { filter ->
                        MlButton(
                            text = filter.label,
                            onClick = { vm.setFilter(filter) },
                            variant = if (state.filter == filter) {
                                MlButtonVariant.Primary
                            } else {
                                MlButtonVariant.Ghost
                            },
                        )
                    }
                }

                if (state.error != null) {
                    MlErrorBanner(
                        message = state.error ?: "No pudimos cargar los envíos.",
                        onRetry = vm::load,
                        onDismiss = vm::dismissError,
                    )
                }
            }

            when {
                state.isLoading -> {
                    MlLoadingList(items = 4, modifier = Modifier.fillMaxSize())
                }

                state.visible.isEmpty() -> {
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center,
                    ) {
                        MlEmptyState(
                            icon = Icons.Outlined.Search,
                            title = "Sin paquetes para mostrar",
                            message = state.emptyMessage,
                            action = {
                                MlButton(
                                    text = "Actualizar",
                                    onClick = vm::load,
                                    variant = MlButtonVariant.Outline,
                                    icon = Icons.Outlined.Refresh,
                                )
                            },
                        )
                    }
                }

                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 40.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        items(items = state.visible) { shipment ->
                            ShipmentListCard(
                                shipment = shipment,
                                isBusy = state.busyId == shipment.id,
                                onOpen = {
                                    val id = shipment.id ?: ""
                                    if (id.isNotBlank()) onOpenDetail(id)
                                },
                                onLabel = {
                                    val id = shipment.id ?: ""
                                    openLabel(id)
                                },
                                onTogglePacked = {
                                    val id = shipment.id ?: ""
                                    vm.markPacked(id, shipment.packing?.packed != true)
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ShipmentListCard(
    shipment: Shipment,
    isBusy: Boolean,
    onOpen: () -> Unit,
    onLabel: () -> Unit,
    onTogglePacked: () -> Unit,
) {
    val colors = MlTheme.colors
    val packing = shipment.packing
    val packed = packing?.packed == true
    val printed = packing?.printed == true
    val dispatchChecked = packing?.dispatchChecked == true

    MlCard(onClick = onOpen) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            MlThumbnail(url = shipment.itemThumbnail, size = 60.dp)
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
                    MlBadge(text = shipment.logisticLabel ?: "CORREO", tone = MlTone.Info)
                    MlStatusPill(
                        text = if (packed) "Empaquetado" else "Sin empaquetar",
                        tone = if (packed) MlTone.Success else MlTone.Warning,
                        dot = true,
                    )
                }
                if (printed || dispatchChecked) {
                    Spacer(Modifier.height(6.dp))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        if (printed) {
                            MlBadge(text = "Impreso", tone = MlTone.Neutral)
                        }
                        if (dispatchChecked) {
                            MlBadge(text = "Despacho OK", tone = MlTone.Success)
                        }
                    }
                }
            }
            Spacer(Modifier.width(10.dp))
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    text = formatArs(shipment.totalAmount?.toDouble() ?: 0.0),
                    fontSize = 15.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = colors.ink,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = "${shipment.quantity?.toInt() ?: 1} u.",
                    fontSize = 12.sp,
                    color = colors.inkSubtle,
                )
                Spacer(Modifier.height(6.dp))
                Icon(
                    imageVector = Icons.Outlined.ArrowForward,
                    contentDescription = null,
                    tint = colors.inkSubtle,
                    modifier = Modifier.size(18.dp),
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            MlButton(
                text = "Etiqueta PDF",
                onClick = onLabel,
                modifier = Modifier.weight(1f),
                variant = MlButtonVariant.Outline,
                icon = Icons.Outlined.Share,
                enabled = !isBusy,
            )
            MlButton(
                text = if (packed) "Desmarcar" else "Empaquetar",
                onClick = onTogglePacked,
                modifier = Modifier.weight(1f),
                variant = if (packed) MlButtonVariant.Outline else MlButtonVariant.Success,
                icon = if (packed) Icons.Outlined.Refresh else Icons.Outlined.CheckCircle,
                enabled = !isBusy,
                loading = isBusy,
            )
        }
        Spacer(Modifier.height(8.dp))
        Text(
            text = "Pedido #${shipment.orderId ?: "—"} · tocá la tarjeta para ver el detalle completo",
            fontSize = 11.sp,
            color = colors.inkSubtle,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }
}
