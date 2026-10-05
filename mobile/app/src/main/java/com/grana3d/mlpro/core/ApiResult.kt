package com.grana3d.mlpro.core

/**
 * Resultado de una operación que puede fallar (llamadas HTTP, parseo, etc.).
 *
 * Regla de oro de la capa de datos: **ninguna** función lanza excepciones hacia la UI.
 * Todo error se traduce a [ApiResult.Err] con un mensaje en español listo para mostrar
 * al operario.
 *
 * [Err] extiende `ApiResult<Nothing>`: como la interfaz es covariante (`out T`), un error
 * sirve para cualquier `ApiResult<X>` sin perder el tipo del caso exitoso.
 */
sealed interface ApiResult<out T> {

    /** Operación exitosa. */
    data class Ok<T>(val value: T) : ApiResult<T>

    /** Operación fallida: [message] siempre es legible por una persona. */
    data class Err(
        val message: String,
        val code: String? = null,
        val httpStatus: Int? = null,
    ) : ApiResult<Nothing>
}

/** Valor exitoso o `null` si hubo error. */
fun <T> ApiResult<T>.valueOrNull(): T? = (this as? ApiResult.Ok)?.value

/** Mensaje de error o `null` si salió todo bien. */
fun <T> ApiResult<T>.errorOrNull(): String? = (this as? ApiResult.Err)?.message

/** `true` sólo si la operación terminó bien. */
val <T> ApiResult<T>.isOk: Boolean
    get() = this is ApiResult.Ok

/** `true` sólo si la operación falló. */
val <T> ApiResult<T>.isErr: Boolean
    get() = this is ApiResult.Err

/** Código de error del backend (`device_not_linked`, `expired_code`, …) o `null`. */
fun <T> ApiResult<T>.errorCode(): String? = (this as? ApiResult.Err)?.code

/** Transforma el valor exitoso conservando el error tal cual. */
inline fun <T, R> ApiResult<T>.map(transform: (T) -> R): ApiResult<R> = when (this) {
    is ApiResult.Ok -> ApiResult.Ok(transform(value))
    is ApiResult.Err -> ApiResult.Err(message, code, httpStatus)
}

/** Encadena otra operación que también devuelve [ApiResult]. */
inline fun <T, R> ApiResult<T>.flatMap(transform: (T) -> ApiResult<R>): ApiResult<R> = when (this) {
    is ApiResult.Ok -> transform(value)
    is ApiResult.Err -> ApiResult.Err(message, code, httpStatus)
}

/** Ejecuta [block] con el valor exitoso; si hubo error no hace nada. */
inline fun <T> ApiResult<T>.onOk(block: (T) -> Unit): ApiResult<T> {
    if (this is ApiResult.Ok) block(value)
    return this
}

/** Ejecuta [block] con el error; si salió bien no hace nada. */
inline fun <T> ApiResult<T>.onErr(block: (ApiResult.Err) -> Unit): ApiResult<T> {
    if (this is ApiResult.Err) block(this)
    return this
}
