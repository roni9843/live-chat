package com.ochat.mobile

import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.util.Locale

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LiveTrackingScreen(
    sessionsList: List<ChatSession>,
    onBack: () -> Unit,
    onChatNow: (String, String) -> Unit
) {
    var selectedFilter by remember { mutableStateOf("all") }

    // Filter only visitor sessions — reactive via derivedStateOf
    val allVisitors by remember(sessionsList) {
        derivedStateOf {
            sessionsList.filter {
                !(it._id ?: "").isEmpty() &&
                it.isGroupChat != true &&
                it.isDirectMessage != true &&
                it.widgetId != "group_chat"
            }.distinctBy { it._id ?: "" }          // ← duplicate guard
        }
    }

    // Get Active/Online list
    val activeVisitors by remember(allVisitors) {
        derivedStateOf {
            allVisitors.filter { it.visitorStatus != "offline" }
        }
    }

    // Extract unique domains for filter dropdown
    val domains by remember(allVisitors) {
        derivedStateOf {
            allVisitors.mapNotNull { it.visitorDomain }.distinct()
        }
    }

    // Apply Filter
    val filteredVisitors by remember(allVisitors, selectedFilter) {
        derivedStateOf {
            if (selectedFilter == "all") allVisitors
            else allVisitors.filter { it.visitorDomain == selectedFilter }
        }
    }

    // Sort: Chat Open, then Browsing (Online), then Offline
    val sortedVisitors by remember(filteredVisitors) {
        derivedStateOf {
            filteredVisitors.sortedWith(compareByDescending<ChatSession> {
                when (it.visitorStatus) {
                    "opened" -> 2
                    "online" -> 1
                    else -> 0
                }
            })
        }
    }

    val totalOnline by remember(activeVisitors) { derivedStateOf { activeVisitors.size } }
    val uniqueDomainCount by remember(activeVisitors) {
        derivedStateOf { activeVisitors.mapNotNull { it.visitorDomain }.distinct().size }
    }


    // Radar Scanning angle animation
    val infiniteTransition = rememberInfiniteTransition(label = "RadarSweep")
    val angle by infiniteTransition.animateFloat(
        initialValue = 0f,
        targetValue = 360f,
        animationSpec = infiniteRepeatable(
            animation = tween(4000, easing = LinearEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "radarAngle"
    )

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Live Visitor Radar", color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                        Text("Real-time traffic scanner", color = Color(0xFF8696A0), fontSize = 11.sp)
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF1F2C34))
            )
        },
        containerColor = Color(0xFF0B141A) // Dark background
    ) { paddingValues ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            
            // 1. Interactive Sweep Radar Graphic
            item {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 16.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF111B21)),
                    shape = RoundedCornerShape(24.dp),
                    border = BorderStroke(1.dp, Color(0xFF202C33))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Text(
                            text = "LIVE SCANNER",
                            color = Color(0xFF00A884),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.align(Alignment.Start)
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        // Radar Circle
                        Box(
                            modifier = Modifier
                                .size(200.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF0B141A)),
                            contentAlignment = Alignment.Center
                        ) {
                            // Drawing Concentric Rings, crosshairs and visitor dots
                            Canvas(modifier = Modifier.fillMaxSize()) {
                                val canvasWidth = size.width
                                val canvasHeight = size.height
                                val center = Offset(x = canvasWidth / 2, y = canvasHeight / 2)

                                // Crosshairs
                                drawLine(
                                    color = Color(0xFF202C33).copy(alpha = 0.5f),
                                    start = Offset(x = 0f, y = center.y),
                                    end = Offset(x = canvasWidth, y = center.y),
                                    strokeWidth = 1.dp.toPx()
                                )
                                drawLine(
                                    color = Color(0xFF202C33).copy(alpha = 0.5f),
                                    start = Offset(x = center.x, y = 0f),
                                    end = Offset(x = center.x, y = canvasHeight),
                                    strokeWidth = 1.dp.toPx()
                                )

                                // Concentric Circles
                                drawCircle(
                                    color = Color(0xFF202C33).copy(alpha = 0.6f),
                                    radius = canvasWidth / 2,
                                    center = center,
                                    style = Stroke(width = 1.dp.toPx())
                                )
                                drawCircle(
                                    color = Color(0xFF202C33).copy(alpha = 0.4f),
                                    radius = canvasWidth / 3.2f,
                                    center = center,
                                    style = Stroke(width = 1.dp.toPx())
                                )
                                drawCircle(
                                    color = Color(0xFF202C33).copy(alpha = 0.2f),
                                    radius = canvasWidth / 6f,
                                    center = center,
                                    style = Stroke(width = 1.dp.toPx())
                                )

                                // Draw visitor dots directly on Canvas
                                filteredVisitors.forEachIndexed { i, visitor ->
                                    if (visitor.visitorStatus != "offline") {
                                        val sId = visitor._id ?: ""
                                        val hash = sId.hashCode() + i
                                        val scatterAngle = (hash * 45) % 360
                                        val maxDistance = canvasWidth / 2.2f
                                        val distance = (canvasWidth / 6f) + ((hash * 17) % (maxDistance - (canvasWidth / 6f)).toInt())
                                        
                                        val rad = Math.toRadians(scatterAngle.toDouble())
                                        val x = center.x + (Math.cos(rad) * distance).toFloat()
                                        val y = center.y + (Math.sin(rad) * distance).toFloat()

                                        val color = if (visitor.visitorStatus == "opened") Color(0xFF25D366) else Color(0xFF3B82F6)
                                        
                                        // Draw radar dot
                                        drawCircle(
                                            color = color,
                                            radius = 5.dp.toPx(),
                                            center = Offset(x, y)
                                        )
                                        // Draw a subtle outer glow ring for the dot
                                        drawCircle(
                                            color = color.copy(alpha = 0.3f),
                                            radius = 8.dp.toPx(),
                                            center = Offset(x, y),
                                            style = Stroke(width = 1.5.dp.toPx())
                                        )
                                    }
                                }
                            }

                            // Sweeper line overlay
                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .rotate(angle)
                                    .background(
                                        Brush.sweepGradient(
                                            colors = listOf(
                                                Color(0x0000A884),
                                                Color(0x2200A884),
                                                Color(0x5500A884),
                                                Color(0x0000A884)
                                            )
                                        )
                                    )
                            )
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        // Stats Summary Row
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceAround
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("ONLINE", color = Color(0xFF8696A0), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                Text("$totalOnline", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                            }
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Text("SITES", color = Color(0xFF8696A0), fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                Text("$uniqueDomainCount", color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Black)
                            }
                        }
                    }
                }
            }

            // 2. Dropdown Filter Selector
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "FILTER SOURCE",
                        color = Color(0xFF8696A0),
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold
                    )

                    var expandedMenu by remember { mutableStateOf(false) }
                    Box {
                        Button(
                            onClick = { expandedMenu = true },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF1F2C34)),
                            shape = RoundedCornerShape(8.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Text(
                                text = if (selectedFilter == "all") "All Sites" else selectedFilter,
                                color = Color.White,
                                fontSize = 11.sp
                            )
                        }
                        DropdownMenu(
                            expanded = expandedMenu,
                            onDismissRequest = { expandedMenu = false },
                            modifier = Modifier.background(Color(0xFF1F2C34))
                        ) {
                            DropdownMenuItem(
                                text = { Text("All Sites", color = Color.White) },
                                onClick = {
                                    selectedFilter = "all"
                                    expandedMenu = false
                                }
                            )
                            domains.forEach { domain ->
                                DropdownMenuItem(
                                    text = { Text(domain, color = Color.White) },
                                    onClick = {
                                        selectedFilter = domain
                                        expandedMenu = false
                                    }
                                )
                            }
                        }
                    }
                }
            }

            // 3. Dynamic Visitor Cards
            items(
                items = sortedVisitors,
                key = { (it._id ?: "").ifEmpty { "v_${it.hashCode()}" } }
            ) { visitor ->
                val isChatOpen = visitor.visitorStatus == "opened"
                val isOnline = visitor.visitorStatus == "online"
                val isOffline = !isChatOpen && !isOnline

                val cardBorder = when {
                    isChatOpen -> BorderStroke(1.dp, Color(0xFF25D366).copy(alpha = 0.4f))
                    isOnline -> BorderStroke(1.dp, Color(0xFF3B82F6).copy(alpha = 0.4f))
                    else -> BorderStroke(1.dp, Color(0xFF202C33))
                }

                val statusLabel = when {
                    isChatOpen -> "Online (Chat Open)"
                    isOnline -> "Online (Browsing)"
                    else -> "Offline"
                }

                val statusColor = when {
                    isChatOpen -> Color(0xFF25D366)
                    isOnline -> Color(0xFF3B82F6)
                    else -> Color(0xFF8696A0)
                }

                val actionLabel = when {
                    isChatOpen -> "Respond to Chat"
                    isOnline -> "Initiate Chat"
                    else -> "View Chat History"
                }

                val actionColor = when {
                    isChatOpen -> ButtonDefaults.buttonColors(containerColor = Color(0xFF25D366))
                    isOnline -> ButtonDefaults.buttonColors(containerColor = Color(0xFF3B82F6))
                    else -> ButtonDefaults.buttonColors(containerColor = Color(0xFF202C33))
                }

                val actionTextColor = if (isOffline) Color.White else Color(0xFF111B21)

                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = if (isOffline) Color(0xFF111B21).copy(alpha = 0.5f) else Color(0xFF111B21)
                    ),
                    shape = RoundedCornerShape(16.dp),
                    border = cardBorder
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        
                        // Card Header (Name, Domain, Status Tag)
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.weight(1f)
                            ) {
                                // Avatar Circle
                                Box(
                                    modifier = Modifier
                                        .size(36.dp)
                                        .clip(CircleShape)
                                        .background(Color(0xFF1F2C34)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    val char = visitor.visitorName?.take(1)?.uppercase(Locale.getDefault()) ?: "G"
                                    Text(char, color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                                }

                                Spacer(modifier = Modifier.width(10.dp))

                                Column(modifier = Modifier.weight(1f)) {
                                    Text(
                                        text = visitor.visitorName ?: "Guest Visitor",
                                        color = Color.White,
                                        fontSize = 14.sp,
                                        fontWeight = FontWeight.Bold,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                    Text(
                                        text = visitor.visitorDomain ?: "Unknown Site",
                                        color = Color(0xFF8696A0),
                                        fontSize = 10.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            }

                            // Status Tag
                            Box(
                                modifier = Modifier
                                    .background(statusColor.copy(alpha = 0.15f), RoundedCornerShape(6.dp))
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            ) {
                                Text(
                                    text = statusLabel,
                                    color = statusColor,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }

                        // Path / Location Info Box
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(Color(0xFF0B141A), RoundedCornerShape(8.dp))
                                .padding(10.dp)
                        ) {
                            Text(
                                text = if (isOffline) "LAST PAGE VISITED" else "CURRENT PAGE LOCATION",
                                color = Color(0xFF8696A0),
                                fontSize = 8.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(4.dp))
                            Text(
                                text = visitor.visitorPath ?: "/",
                                color = Color(0xFF25D366),
                                fontSize = 11.sp,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                        }

                        // Action Button
                        Button(
                            onClick = {
                                onChatNow(visitor._id ?: "", visitor.visitorName ?: "Guest")
                            },
                            colors = actionColor,
                            shape = RoundedCornerShape(10.dp),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(38.dp)
                        ) {
                            Text(
                                text = actionLabel,
                                color = actionTextColor,
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }

            // Bottom Spacing
            item {
                Spacer(modifier = Modifier.height(16.dp))
            }
        }
    }
}
