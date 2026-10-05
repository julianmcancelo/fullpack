# ML Pro Suite — reglas ProGuard/R8 (la build release hoy no ofusca, pero las
# reglas quedan listas para cuando se active isMinifyEnabled).

# ---- Kotlinx Serialization ----
-keepattributes *Annotation*, InnerClasses, Signature, RuntimeVisibleAnnotations
-dontnote kotlinx.serialization.**
-keepclassmembers class **$$serializer {
    *;
}
-keep,includedescriptorclasses class com.grana3d.mlpro.**$$serializer {
    *;
}
-keepclasseswithmembers class com.grana3d.mlpro.** {
    kotlinx.serialization.KSerializer serializer(...);
}
# Los DTO se deserializan por reflexión de serializador generado.
-keep class com.grana3d.mlpro.data.remote.dto.** { *; }
-keep class com.grana3d.mlpro.domain.** { *; }

# ---- OkHttp / Okio ----
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**

# ---- ML Kit (barcode scanning) ----
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# ---- CameraX ----
-keep class androidx.camera.** { *; }
-dontwarn androidx.camera.**

# ---- Coil ----
-dontwarn coil.**
