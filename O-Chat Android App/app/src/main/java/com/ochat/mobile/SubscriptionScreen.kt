package com.ochat.mobile

import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SubscriptionScreen(
    token: String,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    var activeSub by remember { mutableStateOf<JSONObject?>(null) }
    var packagesList by remember { mutableStateOf<JSONArray?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var isProcessing by remember { mutableStateOf(false) }

    var timeLeft by remember { mutableStateOf<Map<String, Long>?>(null) }
    var progressPercent by remember { mutableStateOf(0f) }

    fun getRemainingTime(expiresAtStr: String): Map<String, Long>? {
        if (expiresAtStr.isEmpty()) return null
        try {
            val format = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }
            val cleanStr = expiresAtStr.replace("Z", "+00:00")
            val expiryDate = format.parse(cleanStr) ?: return null
            val diff = expiryDate.time - System.currentTimeMillis()
            if (diff <= 0) {
                return mapOf("days" to 0L, "hours" to 0L, "minutes" to 0L, "seconds" to 0L)
            }
            val seconds = (diff / 1000) % 60
            val minutes = (diff / (1000 * 60)) % 60
            val hours = (diff / (1000 * 60 * 60)) % 24
            val days = diff / (1000 * 60 * 60 * 24)
            return mapOf("days" to days, "hours" to hours, "minutes" to minutes, "seconds" to seconds)
        } catch (e: Exception) {
            return null
        }
    }

    fun getProgressPercentage(startedAtStr: String, expiresAtStr: String): Float {
        if (startedAtStr.isEmpty() || expiresAtStr.isEmpty()) return 0f
        try {
            val format = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }
            val cleanStart = startedAtStr.replace("Z", "+00:00")
            val cleanExpire = expiresAtStr.replace("Z", "+00:00")
            val startDate = format.parse(cleanStart)?.time ?: return 0f
            val expireDate = format.parse(cleanExpire)?.time ?: return 0f
            val now = System.currentTimeMillis()
            if (now >= expireDate) return 1f
            if (now <= startDate) return 0f
            val total = expireDate - startDate
            val elapsed = now - startDate
            return (elapsed.toFloat() / total.toFloat()).coerceIn(0f, 1f)
        } catch (e: Exception) {
            return 0f
        }
    }

    val fetchSubscriptionData = {
        isLoading = true
        NetworkService.fetchSubscription(token) { subResult ->
            subResult.fold(
                onSuccess = { subObj ->
                    NetworkService.fetchPackages(token) { pkgResult ->
                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                            isLoading = false
                            pkgResult.fold(
                                onSuccess = { pkgs ->
                                    activeSub = subObj.optJSONObject("data")
                                    packagesList = pkgs
                                },
                                onFailure = { err ->
                                    Toast.makeText(context, "Failed to load packages: ${err.message}", Toast.LENGTH_LONG).show()
                                }
                            )
                        }
                    }
                },
                onFailure = { err ->
                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                        isLoading = false
                        Toast.makeText(context, "Failed to load subscription: ${err.message}", Toast.LENGTH_LONG).show()
                    }
                }
            )
        }
    }

    LaunchedEffect(Unit) {
        fetchSubscriptionData()
    }

    val subObj = activeSub?.optJSONObject("subscription")
    val isSubActive = activeSub?.optBoolean("isActive") ?: false
    val expiresAt = subObj?.optString("expiresAt", "") ?: ""
    val startedAt = subObj?.optString("startedAt", "") ?: ""

    LaunchedEffect(isSubActive, expiresAt, startedAt) {
        if (isSubActive && expiresAt.isNotEmpty()) {
            while (true) {
                timeLeft = getRemainingTime(expiresAt)
                progressPercent = getProgressPercentage(startedAt, expiresAt)
                kotlinx.coroutines.delay(1000L)
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        "Billing & Subscription", 
                        color = Color(0xFFE9EDEF), 
                        fontSize = 19.sp, 
                        fontWeight = FontWeight.Bold
                    ) 
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color(0xFFE9EDEF))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF1F2C34))
            )
        },
        containerColor = Color(0xFF111B21)
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color(0xFF1F2C34).copy(alpha = 0.2f), Color(0xFF111B21))
                        )
                    )
            )

            if (isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Color(0xFF00A884))
                }
            } else {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .verticalScroll(scrollState)
                        .padding(16.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    // Active Subscription Card
                    if (isSubActive && subObj != null) {
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 16.dp)
                                .border(1.dp, Color(0xFF00A884).copy(alpha = 0.3f), RoundedCornerShape(16.dp)),
                            colors = CardDefaults.cardColors(containerColor = Color.Transparent),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .background(
                                        Brush.verticalGradient(
                                            colors = listOf(Color(0xFF0C241E), Color(0xFF172228))
                                        )
                                    )
                                    .padding(16.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = "ACTIVE PLAN",
                                        color = Color(0xFF0DF2C1),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold,
                                        letterSpacing = 1.sp
                                    )
                                    Text(
                                        text = "Live Timer",
                                        color = Color(0xFF0DF2C1),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }

                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = subObj.optString("packageName", "Custom Plan"),
                                    color = Color.White,
                                    fontSize = 22.sp,
                                    fontWeight = FontWeight.ExtraBold
                                )

                                Spacer(modifier = Modifier.height(10.dp))
                                val snapshot = subObj.optJSONObject("featuresSnapshot")
                                if (snapshot != null) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        val cardMod = Modifier
                                            .weight(1f)
                                            .background(Color(0xFF202C33).copy(alpha = 0.5f), RoundedCornerShape(8.dp))
                                            .padding(6.dp)
                                        Column(modifier = cardMod) {
                                            Text("Max Widgets", color = Color(0xFF8696A0), fontSize = 8.sp, fontWeight = FontWeight.Bold)
                                            Text("${snapshot.optInt("maxWidgets")} Widgets", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                                        }
                                        Column(modifier = cardMod) {
                                            Text("Max Agents", color = Color(0xFF8696A0), fontSize = 8.sp, fontWeight = FontWeight.Bold)
                                            Text("${snapshot.optInt("maxAgentsPerWidget")} Agents", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                                        }
                                        Column(modifier = cardMod) {
                                            Text("Support", color = Color(0xFF8696A0), fontSize = 8.sp, fontWeight = FontWeight.Bold)
                                            Text("Premium", color = Color(0xFF0DF2C1), fontSize = 11.sp, fontWeight = FontWeight.ExtraBold)
                                        }
                                    }
                                }

                                Spacer(modifier = Modifier.height(14.dp))
                                Text("Remaining Time Progress", color = Color(0xFF8696A0), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                Spacer(modifier = Modifier.height(4.dp))
                                LinearProgressIndicator(
                                    progress = { 1f - progressPercent },
                                    modifier = Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)),
                                    color = Color(0xFF00A884),
                                    trackColor = Color(0xFF202C33)
                                )
                                Spacer(modifier = Modifier.height(4.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    Text("Started: ${startedAt.take(10)}", color = Color(0xFF8696A0), fontSize = 10.sp)
                                    Text("Expires: ${expiresAt.take(10)}", color = Color(0xFF0DF2C1), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                }

                                Spacer(modifier = Modifier.height(14.dp))
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween
                                ) {
                                    val cellModifier = Modifier
                                        .weight(1f)
                                        .padding(horizontal = 2.dp)
                                        .background(Color(0xFF111B21), RoundedCornerShape(8.dp))
                                        .padding(vertical = 8.dp)
                                    
                                    val days = timeLeft?.get("days") ?: 0L
                                    val hours = timeLeft?.get("hours") ?: 0L
                                    val minutes = timeLeft?.get("minutes") ?: 0L
                                    val seconds = timeLeft?.get("seconds") ?: 0L

                                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = cellModifier) {
                                        Text(String.format("%02d", days), color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Black)
                                        Text("Days", color = Color(0xFF8696A0), fontSize = 8.sp, fontWeight = FontWeight.Bold)
                                    }
                                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = cellModifier) {
                                        Text(String.format("%02d", hours), color = Color(0xFF0DF2C1), fontSize = 16.sp, fontWeight = FontWeight.Black)
                                        Text("Hours", color = Color(0xFF8696A0), fontSize = 8.sp, fontWeight = FontWeight.Bold)
                                    }
                                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = cellModifier) {
                                        Text(String.format("%02d", minutes), color = Color(0xFF0DF2C1), fontSize = 16.sp, fontWeight = FontWeight.Black)
                                        Text("Mins", color = Color(0xFF8696A0), fontSize = 8.sp, fontWeight = FontWeight.Bold)
                                    }
                                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = cellModifier) {
                                        Text(String.format("%02d", seconds), color = Color(0xFFE28B00), fontSize = 16.sp, fontWeight = FontWeight.Black)
                                        Text("Secs", color = Color(0xFF8696A0), fontSize = 8.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }
                        }
                    } else {
                        // Warning expired plan
                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 16.dp)
                                .border(1.dp, Color(0xFFE28B00).copy(alpha = 0.5f), RoundedCornerShape(16.dp)),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
                            shape = RoundedCornerShape(16.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp)
                            ) {
                                Text(
                                    text = "NO ACTIVE PLAN",
                                    color = Color(0xFFE28B00),
                                    fontSize = 11.sp,
                                    fontWeight = FontWeight.Bold,
                                    letterSpacing = 1.sp
                                )
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Your subscription has expired or is inactive. Choose a package below to renew/activate your chat widgets.",
                                    color = Color(0xFFE9EDEF),
                                    fontSize = 13.sp
                                )
                            }
                        }
                    }

                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = "CHOOSE A TIER",
                        color = Color(0xFF8696A0),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 1.sp,
                        modifier = Modifier.align(Alignment.Start).padding(bottom = 12.dp)
                    )

                    // Showcase Packages list
                    val pkgs = packagesList
                    if (pkgs != null && pkgs.length() > 0) {
                        for (i in 0 until pkgs.length()) {
                            val pkg = pkgs.getJSONObject(i)
                            val pkgId = pkg.getString("_id")
                            val isCurrentPkg = isSubActive && subObj?.optString("package") == pkgId
                            val price = pkg.getInt("price")
                            val name = pkg.getString("name")

                            Card(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(bottom = 12.dp),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
                                shape = RoundedCornerShape(12.dp),
                                border = if (isCurrentPkg) BorderStroke(1.5.dp, Color(0xFF00A884)) else BorderStroke(1.dp, Color(0xFF2A3942))
                            ) {
                                Column(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(16.dp)
                                ) {
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Text(
                                            text = name,
                                            color = Color.White,
                                            fontSize = 16.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                        if (isCurrentPkg) {
                                            Text(
                                                text = "Current Plan",
                                                color = Color(0xFF0DF2C1),
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold
                                            )
                                        }
                                    }

                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = if (price == 0) "Free Plan" else "$price BDT / ${pkg.optInt("durationValue")} ${pkg.optString("durationUnit")}",
                                        color = Color(0xFF00A884),
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold
                                    )

                                    Spacer(modifier = Modifier.height(10.dp))
                                    val features = pkg.optJSONObject("features")
                                    if (features != null) {
                                        Text(text = "✓ Max Widgets: ${features.optInt("maxWidgets")}", color = Color(0xFF8696A0), fontSize = 12.sp)
                                        Text(text = "✓ Agents per Widget: ${features.optInt("maxAgentsPerWidget")}", color = Color(0xFF8696A0), fontSize = 12.sp)
                                    }

                                    val isFree = price == 0
                                    val showButton = !isCurrentPkg || (isCurrentPkg && !isFree)

                                    if (showButton) {
                                        Spacer(modifier = Modifier.height(12.dp))
                                        Button(
                                            onClick = {
                                                isProcessing = true
                                                NetworkService.initializePayment(token, pkgId) { payResult ->
                                                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                                                        isProcessing = false
                                                        payResult.fold(
                                                            onSuccess = { res ->
                                                                val isFreeRes = res.optBoolean("isFree", false)
                                                                if (isFreeRes) {
                                                                    Toast.makeText(context, "Free plan activated successfully!", Toast.LENGTH_SHORT).show()
                                                                    fetchSubscriptionData()
                                                                } else {
                                                                    val url = res.optString("payment_page_url")
                                                                    if (url.isNotEmpty()) {
                                                                        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                                                                        context.startActivity(intent)
                                                                    } else {
                                                                        Toast.makeText(context, "Payment URL not found", Toast.LENGTH_LONG).show()
                                                                    }
                                                                }
                                                            },
                                                            onFailure = { err ->
                                                                Toast.makeText(context, "Payment failed: ${err.message}", Toast.LENGTH_LONG).show()
                                                            }
                                                        )
                                                    }
                                                }
                                            },
                                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00A884)),
                                            shape = RoundedCornerShape(8.dp),
                                            modifier = Modifier.fillMaxWidth().height(36.dp)
                                        ) {
                                            Text(
                                                text = if (isCurrentPkg) "Renew Plan" else if (price == 0) "Get Started" else "Purchase / Upgrade",
                                                color = Color(0xFF111B21),
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 12.sp
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Processing Overlay
            AnimatedVisibility(
                visible = isProcessing,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.6f)),
                    contentAlignment = Alignment.Center
                ) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
                        shape = RoundedCornerShape(16.dp),
                        modifier = Modifier.size(120.dp)
                    ) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            CircularProgressIndicator(color = Color(0xFF00A884), modifier = Modifier.size(36.dp))
                            Spacer(modifier = Modifier.height(14.dp))
                            Text("Initializing...", color = Color(0xFFE9EDEF), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

        }
    }
}
