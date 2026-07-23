import useSubscription from "../hooks/useSubscription";

const {
  active,
  hasFeature,
  features,
} = useSubscription();

// Widget create button:
const canCreateMoreWidgets =
  active &&
  hasFeature("canCreateWidgets") &&
  user.widgets.length < Number(features.maxWidgets || 0);

// Audio call button:
{hasFeature("canUseAudioCall") && (
  <button onClick={startCall}>Audio Call</button>
)}

// Video call button:
{hasFeature("canUseVideoCall") && (
  <button onClick={startVideoCall}>Video Call</button>
)}

// Voice message:
{hasFeature("canUseVoiceMessage") && (
  <button onClick={startRecording}>Record Voice</button>
)}

// Upload:
{hasFeature("canUploadFiles") && (
  <button onClick={() => fileInputRef.current?.click()}>
    Upload
  </button>
)}

// Add agents:
{hasFeature("canAddAgents") && (
  <WidgetAccess widget={widget} />
)}
