package com.ochat.mobile

import android.content.Context
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException

object NetworkService {
    private val client = OkHttpClient.Builder()
        .connectTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .writeTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .readTimeout(60, java.util.concurrent.TimeUnit.SECONDS)
        .build()
    private val gson = Gson()
    private val JSON = "application/json; charset=utf-8".toMediaType()
    
    private const val BASE_URL = "https://jh5nng6t-5000.asse.devtunnels.ms"

    fun login(email: String, password: String, callback: (Result<LoginResponse>) -> Unit) {
        val payload = mapOf("email" to email, "password" to password)
        val body = gson.toJson(payload).toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/login")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val res = gson.fromJson(bodyStr, LoginResponse::class.java)
                        callback(Result.success(res))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    val errMsg = try {
                        val map = gson.fromJson(bodyStr, Map::class.java)
                        map["message"]?.toString() ?: "Login failed"
                    } catch (e: Exception) {
                        "Login failed"
                    }
                    callback(Result.failure(Exception(errMsg)))
                }
            }
        })
    }

    fun fetchSessions(token: String, callback: (Result<List<ChatSession>>) -> Unit) {
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/sessions")
            .header("Authorization", "Bearer $token")
            .get()
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val type = object : TypeToken<List<ChatSession>>() {}.type
                        val res: List<ChatSession> = gson.fromJson(bodyStr, type)
                        callback(Result.success(res))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Failed to fetch sessions")))
                }
            }
        })
    }

    fun fetchMessages(token: String, sessionId: String, callback: (Result<List<Message>>) -> Unit) {
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/sessions/$sessionId/messages")
            .header("Authorization", "Bearer $token")
            .get()
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val type = object : TypeToken<List<Message>>() {}.type
                        val res: List<Message> = gson.fromJson(bodyStr, type)
                        callback(Result.success(res))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Failed to fetch messages")))
                }
            }
        })
    }
    fun searchMerchants(token: String, email: String, callback: (Result<List<User>>) -> Unit) {
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/search?email=$email")
            .header("Authorization", "Bearer $token")
            .get()
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val type = object : TypeToken<List<User>>() {}.type
                        val res: List<User> = gson.fromJson(bodyStr, type)
                        callback(Result.success(res))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Search failed")))
                }
            }
        })
    }

    fun startDirectMessage(token: String, targetUserId: String, callback: (Result<ChatSession>) -> Unit) {
        val payload = mapOf("targetUserId" to targetUserId)
        val body = gson.toJson(payload).toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/direct-message")
            .header("Authorization", "Bearer $token")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val res = gson.fromJson(bodyStr, ChatSession::class.java)
                        callback(Result.success(res))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Failed to start direct message")))
                }
            }
        })
    }

    fun createGroupChat(token: String, groupName: String, targetUserIds: List<String>, callback: (Result<ChatSession>) -> Unit) {
        val payload = mapOf("groupName" to groupName, "targetUserIds" to targetUserIds)
        val body = gson.toJson(payload).toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/group-chat")
            .header("Authorization", "Bearer $token")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val res = gson.fromJson(bodyStr, ChatSession::class.java)
                        callback(Result.success(res))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Failed to create group chat")))
                }
            }
        })
    }

    fun uploadFile(file: java.io.File, mediaType: okhttp3.MediaType?, callback: (Result<String>) -> Unit) {
        val fileBody = okhttp3.RequestBody.create(mediaType, file)
        val requestBody = okhttp3.MultipartBody.Builder()
            .setType(okhttp3.MultipartBody.FORM)
            .addFormDataPart(
                "file",
                file.name,
                fileBody
            )
            .build()

        val request = Request.Builder()
            .url("$BASE_URL/api/upload")
            .post(requestBody)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                if (!response.isSuccessful) {
                    callback(Result.failure(IOException("Unexpected code $response")))
                    return
                }
                val responseBody = response.body?.string()
                if (responseBody != null) {
                    try {
                        val json = org.json.JSONObject(responseBody)
                        val fileUrl = json.getString("fileUrl")
                        callback(Result.success(fileUrl))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(IOException("Empty response body")))
                }
            }
        })
    }

    fun updateProfile(token: String, name: String, email: String, profilePic: String, callback: (Result<User>) -> Unit) {
        val payload = mapOf("name" to name, "email" to email, "profilePic" to profilePic)
        val body = gson.toJson(payload).toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/profile")
            .header("Authorization", "Bearer $token")
            .put(body)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val res = gson.fromJson(bodyStr, User::class.java)
                        callback(Result.success(res))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Profile update failed")))
                }
            }
        })
    }

    fun changePassword(token: String, currentPassword: String, newPassword: String, callback: (Result<String>) -> Unit) {
        val payload = mapOf("currentPassword" to currentPassword, "newPassword" to newPassword)
        val body = gson.toJson(payload).toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/password")
            .header("Authorization", "Bearer $token")
            .put(body)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val json = org.json.JSONObject(bodyStr)
                        val message = json.getString("message")
                        callback(Result.success(message))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Password update failed")))
                }
            }
        })
    }

    fun fetchProfile(token: String, callback: (Result<org.json.JSONObject>) -> Unit) {
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/profile")
            .header("Authorization", "Bearer $token")
            .get()
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val json = org.json.JSONObject(bodyStr)
                        callback(Result.success(json))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Fetch profile failed")))
                }
            }
        })
    }

    fun fetchInvites(token: String, callback: (Result<org.json.JSONArray>) -> Unit) {
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/invites")
            .header("Authorization", "Bearer $token")
            .get()
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val json = org.json.JSONArray(bodyStr)
                        callback(Result.success(json))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Fetch invites failed")))
                }
            }
        })
    }

    fun respondToInvite(token: String, widgetId: String, action: String, callback: (Result<String>) -> Unit) {
        val payload = mapOf("action" to action)
        val body = gson.toJson(payload).toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/invites/$widgetId/respond")
            .header("Authorization", "Bearer $token")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    callback(Result.success(bodyStr))
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Respond to invite failed")))
                }
            }
        })
    }

    fun leaveGroupChat(token: String, sessionId: String, callback: (Result<String>) -> Unit) {
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/group-chat/$sessionId/leave")
            .header("Authorization", "Bearer $token")
            .post("".toRequestBody(null))
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    callback(Result.success(bodyStr))
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Failed to leave group")))
                }
            }
        })
    }

    fun updateGroupSettings(token: String, sessionId: String, groupName: String?, groupImage: String?, callback: (Result<ChatSession>) -> Unit) {
        val payload = mutableMapOf<String, Any>()
        if (groupName != null) payload["groupName"] = groupName
        if (groupImage != null) payload["groupImage"] = groupImage
        val body = gson.toJson(payload).toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/group-chat/$sessionId/settings")
            .header("Authorization", "Bearer $token")
            .put(body)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val res = gson.fromJson(bodyStr, ChatSession::class.java)
                        callback(Result.success(res))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Failed to update group settings")))
                }
            }
        })
    }

    fun updateGroupMember(token: String, sessionId: String, targetUserId: String, nickname: String?, designation: String?, role: String?, profilePic: String? = null, callback: (Result<ChatSession>) -> Unit) {
        val payload = mutableMapOf<String, Any>()
        payload["targetUserId"] = targetUserId
        if (nickname != null) payload["nickname"] = nickname
        if (designation != null) payload["designation"] = designation
        if (role != null) payload["role"] = role
        if (profilePic != null) payload["profilePic"] = profilePic
        val body = gson.toJson(payload).toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/group-chat/$sessionId/member")
            .header("Authorization", "Bearer $token")
            .put(body)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val res = gson.fromJson(bodyStr, ChatSession::class.java)
                        callback(Result.success(res))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Failed to update group member")))
                }
            }
        })
    }

    fun kickGroupMember(token: String, sessionId: String, targetUserId: String, callback: (Result<ChatSession>) -> Unit) {
        val payload = mapOf("targetUserId" to targetUserId)
        val body = gson.toJson(payload).toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/auth/merchant/group-chat/$sessionId/kick")
            .header("Authorization", "Bearer $token")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val res = gson.fromJson(bodyStr, ChatSession::class.java)
                        callback(Result.success(res))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Failed to kick member")))
                }
            }
        })
    }

    fun fetchSubscription(token: String, callback: (Result<org.json.JSONObject>) -> Unit) {
        val request = Request.Builder()
            .url("$BASE_URL/api/subscriptions/me")
            .header("Authorization", "Bearer $token")
            .get()
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        callback(Result.success(org.json.JSONObject(bodyStr)))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Fetch subscription failed")))
                }
            }
        })
    }

    fun fetchPaymentHistory(token: String, callback: (Result<org.json.JSONArray>) -> Unit) {
        val request = Request.Builder()
            .url("$BASE_URL/api/subscriptions/history")
            .header("Authorization", "Bearer $token")
            .get()
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val json = org.json.JSONObject(bodyStr)
                        callback(Result.success(json.getJSONArray("data")))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Fetch history failed")))
                }
            }
        })
    }

    fun fetchPackages(token: String, callback: (Result<org.json.JSONArray>) -> Unit) {
        val request = Request.Builder()
            .url("$BASE_URL/api/subscriptions/packages")
            .header("Authorization", "Bearer $token")
            .get()
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        val json = org.json.JSONObject(bodyStr)
                        callback(Result.success(json.getJSONArray("data")))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Fetch packages failed")))
                }
            }
        })
    }

    fun initializePayment(token: String, packageId: String, callback: (Result<org.json.JSONObject>) -> Unit) {
        val payload = mapOf("packageId" to packageId)
        val body = gson.toJson(payload).toRequestBody(JSON)
        val request = Request.Builder()
            .url("$BASE_URL/api/subscriptions/initialize-payment")
            .header("Authorization", "Bearer $token")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : okhttp3.Callback {
            override fun onFailure(call: okhttp3.Call, e: IOException) {
                callback(Result.failure(e))
            }

            override fun onResponse(call: okhttp3.Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string()
                if (response.isSuccessful && bodyStr != null) {
                    try {
                        callback(Result.success(org.json.JSONObject(bodyStr)))
                    } catch (e: Exception) {
                        callback(Result.failure(e))
                    }
                } else {
                    callback(Result.failure(Exception(bodyStr ?: "Initialize payment failed")))
                }
            }
        })
    }
}

