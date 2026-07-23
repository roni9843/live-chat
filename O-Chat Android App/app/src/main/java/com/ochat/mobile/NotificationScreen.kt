package com.ochat.mobile

import android.widget.Toast
import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.GroupAdd
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.NotificationsNone
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationScreen(
    token: String,
    onBack: () -> Unit,
    onRefreshProfile: () -> Unit
) {
    val context = LocalContext.current
    var invitesList by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    fun loadInvites() {
        isLoading = true
        NetworkService.fetchInvites(token) { result ->
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                isLoading = false
                result.fold(
                    onSuccess = { array ->
                        val list = mutableListOf<JSONObject>()
                        for (i in 0 until array.length()) list.add(array.getJSONObject(i))
                        invitesList = list
                    },
                    onFailure = { err ->
                        Toast.makeText(context, "Failed to load: ${err.message}", Toast.LENGTH_LONG).show()
                    }
                )
            }
        }
    }

    LaunchedEffect(Unit) { loadInvites() }

    val handleResponse = { widgetId: String, action: String ->
        NetworkService.respondToInvite(token, widgetId, action) { result ->
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                result.fold(
                    onSuccess = {
                        Toast.makeText(context, "Invitation ${action}ed!", Toast.LENGTH_SHORT).show()
                        loadInvites()
                        onRefreshProfile()
                    },
                    onFailure = { err ->
                        Toast.makeText(context, "Failed: ${err.message}", Toast.LENGTH_LONG).show()
                    }
                )
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            "Inbox",
                            color = Color(0xFFE9EDEF),
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold
                        )
                        if (!isLoading) {
                            Text(
                                text = if (invitesList.isEmpty()) "No pending requests"
                                       else "${invitesList.size} pending invite${if (invitesList.size > 1) "s" else ""}",
                                color = Color(0xFF00A884),
                                fontSize = 11.sp
                            )
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, "Back", tint = Color(0xFFE9EDEF))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF1F2C34))
            )
        },
        containerColor = Color(0xFF0B141A)
    ) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            when {
                isLoading -> LoadingState()
                invitesList.isEmpty() -> EmptyState()
                else -> InviteList(
                    invitesList = invitesList,
                    onAccept = { handleResponse(it, "accept") },
                    onReject = { handleResponse(it, "reject") }
                )
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Loading State
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun LoadingState() {
    val inf = rememberInfiniteTransition(label = "load")
    val pulse by inf.animateFloat(
        initialValue = 0.4f, targetValue = 1f,
        animationSpec = infiniteRepeatable(tween(800), RepeatMode.Reverse),
        label = "pulse"
    )
    Column(
        modifier = Modifier.fillMaxSize(),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        CircularProgressIndicator(
            color = Color(0xFF00A884),
            strokeWidth = 3.dp,
            modifier = Modifier.size(48.dp)
        )
        Spacer(Modifier.height(16.dp))
        Text(
            "Loading invites…",
            color = Color(0xFF8696A0).copy(alpha = pulse),
            fontSize = 13.sp
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Empty State
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun EmptyState() {
    val inf = rememberInfiniteTransition(label = "emptyBell")
    val bellScale by inf.animateFloat(
        initialValue = 1f, targetValue = 1.12f,
        animationSpec = infiniteRepeatable(tween(900, easing = FastOutSlowInEasing), RepeatMode.Reverse),
        label = "bellScale"
    )
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        // Glowing circle
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(110.dp)
                .clip(CircleShape)
                .background(
                    Brush.radialGradient(
                        listOf(Color(0xFF00A884).copy(0.18f), Color.Transparent)
                    )
                )
        ) {
            Box(
                contentAlignment = Alignment.Center,
                modifier = Modifier
                    .size(78.dp)
                    .clip(CircleShape)
                    .background(Color(0xFF1F2C34))
            ) {
                Icon(
                    Icons.Default.NotificationsNone,
                    contentDescription = null,
                    tint = Color(0xFF00A884),
                    modifier = Modifier.size(38.dp)
                )
            }
        }
        Spacer(Modifier.height(24.dp))
        Text("All caught up!", color = Color(0xFFE9EDEF), fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(10.dp))
        Text(
            "No pending team access requests or widget invites right now.",
            color = Color(0xFF8696A0),
            fontSize = 13.sp,
            textAlign = TextAlign.Center,
            lineHeight = 20.sp
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Invite List
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun InviteList(
    invitesList: List<JSONObject>,
    onAccept: (String) -> Unit,
    onReject: (String) -> Unit
) {
    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        itemsIndexed(invitesList) { index, invite ->
            AnimatedInviteCard(
                invite = invite,
                index = index,
                onAccept = onAccept,
                onReject = onReject
            )
        }
        item { Spacer(Modifier.height(8.dp)) }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Animated Invite Card
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun AnimatedInviteCard(
    invite: JSONObject,
    index: Int,
    onAccept: (String) -> Unit,
    onReject: (String) -> Unit
) {
    val widgetId    = invite.optString("widgetId", "")
    val domain      = invite.optString("domain", "Unknown Site")
    val companyName = invite.optString("companyName", "")
    val role        = invite.optString("role", "agent")
    val ownerName   = invite.optString("ownerName", "Another Admin")
    val ownerEmail  = invite.optString("ownerEmail", "")

    // Slide-in + fade-in on first appearance
    var visible by remember { mutableStateOf(false) }
    val cardAlpha   by animateFloatAsState(if (visible) 1f else 0f, tween(400), label = "ca")
    val cardOffset  by animateFloatAsState(if (visible) 0f else 40f, tween(400), label = "co")

    LaunchedEffect(Unit) {
        delay(index * 90L)
        visible = true
    }

    val roleColor = when (role.lowercase()) {
        "admin"   -> Color(0xFFFF6D00)
        "manager" -> Color(0xFFAA00FF)
        else      -> Color(0xFF00A884)   // agent / default
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .alpha(cardAlpha)
            .offset(y = cardOffset.dp)
    ) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = Color(0xFF111B21)),
            shape = RoundedCornerShape(20.dp),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            // Top gradient accent strip
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(4.dp)
                    .background(
                        Brush.horizontalGradient(
                            listOf(Color(0xFF00A884), Color(0xFF00B0FF), Color(0xFFAA00FF))
                        )
                    )
            )

            Column(modifier = Modifier.padding(18.dp)) {

                // ── Header row ────────────────────────────────────────
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    // Sender avatar circle
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .size(44.dp)
                            .clip(CircleShape)
                            .background(
                                Brush.linearGradient(
                                    listOf(Color(0xFF1F3A2D), Color(0xFF1A2E3B))
                                )
                            )
                    ) {
                        Icon(
                            Icons.Default.Person,
                            contentDescription = null,
                            tint = Color(0xFF00A884),
                            modifier = Modifier.size(24.dp)
                        )
                    }
                    Spacer(Modifier.width(12.dp))
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            ownerName,
                            color = Color(0xFFE9EDEF),
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold
                        )
                        if (ownerEmail.isNotEmpty()) {
                            Text(
                                ownerEmail,
                                color = Color(0xFF8696A0),
                                fontSize = 11.sp
                            )
                        }
                    }
                    // "NEW" badge
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Color(0xFF00A884).copy(alpha = 0.15f))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text("NEW", color = Color(0xFF00A884), fontSize = 9.sp, fontWeight = FontWeight.ExtraBold)
                    }
                }

                Spacer(Modifier.height(14.dp))
                Divider(color = Color(0xFF1F2C34))
                Spacer(Modifier.height(14.dp))

                // ── Invite Type chip ──────────────────────────────────
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(Icons.Default.GroupAdd, null, tint = Color(0xFF00B0FF), modifier = Modifier.size(16.dp))
                    Text("Team Access Invite", color = Color(0xFF00B0FF), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                }

                Spacer(Modifier.height(12.dp))

                // ── Info tiles ────────────────────────────────────────
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    InfoTile(
                        icon = Icons.Default.Language,
                        label = "Website",
                        value = domain + if (companyName.isNotEmpty()) " · $companyName" else ""
                    )
                    InfoTile(
                        icon = Icons.Default.CheckCircle,
                        label = "Your Role",
                        value = role.uppercase(),
                        valueColor = roleColor
                    )
                }

                Spacer(Modifier.height(18.dp))

                // ── Action buttons ────────────────────────────────────
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    // Reject
                    OutlinedButton(
                        onClick = { onReject(widgetId) },
                        modifier = Modifier
                            .weight(1f)
                            .height(44.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFF87171)),
                        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0xFFF87171).copy(alpha = 0.5f))
                    ) {
                        Text("Decline", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                    }
                    // Accept
                    Button(
                        onClick = { onAccept(widgetId) },
                        modifier = Modifier
                            .weight(1f)
                            .height(44.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color.Transparent
                        ),
                        contentPadding = PaddingValues(0.dp)
                    ) {
                        Box(
                            contentAlignment = Alignment.Center,
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.horizontalGradient(
                                        listOf(Color(0xFF00A884), Color(0xFF00B0FF))
                                    ),
                                    RoundedCornerShape(12.dp)
                                )
                        ) {
                            Text("Accept", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                        }
                    }
                }
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Info Tile helper
// ─────────────────────────────────────────────────────────────────────────────
@Composable
private fun InfoTile(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    value: String,
    valueColor: Color = Color(0xFFE9EDEF)
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0xFF0B141A))
            .padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
        Icon(icon, null, tint = Color(0xFF8696A0), modifier = Modifier.size(16.dp))
        Spacer(Modifier.width(10.dp))
        Text(label, color = Color(0xFF8696A0), fontSize = 11.sp, modifier = Modifier.width(64.dp))
        Text(value, color = valueColor, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
    }
}
