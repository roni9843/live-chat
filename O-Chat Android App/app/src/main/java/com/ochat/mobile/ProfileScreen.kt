package com.ochat.mobile

import android.net.Uri
import android.os.Build
import android.widget.Toast
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.provider.Settings
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.io.File
import okhttp3.MediaType.Companion.toMediaTypeOrNull

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    token: String,
    currentUserId: String,
    initialName: String,
    initialEmail: String,
    initialProfilePic: String,
    onBack: () -> Unit,
    onProfileUpdated: (newName: String, newEmail: String, newProfilePic: String) -> Unit,
    onNavigateToSubscription: () -> Unit,
    onNavigateToPaymentHistory: () -> Unit
) {
    val context = LocalContext.current
    val scrollState = rememberScrollState()

    var name by remember { mutableStateOf(initialName) }
    var email by remember { mutableStateOf(initialEmail) }
    var profilePic by remember { mutableStateOf(initialProfilePic) }
    
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }

    var isLoading by remember { mutableStateOf(false) }

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

    var isOverlayGranted by remember { mutableStateOf(false) }
    var isNotificationsGranted by remember { mutableStateOf(false) }
    var isMicrophoneGranted by remember { mutableStateOf(false) }
    var isStorageGranted by remember { mutableStateOf(false) }

    LaunchedEffect(checkTrigger) {
        isOverlayGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(context)
        } else {
            true
        }
        isNotificationsGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
        isMicrophoneGranted = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
        isStorageGranted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_IMAGES) == PackageManager.PERMISSION_GRANTED &&
                    ContextCompat.checkSelfPermission(context, Manifest.permission.READ_MEDIA_VIDEO) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_EXTERNAL_STORAGE) == PackageManager.PERMISSION_GRANTED
        }
    }

    val micLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) {
        checkTrigger++
    }

    val notificationLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) {
        checkTrigger++
    }

    val storageLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) {
        checkTrigger++
    }

    // Launcher for file picker
    val imagePickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) {
            isLoading = true
            val tempFile = File(context.cacheDir, "avatar_${System.currentTimeMillis()}.png")
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
                                NetworkService.updateProfile(token, name, email, fileUrl) { updateResult ->
                                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                                        isLoading = false
                                        updateResult.fold(
                                            onSuccess = { updated ->
                                                profilePic = fileUrl
                                                onProfileUpdated(updated.name, updated.email, fileUrl)
                                                Toast.makeText(context, "Profile picture updated successfully!", Toast.LENGTH_SHORT).show()
                                            },
                                            onFailure = { err ->
                                                Toast.makeText(context, "Failed to save profile picture: ${err.message}", Toast.LENGTH_LONG).show()
                                            }
                                        )
                                    }
                                }
                            },
                            onFailure = { err ->
                                isLoading = false
                                Toast.makeText(context, "Upload failed: ${err.message}", Toast.LENGTH_LONG).show()
                            }
                        )
                    }
                }
            } catch (e: Exception) {
                isLoading = false
                Toast.makeText(context, "File copy failed: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        "My Account Settings", 
                        color = Color(0xFFE9EDEF), 
                        fontSize = 19.sp, 
                        fontWeight = FontWeight.Bold
                    ) 
                },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Back", tint = Color(0xFFE9EDEF))
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF1F2C34))
            )
        },
        containerColor = Color(0xFF111B21)
    ) { paddingValues ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Elegant background pattern/gradient
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color(0xFF1F2C34).copy(alpha = 0.2f), Color(0xFF111B21))
                        )
                    )
            )

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(scrollState)
                    .padding(20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Spacer(modifier = Modifier.height(12.dp))

                Card(
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0xFF2A3942), RoundedCornerShape(22.dp)),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
                    shape = RoundedCornerShape(22.dp)
                ) {
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(20.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(132.dp)
                                .clip(CircleShape)
                                .border(3.dp, Color(0xFF25D366), CircleShape)
                                .clickable { imagePickerLauncher.launch("image/*") },
                            contentAlignment = Alignment.Center
                        ) {
                            AvatarImage(
                                displayName = name,
                                avatarUrl = profilePic,
                                modifier = Modifier.size(132.dp),
                                themeColor = Color(0xFF25D366)
                            )

                            Box(
                                modifier = Modifier
                                    .fillMaxSize()
                                    .background(Color.Black.copy(alpha = 0.32f)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Edit,
                                    contentDescription = "Change Picture",
                                    tint = Color.White.copy(alpha = 0.9f),
                                    modifier = Modifier.size(30.dp)
                                )
                            }
                        }

                        Spacer(modifier = Modifier.height(14.dp))
                        Text(
                            text = name.ifBlank { "My Profile" },
                            color = Color.White,
                            fontSize = 22.sp,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = email,
                            color = Color(0xFF8696A0),
                            fontSize = 13.sp,
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis
                        )
                    }
                }

                Spacer(modifier = Modifier.height(10.dp))
                Text(
                    text = "Tap the photo to change it",
                    color = Color(0xFF25D366),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium
                )

                Spacer(modifier = Modifier.height(22.dp))

                // Card 1: Account Information details
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color(0xFF2A3942))
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(
                            text = "ACCOUNT INFORMATION", 
                            color = Color(0xFF00A884), 
                            fontSize = 11.sp, 
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )
                        
                        Spacer(modifier = Modifier.height(16.dp))

                        // Full Name Input
                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it },
                            label = { Text("Display Name") },
                            leadingIcon = { Icon(Icons.Default.Person, contentDescription = null, tint = Color(0xFF8696A0)) },
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF00A884),
                                unfocusedBorderColor = Color(0xFF2A3942),
                                focusedContainerColor = Color(0xFF2A3942).copy(alpha = 0.5f),
                                unfocusedContainerColor = Color(0xFF2A3942).copy(alpha = 0.5f),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedLabelColor = Color(0xFF00A884),
                                unfocusedLabelColor = Color(0xFF8696A0)
                            ),
                            shape = RoundedCornerShape(12.dp),
                            singleLine = true
                        )

                        Spacer(modifier = Modifier.height(14.dp))

                        // Email Address Input
                        OutlinedTextField(
                            value = email,
                            onValueChange = { email = it },
                            readOnly = true,
                            label = { Text("Email Address (locked)") },
                            leadingIcon = { Icon(Icons.Default.Email, contentDescription = null, tint = Color(0xFF8696A0)) },
                            modifier = Modifier.fillMaxWidth(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF00A884),
                                unfocusedBorderColor = Color(0xFF2A3942),
                                focusedContainerColor = Color(0xFF2A3942).copy(alpha = 0.5f),
                                unfocusedContainerColor = Color(0xFF2A3942).copy(alpha = 0.5f),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedLabelColor = Color(0xFF00A884),
                                unfocusedLabelColor = Color(0xFF8696A0)
                            ),
                            shape = RoundedCornerShape(12.dp),
                            singleLine = true
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        Button(
                            onClick = {
                                if (name.isBlank() || email.isBlank()) {
                                    Toast.makeText(context, "Name and Email cannot be blank", Toast.LENGTH_SHORT).show()
                                    return@Button
                                }
                                isLoading = true
                                NetworkService.updateProfile(token, name.trim(), email.trim(), profilePic) { result ->
                                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                                        isLoading = false
                                        result.fold(
                                            onSuccess = { updated ->
                                                onProfileUpdated(updated.name, updated.email, profilePic)
                                                Toast.makeText(context, "Profile settings updated successfully!", Toast.LENGTH_SHORT).show()
                                            },
                                            onFailure = { err ->
                                                Toast.makeText(context, "Failed to update profile: ${err.message}", Toast.LENGTH_LONG).show()
                                            }
                                        )
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00A884)),
                            shape = RoundedCornerShape(24.dp),
                            modifier = Modifier.fillMaxWidth().height(48.dp)
                        ) {
                            Text("Save Account Changes", color = Color(0xFF111B21), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Card 2: Password Update details
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color(0xFF2A3942))
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(
                            text = "CHANGE PASSWORD", 
                            color = Color(0xFF00A884), 
                            fontSize = 11.sp, 
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        // Current Password Input
                        OutlinedTextField(
                            value = currentPassword,
                            onValueChange = { currentPassword = it },
                            label = { Text("Current Password") },
                            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFF8696A0)) },
                            visualTransformation = PasswordVisualTransformation(),
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF00A884),
                                unfocusedBorderColor = Color(0xFF2A3942),
                                focusedContainerColor = Color(0xFF2A3942).copy(alpha = 0.5f),
                                unfocusedContainerColor = Color(0xFF2A3942).copy(alpha = 0.5f),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedLabelColor = Color(0xFF00A884),
                                unfocusedLabelColor = Color(0xFF8696A0)
                            ),
                            shape = RoundedCornerShape(12.dp),
                            singleLine = true
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // New Password Input
                        OutlinedTextField(
                            value = newPassword,
                            onValueChange = { newPassword = it },
                            label = { Text("New Password") },
                            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFF8696A0)) },
                            visualTransformation = PasswordVisualTransformation(),
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF00A884),
                                unfocusedBorderColor = Color(0xFF2A3942),
                                focusedContainerColor = Color(0xFF2A3942).copy(alpha = 0.5f),
                                unfocusedContainerColor = Color(0xFF2A3942).copy(alpha = 0.5f),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedLabelColor = Color(0xFF00A884),
                                unfocusedLabelColor = Color(0xFF8696A0)
                            ),
                            shape = RoundedCornerShape(12.dp),
                            singleLine = true
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        // Confirm Password Input
                        OutlinedTextField(
                            value = confirmPassword,
                            onValueChange = { confirmPassword = it },
                            label = { Text("Confirm New Password") },
                            leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null, tint = Color(0xFF8696A0)) },
                            visualTransformation = PasswordVisualTransformation(),
                            modifier = Modifier.fillMaxWidth(),
                            colors = OutlinedTextFieldDefaults.colors(
                                focusedBorderColor = Color(0xFF00A884),
                                unfocusedBorderColor = Color(0xFF2A3942),
                                focusedContainerColor = Color(0xFF2A3942).copy(alpha = 0.5f),
                                unfocusedContainerColor = Color(0xFF2A3942).copy(alpha = 0.5f),
                                focusedTextColor = Color.White,
                                unfocusedTextColor = Color.White,
                                focusedLabelColor = Color(0xFF00A884),
                                unfocusedLabelColor = Color(0xFF8696A0)
                            ),
                            shape = RoundedCornerShape(12.dp),
                            singleLine = true
                        )

                        Spacer(modifier = Modifier.height(20.dp))

                        Button(
                            onClick = {
                                if (currentPassword.isEmpty() || newPassword.isEmpty() || confirmPassword.isEmpty()) {
                                    Toast.makeText(context, "Please fill in all password fields", Toast.LENGTH_SHORT).show()
                                    return@Button
                                }
                                if (newPassword != confirmPassword) {
                                    Toast.makeText(context, "New passwords do not match", Toast.LENGTH_SHORT).show()
                                    return@Button
                                }
                                isLoading = true
                                NetworkService.changePassword(token, currentPassword, newPassword) { result ->
                                    android.os.Handler(android.os.Looper.getMainLooper()).post {
                                        isLoading = false
                                        result.fold(
                                            onSuccess = { msg ->
                                                Toast.makeText(context, msg, Toast.LENGTH_SHORT).show()
                                                currentPassword = ""
                                                newPassword = ""
                                                confirmPassword = ""
                                            },
                                            onFailure = { err ->
                                                Toast.makeText(context, "Password change failed: ${err.message}", Toast.LENGTH_LONG).show()
                                            }
                                        )
                                    }
                                }
                            },
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00A884)),
                            shape = RoundedCornerShape(24.dp),
                            modifier = Modifier.fillMaxWidth().height(48.dp)
                        ) {
                            Text("Update Password", color = Color(0xFF111B21), fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Card 3: Billing & Subscription
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color(0xFF2A3942))
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(
                            text = "BILLING & BILLS LOGS", 
                            color = Color(0xFF00A884), 
                            fontSize = 11.sp, 
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        Button(
                            onClick = onNavigateToSubscription,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF202C33)),
                            shape = RoundedCornerShape(24.dp),
                            modifier = Modifier.fillMaxWidth().height(48.dp).border(1.dp, Color(0xFF2A3942), RoundedCornerShape(24.dp))
                        ) {
                            Text("Manage Subscription Plans", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }

                        Spacer(modifier = Modifier.height(12.dp))

                        Button(
                            onClick = onNavigateToPaymentHistory,
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF202C33)),
                            shape = RoundedCornerShape(24.dp),
                            modifier = Modifier.fillMaxWidth().height(48.dp).border(1.dp, Color(0xFF2A3942), RoundedCornerShape(24.dp))
                        ) {
                            Text("View Payment Invoices", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        }
                    }
                }

                Spacer(modifier = Modifier.height(20.dp))

                // Card 4: System Permissions
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
                    shape = RoundedCornerShape(16.dp),
                    border = BorderStroke(1.dp, Color(0xFF2A3942))
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Text(
                            text = "SYSTEM PERMISSIONS", 
                            color = Color(0xFF00A884), 
                            fontSize = 11.sp, 
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 1.sp
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        // Overlay Permission Row
                        PermissionRow(
                            title = "Floating Chat Bubble",
                            description = "Allows bubble to draw over other apps",
                            isGranted = isOverlayGranted,
                            onGrantClick = {
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                    val intent = Intent(
                                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                        Uri.parse("package:${context.packageName}")
                                    )
                                    context.startActivity(intent)
                                }
                            }
                        )

                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(color = Color(0xFF2A3942).copy(alpha = 0.5f))
                        Spacer(modifier = Modifier.height(12.dp))

                        // Notification Permission Row
                        PermissionRow(
                            title = "Push Notifications",
                            description = "Shows alerts for new incoming chats",
                            isGranted = isNotificationsGranted,
                            onGrantClick = {
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                    notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                } else {
                                    Toast.makeText(context, "Notifications are enabled by default", Toast.LENGTH_SHORT).show()
                                }
                            }
                        )

                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(color = Color(0xFF2A3942).copy(alpha = 0.5f))
                        Spacer(modifier = Modifier.height(12.dp))

                        // Microphone Permission Row
                        PermissionRow(
                            title = "Microphone Access",
                            description = "Required to record voice messages",
                            isGranted = isMicrophoneGranted,
                            onGrantClick = {
                                micLauncher.launch(Manifest.permission.RECORD_AUDIO)
                            }
                        )

                        Spacer(modifier = Modifier.height(12.dp))
                        HorizontalDivider(color = Color(0xFF2A3942).copy(alpha = 0.5f))
                        Spacer(modifier = Modifier.height(12.dp))

                        // Storage Permission Row
                        PermissionRow(
                            title = "Storage / Media Access",
                            description = "Required to upload and share images/files",
                            isGranted = isStorageGranted,
                            onGrantClick = {
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                    storageLauncher.launch(
                                        arrayOf(
                                            Manifest.permission.READ_MEDIA_IMAGES,
                                            Manifest.permission.READ_MEDIA_VIDEO
                                        )
                                    )
                                } else {
                                    storageLauncher.launch(
                                        arrayOf(
                                            Manifest.permission.READ_EXTERNAL_STORAGE,
                                            Manifest.permission.WRITE_EXTERNAL_STORAGE
                                        )
                                    )
                                }
                            }
                        )
                    }
                }
                
                Spacer(modifier = Modifier.height(24.dp))
            }

            // Elegant Loading Overlay
            AnimatedVisibility(
                visible = isLoading,
                enter = fadeIn(),
                exit = fadeOut()
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color.Black.copy(alpha = 0.6f)),
                    contentAlignment = Alignment.Center
                ) {
                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
                        shape = RoundedCornerShape(16.dp),
                        border = BorderStroke(1.dp, Color(0xFF2A3942)),
                        modifier = Modifier.size(120.dp)
                    ) {
                        Column(
                            modifier = Modifier.fillMaxSize(),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            CircularProgressIndicator(color = Color(0xFF00A884), modifier = Modifier.size(36.dp))
                            Spacer(modifier = Modifier.height(14.dp))
                            Text("Saving...", color = Color(0xFFE9EDEF), fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun PermissionRow(
    title: String,
    description: String,
    isGranted: Boolean,
    onGrantClick: () -> Unit
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = Color.White, fontSize = 14.sp, fontWeight = FontWeight.Bold)
            Text(description, color = Color(0xFF8696A0), fontSize = 11.sp)
        }
        Spacer(modifier = Modifier.width(8.dp))
        if (isGranted) {
            Box(
                modifier = Modifier
                    .background(Color(0xFF0F2C21), shape = RoundedCornerShape(12.dp))
                    .border(1.dp, Color(0xFF25D366).copy(alpha = 0.3f), shape = RoundedCornerShape(12.dp))
                    .padding(horizontal = 10.dp, vertical = 6.dp)
            ) {
                Text("Allowed", color = Color(0xFF25D366), fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        } else {
            Button(
                onClick = onGrantClick,
                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF00A884)),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.height(32.dp)
            ) {
                Text("Enable", color = Color(0xFF111B21), fontSize = 11.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}
