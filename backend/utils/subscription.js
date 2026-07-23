const addDuration = (date, value, unit) => {
  const result = new Date(date);

  if (unit === "year") {
    result.setFullYear(result.getFullYear() + Number(value));
  } else {
    result.setMonth(result.getMonth() + Number(value));
  }

  return result;
};

const isSubscriptionActive = (merchant) => {
  const subscription = merchant?.subscription;

  if (!subscription || subscription.status !== "active") {
    return false;
  }

  if (!subscription.expiresAt) {
    return false;
  }

  return new Date(subscription.expiresAt).getTime() > Date.now();
};

const getSubscriptionFeatures = (merchant) => {
  if (!isSubscriptionActive(merchant)) {
    return {};
  }

  return merchant.subscription?.featuresSnapshot || {};
};

const markExpiredIfNeeded = async (merchant) => {
  if (
    merchant?.subscription?.status === "active" &&
    merchant.subscription.expiresAt &&
    new Date(merchant.subscription.expiresAt).getTime() <= Date.now()
  ) {
    merchant.subscription.status = "expired";
    await merchant.save();
    return true;
  }

  return false;
};

module.exports = {
  addDuration,
  isSubscriptionActive,
  getSubscriptionFeatures,
  markExpiredIfNeeded,
};
