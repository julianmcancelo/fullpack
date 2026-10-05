package com.grana3d.mlpro.ui.home

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ArrowForward
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.List
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.ShoppingCart
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.Warning
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.grana3d.mlpro.core.formatArsCompact
import com.grana3d.mlpro.core.formatRelative
import com.grana3d.mlpro.core.mlViewModelFactory
import com.grana3d.mlpro.domain.LowStockItem
import com.grana3d.mlpro.domain.ScanLogEntry
import com.grana3d.mlpro.ui.components.MlButton
import com.grana3d.mlpro.ui.components.MlButtonVariant
import com.grana3d.mlpro.ui.components.MlCard
import com.grana3d.mlpro.ui.components.MlEmptyState
import com.grana3d.mlpro.ui.components.MlErrorBanner
import com.grana3d.mlpro.ui.components.MlKpiCard
import com.grana3d.mlpro.ui.components.MlLoadingList
import com.grana3d.mlpro.ui.components.MlScaffold
import com.grana3d.mlpro.ui.components.MlSectionHeader
import com.grana3d.mlpro.ui.components.MlStatusPill
import com.grana3d.mlpro.ui.components.MlThumbnail
import com.grana3d.mlpro.ui.components.MlTone
import com.grana3d.mlpro.ui.theme.MlTheme

/**
 * Pantalla de inicio: saludo, estado de la conexión con Mercado Libre, KPIs del
 * día, accesos grandes a Terminal / Envíos, stock crítico y últimos escaneos.
 */
@Composable
fun HomeScreen(
    onOpenTerminal: () -> Unit,
    onOpenShipments: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    val vm: HomeViewModel = viewModel(factory = mlViewModelFactory { HomeViewModel(it.repository) })
    val state by vm.state.collectAsStateWithLifecycle()

    MlScaffold(
        title = "ML Pro Suite",
        subtitle = "Panel de depósito",
        actions = {
            MlButton(
                text = "Ajustes",
                onClick = onOpenSettings,
                variant = MlButtonVariant.Ghost,
                icon = Icons.Outlined.Settings,
            )
        },
    ) { padding ->
        if (state.isLoading && state.summary == null && state.error == null) {
            MlLoadingList(items = 4, modifier = Modifier.fillMaxSize().padding(padding))
            return@MlScaffold
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 32.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            if (state.error != null) {
                item {
                    MlErrorBanner(
                        message = state.error ?: "No pudimos cargar el panel.",
                        onRetry = { vm.load() },
                        onDismiss = vm::dismissError,
                    )
                }
            }
            if (state.warnings.isNotEmpty()) {
                item {
                    MlErrorBanner(
                        message = state.warnings.joinToString(separator = " · "),
                        onRetry = { vm.load() },
                        onDismiss = vm::dismissWarnings,
                    )
                }
            }

            item { HomeGreetingCard(state = state) }
            item { HomeConnectionCard(state = state) }
            item { HomeKpiGrid(state = state) }

            item {
                HomeAccessCard(
                    title = "Terminal de empaque",
                    subtitle = "Escaneá paquetes, abrí etiquetas y marcá el empaque.",
                    callToAction = "Abrir terminal",
                    icon = Icons.Outlined.ShoppingCart,
                    onClick = onOpenTerminal,
                )
            }
            item {
                HomeAccessCard(
                    title = "Envíos",
                    subtitle = "Buscá paquetes, revisá el estado y descargá etiquetas.",
                    callToAction = "Ver envíos",
                    icon = Icons.Outlined.List,
                    onClick = onOpenShipments,
                )
            }

            item {
                MlSectionHeader(
                    title = "Stock crítico",
                    subtitle = if (state.lowStock.isEmpty()) {
                        "Todo en orden"
                    } else {
                        "${state.lowStock.size} publicaciones con stock bajo"
                    },
                )
            }
            if (state.lowStock.isEmpty()) {
                item {
                    MlEmptyState(
                        icon = Icons.Outlined.CheckCircle,
                        title = "Sin stock crítico",
                        message = "Todas tus publicaciones tienen stock suficiente.",
                    )
                }
            } else {
                items(items = state.lowStock.take(6)) { item ->
                    HomeStockRow(item = item)
                }
            }

            item {
                MlSectionHeader(
                    title = "Últimos escaneos",
                    subtitle = if (state.recentLogs.isEmpty()) {
                        "Sin actividad reciente"
                    } else {
                        "Los ${state.recentLogs.take(6).size} movimientos más recientes"
                    },
                )
            }
            if (state.recentLogs.isEmpty()) {
                item {
                    MlEmptyState(
                        icon = Icons.Outlined.Search,
                        title = "Sin escaneos todavía",
                        message = "Cuando escanees un paquete lo vas a ver acá.",
                    )
                }
            } else {
                items(items = state.recentLogs.take(6)) { log ->
                    HomeLogRow(log = log)
                }
            }

            item {
                MlButton(
                    text = "Actualizar panel",
                    onClick = { vm.load() },
                    variant = MlButtonVariant.Outline,
                    icon = Icons.Outlined.Refresh,
                    loading = state.isLoading,
                    fillWidth = true,
                )
            }

            item {
                MlButton(
                    text = "Ver todos los envíos",
                    onClick = onOpenShipments,
                    variant = MlButtonVariant.Outline,
                    icon = Icons.Outlined.List,
                    fillWidth = true,
                )
            }
        }
    }
}

