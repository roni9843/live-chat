package com.ochat.mobile

import com.ochat.mobile.R
import android.annotation.SuppressLint
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.content.IntentFilter
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PixelFormat
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.IBinder
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread
import android.animation.ValueAnimator
import android.view.animation.DecelerateInterpolator
import android.widget.ScrollView
import android.widget.LinearLayout
import android.widget.EditText
import android.util.TypedValue
import android.view.KeyEvent
import android.widget.Toast
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import java.io.File

class FloatingBubbleService : Service(), SocketManager.SocketListener {

    private lateinit var windowManager: WindowManager
    private var floatingView: View? = null
    private var bubbleImage: ImageView? = null
    private var currentSessionId: String = ""
    private var collapsedX = 100
    private var collapsedY = 100
    private var removeZoneView: View? = null
    private var removeCloseIcon: TextView? = null
    private var isCloseSnapped = false
    private var isDragging = false

    private var previewView: View? = null
    private val previewHandler = android.os.Handler(android.os.Looper.getMainLooper())
    private var unreadCount = 0
    private var badgeText: TextView? = null

    private var chatWindowView: View? = null
    private var messageContainer: LinearLayout? = null
    private var messageScrollView: ScrollView? = null
    private var typingStatusText: TextView? = null
    private var displayName: String = "Chat"
    private var isGroupSession = false
    private var headerTitleText: TextView? = null
    private var headerAvatarView: ImageView? = null
    private val messageViewsMap = mutableMapOf<String, View>()
    private var chatContainerView: View? = null
    private var headerView: LinearLayout? = null
    private var visitorStatusText: TextView? = null
    private var oldestMessageTimestamp: String? = null
    private var isHistoryLoading = false
    private var hasMoreHistory = true
    private var replyingToMessage: Message? = null
    private var replyPreviewContainer: LinearLayout? = null
    private var replyPreviewText: TextView? = null
    private var joinBannerView: View? = null
    private var bannerTitleText: TextView? = null
    private var bannerSubText: TextView? = null
    private var inputBar: View? = null
    private var activeNotification: android.app.Notification? = null
    private var isDirectMessageSession = false
    private var currentSession: ChatSession? = null

