package com.grana3d.mlpro.ui.camera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.NoPhotography
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.grana3d.mlpro.core.Constants
import com.grana3d.mlpro.ui.theme.MlTheme
import kotlinx.coroutines.suspendCancellableCoroutine
import java.util.concurrent.Executors
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Vista de escaneo con CameraX + ML Kit.
 *
 * Detecta **cualquier** formato de código (QR de vinculación y también los códigos de
 * barras de los paquetes: Code128, EAN, ITF, PDF417…), así sirve tanto para vincular el
 * celular como para la terminal de empaque. Quien la usa decide si el texto le sirve.
 *
 * Reglas de vida útil:
 * - sólo analiza mientras [isActive] sea `true` (nunca queda la cámara prendida de fondo);
 * - libera el analizador, el ejecutor y el cliente de ML Kit al salir de la composición;
 * - ignora repeticiones del mismo código durante [Constants.SCAN_THROTTLE_MS].
 */
@Composable
fun QrScannerView(
    modifier: Modifier = Modifier,
    isActive: Boolean = true,
    onQrDetected: (String) -> Unit,
) {
    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    val hasPermission = remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted -> hasPermission.value = granted }

    LaunchedEffect(Unit) {
        if (!hasPermission.value) permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    // Una sola vez por composición: analizador, ejecutor y cliente de ML Kit.
    val analysisExecutor = remember { Executors.newSingleThreadExecutor() }
    val scanner = remember { BarcodeScanning.getClient() }

    val providerState = remember { mutableStateOf<ProcessCameraProvider?>(null) }
    val previewViewState = remember { mutableStateOf<PreviewView?>(null) }
    val previewUseCase = remember { Preview.Builder().build() }
    val analysisUseCase = remember {
        ImageAnalysis.Builder()
            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
            .build()
    }

    // El callback más reciente, sin recompilar ni re-vincular la cámara.
    val currentOnDetected by rememberUpdatedState(onQrDetected)
    val lastCode = remember { mutableStateOf<String?>(null) }
    val lastAt = remember { mutableLongStateOf(0L) }
    val lastAnyAt = remember { mutableLongStateOf(0L) }

    // Cada vez que el consumidor abre el escáner, la respuesta vuelve a ser inmediata.
    LaunchedEffect(isActive) {
        if (isActive) {
            lastCode.value = null
            lastAt.value = 0L
            lastAnyAt.value = 0L
        }
    }

    var cameraError by remember { mutableStateOf<String?>(null) }

    // El analizador se registra una sola vez.
    DisposableEffect(Unit) {
        analysisUseCase.setAnalyzer(analysisExecutor) { proxy: ImageProxy ->
            val mediaImage = proxy.image
            if (mediaImage == null) {
                proxy.close()
                return@setAnalyzer
            }
            val image = InputImage.fromMediaImage(mediaImage, proxy.imageInfo.rotationDegrees)
            scanner.process(image)
                .addOnSuccessListener { barcodes ->
                    val value = barcodes.firstNotNullOfOrNull { it.rawValue?.takeIf(String::isNotBlank) }
                    if (value != null) {
                        val now = System.currentTimeMillis()
                        val mismoCodigoSeguido = value == lastCode.value &&
                            now - lastAt.value < Constants.SCAN_THROTTLE_MS
                        // Enfriamiento global: una etiqueta con QR + código de barras
                        // entrega dos valores distintos casi al mismo tiempo.
                        val enEnfriamiento = now - lastAnyAt.value < Constants.SCAN_COOLDOWN_MS

                        if (!mismoCodigoSeguido && !enEnfriamiento) {
                            lastCode.value = value
                            lastAt.value = now
                            lastAnyAt.value = now
                            currentOnDetected(value)
                        }
                    }
                }
                .addOnCompleteListener { proxy.close() }
        }

        onDispose {
            runCatching { analysisUseCase.clearAnalyzer() }
            runCatching { providerState.value?.unbindAll() }
            runCatching { scanner.close() }
            analysisExecutor.shutdown()
        }
    }

    // Vincular / desvincular según permiso y actividad.
    LaunchedEffect(hasPermission.value, isActive) {
        if (!hasPermission.value || !isActive) {
            runCatching { providerState.value?.unbindAll() }
            return@LaunchedEffect
        }

        val previewView = previewViewState.value
        if (previewView == null) return@LaunchedEffect

        try {
            val provider = providerState.value ?: context.cameraProvider().also { providerState.value = it }
            previewUseCase.surfaceProvider = previewView.surfaceProvider
            provider.unbindAll()
            provider.bindToLifecycle(
                lifecycleOwner,
                CameraSelector.DEFAULT_BACK_CAMERA,
                previewUseCase,
                analysisUseCase,
            )
            cameraError = null
        } catch (t: Throwable) {
            cameraError = t.message ?: "No se pudo abrir la cámara."
        }
    }

    Box(modifier = modifier) {
        if (hasPermission.value) {
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    PreviewView(ctx).apply {
                        scaleType = PreviewView.ScaleType.FILL_CENTER
                        // COMPATIBLE funciona también en emuladores sin GPU dedicada.
                        implementationMode = PreviewView.ImplementationMode.COMPATIBLE
                        previewViewState.value = this
                        // Dispara la vinculación apenas exista la superficie.
                        previewUseCase.surfaceProvider = surfaceProvider
                    }
                },
            )
        } else {
            CameraPermissionNotice(
                onRequest = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                modifier = Modifier.fillMaxSize(),
            )
        }

        cameraError?.let { message ->
            Text(
                text = message,
                color = MlTheme.colors.danger,
                style = MlTheme.type.body,
                textAlign = TextAlign.Center,
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .padding(MlTheme.spacing.lg),
            )
        }
    }
}

@Composable
private fun CameraPermissionNotice(onRequest: () -> Unit, modifier: Modifier = Modifier) {
    Box(
        modifier = modifier.background(MlTheme.colors.app),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            modifier = Modifier.padding(MlTheme.spacing.xxl),
        ) {
            Icon(
                imageVector = Icons.Outlined.NoPhotography,
                contentDescription = null,
                tint = MlTheme.colors.inkSubtle,
                modifier = Modifier.size(48.dp),
            )
            Text(
                text = "Necesitamos la cámara para escanear",
                style = MlTheme.type.title,
                color = MlTheme.colors.ink,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = MlTheme.spacing.md),
            )
            Text(
                text = "Habilitá el permiso de cámara para vincular el celular y escanear paquetes. " +
                    "También podés ingresar el código a mano.",
                style = MlTheme.type.body,
                color = MlTheme.colors.inkMuted,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = MlTheme.spacing.sm),
            )
            com.grana3d.mlpro.ui.components.MlButton(
                text = "Permitir cámara",
                onClick = onRequest,
                modifier = Modifier.padding(top = MlTheme.spacing.lg),
            )
        }
    }
}

/** Envuelve `ProcessCameraProvider.getInstance` en una corrutina. */
private suspend fun Context.cameraProvider(): ProcessCameraProvider =
    suspendCancellableCoroutine { continuation ->
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener(
            {
                try {
                    continuation.resume(future.get())
                } catch (t: Throwable) {
                    continuation.resumeWithException(t)
                }
            },
            ContextCompat.getMainExecutor(this),
        )
    }
