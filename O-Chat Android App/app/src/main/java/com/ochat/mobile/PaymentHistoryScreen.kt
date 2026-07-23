package com.ochat.mobile

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.json.JSONArray
import org.json.JSONObject

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PaymentHistoryScreen(
    token: String,
    onBack: () -> Unit
) {
    val context = LocalContext.current
    var historyList by remember { mutableStateOf<List<JSONObject>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }

    val fetchHistory = {
        isLoading = true
        NetworkService.fetchPaymentHistory(token) { result ->
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                isLoading = false
                result.fold(
                    onSuccess = { array ->
                        val list = mutableListOf<JSONObject>()
                        for (i in 0 until array.length()) {
                            list.add(array.getJSONObject(i))
                        }
                        historyList = list
                    },
                    onFailure = { err ->
                        Toast.makeText(context, "Failed to load payment history: ${err.message}", Toast.LENGTH_LONG).show()
                    }
                )
            }
        }
    }

    LaunchedEffect(Unit) {
        fetchHistory()
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { 
                    Text(
                        "Payment Logs History", 
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
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(Color(0xFF1F2C34).copy(alpha = 0.2f), Color(0xFF111B21))
                        )
                    )
            )

            if (isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = Color(0xFF00A884))
                }
            } else if (historyList.isEmpty()) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    Text("No billing logs recorded yet.", color = Color(0xFF8696A0), fontSize = 14.sp)
                }
            } else {
                LazyColumn(
                    modifier = Modifier
                        .fillMaxSize()
                        .padding(16.dp)
                ) {
                    items(historyList) { item ->
                        val status = item.optString("status", "PENDING")
                        val statusColor = when (status) {
                            "COMPLETED" -> Color(0xFF25D366)
                            "FAILED" -> Color(0xFFE22D00)
                            else -> Color(0xFFE28B00)
                        }

                        Card(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(bottom = 12.dp)
                                .border(1.dp, Color(0xFF2A3942), RoundedCornerShape(12.dp)),
                            colors = CardDefaults.cardColors(containerColor = Color(0xFF1F2C34)),
                            shape = RoundedCornerShape(12.dp)
                        ) {
                            Column(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .padding(16.dp)
                            ) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    modifier = Modifier.fillMaxWidth()
                                ) {
                                    Text(
                                        text = item.optString("packageName", "Subscription Package"),
                                        color = Color.White,
                                        fontSize = 15.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                    Text(
                                        text = status,
                                        color = statusColor,
                                        fontSize = 11.sp,
                                        fontWeight = FontWeight.Bold
                                    )
                                }

                                Spacer(modifier = Modifier.height(4.dp))
                                Text(
                                    text = "${item.optDouble("amount")} BDT",
                                    color = Color(0xFF00A884),
                                    fontSize = 13.sp,
                                    fontWeight = FontWeight.SemiBold
                                )

                                Spacer(modifier = Modifier.height(8.dp))
                                Text(
                                    text = "Invoice: ${item.optString("invoiceNumber")}",
                                    color = Color(0xFF8696A0),
                                    fontSize = 11.sp
                                )

                                val txId = item.optString("transactionId")
                                if (txId.isNotEmpty()) {
                                    Text(
                                        text = "TXID: $txId (via ${item.optString("bank").uppercase()})",
                                        color = Color(0xFF8696A0),
                                        fontSize = 11.sp
                                    )
                                }

                                Text(
                                    text = "Date: ${item.optString("createdAt").take(16).replace("T", " ")}",
                                    color = Color(0xFF8696A0),
                                    fontSize = 11.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