    private fun updateForegroundServiceType(withMic: Boolean) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            val notification = activeNotification ?: return
            val type = if (withMic) {
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE or android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
            } else {
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            }
            try {
                startForeground(999, notification, type)
            } catch (e: Exception) {
                android.util.Log.e("FloatingBubbleService", "Failed to update foreground service type: ${e.message}")
            }
        }
    }

    private fun updateBadge() {
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            if (unreadCount > 0) {
                badgeText?.text = unreadCount.toString()
                badgeText?.visibility = View.VISIBLE
                
                // Pop animation for the badge
                badgeText?.scaleX = 0f
                badgeText?.scaleY = 0f
                badgeText?.animate()?.scaleX(1f)?.scaleY(1f)?.setDuration(200)?.start()
            } else {
                badgeText?.visibility = View.GONE
            }
        }
    }
    private val removePreviewRunnable = Runnable {
        removePreview()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createRemoveZoneView()
        SocketManager.registerListener(this)
        
        val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
        val savedUserId = sharedPref.getString("user_id", null) ?: ""
        if (savedUserId.isNotEmpty() && !SocketManager.isConnected()) {
            SocketManager.connect(savedUserId)
        }
        
        val filter = IntentFilter("com.ochat.mobile.FILE_UPLOADED")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(fileUploadReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            registerReceiver(fileUploadReceiver, filter)
        }
    }

    private fun createRemoveZoneView() {
        if (removeZoneView != null) return
        
        val context = this
        val sizePx = 180
        val circleLayout = FrameLayout(context).apply {
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#0F1720"))
                setStroke(4, Color.parseColor("#40FFFFFF"))
            }
            alpha = 0f
            scaleX = 0.5f
            scaleY = 0.5f
            visibility = View.GONE
        }

        val closeIcon = TextView(context).apply {
            text = "✕"
            setTextColor(Color.WHITE)
            textSize = 24f
            gravity = Gravity.CENTER
            setTypeface(android.graphics.Typeface.DEFAULT_BOLD)
        }
        val iconParams = FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT
        )
        circleLayout.addView(closeIcon, iconParams)

        removeZoneView = circleLayout
        removeCloseIcon = closeIcon

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val removeParams = WindowManager.LayoutParams(
            sizePx,
            sizePx,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM or Gravity.CENTER_HORIZONTAL
            y = 120
        }

        try {
            windowManager.addView(removeZoneView, removeParams)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun showRemoveZone() {
        val view = removeZoneView ?: return
        view.visibility = View.VISIBLE
        view.animate()
            .alpha(1f)
            .scaleX(1f)
            .scaleY(1f)
            .setDuration(250)
            .setInterpolator(DecelerateInterpolator())
            .start()
    }

    private fun hideRemoveZone() {
        val view = removeZoneView ?: return
        view.animate()
            .alpha(0f)
            .scaleX(0.5f)
            .scaleY(0.5f)
            .setDuration(200)
            .withEndAction {
                view.visibility = View.GONE
                view.background = GradientDrawable().apply {
                     shape = GradientDrawable.OVAL
                     setColor(Color.parseColor("#1F1F1F"))
                     setStroke(dp(2), Color.parseColor("#40FFFFFF"))
                 }
                 removeCloseIcon?.rotation = 0f
                 removeCloseIcon?.scaleX = 1.0f
                 removeCloseIcon?.scaleY = 1.0f
                 isCloseSnapped = false
            }
            .start()
    }

    @SuppressLint("ClickableViewAccessibility")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channelId = "floating_bubble_fg_channel"
            val channel = android.app.NotificationChannel(
                channelId,
                "Floating Chat Service",
                android.app.NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as android.app.NotificationManager
            manager.createNotificationChannel(channel)
            
            val notification = androidx.core.app.NotificationCompat.Builder(this, channelId)
                .setContentTitle("O-Chat Bubble")
                .setContentText("Chat overlay is active")
                .setSmallIcon(R.mipmap.ic_launcher)
                .build()
            activeNotification = notification
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    startForeground(999, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
                } else {
                    startForeground(999, notification)
                }
            } catch (e: Exception) {
                android.util.Log.e("FloatingBubbleService", "Failed to start foreground service: ${e.message}")
                stopSelf()
                return START_NOT_STICKY
            }
        }

        val avatarUrl = intent?.getStringExtra("avatarUrl") ?: ""
        val sessionId = intent?.getStringExtra("sessionId") ?: ""
        val messageBody = intent?.getStringExtra("messageBody") ?: ""
        val displayNameExtra = intent?.getStringExtra("displayName") ?: "Chat"
        displayName = displayNameExtra

        val sharedPrefs = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
        if (sessionId.isNotEmpty()) {
            sharedPrefs.edit().putString("last_bubble_session_id", sessionId).apply()
            currentSessionId = sessionId
        } else {
            currentSessionId = sharedPrefs.getString("last_bubble_session_id", "") ?: ""
        }
        if (avatarUrl.isNotEmpty()) {
            sharedPrefs.edit().putString("last_bubble_avatar_url", avatarUrl).apply()
        }

        // Save visitor metadata extras to preferences for fallback offline use
        intent?.let {
            val vName = it.getStringExtra("visitorName") ?: ""
            val vEmail = it.getStringExtra("visitorEmail") ?: ""
            val vPhone = it.getStringExtra("visitorPhone") ?: ""
            val vDomain = it.getStringExtra("visitorDomain") ?: ""
            val vPath = it.getStringExtra("visitorPath") ?: ""
            if (vName.isNotEmpty() || vEmail.isNotEmpty() || vPhone.isNotEmpty() || vDomain.isNotEmpty() || vPath.isNotEmpty()) {
                sharedPrefs.edit().apply {
                    putString("bubble_visitor_name", vName)
                    putString("bubble_visitor_email", vEmail)
                    putString("bubble_visitor_phone", vPhone)
                    putString("bubble_visitor_domain", vDomain)
                    putString("bubble_visitor_path", vPath)
                }.apply()
            }
        }

        if (floatingView != null) {
            loadAvatar(avatarUrl)
            fetchSessionDetailsAndRefresh()
            if (sessionId.isNotEmpty() && sessionId != currentSessionId) {
                unreadCount = 0
            }
            if (messageBody.isNotEmpty()) {
                unreadCount++
                updateBadge()
                showPreview(messageBody)
            }
            return START_STICKY
        }

        if (messageBody.isNotEmpty()) {
            unreadCount++
            previewHandler.postDelayed({ 
                updateBadge()
                showPreview(messageBody) 
            }, 500)
        }

        val bubbleContainer = FrameLayout(this).apply {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                elevation = 20f
                clipToOutline = true
                outlineProvider = android.view.ViewOutlineProvider.BACKGROUND
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#25D366"))
            }
            scaleX = 0f
            scaleY = 0f
            animate()
                .scaleX(1.1f)
                .scaleY(1.1f)
                .setDuration(400)
                .setInterpolator(android.view.animation.OvershootInterpolator())
                .withEndAction {
                    animate().scaleX(1.0f).scaleY(1.0f).setDuration(150).start()
                }
                .start()
        }

        bubbleImage = ImageView(this).apply {
            val initialBmp = getInitialAvatar(displayName)
            setImageBitmap(initialBmp)
            scaleType = ImageView.ScaleType.CENTER_CROP
        }
        bubbleContainer.addView(bubbleImage, FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT)

        badgeText = TextView(this).apply {
            text = "1"
            setTextColor(Color.WHITE)
            textSize = 10f
            gravity = Gravity.CENTER
            setTypeface(android.graphics.Typeface.DEFAULT_BOLD)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#FF3B30"))
                setStroke(2, Color.WHITE)
            }
            visibility = View.GONE
        }
        val badgeParams = FrameLayout.LayoutParams(dp(20), dp(20)).apply {
            gravity = Gravity.TOP or Gravity.END
            topMargin = dp(2)
            rightMargin = dp(2)
        }
        bubbleContainer.addView(badgeText, badgeParams)

        floatingView = bubbleContainer

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val displayMetrics = resources.displayMetrics
        val screenWidth = displayMetrics.widthPixels
        val screenHeight = displayMetrics.heightPixels

        val params = WindowManager.LayoutParams(
            150,
            150,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = screenWidth - 150
            y = (screenHeight / 2) - 200
        }

        bubbleContainer.setOnTouchListener(object : View.OnTouchListener {
            private var initialX = 0
            private var initialY = 0
            private var initialTouchX = 0f
            private var initialTouchY = 0f
            private var isClick = false

            override fun onTouch(v: View, event: MotionEvent): Boolean {
                val displayMetrics = resources.displayMetrics
                val screenWidth = displayMetrics.widthPixels
                val screenHeight = displayMetrics.heightPixels
                
                val removeCenterX = screenWidth / 2
                val removeCenterY = screenHeight - 120 - 90

                when (event.action) {
                    MotionEvent.ACTION_DOWN -> {
                        v.animate()
                            .scaleX(1.15f)
                            .scaleY(1.15f)
                            .setDuration(150)
                            .setInterpolator(DecelerateInterpolator())
                            .start()

                        initialX = params.x
                        initialY = params.y
                        initialTouchX = event.rawX
                        initialTouchY = event.rawY
                        isClick = true
                        isDragging = false
                        return true
                    }
                    MotionEvent.ACTION_UP -> {
                        hideRemoveZone()
                        
                        v.animate()
                            .scaleX(1.0f)
                            .scaleY(1.0f)
                            .setDuration(150)
                            .setInterpolator(DecelerateInterpolator())
                            .start()

                        if (isCloseSnapped) {
                            stopSelf()
                            return true
                        }

                        val diffX = event.rawX - initialTouchX
                        val diffY = event.rawY - initialTouchY
                        val dragDistance = Math.hypot(diffX.toDouble(), diffY.toDouble())

                        if (dragDistance < 30) {
                            openAppAndGoToChat()
                        } else {
                            if (isDragging) {
                                val targetX = if (params.x + 75 < screenWidth / 2) 0 else screenWidth - 150
                                val animator = ValueAnimator.ofInt(params.x, targetX)
                                animator.addUpdateListener { va ->
                                    params.x = va.animatedValue as Int
                                    if (floatingView != null && floatingView?.parent != null) {
                                        try {
                                            windowManager.updateViewLayout(floatingView, params)
                                        } catch (e: Exception) {
                                            e.printStackTrace()
                                        }
                                    }
                                }
                                animator.duration = 350
                                animator.interpolator = android.view.animation.OvershootInterpolator(1.2f)
                                animator.start()
                            }
                        }
                        return true
                    }
                    MotionEvent.ACTION_MOVE -> {
                        val dx = (event.rawX - initialTouchX).toInt()
                        val dy = (event.rawY - initialTouchY).toInt()

                        if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
                            if (!isDragging) {
                                isDragging = true
                                isClick = false
                                showRemoveZone()
                            }
                        }

                        if (isDragging) {
                            val currentDragX = initialX + dx
                            val currentDragY = initialY + dy

                            val bubbleCenterX = currentDragX + 75
                            val bubbleCenterY = currentDragY + 75

                            val distance = Math.hypot((bubbleCenterX - removeCenterX).toDouble(), (bubbleCenterY - removeCenterY).toDouble())
                             if (distance < 250) {
                                 params.x = removeCenterX - 75
                                 params.y = removeCenterY - 75
                                 
                                 if (!isCloseSnapped) {
                                     isCloseSnapped = true
                                     removeZoneView?.performHapticFeedback(android.view.HapticFeedbackConstants.KEYBOARD_TAP)
                                     removeZoneView?.animate()?.scaleX(1.4f)?.scaleY(1.4f)?.alpha(1.0f)?.setDuration(200)?.start()
                                     removeCloseIcon?.animate()?.rotation(45f)?.scaleX(1.2f)?.scaleY(1.2f)?.setDuration(200)?.start()
                                     removeZoneView?.background = GradientDrawable().apply {
                                         shape = GradientDrawable.OVAL
                                         setColor(Color.parseColor("#E74C3C"))
                                         setStroke(dp(3), Color.WHITE)
                                     }
                                 }
                             } else {
                                 params.x = currentDragX
                                 params.y = currentDragY

                                 if (isCloseSnapped) {
                                     isCloseSnapped = false
                                     removeZoneView?.animate()?.scaleX(1.1f)?.scaleY(1.1f)?.setDuration(200)?.start()
                                     removeCloseIcon?.animate()?.rotation(0f)?.scaleX(1.0f)?.scaleY(1.0f)?.setDuration(200)?.start()
                                     removeZoneView?.background = GradientDrawable().apply {
                                         shape = GradientDrawable.OVAL
                                         setColor(Color.parseColor("#1F1F1F"))
                                         setStroke(dp(2), Color.parseColor("#40FFFFFF"))
                                     }
                                 }
                             }

                            if (floatingView != null && floatingView?.parent != null) {
                                try {
                                    windowManager.updateViewLayout(floatingView, params)
                                } catch (e: Exception) {
                                    e.printStackTrace()
                                }
                            }
                        }
                        return true
                    }
                }
                return false
            }
        })

        try {
            windowManager.addView(floatingView, params)
        } catch (e: Exception) {
            e.printStackTrace()
            stopSelf()
            return START_NOT_STICKY
        }
        loadAvatar(avatarUrl)
        fetchSessionDetailsAndRefresh()

        return START_STICKY
    }

    private fun showChatWindow() {
        if (chatWindowView != null) return
        
        unreadCount = 0
        updateBadge()
        
        // Hide the floating bubble view
        floatingView?.visibility = View.GONE
        removePreview()
        
        val context = this
        val sharedPref = context.getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
        val dp = { value: Int -> 
            TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()
        }

        // Root container (Transparent layout spanning full screen)
        val rootLayout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.TRANSPARENT)
        }

        // 0. Transparent Top Spacer (100dp) - click outside to minimize
        val spacer = View(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(100)
            )
            setOnTouchListener { _, event ->
                if (event.action == MotionEvent.ACTION_UP) {
                    hideChatWindow()
                }
                true
            }
        }
        rootLayout.addView(spacer)

        // Premium Slide-up Chat Panel Container
        val chatContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#0B141A"))
                val r = dp(16).toFloat()
                cornerRadii = floatArrayOf(r, r, r, r, 0f, 0f, 0f, 0f)
                setStroke(2, Color.parseColor("#33FFFFFF"))
            }
        }
        chatContainerView = chatContainer

        // 1. Header Bar
        val header = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#0F1720"))
                val r = dp(16).toFloat()
                cornerRadii = floatArrayOf(r, r, r, r, 0f, 0f, 0f, 0f)
                setStroke(dp(1), Color.parseColor("#25D366"))
            }
            setPadding(dp(16), dp(14), dp(16), dp(14))
        }
        headerView = header

        // Profile picture next to name in header
        val headerAvatar = ImageView(context).apply {
            layoutParams = LinearLayout.LayoutParams(dp(42), dp(42)).apply {
                rightMargin = dp(12)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                clipToOutline = true
                outlineProvider = android.view.ViewOutlineProvider.BACKGROUND
            }
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#25D366"))
                setStroke(dp(2), Color.parseColor("#2A3942"))
            }
            scaleType = ImageView.ScaleType.CENTER_CROP
            
            val initialBmp = getInitialAvatar(displayName)
            setImageBitmap(initialBmp)
            
            isClickable = true
            setOnClickListener {
                showVisitorProfileDialog(context)
            }
            
            val bubbleAvatarUrl = sharedPref.getString("last_bubble_avatar_url", "") ?: ""
            if (bubbleAvatarUrl.isNotEmpty()) {
                val fullAvatarUrl = getFullUrl(bubbleAvatarUrl)
                val cached = ImageCache.get(fullAvatarUrl)
                if (cached != null) {
                    setImageBitmap(cached)
                } else {
                    Thread {
                        try {
                            val connection = java.net.URL(fullAvatarUrl).openConnection() as java.net.HttpURLConnection
                            connection.doInput = true
                            connection.connect()
                            val input = connection.inputStream
                            val bitmap = android.graphics.BitmapFactory.decodeStream(input)
                            if (bitmap != null) {
                                ImageCache.put(fullAvatarUrl, bitmap)
                                android.os.Handler(android.os.Looper.getMainLooper()).post {
                                    setImageBitmap(bitmap)
                                }
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }.start()
                }
            }
        }
        headerAvatarView = headerAvatar

        val nameColumn = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        val titleText = TextView(context).apply {
            text = displayName
            setTextColor(Color.WHITE)
            textSize = 17f
            setTypeface(android.graphics.Typeface.DEFAULT_BOLD)
        }
        headerTitleText = titleText
        typingStatusText = TextView(context).apply {
            text = "typing..."
            setTextColor(Color.parseColor("#25D366"))
            textSize = 11f
            setTypeface(android.graphics.Typeface.DEFAULT_BOLD)
            visibility = View.GONE
        }
        val statusText = TextView(context).apply {
            text = "Offline"
            setTextColor(Color.parseColor("#EF4444"))
            textSize = 10f
            visibility = View.GONE
        }
        visitorStatusText = statusText

        nameColumn.addView(titleText)
        nameColumn.addView(typingStatusText)
        nameColumn.addView(statusText)

        // Minimize Button
        val minimizeBtn = TextView(context).apply {
            text = "━"
            setTextColor(Color.parseColor("#8696A0"))
            textSize = 16f
            gravity = Gravity.CENTER
            setPadding(dp(8), dp(4), dp(8), dp(4))
            isClickable = true
            setOnClickListener {
                hideChatWindow()
            }
        }

        // Close Button
        val closeBtn = TextView(context).apply {
            text = "✕"
            setTextColor(Color.parseColor("#EF4444"))
            textSize = 18f
            gravity = Gravity.CENTER
            setPadding(dp(8), dp(4), dp(8), dp(4))
            isClickable = true
            setOnClickListener {
                stopSelf()
            }
        }

        header.addView(headerAvatar)
        header.addView(nameColumn)
        header.addView(minimizeBtn)
        header.addView(closeBtn)
        chatContainer.addView(header, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        // Slide-down Join Session Banner right below the header
        val bannerLayout = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), dp(8), dp(12), dp(8))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#182229"))
                setStroke(dp(1), Color.parseColor("#E28B00"))
                cornerRadius = dp(8).toFloat()
            }
        }
        val textContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        val bannerTitle = TextView(context).apply {
            text = "Unassigned Session"
            setTextColor(Color.parseColor("#E28B00"))
            textSize = 12f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        bannerTitleText = bannerTitle
        val bannerSub = TextView(context).apply {
            text = "No agent has enrolled yet. Join to start chatting."
            setTextColor(Color.parseColor("#E9EDEF"))
            textSize = 10f
        }
        bannerSubText = bannerSub
        textContainer.addView(bannerTitle)
        textContainer.addView(bannerSub)

        val joinBtn = android.widget.Button(context).apply {
            text = "Join"
            setTextColor(Color.parseColor("#111B21"))
            textSize = 11f
            val density = resources.displayMetrics.density
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#25D366"))
                cornerRadius = (6 * density)
            }
            setOnClickListener {
                val myUserId = sharedPref.getString("user_id", "") ?: ""
                val myUserName = sharedPref.getString("user_name", "Agent") ?: "Agent"
                if (myUserId.isNotEmpty()) {
                    if (!SocketManager.isConnected()) {
                        Toast.makeText(context, "Reconnecting live chat server...", Toast.LENGTH_SHORT).show()
                    }
                    SocketManager.joinSession(
                        sessionId = currentSessionId,
                        agentId = myUserId,
                        agentName = myUserName,
                        merchantId = myUserId,
                        onResult = { success, errorMsg ->
                            if (success) {
                                Toast.makeText(context, "Joined session successfully!", Toast.LENGTH_SHORT).show()
                                fetchSessionDetailsAndRefresh()
                            } else {
                                Toast.makeText(context, errorMsg ?: "Error joining session", Toast.LENGTH_LONG).show()
                            }
                        }
                    )
                }
            }
        }
        bannerLayout.addView(textContainer)
        bannerLayout.addView(joinBtn)

        val wrapper = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(8), dp(6), dp(8), dp(6))
            visibility = View.GONE
            addView(bannerLayout)
        }
        joinBannerView = wrapper
        chatContainer.addView(joinBannerView)

        // 2. Messages ScrollView
        messageScrollView = ScrollView(context).apply {
            isVerticalScrollBarEnabled = true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                setOnScrollChangeListener { _, _, scrollY, _, _ ->
                    if (scrollY < dp(50) && !isHistoryLoading && hasMoreHistory && oldestMessageTimestamp != null) {
                        isHistoryLoading = true
                        SocketManager.getChatHistory(currentSessionId, oldestMessageTimestamp)
                    }
                }
            }
        }

        messageContainer = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
            )
            setPadding(dp(12), dp(12), dp(12), dp(12))
        }
        messageScrollView?.addView(messageContainer)
        chatContainer.addView(messageScrollView, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0,
            1f
        ))

        // Reply Preview Container (Hidden by default)
        replyPreviewContainer = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.parseColor("#202C33"))
            setPadding(dp(12), dp(8), dp(12), dp(8))
            visibility = View.GONE
        }
        val replyIconLabel = TextView(context).apply {
            text = "↩ Replying to: "
            setTextColor(Color.parseColor("#25D366"))
            textSize = 12f
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        replyPreviewText = TextView(context).apply {
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                leftMargin = dp(4)
                rightMargin = dp(8)
            }
            setTextColor(Color.WHITE)
            textSize = 12f
            maxLines = 1
            ellipsize = android.text.TextUtils.TruncateAt.END
        }
        val closeReplyBtn = TextView(context).apply {
            text = "✕"
            setTextColor(Color.parseColor("#8696A0"))
            textSize = 14f
            setPadding(dp(8), dp(4), dp(8), dp(4))
            isClickable = true
            setOnClickListener {
                replyingToMessage = null
                replyPreviewContainer?.visibility = View.GONE
            }
        }
        replyPreviewContainer?.addView(replyIconLabel)
        replyPreviewContainer?.addView(replyPreviewText)
        replyPreviewContainer?.addView(closeReplyBtn)
        chatContainer.addView(replyPreviewContainer, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        // 3. Bottom Input Bar
        val ib = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(Color.parseColor("#111B21"))
            setPadding(dp(8), dp(8), dp(8), dp(8))
        }
        inputBar = ib

        // Attachment '📎' Button
        val attachBtn = TextView(context).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                rightMargin = dp(6)
                leftMargin = dp(6)
            }
            text = "📎"
            setTextColor(Color.parseColor("#25D366"))
            textSize = 20f
            isClickable = true
            setOnClickListener {
                val fileIntent = Intent(context, FilePickerActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    putExtra("type", "*/*")
                }
                startActivity(fileIntent)
            }
        }

        val inputField = EditText(context).apply {
            layoutParams = LinearLayout.LayoutParams(0, dp(44), 1f).apply {
                rightMargin = dp(8)
            }
            hint = "Type a message..."
            setHintTextColor(Color.parseColor("#8696A0"))
            setTextColor(Color.WHITE)
            textSize = 14f
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#202C33"))
                cornerRadius = dp(22).toFloat()
            }
            setPadding(dp(16), 0, dp(16), 0)
            maxLines = 1
            setOnFocusChangeListener { _, hasFocus ->
                if (hasFocus) {
                    messageScrollView?.postDelayed({
                        messageScrollView?.fullScroll(View.FOCUS_DOWN)
                    }, 300)
                }
            }
            setOnClickListener {
                messageScrollView?.postDelayed({
                    messageScrollView?.fullScroll(View.FOCUS_DOWN)
                }, 300)
            }
            setOnKeyListener { _, keyCode, event ->
                if (event.action == KeyEvent.ACTION_DOWN && keyCode == KeyEvent.KEYCODE_ENTER) {
                    val text = text.toString().trim()
                    if (text.isNotEmpty()) {
                        sendMessage(text)
                        setText("")
                    }
                    true
                } else false
            }
        }

        val sendBtn = ImageView(context).apply {
            layoutParams = FrameLayout.LayoutParams(dp(36), dp(36)).apply {
                gravity = Gravity.CENTER
            }
            setImageResource(android.R.drawable.ic_menu_send)
            setColorFilter(Color.WHITE)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#25D366"))
            }
            isClickable = true
            visibility = View.GONE // Hidden by default
            setOnClickListener {
                val text = inputField.text.toString().trim()
                if (text.isNotEmpty()) {
                    sendMessage(text)
                    inputField.setText("")
                }
            }
        }
                 // Microphone Voice Recording Button
        val micBtn = ImageView(context).apply {
            layoutParams = FrameLayout.LayoutParams(dp(36), dp(36)).apply {
                gravity = Gravity.CENTER
            }
            setImageResource(android.R.drawable.ic_btn_speak_now)
            setColorFilter(Color.WHITE)
            background = GradientDrawable().apply {
                shape = GradientDrawable.OVAL
                setColor(Color.parseColor("#00A884"))
            }
            isClickable = true
            
            var mediaRecorder: android.media.MediaRecorder? = null
            var audioFile: File? = null
            var isRecording = false
            var secondsRecorded = 0
            val timerHandler = android.os.Handler(android.os.Looper.getMainLooper())
            val timerRunnable = object : Runnable {
                override fun run() {
                    secondsRecorded++
                    val mins = secondsRecorded / 60
                    val secs = secondsRecorded % 60
                    inputField.setHint(String.format("Recording: %02d:%02d", mins, secs))
                    timerHandler.postDelayed(this, 1000)
                }
            }

            @SuppressLint("ClickableViewAccessibility")
            setOnTouchListener { _, touchEvent ->
                when (touchEvent.action) {
                    MotionEvent.ACTION_DOWN -> {
                        (background as GradientDrawable).setColor(Color.RED)
                        secondsRecorded = 0
                        inputField.setHint("Recording: 00:00")
                        inputField.isEnabled = false
                        timerHandler.postDelayed(timerRunnable, 1000)
                        updateForegroundServiceType(true)
                        
                        try {
                            audioFile = File(cacheDir, "voice_record_${System.currentTimeMillis()}.m4a")
                            mediaRecorder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
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
                                setOutputFile(audioFile?.absolutePath)
                                prepare()
                                start()
                            }
                            isRecording = true
                        } catch (e: Exception) {
                            e.printStackTrace()
                            Toast.makeText(context, "Microphone permission required", Toast.LENGTH_SHORT).show()
                            (background as GradientDrawable).setColor(Color.parseColor("#00A884"))
                            inputField.setHint("Type a message...")
                            inputField.isEnabled = true
                            timerHandler.removeCallbacks(timerRunnable)
                            updateForegroundServiceType(false)
                        }
                    }
                    MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                        (background as GradientDrawable).setColor(Color.parseColor("#00A884"))
                        inputField.setHint("Type a message...")
                        inputField.isEnabled = true
                        timerHandler.removeCallbacks(timerRunnable)
                        updateForegroundServiceType(false)
                        
                        if (isRecording) {
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
                                showVoicePreviewDialog(file)
                            }
                        }
                    }
                }
                true
            }
        }

        val actionContainer = FrameLayout(context).apply {
            layoutParams = LinearLayout.LayoutParams(dp(44), dp(44))
        }
        actionContainer.addView(sendBtn)
        actionContainer.addView(micBtn)

        inputField.addTextChangedListener(object : android.text.TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {
                val text = s?.toString()?.trim() ?: ""
                if (text.isNotEmpty()) {
                    sendBtn.visibility = View.VISIBLE
                    micBtn.visibility = View.GONE
                } else {
                    sendBtn.visibility = View.GONE
                    micBtn.visibility = View.VISIBLE
                }
            }
            override fun afterTextChanged(s: android.text.Editable?) {}
        })

        ib.addView(attachBtn)
        ib.addView(inputField)
        ib.addView(actionContainer)
        chatContainer.addView(ib, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        ))

        // Add the chat panel to rootLayout with full height matching parent
        rootLayout.addView(chatContainer, LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            0,
            1f
        ))

        chatWindowView = rootLayout

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val screenHeight = resources.displayMetrics.heightPixels
        val widthPx = WindowManager.LayoutParams.MATCH_PARENT
        val heightPx = WindowManager.LayoutParams.MATCH_PARENT

        val windowParams = WindowManager.LayoutParams(
            widthPx,
            heightPx,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.BOTTOM
            softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
        }

        try {
            windowManager.addView(chatWindowView, windowParams)
            
            // Slide up chatContainer from screenHeight (slide-up bottom sheet effect)
            chatContainer.translationY = screenHeight.toFloat()
            chatContainer.animate()
                .translationY(0f)
                .setDuration(300)
                .setInterpolator(android.view.animation.DecelerateInterpolator())
                .start()
            
            val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
            val savedUserId = sharedPref.getString("user_id", null)
            if (savedUserId != null) {
                SocketManager.connect(savedUserId)
            }
            
            val savedToken = sharedPref.getString("jwt_token", null)
            if (savedToken != null && currentSessionId.isNotEmpty()) {
                NetworkService.fetchMessages(savedToken, currentSessionId) { result ->
                    result.fold(
                        onSuccess = { list ->
                            android.os.Handler(android.os.Looper.getMainLooper()).post {
                                messageViewsMap.clear()
                                messageContainer?.removeAllViews()
                                list.forEach { appendMessage(it) }
                            }
                        },
                        onFailure = { error ->
                            android.util.Log.e("FloatingBubbleService", "REST fetch failed, falling back to sockets", error)
                            SocketManager.getChatHistory(currentSessionId)
                        }
                    )
                }
            } else if (currentSessionId.isNotEmpty()) {
                SocketManager.getChatHistory(currentSessionId)
            }
            
            if (savedUserId != null && currentSessionId.isNotEmpty()) {
                val savedUserName = sharedPref.getString("user_name", "Agent") ?: "Agent"
                SocketManager.startViewingSession(currentSessionId, savedUserName, savedUserId)
                SocketManager.markAsRead(currentSessionId, savedUserId)
            }
            
            fetchSessionDetailsAndRefresh()
            
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun hideChatWindow() {
        val view = chatWindowView ?: return
        val container = chatContainerView ?: return
        val screenHeight = resources.displayMetrics.heightPixels
        
        container.animate()
            .translationY(screenHeight.toFloat())
            .setDuration(250)
            .setInterpolator(android.view.animation.AccelerateInterpolator())
            .withEndAction {
                try {
                    windowManager.removeView(view)
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                chatWindowView = null
                chatContainerView = null
                SocketManager.stopViewingSession()
                floatingView?.visibility = View.VISIBLE
            }
            .start()
    }

    private fun sendMessage(text: String) {
        val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
        val savedUserId = sharedPref.getString("user_id", null) ?: return
        val savedUserName = sharedPref.getString("user_name", "Agent") ?: "Agent"
        
        if (currentSessionId.isEmpty()) return
        
        val tempId = java.util.UUID.randomUUID().toString()
        val localMsg = Message(
            _id = tempId,
            tempId = tempId,
            sessionId = currentSessionId,
            sender = "merchant",
            senderId = savedUserId,
            senderName = savedUserName,
            content = text,
            timestamp = java.util.Date().toString(),
            replyTo = replyingToMessage
        )
        
        appendMessage(localMsg)
        
        val savedUserProfilePic = sharedPref.getString("user_profile_pic", "") ?: ""
        SocketManager.sendMessage(
            sessionId = currentSessionId,
            content = text,
            senderId = savedUserId,
            senderName = savedUserName,
            tempId = tempId,
            replyTo = replyingToMessage,
            senderProfilePic = savedUserProfilePic
        )

        replyingToMessage = null
        replyPreviewContainer?.visibility = View.GONE
    }

    private fun appendMessage(msg: Message, insertIndex: Int = -1) {
        val context = this
        val dp = { value: Int -> 
            TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()
        }
        val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
        val savedUserId = sharedPref.getString("user_id", null) ?: ""
        
        val msgContent = (msg.content as? String) ?: ""
        val msgId = msg._id ?: msg.tempId ?: ""
        val tempId = msg.tempId
        
        val existingView = messageViewsMap[msgId] ?: (if (tempId != null) messageViewsMap[tempId] else null)
        if (existingView != null) {
            if (msg.isDeleted == true) {
                val idx = messageContainer?.indexOfChild(existingView) ?: -1
                messageContainer?.removeView(existingView)
                messageViewsMap.remove(msgId)
                if (tempId != null) messageViewsMap.remove(tempId)
                
                // Re-append updated deleted message at same index
                appendMessage(msg, insertIndex = idx)
                return
            } else {
                val txtView = existingView.findViewWithTag<TextView>("msg_text_tag")
                if (txtView != null) {
                    txtView.text = msgContent
                }
            }
            if (msg._id != null && tempId != null) {
                messageViewsMap.remove(tempId)
                messageViewsMap[msg._id] = existingView
            }
            return
        }

        if (msg.sender == "system") {
            val systemMessageRow = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    topMargin = dp(8)
                    bottomMargin = dp(8)
                    leftMargin = dp(24)
                    rightMargin = dp(24)
                }
            }

            val systemMessageBubble = TextView(context).apply {
                text = msgContent
                setTextColor(Color.parseColor("#E9EDEF"))
                textSize = 11f
                gravity = Gravity.CENTER
                setPadding(dp(12), dp(6), dp(12), dp(6))
                
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

                background = GradientDrawable().apply {
                    setColor(Color.parseColor(bgHexColor))
                    cornerRadius = dp(12).toFloat()
                    setStroke(dp(1), Color.parseColor(borderHexColor))
                }
            }
            systemMessageRow.addView(systemMessageBubble)

            if (insertIndex != -1) {
                messageContainer?.addView(systemMessageRow, insertIndex)
            } else {
                messageContainer?.addView(systemMessageRow)
            }
            
            messageViewsMap[msgId] = systemMessageRow
            if (tempId != null) messageViewsMap[tempId] = systemMessageRow
            return
        }

        val isMe = msg.senderId == savedUserId
        
        // Formatted timestamp
        val timeStr = try {
            val date = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US).apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.parse(msg.timestamp ?: "")
            java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault()).format(date ?: java.util.Date())
        } catch (e: Exception) {
            try {
                val date = java.text.SimpleDateFormat("EEE MMM dd HH:mm:ss zzz yyyy", java.util.Locale.US).parse(msg.timestamp ?: "")
                java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault()).format(date ?: java.util.Date())
            } catch (e2: Exception) {
                java.text.SimpleDateFormat("hh:mm a", java.util.Locale.getDefault()).format(java.util.Date())
            }
        }

        val messageRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = if (isMe) Gravity.END else Gravity.START
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(6)
                bottomMargin = dp(6)
            }
        }
        
        // 1. Sender avatar next to incoming messages
        if (!isMe) {
            val avatarImageView = ImageView(context).apply {
                layoutParams = LinearLayout.LayoutParams(dp(28), dp(28)).apply {
                    rightMargin = dp(6)
                    gravity = Gravity.BOTTOM
                }
                val initialBmp = getInitialAvatar(msg.senderName ?: displayName)
                setImageBitmap(initialBmp)
                scaleType = ImageView.ScaleType.CENTER_CROP
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    clipToOutline = true
                    outlineProvider = android.view.ViewOutlineProvider.BACKGROUND
                }
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.parseColor("#2F3B43"))
                }
            }
            
            avatarImageView.isClickable = true
            avatarImageView.setOnClickListener {
                showVisitorProfileDialog(context)
            }
            
            val bubbleAvatarUrl = if (isGroupSession) (msg.senderProfilePic ?: "") else (sharedPref.getString("last_bubble_avatar_url", "") ?: "")
            if (bubbleAvatarUrl.isNotEmpty()) {
                val fullAvatarUrl = getFullUrl(bubbleAvatarUrl)
                val cached = ImageCache.get(fullAvatarUrl)
                if (cached != null) {
                    avatarImageView.setImageBitmap(cached)
                } else {
                    Thread {
                        try {
                            val connection = java.net.URL(fullAvatarUrl).openConnection() as java.net.HttpURLConnection
                            connection.doInput = true
                            connection.connect()
                            val input = connection.inputStream
                            val bitmap = android.graphics.BitmapFactory.decodeStream(input)
                            if (bitmap != null) {
                                ImageCache.put(fullAvatarUrl, bitmap)
                                android.os.Handler(android.os.Looper.getMainLooper()).post {
                                    avatarImageView.setImageBitmap(bitmap)
                                }
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                        }
                    }.start()
                }
            }
            messageRow.addView(avatarImageView)
        }

        // 2. Vertical Column: (Replied Ref Card) + (Bubble Content) + (Timestamp)
        val bubbleColumn = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            gravity = if (isMe) Gravity.END else Gravity.START
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }

        val bubblePadding = if (msg.fileType == "image") dp(4) else dp(10)
        val messageBubbleWrapper = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(bubblePadding, bubblePadding, bubblePadding, bubblePadding)
            background = GradientDrawable().apply {
                setColor(if (isMe) Color.parseColor("#005C4B") else Color.parseColor("#2F3B43"))
                cornerRadius = dp(16).toFloat()
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
            
            // Add sender name at the top of the bubble if it is a group and not from current agent
            if (!isMe && isGroupSession && !msg.senderName.isNullOrEmpty()) {
                val nameView = TextView(context).apply {
                    text = msg.senderName
                    setTextColor(Color.parseColor("#34B7F1"))
                    textSize = 11f
                    setTypeface(null, android.graphics.Typeface.BOLD)
                    setPadding(0, 0, 0, dp(4))
                }
                addView(nameView)
            }
            setOnLongClickListener {
                showMessageOptionsDialog(msg, msgContent, isMe)
                true
            }
            
            // Swipe to Reply Touch Listener
            var startX = 0f
            var isSwiping = false
            @SuppressLint("ClickableViewAccessibility")
            setOnTouchListener { view, event ->
                when (event.action) {
                    android.view.MotionEvent.ACTION_DOWN -> {
                        startX = event.rawX
                        isSwiping = false
                        false
                    }
                    android.view.MotionEvent.ACTION_MOVE -> {
                        val deltaX = event.rawX - startX
                        if (deltaX > dp(20)) {
                            view.isLongClickable = false // Temporarily disable long click while dragging
                            isSwiping = true
                            view.parent?.requestDisallowInterceptTouchEvent(true)
                            val translation = deltaX.coerceIn(0f, dp(80).toFloat())
                            view.translationX = translation
                            true
                        } else {
                            false
                        }
                    }
                    android.view.MotionEvent.ACTION_UP, android.view.MotionEvent.ACTION_CANCEL -> {
                        view.isLongClickable = true // Re-enable long click
                        if (isSwiping) {
                            val currentTranslation = view.translationX
                            view.animate().translationX(0f).setDuration(150).start()
                            if (currentTranslation >= dp(50)) {
                                replyingToMessage = msg
                                showReplyPreview(msg)
                                Toast.makeText(context, "Replying...", Toast.LENGTH_SHORT).show()
                            }
                            true
                        } else {
                            false
                        }
                    }
                    else -> false
                }
            }
        }

        // Reply Reference Card inside bubble
        val replyToObj = msg.replyTo
        if (replyToObj != null) {
            val repliedText = (replyToObj.content as? String) ?: "Attachment"
            val replyCard = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                setPadding(dp(8), dp(4), dp(8), dp(4))
                background = GradientDrawable().apply {
                    setColor(Color.parseColor("#15000000"))
                    cornerRadius = dp(8).toFloat()
                }
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = dp(6)
                }
            }
            val replySender = TextView(context).apply {
                text = if (replyToObj.senderId == savedUserId) "You" else (replyToObj.senderName ?: "Agent")
                setTextColor(Color.parseColor("#00A884"))
                textSize = 11f
                setTypeface(null, android.graphics.Typeface.BOLD)
            }
            val replyBody = TextView(context).apply {
                text = repliedText
                setTextColor(Color.parseColor("#CCCCCC"))
                textSize = 11f
                maxLines = 1
                ellipsize = android.text.TextUtils.TruncateAt.END
            }
            replyCard.addView(replySender)
            replyCard.addView(replyBody)
            messageBubbleWrapper.addView(replyCard)
        }

        // Add main content to wrapper
        if (msg.isUploading) {
            val loadingLayout = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(8), dp(8), dp(8), dp(8))
            }
            val spinner = android.widget.ProgressBar(context).apply {
                layoutParams = LinearLayout.LayoutParams(dp(20), dp(20)).apply {
                    rightMargin = dp(8)
                }
            }
            val loadingText = TextView(context).apply {
                text = "Uploading ${msg.fileType ?: "file"}..."
                setTextColor(Color.WHITE)
                textSize = 12f
            }
            loadingLayout.addView(spinner)
            loadingLayout.addView(loadingText)
            messageBubbleWrapper.addView(loadingLayout)
        }
        else if (msg.isDeleted == true) {
            val bubble = TextView(context).apply {
                text = "This message was deleted"
                setTextColor(if (isMe) Color.parseColor("#B3FFFFFF") else Color.parseColor("#8696A0"))
                textSize = 13f
                tag = "msg_text_tag"
                maxWidth = (resources.displayMetrics.widthPixels * 0.65).toInt()
                setTypeface(null, android.graphics.Typeface.ITALIC)
            }
            messageBubbleWrapper.addView(bubble)
        }
        else if (msg.fileType == "image" && !msg.fileUrl.isNullOrEmpty()) {
            val resolvedUrl = getFullUrl(msg.fileUrl)
            val imgView = ImageView(context).apply {
                scaleType = ImageView.ScaleType.FIT_CENTER
                adjustViewBounds = true
                maxHeight = dp(200)
                maxWidth = (resources.displayMetrics.widthPixels * 0.65).toInt()
                setOnClickListener {
                    val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(resolvedUrl))
                    browserIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    startActivity(browserIntent)
                }
            }
            val cached = ImageCache.get(resolvedUrl)
            if (cached != null) {
                imgView.setImageBitmap(cached)
            } else {
                Thread {
                    try {
                        val connection = java.net.URL(resolvedUrl).openConnection() as java.net.HttpURLConnection
                        connection.doInput = true
                        connection.connect()
                        val input = connection.inputStream
                        val bitmap = android.graphics.BitmapFactory.decodeStream(input)
                        if (bitmap != null) {
                            ImageCache.put(resolvedUrl, bitmap)
                            android.os.Handler(android.os.Looper.getMainLooper()).post {
                                imgView.setImageBitmap(bitmap)
                            }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }.start()
            }
            messageBubbleWrapper.addView(imgView)
        }
        else if (msg.fileType == "audio" && !msg.fileUrl.isNullOrEmpty()) {
            val resolvedUrl = getFullUrl(msg.fileUrl)
            var mediaPlayer: android.media.MediaPlayer? = null
            var isPlaying = false
            
            val audioLayout = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(dp(4), dp(4), dp(8), dp(4))
                layoutParams = LinearLayout.LayoutParams(
                    dp(180),
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
            }

            val playBtn = FrameLayout(context).apply {
                layoutParams = LinearLayout.LayoutParams(dp(28), dp(28)).apply {
                    rightMargin = dp(6)
                }
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(Color.parseColor("#33FFFFFF"))
                }
            }
            val playIcon = TextView(context).apply {
                text = "▶"
                setTextColor(Color.WHITE)
                textSize = 10f
                gravity = Gravity.CENTER
            }
            playBtn.addView(playIcon)
            
            val contentLayout = LinearLayout(context).apply {
                orientation = LinearLayout.VERTICAL
                layoutParams = LinearLayout.LayoutParams(
                    0,
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    1f
                )
            }
            
            val progressBar = android.widget.ProgressBar(context, null, android.R.attr.progressBarStyleHorizontal).apply {
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dp(3)
                ).apply {
                    bottomMargin = dp(2)
                }
                max = 100
                progress = 0
                progressTintList = android.content.res.ColorStateList.valueOf(
                    if (isMe) Color.WHITE else Color.parseColor("#34B7F1")
                )
                progressBackgroundTintList = android.content.res.ColorStateList.valueOf(Color.parseColor("#44FFFFFF"))
            }

            val metaLayout = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                )
            }
            
            val statusText = TextView(context).apply {
                text = "Voice note"
                setTextColor(if (isMe) Color.parseColor("#CCFFFFFF") else Color.parseColor("#8696A0"))
                textSize = 9f
                layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            }
            val micIcon = TextView(context).apply {
                text = "🎙"
                textSize = 9f
            }
            
            metaLayout.addView(statusText)
            metaLayout.addView(micIcon)
            
            contentLayout.addView(progressBar)
            contentLayout.addView(metaLayout)
            
            audioLayout.addView(playBtn)
            audioLayout.addView(contentLayout)

            val progressHandler = android.os.Handler(android.os.Looper.getMainLooper())
            val updateProgressRunnable = object : Runnable {
                override fun run() {
                    val mp = mediaPlayer
                    if (mp != null && isPlaying) {
                        val current = mp.currentPosition
                        val duration = mp.duration
                        if (duration > 0) {
                            progressBar.progress = ((current.toFloat() / duration.toFloat()) * 100).toInt()
                        }
                        progressHandler.postDelayed(this, 150)
                    }
                }
            }
            
            audioLayout.setOnClickListener {
                if (isPlaying) {
                    try {
                        mediaPlayer?.stop()
                        mediaPlayer?.release()
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                    mediaPlayer = null
                    isPlaying = false
                    playIcon.text = "▶"
                    statusText.text = "Voice note"
                    progressBar.progress = 0
                    progressHandler.removeCallbacks(updateProgressRunnable)
                } else {
                    playIcon.text = "■"
                    statusText.text = "Playing..."
                    isPlaying = true
                    
                    mediaPlayer = android.media.MediaPlayer().apply {
                        try {
                            setAudioStreamType(android.media.AudioManager.STREAM_MUSIC)
                            setDataSource(resolvedUrl)
                            prepareAsync()
                            setOnPreparedListener { 
                                start()
                                progressHandler.post(updateProgressRunnable)
                            }
                            setOnCompletionListener {
                                playIcon.text = "▶"
                                statusText.text = "Voice note"
                                isPlaying = false
                                progressBar.progress = 0
                                progressHandler.removeCallbacks(updateProgressRunnable)
                                release()
                                mediaPlayer = null
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                            playIcon.text = "▶"
                            statusText.text = "Error"
                            isPlaying = false
                            progressBar.progress = 0
                            progressHandler.removeCallbacks(updateProgressRunnable)
                        }
                    }
                }
            }
            messageBubbleWrapper.addView(audioLayout)
        }
        else if (msg.fileType == "video" && !msg.fileUrl.isNullOrEmpty()) {
            val resolvedUrl = getFullUrl(msg.fileUrl)
            val videoBubble = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                isClickable = true
                setOnClickListener {
                    val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(resolvedUrl))
                    browserIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    startActivity(browserIntent)
                }
            }
            val playIcon = TextView(context).apply {
                text = "▶ 🎥 "
                setTextColor(Color.WHITE)
                textSize = 14f
            }
            val videoText = TextView(context).apply {
                text = msgContent.ifEmpty { "Play Video" }
                setTextColor(Color.WHITE)
                textSize = 14f
                paintFlags = paintFlags or android.graphics.Paint.UNDERLINE_TEXT_FLAG
            }
            videoBubble.addView(playIcon)
            videoBubble.addView(videoText)
            messageBubbleWrapper.addView(videoBubble)
        }
        else if (!msg.fileUrl.isNullOrEmpty()) {
            val resolvedUrl = getFullUrl(msg.fileUrl)
            val fileLayout = LinearLayout(context).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                isClickable = true
                setOnClickListener {
                    val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(resolvedUrl))
                    browserIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                    startActivity(browserIntent)
                }
            }
            val fileIcon = TextView(context).apply {
                text = "📄 "
                setTextColor(Color.WHITE)
                textSize = 14f
            }
            val fileText = TextView(context).apply {
                text = msgContent.ifEmpty { "Attachment File" }
                setTextColor(Color.WHITE)
                textSize = 14f
                paintFlags = paintFlags or android.graphics.Paint.UNDERLINE_TEXT_FLAG
            }
            fileLayout.addView(fileIcon)
            fileLayout.addView(fileText)
            messageBubbleWrapper.addView(fileLayout)
        }
        else {
            val bubble = TextView(context).apply {
                text = msgContent
                setTextColor(Color.WHITE)
                textSize = 14f
                tag = "msg_text_tag"
                maxWidth = (resources.displayMetrics.widthPixels * 0.65).toInt()
            }
            messageBubbleWrapper.addView(bubble)
        }

        // Add bubble wrapper to column
        bubbleColumn.addView(messageBubbleWrapper)

        // Timestamp Text below bubble
        val timeView = TextView(context).apply {
            text = timeStr
            setTextColor(Color.parseColor("#8696A0"))
            textSize = 10f
            gravity = if (isMe) Gravity.END else Gravity.START
            setPadding(dp(4), dp(2), dp(4), 0)
        }
        bubbleColumn.addView(timeView)

        messageRow.addView(bubbleColumn)
        
        messageRow.setOnTouchListener { v, event ->
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    v.isLongClickable = false
                    false
                }
                MotionEvent.ACTION_MOVE -> {
                    if (Math.abs(event.x) > 50) {
                        v.isLongClickable = true
                    }
                    false
                }
                MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                    v.isLongClickable = true
                    false
                }
                else -> false
            }
        }

        if (insertIndex != -1) {
            messageContainer?.addView(messageRow, insertIndex)
        } else {
            messageContainer?.addView(messageRow)
        }
        messageViewsMap[msgId] = messageRow
        
        if (insertIndex == -1) {
            messageScrollView?.post {
                messageScrollView?.fullScroll(View.FOCUS_DOWN)
            }
        }
    }

    private fun uploadAndSendVoiceMessage(file: File) {
        val mediaType = "audio/m4a".toMediaTypeOrNull()
        NetworkService.uploadFile(file, mediaType) { result ->
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                result.fold(
                    onSuccess = { fileUrl ->
                        val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
                        val savedUserId = sharedPref.getString("user_id", null)
                        val savedUserName = sharedPref.getString("user_name", "Agent") ?: "Agent"
                        if (savedUserId != null && currentSessionId.isNotEmpty()) {
                            val tempId = java.util.UUID.randomUUID().toString()
                            val localMsg = Message(
                                _id = tempId,
                                tempId = tempId,
                                sessionId = currentSessionId,
                                sender = "merchant",
                                senderId = savedUserId,
                                senderName = savedUserName,
                                content = "Voice Message",
                                timestamp = java.util.Date().toString(),
                                fileType = "audio",
                                fileUrl = fileUrl
                            )
                            appendMessage(localMsg)
                            
                            SocketManager.sendMessage(
                                sessionId = currentSessionId,
                                content = "Voice Message",
                                senderId = savedUserId,
                                senderName = savedUserName,
                                fileUrl = fileUrl,
                                fileType = "audio",
                                tempId = tempId,
                                senderProfilePic = sharedPref.getString("user_profile_pic", "") ?: ""
                            )
                        }
                    },
                    onFailure = { error ->
                        Toast.makeText(this@FloatingBubbleService, "Voice upload failed: ${error.message}", Toast.LENGTH_SHORT).show()
                    }
                )
            }
        }
    }

    private val fileUploadReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val fileType = intent?.getStringExtra("fileType") ?: return
            val fileName = intent?.getStringExtra("fileName") ?: "File Attachment"
            val tempId = intent?.getStringExtra("tempId") ?: java.util.UUID.randomUUID().toString()
            val isUploading = intent?.getBooleanExtra("isUploading", false) ?: false
            val isFailed = intent?.getBooleanExtra("isFailed", false) ?: false
            
            val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
            val savedUserId = sharedPref.getString("user_id", null)
            val savedUserName = sharedPref.getString("user_name", "Agent") ?: "Agent"
            
            if (savedUserId != null && currentSessionId.isNotEmpty()) {
                if (isUploading) {
                    val localMsg = Message(
                        _id = tempId,
                        tempId = tempId,
                        sessionId = currentSessionId,
                        sender = "merchant",
                        senderId = savedUserId,
                        senderName = savedUserName,
                        content = fileName,
                        timestamp = java.util.Date().toString(),
                        fileType = fileType,
                        fileUrl = "",
                        isUploading = true
                    )
                    appendMessage(localMsg)
                } else {
                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                        val existingView = messageViewsMap[tempId]
                        if (existingView != null) {
                            messageContainer?.removeView(existingView)
                            messageViewsMap.remove(tempId)
                        }
                        
                        if (isFailed) {
                            Toast.makeText(context, "Upload failed!", Toast.LENGTH_SHORT).show()
                            return@post
                        }
                        
                        val fileUrl = intent?.getStringExtra("fileUrl") ?: ""
                        val localMsg = Message(
                            _id = tempId,
                            tempId = tempId,
                            sessionId = currentSessionId,
                            sender = "merchant",
                            senderId = savedUserId,
                            senderName = savedUserName,
                            content = fileName,
                            timestamp = java.util.Date().toString(),
                            fileType = fileType,
                            fileUrl = fileUrl,
                            isUploading = false
                        )
                        appendMessage(localMsg)
                        
                        SocketManager.sendMessage(
                            sessionId = currentSessionId,
                            content = fileName,
                            senderId = savedUserId,
                            senderName = savedUserName,
                            fileUrl = fileUrl,
                            fileType = fileType,
                            tempId = tempId
                        )
                    }
                }
            }
        }
    }

    override fun onConnected() {}
    override fun onDisconnected() {}
    override fun onAllSessions(sessions: List<ChatSession>?) {}
    override fun onSessionUpdated(session: ChatSession?) {
        if (session != null && session._id == currentSessionId) {
            updateSessionUI(session)
        }
    }
    override fun onNewSession(session: ChatSession?) {
        if (session != null && session._id == currentSessionId) {
            updateSessionUI(session)
        }
    }
    override fun onSessionDeleted(sessionId: String?) {
        if (sessionId == null) return
        if (sessionId == currentSessionId && chatWindowView != null) {
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                hideChatWindow()
            }
        }
    }
    override fun onReceiveMessage(message: Message?) {
        if (message == null) return
        val msgSessionId = (message.sessionId as? String) ?: ""
        if (msgSessionId == currentSessionId && chatWindowView != null) {
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                appendMessage(message)
                unreadCount = 0
                updateBadge()
            }
        }
    }
    override fun onChatHistory(sessionId: String?, messages: List<Message>?, hasMore: Boolean, isAppend: Boolean) {
        if (messages == null) return
        if (sessionId == currentSessionId && chatWindowView != null) {
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                if (isAppend) {
                    val oldHeight = messageContainer?.height ?: 0
                    messages.forEach { appendMessage(it, insertIndex = 1) }
                    messageScrollView?.post {
                        val newHeight = messageContainer?.height ?: 0
                        messageScrollView?.smoothScrollBy(0, newHeight - oldHeight)
                    }
                } else {
                    messageViewsMap.clear()
                    messageContainer?.removeAllViews()
                    
                    val sess = currentSession
                    if (sess != null && sess.isGroupChat != true && sess.isDirectMessage != true) {
                        insertVisitorInfoCard(sess)
                    }
                    
                    val loadMoreBtn = android.widget.Button(this@FloatingBubbleService).apply {
                        text = "Load Older Messages 🔄"
                        setTextColor(Color.WHITE)
                        textSize = 12f
                        background = android.graphics.drawable.GradientDrawable().apply {
                            setColor(Color.parseColor("#202C33"))
                            cornerRadius = dp(8).toFloat()
                            setStroke(dp(1), Color.parseColor("#00A884"))
                        }
                        val params = LinearLayout.LayoutParams(
                            LinearLayout.LayoutParams.WRAP_CONTENT,
                            LinearLayout.LayoutParams.WRAP_CONTENT
                        ).apply {
                            gravity = Gravity.CENTER_HORIZONTAL
                            topMargin = dp(4)
                            bottomMargin = dp(12)
                        }
                        layoutParams = params
                        setPadding(dp(16), dp(8), dp(16), dp(8))
                        setOnClickListener {
                            val sharedPref = getSharedPreferences("O-ChatPrefs", android.content.Context.MODE_PRIVATE)
                            val savedUserId = sharedPref.getString("user_id", null) ?: ""
                            if (!SocketManager.isConnected() && savedUserId.isNotEmpty()) {
                                android.widget.Toast.makeText(this@FloatingBubbleService, "Reconnecting chat...", android.widget.Toast.LENGTH_SHORT).show()
                                SocketManager.connect(savedUserId)
                            }
                            if (!isHistoryLoading && oldestMessageTimestamp != null) {
                                isHistoryLoading = true
                                SocketManager.getChatHistory(currentSessionId, oldestMessageTimestamp)
                            } else if (!isHistoryLoading && oldestMessageTimestamp == null) {
                                isHistoryLoading = true
                                SocketManager.getChatHistory(currentSessionId)
                            }
                        }
                    }
                    messageContainer?.addView(loadMoreBtn)
                    
                    messages.forEach { appendMessage(it) }
                }
                
                if (messages.isNotEmpty()) {
                    val oldestMsg = messages.firstOrNull()
                    oldestMessageTimestamp = oldestMsg?.timestamp
                }
                isHistoryLoading = false
                hasMoreHistory = hasMore
            }
        }
    }
    override fun onTypingStart(sessionId: String?, senderId: String?, senderName: String?) {
        if (sessionId == null || senderId == null) return
        val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
        val savedUserId = sharedPref.getString("user_id", null) ?: ""
        if (sessionId == currentSessionId && senderId != savedUserId && chatWindowView != null) {
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                typingStatusText?.text = "typing..."
                typingStatusText?.visibility = View.VISIBLE
            }
        }
    }
    override fun onTypingEnd(sessionId: String?, senderId: String?) {
        if (sessionId == null || senderId == null) return
        val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
        val savedUserId = sharedPref.getString("user_id", null) ?: ""
        if (sessionId == currentSessionId && senderId != savedUserId && chatWindowView != null) {
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                typingStatusText?.visibility = View.GONE
            }
        }
    }

    private fun loadAvatar(avatarUrl: String) {
        if (avatarUrl.isEmpty()) return
        
        if (avatarUrl.contains("ui-avatars.com")) {
            val appIconBmp = BitmapFactory.decodeResource(resources, R.mipmap.ic_launcher)
            if (appIconBmp != null) {
                val circleBitmap = getCircleBitmap(appIconBmp)
                bubbleImage?.setImageBitmap(circleBitmap)
            }
            return
        }

        val resolvedUrl = getFullUrl(avatarUrl)
        val cached = ImageCache.get(resolvedUrl)
        if (cached != null) {
            val circleBitmap = getCircleBitmap(cached)
            bubbleImage?.setImageBitmap(circleBitmap)
        } else {
            thread {
                try {
                    val url = URL(resolvedUrl)
                    val connection = url.openConnection() as HttpURLConnection
                    connection.doInput = true
                    connection.connect()
                    val input = connection.inputStream
                    val rawBitmap = BitmapFactory.decodeStream(input)
                    if (rawBitmap != null) {
                        ImageCache.put(resolvedUrl, rawBitmap)
                        val circleBitmap = getCircleBitmap(rawBitmap)
                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                            bubbleImage?.setImageBitmap(circleBitmap)
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    private fun getCircleBitmap(bitmap: Bitmap): Bitmap {
        val output = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(output)
        val color = -0xbdbdbe
        val paint = Paint()
        val rect = Rect(0, 0, bitmap.width, bitmap.height)
        paint.isAntiAlias = true
        canvas.drawARGB(0, 0, 0, 0)
        paint.color = color
        canvas.drawCircle(bitmap.width / 2f, bitmap.height / 2f, bitmap.width / 2f, paint)
        paint.xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
        canvas.drawBitmap(bitmap, rect, rect, paint)
        return output
    }

    private fun showPreview(text: String) {
        removePreview(animate = false)

        val context = this
        val bubbleParams = floatingView?.layoutParams as? WindowManager.LayoutParams
        val bubbleX = bubbleParams?.x ?: 100
        val bubbleY = bubbleParams?.y ?: 100

        val displayMetrics = resources.displayMetrics
        val screenWidth = displayMetrics.widthPixels
        val isLeft = bubbleX < screenWidth / 2

        val previewLayout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                elevation = dp(8).toFloat()
            }
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#0F1720"))
                cornerRadius = dp(16).toFloat()
                setStroke(dp(1), Color.parseColor("#25D366"))
            }
            setPadding(dp(14), dp(10), dp(14), dp(10))
            alpha = 0f
            translationY = dp(10).toFloat()
            isClickable = true
            setOnClickListener {
                openAppAndGoToChat()
            }
        }

        val titleView = TextView(context).apply {
            setText("💬 New Message")
            setTextColor(Color.parseColor("#25D366"))
            textSize = 10f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(0, 0, 0, dp(4))
        }

        val textView = TextView(context).apply {
            this.text = text
            setTextColor(Color.WHITE)
            textSize = 13f
            maxLines = 3
            ellipsize = android.text.TextUtils.TruncateAt.END
            setTypeface(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.NORMAL)
        }
        previewLayout.addView(titleView)
        previewLayout.addView(textView)

        previewView = previewLayout

        val layoutType = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
        } else {
            @Suppress("DEPRECATION")
            WindowManager.LayoutParams.TYPE_PHONE
        }

        val previewWidth = dp(180)
        val previewParams = WindowManager.LayoutParams(
            previewWidth,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.TOP or Gravity.START
            x = if (isLeft) bubbleX + dp(62) else bubbleX - previewWidth - dp(8)
            y = bubbleY + dp(4)
        }

        try {
            windowManager.addView(previewView, previewParams)
            previewLayout.animate()
                .alpha(1f)
                .translationY(0f)
                .setDuration(300)
                .start()

            previewHandler.postDelayed(removePreviewRunnable, 4000)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun removePreview(animate: Boolean = true) {
        val view = previewView ?: return
        previewHandler.removeCallbacks(removePreviewRunnable)
        if (animate) {
            view.animate()
                .alpha(0f)
                .translationY(-15f)
                .setDuration(250)
                .withEndAction {
                    try {
                        windowManager.removeView(view)
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                    if (previewView == view) {
                        previewView = null
                    }
                }
                .start()
        } else {
            view.animate().cancel()
            try {
                windowManager.removeView(view)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            if (previewView == view) {
                previewView = null
            }
        }
    }

    private fun showMessageOptionsDialog(msg: Message, msgContent: String, isMe: Boolean) {
        val isFile = !msg.fileUrl.isNullOrEmpty()
        val options = mutableListOf<String>()
        if (!isFile) {
            options.add("Copy Text")
        }
        options.add("Reply")
        options.add("Forward")
        if (isMe) {
            if (!isFile) {
                options.add("Edit Message")
            }
            options.add("Delete Message")
        }
        
        val builder = android.app.AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Dialog_Alert)
        builder.setTitle("Message Options")
        builder.setItems(options.toTypedArray()) { _, which ->
            when (options[which]) {
                "Copy Text" -> {
                    val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    val clip = android.content.ClipData.newPlainText("Copied Message", msgContent)
                    clipboard.setPrimaryClip(clip)
                    Toast.makeText(this, "Message copied to clipboard", Toast.LENGTH_SHORT).show()
                }
                "Reply" -> {
                    replyingToMessage = msg
                    replyPreviewText?.text = msgContent.ifEmpty { "Attachment" }
                    replyPreviewContainer?.visibility = View.VISIBLE
                }
                "Forward" -> {
                    val clipboard = getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                    val clip = android.content.ClipData.newPlainText("Forwarded Message", msgContent)
                    clipboard.setPrimaryClip(clip)
                    Toast.makeText(this, "Message copied! Ready to paste in any session", Toast.LENGTH_SHORT).show()
                }
                "Edit Message" -> {
                    showEditMessageDialog(msg)
                }
                "Delete Message" -> {
                    showDeleteMessageConfirmation(msg)
                }
            }
        }
        val dialog = builder.create()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            dialog.window?.setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY)
        } else {
            @Suppress("DEPRECATION")
            dialog.window?.setType(WindowManager.LayoutParams.TYPE_PHONE)
        }
        dialog.show()
    }

    private fun showVoicePreviewDialog(file: java.io.File) {
        val context = this
        val builder = android.app.AlertDialog.Builder(context, android.R.style.Theme_DeviceDefault_Dialog_Alert)
        builder.setTitle("Voice Note Preview")
        
        var mediaPlayer: android.media.MediaPlayer? = null
        var isPlaying = false
        
        val totalMs = try {
            val retriever = android.media.MediaMetadataRetriever()
            retriever.setDataSource(file.absolutePath)
            val timeStr = retriever.extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION)
            retriever.release()
            timeStr?.toInt() ?: 0
        } catch (e: Exception) {
            0
        }
        val formatTime = { ms: Int ->
            val totalSecs = ms / 1000
            val mins = totalSecs / 60
            val secs = totalSecs % 60
            String.format("%02d:%02d", mins, secs)
        }
        
        val dialogLayout = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(15), dp(20), dp(15))
        }
        
        val controlsRow = LinearLayout(context).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
        }
        
        val playButton = android.widget.Button(context).apply {
            text = "▶"
            setTextColor(Color.WHITE)
            textSize = 18f
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#00A884"))
                cornerRadius = dp(20).toFloat()
            }
            layoutParams = LinearLayout.LayoutParams(dp(40), dp(40))
        }
        
        val seekBar = android.widget.SeekBar(context).apply {
            max = totalMs
            progress = 0
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
                leftMargin = dp(10)
                rightMargin = dp(10)
            }
        }
        
        val timeText = TextView(context).apply {
            text = "00:00 / ${formatTime(totalMs)}"
            setTextColor(Color.WHITE)
            textSize = 12f
        }
        
        controlsRow.addView(playButton)
        controlsRow.addView(seekBar)
        controlsRow.addView(timeText)
        dialogLayout.addView(controlsRow)
        
        val progressHandler = android.os.Handler(android.os.Looper.getMainLooper())
        var updateProgressRunnable: Runnable? = null
        updateProgressRunnable = Runnable {
            val mp = mediaPlayer
            if (mp != null && mp.isPlaying) {
                val current = mp.currentPosition
                seekBar.progress = current
                timeText.text = "${formatTime(current)} / ${formatTime(totalMs)}"
                progressHandler.postDelayed(updateProgressRunnable!!, 100)
            }
        }
        
        seekBar.setOnSeekBarChangeListener(object : android.widget.SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: android.widget.SeekBar?, progress: Int, fromUser: Boolean) {
                if (fromUser) {
                    mediaPlayer?.seekTo(progress)
                    timeText.text = "${formatTime(progress)} / ${formatTime(totalMs)}"
                }
            }
            override fun onStartTrackingTouch(sb: android.widget.SeekBar?) {}
            override fun onStopTrackingTouch(sb: android.widget.SeekBar?) {}
        })
        
        playButton.setOnClickListener {
            if (isPlaying) {
                try {
                    mediaPlayer?.pause()
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                isPlaying = false
                playButton.text = "▶"
            } else {
                playButton.text = "⏸"
                isPlaying = true
                if (mediaPlayer == null) {
                    mediaPlayer = android.media.MediaPlayer().apply {
                        try {
                            setAudioStreamType(android.media.AudioManager.STREAM_MUSIC)
                            setDataSource(file.absolutePath)
                            prepare()
                            start()
                            progressHandler.post(updateProgressRunnable!!)
                            setOnCompletionListener {
                                isPlaying = false
                                playButton.text = "▶"
                                seekBar.progress = 0
                                timeText.text = "00:00 / ${formatTime(totalMs)}"
                                release()
                                mediaPlayer = null
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                            isPlaying = false
                            playButton.text = "▶"
                        }
                    }
                } else {
                    mediaPlayer?.start()
                    progressHandler.post(updateProgressRunnable!!)
                }
            }
        }
        
        val cleanup = {
            progressHandler.removeCallbacks(updateProgressRunnable!!)
            try {
                mediaPlayer?.stop()
                mediaPlayer?.release()
            } catch (e: Exception) {}
            mediaPlayer = null
        }
        
        builder.setView(dialogLayout)
        
        builder.setNegativeButton("Delete") { _, _ ->
            cleanup()
            file.delete()
            Toast.makeText(context, "Voice recording deleted", Toast.LENGTH_SHORT).show()
        }
        
        builder.setPositiveButton("Send") { _, _ ->
            cleanup()
            uploadAndSendVoiceMessage(file)
        }
        
        val dialog = builder.create()
        dialog.setOnDismissListener {
            cleanup()
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            dialog.window?.setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY)
        } else {
            @Suppress("DEPRECATION")
            dialog.window?.setType(WindowManager.LayoutParams.TYPE_PHONE)
        }
        dialog.show()
    }

    private fun showEditMessageDialog(msg: Message) {
        val context = this
        val msgId = msg._id ?: return
        val builder = android.app.AlertDialog.Builder(context, android.R.style.Theme_DeviceDefault_Dialog_Alert)
        builder.setTitle("Edit Message")
        
        val input = EditText(context).apply {
            setText(msg.content)
            setTextColor(Color.WHITE)
        }
        builder.setView(input)
        
        builder.setPositiveButton("Save") { _, _ ->
            val newText = input.text.toString().trim()
            val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
            val savedUserId = sharedPref.getString("user_id", null)
            if (newText.isNotEmpty() && savedUserId != null) {
                SocketManager.editMessage(
                    messageId = msgId,
                    newContent = newText,
                    sessionId = currentSessionId,
                    merchantId = savedUserId
                )
            }
        }
        builder.setNegativeButton("Cancel") { dialog, _ -> dialog.cancel() }
        
        val dialog = builder.create()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            dialog.window?.setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY)
        } else {
            @Suppress("DEPRECATION")
            dialog.window?.setType(WindowManager.LayoutParams.TYPE_PHONE)
        }
        dialog.show()
    }

    private fun showDeleteMessageConfirmation(msg: Message) {
        val context = this
        val msgId = msg._id ?: return
        val builder = android.app.AlertDialog.Builder(context, android.R.style.Theme_DeviceDefault_Dialog_Alert)
        builder.setTitle("Delete Message")
        builder.setMessage("Are you sure you want to delete this message?")
        
        builder.setPositiveButton("Delete") { _, _ ->
            val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
            val savedUserId = sharedPref.getString("user_id", null)
            if (savedUserId != null) {
                SocketManager.deleteMessage(
                    messageId = msgId,
                    sessionId = currentSessionId,
                    merchantId = savedUserId
                )
            }
        }
        builder.setNegativeButton("Cancel") { dialog, _ -> dialog.cancel() }
        
        val dialog = builder.create()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            dialog.window?.setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY)
        } else {
            @Suppress("DEPRECATION")
            dialog.window?.setType(WindowManager.LayoutParams.TYPE_PHONE)
        }
        dialog.show()
    }

    override fun onDestroy() {
        super.onDestroy()

        // Cancel pending preview auto-dismiss timer
        previewHandler.removeCallbacks(removePreviewRunnable)

        // Remove preview popup immediately (no animation — service is dying)
        previewView?.let { view ->
            try { windowManager.removeView(view) } catch (e: Exception) { e.printStackTrace() }
            previewView = null
        }

        // Remove chat window immediately (skip slide-down animation)
        chatWindowView?.let { view ->
            try { windowManager.removeView(view) } catch (e: Exception) { e.printStackTrace() }
            chatWindowView = null
            chatContainerView = null
        }

        // Remove floating bubble
        floatingView?.let { view ->
            try { windowManager.removeView(view) } catch (e: Exception) { e.printStackTrace() }
            floatingView = null
        }

        // Remove drag-to-remove zone
        removeZoneView?.let { view ->
            try { windowManager.removeView(view) } catch (e: Exception) { e.printStackTrace() }
            removeZoneView = null
        }

        // Unregister socket and broadcast listeners
        try { unregisterReceiver(fileUploadReceiver) } catch (e: Exception) { e.printStackTrace() }
        SocketManager.unregisterListener(this)
        SocketManager.stopViewingSession()
    }

    private fun showVisitorProfileDialog(context: Context) {
        val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
        val token = sharedPref.getString("jwt_token", null)
        
        val showLocalDialog = { session: ChatSession? ->
            val builder = android.app.AlertDialog.Builder(context, android.app.AlertDialog.THEME_DEVICE_DEFAULT_DARK)
            
            // Read bubble visitor fallbacks
            val fallbackName = sharedPref.getString("bubble_visitor_name", "") ?: ""
            val nameToShow = session?.visitorName ?: fallbackName.ifEmpty { displayName }
            builder.setTitle(nameToShow)
            
            val detailsBuilder = StringBuilder().apply {
                append("Session ID: $currentSessionId\n\n")
                if (session != null) {
                    session.visitorEmail?.takeIf { it.isNotEmpty() }?.let { append("Email: $it\n") }
                    session.visitorPhone?.takeIf { it.isNotEmpty() }?.let { append("Phone: $it\n") }
                    session.visitorDomain?.takeIf { it.isNotEmpty() }?.let { append("Website: $it\n") }
                    session.visitorPath?.takeIf { it.isNotEmpty() }?.let { append("Page: $it\n") }
                    session.visitorDetails?.takeIf { it.isNotEmpty() }?.let { append("Platform: $it\n") }
                    if (!session.assignedAgent.isNullOrEmpty()) {
                        append("Assigned Agent: ${session.assignedAgentName}\n")
                    } else {
                        append("Assigned Agent: Unassigned\n")
                    }
                } else {
                    val fallbackEmail = sharedPref.getString("bubble_visitor_email", "") ?: ""
                    val fallbackPhone = sharedPref.getString("bubble_visitor_phone", "") ?: ""
                    val fallbackDomain = sharedPref.getString("bubble_visitor_domain", "") ?: ""
                    val fallbackPath = sharedPref.getString("bubble_visitor_path", "") ?: ""
                    
                    if (fallbackEmail.isNotEmpty()) append("Email: $fallbackEmail\n")
                    if (fallbackPhone.isNotEmpty()) append("Phone: $fallbackPhone\n")
                    if (fallbackDomain.isNotEmpty()) append("Website: $fallbackDomain\n")
                    if (fallbackPath.isNotEmpty()) append("Page: $fallbackPath\n")
                    append("Assigned Agent: Unassigned (Local Cache)\n")
                }
            }
            builder.setMessage(detailsBuilder.toString())
            builder.setPositiveButton("Close") { dialog, _ -> dialog.dismiss() }
            
            val isUnassigned = session?.assignedAgent.isNullOrEmpty()
            if (isUnassigned && token != null && session?.isDirectMessage != true && !isDirectMessageSession) {
                builder.setNeutralButton("Join Session") { dialog, _ ->
                    val myUserId = sharedPref.getString("user_id", "") ?: ""
                    val myUserName = sharedPref.getString("user_name", "Agent") ?: "Agent"
                    if (myUserId.isNotEmpty()) {
                        if (!SocketManager.isConnected()) {
                            Toast.makeText(context, "Reconnecting live chat server...", Toast.LENGTH_SHORT).show()
                        }
                        SocketManager.joinSession(
                            sessionId = currentSessionId,
                            agentId = myUserId,
                            agentName = myUserName,
                            merchantId = myUserId,
                            onResult = { success, errorMsg ->
                                if (success) {
                                    Toast.makeText(context, "Joined session successfully!", Toast.LENGTH_SHORT).show()
                                    fetchSessionDetailsAndRefresh()
                                } else {
                                    Toast.makeText(context, errorMsg ?: "Error joining session", Toast.LENGTH_LONG).show()
                                }
                            }
                        )
                    }
                    dialog.dismiss()
                }
            }
            
            if (session?.isDirectMessage != true && !isDirectMessageSession) {
                builder.setNegativeButton("End Session") { dialog, _ ->
                    val builderConfirm = android.app.AlertDialog.Builder(context, android.app.AlertDialog.THEME_DEVICE_DEFAULT_DARK)
                    builderConfirm.setTitle("End Session")
                    builderConfirm.setMessage("Are you sure you want to end this chat session?")
                    builderConfirm.setPositiveButton("Yes") { _, _ ->
                        SocketManager.closeSession(currentSessionId)
                        Toast.makeText(context, "Session ended", Toast.LENGTH_SHORT).show()
                        hideChatWindow()
                    }
                    builderConfirm.setNegativeButton("No") { dConfirm, _ -> dConfirm.dismiss() }
                    
                    val confirmDialog = builderConfirm.create()
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        confirmDialog.window?.setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY)
                    } else {
                        @Suppress("DEPRECATION")
                        confirmDialog.window?.setType(WindowManager.LayoutParams.TYPE_PHONE)
                    }
                    confirmDialog.show()
                    dialog.dismiss()
                }
            }
            
            val dialog = builder.create()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                dialog.window?.setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY)
            } else {
                @Suppress("DEPRECATION")
                dialog.window?.setType(WindowManager.LayoutParams.TYPE_PHONE)
            }
            dialog.show()
        }

        if (token == null) {
            showLocalDialog(null)
            return
        }

        @Suppress("DEPRECATION")
        val progressDialog = android.app.ProgressDialog(context).apply {
            setMessage("Loading profile...")
            setCancelable(true)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            progressDialog.window?.setType(WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY)
        } else {
            @Suppress("DEPRECATION")
            progressDialog.window?.setType(WindowManager.LayoutParams.TYPE_PHONE)
        }
        progressDialog.show()

        NetworkService.fetchSessions(token) { result ->
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                try {
                    progressDialog.dismiss()
                } catch (e: Exception) {
                    e.printStackTrace()
                }
                result.fold(
                    onSuccess = { list ->
                        val session = list.find { it._id == currentSessionId }
                        showLocalDialog(session)
                    },
                    onFailure = {
                        showLocalDialog(null)
                    }
                )
            }
        }
    }

    private fun showReplyPreview(msg: Message) {
        val container = replyPreviewContainer ?: return
        val preview = replyPreviewText ?: return
        preview.text = msg.content.ifEmpty { "Attachment" }
        container.visibility = View.VISIBLE
        messageScrollView?.postDelayed({
            messageScrollView?.fullScroll(View.FOCUS_DOWN)
        }, 100)
    }

    private fun getInitialAvatar(name: String, colorHex: String = "#00A884"): android.graphics.Bitmap {
        val density = resources.displayMetrics.density
        val size = (32 * density).toInt()
        val bitmap = android.graphics.Bitmap.createBitmap(size, size, android.graphics.Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(bitmap)
        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.parseColor(colorHex)
            style = android.graphics.Paint.Style.FILL
        }
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, paint)
        
        paint.color = Color.WHITE
        paint.textSize = 14 * density
        paint.typeface = android.graphics.Typeface.create(android.graphics.Typeface.DEFAULT, android.graphics.Typeface.BOLD)
        paint.textAlign = android.graphics.Paint.Align.CENTER
        
        val initial = if (name.isNotEmpty()) name.take(1).uppercase(java.util.Locale.getDefault()) else "G"
        val yPos = (canvas.height / 2f - (paint.descent() + paint.ascent()) / 2f)
        canvas.drawText(initial, canvas.width / 2f, yPos, paint)
        return bitmap
    }

    private fun getFullUrl(url: String): String {
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

    private fun fetchSessionDetailsAndRefresh() {
        val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
        val token = sharedPref.getString("jwt_token", null)
        if (token != null && currentSessionId.isNotEmpty()) {
            NetworkService.fetchSessions(token) { result ->
                result.fold(
                    onSuccess = { list ->
                        val session = list.find { it._id == currentSessionId }
                        if (session != null) {
                            updateSessionUI(session)
                        }
                    },
                    onFailure = { /* ignore */ }
                )
            }
        }
    }

    private fun updateSessionUI(session: ChatSession) {
        currentSession = session
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            if (session.isGroupChat != true && session.isDirectMessage != true) {
                insertVisitorInfoCard(session)
            }
            isDirectMessageSession = session.isDirectMessage == true
            if (session.isGroupChat == true || !session.groupName.isNullOrEmpty() || session.widgetId == "group_chat") {
                isGroupSession = true
                displayName = session.groupName ?: displayName
                headerTitleText?.text = displayName
                
                val groupImg = session.groupImage ?: ""
                if (groupImg.isNotEmpty()) {
                    loadAvatar(groupImg)
                    loadHeaderAvatar(groupImg)
                } else {
                    val initialBmp = getInitialAvatar(displayName)
                    bubbleImage?.setImageBitmap(initialBmp)
                    headerAvatarView?.setImageBitmap(initialBmp)
                }
            } else {
                isGroupSession = false
                val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
                if (session.isDirectMessage == true) {
                    val otherParticipant = session.dmParticipants?.firstOrNull { it.userId != sharedPref.getString("user_id", "") }
                    if (otherParticipant != null) {
                        displayName = otherParticipant.name ?: displayName
                        headerTitleText?.text = displayName
                        val pPic = otherParticipant.profilePic ?: ""
                        if (pPic.isNotEmpty()) {
                            loadAvatar(pPic)
                            loadHeaderAvatar(pPic)
                        } else {
                            val initialBmp = getInitialAvatar(displayName)
                            bubbleImage?.setImageBitmap(initialBmp)
                            headerAvatarView?.setImageBitmap(initialBmp)
                        }
                    }
                }
            }

            // 1. Update Join Session Banner and Input Bar dynamically based on online status
            val isLiveVisitor = session.visitorStatus == "online" || session.visitorStatus == "minimized" || session.visitorStatus == "opened"
            if (session.assignedAgent.isNullOrEmpty() && session.isGroupChat != true && session.isDirectMessage != true && isLiveVisitor) {
                joinBannerView?.visibility = View.VISIBLE
                inputBar?.visibility = View.GONE
                bannerTitleText?.text = "Live Visitor Online"
                bannerSubText?.text = "Do you want to start a chat with them?"
            } else {
                joinBannerView?.visibility = View.GONE
                inputBar?.visibility = View.VISIBLE
            }

            // 2. Update status and path UI
            if (session.isGroupChat != true && session.isDirectMessage != true) {
                headerView?.background = GradientDrawable().apply {
                    setColor(Color.parseColor("#0F1720"))
                    val r = dp(16).toFloat()
                    cornerRadii = floatArrayOf(r, r, r, r, 0f, 0f, 0f, 0f)
                    val strokeColor = if (isLiveVisitor) Color.parseColor("#25D366") else Color.parseColor("#EF4444")
                    setStroke(dp(1), strokeColor)
                }

                val statusStr = if (isLiveVisitor) "Active" else "Offline"
                val pathStr = if (!session.visitorPath.isNullOrEmpty()) " • ${session.visitorPath}" else ""
                val domainStr = if (!session.visitorDomain.isNullOrEmpty()) " 🌐 ${session.visitorDomain}" else ""
                visitorStatusText?.text = "$statusStr$domainStr$pathStr"
                visitorStatusText?.setTextColor(if (isLiveVisitor) Color.parseColor("#25D366") else Color.parseColor("#EF4444"))
                visitorStatusText?.visibility = View.VISIBLE
            } else {
                visitorStatusText?.visibility = View.GONE
            }
        }
    }

    private fun insertVisitorInfoCard(session: ChatSession) {
        val context = this
        val dp = { value: Int -> 
            TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()
        }

        val cardId = "visitor_info_card_${session._id}"
        if (messageViewsMap.containsKey(cardId)) {
            // Already added
            return
        }

        val infoCard = LinearLayout(context).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(12), dp(14), dp(12))
            background = GradientDrawable().apply {
                setColor(Color.parseColor("#1F2C34"))
                cornerRadius = dp(14).toFloat()
                setStroke(dp(1), Color.parseColor("#00A884"))
            }
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                topMargin = dp(8)
                bottomMargin = dp(12)
                leftMargin = dp(12)
                rightMargin = dp(12)
            }
        }

        val headerTitle = TextView(context).apply {
            text = "ℹ️ VISITOR INFORMATION"
            setTextColor(Color.parseColor("#00A884"))
            textSize = 10f
            setTypeface(null, android.graphics.Typeface.BOLD)
            setPadding(0, 0, 0, dp(8))
        }
        infoCard.addView(headerTitle)

        val divider = View(context).apply {
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(1)).apply {
                bottomMargin = dp(8)
            }
            setBackgroundColor(Color.parseColor("#2A3942"))
        }
        infoCard.addView(divider)

        val addInfoRow = { label: String, value: String?, colorHex: String ->
            if (!value.isNullOrEmpty()) {
                val row = LinearLayout(context).apply {
                    orientation = LinearLayout.HORIZONTAL
                    setPadding(0, dp(3), 0, dp(3))
                }
                val labelView = TextView(context).apply {
                    text = label
                    setTextColor(Color.parseColor("#8696A0"))
                    textSize = 11f
                    layoutParams = LinearLayout.LayoutParams(dp(70), LinearLayout.LayoutParams.WRAP_CONTENT)
                }
                val valueView = TextView(context).apply {
                    text = value
                    setTextColor(Color.parseColor(colorHex))
                    textSize = 11f
                    setTypeface(null, android.graphics.Typeface.BOLD)
                    layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
                }
                row.addView(labelView)
                row.addView(valueView)
                infoCard.addView(row)
            }
        }

        addInfoRow("Name:", session.visitorName, "#E9EDEF")
        addInfoRow("Email:", session.visitorEmail, "#34B7F1")
        addInfoRow("Phone:", session.visitorPhone, "#25D366")
        addInfoRow("Website:", session.visitorDomain, "#E28B00")
        addInfoRow("Current Page:", session.visitorPath, "#00A884")
        addInfoRow("Platform:", session.visitorDetails, "#8696A0")

        messageContainer?.addView(infoCard, 0)
        messageViewsMap[cardId] = infoCard
    }

    private fun loadHeaderAvatar(avatarUrl: String) {
        if (avatarUrl.isEmpty()) return
        val resolvedUrl = getFullUrl(avatarUrl)
        val cached = ImageCache.get(resolvedUrl)
        if (cached != null) {
            headerAvatarView?.setImageBitmap(cached)
        } else {
            thread {
                try {
                    val url = URL(resolvedUrl)
                    val connection = url.openConnection() as HttpURLConnection
                    connection.doInput = true
                    connection.connect()
                    val input = connection.inputStream
                    val rawBitmap = BitmapFactory.decodeStream(input)
                    if (rawBitmap != null) {
                        ImageCache.put(resolvedUrl, rawBitmap)
                        android.os.Handler(android.os.Looper.getMainLooper()).post {
                            headerAvatarView?.setImageBitmap(rawBitmap)
                        }
                    }
                } catch (e: Exception) {
                    e.printStackTrace()
                }
            }
        }
    }

    private fun openAppAndGoToChat() {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("screen", "chat")
            putExtra("sessionId", currentSessionId)
            putExtra("displayName", displayName)
        }
        startActivity(intent)
        removePreview(animate = false)
        hideChatWindow()
        stopSelf()
    }

    private fun dp(value: Int): Int {
        return android.util.TypedValue.applyDimension(
            android.util.TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics
        ).toInt()
    }

}