data class LoginResponse(
    val token: String,
    val _id: String,
    val name: String,
    val email: String,
    val profilePic: String? = null,
    val status: String? = null
) {
    fun toUser(): User {
        return User(_id = _id, name = name, email = email, profilePic = profilePic, status = status)
    }
}

data class User(
    val _id: String,
    val name: String,
    val email: String,
    val profilePic: String? = null,
    val status: String? = null
)

data class ChatSession(
    val _id: String? = "",
    val visitorName: String?,
    val groupName: String?,
    val groupImage: String? = null,
    val isGroupChat: Boolean?,
    val isDirectMessage: Boolean?,
    val lastMessage: String?,
    val lastMessageAt: String?,
    val unreadCount: Int? = 0,
    val dmParticipants: List<Participant>? = null,
    val widgetId: String? = null,
    val status: String? = null,
    val visitorStatus: String? = null,
    val visitorEmail: String? = null,
    val visitorPhone: String? = null,
    val visitorDetails: String? = null,
    val visitorDomain: String? = null,
    val visitorPath: String? = null,
    var assignedAgent: String? = null,
    var assignedAgentName: String? = null
)

data class Participant(
    val userId: String?,
    val name: String?,
    val email: String? = null,
    val profilePic: String? = null,
    val role: String?,
    val nickname: String?,
    val designation: String?
)

data class Message(
    val _id: String?,
    val tempId: String? = null,
    val sessionId: String,
    val sender: String,
    val senderId: String?,
    val senderName: String?,
    val content: String,
    val timestamp: String?,
    val fileType: String? = null,
    val fileUrl: String? = null,
    val replyTo: Message? = null,
    val isDeleted: Boolean? = false,
    val senderProfilePic: String? = null,
    val isUploading: Boolean = false
)

object ImageCache {
    private val cache = android.util.LruCache<String, android.graphics.Bitmap>(100)

    fun get(url: String): android.graphics.Bitmap? {
        return cache.get(url)
    }

    fun put(url: String, bitmap: android.graphics.Bitmap) {
        cache.put(url, bitmap)
    }
}
