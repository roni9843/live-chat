import { useMemo } from "react";
import useAuthStore from "../store/authStore";

const useSubscription = () => {
  const user = useAuthStore((state) => state.user);

  return useMemo(() => {
    const subscription = user?.subscription || {};
    const expiresAt = subscription.expiresAt
      ? new Date(subscription.expiresAt)
      : null;

    const active =
      subscription.status === "active" &&
      expiresAt &&
      expiresAt.getTime() > Date.now();

    const features = active
      ? subscription.featuresSnapshot || {}
      : {};

    const hasFeature = (featureName) =>
      Boolean(active && features[featureName]);

    return {
      subscription,
      active,
      features,
      hasFeature,
      expiresAt,
    };
  }, [user]);
};

export default useSubscription;
