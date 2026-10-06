package com.grana3d.mlpro.ui.pairing

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.NoPhotography
import androidx.compose.material.icons.outlined.QrCodeScanner
import androidx.compose.material.icons.outlined.ShoppingBag
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.grana3d.mlpro.core.Constants
import com.grana3d.mlpro.core.mlViewModelFactory
import com.grana3d.mlpro.ui.camera.QrScannerView
import com.grana3d.mlpro.ui.components.MlBadge
import com.grana3d.mlpro.ui.components.MlButton
import com.grana3d.mlpro.ui.components.MlButtonVariant
import com.grana3d.mlpro.ui.components.MlCard
import com.grana3d.mlpro.ui.components.MlDivider
import com.grana3d.mlpro.ui.components.MlEmptyState
import com.grana3d.mlpro.ui.components.MlErrorBanner
import com.grana3d.mlpro.ui.components.MlTextField
import com.grana3d.mlpro.ui.components.MlTone
import com.grana3d.mlpro.ui.theme.MlTheme
import com.grana3d.mlpro.util.Beep
import com.grana3d.mlpro.util.vibrateSuccess

/**
 * Pantalla de vinculación: es lo primero que ve el operario cuando el celular todavía no
 * está asociado a ninguna cuenta.
 *
 * Cámara a pantalla completa con un marco de escaneo; abajo, una tarjeta con la URL del
 * servidor (para apuntar a un backend propio), el ingreso manual del código y los pasos.
 */
