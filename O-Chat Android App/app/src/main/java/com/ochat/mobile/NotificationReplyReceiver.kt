package com.ochat.mobile

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.RemoteInput
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import kotlin.concurrent.thread

class NotificationReplyReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if ("com.ochat.mobile.ACTION_REPLY" == intent.action) {
            val sessionId = intent.getStringExtra("sessionId") ?: return
            val results = RemoteInput.getResultsFromIntent(intent) ?: return
            val replyText = results.getCharSequence("key_text_reply")?.toString() ?: return

            Log.d("ReplyReceiver", "Received reply for session $sessionId: $replyText")

            // Get saved JWT token
            val sharedPref = context.getSharedPreferences("O-ChatPrefs", Context.MODE_PRIVATE)
            val jwtToken = sharedPref.getString("last_registered_jwt", null)

            if (jwtToken.isNullOrEmpty()) {
                Log.e("ReplyReceiver", "JWT token not found. Cannot send reply.")
                return
            }

            // Send reply to backend
            thread {
                try {
                    val url = URL("https://jh5nng6t-5000.asse.devtunnels.ms/api/auth/merchant/message")
                    val connection = (url.openConnection() as HttpURLConnection).apply {
                        requestMethod = "POST"
                        connectTimeout = 10000
                        readTimeout = 10000
                        doOutput = true
                        setRequestProperty("Content-Type", "application/json")
                        setRequestProperty("Authorization", "Bearer $jwtToken")
                    }

                    val payload = JSONObject().apply {
                        put("sessionId", sessionId)
                        put("content", replyText)
                    }

                    OutputStreamWriter(connection.outputStream).use { writer ->
                        writer.write(payload.toString())
                        writer.flush()
                    }

                    val responseCode = connection.responseCode
                    Log.d("ReplyReceiver", "API response code: $responseCode")

                    if (responseCode == HttpURLConnection.HTTP_OK || responseCode == HttpURLConnection.HTTP_CREATED) {
                        Log.d("ReplyReceiver", "Reply sent successfully!")
                        
                        // Dismiss notification after replying
                        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                        notificationManager.cancel(sessionId.hashCode())
                    } else {
                        Log.e("ReplyReceiver", "Failed to send reply. Response Code: $responseCode")
                    }
                    connection.disconnect()
                } catch (e: Exception) {
                    Log.e("ReplyReceiver", "Error sending quick reply: ${e.message}", e)
                }
            }
        }
    }
}
