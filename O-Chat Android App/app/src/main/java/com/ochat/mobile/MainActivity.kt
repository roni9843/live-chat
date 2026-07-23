package com.ochat.mobile

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.*
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import android.media.MediaPlayer
import kotlin.concurrent.thread
import com.ochat.mobile.R

class MainActivity : ComponentActivity(), SocketManager.SocketListener {

    private val sessionsList = mutableStateListOf<ChatSession>()
    private val messagesMap = mutableStateMapOf<String, MutableList<Message>>()
    private val typingUsersMap = mutableStateMapOf<String, String?>()

    private var tokenState = mutableStateOf<String?>(null)
    private var userState = mutableStateOf<User?>(null)
    private var isSessionsLoading = mutableStateOf(true)
    private var onNewInviteCallback: (() -> Unit)? = null
    private val intentState = mutableStateOf<Intent?>(null)

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        intentState.value = intent
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        intentState.value = intent
        
        // Load preferences
        val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
        val savedToken = sharedPref.getString("jwt_token", null)
        val savedUserId = sharedPref.getString("user_id", null)
        val savedUserName = sharedPref.getString("user_name", null)
        val savedUserEmail = sharedPref.getString("user_email", null)
        val savedUserProfilePic = sharedPref.getString("user_profile_pic", "")

        if (savedToken != null && savedUserId != null && savedUserName != null && savedUserEmail != null) {
            tokenState.value = savedToken
            userState.value = User(_id = savedUserId, name = savedUserName, email = savedUserEmail, profilePic = savedUserProfilePic)
            SocketManager.connect(savedUserId)
            fetchInitialSessions(savedToken)
        }

        retrieveFcmToken()