@Composable
fun PairingScreen(onLinked: () -> Unit) {
    val viewModel: PairingViewModel = viewModel(
        factory = mlViewModelFactory { PairingViewModel(it.repository) },
    )
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current

    var hasCameraPermission by remember {
        mutableStateOf(
            context.checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED,
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
    ) { granted -> hasCameraPermission = granted }

    fun openAppSettings() {
        val intent = Intent(
            Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
            Uri.fromParts("package", context.packageName, null),
        )
        runCatching { context.startActivity(intent) }
    }

    LaunchedEffect(state.linked) {
        if (state.linked) {
            context.vibrateSuccess()
            Beep.success(context)
            onLinked()
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MlTheme.colors.app),
    ) {
        QrScannerView(
            modifier = Modifier.fillMaxSize(),
            isActive = !state.linked && !state.manualEntryVisible,
            onQrDetected = viewModel::claim,
        )

        // Velos superior e inferior: dan contraste a los textos sobre el video.
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(240.dp)
                .align(Alignment.TopCenter)
                .background(
                    Brush.verticalGradient(
                        listOf(
                            MlTheme.colors.app.copy(alpha = 0.96f),
                            MlTheme.colors.app.copy(alpha = 0f),
                        ),
                    ),
                ),
        )
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(360.dp)
                .align(Alignment.BottomCenter)
                .background(
                    Brush.verticalGradient(
                        listOf(
                            MlTheme.colors.app.copy(alpha = 0f),
                            MlTheme.colors.app.copy(alpha = 0.92f),
                            MlTheme.colors.app,
                        ),
                    ),
                ),
        )

        ScannerFrame(
            modifier = Modifier
                .align(Alignment.Center)
                // Sube el marco para que las cuatro esquinas queden por encima de la tarjeta.
                .offset(y = (-96).dp)
                .size(250.dp),
        )

        // ---------- Encabezado ----------
        Column(
            modifier = Modifier
                .align(Alignment.TopCenter)
                .statusBarsPadding()
                .padding(horizontal = MlTheme.spacing.lg, vertical = MlTheme.spacing.lg),
            verticalArrangement = Arrangement.spacedBy(MlTheme.spacing.md),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(MlTheme.radius.control))
                        .background(MlTheme.colors.brand),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        imageVector = Icons.Outlined.ShoppingBag,
                        contentDescription = null,
                        tint = MlTheme.colors.brandInk,
                        modifier = Modifier.size(22.dp),
                    )
                }
                Spacer(Modifier.width(MlTheme.spacing.md))
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            text = "Plataforma",
                            style = MlTheme.type.display,
                            color = MlTheme.colors.ink,
                        )
                        Spacer(Modifier.width(MlTheme.spacing.sm))
                        MlBadge(text = "Móvil", tone = MlTone.Brand)
                    }
                    Text(
                        text = "Escaneá el QR de la web para vincular tu cuenta",
                        style = MlTheme.type.body,
                        color = MlTheme.colors.inkMuted,
                    )
                }
            }

            state.error?.let { message ->
                MlErrorBanner(
                    message = message,
                    onDismiss = viewModel::dismissError,
                )
            }

            if (!hasCameraPermission && !state.connecting) {
                MlCard {
                    MlEmptyState(
                        icon = Icons.Outlined.NoPhotography,
                        title = "Permiso de cámara denegado",
                        message = "Para escanear el QR necesitamos la cámara. Podés habilitarla acá o vincular con el código a mano.",
                        action = {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(MlTheme.spacing.sm),
                            ) {
                                MlButton(
                                    text = "Permitir cámara",
                                    onClick = { permissionLauncher.launch(Manifest.permission.CAMERA) },
                                    variant = MlButtonVariant.Primary,
                                )
                                MlButton(
                                    text = "Abrir ajustes",
                                    onClick = { openAppSettings() },
                                    variant = MlButtonVariant.Outline,
                                )
                            }
                        },
                    )
                }
            }

            state.notice?.let { message ->
                MlCard {
                    Row(
                        modifier = Modifier.padding(MlTheme.spacing.md),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Lock,
                            contentDescription = null,
                            tint = MlTheme.colors.warning,
                            modifier = Modifier.size(18.dp),
                        )
                        Spacer(Modifier.width(MlTheme.spacing.sm))
                        Text(
                            text = message,
                            style = MlTheme.type.body,
                            color = MlTheme.colors.inkMuted,
                            modifier = Modifier.weight(1f),
                        )
                        MlButton(
                            text = "Entendido",
                            onClick = viewModel::dismissNotice,
                            variant = MlButtonVariant.Ghost,
                        )
                    }
                }
            }
        }

        // ---------- Tarjeta inferior ----------
        Column(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .navigationBarsPadding()
                .padding(horizontal = MlTheme.spacing.lg, vertical = MlTheme.spacing.lg),
        ) {
            MlCard {
                Column(modifier = Modifier.padding(MlTheme.spacing.lg)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            imageVector = Icons.Outlined.QrCodeScanner,
                            contentDescription = null,
                            tint = MlTheme.colors.brandSoftInk,
                            modifier = Modifier.size(20.dp),
                        )
                        Spacer(Modifier.width(MlTheme.spacing.sm))
                        Text(
                            text = "Vinculación",
                            style = MlTheme.type.title,
                            color = MlTheme.colors.ink,
                        )
                    }

                    Spacer(Modifier.height(MlTheme.spacing.md))

                    Constants.PAIRING_HELP_STEPS.forEachIndexed { index, step ->
                        Row(modifier = Modifier.padding(vertical = 3.dp)) {
                            Text(
                                text = "${index + 1}.",
                                style = MlTheme.type.label,
                                color = MlTheme.colors.brandSoftInk,
                            )
                            Spacer(Modifier.width(MlTheme.spacing.sm))
                            Text(
                                text = step,
                                style = MlTheme.type.body,
                                color = MlTheme.colors.inkMuted,
                                modifier = Modifier.weight(1f),
                            )
                        }
                    }

                    Spacer(Modifier.height(MlTheme.spacing.md))
                    MlDivider()
                    Spacer(Modifier.height(MlTheme.spacing.md))

                    MlTextField(
                        value = state.serverUrlDraft,
                        onValueChange = viewModel::setServerUrlDraft,
                        label = "Servidor",
                        placeholder = Constants.DEFAULT_API_BASE,
                        keyboardType = KeyboardType.Uri,
                    )

                    Spacer(Modifier.height(MlTheme.spacing.md))

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(MlTheme.spacing.sm),
                    ) {
                        MlButton(
                            text = "Guardar servidor",
                            onClick = viewModel::applyServerUrl,
                            variant = MlButtonVariant.Outline,
                            modifier = Modifier.weight(1f),
                        )
                        MlButton(
                            text = "Ingresar código",
                            onClick = { viewModel.showManualEntry(true) },
                            variant = MlButtonVariant.Primary,
                            modifier = Modifier.weight(1f),
                        )
                    }
                }
            }
        }

        // ---------- Vinculando ----------
        if (state.connecting) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(MlTheme.colors.app.copy(alpha = 0.88f)),
                contentAlignment = Alignment.Center,
            ) {
                MlCard {
                    Column(
                        modifier = Modifier.padding(MlTheme.spacing.xxl),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        CircularProgressIndicator(color = MlTheme.colors.brand)
                        Spacer(Modifier.height(MlTheme.spacing.lg))
                        Text(
                            text = "Vinculando dispositivo…",
                            style = MlTheme.type.title,
                            color = MlTheme.colors.ink,
                        )
                        Spacer(Modifier.height(MlTheme.spacing.xs))
                        Text(
                            text = "Estamos asociando este celular a tu cuenta de Plataforma.",
                            style = MlTheme.type.body,
                            color = MlTheme.colors.inkMuted,
                            textAlign = TextAlign.Center,
                        )
                    }
                }
            }
        }

        if (state.manualEntryVisible) {
            ManualEntryDialog(
                onDismiss = { viewModel.showManualEntry(false) },
                onSubmit = viewModel::claimManual,
                connecting = state.connecting,
            )
        }
    }
}

