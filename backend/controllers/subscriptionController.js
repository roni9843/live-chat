const SubscriptionPackage = require("../models/SubscriptionPackage");
const Merchant = require("../models/Merchant");
const Payment = require("../models/Payment");
const { addDuration, isSubscriptionActive } = require("../utils/subscription");

const normalizeFeatures = (features = {}) => ({
  canCreateWidgets: Boolean(features.canCreateWidgets),
  maxWidgets: Math.max(0, Number(features.maxWidgets || 0)),

  canAddAgents: Boolean(features.canAddAgents),
  maxAgentsPerWidget: Math.max(0, Number(features.maxAgentsPerWidget || 0)),

  canUseAudioCall: Boolean(features.canUseAudioCall),
  canUseVideoCall: Boolean(features.canUseVideoCall),
  canUseVoiceMessage: Boolean(features.canUseVoiceMessage),
  canUploadFiles: Boolean(features.canUploadFiles),

  canUseDirectMessage: Boolean(features.canUseDirectMessage),
  canUseGroupChat: Boolean(features.canUseGroupChat),

  canUseFaq: Boolean(features.canUseFaq),
  canUsePreChatForm: Boolean(features.canUsePreChatForm),
  canUseOfflineForm: Boolean(features.canUseOfflineForm),
  canCustomizeWidget: Boolean(features.canCustomizeWidget),

  chatHistoryDays: Math.max(0, Number(features.chatHistoryDays || 30)),
});