@Composable
private fun HomeGreetingCard(state: HomeUiState) {
    val colors = MlTheme.colors
    MlCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            MlThumbnail(
                url = state.displayAvatar,
                size = 60.dp,
                fallbackIcon = Icons.Outlined.Person,
            )
            Spacer(Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = homeGreeting(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.08.em,
                    color = colors.inkSubtle,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = state.displayName,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.ExtraBold,
                    letterSpacing = (-0.4).sp,
                    color = colors.ink,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                if (state.displayEmail.isNotBlank()) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = state.displayEmail,
                        fontSize = 13.sp,
                        color = colors.inkMuted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
private fun HomeConnectionCard(state: HomeUiState) {
    val colors = MlTheme.colors
    MlCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            MlStatusPill(
                text = if (state.isConnected) "Mercado Libre conectado" else "Mercado Libre desconectado",
                tone = if (state.isConnected) MlTone.Success else MlTone.Danger,
                dot = true,
            )
            Spacer(Modifier.width(10.dp))
            Text(
                text = state.connectionDetail,
                fontSize = 12.sp,
                color = colors.inkMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun HomeKpiGrid(state: HomeUiState) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            MlKpiCard(
                label = "Por despachar",
                value = state.pendingCount.toString(),
                icon = Icons.Outlined.ShoppingCart,
                tone = MlTone.Warning,
                footline = "${state.unpackedCount} sin empaquetar",
                modifier = Modifier.weight(1f),
            )
            MlKpiCard(
                label = "Empaquetados",
                value = state.packedCount.toString(),
                icon = Icons.Outlined.CheckCircle,
                tone = MlTone.Success,
                footline = "Listos para despacho",
                modifier = Modifier.weight(1f),
            )
        }
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            MlKpiCard(
                label = "En tránsito",
                value = state.inTransitCount.toString(),
                icon = Icons.Outlined.Send,
                tone = MlTone.Info,
                footline = "${state.deliveredCount} entregados",
                modifier = Modifier.weight(1f),
            )
            MlKpiCard(
                label = "Ventas cobradas",
                value = formatArsCompact(state.totalSales),
                icon = Icons.Outlined.Star,
                tone = MlTone.Brand,
                footline = "${state.paidOrdersCount} órdenes cobradas",
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun HomeAccessCard(
    title: String,
    subtitle: String,
    callToAction: String,
    icon: ImageVector,
    onClick: () -> Unit,
) {
    val colors = MlTheme.colors
    MlCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(56.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(colors.brand),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = colors.brandInk,
                    modifier = Modifier.size(28.dp),
                )
            }
            Spacer(Modifier.width(14.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = title,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = (-0.4).sp,
                    color = colors.ink,
                )
                Spacer(Modifier.height(2.dp))
                Text(
                    text = subtitle,
                    fontSize = 13.sp,
                    color = colors.inkMuted,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = callToAction.uppercase(),
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    letterSpacing = 0.08.em,
                    color = colors.accent,
                )
            }
            Spacer(Modifier.width(8.dp))
            Icon(
                imageVector = Icons.Outlined.ArrowForward,
                contentDescription = null,
                tint = colors.inkSubtle,
            )
        }
    }
}

@Composable
private fun HomeStockRow(item: LowStockItem) {
    val colors = MlTheme.colors
    val quantity = item.availableQuantity?.toInt() ?: 0
    val quantityColor = when {
        quantity <= 0 -> colors.danger
        quantity <= LOW_STOCK_ALERT -> colors.warning
        else -> colors.success
    }
    val quantityLabel = if (quantity <= 0) "Sin stock" else "$quantity disponibles"

    MlCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            MlThumbnail(url = item.thumbnail, size = 48.dp)
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = item.title ?: "Publicación",
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.ink,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                val sku = item.sku
                if (!sku.isNullOrBlank()) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = "SKU $sku",
                        fontSize = 12.sp,
                        color = colors.inkSubtle,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Spacer(Modifier.width(10.dp))
            Text(
                text = quantityLabel,
                fontSize = 14.sp,
                fontWeight = FontWeight.ExtraBold,
                color = quantityColor,
            )
        }
    }
}

