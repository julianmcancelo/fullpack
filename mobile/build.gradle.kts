// Plugins raíz de ML Pro Suite (se aplican en :app).
// Versiones exactas del contrato §1: AGP 8.13.2 y Kotlin 2.2.20.
plugins {
    id("com.android.application") version "8.13.2" apply false
    id("org.jetbrains.kotlin.android") version "2.2.20" apply false
    // El compilador de Compose acompaña a la versión de Kotlin.
    id("org.jetbrains.kotlin.plugin.compose") version "2.2.20" apply false
    // La capa de datos usa @Serializable en los DTO.
    id("org.jetbrains.kotlin.plugin.serialization") version "2.2.20" apply false
}
