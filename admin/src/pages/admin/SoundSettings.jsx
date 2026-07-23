import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import {
  Volume2,
  Upload,
  Play,
  Pause,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import useAdminAuthStore from "../../store/adminAuthStore";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:5000";

const SoundSettings = () => {
  const { authConfig } = useAdminAuthStore();

  const [settings, setSettings] = useState({
    newMessageSound: "",
    sendMessageSound: "",
    deleteMessageSound: "",
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState({
    newMessageSound: false,
    sendMessageSound: false,
    deleteMessageSound: false,
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Audio playing state
  const [playingKey, setPlayingKey] = useState(null);
  const audioRef = useRef(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/settings`);
      setSettings({
        newMessageSound: data.newMessageSound || "",
        sendMessageSound: data.sendMessageSound || "",
        deleteMessageSound: data.deleteMessageSound || "",
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to load global sound settings."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handlePlayPreview = (soundUrl, key) => {
    if (!soundUrl) return;

    const fullUrl = soundUrl.startsWith("http")
      ? soundUrl
      : `${API_URL}${soundUrl}`;

    if (playingKey === key) {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      setPlayingKey(null);
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      const audio = new Audio(fullUrl);
      audioRef.current = audio;
      audio.play().catch((err) => {
        console.error("Audio playback error:", err);
      });
      setPlayingKey(key);
      audio.onended = () => {
        setPlayingKey(null);
      };
    }
  };

  const handleFileUpload = async (event, key) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading((prev) => ({ ...prev, [key]: true }));
    setError("");
    setMessage("");

    const formData = new FormData();
    formData.append("sound", file);

    try {
      const response = await axios.post(
        `${API_URL}/api/settings/upload-sound`,
        formData,
        {
          headers: {
            ...authConfig().headers,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setSettings((prev) => ({ ...prev, [key]: response.data.url }));
      setMessage("Sound uploaded successfully! Click save to apply changes.");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to upload sound file. Make sure it is an audio file."
      );
    } finally {
      setUploading((prev) => ({ ...prev, [key]: false }));
      // Clear input
      event.target.value = "";
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await axios.put(
        `${API_URL}/api/settings`,
        settings,
        authConfig()
      );

      setSettings({
        newMessageSound: response.data.newMessageSound || "",
        sendMessageSound: response.data.sendMessageSound || "",
        deleteMessageSound: response.data.deleteMessageSound || "",
      });

      setMessage("Global sound settings updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to update sound settings."
      );
    } finally {
      setSaving(false);
    }
  };

  const soundCategories = [
    {
      key: "newMessageSound",
      label: "New Message Sound",
      description: "Played when a merchant receives a new incoming message from a visitor.",
    },
    {
      key: "sendMessageSound",
      label: "Send Message Sound",
      description: "Played when a merchant successfully sends a reply back to a visitor.",
    },
    {
      key: "deleteMessageSound",
      label: "End Session Sound",
      description: "Played when a chat session is ended or deleted.",
    },
  ];

  return (
    <div className="p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-7">
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <Volume2 className="text-emerald-600" size={32} />
            Sound Settings
          </h1>
          <p className="mt-1 text-slate-500">
            Configure system sound effects for messaging and chat notifications.
          </p>
        </div>

        {message && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <CheckCircle size={18} className="shrink-0 text-emerald-600" />
            {message}
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertCircle size={18} className="shrink-0 text-red-600" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[300px] items-center justify-center">
            <Loader2 className="animate-spin text-emerald-600" size={36} />
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            <div className="rounded-2xl bg-white shadow-sm divide-y divide-slate-100">
              {soundCategories.map(({ key, label, description }) => {
                const isPlaying = playingKey === key;
                const soundUrl = settings[key];

                return (
                  <div key={key} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="max-w-md">
                      <h3 className="text-lg font-bold text-slate-800">{label}</h3>
                      <p className="text-sm text-slate-500 mt-1">{description}</p>
                      {soundUrl && (
                        <div className="mt-2 text-xs font-mono text-slate-400 truncate bg-slate-50 px-2 py-1 rounded max-w-xs">
                          {soundUrl}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Play Preview Button */}
                      <button
                        type="button"
                        disabled={!soundUrl}
                        onClick={() => handlePlayPreview(soundUrl, key)}
                        className={`flex h-11 w-11 items-center justify-center rounded-xl transition ${
                          isPlaying
                            ? "bg-emerald-600 text-white"
                            : soundUrl
                            ? "bg-slate-100 hover:bg-slate-200 text-slate-700"
                            : "bg-slate-50 text-slate-300 cursor-not-allowed"
                        }`}
                        title={isPlaying ? "Pause Preview" : "Play Preview"}
                      >
                        {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                      </button>

                      {/* Upload Button */}
                      <label className="flex h-11 px-4 items-center justify-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm cursor-pointer transition disabled:opacity-60">
                        {uploading[key] ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <Upload size={16} />
                        )}
                        {uploading[key] ? "Uploading..." : "Upload Sound"}
                        <input
                          type="file"
                          accept="audio/*"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, key)}
                          disabled={uploading[key]}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 transition"
              >
                {saving ? (
                  <Loader2 className="animate-spin" size={19} />
                ) : (
                  <Save size={19} />
                )}
                Save Settings
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default SoundSettings;
