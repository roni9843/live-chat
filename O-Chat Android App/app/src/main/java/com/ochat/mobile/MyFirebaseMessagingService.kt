package com.ochat.mobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.RemoteInput
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.net.HttpURLConnection
import java.net.URL

class MyFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("FCM", "New token generated: $token")
        
        // Save token to SharedPreferences so MainActivity can access and send it to backend
        val sharedPref = getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
        with(sharedPref.edit()) {
            putString("fcm_token", token)
            putBoolean("fcm_token_registered", false) // Needs registration on next login
            apply()
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d("FCM", "Message received from: ${remoteMessage.from}")
 
        try {
            // Check if message contains notification payload
            val title = remoteMessage.notification?.title ?: remoteMessage.data["title"] ?: "New Message"
            val body = remoteMessage.notification?.body ?: remoteMessage.data["body"] ?: "You have a new notification"
            val sessionId = remoteMessage.data["sessionId"] ?: ""
            val avatarUrl = remoteMessage.data["avatarUrl"] ?: ""
            val screen = remoteMessage.data["screen"] ?: ""
            val soundType = remoteMessage.data["soundType"] ?: ""
            val isUnassigned = remoteMessage.data["isUnassigned"] == "true"
            val visitorDomain = remoteMessage.data["visitorDomain"] ?: ""
            val targetDomain = remoteMessage.data["domain"] ?: remoteMessage.data["targetDomain"] ?: visitorDomain

            // For invite notifications, domain is the widget's target domain
            val isInviteNotification = screen == "invite" || screen == "notifications" ||
                remoteMessage.data["type"] == "invite" || title.contains("Invite", ignoreCase = true)

            // Show notifications as normal, but suppress the background bubble overlaid IF user is already in that specific session chat room
            val shouldSuppressBubble = sessionId.isNotEmpty() && SocketManager.activeSessionId == sessionId

            sendNotification(
                title = title,
                body = body,
                sessionId = sessionId,
                avatarUrl = avatarUrl,
                screen = if (isInviteNotification) "notifications" else screen,
                soundType = soundType,
                isUnassigned = isUnassigned,
                visitorDomain = targetDomain
            )
     
            // Start floating bubble service only for chat sessions (not invites) and if overlay is not suppressed
            if (sessionId.isNotEmpty() && !isInviteNotification && !shouldSuppressBubble) {
                if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || android.provider.Settings.canDrawOverlays(this)) {
                    val serviceIntent = Intent(this, FloatingBubbleService::class.java).apply {
                        putExtra("avatarUrl", avatarUrl)
                        putExtra("sessionId", sessionId)
                        putExtra("messageBody", body)
                        putExtra("displayName", title)
                        putExtra("visitorName", remoteMessage.data["visitorName"] ?: "")
                        putExtra("visitorEmail", remoteMessage.data["visitorEmail"] ?: "")
                        putExtra("visitorPhone", remoteMessage.data["visitorPhone"] ?: "")
                        putExtra("visitorDomain", remoteMessage.data["visitorDomain"] ?: "")
                        putExtra("visitorPath", remoteMessage.data["visitorPath"] ?: "")
                    }
                    try {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                            startForegroundService(serviceIntent)
                        } else {
                            startService(serviceIntent)
                        }
                    } catch (e: Exception) {
                        Log.e("FCM", "Failed to start FloatingBubbleService: ${e.message}")
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("FCM", "Error in onMessageReceived: ${e.message}", e)
        }
    }
 
    private fun sendNotification(title: String, body: String, sessionId: String, avatarUrl: String, screen: String = "", soundType: String = "", isUnassigned: Boolean = false, visitorDomain: String = "") {
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra("sessionId", sessionId)
            putExtra("screen", screen)
        }

        // Use unique requestCode per notification so extras are not overwritten
        val requestCode = if (sessionId.isNotEmpty()) sessionId.hashCode() else (screen + System.currentTimeMillis()).hashCode()
        
        val pendingIntent = PendingIntent.getActivity(
            this, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
 
        val isTelephone = isUnassigned || soundType == "telephone"
        val channelId = if (isTelephone) "telephone_alert_channel_v1" else "chat_channel_high_v3"
        val soundUri = if (isTelephone) {
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
        } else {
            RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        }

        val notificationBuilder = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_MAX)

        // Show target website domain as sub-text under notification
        if (visitorDomain.isNotEmpty()) {
            notificationBuilder.setSubText("🌐 $visitorDomain")
        }

        if (isTelephone) {
            val vibratorPattern = longArrayOf(0, 1000, 500, 1000, 500, 2000, 500, 2000, 500, 3000, 500, 4000)
            notificationBuilder.setSound(soundUri)
            notificationBuilder.setVibrate(vibratorPattern)
            notificationBuilder.setCategory(NotificationCompat.CATEGORY_CALL)
        } else {
            notificationBuilder.setSound(soundUri)
            notificationBuilder.setDefaults(NotificationCompat.DEFAULT_ALL)
        }

        // Download and set circular avatar if present
        if (avatarUrl.isNotEmpty()) {
            val rawBitmap = getBitmapFromUrl(avatarUrl)
            if (rawBitmap != null) {
                val circleBitmap = getCircleBitmap(rawBitmap)
                notificationBuilder.setLargeIcon(circleBitmap)
            }
        }

        // Set up inline reply if sessionId is present
        if (sessionId.isNotEmpty()) {
            val remoteInput = RemoteInput.Builder("key_text_reply")
                .setLabel("Reply to message...")
                .build()

            val replyIntent = Intent(this, NotificationReplyReceiver::class.java).apply {
                action = "com.ochat.mobile.ACTION_REPLY"
                putExtra("sessionId", sessionId)
            }

            // RemoteInput actions require PendingIntent.FLAG_MUTABLE starting on Android 12
            val replyPendingIntent = PendingIntent.getBroadcast(
                this,
                sessionId.hashCode(),
                replyIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
            )

            val replyAction = NotificationCompat.Action.Builder(
                android.R.drawable.ic_menu_send,
                "Reply",
                replyPendingIntent
            ).addRemoteInput(remoteInput).build()

            notificationBuilder.addAction(replyAction)
        }

        val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        // Since android Oreo notification channel is needed
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (isTelephone) {
                val channel = NotificationChannel(
                    channelId,
                    "Telephone Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Rings and vibrates on new customer visitor chats"
                    enableLights(true)
                    enableVibration(true)
                    vibrationPattern = longArrayOf(0, 1000, 500, 1000, 500, 2000, 500, 2000, 500, 3000, 500, 4000)
                    val audioAttributes = AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                    setSound(soundUri, audioAttributes)
                }
                notificationManager.createNotificationChannel(channel)
            } else {
                val channel = NotificationChannel(
                    channelId,
                    "Chat Notifications",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Shows notifications for new incoming chat messages"
                    enableLights(true)
                    enableVibration(true)
                }
                notificationManager.createNotificationChannel(channel)
            }
        }

        // Use sessionId hash as notification ID so we can cancel/update it later in ReplyReceiver
        val notificationId = if (sessionId.isNotEmpty()) sessionId.hashCode() else System.currentTimeMillis().toInt()
        notificationManager.notify(notificationId, notificationBuilder.build())
    }

    private fun getBitmapFromUrl(imageUrl: String): Bitmap? {
        return try {
            val url = URL(imageUrl)
            val connection = (url.openConnection() as HttpURLConnection).apply {
                doInput = true
                connectTimeout = 3000 // 3 seconds timeout
                readTimeout = 3000 // 3 seconds timeout
            }
            connection.connect()
            val input = connection.inputStream
            BitmapFactory.decodeStream(input)
        } catch (e: Exception) {
            Log.e("FCM", "Error downloading avatar image: ${e.message}")
            null
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
}
