import React from "react";
import {
  CalendarDays,
  Check,
  Crown,
  X,
} from "lucide-react";
import useSubscription from "../hooks/useSubscription";

const features = [
  ["canCreateWidgets", "Create chat widgets"],
  ["canAddAgents", "Add agents"],
  ["canUseAudioCall", "Audio call"],
  ["canUseVideoCall", "Video call"],
  ["canUseVoiceMessage", "Voice message"],
  ["canUploadFiles", "File upload"],
  ["canUseDirectMessage", "Direct message"],
  ["canUseGroupChat", "Group chat"],
  ["canUseFaq", "FAQ"],
  ["canUsePreChatForm", "Pre-chat form"],
  ["canUseOfflineForm", "Offline form"],
  ["canCustomizeWidget", "Widget customization"],
];

const MySubscription = () => {
  const {
    subscription,
    active,
    features: packageFeatures,
    expiresAt,
  } = useSubscription();

  return (
    <div className="flex-1 overflow-y-auto bg-[#f0f2f5] p-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7">
          <h1 className="text-3xl font-bold text-slate-900">
            My Subscription
          </h1>
          <p className="mt-1 text-slate-500">
            View your active package, limits, and expiry.
          </p>
        </div>

        <div className="rounded-2xl bg-white p-7 shadow-sm">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
            <div className="flex gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <Crown size={28} />
              </div>

              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold text-slate-900">
                    {subscription.packageName || "No package"}
                  </h2>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>

                <div className="mt-2 text-slate-500">
                  ৳
                  {Number(
                    subscription.price || 0
                  ).toLocaleString()}{" "}
                  {subscription.currency || "BDT"}
                </div>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                <CalendarDays size={17} />
                Expiry date
              </div>
              <div className="mt-1 font-bold text-slate-900">
                {expiresAt
                  ? expiresAt.toLocaleString()
                  : "Not available"}
              </div>
            </div>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(([key, label]) => {
              const enabled = Boolean(packageFeatures[key]);

              return (
                <div
                  key={key}
                  className={`flex items-center gap-3 rounded-xl border p-4 ${
                    enabled
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  {enabled ? (
                    <Check
                      className="text-emerald-600"
                      size={19}
                    />
                  ) : (
                    <X
                      className="text-slate-400"
                      size={19}
                    />
                  )}

                  <span
                    className={`text-sm font-semibold ${
                      enabled
                        ? "text-slate-800"
                        : "text-slate-400"
                    }`}
                  >
                    {label}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-slate-900 p-5 text-white">
              <div className="text-sm text-slate-400">
                Maximum widgets
              </div>
              <div className="mt-1 text-3xl font-black">
                {packageFeatures.maxWidgets || 0}
              </div>
            </div>

            <div className="rounded-xl bg-slate-900 p-5 text-white">
              <div className="text-sm text-slate-400">
                Agents per widget
              </div>
              <div className="mt-1 text-3xl font-black">
                {packageFeatures.maxAgentsPerWidget || 0}
              </div>
            </div>

            <div className="rounded-xl bg-slate-900 p-5 text-white">
              <div className="text-sm text-slate-400">
                Chat history
              </div>
              <div className="mt-1 text-3xl font-black">
                {packageFeatures.chatHistoryDays || 0}
                <span className="ml-1 text-base font-semibold">
                  days
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MySubscription;
