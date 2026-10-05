package com.grana3d.mlpro.ui.questions

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Clear
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Send
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.grana3d.mlpro.core.formatDateTime
import com.grana3d.mlpro.core.mlViewModelFactory
import com.grana3d.mlpro.domain.Question
import com.grana3d.mlpro.ui.components.MlBadge
import com.grana3d.mlpro.ui.components.MlButton
import com.grana3d.mlpro.ui.components.MlButtonVariant
import com.grana3d.mlpro.ui.components.MlCard
import com.grana3d.mlpro.ui.components.MlEmptyState
import com.grana3d.mlpro.ui.components.MlErrorBanner
import com.grana3d.mlpro.ui.components.MlLoadingList
import com.grana3d.mlpro.ui.components.MlScaffold
import com.grana3d.mlpro.ui.components.MlTextField
import com.grana3d.mlpro.ui.components.MlTone
import com.grana3d.mlpro.ui.theme.MlTheme

/**
 * Preguntas de Mercado Libre: buscador, lista de sin responder y respuesta rápida.
 *
 * Cada tarjeta muestra la pregunta con su publicación y un botón "Responder" que abre
 * el campo inline; al enviar, el botón muestra loading y, si el backend acepta, la lista
 * se recarga y la pregunta respondida sale de la vista.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QuestionsScreen(onBack: () -> Unit) {
    val vm: QuestionsViewModel = viewModel(factory = mlViewModelFactory { QuestionsViewModel(it.repository) })
    val state by vm.state.collectAsStateWithLifecycle()
    val snackbarHostState = remember { SnackbarHostState() }

    val message = state.message
    LaunchedEffect(message) {
        val text = message ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(text)
        vm.consumeMessage()
    }

    val subtitle = when (val count = state.unansweredCount) {
        null -> "Preguntas de compradores"
        0 -> "Sin preguntas pendientes"
        1 -> "1 pregunta sin responder"
        else -> "$count preguntas sin responder"
    }

    MlScaffold(
        title = "Preguntas",
        subtitle = subtitle,
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
        if (state.isLoading && state.questions.isEmpty() && state.error == null) {
            MlLoadingList(items = 4, modifier = Modifier.fillMaxSize().padding(padding))
            return@MlScaffold
        }

        PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = vm::load,
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 32.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (state.error != null) {
                    item {
                        MlErrorBanner(
                            message = state.error ?: "No pudimos cargar las preguntas.",
                            onRetry = vm::load,
                            onDismiss = vm::dismissError,
                        )
                    }
                }

                item {
                    MlTextField(
                        value = state.query,
                        onValueChange = vm::setQuery,
                        label = "Buscar pregunta",
                        placeholder = "Texto, comprador o publicación",
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
                }

                if (state.visible.isEmpty()) {
                    item {
                        MlEmptyState(
                            icon = Icons.Outlined.ChatBubbleOutline,
                            title = if (state.query.isBlank()) {
                                "Sin preguntas pendientes"
                            } else {
                                "Sin coincidencias"
                            },
                            message = if (state.query.isBlank()) {
                                "Cuando un comprador pregunte en tus publicaciones lo vas a ver acá."
                            } else {
                                "Ninguna pregunta coincide con \"${state.query}\"."
                            },
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
                } else {
                    items(items = state.visible, key = { it.id }) { question ->
                        QuestionCard(
                            question = question,
                            isAnswering = state.answeringId == question.id,
                            sendEnabled = state.answeringId == null,
                            onAnswer = { text -> vm.answer(question.id, text) },
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun QuestionCard(
    question: Question,
    isAnswering: Boolean,
    sendEnabled: Boolean,
    onAnswer: (String) -> Unit,
) {
    val colors = MlTheme.colors
    var responding by remember(question.id) { mutableStateOf(false) }
    var draft by remember(question.id) { mutableStateOf("") }

    MlCard {
        Column {
            Row(verticalAlignment = Alignment.CenterVertically) {
                val buyer = question.buyer?.takeIf { it.isNotBlank() }
                if (buyer != null) {
                    MlBadge(text = buyer, tone = MlTone.Info, solid = true)
                    Spacer(Modifier.width(8.dp))
                }
                val fecha = formatDateTime(question.dateCreated)
                if (fecha.isNotBlank() && fecha != "—") {
                    Text(
                        text = fecha,
                        fontSize = 12.sp,
                        color = colors.inkSubtle,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
            Spacer(Modifier.height(8.dp))
            Text(
                text = question.text.ifBlank { "Pregunta sin texto" },
                fontSize = 15.sp,
                fontWeight = FontWeight.Bold,
                color = colors.ink,
            )
            val itemTitle = question.itemTitle?.takeIf { it.isNotBlank() }
            if (itemTitle != null) {
                Spacer(Modifier.height(4.dp))
                Text(
                    text = itemTitle,
                    fontSize = 13.sp,
                    color = colors.inkMuted,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }

            if (responding) {
                Spacer(Modifier.height(12.dp))
                MlTextField(
                    value = draft,
                    onValueChange = { draft = it },
                    label = "Tu respuesta",
                    placeholder = "Respondé al comprador…",
                    singleLine = false,
                )
                Spacer(Modifier.height(10.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    MlButton(
                        text = "Enviar respuesta",
                        // El campo queda abierto durante el envío: si el backend acepta, la
                        // recarga saca la pregunta de la lista; si falla, el borrador sigue.
                        onClick = { onAnswer(draft) },
                        variant = MlButtonVariant.Primary,
                        icon = Icons.Outlined.Send,
                        enabled = sendEnabled && draft.trim().isNotEmpty(),
                        loading = isAnswering,
                        modifier = Modifier.weight(1f),
                    )
                    MlButton(
                        text = "Cerrar",
                        onClick = { responding = false },
                        variant = MlButtonVariant.Ghost,
                        enabled = !isAnswering,
                    )
                }
            } else {
                Spacer(Modifier.height(12.dp))
                MlButton(
                    text = "Responder",
                    onClick = { responding = true },
                    variant = MlButtonVariant.Outline,
                    icon = Icons.Outlined.ChatBubbleOutline,
                    enabled = sendEnabled,
                    loading = isAnswering,
                    fillWidth = true,
                )
            }
        }
    }
}
