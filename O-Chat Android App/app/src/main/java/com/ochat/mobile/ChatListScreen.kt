package com.ochat.mobile

import android.os.Handler
import android.os.Looper
import android.widget.Toast
import android.Manifest
import android.provider.Settings
import android.os.Build
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.pager.HorizontalPager
import androidx.compose.foundation.pager.rememberPagerState
import androidx.compose.animation.core.*
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sensors
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.foundation.ExperimentalFoundationApi
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ChatListScreen(
    sessions: List<ChatSession>,
    isLoading: Boolean,
    token: String,
    currentUserId: String,
    currentUserName: String,
    currentUserProfilePic: String?,
    typingUsers: Map<String, String?>,
    onSessionSelected: (sessionId: String, displayName: String) -> Unit,
    onLogout: () -> Unit,
    onNavigateToProfile: () -> Unit,
    onNavigateToConfigure: () -> Unit,
    notificationCount: Int,
    onNavigateToNotifications: () -> Unit,
    onNavigateToSubscription: () -> Unit,
    onNavigateToLiveTracking: () -> Unit
) {
    val context = LocalContext.current
    val pagerState = rememberPagerState(pageCount = { 4 })
    val coroutineScope = rememberCoroutineScope()
    val activeTab = remember(pagerState.currentPage) {
        when (pagerState.currentPage) {
            0 -> "chats"
            1 -> "groups"
            2 -> "clients"
            3 -> "closed"
            else -> "chats"
        }
    }
    var inboxQuery by remember { mutableStateOf("") }
    var showHeaderMenu by remember { mutableStateOf(false) }
    val mainHandler = remember { Handler(Looper.getMainLooper()) }

    val lifecycleOwner = LocalLifecycleOwner.current
    var checkTrigger by remember { mutableStateOf(0) }

    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                checkTrigger++
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    var isAnyPermissionMissing by remember { mutableStateOf(false) }

    LaunchedEffect(checkTrigger) {
        val overlay = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true
        }
        val notify = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        val mic = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        val storage = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED &&
                    ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        }

        isAnyPermissionMissing = !overlay || !notify || !mic || !storage
    }

    var activeSubName by remember { mutableStateOf<String?>(null) }
    var activeSubStatus by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(token) {
        NetworkService.fetchSubscription(token) { result ->
            result.fold(
                onSuccess = { res ->
                    val isActive = res.optBoolean("isActive", false)
                    val subObj = res.optJSONObject("subscription")
                    if (isActive && subObj != null) {
                        activeSubName = subObj.optString("packageName", "Custom Plan")
                        activeSubStatus = "Active"
                    } else {
                        activeSubName = "No Active Subscription"
                        activeSubStatus = "Expired"
                    }
                },
                onFailure = {
                    activeSubName = null
                }
            )
        }
    }

    // Dialog state
    var showFabDialog by remember { mutableStateOf(false) }
    var modalTab by remember { mutableStateOf("direct") } // "direct" or "group"

    // Search state
    var searchEmail by remember { mutableStateOf("") }
    var isSearchingUsers by remember { mutableStateOf(false) }
    var searchResults by remember { mutableStateOf(listOf<User>()) }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    // Group state
    var groupName by remember { mutableStateOf("") }
    var selectedGroupMembers by remember { mutableStateOf(listOf<User>()) }
    var isCreatingChat by remember { mutableStateOf(false) }

    // Auto-search effect with debounce
    LaunchedEffect(searchEmail) {
        val query = searchEmail.trim()
        if (query.isNotEmpty()) {
            delay(500)
            isSearchingUsers = true
            errorMsg = null
            NetworkService.searchMerchants(token, query) { result ->
                isSearchingUsers = false
                result.fold(
                    onSuccess = { list ->
                        searchResults = list
                    },
                    onFailure = { err ->
                        errorMsg = err.message ?: "Search failed"
                    }
                )
            }
        } else {
            searchResults = emptyList()
            errorMsg = null
        }
    }

    val getFilteredSessions = { tab: String ->
        sessions.filter { session ->
            val isGroup = session.isGroupChat == true
            val isSessionClosed = session.status == "closed"
            val isVisitorOnline = session.visitorStatus == "online"
            val query = inboxQuery.trim().lowercase(Locale.getDefault())

            val matchesQuery = if (query.isEmpty()) {
                true
            } else {
                val name = when {
                    session.isDirectMessage == true && session.dmParticipants != null -> {
                        session.dmParticipants.firstOrNull { it.userId != currentUserId }?.name ?: session.visitorName ?: "Visitor"
                    }
                    else -> session.groupName ?: session.visitorName ?: "Visitor"
                }.lowercase(Locale.getDefault())
                val lastMessage = (session.lastMessage ?: "").lowercase(Locale.getDefault())
                name.contains(query) || lastMessage.contains(query)
            }

            matchesQuery && when (tab) {
                "chats" -> {
                    !isSessionClosed
                }
                "groups" -> {
                    !isSessionClosed && isGroup
                }
                "clients" -> {
                    !isSessionClosed && isVisitorOnline && !isGroup
                }
                "closed" -> {
                    isSessionClosed
                }
                else -> true
            }
        }
    }

    Scaffold(
        topBar = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(Color(0xFF111B21))
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1F2C34))
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    val appIconBitmap = remember(context) {
                        try {
                            val drawable = context.packageManager.getApplicationIcon(context.packageName)
                            if (drawable is android.graphics.drawable.BitmapDrawable) {
                                drawable.bitmap.asImageBitmap()
                            } else {
                                val width = drawable.intrinsicWidth.takeIf { it > 0 } ?: 100
                                val height = drawable.intrinsicHeight.takeIf { it > 0 } ?: 100
                                val bitmap = android.graphics.Bitmap.createBitmap(width, height, android.graphics.Bitmap.Config.ARGB_8888)
                                val canvas = android.graphics.Canvas(bitmap)
                                drawable.setBounds(0, 0, canvas.width, canvas.height)
                                drawable.draw(canvas)
                                bitmap.asImageBitmap()
                            }
                        } catch (e: Exception) {
                            null
                        }
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier.weight(1f)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF00A884)),
                            contentAlignment = Alignment.Center
                        ) {
                            if (appIconBitmap != null) {
                                androidx.compose.foundation.Image(
                                    bitmap = appIconBitmap,
                                    contentDescription = "Logo",
                                    modifier = Modifier.size(38.dp).clip(CircleShape),
                                    contentScale = androidx.compose.ui.layout.ContentScale.Crop
                                )
                            } else {
                                Text("O", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                            }
                        }
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            Text(
                                text = "O-Chat",
                                color = Color(0xFFE9EDEF),
                                fontSize = 20.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${getFilteredSessions(activeTab).size} conversations",
                                color = Color(0xFF8696A0),
                                fontSize = 11.sp
                            )
                        }
                    }

                    // Live Tracking icon button with pulsing green ring animation
                    val livePulse = rememberInfiniteTransition(label = "livePulse")
                    val livePulseAlpha by livePulse.animateFloat(
                        initialValue = 0.2f,
                        targetValue = 1f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(900, easing = FastOutSlowInEasing),
                            repeatMode = RepeatMode.Reverse
                        ),
                        label = "livePulseAlpha"
                    )
                    Box {
                        IconButton(onClick = onNavigateToLiveTracking) {
                            Icon(
                                imageVector = Icons.Default.Sensors,
                                contentDescription = "Live Tracking",
                                tint = Color(0xFF00E676),
                                modifier = Modifier.size(24.dp)
                            )
                        }
                        // Pulsing live dot
                        Box(
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .offset(x = (-6).dp, y = 6.dp)
                                .size(8.dp)
                                .background(
                                    Color(0xFF00E676).copy(alpha = livePulseAlpha),
                                    CircleShape
                                )
                        )
                    }

                    IconButton(onClick = onNavigateToSubscription) {
                        Text("💎", fontSize = 18.sp)
                    }

                    Box(modifier = Modifier.padding(end = 4.dp)) {
                        IconButton(onClick = onNavigateToNotifications) {
                            Text("🔔", fontSize = 18.sp)
                        }
                        if (notificationCount > 0) {
                            Box(
                                modifier = Modifier
                                    .align(Alignment.TopEnd)
                                    .offset(x = (-4).dp, y = 4.dp)
                                    .background(Color.Red, CircleShape)
                                    .size(16.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = notificationCount.toString(),
                                    color = Color.White,
                                    fontSize = 9.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }
                        }
                    }

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .clip(CircleShape)
                            .clickable { onNavigateToProfile() }
                    ) {
                        Box(
                            modifier = Modifier.size(34.dp)
                        ) {
                            AvatarImage(
                                displayName = currentUserName,
                                avatarUrl = currentUserProfilePic,
                                modifier = Modifier.size(34.dp)
                            )
                        }
                    }

                    Box {
                        IconButton(onClick = { showHeaderMenu = true }) {
                            Icon(
                                imageVector = Icons.Default.MoreVert,
                                contentDescription = "More options",
                                tint = Color(0xFFE9EDEF)
                            )
                        }

                        DropdownMenu(
                            expanded = showHeaderMenu,
                            onDismissRequest = { showHeaderMenu = false },
                            modifier = Modifier.background(Color(0xFF202C33))
                        ) {
                            DropdownMenuItem(
                                text = { Text("My Profile", color = Color.White) },
                                onClick = {
                                    showHeaderMenu = false
                                    onNavigateToProfile()
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Widget Settings", color = Color.White) },
                                onClick = {
                                    showHeaderMenu = false
                                    onNavigateToConfigure()
                                }
                            )
                            DropdownMenuItem(
                                text = {
                                    Row(verticalAlignment = Alignment.CenterVertically) {
                                        Text("📡", fontSize = 14.sp)
                                        Spacer(modifier = Modifier.width(8.dp))
                                        Text("Live Tracking", color = Color(0xFF00BFA5))
                                    }
                                },
                                onClick = {
                                    showHeaderMenu = false
                                    onNavigateToLiveTracking()
                                }
                            )
                            DropdownMenuItem(
                                text = { Text("Logout", color = Color(0xFFF87171)) },
                                onClick = {
                                    showHeaderMenu = false
                                    onLogout()
                                }
                            )
                        }
                    }
                }

                Surface(
                    color = Color(0xFF111B21),
                    tonalElevation = 0.dp,
                    shadowElevation = 0.dp
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 12.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(46.dp)
                                .clip(RoundedCornerShape(24.dp))
                                .background(Color(0xFF202C33))
                                .padding(horizontal = 14.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Icon(
                                Icons.Default.Search,
                                contentDescription = null,
                                tint = Color(0xFF8696A0),
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(10.dp))
                            BasicTextField(
                                value = inboxQuery,
                                onValueChange = { inboxQuery = it },
                                singleLine = true,
                                textStyle = TextStyle(
                                    color = Color(0xFFE9EDEF),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Medium
                                ),
                                modifier = Modifier.weight(1f),
                                decorationBox = { innerTextField ->
                                    Box(contentAlignment = Alignment.CenterStart) {
                                        if (inboxQuery.isEmpty()) {
                                            Text(
                                                "Search or start new chat",
                                                color = Color(0xFF8696A0),
                                                fontSize = 14.sp
                                            )
                                        }
                                        innerTextField()
                                    }
                                }
                            )
                            if (inboxQuery.isNotEmpty()) {
                                Spacer(modifier = Modifier.width(8.dp))
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = "Clear",
                                    tint = Color(0xFF8696A0),
                                    modifier = Modifier
                                        .size(18.dp)
                                        .clickable { inboxQuery = "" }
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.Bottom
                        ) {
                            TabItem(
                                text = "ALL",
                                isActive = activeTab == "chats",
                                badgeCount = sessions.filter { it.status != "closed" }.sumOf { it.unreadCount ?: 0 },
                                onClick = { coroutineScope.launch { pagerState.animateScrollToPage(0) } },
                                modifier = Modifier.weight(1f)
                            )
                            TabItem(
                                text = "GROUPS",
                                isActive = activeTab == "groups",
                                badgeCount = sessions.filter { it.status != "closed" && it.isGroupChat == true }.sumOf { it.unreadCount ?: 0 },
                                onClick = { coroutineScope.launch { pagerState.animateScrollToPage(1) } },
                                modifier = Modifier.weight(1f)
                            )
                            TabItem(
                                text = "ACTIVE",
                                isActive = activeTab == "clients",
                                badgeCount = sessions.filter { it.status != "closed" && it.visitorStatus == "online" && it.isGroupChat != true }.sumOf { it.unreadCount ?: 0 },
                                onClick = { coroutineScope.launch { pagerState.animateScrollToPage(2) } },
                                modifier = Modifier.weight(1f)
                            )
                            TabItem(
                                text = "ARCHIVED",
                                isActive = activeTab == "closed",
                                badgeCount = sessions.filter { it.status == "closed" }.sumOf { it.unreadCount ?: 0 },
                                onClick = { coroutineScope.launch { pagerState.animateScrollToPage(3) } },
                                modifier = Modifier.weight(1f)
                            )
                        }
                    }
                }
            }
        },
        containerColor = Color(0xFF111B21),
        floatingActionButton = {
            FloatingActionButton(
                onClick = {
                    showFabDialog = true
                    modalTab = "direct"
                    searchEmail = ""
                    searchResults = emptyList()
                    groupName = ""
                    selectedGroupMembers = emptyList()
                    errorMsg = null
                    isCreatingChat = false
                },
                containerColor = Color(0xFF00A884),
                shape = CircleShape,
                modifier = Modifier.padding(16.dp)
            ) {
                Icon(Icons.Default.Add, contentDescription = "New Session", tint = Color(0xFF111B21))
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            activeSubName?.let { subName ->
                if (activeSubStatus == "Active") {
                    Card(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 6.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = Color(0xFF0F2D24)
                        ),
                        border = BorderStroke(1.dp, Color(0xFF00A884).copy(alpha = 0.5f)),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(
                                    text = "⭐",
                                    fontSize = 14.sp,
                                    modifier = Modifier.padding(end = 8.dp)
                                )
                                Column {
                                    Text(
                                        text = "Active Subscription",
                                        color = Color(0xFF8FF5D4),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = subName,
                                        color = Color.White,
                                        fontSize = 13.sp,
                                        fontWeight = FontWeight.SemiBold
                                    )
                                }
                            }
                            
                            Text(
                                text = "Manage",
                                color = Color(0xFF111B21),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(Color(0xFF00A884))
                                    .clickable { onNavigateToProfile() }
                                    .padding(horizontal = 8.dp, vertical = 4.dp)
                            )
                        }
                    }
                }
            }

            if (isAnyPermissionMissing) {
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp)
                        .clickable { onNavigateToProfile() },
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF2C1E21)),
                    border = BorderStroke(1.dp, Color(0xFFF87171)),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Row(
                        modifier = Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "⚠️",
                            fontSize = 18.sp,
                            modifier = Modifier.padding(end = 10.dp)
                        )
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = "System Permissions Required",
                                color = Color(0xFFFCA5A5),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Some permissions (Overlay, Notification, Storage, or Mic) are disabled. Click here to enable them.",
                                color = Color(0xFFF87171),
                                fontSize = 11.sp
                            )
                        }
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = "Fix Now",
                            color = Color(0xFF25D366),
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier
                                .background(Color(0xFF0F2C21), shape = RoundedCornerShape(8.dp))
                                .border(1.dp, Color(0xFF25D366).copy(alpha = 0.3f), shape = RoundedCornerShape(8.dp))
                                .padding(horizontal = 8.dp, vertical = 4.dp)
                        )
                    }
                }
            }

            HorizontalPager(
                state = pagerState,
                modifier = Modifier
                    .fillMaxWidth()
                    .weight(1f)
            ) { page ->
                val tabKey = when (page) {
                    0 -> "chats"
                    1 -> "groups"
                    2 -> "clients"
                    3 -> "closed"
                    else -> "chats"
                }
                val filteredSessions = getFilteredSessions(tabKey)

                if (isLoading && sessions.isEmpty()) {
                    LoadingShimmerList()
                } else if (filteredSessions.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "No conversations found",
                        color = Color(0xFF8696A0),
                        fontSize = 15.sp
                    )
                }
            } else {
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(vertical = 4.dp)
                ) {
                    items(
                        items = filteredSessions,
                        key = { session -> (session._id ?: "").ifEmpty { "sess_${session.hashCode()}" } }
                    ) { session ->
                        val isGroup = session.isGroupChat == true || !session.groupName.isNullOrEmpty()
                        val isDM = session.isDirectMessage == true
                        val name = if (isDM && session.dmParticipants != null) {
                            session.dmParticipants.firstOrNull { it.userId != currentUserId }?.name ?: session.visitorName ?: "Visitor"
                        } else {
                            session.groupName ?: session.visitorName ?: "Visitor"
                        }
                        val unreadCount = session.unreadCount ?: 0
                        val hasUnread = unreadCount > 0

                        val displayTime = remember(session.lastMessageAt) {
                            session.lastMessageAt?.let { ts ->
                                try {
                                    val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                                        timeZone = TimeZone.getTimeZone("UTC")
                                    }.parse(ts)
                                    SimpleDateFormat("hh:mm a", Locale.getDefault()).format(date ?: Date())
                                } catch (e: Exception) {
                                    ""
                                }
                            } ?: ""
                        }

                        Column(
                            modifier = Modifier.background(
                                if (hasUnread) Color(0x0F25D366) else Color.Transparent
                            )
                        ) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { onSessionSelected(session._id ?: "", name) }
                                    .padding(horizontal = 16.dp, vertical = 10.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Box(
                                     modifier = Modifier.size(54.dp)
                                 ) {
                                     val avatarUrl = remember(session) {
                                         if (session.isGroupChat == true) {
                                             session.groupImage
                                         } else if (session.isDirectMessage == true) {
                                             session.dmParticipants?.firstOrNull { it.userId != currentUserId }?.profilePic
                                         } else {
                                             null
                                         }
                                     }
                                     val themeColor = remember {
                                         when {
                                             isDM -> Color(0xFF53BDEB)
                                             isGroup -> Color(0xFF00A884)
                                             else -> Color(0xFF657786)
                                         }
                                     }
                                     AvatarImage(
                                         displayName = name,
                                         avatarUrl = avatarUrl,
                                         modifier = Modifier.size(54.dp),
                                         themeColor = themeColor
                                     )
                                     
                                     val isOnline = session.visitorStatus == "online" || session.visitorStatus == "opened" || session.visitorStatus == "minimized"
                                     if (session.isGroupChat != true && session.isDirectMessage != true && isOnline) {
                                         Box(
                                             modifier = Modifier
                                                 .size(14.dp)
                                                 .align(Alignment.BottomEnd)
                                                 .background(Color(0xFF00A884), CircleShape)
                                                 .border(2.dp, Color(0xFF111B21), CircleShape)
                                         )
                                     }
                                 }

                                Spacer(modifier = Modifier.width(14.dp))

                                Column(
                                    modifier = Modifier.weight(1f)
                                ) {
                                    Row(
                                        modifier = Modifier.fillMaxWidth(),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Text(
                                            text = name,
                                            color = if (hasUnread) Color.White else Color(0xFFE9EDEF),
                                            fontSize = 15.sp,
                                            fontWeight = if (hasUnread) FontWeight.Bold else FontWeight.Normal,
                                            maxLines = 1,
                                            overflow = TextOverflow.Ellipsis,
                                            modifier = Modifier.weight(1f)
                                        )
                                        
                                        if (displayTime.isNotEmpty()) {
                                            Text(
                                                text = displayTime,
                                                color = if (hasUnread) Color(0xFF25D366) else Color(0xFF8696A0),
                                                fontSize = 12.sp,
                                                fontWeight = if (hasUnread) FontWeight.Bold else FontWeight.Normal
                                            )
                                        }
                                    }

                                    Row(
                                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        val typingUser = typingUsers[session._id]
                                        if (typingUser != null) {
                                            Row(
                                                verticalAlignment = Alignment.CenterVertically,
                                                horizontalArrangement = Arrangement.spacedBy(4.dp),
                                                modifier = Modifier.weight(1f)
                                            ) {
                                                Text(
                                                    text = typingUser,
                                                    color = Color(0xFF25D366),
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Medium,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis,
                                                    modifier = Modifier.weight(1f, fill = false)
                                                )
                                                AnimatedTypingDots(color = Color(0xFF25D366), dotSize = 5.dp)
                                            }
                                        } else {
                                            Text(
                                                text = session.lastMessage ?: "No messages",
                                                color = if (hasUnread) Color(0xFFE9EDEF) else Color(0xFF8696A0),
                                                fontSize = 13.sp,
                                                fontWeight = if (hasUnread) FontWeight.Bold else FontWeight.Normal,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis,
                                                modifier = Modifier.weight(1f)
                                            )
                                        }


                                        if (hasUnread) {
                                            Box(
                                                modifier = Modifier
                                                    .padding(start = 8.dp)
                                                    .size(22.dp)
                                                    .clip(CircleShape)
                                                    .background(Color(0xFF25D366)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text(
                                                    text = unreadCount.toString(),
                                                    color = Color(0xFF111B21),
                                                    fontSize = 12.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                    }
                                    
                                    if (session.isGroupChat != true && session.isDirectMessage != true) {
                                        Row(
                                            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                                            verticalAlignment = Alignment.CenterVertically
                                        ) {
                                            val isOnline = session.visitorStatus == "online" || session.visitorStatus == "opened" || session.visitorStatus == "minimized"
                                            Box(
                                                modifier = Modifier
                                                    .background(if (isOnline) Color(0xFF00A884).copy(alpha = 0.15f) else Color(0xFFEF4444).copy(alpha = 0.15f), RoundedCornerShape(4.dp))
                                                    .padding(horizontal = 6.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    text = if (isOnline) "ACTIVE" else "INACTIVE",
                                                    color = if (isOnline) Color(0xFF8FF5D4) else Color(0xFFFCA5A5),
                                                    fontSize = 8.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                            
                                            if (session.assignedAgent.isNullOrEmpty()) {
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Box(
                                                    modifier = Modifier
                                                        .background(Color(0xFFE28B00).copy(alpha = 0.25f), RoundedCornerShape(4.dp))
                                                        .border(0.5.dp, Color(0xFFE28B00), RoundedCornerShape(4.dp))
                                                        .clickable {
                                                            session.assignedAgent = currentUserId
                                                            session.assignedAgentName = currentUserName
                                                            val sId = session._id ?: ""
                                                            if (sId.isNotEmpty()) {
                                                                val sharedPref = context.getSharedPreferences("O-ChatPrefs", android.content.Context.MODE_PRIVATE)
                                                                val currentSet = sharedPref.getStringSet("joined_sessions", emptySet()) ?: emptySet()
                                                                val newSet = currentSet.toMutableSet().apply { add(sId) }
                                                                sharedPref.edit().putStringSet("joined_sessions", newSet).apply()
                                                            }
                                                            if (!SocketManager.isConnected()) {
                                                                Toast.makeText(context, "Reconnecting live chat server...", Toast.LENGTH_SHORT).show()
                                                            }
                                                            SocketManager.joinSession(
                                                                sessionId = sId,
                                                                agentId = currentUserId,
                                                                agentName = currentUserName,
                                                                merchantId = currentUserId,
                                                                onResult = { success, errorMsg ->
                                                                    if (success) {
                                                                        Toast.makeText(context, "Joined session!", Toast.LENGTH_SHORT).show()
                                                                    } else {
                                                                        Toast.makeText(context, errorMsg ?: "Error joining session", Toast.LENGTH_LONG).show()
                                                                    }
                                                                }
                                                            )
                                                        }
                                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                                ) {
                                                    Text(
                                                        text = "JOIN",
                                                        color = Color(0xFFFFB74D),
                                                        fontSize = 8.sp,
                                                        fontWeight = FontWeight.Bold
                                                    )
                                                }
                                            }

                                            val domainStr = session.visitorDomain ?: ""
                                            if (domainStr.isNotEmpty()) {
                                                Spacer(modifier = Modifier.width(6.dp))
                                                Text(
                                                    text = "🌐 $domainStr",
                                                    color = Color(0xFF8696A0),
                                                    fontSize = 11.sp,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                            }
                                            
                                            val pathStr = session.visitorPath ?: "/"
                                            Spacer(modifier = Modifier.width(6.dp))
                                            Text(
                                                text = "📄 $pathStr",
                                                color = Color(0xFF8696A0),
                                                fontSize = 11.sp,
                                                maxLines = 1,
                                                overflow = TextOverflow.Ellipsis,
                                                modifier = Modifier.weight(1f)
                                            )
                                        }
                                    }
                                }
                            }

                            HorizontalDivider(
                                color = Color(0xFF202C33),
                                thickness = 0.5.dp,
                                modifier = Modifier.padding(start = 84.dp)
                            )
                        }
                    }
                }
            }
            }
        }
    }

    // Modal custom Dialog matching WhatsApp dashboard layout with 100% responsive scrolling
    if (showFabDialog) {
        Dialog(
            onDismissRequest = { if (!isCreatingChat) showFabDialog = false }
        ) {
            Card(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 24.dp)
                    .wrapContentHeight(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = Color(0xFF202C33)),
                border = BorderStroke(1.dp, Color(0xFF2A3942))
            ) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    // Header layout mimicking the Web Dashboard
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Box(
                                modifier = Modifier
                                    .size(36.dp)
                                    .background(Color(0x2600A884), shape = RoundedCornerShape(8.dp)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(Icons.Default.Person, contentDescription = null, tint = Color(0xFF00A884), modifier = Modifier.size(18.dp))
                            }
                            Spacer(modifier = Modifier.width(10.dp))
                            Column {
                                Text("New Session", color = Color(0xFFE9EDEF), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                                Text("Connect with other support agents", color = Color(0xFF8696A0), fontSize = 11.sp)
                            }
                        }
                        
                        IconButton(
                            onClick = { showFabDialog = false },
                            enabled = !isCreatingChat,
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(Icons.Default.Close, contentDescription = "Close", tint = Color(0xFF8696A0), modifier = Modifier.size(18.dp))
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    // Tab Toggles
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp),
                        horizontalArrangement = Arrangement.Start
                    ) {
                        Column(
                            modifier = Modifier
                                .clickable {
                                    modalTab = "direct"
                                    searchResults = emptyList()
                                    searchEmail = ""
                                }
                                .padding(end = 16.dp)
                        ) {
                            Text(
                                text = "Direct Message",
                                color = if (modalTab == "direct") Color(0xFF00A884) else Color(0xFF8696A0),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 6.dp)
                            )
                            Box(
                                modifier = Modifier
                                    .width(88.dp)
                                    .height(2.dp)
                                    .background(if (modalTab == "direct") Color(0xFF00A884) else Color.Transparent)
                            )
                        }

                        Column(
                            modifier = Modifier
                                .clickable {
                                    modalTab = "group"
                                    searchResults = emptyList()
                                    searchEmail = ""
                                }
                        ) {
                            Text(
                                text = "Group Chat",
                                color = if (modalTab == "group") Color(0xFF00A884) else Color(0xFF8696A0),
                                fontSize = 14.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 6.dp)
                            )
                            Box(
                                modifier = Modifier
                                    .width(80.dp)
                                    .height(2.dp)
                                    .background(if (modalTab == "group") Color(0xFF00A884) else Color.Transparent)
                            )
                        }
                    }

                    Spacer(modifier = Modifier.height(16.dp))

                    if (isCreatingChat) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(vertical = 40.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                CircularProgressIndicator(color = Color(0xFF00A884), modifier = Modifier.size(36.dp))
                                Spacer(modifier = Modifier.height(16.dp))
                                Text(
                                    text = if (modalTab == "group") "Creating Group Chat..." else "Creating Inbox...",
                                    color = Color(0xFFE9EDEF),
                                    fontSize = 14.sp,
                                    fontWeight = FontWeight.Bold
                                )
                                Text("Setting up direct secure session", color = Color(0xFF8696A0), fontSize = 12.sp)
                            }
                        }
                    } else {
                        // Scrollable Main Content Column to avoid overlap on small screens
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .heightIn(max = 280.dp)
                                .verticalScroll(rememberScrollState())
                        ) {
                            // 1. Group Subject field (only inside Group Tab)
                            if (modalTab == "group") {
                                Text(
                                    text = "GROUP NAME",
                                    color = Color(0xFF8696A0),
                                    fontSize = 10.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.padding(bottom = 6.dp)
                                )
                                OutlinedTextField(
                                    value = groupName,
                                    onValueChange = { groupName = it },
                                    placeholder = { Text("Enter group subject...", color = Color(0xFF8696A0), fontSize = 13.sp) },
                                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = Color(0xFF00A884),
                                        unfocusedBorderColor = Color.Transparent,
                                        focusedContainerColor = Color(0xFF2A3942),
                                        unfocusedContainerColor = Color(0xFF2A3942),
                                        focusedTextColor = Color.White,
                                        unfocusedTextColor = Color.White
                                    ),
                                    shape = RoundedCornerShape(12.dp),
                                    singleLine = true
                                )

                                // Selected Group Members Bubble List
                                if (selectedGroupMembers.isNotEmpty()) {
                                    Text(
                                        text = "SELECTED MEMBERS (${selectedGroupMembers.size})",
                                        color = Color(0xFF8696A0),
                                        fontSize = 10.sp,
                                        fontWeight = FontWeight.Bold,
                                        modifier = Modifier.padding(bottom = 6.dp)
                                    )
                                    Column(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .background(Color(0xFF1F2C34), shape = RoundedCornerShape(12.dp))
                                            .padding(8.dp)
                                            .padding(bottom = 8.dp)
                                    ) {
                                        selectedGroupMembers.forEach { member ->
                                            Row(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .padding(vertical = 4.dp),
                                                horizontalArrangement = Arrangement.SpaceBetween,
                                                verticalAlignment = Alignment.CenterVertically
                                            ) {
                                                Text(member.name, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                                                Icon(
                                                    Icons.Default.Close,
                                                    contentDescription = "Remove",
                                                    tint = Color(0xFFF87171),
                                                    modifier = Modifier
                                                        .size(16.dp)
                                                        .clickable { selectedGroupMembers = selectedGroupMembers - member }
                                                )
                                            }
                                        }
                                    }
                                    Spacer(modifier = Modifier.height(12.dp))
                                }
                            }

                            // 2. Search Field
                            Text(
                                text = "SEARCH AGENTS",
                                color = Color(0xFF8696A0),
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(bottom = 6.dp)
                            )
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                BasicTextField(
                                    value = searchEmail,
                                    onValueChange = { searchEmail = it },
                                    textStyle = TextStyle(color = Color.White, fontSize = 14.sp),
                                    singleLine = true,
                                    modifier = Modifier
                                        .weight(1f)
                                        .height(44.dp)
                                        .background(Color(0xFF2A3942), shape = CircleShape)
                                        .padding(horizontal = 16.dp),
                                    decorationBox = { innerTextField ->
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.fillMaxSize()
                                        ) {
                                            Icon(
                                                Icons.Default.Search,
                                                contentDescription = null,
                                                tint = Color(0xFF8696A0),
                                                modifier = Modifier.size(16.dp)
                                            )
                                            Spacer(modifier = Modifier.width(8.dp))
                                            Box(modifier = Modifier.weight(1f), contentAlignment = Alignment.CenterStart) {
                                                if (searchEmail.isEmpty()) {
                                                    Text(
                                                        "Search agent email...",
                                                        color = Color(0xFF8696A0),
                                                        fontSize = 13.sp
                                                    )
                                                }
                                                innerTextField()
                                            }
                                            if (searchEmail.isNotEmpty()) {
                                                Icon(
                                                    Icons.Default.Close,
                                                    contentDescription = "Clear",
                                                    tint = Color(0xFF8696A0),
                                                    modifier = Modifier
                                                        .size(16.dp)
                                                        .clickable { searchEmail = "" }
                                                )
                                            }
                                        }
                                    }
                                )

                                Spacer(modifier = Modifier.width(8.dp))

                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .background(
                                            if (searchEmail.isNotBlank()) Color(0xFF00A884) else Color(0xFF2A3942),
                                            shape = CircleShape
                                        )
                                        .clickable(enabled = !isSearchingUsers && searchEmail.isNotBlank()) {
                                            isSearchingUsers = true
                                            errorMsg = null
                                            NetworkService.searchMerchants(token, searchEmail.trim()) { result ->
                                                isSearchingUsers = false
                                                result.fold(
                                                    onSuccess = { list ->
                                                        searchResults = list
                                                    },
                                                    onFailure = { err ->
                                                        errorMsg = err.message ?: "Search failed"
                                                    }
                                                )
                                            }
                                        },
                                    contentAlignment = Alignment.Center
                                ) {
                                    if (isSearchingUsers) {
                                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                                    } else {
                                        Icon(
                                            Icons.Default.Search,
                                            contentDescription = "Search",
                                            tint = if (searchEmail.isNotBlank()) Color.White else Color(0xFF8696A0),
                                            modifier = Modifier.size(18.dp)
                                        )
                                    }
                                }
                            }

                            // 3. Search Results List inside scroll container
                            if (searchResults.isNotEmpty()) {
                                searchResults.forEach { user ->
                                    val isAlreadyAdded = selectedGroupMembers.any { m -> m._id == user._id }

                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .clickable {
                                                if (modalTab == "direct") {
                                                    isCreatingChat = true
                                                    NetworkService.startDirectMessage(token, user._id) { result ->
                                                        mainHandler.post {
                                                            isCreatingChat = false
                                                            result.fold(
                                                                onSuccess = { session ->
                                                                    showFabDialog = false
                                                                    onSessionSelected(session._id ?: "", user.name)
                                                                },
                                                                onFailure = { err ->
                                                                    errorMsg = err.message ?: "Failed to start direct message"
                                                                }
                                                            )
                                                        }
                                                    }
                                                } else {
                                                    if (!isAlreadyAdded) {
                                                        selectedGroupMembers = selectedGroupMembers + user
                                                    }
                                                }
                                            }
                                            .padding(vertical = 8.dp),
                                        horizontalArrangement = Arrangement.SpaceBetween,
                                        verticalAlignment = Alignment.CenterVertically
                                    ) {
                                        Row(
                                            verticalAlignment = Alignment.CenterVertically,
                                            modifier = Modifier.weight(1f)
                                        ) {
                                            Box(
                                                modifier = Modifier
                                                    .size(36.dp)
                                                    .clip(CircleShape)
                                                    .background(Color(0xFF53BDEB)),
                                                contentAlignment = Alignment.Center
                                            ) {
                                                Text(
                                                    text = user.name.take(1).uppercase(Locale.getDefault()),
                                                    color = Color.White,
                                                    fontWeight = FontWeight.Bold,
                                                    fontSize = 14.sp
                                                )
                                            }
                                            Spacer(modifier = Modifier.width(10.dp))
                                            Column {
                                                Text(user.name, color = Color(0xFFE9EDEF), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                                Text(user.email, color = Color(0xFF8696A0), fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                            }
                                        }

                                        if (modalTab == "direct") {
                                            Button(
                                                onClick = {
                                                    isCreatingChat = true
                                                    NetworkService.startDirectMessage(token, user._id) { result ->
                                                        mainHandler.post {
                                                            isCreatingChat = false
                                                            result.fold(
                                                                onSuccess = { session ->
                                                                    showFabDialog = false
                                                                    onSessionSelected(session._id ?: "", user.name)
                                                                },
                                                                onFailure = { err ->
                                                                    errorMsg = err.message ?: "Failed to start direct message"
                                                                }
                                                            )
                                                        }
                                                    }
                                                },
                                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00A884).copy(alpha = 0.15f)),
                                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                                                shape = RoundedCornerShape(8.dp),
                                                modifier = Modifier.height(28.dp)
                                            ) {
                                                Text("Chat", color = Color(0xFF00A884), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                            }
                                        } else {
                                            Button(
                                                onClick = {
                                                    if (isAlreadyAdded) {
                                                        selectedGroupMembers = selectedGroupMembers - user
                                                    } else {
                                                        selectedGroupMembers = selectedGroupMembers + user
                                                    }
                                                },
                                                colors = ButtonDefaults.buttonColors(
                                                    containerColor = if (isAlreadyAdded) Color(0xFF2A3942) else Color(0xFF00A884).copy(alpha = 0.15f)
                                                ),
                                                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 2.dp),
                                                shape = RoundedCornerShape(8.dp),
                                                modifier = Modifier.height(28.dp)
                                            ) {
                                                Text(
                                                    text = if (isAlreadyAdded) "Added" else "Add",
                                                    color = if (isAlreadyAdded) Color(0xFF8696A0) else Color(0xFF00A884),
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                            }
                                        }
                                    }
                                }
                            } else if (searchEmail.isNotEmpty() && !isSearchingUsers) {
                                Box(
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 16.dp),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        Box(
                                            modifier = Modifier
                                                .size(36.dp)
                                                .background(Color(0xFF2A3942).copy(alpha = 0.5f), shape = CircleShape),
                                            contentAlignment = Alignment.Center
                                        ) {
                                            Icon(Icons.Default.Search, contentDescription = null, tint = Color(0xFF8696A0), modifier = Modifier.size(16.dp))
                                        }
                                        Spacer(modifier = Modifier.height(8.dp))
                                        Text("No agents found", color = Color(0xFFE9EDEF), fontSize = 12.sp, fontWeight = FontWeight.Medium)
                                    }
                                }
                            }

                            errorMsg?.let {
                                Text(it, color = Color(0xFFF87171), fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                            }
                        }

                        // Create Group button at bottom
                        if (modalTab == "group") {
                            Spacer(modifier = Modifier.height(16.dp))
                            Button(
                                onClick = {
                                    if (groupName.isBlank() || selectedGroupMembers.isEmpty()) return@Button
                                    isCreatingChat = true
                                    errorMsg = null
                                    val ids = selectedGroupMembers.map { it._id }
                                    NetworkService.createGroupChat(token, groupName.trim(), ids) { result ->
                                        mainHandler.post {
                                            isCreatingChat = false
                                            result.fold(
                                                onSuccess = { session ->
                                                    showFabDialog = false
                                                    onSessionSelected(session._id ?: "", groupName.trim())
                                                },
                                                onFailure = { err ->
                                                    errorMsg = err.message ?: "Failed to create group"
                                                }
                                            )
                                        }
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00A884)),
                                enabled = groupName.isNotBlank() && selectedGroupMembers.isNotEmpty(),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(44.dp),
                                shape = RoundedCornerShape(12.dp)
                            ) {
                                Text("Create Group Chat", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun TabItem(
    text: String,
    isActive: Boolean,
    badgeCount: Int,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Column(
        modifier = modifier
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.Center
        ) {
            Text(
                text = text,
                color = if (isActive) Color(0xFF25D366) else Color(0xFF8696A0),
                fontSize = 12.sp,
                fontWeight = FontWeight.Bold
            )
            if (badgeCount > 0) {
                Spacer(modifier = Modifier.width(4.dp))
                Box(
                    modifier = Modifier
                        .size(15.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF25D366)),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = badgeCount.toString(),
                        color = Color(0xFF111B21),
                        fontSize = 8.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        }
        Spacer(modifier = Modifier.height(8.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(2.dp)
                .background(if (isActive) Color(0xFF25D366) else Color.Transparent)
        )
    }
}

@Composable
fun LoadingShimmerList() {
    val infiniteTransition = rememberInfiniteTransition()
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.2f,
        targetValue = 0.5f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(6) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth()
            ) {
                Box(
                    modifier = Modifier
                        .size(54.dp)
                        .clip(CircleShape)
                        .background(Color(0xFF202C33).copy(alpha = alpha))
                )
                Spacer(modifier = Modifier.width(14.dp))
                Column(modifier = Modifier.weight(1f)) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(0.42f)
                            .height(16.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xFF202C33).copy(alpha = alpha))
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(0.72f)
                            .height(13.dp)
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xFF202C33).copy(alpha = alpha))
                    )
                }
            }
        }
    }
}