        setContent {
            val navController = rememberNavController()
            val token by tokenState
            val currentUser by userState

            // ── Splash Screen gate ────────────────────────────────────────
            var showSplash by remember { mutableStateOf(true) }
            if (showSplash) {
                SplashScreen(onSplashFinished = { showSplash = false })
                return@setContent
            }
            // ─────────────────────────────────────────────────────────────

            val notificationCount = remember { mutableStateOf(0) }

            val refreshNotificationCount = {
                val tk = tokenState.value
                if (tk != null) {
                    NetworkService.fetchInvites(tk) { result ->
                        runOnUiThread {
                            result.fold(
                                onSuccess = { array ->
                                    notificationCount.value = array.length()
                                },
                                onFailure = {
                                    // Ignore quietly
                                }
                            )
                        }
                    }
                }
            }

            onNewInviteCallback = {
                refreshNotificationCount()
            }

            val currentIntent by intentState
            LaunchedEffect(token, currentIntent) {
                val intentVal = currentIntent
                if (token != null && intentVal != null) {
                    refreshNotificationCount()
                    
                    // Handle deep link from notification click
                    val screen = intentVal.getStringExtra("screen")
                    if (screen == "subscription") {
                        intentVal.removeExtra("screen")
                        navController.navigate("subscription")
                    } else if (screen == "notifications" || screen == "invite") {
                        intentVal.removeExtra("screen")
                        navController.navigate("notifications")
                    } else if (screen == "chat") {
                        val sessionId = intentVal.getStringExtra("sessionId") ?: ""
                        val rawName = intentVal.getStringExtra("displayName") ?: "Chat"
                        intentVal.removeExtra("screen")
                        intentVal.removeExtra("sessionId")
                        intentVal.removeExtra("displayName")
                        if (sessionId.isNotEmpty()) {
                            // URL-encode displayName to prevent NavController crash on special chars
                            val safeDisplayName = try {
                                URLEncoder.encode(rawName, "UTF-8").replace("+", "%20")
                            } catch (e: Exception) {
                                "Chat"
                            }
                            try {
                                navController.navigate("chat/$sessionId/$safeDisplayName")
                            } catch (e: Exception) {
                                Log.e("MainActivity", "Navigation crash prevented: ${e.message}")
                                navController.navigate("sessions")
                            }
                        }
                    }
                }
            }

            if (token == null || currentUser == null) {
                LoginScreen(
                    onLoginSuccess = { token, user ->
                        // Save to preferences
                        with(sharedPref.edit()) {
                            putString("jwt_token", token)
                            putString("user_id", user._id)
                            putString("user_name", user.name)
                            putString("user_email", user.email)
                            putString("user_profile_pic", user.profilePic ?: "")
                            apply()
                        }
                        isSessionsLoading.value = true
                        tokenState.value = token
                        userState.value = user
                        SocketManager.connect(user._id)
                        fetchInitialSessions(token)
                        sendPushTokenToBackend(token)
                        refreshNotificationCount()
                    }
                )
            } else {
                NavHost(navController = navController, startDestination = "sessions") {
                    composable("sessions") {
                        ChatListScreen(
                            sessions = sessionsList,
                            isLoading = isSessionsLoading.value,
                            token = token!!,
                            currentUserId = currentUser!!._id,
                            currentUserName = currentUser!!.name,
                            currentUserProfilePic = currentUser!!.profilePic,
                            typingUsers = typingUsersMap,
                            onSessionSelected = { sessionId, displayName ->
                                navController.navigate("chat/$sessionId/$displayName")
                            },
                            onLogout = {
                                with(sharedPref.edit()) {
                                    remove("jwt_token")
                                    remove("user_id")
                                    remove("user_name")
                                    remove("user_email")
                                    remove("user_profile_pic")
                                    apply()
                                }
                                tokenState.value = null
                                userState.value = null
                                isSessionsLoading.value = true
                                SocketManager.disconnect()
                                sessionsList.clear()
                                messagesMap.clear()
                            },
                            onNavigateToProfile = {
                                navController.navigate("profile")
                            },
                            onNavigateToConfigure = {
                                navController.navigate("configure")
                            },
                            notificationCount = notificationCount.value,
                            onNavigateToNotifications = {
                                navController.navigate("notifications")
                            },
                            onNavigateToSubscription = {
                                navController.navigate("subscription")
                            },
                            onNavigateToLiveTracking = {
                                navController.navigate("live_tracking")
                            }
                        )
                    }
                    composable("chat/{sessionId}/{displayName}") { backStackEntry ->
                        val sessionId = backStackEntry.arguments?.getString("sessionId") ?: ""
                        val displayName = backStackEntry.arguments?.getString("displayName") ?: ""
                        val messages = messagesMap[sessionId] ?: emptyList()
                        
                        LaunchedEffect(sessionId) {
                            NetworkService.fetchMessages(token!!, sessionId) { result ->
                                result.fold(
                                    onSuccess = { list ->
                                        runOnUiThread {
                                            messagesMap[sessionId] = mutableListOf<Message>().apply { addAll(list) }
                                        }
                                    },
                                    onFailure = { error ->
                                        Log.e("MainActivity", "REST fetch failed, falling back to sockets", error)
                                        SocketManager.getChatHistory(sessionId)
                                    }
                                )
                            }
                        }

                        ChatRoomScreen(
                            token = token!!,
                            sessionId = sessionId,
                            displayName = displayName,
                            messagesProvider = { messagesMap[sessionId] ?: emptyList() },
                            userId = currentUser!!.viewUserId(),
                            userName = currentUser!!.name,
                            themeColorHex = "#00A884",
                            typingUserProvider = { typingUsersMap[sessionId] },
                            onBack = {
                                navController.popBackStack()
                            },
                             onSendLocalMessage = { localMsg ->
                                 runOnUiThread {
                                     val currentList = messagesMap[sessionId] ?: emptyList()
                                     val list = currentList.toMutableList()
                                     val existingIndex = list.indexOfFirst { it.tempId == localMsg.tempId || (localMsg._id != null && it._id == localMsg._id) }
                                     if (existingIndex == -1) {
                                         list.add(localMsg)
                                         messagesMap[sessionId] = list
                                         playSound(this@MainActivity, R.raw.send_pop)
                                     } else {
                                         list[existingIndex] = localMsg
                                         messagesMap[sessionId] = list
                                     }
                                 }
                             },
                            sessionProvider = { sessionsList.find { it._id == sessionId } }
                        )
                    }
                    composable("profile") {
                        ProfileScreen(
                            token = token!!,
                            currentUserId = currentUser!!._id,
                            initialName = currentUser!!.name,
                            initialEmail = currentUser!!.email,
                            initialProfilePic = currentUser!!.profilePic ?: "",
                            onBack = {
                                navController.popBackStack()
                            },
                            onProfileUpdated = { newName, newEmail, newProfilePic ->
                                runOnUiThread {
                                    val updatedUser = currentUser!!.copy(name = newName, email = newEmail, profilePic = newProfilePic)
                                    userState.value = updatedUser
                                    with(sharedPref.edit()) {
                                        putString("user_name", newName)
                                        putString("user_email", newEmail)
                                        putString("user_profile_pic", newProfilePic)
                                        apply()
                                    }
                                }
                            },
                            onNavigateToSubscription = {
                                navController.navigate("subscription")
                            },
                            onNavigateToPaymentHistory = {
                                navController.navigate("payment_history")
                            }
                        )
                    }
                    composable("subscription") {
                        SubscriptionScreen(
                            token = token!!,
                            onBack = {
                                navController.popBackStack()
                            }
                        )
                    }
                    composable("live_tracking") {
                        LiveTrackingScreen(
                            sessionsList = sessionsList,
                            onBack = {
                                navController.popBackStack()
                            },
                            onChatNow = { sessionId, visitorName ->
                                navController.navigate("chat/$sessionId/$visitorName")
                            }
                        )
                    }
                    composable("payment_history") {
                        PaymentHistoryScreen(
                            token = token!!,
                            onBack = {
                                navController.popBackStack()
                            }
                        )
                    }
                    composable("configure") {
                        ConfigureScreen(
                            token = token!!,
                            onBack = {
                                navController.popBackStack()
                            }
                        )
                    }
                    composable("notifications") {
                        NotificationScreen(
                            token = token!!,
                            onBack = {
                                navController.popBackStack()
                            },
                            onRefreshProfile = {
                                refreshNotificationCount()
                                // Re-fetch profile to fetch updated widgets list from backend
                                NetworkService.fetchProfile(token!!) { profileResult ->
                                    runOnUiThread {
                                        profileResult.fold(
                                            onSuccess = { profile ->
                                                val updatedUser = currentUser!!.copy(
                                                    name = profile.optString("name", currentUser!!.name),
                                                    email = profile.optString("email", currentUser!!.email),
                                                    profilePic = profile.optString("profilePic", currentUser!!.profilePic ?: "")
                                                )
                                                userState.value = updatedUser
                                            },
                                            onFailure = {}
                                        )
                                    }
                                }
                            }
                        )
                    }
                }
            }
        }
    }

    private fun playSound(context: Context, resId: Int) {
        try {
            val mp = MediaPlayer.create(context, resId)
            mp.setOnCompletionListener { 
                it.release()
            }
            mp.start()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun User.viewUserId(): String = _id

    private fun fetchInitialSessions(token: String) {
        NetworkService.fetchSessions(token) { result ->
            runOnUiThread {
                isSessionsLoading.value = false
            }
            result.fold(
                onSuccess = { list ->
                    runOnUiThread {
                        sessionsList.clear()
                        sessionsList.addAll(list)
                    }
                },
                onFailure = { error ->
                    Log.e("MainActivity", "Failed to fetch initial sessions", error)
                }
            )
        }
    }

    override fun onResume() {
        super.onResume()
        SocketManager.registerListener(this)
    }

    override fun onPause() {
        super.onPause()
        SocketManager.unregisterListener(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        SocketManager.disconnect()
    }

    // Socket.io callbacks
    override fun onConnected() {
        Log.d("MainActivity", "Socket Connected callback triggered")
    }

    override fun onDisconnected() {
        Log.d("MainActivity", "Socket Disconnected callback triggered")
    }

    override fun onAllSessions(sessions: List<ChatSession>?) {
        if (sessions == null) return
        runOnUiThread {
            sessionsList.clear()
            sessionsList.addAll(sessions)
        }
    }

    override fun onSessionUpdated(session: ChatSession?) {
        val sId = session?._id ?: ""
        if (session == null || sId.isEmpty()) return
        runOnUiThread {
            val idx = sessionsList.indexOfFirst { (it._id ?: "") == sId }
            if (idx != -1) {
                sessionsList.removeAt(idx)
                sessionsList.add(idx, session)
            } else {
                sessionsList.add(0, session)
            }
        }
    }

    override fun onNewSession(session: ChatSession?) {
        val sId = session?._id ?: ""
        if (session == null || sId.isEmpty()) return
        runOnUiThread {
            if (sessionsList.none { (it._id ?: "") == sId }) {
                sessionsList.add(0, session)
            }
        }
    }

    override fun onSessionDeleted(sessionId: String?) {
        if (sessionId == null) return
        runOnUiThread {
            sessionsList.removeAll { it._id == sessionId }
        }
    }

    override fun onReceiveMessage(message: Message?) {
        if (message == null) return
        val msgSessionId = (message.sessionId as? String) ?: return
        runOnUiThread {
            val currentList = messagesMap[msgSessionId] ?: emptyList()
            val list = currentList.toMutableList()
            val isMyMsg = (message.senderId as? String) == userState.value?._id

            val msgId = message._id ?: message.tempId ?: ""
            val tempId = message.tempId

            val existingIdx = if (tempId != null) {
                list.indexOfFirst { it.tempId == tempId || it._id == msgId }
            } else {
                list.indexOfFirst { it._id == msgId }
            }

            if (existingIdx != -1) {
                list[existingIdx] = message
            } else {
                list.add(message)
                // If it is a message received from another person, play receive tink sound
                if (!isMyMsg) {
                    playSound(this@MainActivity, R.raw.receive_tink)
                }
            }
            messagesMap[msgSessionId] = list
        }
    }

    override fun onChatHistory(sessionId: String?, messages: List<Message>?, hasMore: Boolean, isAppend: Boolean) {
        if (sessionId == null || messages == null) return
        runOnUiThread {
            if (isAppend) {
                val current = messagesMap[sessionId] ?: mutableListOf()
                val merged = mutableListOf<Message>().apply {
                    addAll(messages)
                    addAll(current)
                }
                messagesMap[sessionId] = merged
            } else {
                messagesMap[sessionId] = mutableListOf<Message>().apply { addAll(messages) }
            }
        }
    }

    override fun onTypingStart(sessionId: String?, senderId: String?, senderName: String?) {
        if (sessionId == null || senderId == null || senderName == null) return
        runOnUiThread {
            if (senderId != userState.value?._id) {
                typingUsersMap[sessionId] = senderName
            }
        }
    }

    override fun onTypingEnd(sessionId: String?, senderId: String?) {
        if (sessionId == null || senderId == null) return
        runOnUiThread {
            if (senderId != userState.value?._id) {
                typingUsersMap[sessionId] = null
            }
        }
    }

    override fun onNewInvite() {
        runOnUiThread {
            onNewInviteCallback?.invoke()
        }
    }

    // Push token integration
    private fun retrieveFcmToken() {
        FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
            if (!task.isSuccessful) {
                Log.w("FCM", "Fetching FCM registration token failed", task.exception)
                return@addOnCompleteListener
            }

            val token = task.result
            Log.d("FCM", "Current FCM Token: $token")

            val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
            with(sharedPref.edit()) {
                putString("fcm_token", token)
                apply()
            }

            tokenState.value?.let { jwt ->
                sendPushTokenToBackend(jwt)
            }
        }
    }

    private fun sendPushTokenToBackend(jwtToken: String) {
        val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
        val fcmToken = sharedPref.getString("fcm_token", null)
        val isRegistered = sharedPref.getBoolean("fcm_token_registered", false)
        val lastRegisteredJwt = sharedPref.getString("last_registered_jwt", "")

        if (fcmToken.isNullOrEmpty() || (isRegistered && lastRegisteredJwt == jwtToken)) {
            return
        }

        thread {
            try {
                val url = URL("https://jh5nng6t-5000.asse.devtunnels.ms/api/auth/merchant/push-token")
                val connection = (url.openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 10000
                    readTimeout = 10000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Authorization", "Bearer $jwtToken")
                }

                val payload = JSONObject().apply {
                    put("token", fcmToken)
                }

                OutputStreamWriter(connection.outputStream).use { writer ->
                    writer.write(payload.toString())
                    writer.flush()
                }

                val responseCode = connection.responseCode
                Log.d("FCM", "Register push token response code: $responseCode")
                
                if (responseCode == HttpURLConnection.HTTP_OK || responseCode == HttpURLConnection.HTTP_CREATED) {
                    with(sharedPref.edit()) {
                        putBoolean("fcm_token_registered", true)
                        putString("last_registered_jwt", jwtToken)
                        apply()
                    }
                    Log.d("FCM", "Successfully registered FCM token to backend database!")
                }
                connection.disconnect()
            } catch (e: Exception) {
                Log.e("FCM", "Error sending push token to backend", e)
            }
        }
    }
}