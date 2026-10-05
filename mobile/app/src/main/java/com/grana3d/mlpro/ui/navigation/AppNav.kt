package com.grana3d.mlpro.ui.navigation

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.LocalShipping
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.grana3d.mlpro.core.mlViewModelFactory
import com.grana3d.mlpro.data.local.SessionState
import com.grana3d.mlpro.data.repository.MobileRepository
import com.grana3d.mlpro.ui.components.LocalMlBottomInset
import com.grana3d.mlpro.ui.home.HomeScreen
import com.grana3d.mlpro.ui.pairing.PairingScreen
import com.grana3d.mlpro.ui.questions.QuestionsScreen
import com.grana3d.mlpro.ui.settings.SettingsScreen
import com.grana3d.mlpro.ui.shipments.ShipmentDetailScreen
import com.grana3d.mlpro.ui.shipments.ShipmentsScreen
import com.grana3d.mlpro.ui.terminal.TerminalScreen
import com.grana3d.mlpro.ui.theme.MlTheme
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn

// Rutas del contrato (§5.bis).
private const val ROUTE_PAIRING = "pairing"
private const val ROUTE_HOME = "home"
private const val ROUTE_TERMINAL = "terminal"
private const val ROUTE_SHIPMENTS = "shipments"
private const val ARG_SHIPMENT_ID = "shipmentId"
private const val ROUTE_SHIPMENT_DETAIL = "shipments/{$ARG_SHIPMENT_ID}"
private const val ROUTE_SETTINGS = "settings"
private const val ROUTE_QUESTIONS = "questions"

/** Destinos de primer nivel válidos para el deep-link de notificaciones. */
private val TOP_LEVEL_ROUTES = setOf(
    ROUTE_HOME,
    ROUTE_TERMINAL,
    ROUTE_SHIPMENTS,
    ROUTE_SETTINGS,
    ROUTE_QUESTIONS,
)

/** Alto reservado por la barra inferior (sin contar el inset de navegación). */
private val BOTTOM_BAR_HEIGHT = 64.dp

/**
 * Grafo de navegación de ML Pro Suite.
 *
 * Decide el destino inicial según la sesión persistida (`pairing` si el
 * dispositivo no está vinculado, `home` si lo está) y reacciona cuando se
 * desvincula desde Ajustes. La barra inferior tiene los 4 destinos principales y
 * se oculta en `pairing`.
 *
 * @param onFinish se llama cuando termina el ciclo de vinculación (desvincular
 *   desde Ajustes); permite a quien hospeda la app cerrar el flujo.
 * @param startRoute ruta inicial pedida por quien hospeda (deep-link de las
 *   notificaciones: `"terminal"` o `"questions"`). Si no es válida o no hay sesión,
 *   se usa `home` / `pairing` como siempre.
 */
