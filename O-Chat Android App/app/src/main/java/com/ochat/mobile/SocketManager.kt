package com.ochat.mobile

import android.os.Handler
import android.os.Looper
import android.util.Log
import com.google.gson.Gson
import io.socket.client.IO
import io.socket.client.Socket
import org.json.JSONObject

object SocketManager {
    private var socket: Socket? = null
    private val gson = Gson()
    private val mainHandler = Handler(Looper.getMainLooper())

    interface SocketListener {
        fun onConnected()
        fun onDisconnected()
        fun onAllSessions(sessions: List<ChatSession>?)
        fun onSessionUpdated(session: ChatSession?)
        fun onNewSession(session: ChatSession?)
        fun onReceiveMessage(message: Message?)
        fun onChatHistory(sessionId: String?, messages: List<Message>?, hasMore: Boolean = false, isAppend: Boolean = false)
        fun onTypingStart(sessionId: String?, senderId: String?, senderName: String?)
        fun onTypingEnd(sessionId: String?, senderId: String?)
        fun onNewInvite() {}
        fun onSessionDeleted(sessionId: String?) {}
    }

    private val listeners = mutableSetOf<SocketListener>()
    var activeSessionId: String? = null

    fun registerListener(listener: SocketListener) {
        listeners.add(listener)
    }

    fun unregisterListener(listener: SocketListener) {
        listeners.remove(listener)
    }

    fun isConnected(): Boolean {
        return socket?.connected() ?: false
    }

