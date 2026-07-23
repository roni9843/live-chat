// Your existing fetchProfile already merges the server profile response.
// Ensure login/register/get profile responses include:
// subscription: merchant.subscription
//
// Example in loginMerchant response:
subscription: merchant.subscription,
//
// Example in getMerchantProfile response is automatic because profileData
// comes from merchant.toObject().