/** Ingreso manual: código de 6 caracteres + clave, o el JSON del QR pegado completo. */
@Composable
private fun ManualEntryDialog(
    onDismiss: () -> Unit,
    onSubmit: (String, String) -> Unit,
    connecting: Boolean,
) {
    var code by remember { mutableStateOf("") }
    var secret by remember { mutableStateOf("") }

    Dialog(onDismissRequest = onDismiss) {
        MlCard {
            Column(modifier = Modifier.padding(MlTheme.spacing.lg)) {
                Text(
                    text = "Ingresar código a mano",
                    style = MlTheme.type.title,
                    color = MlTheme.colors.ink,
                )
                Spacer(Modifier.height(MlTheme.spacing.xs))
                Text(
                    text = "Escribí el código de 6 caracteres y su clave, o pegá el contenido completo del QR.",
                    style = MlTheme.type.body,
                    color = MlTheme.colors.inkMuted,
                )

                Spacer(Modifier.height(MlTheme.spacing.lg))

                MlTextField(
                    value = code,
                    onValueChange = { code = it },
                    label = "Código",
                    placeholder = "ABC123",
                )

                Spacer(Modifier.height(MlTheme.spacing.md))

                MlTextField(
                    value = secret,
                    onValueChange = { secret = it },
                    label = "Clave del QR (opcional si pegás el JSON)",
                    placeholder = "a1b2c3…",
                )

                Spacer(Modifier.height(MlTheme.spacing.lg))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(MlTheme.spacing.sm),
                ) {
                    MlButton(
                        text = "Cancelar",
                        onClick = onDismiss,
                        variant = MlButtonVariant.Ghost,
                        modifier = Modifier.weight(1f),
                    )
                    MlButton(
                        text = "Vincular",
                        onClick = { onSubmit(code, secret) },
                        variant = MlButtonVariant.Primary,
                        loading = connecting,
                        enabled = !connecting,
                        modifier = Modifier.weight(1f),
                    )
                }

                Spacer(Modifier.height(MlTheme.spacing.sm))

                Text(
                    text = "El código vence a los 10 minutos y sirve una sola vez.",
                    style = MlTheme.type.label,
                    color = MlTheme.colors.inkSubtle,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
    }
}

/** Marco de escaneo: cuatro esquinas de marca dibujadas a mano. */
@Composable
private fun ScannerFrame(modifier: Modifier = Modifier) {
    val brand = MlTheme.colors.brand
    val soft = MlTheme.colors.brand.copy(alpha = 0.28f)

    Canvas(modifier = modifier) {
        val stroke = 5.dp.toPx()
        val thin = 1.5.dp.toPx()
        val arm = size.minDimension * 0.22f
        val radius = 22.dp.toPx()

        // Contorno tenue alrededor de la zona de lectura.
        drawRoundRect(
            color = soft,
            cornerRadius = androidx.compose.ui.geometry.CornerRadius(radius, radius),
            style = androidx.compose.ui.graphics.drawscope.Stroke(width = thin),
        )

        // Esquinas.
        drawLine(brand, Offset(0f, radius + arm), Offset(0f, radius), stroke, StrokeCap.Round)
        drawLine(brand, Offset(radius, 0f), Offset(radius + arm, 0f), stroke, StrokeCap.Round)

        drawLine(brand, Offset(size.width, radius + arm), Offset(size.width, radius), stroke, StrokeCap.Round)
        drawLine(brand, Offset(size.width - radius, 0f), Offset(size.width - radius - arm, 0f), stroke, StrokeCap.Round)

        drawLine(brand, Offset(0f, size.height - radius - arm), Offset(0f, size.height - radius), stroke, StrokeCap.Round)
        drawLine(brand, Offset(radius, size.height), Offset(radius + arm, size.height), stroke, StrokeCap.Round)

        drawLine(
            brand,
            Offset(size.width, size.height - radius - arm),
            Offset(size.width, size.height - radius),
            stroke,
            StrokeCap.Round,
        )
        drawLine(
            brand,
            Offset(size.width - radius, size.height),
            Offset(size.width - radius - arm, size.height),
            stroke,
            StrokeCap.Round,
        )
    }
}