@Composable
private fun HomeLogRow(log: ScanLogEntry) {
    val colors = MlTheme.colors
    val action = log.action ?: ""
    val icon: ImageVector = when (action) {
        "FIRST_PACK_VERIFIED", "DISPATCH_VERIFIED" -> Icons.Outlined.CheckCircle
        "DUPLICATE_SCAN", "DISPATCH_DUPLICATE", "DISPATCH_CARRIER_MISMATCH" -> Icons.Outlined.Warning
        "NOT_FOUND" -> Icons.Outlined.Close
        else -> Icons.Outlined.Info
    }
    val iconColor: Color = when (action) {
        "FIRST_PACK_VERIFIED", "DISPATCH_VERIFIED" -> colors.success
        "DUPLICATE_SCAN", "DISPATCH_DUPLICATE" -> colors.warning
        "NOT_FOUND", "DISPATCH_CARRIER_MISMATCH" -> colors.danger
        else -> colors.inkSubtle
    }

    MlCard {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = iconColor,
                modifier = Modifier.size(22.dp),
            )
            Spacer(Modifier.width(12.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = homeLogLabel(action),
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = colors.ink,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                val barcode = log.barcode ?: ""
                if (barcode.isNotBlank()) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = barcode,
                        fontSize = 12.sp,
                        color = colors.inkSubtle,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Spacer(Modifier.width(10.dp))
            Text(
                text = formatRelative(log.createdAt),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold,
                color = colors.inkMuted,
            )
        }
    }
}

/** Cantidad a partir de la cual avisamos "stock bajo". */
private const val LOW_STOCK_ALERT = 3

private fun homeGreeting(): String {
    val hour = java.util.Calendar.getInstance().get(java.util.Calendar.HOUR_OF_DAY)
    return when {
        hour < 12 -> "BUENOS DÍAS"
        hour < 20 -> "BUENAS TARDES"
        else -> "BUENAS NOCHES"
    }
}

private fun homeLogLabel(action: String): String = when (action) {
    "FIRST_PACK_VERIFIED" -> "Paquete empaquetado"
    "DUPLICATE_SCAN" -> "Lectura repetida"
    "NOT_FOUND" -> "Código no encontrado"
    "DISPATCH_VERIFIED" -> "Salida a transporte"
    "DISPATCH_DUPLICATE" -> "Despacho ya verificado"
    "DISPATCH_CARRIER_MISMATCH" -> "Transportista incorrecto"
    else -> action.ifBlank { "Escaneo" }
}
