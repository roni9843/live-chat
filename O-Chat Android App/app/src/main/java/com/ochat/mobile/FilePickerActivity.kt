package com.ochat.mobile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.Log
import android.widget.Toast
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import java.io.File
import java.io.FileOutputStream

class FilePickerActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val typeExtra = intent?.getStringExtra("type") ?: "*/*"
        
        val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
            type = typeExtra
            addCategory(Intent.CATEGORY_OPENABLE)
        }
        
        try {
            startActivityForResult(Intent.createChooser(intent, "Select Attachment"), 1001)
        } catch (e: Exception) {
            Toast.makeText(this, "No file picker available", Toast.LENGTH_SHORT).show()
            finish()
        }
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 1001 && resultCode == RESULT_OK) {
            val uri = data?.data
            if (uri != null) {
                uploadFile(uri)
                return
            }
        }
        finish()
    }

    private fun uploadFile(uri: Uri) {
        val contentResolver = contentResolver
        var fileName = "file"
        var fileSize = 0L

        contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
            if (cursor.moveToFirst()) {
                if (nameIndex != -1) fileName = cursor.getString(nameIndex)
                if (sizeIndex != -1) fileSize = cursor.getLong(sizeIndex)
            }
        }

        // Copy file to cache
        val tempFile = File(cacheDir, fileName)
        try {
            contentResolver.openInputStream(uri)?.use { inputStream ->
                FileOutputStream(tempFile).use { outputStream ->
                    inputStream.copyTo(outputStream)
                }
            }
        } catch (e: Exception) {
            Log.e("FilePickerActivity", "Error copying file to cache", e)
            Toast.makeText(this, "Failed to read file", Toast.LENGTH_SHORT).show()
            finish()
            return
        }

        val mimeType = contentResolver.getType(uri) ?: "application/octet-stream"
        val mediaType = mimeType.toMediaTypeOrNull()

        val fileType = when {
            mimeType.startsWith("image/") -> "image"
            mimeType.startsWith("video/") -> "video"
            mimeType.startsWith("audio/") -> "audio"
            else -> {
                val fileExtension = tempFile.extension.lowercase()
                when (fileExtension) {
                    "jpg", "jpeg", "png", "gif", "webp" -> "image"
                    "mp4", "mkv", "avi", "mov", "3gp" -> "video"
                    "mp3", "wav", "m4a", "ogg", "aac" -> "audio"
                    else -> "document"
                }
            }
        }

        val tempId = java.util.UUID.randomUUID().toString()
        val startBroadcast = Intent("com.ochat.mobile.FILE_UPLOADED").apply {
            putExtra("tempId", tempId)
            putExtra("isUploading", true)
            putExtra("fileType", fileType)
            putExtra("fileName", fileName)
            setPackage(packageName)
        }
        sendBroadcast(startBroadcast)

        NetworkService.uploadFile(tempFile, mediaType) { result ->
            result.fold(
                onSuccess = { fileUrl ->
                    val broadcastIntent = Intent("com.ochat.mobile.FILE_UPLOADED").apply {
                        putExtra("tempId", tempId)
                        putExtra("isUploading", false)
                        putExtra("fileUrl", fileUrl)
                        putExtra("fileType", fileType)
                        putExtra("fileName", fileName)
                        setPackage(packageName)
                    }
                    sendBroadcast(broadcastIntent)
                },
                onFailure = { error ->
                    Log.e("FilePickerActivity", "Upload failed", error)
                    val failBroadcast = Intent("com.ochat.mobile.FILE_UPLOADED").apply {
                        putExtra("tempId", tempId)
                        putExtra("isUploading", false)
                        putExtra("isFailed", true)
                        putExtra("fileType", fileType)
                        putExtra("fileName", fileName)
                        setPackage(packageName)
                    }
                    sendBroadcast(failBroadcast)
                }
            )
        }
        finish()
    }
}