    fun connect(userId: String) {
        if (socket != null && socket!!.connected()) return
        try {
            val opts = IO.Options().apply {
                transports = arrayOf("websocket")
                forceNew = true
            }
            socket = IO.socket("https://jh5nng6t-5000.asse.devtunnels.ms", opts)
            
            socket?.on(Socket.EVENT_CONNECT) {
                Log.d("SocketManager", "Connected to socket backend")
                socket?.emit("merchant_join", userId)
                mainHandler.post {
                    listeners.forEach { it.onConnected() }
                }
            }

            socket?.on(Socket.EVENT_DISCONNECT) {
                Log.d("SocketManager", "Disconnected from socket backend")
                mainHandler.post {
                    listeners.forEach { it.onDisconnected() }
                }
            }

            socket?.on("all_sessions") { args ->
                if (args.isNotEmpty()) {
                    val data = args[0].toString()
                    try {
                        val list = gson.fromJson(data, Array<ChatSession>::class.java).toList()
                        mainHandler.post {
                            listeners.forEach { it.onAllSessions(list) }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }

            socket?.on("session_updated") { args ->
                if (args.isNotEmpty()) {
                    val data = args[0].toString()
                    try {
                        val session = gson.fromJson(data, ChatSession::class.java)
                        mainHandler.post {
                            listeners.forEach { it.onSessionUpdated(session) }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }

            socket?.on("new_session") { args ->
                if (args.isNotEmpty()) {
                    val data = args[0].toString()
                    try {
                        val session = gson.fromJson(data, ChatSession::class.java)
                        mainHandler.post {
                            listeners.forEach { it.onNewSession(session) }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }

            socket?.on("session_deleted") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val obj = args[0] as org.json.JSONObject
                        val sessionId = obj.getString("sessionId")
                        mainHandler.post {
                            listeners.forEach { it.onSessionDeleted(sessionId) }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }

            socket?.on("new_invite") {
                mainHandler.post {
                    listeners.forEach { it.onNewInvite() }
                }
            }

            socket?.on("receive_message") { args ->
                if (args.isNotEmpty()) {
                    val data = args[0].toString()
                    try {
                        val msg = gson.fromJson(data, Message::class.java)
                        mainHandler.post {
                            listeners.forEach { it.onReceiveMessage(msg) }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }

            socket?.on("chat_history_merchant") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val obj = args[0] as JSONObject
                        val sessionId = obj.getString("sessionId")
                        val messagesArray = obj.getJSONArray("messages")
                        val hasMore = obj.optBoolean("hasMore", false)
                        val isAppend = obj.optBoolean("isAppend", false)

                        val list = mutableListOf<Message>()
                        for (i in 0 until messagesArray.length()) {
                            val msgStr = messagesArray.getJSONObject(i).toString()
                            val msg = gson.fromJson(msgStr, Message::class.java)
                            list.add(msg)
                        }

                        mainHandler.post {
                            listeners.forEach { it.onChatHistory(sessionId, list, hasMore, isAppend) }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }

            socket?.on("typing_start") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val obj = args[0] as JSONObject
                        val sessionId = obj.getString("sessionId")
                        val senderId = obj.getString("senderId")
                        val senderName = obj.getString("senderName")
                        mainHandler.post {
                            listeners.forEach { it.onTypingStart(sessionId, senderId, senderName) }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }

            socket?.on("typing_end") { args ->
                if (args.isNotEmpty()) {
                    try {
                        val obj = args[0] as JSONObject
                        val sessionId = obj.getString("sessionId")
                        val senderId = obj.getString("senderId")
                        mainHandler.post {
                            listeners.forEach { it.onTypingEnd(sessionId, senderId) }
                        }
                    } catch (e: Exception) {
                        e.printStackTrace()
                    }
                }
            }

            socket?.connect()
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun getChatHistory(sessionId: String, before: String? = null) {
        val payload = JSONObject().apply {
            put("sessionId", sessionId)
            if (before != null) {
                put("before", before)
            }
        }
        socket?.emit("get_chat_history", payload)
    }

    fun disconnect() {
        socket?.disconnect()
        socket = null
    }

    fun sendMessage(
        sessionId: String,
        content: String,
        senderId: String,
        senderName: String,
        replyTo: Message? = null,
        tempId: String? = null,
        fileUrl: String? = null,
        fileType: String? = null,
        senderProfilePic: String? = null
    ) {
        try {
            val payload = JSONObject().apply {
                put("sessionId", sessionId)
                put("sender", "merchant")
                put("content", content)
                put("senderId", senderId)
                put("senderName", senderName)
                if (tempId != null) put("tempId", tempId)
                if (fileUrl != null) put("fileUrl", fileUrl)
                if (fileType != null) put("fileType", fileType)
                if (senderProfilePic != null) put("senderProfilePic", senderProfilePic)
                if (replyTo != null) {
                    val replyObj = JSONObject().apply {
                        put("_id", replyTo._id)
                        put("content", replyTo.content)
                        put("sender", replyTo.sender)
                        put("senderName", replyTo.senderName)
                    }
                    put("replyTo", replyObj)
                }
            }
            socket?.emit("send_message", payload)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    fun editMessage(messageId: String, newContent: String, sessionId: String, merchantId: String) {
        val payload = JSONObject().apply {
            put("messageId", messageId)
            put("content", newContent)
            put("sessionId", sessionId)
            put("merchantId", merchantId)
        }
        socket?.emit("edit_message", payload)
    }

    fun deleteMessage(messageId: String, sessionId: String, merchantId: String) {
        val payload = JSONObject().apply {
            put("messageId", messageId)
            put("sessionId", sessionId)
            put("merchantId", merchantId)
        }
        socket?.emit("delete_message", payload)
    }

    fun startViewingSession(sessionId: String, name: String, agentId: String) {
        val payload = JSONObject().apply {
            put("sessionId", sessionId)
            put("name", name)
            put("agentId", agentId)
        }
        socket?.emit("agent_viewing_session", payload)
    }

    fun stopViewingSession() {
        val payload = JSONObject().apply {
            put("sessionId", null)
        }
        socket?.emit("agent_viewing_session", payload)
    }

    fun markAsRead(sessionId: String, merchantId: String) {
        val payload = JSONObject().apply {
            put("sessionId", sessionId)
            put("merchantId", merchantId)
        }
        socket?.emit("mark_as_read", payload)
    }

    fun sendTypingStart(sessionId: String, sender: String, merchantId: String, senderName: String) {
        val payload = JSONObject().apply {
            put("sessionId", sessionId)
            put("sender", sender)
            put("merchantId", merchantId)
            put("senderName", senderName)
        }
        socket?.emit("typing_start", payload)
    }

    fun sendTypingEnd(sessionId: String, sender: String, merchantId: String) {
        val payload = JSONObject().apply {
            put("sessionId", sessionId)
            put("sender", sender)
            put("merchantId", merchantId)
        }
        socket?.emit("typing_end", payload)
    }

    fun joinSession(sessionId: String, agentId: String, agentName: String, merchantId: String, onResult: ((Boolean, String?) -> Unit)? = null) {
        val payload = JSONObject().apply {
            put("sessionId", sessionId)
            put("agentId", agentId)
            put("agentName", agentName)
            put("merchantId", merchantId)
        }
        socket?.emit("join_session", payload)
        // Auto-callback success since socket.io is fire and forget
        onResult?.invoke(true, null)
    }

    fun closeSession(sessionId: String) {
        val payload = JSONObject().apply {
            put("sessionId", sessionId)
        }
        socket?.emit("close_session", payload)
    }
}
