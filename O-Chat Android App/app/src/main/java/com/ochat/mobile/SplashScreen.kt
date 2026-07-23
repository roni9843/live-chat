package com.ochat.mobile

import androidx.compose.animation.core.*
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(onSplashFinished: () -> Unit) {

    // ── Entry animations ──────────────────────────────────────────────
    val logoScale  = remember { Animatable(0.3f) }
    val logoAlpha  = remember { Animatable(0f) }
    val textAlpha  = remember { Animatable(0f) }
    val tagAlpha   = remember { Animatable(0f) }

    // ── Infinite animations ───────────────────────────────────────────
    val inf = rememberInfiniteTransition(label = "splash")

    // Rotating rainbow ring
    val ringRotation by inf.animateFloat(
        initialValue = 0f, targetValue = 360f,
        animationSpec = infiniteRepeatable(tween(2200, easing = LinearEasing)),
        label = "ringRot"
    )

    // Counter-rotating inner ring
    val ring2Rotation by inf.animateFloat(
        initialValue = 360f, targetValue = 0f,
        animationSpec = infiniteRepeatable(tween(3000, easing = LinearEasing)),
        label = "ring2Rot"
    )

    // Outer pulse scale
    val outerPulse by inf.animateFloat(
        initialValue = 1f, targetValue = 1.22f,
        animationSpec = infiniteRepeatable(
            tween(1000, easing = FastOutSlowInEasing),
            RepeatMode.Reverse
        ),
        label = "outerPulse"
    )

    // Secondary pulse (offset timing)
    val innerPulse by inf.animateFloat(
        initialValue = 1.08f, targetValue = 0.92f,
        animationSpec = infiniteRepeatable(
            tween(800, easing = FastOutSlowInEasing),
            RepeatMode.Reverse
        ),
        label = "innerPulse"
    )

    // Shimmer glow alpha
    val shimmerAlpha by inf.animateFloat(
        initialValue = 0.3f, targetValue = 0.85f,
        animationSpec = infiniteRepeatable(
            tween(1200, easing = FastOutSlowInEasing),
            RepeatMode.Reverse
        ),
        label = "shimmer"
    )

    // ── Color palette for rainbow ring ────────────────────────────────
    val rainbowColors = listOf(
        Color(0xFF00E676), // green
        Color(0xFF00B0FF), // blue
        Color(0xFFAA00FF), // purple
        Color(0xFFFF4081), // pink
        Color(0xFFFF6D00), // orange
        Color(0xFFFFD600), // yellow
        Color(0xFF00E676), // back to green (seamless)
    )

    // ── Animation sequence ────────────────────────────────────────────
    LaunchedEffect(Unit) {
        logoScale.animateTo(
            1f,
            spring(Spring.DampingRatioMediumBouncy, Spring.StiffnessLow)
        )
        logoAlpha.animateTo(1f, tween(350))
        delay(180)
        textAlpha.animateTo(1f, tween(500))
        delay(150)
        tagAlpha.animateTo(1f, tween(500))
        delay(1400)
        onSplashFinished()
    }

    // ── Full-screen background ────────────────────────────────────────
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(Color(0xFF0D2137), Color(0xFF0B141A)),
                    radius = 1200f
                )
            ),
        contentAlignment = Alignment.Center
    ) {

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {

            // ── Logo stack ────────────────────────────────────────────
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(200.dp)
                    .scale(logoScale.value)
                    .alpha(logoAlpha.value)
            ) {

                // Layer 1 — outermost soft glow
                Box(
                    modifier = Modifier
                        .size(196.dp)
                        .scale(outerPulse)
                        .clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                colors = listOf(
                                    Color(0xFF00E676).copy(alpha = shimmerAlpha * 0.35f),
                                    Color.Transparent
                                )
                            )
                        )
                )

                // Layer 2 — rotating rainbow gradient ring
                Box(
                    modifier = Modifier
                        .size(176.dp)
                        .rotate(ringRotation)
                        .clip(CircleShape)
                        .background(
                            Brush.sweepGradient(rainbowColors)
                        )
                )

                // Layer 3 — white gap ring (creates border illusion)
                Box(
                    modifier = Modifier
                        .size(162.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF0B141A))
                )

                // Layer 4 — counter-rotating inner colored ring
                Box(
                    modifier = Modifier
                        .size(158.dp)
                        .rotate(ring2Rotation)
                        .clip(CircleShape)
                        .background(
                            Brush.sweepGradient(
                                listOf(
                                    Color(0xFF00BCD4).copy(alpha = 0.6f),
                                    Color(0xFF7C4DFF).copy(alpha = 0.6f),
                                    Color(0xFF00E676).copy(alpha = 0.6f),
                                    Color(0xFF00BCD4).copy(alpha = 0.6f),
                                )
                            )
                        )
                )

                // Layer 5 — dark circle background for icon
                Box(
                    modifier = Modifier
                        .size(144.dp)
                        .clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                colors = listOf(Color(0xFF1A2E3B), Color(0xFF0B141A))
                            )
                        )
                )

                // Layer 6 — pulsing teal inner glow
                Box(
                    modifier = Modifier
                        .size(144.dp)
                        .scale(innerPulse)
                        .clip(CircleShape)
                        .background(
                            Brush.radialGradient(
                                colors = listOf(
                                    Color(0xFF00A884).copy(alpha = shimmerAlpha * 0.25f),
                                    Color.Transparent
                                )
                            )
                        )
                )

                // Layer 7 — the actual circular app icon (100% rounded)
                Image(
                    painter = painterResource(id = R.mipmap.ic_launcher_round),
                    contentDescription = "O-Chat Logo",
                    modifier = Modifier
                        .size(116.dp)
                        .clip(CircleShape)          // ← 100% circular
                )
            }

            Spacer(modifier = Modifier.height(36.dp))

            // ── App name ──────────────────────────────────────────────
            Text(
                text = "O-Chat",
                fontSize = 38.sp,
                fontWeight = FontWeight.ExtraBold,
                color = Color(0xFFE9EDEF),
                textAlign = TextAlign.Center,
                modifier = Modifier.alpha(textAlpha.value)
            )

            Spacer(modifier = Modifier.height(10.dp))

            // ── Tagline with gradient color ───────────────────────────
            Text(
                text = "Real-time Customer Support",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = Color(0xFF00A884),
                textAlign = TextAlign.Center,
                modifier = Modifier.alpha(tagAlpha.value)
            )

            Spacer(modifier = Modifier.height(6.dp))

            // ── Animated typing / chatting indicator bars ─────────────
            val barColors = listOf(
                Color(0xFF00E676),
                Color(0xFF00B0FF),
                Color(0xFFAA00FF),
                Color(0xFFFF4081),
                Color(0xFFFFD600)
            )
            // Each bar has its own phase offset so they animate independently
            val phaseOffsets = listOf(0, 160, 80, 240, 120)
            val durations    = listOf(420, 360, 500, 380, 450)

            Row(
                horizontalArrangement = Arrangement.spacedBy(5.dp),
                verticalAlignment = Alignment.Bottom,
                modifier = Modifier
                    .height(28.dp)
                    .alpha(tagAlpha.value)
            ) {
                barColors.forEachIndexed { i, color ->
                    val barAnim by inf.animateFloat(
                        initialValue = 4f,
                        targetValue  = 24f,
                        animationSpec = infiniteRepeatable(
                            animation  = tween(
                                durationMillis = durations[i],
                                delayMillis    = phaseOffsets[i],
                                easing         = FastOutSlowInEasing
                            ),
                            repeatMode = RepeatMode.Reverse
                        ),
                        label = "bar$i"
                    )
                    Box(
                        modifier = Modifier
                            .width(5.dp)
                            .height(barAnim.dp)
                            .clip(CircleShape)          // গোল কোণ
                            .background(color)
                            .align(Alignment.Bottom)
                    )
                }
            }
        }

        // ── Bottom branding ───────────────────────────────────────────
        Text(
            text = "Powered by O-Chat",
            fontSize = 11.sp,
            color = Color(0xFF3D5A6E),
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 32.dp)
                .alpha(tagAlpha.value)
        )
    }
}