@Composable
fun AppNav(onFinish: () -> Unit = {}, startRoute: String = ROUTE_HOME) {
    val rootViewModel: RootViewModel = viewModel(
        factory = mlViewModelFactory { RootViewModel(it.repository) },
    )
    val session by rootViewModel.session.collectAsStateWithLifecycle()
    val navController = rememberNavController()

    // null mientras DataStore todavía no respondió: mostramos un arranque mínimo
    // para no parpadear entre pairing y home.
    var resolvedStart by remember { mutableStateOf<String?>(null) }
    // Deep-link ya consumido: evita renavegar en cada recomposición.
    var deepLinkConsumed by remember { mutableStateOf<String?>(null) }
    val currentRoute = navController.currentBackStackEntryAsState().value?.destination?.route

    LaunchedEffect(session?.isLinked) {
        val linked = session?.isLinked ?: return@LaunchedEffect

        // Primer destino: sólo se decide una vez.
        if (resolvedStart == null) {
            resolvedStart = if (linked) {
                startRoute.takeIf { it in TOP_LEVEL_ROUTES } ?: ROUTE_HOME
            } else {
                ROUTE_PAIRING
            }
            return@LaunchedEffect
        }

        // Después, se reencauza SÓLO si el estado de vinculación no coincide con la
        // pantalla que se está viendo. Antes se comparaba contra `home`, así que estar
        // en Terminal, Envíos o Ajustes con la sesión activa reseteaba el grafo y
        // devolvía al operario a Inicio (o a la pantalla de vinculación) sin motivo.
        val enPairing = currentRoute == null || currentRoute == ROUTE_PAIRING
        when {
            linked && enPairing -> navController.resetTo(ROUTE_HOME)
            !linked && !enPairing -> navController.resetTo(ROUTE_PAIRING)
        }
    }

    // Deep-link en caliente (notificación tocada con la app ya abierta): navega una vez.
    LaunchedEffect(resolvedStart, startRoute) {
        val ready = resolvedStart ?: return@LaunchedEffect
        if (ready == ROUTE_PAIRING) return@LaunchedEffect
        val target = startRoute.takeIf { it in TOP_LEVEL_ROUTES && it != ready } ?: return@LaunchedEffect
        if (deepLinkConsumed == target) return@LaunchedEffect
        deepLinkConsumed = target
        navController.goTopLevel(target)
    }

    val showBottomBar = resolvedStart != null && currentRoute != null && currentRoute != ROUTE_PAIRING
    val navigationBarsBottom = WindowInsets.navigationBars.asPaddingValues().calculateBottomPadding()
    val reservedBottom = if (showBottomBar) BOTTOM_BAR_HEIGHT + navigationBarsBottom else navigationBarsBottom

    CompositionLocalProvider(LocalMlBottomInset provides reservedBottom) {
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(MlTheme.colors.app),
        ) {
            val route = resolvedStart
            if (route == null) {
                AppSplash()
            } else {
                NavHost(
                    navController = navController,
                    startDestination = route,
                    modifier = Modifier.fillMaxSize(),
                ) {
                    composable(ROUTE_PAIRING) {
                        PairingScreen(onLinked = { navController.goTopLevel(ROUTE_HOME) })
                    }
                    composable(ROUTE_HOME) {
                        HomeScreen(
                            onOpenTerminal = { navController.goTopLevel(ROUTE_TERMINAL) },
                            onOpenShipments = { navController.goTopLevel(ROUTE_SHIPMENTS) },
                            onOpenSettings = { navController.goTopLevel(ROUTE_SETTINGS) },
                            onOpenQuestions = { navController.goTopLevel(ROUTE_QUESTIONS) },
                        )
                    }
                    composable(ROUTE_TERMINAL) {
                        TerminalScreen(
                            onBack = { navController.popBackStack() },
                            onOpenShipments = { navController.goTopLevel(ROUTE_SHIPMENTS) },
                        )
                    }
                    composable(ROUTE_QUESTIONS) {
                        QuestionsScreen(
                            onBack = { navController.popBackStack() },
                        )
                    }
                    composable(ROUTE_SHIPMENTS) {
                        ShipmentsScreen(
                            onBack = { navController.popBackStack() },
                            onOpenDetail = { shipmentId ->
                                navController.navigate("$ROUTE_SHIPMENTS/$shipmentId")
                            },
                        )
                    }
                    composable(ROUTE_SHIPMENT_DETAIL) { entry ->
                        ShipmentDetailScreen(
                            shipmentId = entry.arguments?.getString(ARG_SHIPMENT_ID).orEmpty(),
                            onBack = { navController.popBackStack() },
                        )
                    }
                    composable(ROUTE_SETTINGS) {
                        SettingsScreen(
                            onUnlinked = {
                                onFinish()
                                navController.resetTo(ROUTE_PAIRING)
                            },
                        )
                    }
                }
            }

            if (showBottomBar) {
                AppBottomBar(
                    currentRoute = currentRoute,
                    onSelect = { target -> navController.goTopLevel(target) },
                    modifier = Modifier.align(Alignment.BottomCenter),
                )
            }
        }
    }
}