exports.getPublicPackages = async (req, res) => {
  try {
    const packages = await SubscriptionPackage.find({ isActive: true })
      .sort({ sortOrder: 1, price: 1 })
      .lean();

    res.json({ success: true, data: packages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAdminPackages = async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const query = search
      ? { name: { $regex: search, $options: "i" } }
      : {};

    const packages = await SubscriptionPackage.find(query).sort({
      sortOrder: 1,
      createdAt: -1,
    });

    res.json({ success: true, data: packages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.createPackage = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      durationValue,
      durationUnit,
      features,
      isActive,
      sortOrder,
    } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({ message: "Package name is required" });
    }

    if (Number(price) < 0 || Number.isNaN(Number(price))) {
      return res.status(400).json({ message: "Valid price is required" });
    }

    if (!["month", "year"].includes(durationUnit)) {
      return res.status(400).json({ message: "Invalid duration unit" });
    }

    const created = await SubscriptionPackage.create({
      name: name.trim(),
      description: description || "",
      price: Number(price),
      currency: "BDT",
      durationValue: Number(durationValue),
      durationUnit,
      features: normalizeFeatures(features),
      isActive: isActive !== false,
      sortOrder: Number(sortOrder || 0),
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    const status = error.code === 11000 ? 409 : 500;
    res.status(status).json({
      success: false,
      message:
        error.code === 11000
          ? "A package with this name already exists"
          : error.message,
    });
  }
};

exports.updatePackage = async (req, res) => {
  try {
    const packageItem = await SubscriptionPackage.findById(req.params.id);

    if (!packageItem) {
      return res.status(404).json({ message: "Package not found" });
    }

    const allowedFields = [
      "name",
      "description",
      "price",
      "durationValue",
      "durationUnit",
      "isActive",
      "sortOrder",
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        packageItem[field] = req.body[field];
      }
    });

    packageItem.currency = "BDT";

    if (req.body.features !== undefined) {
      packageItem.features = normalizeFeatures(req.body.features);
    }

    await packageItem.save();
    res.json({ success: true, data: packageItem });
  } catch (error) {
    const status = error.code === 11000 ? 409 : 500;
    res.status(status).json({ success: false, message: error.message });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const packageItem = await SubscriptionPackage.findById(req.params.id);

    if (!packageItem) {
      return res.status(404).json({ message: "Package not found" });
    }

    const assignedCount = await Merchant.countDocuments({
      "subscription.package": packageItem._id,
      "subscription.status": "active",
    });

    if (assignedCount > 0) {
      return res.status(400).json({
        message:
          "This package is assigned to active merchants. Disable it instead of deleting it.",
      });
    }

    await packageItem.deleteOne();
    res.json({ success: true, message: "Package deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignPackageToMerchant = async (req, res) => {
  try {
    const { merchantId, packageId, startNow = true } = req.body;

    const [merchant, packageItem] = await Promise.all([
      Merchant.findById(merchantId),
      SubscriptionPackage.findById(packageId),
    ]);

    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    if (!packageItem) {
      return res.status(404).json({ message: "Package not found" });
    }

    const startedAt = startNow
      ? new Date()
      : merchant.subscription?.expiresAt &&
          new Date(merchant.subscription.expiresAt) > new Date()
        ? new Date(merchant.subscription.expiresAt)
        : new Date();

    const expiresAt = addDuration(
      startedAt,
      packageItem.durationValue,
      packageItem.durationUnit
    );

    merchant.subscription = {
      package: packageItem._id,
      packageName: packageItem.name,
      status: "active",
      startedAt,
      expiresAt,
      assignedBy: req.user._id,
      price: packageItem.price,
      currency: "BDT",
      featuresSnapshot: packageItem.features.toObject(),
    };

    merchant.canCreateWidgets =
      Boolean(packageItem.features.canCreateWidgets) &&
      Number(packageItem.features.maxWidgets) > 0;

    await merchant.save();

    res.json({
      success: true,
      message: "Package assigned successfully",
      data: {
        merchantId: merchant._id,
        subscription: merchant.subscription,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.cancelMerchantSubscription = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.params.merchantId);

    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    merchant.subscription.status = "cancelled";
    merchant.canCreateWidgets = false;
    await merchant.save();

    res.json({ success: true, message: "Subscription cancelled" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMySubscription = async (req, res) => {
  try {
    const merchant = await Merchant.findById(req.user._id)
      .select("subscription widgets")
      .populate("subscription.package");

    res.json({
      success: true,
      data: {
        subscription: merchant.subscription,
        isActive: isSubscriptionActive(merchant),
        usage: {
          widgets: merchant.widgets.length,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.checkFeature = async (req, res) => {
  try {
    const feature = String(req.params.feature || "");
    const merchant = await Merchant.findById(req.user._id).select("subscription");

    const active = isSubscriptionActive(merchant);
    const allowed =
      active && Boolean(merchant.subscription?.featuresSnapshot?.[feature]);

    res.json({
      success: true,
      active,
      feature,
      allowed,
      expiresAt: merchant.subscription?.expiresAt || null,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.initializePayment = async (req, res) => {
  try {
    const { packageId, success_redirect_url, callback_url } = req.body;
    
    if (!packageId) {
      return res.status(400).json({ message: "Package ID is required" });
    }

    const packageItem = await SubscriptionPackage.findById(packageId);
    if (!packageItem) {
      return res.status(404).json({ message: "Subscription package not found" });
    }

    const merchant = await Merchant.findById(req.user._id);
    if (!merchant) {
      return res.status(404).json({ message: "Merchant not found" });
    }

    // Auto-activate if the package is free (0 price)
    if (packageItem.price === 0) {
      const startedAt = new Date();
      const expiresAt = addDuration(startedAt, packageItem.durationValue, packageItem.durationUnit);

      merchant.subscription = {
        package: packageItem._id,
        packageName: packageItem.name,
        status: "active",
        startedAt,
        expiresAt,
        price: 0,
        currency: "BDT",
        featuresSnapshot: packageItem.features.toObject(),
      };

      merchant.canCreateWidgets = Boolean(packageItem.features.canCreateWidgets);
      await merchant.save();

      // Create completed transaction log
      const invoiceNumber = `FREE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await Payment.create({
        merchant: merchant._id,
        invoiceNumber,
        packageName: packageItem.name,
        packageId: packageItem._id,
        amount: 0,
        status: "COMPLETED",
        transactionId: "FREE_PLAN",
        bank: "SYSTEM",
        durationValue: packageItem.durationValue,
        durationUnit: packageItem.durationUnit
      });

      return res.json({
        success: true,
        isFree: true,
        message: "Free subscription activated successfully!"
      });
    }

    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const finalCallbackUrl = callback_url || `${req.protocol}://${req.get("host")}/api/subscriptions/webhook`;
    const finalSuccessUrl = success_redirect_url || `${req.protocol}://${req.get("host")}/packages?status=success`;

    const response = await fetch("https://api.oraclepay.org/api/opay-business/generate-payment-page", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Opay-Business-Token": "4e6e3b608649c71c262472c51050e55113c58973b9b110b1"
      },
      body: JSON.stringify({
        payment_amount: packageItem.price,
        user_identity_address: merchant.email,
        callback_url: finalCallbackUrl,
        success_redirect_url: finalSuccessUrl,
        invoice_number: invoiceNumber,
        checkout_items: {
          type: "Subscription Purchase",
          initiator: "Ochat System"
        }
      })
    });

    const data = await response.json();

    if (!data.success) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate OraclePay payment page"
      });
    }

    // Save pending payment record in DB
    await Payment.create({
      merchant: merchant._id,
      invoiceNumber,
      packageName: packageItem.name,
      packageId: packageItem._id,
      amount: packageItem.price,
      status: "PENDING",
      durationValue: packageItem.durationValue,
      durationUnit: packageItem.durationUnit
    });

    res.json({
      success: true,
      isFree: false,
      payment_page_url: data.payment_page_url,
      invoice_number: invoiceNumber
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.handleOraclePayWebhook = async (req, res) => {
  try {
    const { status, invoice_number, transaction_id, session_code, bank } = req.body;

    console.log("OraclePay Webhook received:", req.body);

    const payment = await Payment.findOne({ invoiceNumber: invoice_number });
    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment invoice not found" });
    }

    if (payment.status === "COMPLETED") {
      return res.json({ success: true, message: "Payment already processed previously" });
    }

    if (status === "COMPLETED") {
      payment.status = "COMPLETED";
      payment.transactionId = transaction_id || "";
      payment.sessionCode = session_code || "";
      payment.bank = bank || "";
      await payment.save();

      // Find Merchant and update subscription details
      const merchant = await Merchant.findById(payment.merchant);
      if (merchant) {
        const packageItem = await SubscriptionPackage.findById(payment.packageId);
        if (packageItem) {
          const startedAt = new Date();
          const expiresAt = addDuration(startedAt, payment.durationValue, payment.durationUnit);

          merchant.subscription = {
            package: packageItem._id,
            packageName: packageItem.name,
            status: "active",
            startedAt,
            expiresAt,
            price: payment.amount,
            currency: "BDT",
            featuresSnapshot: packageItem.features.toObject(),
          };

          merchant.canCreateWidgets = Boolean(packageItem.features.canCreateWidgets);
          await merchant.save();
          console.log(`Successfully activated subscription for merchant: ${merchant.name}`);
        }
      }
    } else {
      payment.status = "FAILED";
      await payment.save();
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Webhook processing failed:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getPaymentHistory = async (req, res) => {
  try {
    const history = await Payment.find({ merchant: req.user._id })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAdminPaymentHistory = async (req, res) => {
  try {
    const history = await Payment.find({})
      .populate("merchant", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
