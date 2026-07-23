package com.ochat.mobile

import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConfigureScreen(
    token: String,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    var widgetsList by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var sharedWidgetsList by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var canCreateWidgets by remember { mutableStateOf(false) }
    var userId by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(true) }

    // Fetch profile and widgets on load
    LaunchedEffect(Unit) {
        NetworkService.fetchProfile(token) { result ->
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                isLoading = false
                result.fold(
                    onSuccess = { profile ->
                        userId = profile.optString("_id", "")
                        canCreateWidgets = profile.optBoolean("canCreateWidgets", false)
                        
                        val wArray = profile.optJSONArray("widgets")
                        val list = mutableListOf<JSONObject>()
                        if (wArray != null) {
                            for (i in 0 until wArray.length()) {
                                list.add(wArray.getJSONObject(i))
                            }
                        }
                        widgetsList = list

                        val swArray = profile.optJSONArray("sharedWidgets")
                        val swList = mutableListOf<JSONObject>()
                        if (swArray != null) {
                            for (i in 0 until swArray.length()) {
                                swList.add(swArray.getJSONObject(i))
                            }
                        }
                        sharedWidgetsList = swList
                    },
                    onFailure = { err ->
                        Toast.makeText(context, "Failed to load configurations: ${err.message}", Toast.LENGTH_LONG).show()
                    }
                )
            }
        }
    }

    val openWebDashboard = { url: String ->
        try {
            val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            browserIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(browserIntent)
        } catch (e: Exception) {
            Toast.makeText(context, "Unable to open browser", Toast.LENGTH_SHORT).show()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Widget Configuration", color = Color(0xFFE9EDEF), fontSize = 19.sp, fontWeight = FontWeight.Bold) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color(0xFFE9EDEF))
                    }
                },
                actions = {
                    if (canCreateWidgets) {
                        IconButton(onClick = { openWebDashboard("https://dashboard.o-chat.live/configure") }) {
                            Icon(Icons.Default.Add, contentDescription = "Add Widget", tint = Color(0xFF00A884))
                        }
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
            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Color(0xFF00A884))
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(20.dp),
                    verticalArrangement = Arrangement.spacedBy(20.dp)
                ) {
                    // Widgets header
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                "YOUR WIDGETS",
                                color = Color(0xFF00A884),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                            if (canCreateWidgets) {
                                Text(
                                    "Add New Widget",
                                    color = Color(0xFF00A884),
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.clickable { openWebDashboard("https://dashboard.o-chat.live/configure") }
                                )
                            }
                        }
                    }

                    if (widgetsList.isEmpty()) {
                        item {
                            Card(
                                modifier = Modifier.fillMaxWidth(),
                                colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
                                border = BorderStroke(1.dp, Color(0xFF2A3942).copy(alpha = 0.5f)),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Column(
                                    modifier = Modifier.padding(24.dp).fillMaxWidth(),
                                    horizontalAlignment = Alignment.CenterHorizontally
                                ) {
                                    Icon(imageVector = Icons.Default.Info, contentDescription = null, tint = Color(0xFF8696A0), modifier = Modifier.size(40.dp))
                                    Spacer(modifier = Modifier.height(12.dp))
                                    Text("No widgets configured yet", color = Color(0xFF8696A0), fontSize = 13.sp)
                                    Text("Click Add to configure a widget on the web dashboard", color = Color(0xFF8696A0).copy(alpha = 0.7f), fontSize = 11.sp)
                                }
                            }
                        }
                    } else {
                        items(widgetsList) { widget ->
                            val widgetId = widget.optString("_id", "")
                            val domain = widget.optString("domain", "unknown.com")
                            val companyName = widget.optString("companyName", "Support")
                            val scriptCode = """<script 
  src="https://dashboard.o-chat.live/assets/widget.js" 
  id="ochat-script" 
  data-merchant-id="$userId"
  data-widget-id="$widgetId"
></script>"""

                            WidgetConfigCard(
                                domain = domain,
                                companyName = companyName,
                                scriptCode = scriptCode,
                                onSettingsClick = { openWebDashboard("https://dashboard.o-chat.live/configure/settings/$widgetId") },
                                onDeleteClick = { openWebDashboard("https://dashboard.o-chat.live/configure") }
                            )
                        }
                    }

                    // Shared Widgets section
                    if (sharedWidgetsList.isNotEmpty()) {
                        item {
                            Spacer(modifier = Modifier.height(10.dp))
                            Text(
                                "SHARED WITH YOU",
                                color = Color(0xFF00A884),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                letterSpacing = 1.sp
                            )
                        }

                        items(sharedWidgetsList) { widget ->
                            val widgetId = widget.optString("_id", "")
                            val domain = widget.optString("domain", "unknown.com")
                            val companyName = widget.optString("companyName", "Support")
                            val ownerName = widget.optString("ownerName", "Agent")
                            val ownerEmail = widget.optString("ownerEmail", "")
                            val myRole = widget.optString("myRole", "agent")
                            val scriptCode = """<script 
  src="https://dashboard.o-chat.live/assets/widget.js" 
  id="ochat-script" 
  data-merchant-id="$userId"
  data-widget-id="$widgetId"
></script>"""

                            WidgetConfigCard(
                                domain = domain,
                                companyName = companyName,
                                scriptCode = scriptCode,
                                ownerInfo = "Owned by: $ownerName ($ownerEmail)",
                                roleInfo = "Role: ${if (myRole == "admin") "Widget Admin" else "Chat Agent"}",
                                onSettingsClick = { 
                                    if (myRole == "admin") {
                                        openWebDashboard("https://dashboard.o-chat.live/configure/settings/$widgetId")
                                    } else {
                                        Toast.makeText(context, "Only admins can configure settings", Toast.LENGTH_SHORT).show()
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun WidgetConfigCard(
    domain: String,
    companyName: String,
    scriptCode: String,
    ownerInfo: String? = null,
    roleInfo: String? = null,
    onSettingsClick: () -> Unit,
    onDeleteClick: (() -> Unit)? = null
) {
    val context = LocalContext.current

    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
        border = BorderStroke(1.dp, Color(0xFF2A3942)),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(imageVector = Icons.Default.Info, contentDescription = null, tint = Color(0xFF00A884), modifier = Modifier.size(16.dp))
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = domain,
                            color = Color.White,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Bold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    Spacer(modifier = Modifier.height(4.dp))
                    Text("Company: $companyName", color = Color(0xFF8696A0), fontSize = 12.sp)
                    
                    if (ownerInfo != null) {
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(ownerInfo, color = Color(0xFF53BDEB), fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    if (roleInfo != null) {
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(roleInfo, color = Color(0xFF8696A0), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }

                Row(verticalAlignment = Alignment.CenterVertically) {
                    IconButton(onClick = onSettingsClick, modifier = Modifier.size(36.dp)) {
                        Icon(Icons.Default.Settings, contentDescription = "Settings", tint = Color(0xFF8696A0), modifier = Modifier.size(18.dp))
                    }
                    if (onDeleteClick != null) {
                        IconButton(onClick = onDeleteClick, modifier = Modifier.size(36.dp)) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete", tint = Color(0xFFF87171), modifier = Modifier.size(18.dp))
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Script section title
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(imageVector = Icons.Default.Build, contentDescription = null, tint = Color(0xFF8696A0), modifier = Modifier.size(14.dp))
                Spacer(modifier = Modifier.width(6.dp))
                Text("Embed Script", color = Color(0xFF8696A0), fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Code editor box
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF111B21), shape = RoundedCornerShape(8.dp))
                    .border(1.dp, Color(0xFF2A3942).copy(alpha = 0.5f), shape = RoundedCornerShape(8.dp))
                    .padding(10.dp)
            ) {
                Text(
                    text = scriptCode,
                    color = Color(0xFF4AF626),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    modifier = Modifier.fillMaxWidth().padding(end = 36.dp)
                )
                
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .size(28.dp)
                        .background(Color(0xFF2A3942), shape = CircleShape)
                        .clickable {
                            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                            val clip = android.content.ClipData.newPlainText("Embed Script", scriptCode)
                            clipboard.setPrimaryClip(clip)
                            Toast.makeText(context, "Script copied to clipboard!", Toast.LENGTH_SHORT).show()
                        },
                    contentAlignment = Alignment.Center
                ) {
                    Text("📋", fontSize = 11.sp)
                }
            }
        }
    }
}