/**
 * ViewModel raíz: sólo observa la sesión para decidir el destino inicial y
 * reaccionar a la desvinculación.
 */
private class RootViewModel(repository: MobileRepository) : ViewModel() {

    /** `null` mientras DataStore todavía no devolvió el estado guardado. */
    val session: StateFlow<SessionState?> = repository.sessionState
        .map<SessionState, SessionState?> { it }
        .stateIn(viewModelScope, SharingStarted.Eagerly, null)
}

/** Navega a un destino de primer nivel conservando el estado de cada pestaña. */
private fun NavHostController.goTopLevel(route: String) {
    navigate(route) {
        popUpTo(graph.findStartDestination().id) { saveState = true }
        launchSingleTop = true
        restoreState = true
    }
}

/** Reinicia la pila dejando [route] como único destino (vincular/desvincular). */
private fun NavHostController.resetTo(route: String) {
    navigate(route) {
        // Limpia TODO lo apilado: el destino inicial del grafo puede haber cambiado
        // entre vinculado y no vinculado, así que no alcanza con popUpTo del start.
        popUpTo(graph.id) { inclusive = false }
        launchSingleTop = true
    }
}

private data class BottomDestination(
    val route: String,
    val label: String,
    val icon: ImageVector,
)

private val bottomDestinations = listOf(
    BottomDestination(ROUTE_HOME, "Inicio", Icons.Outlined.Home),
    BottomDestination(ROUTE_TERMINAL, "Terminal", Icons.Outlined.QrCodeScanner),
    BottomDestination(ROUTE_SHIPMENTS, "Envíos", Icons.Outlined.LocalShipping),
    BottomDestination(ROUTE_SETTINGS, "Ajustes", Icons.Outlined.Settings),
)

/** Barra inferior de la app: 4 destinos, oculta en la vinculación. */
@Composable
private fun AppBottomBar(
    currentRoute: String?,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = MlTheme.colors
    val shape = RoundedCornerShape(topStart = MlTheme.radius.card, topEnd = MlTheme.radius.card)
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(shape)
            .background(colors.card)
            .border(BorderStroke(1.dp, colors.line), shape)
            .navigationBarsPadding()
            .padding(horizontal = MlTheme.spacing.sm, vertical = MlTheme.spacing.sm),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            bottomDestinations.forEach { destination ->
                val selected = currentRoute == destination.route
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(MlTheme.radius.control))
                        .clickable { if (!selected) onSelect(destination.route) }
                        .padding(vertical = MlTheme.spacing.sm),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(2.dp),
                ) {
                    Icon(
                        imageVector = destination.icon,
                        contentDescription = destination.label,
                        tint = if (selected) colors.brandSoftInk else colors.inkSubtle,
                        modifier = Modifier.size(22.dp),
                    )
                    Text(
                        text = destination.label,
                        style = MlTheme.type.label,
                        color = if (selected) colors.ink else colors.inkSubtle,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

/** Pantalla de arranque mínima mientras se lee la sesión persistida. */
@Composable
private fun AppSplash() {
    val colors = MlTheme.colors
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(colors.app),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(MlTheme.spacing.md),
        ) {
            Box(
                modifier = Modifier
                    .size(72.dp)
                    .clip(RoundedCornerShape(MlTheme.radius.card))
                    .background(colors.brand),
                contentAlignment = Alignment.Center,
            ) {
                Icon(
                    imageVector = Icons.Outlined.Inventory2,
                    contentDescription = null,
                    tint = colors.brandInk,
                    modifier = Modifier.size(36.dp),
                )
            }
            Text(
                text = "Fullpack",
                style = MlTheme.type.title,
                color = colors.ink,
            )
            CircularProgressIndicator(
                modifier = Modifier.size(20.dp),
                color = colors.brand,
                strokeWidth = 2.dp,
            )
        }
    }
}
