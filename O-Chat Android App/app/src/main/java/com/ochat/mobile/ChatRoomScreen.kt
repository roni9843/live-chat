package com.ochat.mobile

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import android.Manifest
import androidx.core.content.ContextCompat
import android.content.pm.PackageManager
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.*
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.ui.text.TextStyle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import java.text.SimpleDateFormat
import java.util.*
import kotlin.math.roundToInt
import androidx.compose.foundation.Image
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ChatRoomScreen(
    token: String,
    sessionId: String,
    displayName: String,
    messagesProvider: () -> List<Message>,
    userId: String,
    userName: String,
    themeColorHex: String = "#00A884",
    typingUserProvider: () -> String? = { null },
    onBack: () -> Unit,
    onSendLocalMessage: (Message) -> Unit = {},
    sessionProvider: () -> ChatSession? = { null }
) {
    val messages = messagesProvider()
    var textInput by remember { mutableStateOf("") }
    var replyingMessage by remember { mutableStateOf<Message?>(null) }
    var editingMessage by remember { mutableStateOf<Message?>(null) }
    var showProfileDialog by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()
    var highlightedMessageId by remember { mutableStateOf<String?>(null) }
    
    var isRecording by remember { mutableStateOf(false) }
    var mediaRecorder by remember { mutableStateOf<android.media.MediaRecorder?>(null) }
    var audioFile by remember { mutableStateOf<java.io.File?>(null) }
    var recordedFileForPreview by remember { mutableStateOf<java.io.File?>(null) }
    var recordingDurationSeconds by remember { mutableStateOf(0) }
    
    LaunchedEffect(isRecording) {
        if (isRecording) {
            recordingDurationSeconds = 0
            while (isRecording) {
                kotlinx.coroutines.delay(1000)
                recordingDurationSeconds++
            }
        }
    }

    val formattedDuration = remember(recordingDurationSeconds) {
        val minutes = recordingDurationSeconds / 60
        val seconds = recordingDurationSeconds % 60
        String.format("%02d:%02d", minutes, seconds)
    }
    
    var isTyping by remember { mutableStateOf(false) }
    LaunchedEffect(textInput) {
        if (textInput.isNotEmpty()) {
            if (!isTyping) {
                isTyping = true
                SocketManager.sendTypingStart(sessionId, "merchant", userId, userName)
            }
            // Debounce to stop typing indicator after 2 seconds of inactivity
            kotlinx.coroutines.delay(2000)
            isTyping = false
            SocketManager.sendTypingEnd(sessionId, "merchant", userId)
        } else {
            if (isTyping) {
                isTyping = false
                SocketManager.sendTypingEnd(sessionId, "merchant", userId)
            }
        }
    }
    
    val listState = rememberLazyListState()
    val context = LocalContext.current
    val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
    val currentSession = sessionProvider()
    val sharedPref = remember { context.getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE) }
    val userProfilePic = remember { sharedPref.getString("user_profile_pic", "") ?: "" }

    LaunchedEffect(sessionId) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
        notificationManager.cancel(sessionId.hashCode())
    }

    var localJoined by remember(sessionId) { mutableStateOf(false) }

    val isJoinedInPrefs = remember(sessionId, localJoined) {
        val set = sharedPref.getStringSet("joined_sessions", emptySet()) ?: emptySet()
        set.contains(sessionId)
    }

    val hasMerchantMessages = remember(messages) {
        messages.any { it.sender == "merchant" || (it.sender == "system" && it.content.contains("joined", ignoreCase = true)) }
    }

    val isUnassignedVisitorSession = remember(currentSession, localJoined, isJoinedInPrefs, hasMerchantMessages) {
        val isLiveVisitor = currentSession?.visitorStatus == "online" || currentSession?.visitorStatus == "minimized" || currentSession?.visitorStatus == "opened"
        val isAssigned = !currentSession?.assignedAgent.isNullOrEmpty() || localJoined || isJoinedInPrefs || hasMerchantMessages
        currentSession != null && 
        currentSession.isGroupChat != true && 
        currentSession.isDirectMessage != true && 
        !isAssigned &&
        isLiveVisitor
    }

    val recordAudioPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission(),
        onResult = { isGranted ->
            if (isGranted) {
                try {
                    val file = java.io.File(context.cacheDir, "voice_record_${System.currentTimeMillis()}.m4a")
                    audioFile = file
                    val mr = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                        android.media.MediaRecorder(context)
                    } else {
                        @Suppress("DEPRECATION")
                        android.media.MediaRecorder()
                    }.apply {
                        setAudioSource(android.media.MediaRecorder.AudioSource.MIC)
                        setOutputFormat(android.media.MediaRecorder.OutputFormat.MPEG_4)
                        setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AAC)
                        setAudioEncodingBitRate(96000)
                        setAudioSamplingRate(44100)
                        setOutputFile(file.absolutePath)
                        prepare()
                        start()
                    }
                    mediaRecorder = mr
                    isRecording = true
                    Toast.makeText(context, "Recording voice...", Toast.LENGTH_SHORT).show()
                } catch (e: Exception) {
                    e.printStackTrace()
                    Toast.makeText(context, "Failed to start recording", Toast.LENGTH_SHORT).show()
                }
            } else {
                Toast.makeText(context, "Microphone permission is required to record audio.", Toast.LENGTH_SHORT).show()
            }
        }
    )

    val themeColor = remember(themeColorHex) {
        try {
            Color(android.graphics.Color.parseColor(themeColorHex))
        } catch (e: Exception) {
            Color(0xFF00A884)
        }
    }

    var isInitialLoad by remember(sessionId) { mutableStateOf(true) }
    var lastMessageId by remember(sessionId) { mutableStateOf<String?>(null) }

    // Scroll to bottom on new messages
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            val latestMsg = messages.lastOrNull()
            val latestId = latestMsg?._id ?: latestMsg?.tempId
            if (isInitialLoad) {
                listState.scrollToItem(0)
                isInitialLoad = false
                lastMessageId = latestId
            } else if (latestId != lastMessageId) {
                listState.animateScrollToItem(0)
                lastMessageId = latestId
            }
        }
    }

    // Scroll to bottom when keyboard (IME) opens
    val imePadding = WindowInsets.ime.asPaddingValues().calculateBottomPadding()
    LaunchedEffect(imePadding) {
        if (imePadding > 0.dp && messages.isNotEmpty()) {
            listState.animateScrollToItem(0)
        }
    }

    var lastFetchedTimestamp by remember(sessionId) { mutableStateOf<String?>(null) }
    val shouldLoadMore = remember {
        derivedStateOf {
            val totalItems = messages.size
            if (totalItems == 0) return@derivedStateOf false
            val lastVisibleItem = listState.firstVisibleItemIndex + listState.layoutInfo.visibleItemsInfo.size
            lastVisibleItem >= totalItems - 3
        }
    }
    LaunchedEffect(shouldLoadMore.value) {
        if (shouldLoadMore.value) {
            val oldestMsg = messages.firstOrNull()
            val oldestTimestamp = oldestMsg?.timestamp
            if (oldestTimestamp != null && oldestTimestamp != lastFetchedTimestamp) {
                lastFetchedTimestamp = oldestTimestamp
                SocketManager.getChatHistory(sessionId, oldestTimestamp)
            }
        }
    }

    // Connect viewing session
    LaunchedEffect(sessionId) {
        SocketManager.activeSessionId = sessionId
        SocketManager.startViewingSession(sessionId, userName, userId)
        SocketManager.markAsRead(sessionId, userId)
        SocketManager.getChatHistory(sessionId)
    }

    DisposableEffect(sessionId) {
        val receiver = object : android.content.BroadcastReceiver() {
            override fun onReceive(context: Context?, intent: Intent?) {
                if (intent?.action == "com.ochat.mobile.FILE_UPLOADED") {
                    val tempId = intent.getStringExtra("tempId") ?: UUID.randomUUID().toString()
                    val isUploading = intent.getBooleanExtra("isUploading", false)
                    val isFailed = intent.getBooleanExtra("isFailed", false)
                    val fileType = intent.getStringExtra("fileType") ?: "document"
                    val fileName = intent.getStringExtra("fileName") ?: "File attachment"
 
                    if (isUploading) {
                        val localMsg = Message(
                            _id = tempId,
                            tempId = tempId,
                            sessionId = sessionId,
                            sender = "merchant",
                            senderId = userId,
                            senderName = userName,
                            content = fileName,
                            fileUrl = "",
                            fileType = fileType,
                            timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                                timeZone = TimeZone.getTimeZone("UTC")
                            }.format(Date()),
                            replyTo = replyingMessage,
                            isUploading = true
                        )
                        onSendLocalMessage(localMsg)
                    } else {
                        if (isFailed) {
                            Toast.makeText(context, "Upload failed!", Toast.LENGTH_SHORT).show()
                            return
                        }
                        val fileUrl = intent.getStringExtra("fileUrl") ?: ""
                        val localMsg = Message(
                            _id = tempId,
                            tempId = tempId,
                            sessionId = sessionId,
                            sender = "merchant",
                            senderId = userId,
                            senderName = userName,
                            content = fileName,
                            fileUrl = fileUrl,
                            fileType = fileType,
                            timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                                timeZone = TimeZone.getTimeZone("UTC")
                            }.format(Date()),
                            replyTo = replyingMessage,
                            isUploading = false
                        )
                        onSendLocalMessage(localMsg)
 
                        SocketManager.sendMessage(
                            sessionId = sessionId,
                            content = fileName,
                            senderId = userId,
                            senderName = userName,
                            replyTo = replyingMessage,
                            tempId = tempId,
                            fileUrl = fileUrl,
                            fileType = fileType
                        )
                        replyingMessage = null
                    }
                }
            }
        }
        val filter = android.content.IntentFilter("com.ochat.mobile.FILE_UPLOADED")
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_EXPORTED)
        } else {
            context.registerReceiver(receiver, filter)
        }

        onDispose {
            if (SocketManager.activeSessionId == sessionId) {
                SocketManager.activeSessionId = null
            }
            SocketManager.stopViewingSession()
            try {
                context.unregisterReceiver(receiver)
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { showProfileDialog = true } // Open profile info when clicked
                    ) {
                        val session = sessionProvider()
                        val avatarUrl = remember(session) {
                            if (session?.isGroupChat == true) {
                                session.groupImage
                            } else if (session?.isDirectMessage == true) {
                                session.dmParticipants?.firstOrNull { it.userId != userId }?.profilePic
                            } else {
                                null
                            }
                        }
                        AvatarImage(
                            displayName = displayName,
                            avatarUrl = avatarUrl,
                            modifier = Modifier.size(36.dp),
                            themeColor = themeColor
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Column {
                            val typingUser = typingUserProvider()
                            Text(displayName, color = Color.White, fontSize = 16.sp, fontWeight = FontWeight.Bold)
                            if (typingUser != null) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(2.dp)
                                ) {
                                    Text(
                                        text = "${typingUser} ",
                                        color = Color(0xFF00A884),
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Medium
                                    )
                                    AnimatedTypingDots(color = Color(0xFF00A884))
                                }
                            } else if (session != null && session.isGroupChat != true && session.isDirectMessage != true) {
                                val isOnline = session.visitorStatus == "online" || session.visitorStatus == "minimized" || session.visitorStatus == "opened"
                                val domainStr = if (!session.visitorDomain.isNullOrEmpty()) " 🌐 ${session.visitorDomain}" else ""
                                val pathStr = if (!session.visitorPath.isNullOrEmpty()) " • ${session.visitorPath}" else ""
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    if (isOnline) {
                                        val infiniteTransition = rememberInfiniteTransition(label = "pulse")
                                        val scale by infiniteTransition.animateFloat(
                                            initialValue = 0.8f, targetValue = 1.4f,
                                            animationSpec = infiniteRepeatable(
                                                animation = tween(700, easing = FastOutSlowInEasing),
                                                repeatMode = RepeatMode.Reverse
                                            ), label = "scale"
                                        )
                                        Box(
                                            modifier = Modifier
                                                .size(7.dp)
                                                .scale(scale)
                                                .background(Color(0xFF25D366), CircleShape)
                                        )
                                        Spacer(modifier = Modifier.width(4.dp))
                                    }
                                    Text(
                                        text = if (isOnline) "Active$domainStr$pathStr" else "Offline",
                                        color = if (isOnline) Color(0xFF25D366) else Color(0xFFEF4444),
                                        fontSize = 11.sp,
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis
                                    )
                                }
                            } else {
                                Text("Click here for profile info", color = Color(0xFF8696A0), fontSize = 11.sp)
                            }
                        }
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color.White)
                    }
                },
                actions = {
                    IconButton(onClick = { showProfileDialog = true }) {
                        Icon(Icons.Default.Info, contentDescription = "Visitor Profile", tint = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF1F2C34))
            )
        },
        containerColor = Color(0xFF0B141A) // WhatsApp chat background
    ) { paddingValues ->
        Column(
            modifier = Modifier
                 .fillMaxSize()
                .padding(paddingValues)
        ) {

            if (isUnassignedVisitorSession) {
                var isJoining by remember { mutableStateOf(false) }
                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF182229)),
                    shape = RoundedCornerShape(8.dp),
                    border = BorderStroke(1.dp, Color(0xFFE28B00).copy(alpha = 0.5f))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            val isLiveVisitor = currentSession?.visitorStatus == "online" || currentSession?.visitorStatus == "minimized"
                            Text(
                                text = if (isLiveVisitor) "Live Visitor Online" else "Unassigned Session",
                                color = if (isLiveVisitor) Color(0xFF25D366) else Color(0xFFE28B00),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = if (isLiveVisitor) "Do you want to start a chat with them?" else "No agent has enrolled yet. Join to chat with visitor.",
                                color = Color(0xFFE9EDEF),
                                fontSize = 11.sp
                            )
                        }
                        Button(
                            onClick = {
                                isJoining = true
                                localJoined = true
                                val currentSet = sharedPref.getStringSet("joined_sessions", emptySet()) ?: emptySet()
                                val newSet = currentSet.toMutableSet().apply { add(sessionId) }
                                sharedPref.edit().putStringSet("joined_sessions", newSet).apply()

                                if (!SocketManager.isConnected()) {
                                    Toast.makeText(context, "Reconnecting live chat server...", Toast.LENGTH_SHORT).show()
                                }
                                SocketManager.joinSession(
                                    sessionId = sessionId,
                                    agentId = userId,
                                    agentName = userName,
                                    merchantId = userId,
                                    onResult = { success, errorMsg ->
                                        isJoining = false
                                        if (success) {
                                            localJoined = true
                                            Toast.makeText(context, "Joined session successfully!", Toast.LENGTH_SHORT).show()
                                        } else {
                                            localJoined = false
                                            Toast.makeText(context, errorMsg ?: "Error joining session", Toast.LENGTH_LONG).show()
                                        }
                                    }
                                )
                            },
                            enabled = !isJoining,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00A884)),
                            shape = RoundedCornerShape(6.dp),
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                            modifier = Modifier.height(32.dp)
                        ) {
                            Text(if (isJoining) "Joining..." else "Join", color = Color(0xFF111B21), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }

            // Message Feed / Empty State
            if (messages.isEmpty()) {
                if (currentSession == null) {
                    LoadingSkeletonFeed()
                } else {
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .fillMaxWidth(),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "No messages yet",
                                color = Color(0xFFE9EDEF),
                                fontSize = 18.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = "Start the group chat by sending the first message.",
                                color = Color(0xFF8696A0),
                                fontSize = 12.sp
                            )
                        }
                    }
                }
            } else {
                LazyColumn(
                    state = listState,
                    reverseLayout = true,
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp),
                    contentPadding = PaddingValues(vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    items(messages.asReversed()) { message ->
                        if (message.sender == "system") {
                            val msgContent = message.content
                            val bgHexColor = when {
                                msgContent.contains("joined", ignoreCase = true) -> "#0F2C21"
                                msgContent.contains("left", ignoreCase = true) -> "#3C1E1E"
                                msgContent.contains("ended", ignoreCase = true) -> "#182229"
                                else -> "#1F2C34"
                            }
                            val borderHexColor = when {
                                msgContent.contains("joined", ignoreCase = true) -> "#25D366"
                                msgContent.contains("left", ignoreCase = true) -> "#EF4444"
                                msgContent.contains("ended", ignoreCase = true) -> "#E28B00"
                                else -> "#2A3942"
                            }
                            Box(
                                modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
                                contentAlignment = Alignment.Center
                            ) {
                                Card(
                                    colors = CardDefaults.cardColors(containerColor = Color(android.graphics.Color.parseColor(bgHexColor))),
                                    shape = RoundedCornerShape(12.dp),
                                    border = BorderStroke(1.dp, Color(android.graphics.Color.parseColor(borderHexColor))),
                                    modifier = Modifier.padding(horizontal = 24.dp)
                                ) {
                                    Text(
                                        text = message.content,
                                        color = Color(0xFFE9EDEF),
                                        fontSize = 11.sp,
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                                    )
                                }
                            }
                        } else {
                            val isOut = (message.senderId == userId) || (message.sender == "merchant" && (message.senderId == null || message.senderId == ""))
                            var offsetX by remember { mutableStateOf(0f) }
                            var showDropdown by remember { mutableStateOf(false) }

                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .pointerInput(message._id) {
                                        detectHorizontalDragGestures(
                                            onDragEnd = {
                                                if (offsetX > 120f) {
                                                    replyingMessage = message
                                                    editingMessage = null
                                                    Toast.makeText(context, "Replying...", Toast.LENGTH_SHORT).show()
                                                }
                                                offsetX = 0f
                                            },
                                            onDragCancel = {
                                                offsetX = 0f
                                            },
                                            onHorizontalDrag = { change, dragAmount ->
                                                change.consume()
                                                if (dragAmount > 0 || offsetX > 0) {
                                                    offsetX = (offsetX + dragAmount).coerceIn(0f, 180f)
                                                }
                                            }
                                        )
                                    }
                                    .offset { IntOffset(offsetX.roundToInt(), 0) },
                                contentAlignment = if (isOut) Alignment.CenterEnd else Alignment.CenterStart
                            ) {
                                Row(
                                    verticalAlignment = Alignment.Bottom,
                                    horizontalArrangement = if (isOut) Arrangement.End else Arrangement.Start
                                ) {
                                    if (!isOut) {
                                        val session = sessionProvider()
                                        val avatarUrl = remember(message, session) {
                                            if (session?.isGroupChat == true) {
                                                message.senderProfilePic
                                            } else if (session?.isDirectMessage == true) {
                                                session.dmParticipants?.firstOrNull { it.userId != userId }?.profilePic
                                            } else {
                                                null
                                            }
                                        }
                                        Box(
                                            modifier = Modifier
                                                .padding(end = 8.dp, bottom = 2.dp)
                                                .clickable { showProfileDialog = true }
                                        ) {
                                            AvatarImage(
                                                displayName = message.senderName ?: displayName,
                                                avatarUrl = avatarUrl,
                                                modifier = Modifier.size(28.dp),
                                                themeColor = themeColor
                                            )
                                        }
                                    }

                                    Column(
                                        modifier = Modifier
                                            .clip(
                                                RoundedCornerShape(
                                                    topStart = 12.dp,
                                                    topEnd = 12.dp,
                                                    bottomStart = if (isOut) 12.dp else 2.dp,
                                                    bottomEnd = if (isOut) 2.dp else 12.dp
                                                )
                                            )
                                            .background(
                                                if (highlightedMessageId != null && (message._id == highlightedMessageId || (message.tempId != null && message.tempId == highlightedMessageId))) {
                                                    Color(0xFF1E465A)
                                                } else {
                                                    if (isOut) themeColor else Color(0xFF202C33)
                                                }
                                            )
                                            .combinedClickable(
                                                onClick = {},
                                                onLongClick = {
                                                    showDropdown = true
                                                }
                                            )
                                            .padding(
                                                if (message.fileType == "image" && message.isDeleted != true) {
                                                    PaddingValues(4.dp)
                                                } else {
                                                    PaddingValues(horizontal = 12.dp, vertical = 8.dp)
                                                }
                                            )
                                            .widthIn(max = 260.dp)
                                    ) {
                                        if (message.replyTo != null) {
                                            Column(
                                                modifier = Modifier
                                                    .fillMaxWidth()
                                                    .background(Color(0x22000000))
                                                     .padding(6.dp)
                                                     .clip(RoundedCornerShape(4.dp))
                                                     .clickable {
                                                         val targetId = message.replyTo._id ?: message.replyTo.tempId
                                                         if (!targetId.isNullOrEmpty()) {
                                                             val targetIdx = messages.asReversed().indexOfFirst {
                                                                 it._id == targetId || (it.tempId != null && it.tempId == targetId)
                                                             }
                                                             if (targetIdx != -1) {
                                                                 coroutineScope.launch {
                                                                     listState.animateScrollToItem(targetIdx)
                                                                     highlightedMessageId = targetId
                                                                     kotlinx.coroutines.delay(1000)
                                                                     if (highlightedMessageId == targetId) {
                                                                         highlightedMessageId = null
                                                                     }
                                                                 }
                                                             }
                                                         }
                                                     }
                                            ) {
                                                Text(
                                                    text = if (message.replyTo.sender == "merchant") "You" else displayName,
                                                    color = Color(0xFF34B7F1),
                                                    fontSize = 11.sp,
                                                    fontWeight = FontWeight.Bold
                                                )
                                                Text(
                                                    text = message.replyTo.content,
                                                    color = if (isOut) Color.White.copy(alpha = 0.8f) else Color(0xFF8696A0),
                                                    fontSize = 12.sp,
                                                    maxLines = 1,
                                                    overflow = TextOverflow.Ellipsis
                                                )
                                            }
                                            Spacer(modifier = Modifier.height(4.dp))
                                        }

                                        if (!isOut && message.senderName != null) {
                                            Text(
                                                text = message.senderName,
                                                color = Color(0xFF34B7F1),
                                                fontSize = 11.sp,
                                                fontWeight = FontWeight.Bold,
                                                modifier = Modifier.padding(bottom = 2.dp)
                                            )
                                        }

                                          if (message.isUploading) {
                                              Row(
                                                  verticalAlignment = Alignment.CenterVertically,
                                                  horizontalArrangement = Arrangement.spacedBy(8.dp)
                                              ) {
                                                  CircularProgressIndicator(
                                                      color = Color.White,
                                                      modifier = Modifier.size(16.dp),
                                                      strokeWidth = 2.dp
                                                  )
                                                  Text(
                                                      text = "Uploading ${message.fileType ?: "file"}...",
                                                      color = Color.White,
                                                      fontSize = 14.sp
                                                  )
                                              }
                                          } else if (message.isDeleted == true) {
                                             Text(
                                                 text = "This message was deleted",
                                                 color = if (isOut) Color.White.copy(alpha = 0.7f) else Color(0xFF8696A0),
                                                 fontSize = 15.sp,
                                                 fontStyle = androidx.compose.ui.text.font.FontStyle.Italic
                                             )
                                         } else if (!message.fileUrl.isNullOrEmpty()) {
                                             when (message.fileType) {
                                                 "image" -> {
                                                     AsyncBitmapImage(
                                                         url = message.fileUrl,
                                                         modifier = Modifier
                                                             .fillMaxWidth()
                                                             .heightIn(max = 200.dp)
                                                             .clip(RoundedCornerShape(8.dp))
                                                             .clickable {
                                                                 val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(message.fileUrl))
                                                                 browserIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                                                 context.startActivity(browserIntent)
                                                             }
                                                     )
                                                 }
                                                 "audio" -> {
                                                     AudioAttachmentPlayer(fileUrl = message.fileUrl, isOut = isOut)
                                                 }
                                                 "video" -> {
                                                     FileAttachmentCard(fileName = message.content.ifEmpty { "Play Video" }, fileUrl = message.fileUrl, icon = "▶ 🎥", isOut = isOut)
                                                 }
                                                 else -> {
                                                     FileAttachmentCard(fileName = message.content.ifEmpty { "Attachment File" }, fileUrl = message.fileUrl, icon = "📄", isOut = isOut)
                                                 }
                                             }
                                         } else {
                                             Text(
                                                 text = message.content,
                                                 color = Color.White,
                                                 fontSize = 15.sp
                                             )
                                         }

                                        message.timestamp?.let { ts ->
                                            var displayTime = ""
                                            try {
                                                val date = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                                                    timeZone = TimeZone.getTimeZone("UTC")
                                                }.parse(ts)
                                                displayTime = SimpleDateFormat("hh:mm a", Locale.getDefault()).format(date ?: Date())
                                            } catch (e: Exception) {
                                                // Fallback
                                            }
                                            if (displayTime.isNotEmpty()) {
                                                Row(
                                                    verticalAlignment = Alignment.CenterVertically,
                                                    horizontalArrangement = Arrangement.End,
                                                    modifier = Modifier.align(Alignment.End).padding(top = 2.dp)
                                                ) {
                                                    Text(
                                                        text = displayTime,
                                                        color = Color(0x99FFFFFF),
                                                        fontSize = 10.sp
                                                    )
                                                    if (message.tempId != null && message.tempId == message._id) {
                                                        Spacer(modifier = Modifier.width(4.dp))
                                                        CircularProgressIndicator(
                                                            color = Color.White.copy(alpha = 0.6f),
                                                            strokeWidth = 1.dp,
                                                            modifier = Modifier.size(10.dp)
                                                        )
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    DropdownMenu(
                                        expanded = showDropdown,
                                        onDismissRequest = { showDropdown = false },
                                        modifier = Modifier.background(Color(0xFF2A3942))
                                    ) {
                                        DropdownMenuItem(
                                            text = { Text("Reply", color = Color.White) },
                                            onClick = {
                                                replyingMessage = message
                                                editingMessage = null
                                                showDropdown = false
                                            }
                                        )
                                        if (message.fileUrl.isNullOrEmpty()) {
                                            DropdownMenuItem(
                                                text = { Text("Copy", color = Color.White) },
                                                onClick = {
                                                    val clip = ClipData.newPlainText("message", message.content)
                                                    clipboard.setPrimaryClip(clip)
                                                    showDropdown = false
                                                    Toast.makeText(context, "Copied!", Toast.LENGTH_SHORT).show()
                                                }
                                            )
                                        }
                                        if (isOut && message.isDeleted != true && message.fileUrl.isNullOrEmpty()) {
                                            DropdownMenuItem(
                                                text = { Text("Edit", color = Color.White) },
                                                onClick = {
                                                    editingMessage = message
                                                    replyingMessage = null
                                                    textInput = message.content
                                                    showDropdown = false
                                                }
                                            )
                                            DropdownMenuItem(
                                                text = { Text("Delete", color = Color(0xFFF87171)) },
                                                onClick = {
                                                    message._id?.let { msgId ->
                                                        SocketManager.deleteMessage(msgId, sessionId, userId)
                                                    }
                                                    showDropdown = false
                                                }
                                            )
                                        }
                                    }
                                }
                            }
                        }
                    }

                    item {
                        Box(
                            modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            TextButton(
                                onClick = {
                                    if (!SocketManager.isConnected()) {
                                        Toast.makeText(context, "Reconnecting chat...", Toast.LENGTH_SHORT).show()
                                        SocketManager.connect(userId)
                                    }
                                    val oldestMsg = messages.firstOrNull()
                                    val oldestTimestamp = oldestMsg?.timestamp
                                    if (oldestTimestamp != null) {
                                        SocketManager.getChatHistory(sessionId, oldestTimestamp)
                                    } else {
                                        SocketManager.getChatHistory(sessionId)
                                    }
                                }
                            ) {
                                Text("Load Older Messages 🔄", color = Color(0xFF00A884), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }
                        }
                    }

                    item {
                        val session = sessionProvider()
                        if (session != null && session.isGroupChat != true && session.isDirectMessage != true) {
                            VisitorInfoCard(session)
                        }
                    }
                }
            }

            // Typing bubble — shown below messages when other party is typing
            val typingUser = typingUserProvider()
            AnimatedVisibility(
                visible = typingUser != null,
                enter = androidx.compose.animation.fadeIn() + androidx.compose.animation.slideInVertically { it },
                exit = androidx.compose.animation.fadeOut() + androidx.compose.animation.slideOutVertically { it }
            ) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.Start
                ) {
                    AvatarImage(
                        displayName = typingUser ?: displayName,
                        avatarUrl = null,
                        modifier = Modifier.size(26.dp),
                        themeColor = Color(0xFF657786)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Box(
                        modifier = Modifier
                            .background(Color(0xFF202C33), RoundedCornerShape(topStart = 12.dp, topEnd = 12.dp, bottomStart = 2.dp, bottomEnd = 12.dp))
                            .padding(horizontal = 14.dp, vertical = 10.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        AnimatedTypingDots(color = Color(0xFF8696A0), dotSize = 8.dp)
                    }
                }
            }

            // Reply Preview Banner
            replyingMessage?.let { msg ->

                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1D2A32))
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Replying to ${if (msg.sender == "merchant") "You" else displayName}",
                            color = Color(0xFF34B7F1),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = msg.content,
                            color = Color(0xFF8696A0),
                            fontSize = 13.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    IconButton(onClick = { replyingMessage = null }) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = Color(0xFFF87171))
                    }
                }
            }

            // Edit Preview Banner
            editingMessage?.let { msg ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(Color(0xFF1D2A32))
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "Editing message",
                            color = Color(0xFF00A884),
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = msg.content,
                            color = Color(0xFF8696A0),
                            fontSize = 13.sp,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis
                        )
                    }
                    IconButton(onClick = { 
                        editingMessage = null
                        textInput = ""
                    }) {
                        Icon(Icons.Default.Close, contentDescription = "Close", tint = Color(0xFFF87171))
                    }
                }
            }
            if (recordedFileForPreview != null) {
                var isPlaying by remember { mutableStateOf(false) }
                var mediaPlayer by remember { mutableStateOf<android.media.MediaPlayer?>(null) }
                var currentPos by remember { mutableStateOf(0f) }
                val totalDur = remember(recordedFileForPreview) {
                    val file = recordedFileForPreview
                    if (file != null) {
                        try {
                            val retriever = android.media.MediaMetadataRetriever()
                            retriever.setDataSource(file.absolutePath)
                            val timeStr = retriever.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION)
                            retriever.release()
                            timeStr?.toFloat() ?: 1f
                        } catch (e: Exception) {
                            1f
                        }
                    } else {
                        1f
                    }
                }

                DisposableEffect(recordedFileForPreview) {
                    onDispose {
                        mediaPlayer?.release()
                    }
                }

                LaunchedEffect(isPlaying, mediaPlayer) {
                    if (isPlaying && mediaPlayer != null) {
                        while (isPlaying) {
                            currentPos = mediaPlayer?.currentPosition?.toFloat() ?: 0f
                            kotlinx.coroutines.delay(100)
                        }
                    }
                }

                val formatTime = { ms: Float ->
                    val totalSecs = (ms / 1000).toInt()
                    val mins = totalSecs / 60
                    val secs = totalSecs % 60
                    String.format("%02d:%02d", mins, secs)
                }

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(8.dp),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
                    shape = RoundedCornerShape(24.dp),
                    border = BorderStroke(1.dp, Color(0xFF2A3942).copy(alpha = 0.5f))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        IconButton(
                            onClick = {
                                mediaPlayer?.stop()
                                mediaPlayer?.release()
                                mediaPlayer = null
                                isPlaying = false
                                recordedFileForPreview?.delete()
                                recordedFileForPreview = null
                            }
                        ) {
                            Icon(Icons.Default.Delete, contentDescription = "Discard", tint = Color(0xFFEF4444))
                        }

                        IconButton(
                            onClick = {
                                val mp = mediaPlayer
                                if (isPlaying && mp != null) {
                                    mp.pause()
                                    isPlaying = false
                                } else {
                                    if (mp == null) {
                                        val newMp = android.media.MediaPlayer().apply {
                                            try {
                                                setAudioStreamType(android.media.AudioManager.STREAM_MUSIC)
                                                setDataSource(recordedFileForPreview!!.absolutePath)
                                                prepare()
                                                start()
                                                setOnCompletionListener {
                                                    isPlaying = false
                                                    currentPos = 0f
                                                }
                                            } catch (e: Exception) {
                                                e.printStackTrace()
                                            }
                                        }
                                        mediaPlayer = newMp
                                    } else {
                                        mp.start()
                                    }
                                    isPlaying = true
                                }
                            }
                        ) {
                            Icon(
                                imageVector = if (isPlaying) Icons.Default.Close else Icons.Default.PlayArrow,
                                contentDescription = if (isPlaying) "Pause" else "Play",
                                tint = Color.White
                            )
                        }

                        Text(
                            text = "${formatTime(currentPos)} / ${formatTime(totalDur)}",
                            color = Color(0xFF8696A0),
                            fontSize = 11.sp
                        )

                        Slider(
                            value = currentPos,
                            onValueChange = { pos ->
                                currentPos = pos
                                mediaPlayer?.seekTo(pos.toInt())
                            },
                            valueRange = 0f..totalDur,
                            modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                            colors = SliderDefaults.colors(
                                thumbColor = themeColor,
                                activeTrackColor = themeColor,
                                inactiveTrackColor = Color(0xFF2A3942)
                            )
                        )

                        IconButton(
                            onClick = {
                                mediaPlayer?.stop()
                                mediaPlayer?.release()
                                mediaPlayer = null
                                isPlaying = false
                                
                                val file = recordedFileForPreview!!
                                recordedFileForPreview = null
                                Toast.makeText(context, "Uploading voice...", Toast.LENGTH_SHORT).show()
                                val mediaType = "audio/m4a".toMediaTypeOrNull()
                                NetworkService.uploadFile(file, mediaType) { result ->
                                    result.fold(
                                        onSuccess = { fileUrl ->
                                            val tempId = UUID.randomUUID().toString()
                                            val localMsg = Message(
                                                _id = tempId,
                                                tempId = tempId,
                                                sessionId = sessionId,
                                                sender = "merchant",
                                                senderId = userId,
                                                senderName = userName,
                                                content = "Voice Message",
                                                fileUrl = fileUrl,
                                                fileType = "audio",
                                                timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                                                    timeZone = TimeZone.getTimeZone("UTC")
                                                }.format(Date()),
                                                replyTo = replyingMessage
                                            )
                                            onSendLocalMessage(localMsg)

                                            SocketManager.sendMessage(
                                                sessionId = sessionId,
                                                content = "Voice Message",
                                                senderId = userId,
                                                senderName = userName,
                                                replyTo = replyingMessage,
                                                tempId = tempId,
                                                fileUrl = fileUrl,
                                                fileType = "audio",
                                                senderProfilePic = userProfilePic
                                            )
                                            replyingMessage = null
                                        },
                                        onFailure = { error ->
                                            android.util.Log.e("ChatRoomScreen", "Voice upload failed", error)
                                        }
                                    )
                                }
                            },
                            modifier = Modifier
                                .size(36.dp)
                                .background(themeColor, CircleShape)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Send,
                                contentDescription = "Send Voice",
                                tint = Color.White,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            } else {
                val isSessionClosed = currentSession?.status == "closed"
                if (isSessionClosed) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF1F2C34))
                            .padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "This chat session has ended.",
                            color = Color(0xFFEF4444),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                } else if (isUnassignedVisitorSession) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF1F2C34))
                            .padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text(
                            text = "Join this session to start chatting",
                            color = Color(0xFF8696A0),
                            fontSize = 14.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                } else {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF111B21))
                            .padding(horizontal = 8.dp, vertical = 8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        if (isRecording) {
                            IconButton(
                                onClick = {
                                    try {
                                        mediaRecorder?.stop()
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                    }
                                    mediaRecorder?.release()
                                    mediaRecorder = null
                                    isRecording = false
                                    audioFile?.delete()
                                    audioFile = null
                                    Toast.makeText(context, "Recording discarded", Toast.LENGTH_SHORT).show()
                                }
                            ) {
                                Icon(Icons.Default.Delete, contentDescription = "Discard Recording", tint = Color(0xFFEF4444))
                            }

                            val pulseTransition = rememberInfiniteTransition(label = "pulse")
                            val pulseScale by pulseTransition.animateFloat(
                                initialValue = 1.0f,
                                targetValue = 1.4f,
                                animationSpec = infiniteRepeatable(
                                    animation = tween(800, easing = LinearOutSlowInEasing),
                                    repeatMode = RepeatMode.Restart
                                ),
                                label = "scale"
                            )

                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier
                                    .weight(1f)
                                    .background(Color(0xFF1F2C34), RoundedCornerShape(24.dp))
                                    .padding(horizontal = 16.dp, vertical = 10.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(8.dp)
                                        .scale(pulseScale)
                                        .background(Color.Red, CircleShape)
                                )
                                Spacer(modifier = Modifier.width(8.dp))
                                Text("Recording Voice $formattedDuration", color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                            }

                            Spacer(modifier = Modifier.width(8.dp))

                            IconButton(
                                onClick = {
                                    try {
                                        mediaRecorder?.stop()
                                    } catch (e: Exception) {
                                        e.printStackTrace()
                                    }
                                    mediaRecorder?.release()
                                    mediaRecorder = null
                                    isRecording = false

                                    val file = audioFile
                                    if (file != null && file.exists() && file.length() > 0) {
                                        recordedFileForPreview = file
                                    }
                                },
                                modifier = Modifier
                                    .size(44.dp)
                                    .background(Color.Red, CircleShape)
                            ) {
                                Icon(Icons.Default.Close, contentDescription = "Stop", tint = Color.White)
                            }
                        } else {
                            Row(
                                modifier = Modifier
                                    .weight(1f)
                                    .background(Color(0xFF1F2C34), RoundedCornerShape(24.dp))
                                    .padding(horizontal = 10.dp, vertical = 2.dp),
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                IconButton(
                                    onClick = {
                                        val fileIntent = Intent(context, FilePickerActivity::class.java).apply {
                                            flags = Intent.FLAG_ACTIVITY_NEW_TASK
                                            putExtra("type", "*/*")
                                        }
                                        context.startActivity(fileIntent)
                                    }
                                ) {
                                    Text("📎", color = Color(0xFF8696A0), fontSize = 20.sp)
                                }

                                BasicTextField(
                                    value = textInput,
                                    onValueChange = { textInput = it },
                                    textStyle = TextStyle(color = Color.White, fontSize = 15.sp),
                                    modifier = Modifier
                                        .weight(1f)
                                        .padding(vertical = 12.dp, horizontal = 4.dp),
                                    decorationBox = { innerTextField ->
                                        if (textInput.isEmpty()) {
                                            Text("Type a message...", color = Color(0xFF8696A0), fontSize = 15.sp)
                                        }
                                        innerTextField()
                                    }
                                )
                            }

                            Spacer(modifier = Modifier.width(8.dp))

                            if (textInput.isNotBlank()) {
                                IconButton(
                                    onClick = {
                                        if (textInput.isNotBlank()) {
                                            val editMsg = editingMessage
                                            if (editMsg != null) {
                                                editMsg._id?.let { msgId ->
                                                    SocketManager.editMessage(msgId, textInput.trim(), sessionId, userId)
                                                }
                                                editingMessage = null
                                            } else {
                                                val tempId = UUID.randomUUID().toString()
                                                val localMsg = Message(
                                                    _id = tempId,
                                                    tempId = tempId,
                                                    sessionId = sessionId,
                                                    sender = "merchant",
                                                    senderId = userId,
                                                    senderName = userName,
                                                    content = textInput.trim(),
                                                    timestamp = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
                                                        timeZone = TimeZone.getTimeZone("UTC")
                                                    }.format(Date()),
                                                    replyTo = replyingMessage
                                                )
                                                onSendLocalMessage(localMsg)

                                                SocketManager.sendMessage(
                                                    sessionId = sessionId,
                                                    content = textInput.trim(),
                                                    senderId = userId,
                                                    senderName = userName,
                                                    replyTo = replyingMessage,
                                                    tempId = tempId,
                                                    senderProfilePic = userProfilePic
                                                )
                                                replyingMessage = null
                                            }
                                            textInput = ""
                                        }
                                    },
                                    modifier = Modifier
                                        .size(44.dp)
                                        .background(themeColor, CircleShape)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Send,
                                        contentDescription = "Send",
                                        tint = Color.White,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                            } else {
                                IconButton(
                                    onClick = {
                                        val micPermission = Manifest.permission.RECORD_AUDIO
                                        val hasMicPermission = ContextCompat.checkSelfPermission(context, micPermission) == PackageManager.PERMISSION_GRANTED
                                        if (hasMicPermission) {
                                            try {
                                                val file = java.io.File(context.cacheDir, "voice_record_${System.currentTimeMillis()}.m4a")
                                                audioFile = file
                                                val mr = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.S) {
                                                    android.media.MediaRecorder(context)
                                                } else {
                                                    @Suppress("DEPRECATION")
                                                    android.media.MediaRecorder()
                                                }.apply {
                                                    setAudioSource(android.media.MediaRecorder.AudioSource.MIC)
                                                    setOutputFormat(android.media.MediaRecorder.OutputFormat.MPEG_4)
                                                    setAudioEncoder(android.media.MediaRecorder.AudioEncoder.AAC)
                                                    setAudioEncodingBitRate(96000)
                                                    setAudioSamplingRate(44100)
                                                    setOutputFile(file.absolutePath)
                                                    prepare()
                                                    start()
                                                }
                                                mediaRecorder = mr
                                                isRecording = true
                                                Toast.makeText(context, "Recording voice...", Toast.LENGTH_SHORT).show()
                                            } catch (e: Exception) {
                                                e.printStackTrace()
                                                Toast.makeText(context, "Mic access required", Toast.LENGTH_SHORT).show()
                                            }
                                        } else {
                                            recordAudioPermissionLauncher.launch(micPermission)
                                        }
                                    },
                                    modifier = Modifier
                                        .size(44.dp)
                                        .background(themeColor, CircleShape)
                                ) {
                                    Text(
                                        text = "🎤",
                                        color = Color.White,
                                        fontSize = 18.sp
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Group / Visitor Profile Info Dialog
    if (showProfileDialog) {
        val session = sessionProvider()
        val isGroup = session?.isGroupChat == true

        if (isGroup && session != null) {
            val myParticipantObj = session.dmParticipants?.find { it.userId == userId }
            val isGroupAdmin = myParticipantObj?.role == "admin"

            var groupNameInput by remember(session) { mutableStateOf(session.groupName ?: "") }
            var isSettingsLoading by remember { mutableStateOf(false) }
            var emailSearchQuery by remember { mutableStateOf("") }
            var searchResults by remember { mutableStateOf(listOf<User>()) }
            var isSearching by remember { mutableStateOf(false) }

            val groupImagePickerLauncher = rememberLauncherForActivityResult(
                contract = ActivityResultContracts.GetContent()
            ) { uri: Uri? ->
                if (uri != null) {
                    isSettingsLoading = true
                    val tempFile = java.io.File(context.cacheDir, "group_${System.currentTimeMillis()}.png")
                    try {
                        context.contentResolver.openInputStream(uri)?.use { input ->
                            tempFile.outputStream().use { output ->
                                input.copyTo(output)
                            }
                        }
                        val mediaType = "image/png".toMediaTypeOrNull()
                        NetworkService.uploadFile(tempFile, mediaType) { result ->
                            android.os.Handler(android.os.Looper.getMainLooper()).post {
                                result.fold(
                                    onSuccess = { fileUrl ->
                                        NetworkService.updateGroupSettings(token, sessionId, null, fileUrl) { updateResult ->
                                            android.os.Handler(android.os.Looper.getMainLooper()).post {
                                                isSettingsLoading = false
                                                updateResult.fold(
                                                    onSuccess = {
                                                        Toast.makeText(context, "Group picture updated!", Toast.LENGTH_SHORT).show()
                                                    },
                                                    onFailure = { err ->
                                                        Toast.makeText(context, "Failed to save group picture: ${err.message}", Toast.LENGTH_LONG).show()
                                                    }
                                                )
                                            }
                                        }
                                    },
                                    onFailure = { err ->
                                        isSettingsLoading = false
                                        Toast.makeText(context, "Upload failed: ${err.message}", Toast.LENGTH_LONG).show()
                                    }
                                )
                            }
                        }
                    } catch (e: Exception) {
                        isSettingsLoading = false
                        Toast.makeText(context, "File copy failed: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
            }

            Dialog(onDismissRequest = { showProfileDialog = false }) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .fillMaxHeight(0.85f)
                        .padding(8.dp),
                    border = BorderStroke(1.dp, Color(0xFF2A3942))
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(20.dp)
                    ) {
                        // Title
                        Text(
                            text = "Group Details",
                            color = Color.White,
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.padding(bottom = 12.dp)
                        )

                        // Scrollable Settings Content
                        Column(
                            modifier = Modifier
                                .weight(1f)
                                .verticalScroll(androidx.compose.foundation.rememberScrollState()),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            // Avatar
                            Box(
                                modifier = Modifier
                                    .size(100.dp)
                                    .clip(CircleShape)
                                    .border(2.dp, themeColor, CircleShape)
                                    .clickable(enabled = isGroupAdmin) { groupImagePickerLauncher.launch("image/*") },
                                contentAlignment = Alignment.Center
                            ) {
                                AvatarImage(
                                    displayName = session.groupName ?: "Group",
                                    avatarUrl = session.groupImage,
                                    modifier = Modifier.size(100.dp),
                                    themeColor = themeColor
                                )
                                if (isGroupAdmin) {
                                    Box(
                                        modifier = Modifier
                                            .fillMaxSize()
                                            .background(Color.Black.copy(alpha = 0.35f)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text("Edit ✏️", color = Color.White, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(12.dp))

                            // Editable Name Field for Admin, Text for Member
                            if (isGroupAdmin) {
                                OutlinedTextField(
                                    value = groupNameInput,
                                    onValueChange = { groupNameInput = it },
                                    label = { Text("Group Subject", color = themeColor) },
                                    modifier = Modifier.fillMaxWidth(),
                                    singleLine = true,
                                    colors = OutlinedTextFieldDefaults.colors(
                                        focusedBorderColor = themeColor,
                                        unfocusedBorderColor = Color(0xFF2A3942),
                                        focusedTextColor = Color.White,
                                        unfocusedTextColor = Color.White
                                    ),
                                    trailingIcon = {
                                        IconButton(
                                            onClick = {
                                                if (groupNameInput.isBlank()) return@IconButton
                                                isSettingsLoading = true
                                                NetworkService.updateGroupSettings(token, sessionId, groupNameInput.trim(), null) { result ->
                                                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                                                        isSettingsLoading = false
                                                        result.fold(
                                                            onSuccess = {
                                                                Toast.makeText(context, "Group name updated!", Toast.LENGTH_SHORT).show()
                                                            },
                                                            onFailure = { err ->
                                                                Toast.makeText(context, "Update failed: ${err.message}", Toast.LENGTH_LONG).show()
                                                            }
                                                        )
                                                    }
                                                }
                                            }
                                        ) {
                                            Text("💾", fontSize = 18.sp)
                                        }
                                    }
                                )
                            } else {
                                Text(
                                    text = session.groupName ?: "Group Chat",
                                    color = Color.White,
                                    fontSize = 20.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Spacer(modifier = Modifier.height(16.dp))
                            Divider(color = Color(0xFF2A3942))
                            Spacer(modifier = Modifier.height(12.dp))

                            // Members Section
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "MEMBERS (${session.dmParticipants?.size ?: 0})",
                                    color = themeColor,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold
                                )
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            // Member List Rows
                            session.dmParticipants?.forEach { member ->
                                val isMe = member.userId == userId
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 6.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    AvatarImage(
                                        displayName = member.name ?: "User",
                                        avatarUrl = member.profilePic,
                                        modifier = Modifier.size(32.dp),
                                        themeColor = themeColor
                                    )
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(
                                            text = if (isMe) "${member.name} (You)" else (member.name ?: "User"),
                                            color = Color.White,
                                            fontSize = 14.sp,
                                            fontWeight = FontWeight.Medium
                                        )
                                        Text(
                                            text = member.role?.uppercase(Locale.getDefault()) ?: "MEMBER",
                                            color = if (member.role == "admin") Color(0xFF25D366) else Color(0xFF8696A0),
                                            fontSize = 11.sp,
                                            fontWeight = FontWeight.Bold
                                        )
                                    }

                                    // Actions for Admins
                                    if (isGroupAdmin && !isMe) {
                                        Row(verticalAlignment = Alignment.CenterVertically) {
                                            // Toggle Admin Role
                                            TextButton(
                                                onClick = {
                                                    val newRole = if (member.role == "admin") "member" else "admin"
                                                    isSettingsLoading = true
                                                    NetworkService.updateGroupMember(token, sessionId, member.userId ?: "", null, null, newRole) { result ->
                                                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                                                            isSettingsLoading = false
                                                            result.fold(
                                                                onSuccess = {
                                                                    Toast.makeText(context, "Role updated!", Toast.LENGTH_SHORT).show()
                                                                },
                                                                onFailure = { err ->
                                                                    Toast.makeText(context, "Failed: ${err.message}", Toast.LENGTH_LONG).show()
                                                                }
                                                            )
                                                        }
                                                    }
                                                },
                                                contentPadding = PaddingValues(horizontal = 6.dp, vertical = 2.dp)
                                            ) {
                                                Text(
                                                    text = if (member.role == "admin") "Demote" else "Promote",
                                                    color = themeColor,
                                                    fontSize = 11.sp
                                                )
                                            }

                                            // Kick Member Button
                                            IconButton(
                                                onClick = {
                                                    isSettingsLoading = true
                                                    NetworkService.kickGroupMember(token, sessionId, member.userId ?: "") { result ->
                                                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                                                            isSettingsLoading = false
                                                            result.fold(
                                                                onSuccess = {
                                                                    Toast.makeText(context, "Member removed!", Toast.LENGTH_SHORT).show()
                                                                },
                                                                onFailure = { err ->
                                                                    Toast.makeText(context, "Failed: ${err.message}", Toast.LENGTH_LONG).show()
                                                                }
                                                            )
                                                        }
                                                    }
                                                }
                                            ) {
                                                Text("❌", fontSize = 11.sp)
                                            }
                                        }
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(16.dp))
                            Divider(color = Color(0xFF2A3942))
                            Spacer(modifier = Modifier.height(12.dp))

                            // Search / Add Member Section for Admin
                            if (isGroupAdmin) {
                                Text(
                                    text = "ADD NEW MEMBER",
                                    color = themeColor,
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.align(Alignment.Start)
                                )

                                Spacer(modifier = Modifier.height(8.dp))

                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    OutlinedTextField(
                                        value = emailSearchQuery,
                                        onValueChange = { emailSearchQuery = it },
                                        placeholder = { Text("Search by email...", color = Color(0xFF8696A0), fontSize = 13.sp) },
                                        modifier = Modifier.weight(1f),
                                        singleLine = true,
                                        colors = OutlinedTextFieldDefaults.colors(
                                            focusedBorderColor = themeColor,
                                            unfocusedBorderColor = Color(0xFF2A3942),
                                            focusedTextColor = Color.White,
                                            unfocusedTextColor = Color.White
                                        )
                                    )

                                    Spacer(modifier = Modifier.width(8.dp))

                                    Button(
                                        onClick = {
                                            if (emailSearchQuery.isBlank()) return@Button
                                            isSearching = true
                                            NetworkService.searchMerchants(token, emailSearchQuery.trim()) { result ->
                                                android.os.Handler(android.os.Looper.getMainLooper()).post {
                                                    isSearching = false
                                                    result.fold(
                                                        onSuccess = { list ->
                                                            searchResults = list
                                                        },
                                                        onFailure = { err ->
                                                            Toast.makeText(context, "Search failed: ${err.message}", Toast.LENGTH_LONG).show()
                                                        }
                                                    )
                                                }
                                            }
                                        },
                                        colors = ButtonDefaults.buttonColors(containerColor = themeColor)
                                    ) {
                                        Text("Search", color = Color.White, fontSize = 11.sp)
                                    }
                                }

                                if (isSearching) {
                                    CircularProgressIndicator(color = themeColor, modifier = Modifier.size(24.dp).padding(top = 10.dp))
                                }

                                searchResults.forEach { targetUser ->
                                    val isAlreadyInGroup = session.dmParticipants?.any { it.userId == targetUser._id } == true
                                    Row(
                                        modifier = Modifier
                                            .fillMaxWidth()
                                            .padding(vertical = 6.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.SpaceBetween
                                    ) {
                                        Column {
                                            Text(targetUser.name, color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                            Text(targetUser.email, color = Color(0xFF8696A0), fontSize = 11.sp)
                                        }

                                        if (isAlreadyInGroup) {
                                            Text("Added", color = Color(0xFF8696A0), fontSize = 12.sp)
                                        } else {
                                            Button(
                                                onClick = {
                                                    isSettingsLoading = true
                                                    NetworkService.updateGroupMember(token, sessionId, targetUser._id, targetUser.name, null, "member", targetUser.profilePic) { result ->
                                                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                                                            isSettingsLoading = false
                                                            result.fold(
                                                                onSuccess = {
                                                                    Toast.makeText(context, "${targetUser.name} added!", Toast.LENGTH_SHORT).show()
                                                                    searchResults = searchResults.filter { it._id != targetUser._id }
                                                                },
                                                                onFailure = { err ->
                                                                    Toast.makeText(context, "Failed to add: ${err.message}", Toast.LENGTH_LONG).show()
                                                                }
                                                            )
                                                        }
                                                    }
                                                },
                                                colors = ButtonDefaults.buttonColors(containerColor = themeColor),
                                                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 2.dp)
                                            ) {
                                                Text("Add", color = Color.White, fontSize = 11.sp)
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        // Bottom Actions (Leave & Close)
                        Divider(color = Color(0xFF2A3942), modifier = Modifier.padding(vertical = 12.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Button(
                                onClick = {
                                    isSettingsLoading = true
                                    NetworkService.leaveGroupChat(token, sessionId) { result ->
                                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                                            isSettingsLoading = false
                                            result.fold(
                                                onSuccess = {
                                                    Toast.makeText(context, "Left group chat!", Toast.LENGTH_SHORT).show()
                                                    showProfileDialog = false
                                                    onBack()
                                                },
                                                onFailure = { err ->
                                                    Toast.makeText(context, "Failed to leave: ${err.message}", Toast.LENGTH_LONG).show()
                                                }
                                            )
                                        }
                                    }
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                                shape = RoundedCornerShape(8.dp)
                            ) {
                                Text("Leave Group", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                            }

                            TextButton(onClick = { showProfileDialog = false }) {
                                Text("Close", color = Color(0xFF8696A0), fontSize = 14.sp)
                            }
                        }
                    }
                }
            }
        } else {
            Dialog(onDismissRequest = { showProfileDialog = false }) {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
                    shape = RoundedCornerShape(16.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(16.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        // Large Avatar
                        Box(
                            modifier = Modifier
                                .size(80.dp)
                                .clip(CircleShape)
                                .background(themeColor),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = displayName.take(1).uppercase(Locale.getDefault()),
                                color = Color.White,
                                fontWeight = FontWeight.Bold,
                                fontSize = 32.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))

                        Text(
                            text = displayName,
                            color = Color.White,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold
                        )

                        Text(
                            text = "Session ID: $sessionId",
                            color = Color(0xFF8696A0),
                            fontSize = 12.sp,
                            modifier = Modifier.padding(top = 4.dp)
                        )

                        if (session != null) {
                            session.visitorEmail?.takeIf { it.isNotEmpty() }?.let { email ->
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Email: $email",
                                    color = Color.White,
                                    fontSize = 14.sp
                                )
                            }
                            session.visitorPhone?.takeIf { it.isNotEmpty() }?.let { phone ->
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Phone: $phone",
                                    color = Color.White,
                                    fontSize = 14.sp
                                )
                            }
                            session.visitorDomain?.takeIf { it.isNotEmpty() }?.let { domain ->
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Website: $domain",
                                    color = Color.White,
                                    fontSize = 14.sp
                                )
                            }
                            session.visitorPath?.takeIf { it.isNotEmpty() }?.let { path ->
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Page: $path",
                                    color = Color.White,
                                    fontSize = 14.sp
                                )
                            }
                            session.visitorDetails?.takeIf { it.isNotEmpty() }?.let { details ->
                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Platform: $details",
                                    color = Color(0xFF8696A0),
                                    fontSize = 11.sp,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }

                        Divider(
                            color = Color(0xFF2A3942),
                            thickness = 1.dp,
                            modifier = Modifier.padding(vertical = 16.dp)
                        )

                        Spacer(modifier = Modifier.height(8.dp))

                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            if (currentSession?.isDirectMessage != true) {
                                Button(
                                    onClick = {
                                        SocketManager.closeSession(sessionId)
                                        Toast.makeText(context, "Session ended", Toast.LENGTH_SHORT).show()
                                        showProfileDialog = false
                                        onBack()
                                    },
                                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444)),
                                    shape = RoundedCornerShape(8.dp)
                                ) {
                                    Text("End Session", color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.Bold)
                                }
                            }

                            TextButton(onClick = { showProfileDialog = false }) {
                                Text("Close", color = Color(0xFF8696A0))
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun LoadingSkeletonFeed() {
    val infiniteTransition = rememberInfiniteTransition()
    val alpha by infiniteTransition.animateFloat(
        initialValue = 0.3f,
        targetValue = 0.7f,
        animationSpec = infiniteRepeatable(
            animation = tween(1000, easing = LinearEasing),
            repeatMode = RepeatMode.Reverse
        )
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        SkeletonBubble(isOut = false, widthFraction = 0.7f, alpha = alpha)
        SkeletonBubble(isOut = true, widthFraction = 0.5f, alpha = alpha)
        SkeletonBubble(isOut = false, widthFraction = 0.8f, alpha = alpha)
        SkeletonBubble(isOut = true, widthFraction = 0.6f, alpha = alpha)
    }
}

@Composable
fun SkeletonBubble(isOut: Boolean, widthFraction: Float, alpha: Float) {
    Box(
        modifier = Modifier.fillMaxWidth(),
        contentAlignment = if (isOut) Alignment.CenterEnd else Alignment.CenterStart
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth(widthFraction)
                .height(56.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(
                    if (isOut) Color(0xFF00A884).copy(alpha = alpha) 
                    else Color(0xFF202C33).copy(alpha = alpha)
                )
        )
    }
}

fun getFullUrl(url: String): String {
    if (url.isEmpty()) return ""
    var resolvedUrl = url
    if (resolvedUrl.contains("localhost:5000")) {
        resolvedUrl = resolvedUrl.replace("http://localhost:5000", "https://jh5nng6t-5000.asse.devtunnels.ms")
        resolvedUrl = resolvedUrl.replace("https://localhost:5000", "https://jh5nng6t-5000.asse.devtunnels.ms")
    }
    if (resolvedUrl.contains("127.0.0.1:5000")) {
        resolvedUrl = resolvedUrl.replace("http://127.0.0.1:5000", "https://jh5nng6t-5000.asse.devtunnels.ms")
        resolvedUrl = resolvedUrl.replace("https://127.0.0.1:5000", "https://jh5nng6t-5000.asse.devtunnels.ms")
    }
    if (resolvedUrl.contains("http://api.o-chat.live")) {
        resolvedUrl = resolvedUrl.replace("http://api.o-chat.live", "https://jh5nng6t-5000.asse.devtunnels.ms")
    }
    if (resolvedUrl.startsWith("/")) {
        resolvedUrl = "https://jh5nng6t-5000.asse.devtunnels.ms$resolvedUrl"
    }
    return resolvedUrl
}

@Composable
fun AsyncBitmapImage(
    url: String,
    modifier: Modifier = Modifier
) {
    val fullUrl = remember(url) { getFullUrl(url) }
    val cachedBitmap = remember(fullUrl) { ImageCache.get(fullUrl) }
    
    var bitmap by remember(url) { mutableStateOf<android.graphics.Bitmap?>(cachedBitmap) }
    var isLoading by remember(url) { mutableStateOf(cachedBitmap == null) }
    var isError by remember(url) { mutableStateOf(false) }

    LaunchedEffect(fullUrl) {
        if (cachedBitmap != null) return@LaunchedEffect
        withContext(Dispatchers.IO) {
            try {
                val connection = java.net.URL(fullUrl).openConnection() as java.net.HttpURLConnection
                connection.doInput = true
                connection.connect()
                val input = connection.inputStream
                val bmp = android.graphics.BitmapFactory.decodeStream(input)
                if (bmp != null) {
                    ImageCache.put(fullUrl, bmp)
                    bitmap = bmp
                    isLoading = false
                } else {
                    isError = true
                    isLoading = false
                }
            } catch (e: Exception) {
                e.printStackTrace()
                isError = true
                isLoading = false
            }
        }
    }

    Box(
        modifier = modifier.background(Color(0xFF202C33)),
        contentAlignment = Alignment.Center
    ) {
        if (isLoading) {
            CircularProgressIndicator(
                color = Color.White.copy(alpha = 0.6f),
                strokeWidth = 2.dp,
                modifier = Modifier.size(24.dp)
            )
        } else if (isError || bitmap == null) {
            Text("Failed to load image", color = Color.Red, fontSize = 12.sp)
        } else {
            Image(
                bitmap = bitmap!!.asImageBitmap(),
                contentDescription = "Image attachment",
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

@Composable
fun WaveformVisualizer(
    progress: Float,
    isPlaying: Boolean,
    isOut: Boolean,
    modifier: Modifier = Modifier
) {
    val barHeights = remember {
        listOf(12, 16, 8, 20, 24, 14, 30, 28, 18, 36, 40, 24, 32, 38, 20, 28, 24, 36, 30, 16, 28, 22, 14, 20, 12, 18, 8, 14, 10, 8)
    }
    
    val infiniteTransition = rememberInfiniteTransition(label = "waveform")
    val bounceAnim by if (isPlaying) {
        infiniteTransition.animateFloat(
            initialValue = 0.8f,
            targetValue = 1.3f,
            animationSpec = infiniteRepeatable(
                animation = tween(400, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "bounce"
        )
    } else {
        remember { mutableStateOf(1.0f) }
    }

    androidx.compose.foundation.Canvas(
        modifier = modifier
            .fillMaxWidth()
            .height(30.dp)
    ) {
        val width = size.width
        val height = size.height
        val barCount = barHeights.size
        val gap = 3.dp.toPx()
        val totalGapsWidth = gap * (barCount - 1)
        val barWidth = (width - totalGapsWidth) / barCount
        
        for (i in 0 until barCount) {
            val factor = if (isPlaying) {
                1f + (bounceAnim - 1f) * kotlin.math.sin(i.toFloat() + System.currentTimeMillis() / 200f)
            } else {
                1.0f
            }
            
            val maxBarHeight = barHeights[i].dp.toPx()
            val currentBarHeight = (maxBarHeight * factor).coerceIn(4.dp.toPx(), height)
            
            val x = i * (barWidth + gap)
            val y = (height - currentBarHeight) / 2f
            
            val isPlayed = progress >= (i.toFloat() / barCount)
            val barColor = if (isPlayed) {
                if (isOut) Color.White else Color(0xFF34B7F1)
            } else {
                Color.White.copy(alpha = 0.25f)
            }
            
            drawRoundRect(
                color = barColor,
                topLeft = androidx.compose.ui.geometry.Offset(x, y),
                size = androidx.compose.ui.geometry.Size(barWidth, currentBarHeight),
                cornerRadius = androidx.compose.ui.geometry.CornerRadius(barWidth / 2f, barWidth / 2f)
            )
        }
    }
}

@Composable
fun AudioAttachmentPlayer(
    fileUrl: String,
    isOut: Boolean,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    var mediaPlayer by remember { mutableStateOf<android.media.MediaPlayer?>(null) }
    var isPlaying by remember { mutableStateOf(false) }
    var isPrepared by remember { mutableStateOf(false) }
    var progress by remember { mutableStateOf(0f) }

    val fullUrl = remember(fileUrl) { getFullUrl(fileUrl) }

    DisposableEffect(fullUrl) {
        val mp = android.media.MediaPlayer().apply {
            try {
                setAudioStreamType(android.media.AudioManager.STREAM_MUSIC)
                setDataSource(fullUrl)
                setOnPreparedListener {
                    isPrepared = true
                }
                setOnCompletionListener {
                    isPlaying = false
                    seekTo(0)
                    progress = 0f
                }
                prepareAsync()
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
        mediaPlayer = mp

        onDispose {
            mp.release()
        }
    }

    LaunchedEffect(isPlaying) {
        if (isPlaying) {
            while (isPlaying) {
                val mp = mediaPlayer
                if (mp != null && isPrepared && mp.duration > 0) {
                    progress = mp.currentPosition.toFloat() / mp.duration.toFloat()
                }
                kotlinx.coroutines.delay(200)
            }
        }
    }

    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(32.dp)
                .clip(CircleShape)
                .background(Color(0x33FFFFFF)),
            contentAlignment = Alignment.Center
        ) {
            IconButton(
                onClick = {
                    val mp = mediaPlayer ?: return@IconButton
                    if (isPrepared) {
                        if (isPlaying) {
                            mp.pause()
                            isPlaying = false
                        } else {
                            mp.start()
                            isPlaying = true
                        }
                    }
                },
                enabled = isPrepared
            ) {
                Text(
                    text = if (isPlaying) "⏸" else "▶",
                    color = if (isPrepared) Color.White else Color.Gray,
                    fontSize = 12.sp
                )
            }
        }
        Spacer(modifier = Modifier.width(8.dp))
        Column(modifier = Modifier.weight(1f)) {
            WaveformVisualizer(
                progress = progress,
                isPlaying = isPlaying,
                isOut = isOut,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp)
            )
            Spacer(modifier = Modifier.height(2.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                Text(
                    text = if (isPlaying) "Playing..." else "Voice note",
                    color = if (isOut) Color.White.copy(alpha = 0.7f) else Color(0xFF8696A0),
                    fontSize = 10.sp
                )
                Text(
                    text = "🎙",
                    fontSize = 10.sp
                )
            }
        }
    }
}

@Composable
fun FileAttachmentCard(
    fileName: String,
    fileUrl: String,
    icon: String,
    isOut: Boolean,
    modifier: Modifier = Modifier
) {
    val context = LocalContext.current
    val fullUrl = remember(fileUrl) { getFullUrl(fileUrl) }
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0x22000000)),
        shape = RoundedCornerShape(8.dp),
        modifier = modifier
            .fillMaxWidth()
            .clickable {
                try {
                    val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(fullUrl))
                    browserIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    context.startActivity(browserIntent)
                } catch (e: Exception) {
                    Toast.makeText(context, "Cannot open file link", Toast.LENGTH_SHORT).show()
                }
            }
    ) {
        Row(
            modifier = Modifier.padding(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(Color(0x33FFFFFF)),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = icon,
                    fontSize = 16.sp
                )
            }
            Spacer(modifier = Modifier.width(8.dp))
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = fileName,
                    color = Color.White,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontWeight = FontWeight.Bold
                )
                Text(
                    text = "Tap to open",
                    color = if (isOut) Color.White.copy(alpha = 0.7f) else Color(0xFF8696A0),
                    fontSize = 10.sp
                )
            }
        }
    }
}

@Composable
fun AvatarImage(
    displayName: String,
    avatarUrl: String?,
    modifier: Modifier = Modifier,
    themeColor: Color = Color(0xFF00A884)
) {
    if (!avatarUrl.isNullOrEmpty()) {
        AsyncBitmapImage(
            url = avatarUrl,
            modifier = modifier.clip(CircleShape)
        )
    } else {
        Box(
            modifier = modifier
                .clip(CircleShape)
                .background(themeColor),
            contentAlignment = Alignment.Center
        ) {
            val isLarge = modifier.toString().contains("36")
            Text(
                text = if (displayName.isNotEmpty()) displayName.take(1).uppercase(Locale.getDefault()) else "G",
                color = Color.White,
                fontWeight = FontWeight.Bold,
                fontSize = if (isLarge) 15.sp else 11.sp
            )
        }
    }
}

@Composable
fun VisitorInfoCard(session: ChatSession) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, Color(0xFF00A884)),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            Text(
                text = "ℹ️ VISITOR INFORMATION",
                color = Color(0xFF00A884),
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold
            )
            Spacer(modifier = Modifier.height(8.dp))
            Divider(color = Color(0xFF2A3942), thickness = 1.dp)
            Spacer(modifier = Modifier.height(8.dp))
            
            val addInfoRow = @Composable { label: String, value: String?, color: Color ->
                if (!value.isNullOrEmpty()) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(vertical = 3.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = label,
                            color = Color(0xFF8696A0),
                            fontSize = 11.sp,
                            modifier = Modifier.width(75.dp)
                        )
                        Text(
                            text = value,
                            color = color,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            modifier = Modifier.weight(1f)
                        )
                    }
                }
            }
            
            addInfoRow("Name:", session.visitorName, Color(0xFFE9EDEF))
            addInfoRow("Email:", session.visitorEmail, Color(0xFF34B7F1))
            addInfoRow("Phone:", session.visitorPhone, Color(0xFF25D366))
            addInfoRow("Website:", session.visitorDomain, Color(0xFFE28B00))
            addInfoRow("Current Page:", session.visitorPath, Color(0xFF00A884))
            addInfoRow("Platform:", session.visitorDetails, Color(0xFF8696A0))
        }
    }
}

@Composable
fun AnimatedTypingDots(
    color: Color = Color(0xFF8696A0),
    dotSize: androidx.compose.ui.unit.Dp = 6.dp,
    spacing: androidx.compose.ui.unit.Dp = 4.dp
) {
    val infiniteTransition = rememberInfiniteTransition(label = "typingDots")
    val delays = listOf(0, 160, 320)
    val alphas = delays.map { delay ->
        infiniteTransition.animateFloat(
            initialValue = 0.3f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(
                animation = keyframes {
                    durationMillis = 900
                    0.3f at delay
                    1f at delay + 300
                    0.3f at delay + 600
                },
                repeatMode = RepeatMode.Restart
            ),
            label = "dot_$delay"
        )
    }
    val offsetYs = delays.map { delay ->
        infiniteTransition.animateFloat(
            initialValue = 0f,
            targetValue = 0f,
            animationSpec = infiniteRepeatable(
                animation = keyframes {
                    durationMillis = 900
                    0f at delay
                    -5f at delay + 150
                    0f at delay + 300
                },
                repeatMode = RepeatMode.Restart
            ),
            label = "dotY_$delay"
        )
    }
    Row(
        horizontalArrangement = Arrangement.spacedBy(spacing),
        verticalAlignment = Alignment.CenterVertically
    ) {
        alphas.forEachIndexed { i, alpha ->
            Box(
                modifier = Modifier
                    .size(dotSize)
                    .offset(y = offsetYs[i].value.dp)
                    .background(color.copy(alpha = alpha.value), CircleShape)
            )
        }
    }
}
