package com.grana3d.mlpro.ui.questions

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.grana3d.mlpro.core.ApiResult
import com.grana3d.mlpro.core.Constants
import com.grana3d.mlpro.data.repository.MobileRepository
import com.grana3d.mlpro.domain.Question
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class QuestionsUiState(
    val isLoading: Boolean = true,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val message: String? = null,
    val query: String = "",
    val questions: List<Question> = emptyList(),
    /** Id de la pregunta que se está respondiendo (botón con loading). */
    val answeringId: String? = null,
    /** Cantidad sin responder según el backend (`unanswered_count`). */
    val unansweredCount: Int? = null,
) {
    /** Preguntas que pasan el buscador (texto, comprador o publicación). */
    val visible: List<Question>
        get() {
            val q = query.trim().lowercase()
            if (q.isEmpty()) return questions
            return questions.filter { question ->
                question.text.lowercase().contains(q) ||
                    (question.buyer?.lowercase()?.contains(q) == true) ||
                    (question.itemTitle?.lowercase()?.contains(q) == true)
            }
        }
}

/**
 * Preguntas de Mercado Libre: lista de sin responder y respuesta rápida inline.
 *
 * Tras responder con éxito se recarga la lista para que la pregunta respondida salga
 * de la vista (la tarjeta se desmonta con su borrador); si falla, el borrador queda
 * abierto y el error se muestra en el banner.
 */
class QuestionsViewModel(
    private val repository: MobileRepository,
) : ViewModel() {

    private val _state = MutableStateFlow(QuestionsUiState())
    val state: StateFlow<QuestionsUiState> = _state.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.update {
                it.copy(
                    isLoading = it.questions.isEmpty(),
                    isRefreshing = it.questions.isNotEmpty(),
                    error = null,
                )
            }
            when (val result = repository.listQuestions(Constants.QUESTIONS_STATUS_UNANSWERED)) {
                is ApiResult.Ok -> _state.update {
                    it.copy(
                        isLoading = false,
                        isRefreshing = false,
                        error = null,
                        questions = result.value,
                        unansweredCount = result.value.size,
                    )
                }

                is ApiResult.Err -> _state.update {
                    it.copy(isLoading = false, isRefreshing = false, error = result.message)
                }
            }
        }
    }

    fun setQuery(value: String) {
        _state.update { it.copy(query = value) }
    }

    /** Envía la respuesta; al confirmar, recarga la lista para sacar la pregunta vista. */
    fun answer(questionId: String, text: String) {
        if (_state.value.answeringId != null) return
        viewModelScope.launch {
            _state.update { it.copy(answeringId = questionId, error = null) }
            when (val result = repository.answerQuestion(questionId, text)) {
                is ApiResult.Ok -> {
                    _state.update { it.copy(answeringId = null, message = "Respuesta enviada al comprador.") }
                    load()
                }

                is ApiResult.Err -> _state.update {
                    it.copy(answeringId = null, error = result.message)
                }
            }
        }
    }

    fun consumeMessage() {
        _state.update { it.copy(message = null) }
    }

    fun dismissError() {
        _state.update { it.copy(error = null) }
    }
}
