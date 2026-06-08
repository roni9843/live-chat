import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, MoreVertical, Search, Paperclip, Send, Smile, X, Edit2, Trash2, CornerUpLeft, ChevronLeft, Mic, MicOff, Play, Pause, Phone, PhoneOff, UserCheck } from 'lucide-react';
import io from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';
import useAuthStore from '../store/authStore';
import useChatStore from '../store/chatStore';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://jh5nng6t-5000.asse.devtunnels.ms';

// WhatsApp-style checkmarks SVG
const SingleCheck = () => (
  <svg viewBox="0 0 16 11" width="16" height="11" className="inline-block ml-0.5">
    <path d="M11.071.653a.75.75 0 0 0-1.06-.022L5.441 5.239 4.003 3.801a.75.75 0 0 0-1.06 1.06l2 2a.75.75 0 0 0 1.083-.022l5-5a.75.75 0 0 0-.955-1.186z" fill="currentColor" />
  </svg>
);

const DoubleCheck = ({ isRead }) => (
  <svg viewBox="0 0 16 11" width="16" height="11" className={`inline-block ml-0.5 ${isRead ? 'text-[#53bdeb]' : 'text-[#8696a0]'}`}>
    <path d="M15.01.653a.75.75 0 0 0-1.06-.022L7.383 6.802 5.643 5.11a.75.75 0 0 0-1.04 1.08l2.25 2.17a.75.75 0 0 0 1.056-.017l7-6.65a.75.75 0 0 0-.899-1.04zM6.07.653a.75.75 0 0 0-1.06-.022L.44 5.239l-.94-.939a.75.75 0 1 0-1.06 1.06l1.5 1.5a.75.75 0 0 0 1.082-.022l5-5a.75.75 0 0 0-.952-1.185z" fill="currentColor" />
  </svg>
);

const AudioPlayer = ({ url }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef(null);

  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(err => console.error(err));
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);

    if (audio.readyState >= 1 && audio.duration) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [url]);

  const handleSpeedToggle = () => {
    let nextRate = 1;
    if (playbackRate === 1) nextRate = 1.5;
    else if (playbackRate === 1.5) nextRate = 2;
    else nextRate = 1;

    setPlaybackRate(nextRate);
    audioRef.current.playbackRate = nextRate;
  };

  const formatAudioTime = (time) => {
    if (isNaN(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const waveform = React.useMemo(() => {
    const hash = url.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const count = 28;
    const heights = [];
    for (let i = 0; i < count; i++) {
      const envelope = Math.sin(Math.PI * (i + 0.5) / count);
      const randomFactor = 0.3 + 0.7 * Math.abs(Math.sin(hash * (i + 1) * 456.789));
      const h = 4 + Math.floor(envelope * randomFactor * 22);
      heights.push(h);
    }
    return heights;
  }, [url]);

  const progress = duration ? currentTime / duration : 0;

  const handleBarClick = (index) => {
    const seekPercent = index / waveform.length;
    if (audioRef.current && duration) {
      const newTime = seekPercent * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  return (
    <div className="flex items-center space-x-3 py-1.5 px-3 rounded-xl bg-black/20 min-w-[210px] max-w-[290px] text-white">
      <audio ref={audioRef} src={url} preload="metadata" />

      <button
        onClick={togglePlay}
        className="w-8.5 h-8.5 rounded-full flex items-center justify-center bg-[#00a884] text-white hover:scale-105 active:scale-95 transition-all flex-shrink-0"
      >
        {isPlaying ? <Pause size={15} fill="white" /> : <Play size={15} className="ml-0.5" fill="white" />}
      </button>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Waveform visualizer track */}
        <div className="flex items-center space-x-0.75 h-8 cursor-pointer select-none px-1">
          {waveform.map((height, idx) => {
            const isActive = (idx / waveform.length) <= progress;
            return (
              <div
                key={idx}
                onClick={() => handleBarClick(idx)}
                className="w-0.75 rounded-full transition-colors duration-150"
                style={{
                  height: `${height}px`,
                  backgroundColor: isActive ? '#00a884' : '#8696a0',
                  minHeight: '4px'
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between items-center mt-0.5 text-[9px] text-[#8696a0] px-1">
          <span>{formatAudioTime(currentTime)} / {formatAudioTime(duration || 0)}</span>

          <button
            onClick={handleSpeedToggle}
            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 font-bold text-[8px] text-[#e9edef] select-none transition-colors"
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};

function Chat({ isChatVisible }) {
  const { user } = useAuthStore();
  const { totalUnread, setTotalUnread, activeSessionId, setActiveSessionId } = useChatStore();
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  const isCurrentUserOnline = () => {
    if (!user) return false;
    if (user.status === 'offline') return false;

    if (user.schedule && user.schedule.enabled) {
      const now = new Date();
      const currentHour = now.getHours().toString().padStart(2, '0');
      const currentMinute = now.getMinutes().toString().padStart(2, '0');
      const currentTimeString = `${currentHour}:${currentMinute}`;
      
      const { start, end } = user.schedule;
      if (start && end) {
        if (start <= end) {
          if (currentTimeString < start || currentTimeString > end) {
            return false;
          }
        } else {
          // Overnight schedule (e.g. 22:00 to 06:00)
          if (currentTimeString < start && currentTimeString > end) {
            return false;
          }
        }
      }
    }
    return true;
  };

  const [sessions, setSessions] = useState([]);
  const sessionsRef = useRef([]);
  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);
  const [messages, setMessages] = useState({});
  const [typingStatus, setTypingStatus] = useState({});
  const [inputMessage, setInputMessage] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
  const [hoveredMessage, setHoveredMessage] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedProfileInfo, setSelectedProfileInfo] = useState(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const activeSessionIdRef = useRef(null);
  const isChatVisibleRef = useRef(isChatVisible);
  const hoverTimeoutRef = useRef(null);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [audioLevels, setAudioLevels] = useState([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
  const recordingTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // WebRTC Audio Calling States & Refs
  const [callState, setCallState] = useState('idle'); // 'idle', 'dialing', 'incoming', 'active'
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [activeVisitorName, setActiveVisitorName] = useState('');

  const callStateRef = useRef('idle');
  const updateCallState = (state) => {
    setCallState(state);
    callStateRef.current = state;
  };

  const sessionIdRef = useRef(null);
  useEffect(() => {
    sessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const ringtoneContextRef = useRef(null);
  const ringtoneTimerRef = useRef(null);
  const callTimerRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const pendingAnswerRef = useRef(null);
  const pendingCandidatesRef = useRef([]);
  const remoteDescriptionSetRef = useRef(false);


  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      cleanupVisuals();
      cleanupCall();
    };
  }, []);

  const cleanupVisuals = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevels([4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
  };

  const formatRecordingTime = (time) => {
    const mins = Math.floor(time / 60);
    const secs = time % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const playRingtone = (type) => {
    try {
      stopRingtone();
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      ringtoneContextRef.current = ctx;

      if (type === 'dialing') {
        const playTone = () => {
          if (!ringtoneContextRef.current || ringtoneContextRef.current.state === 'closed') return;
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();
          osc1.frequency.setValueAtTime(440, ctx.currentTime);
          osc2.frequency.setValueAtTime(480, ctx.currentTime);
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.0);
          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(ctx.destination);
          osc1.start();
          osc2.start();
          osc1.stop(ctx.currentTime + 2.0);
          osc2.stop(ctx.currentTime + 2.0);
        };
        playTone();
        ringtoneTimerRef.current = setInterval(playTone, 5000);
      } else if (type === 'ringing') {
        const playTone = () => {
          if (!ringtoneContextRef.current || ringtoneContextRef.current.state === 'closed') return;
          const now = ctx.currentTime;
          const ring = (delay) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, now + delay);
            let modTime = now + delay;
            for (let i = 0; i < 8; i++) {
              osc.frequency.setValueAtTime(i % 2 === 0 ? 600 : 680, modTime);
              modTime += 0.1;
            }
            gain.gain.setValueAtTime(0.0, now + delay);
            gain.gain.linearRampToValueAtTime(0.15, now + delay + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.8);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(now + delay);
            osc.stop(now + delay + 0.8);
          };
          ring(0.0);
          ring(1.0);
        };
        playTone();
        ringtoneTimerRef.current = setInterval(playTone, 4000);
      }
    } catch (err) {
      console.error('Failed to play ringtone:', err);
    }
  };

  const stopRingtone = () => {
    if (ringtoneTimerRef.current) {
      clearInterval(ringtoneTimerRef.current);
      ringtoneTimerRef.current = null;
    }
    if (ringtoneContextRef.current) {
      try {
        if (ringtoneContextRef.current.state !== 'closed') {
          ringtoneContextRef.current.close();
        }
      } catch (e) {
        console.error(e);
      }
      ringtoneContextRef.current = null;
    }
  };

  const cleanupCall = () => {
    stopRingtone();
    updateCallState('idle');
    setCallDuration(0);
    setIsCallMuted(false);

    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }

    pendingOfferRef.current = null;
    pendingAnswerRef.current = null;
    pendingCandidatesRef.current = [];
    remoteDescriptionSetRef.current = false;
  };


  const startCall = () => {
    if (!socketRef.current || !sessionIdRef.current) return;
    updateCallState('dialing');
    setActiveVisitorName(activeSession?.visitorName || 'Guest');
    playRingtone('dialing');

    socketRef.current.emit('call_request', {
      sessionId: sessionIdRef.current,
      callerName: myWidgetProfile?.name || user?.name || 'Support Agent',
      callerType: 'merchant'
    });

    if (callTimerRef.current) clearInterval(callTimerRef.current);
    let secondsElapsed = 0;
    callTimerRef.current = setInterval(() => {
      secondsElapsed++;
      if (secondsElapsed >= 35) {
        hangupCall();
      }
    }, 1000);
  };

  const acceptCall = () => {
    if (!socketRef.current || !sessionIdRef.current) return;
    stopRingtone();
    updateCallState('active');
    setCallDuration(0);

    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);

    socketRef.current.emit('call_accept', { sessionId: sessionIdRef.current });
    setupWebRTC(false);
  };

  const rejectCall = () => {
    if (!socketRef.current || !sessionIdRef.current) return;
    stopRingtone();
    socketRef.current.emit('call_reject', { sessionId: sessionIdRef.current, reason: 'declined' });
    cleanupCall();
  };

  const hangupCall = () => {
    if (socketRef.current && sessionIdRef.current) {
      socketRef.current.emit('call_hangup', { sessionId: sessionIdRef.current });
    }
    cleanupCall();
  };


  const toggleCallMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsCallMuted(!audioTrack.enabled);
      }
    }
  };

  const setupWebRTC = async (isCaller) => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('secure_context_required');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      peerConnectionRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.onicecandidate = (e) => {
        if (e.candidate && socketRef.current && sessionIdRef.current) {
          socketRef.current.emit('webrtc_ice', { sessionId: sessionIdRef.current, candidate: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        const remoteStream = e.streams[0];
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = remoteStream;
          remoteAudioRef.current.play().catch(err => console.error('Error playing remote audio:', err));
        }
      };

      // Apply pending offer if received before setupWebRTC completed
      if (!isCaller && pendingOfferRef.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingOfferRef.current));
        remoteDescriptionSetRef.current = true;
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current.emit('webrtc_answer', { sessionId: sessionIdRef.current, answer });
        pendingOfferRef.current = null;

        // Apply any buffered ICE candidates
        for (const candidate of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding buffered candidate:", e));
        }
        pendingCandidatesRef.current = [];
      }

      // Apply pending answer if received before setupWebRTC completed
      if (isCaller && pendingAnswerRef.current) {
        await pc.setRemoteDescription(new RTCSessionDescription(pendingAnswerRef.current));
        remoteDescriptionSetRef.current = true;
        pendingAnswerRef.current = null;

        // Apply any buffered ICE candidates
        for (const candidate of pendingCandidatesRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding buffered candidate:", e));
        }
        pendingCandidatesRef.current = [];
      }

      if (isCaller && !remoteDescriptionSetRef.current) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socketRef.current.emit('webrtc_offer', { sessionId: sessionIdRef.current, offer });
      }


    } catch (err) {
      console.error('Error setting up WebRTC call:', err);
      if (err.message === 'secure_context_required' || window.location.protocol === 'file:') {
        alert('Microphone access blocked: WebRTC requires a Secure Context (localhost or HTTPS). Please run your page on a local web server (e.g. npx serve) instead of opening the HTML directly from file://.');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Microphone permission blocked. Please check your browser address bar: click the settings/lock icon next to the URL, change Microphone permission to "Allow", and reload the page. Also, verify that microphone access is enabled in your computer\'s system settings (Settings > Privacy > Microphone).');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        alert('No microphone detected. Please check if your microphone is properly plugged in and recognized by your computer.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        alert('Your microphone is currently being used by another application (like Discord, Zoom, or another browser tab). Please close those apps and try again.');
      } else {
        alert('Could not access microphone: ' + (err.message || err.name || 'Unknown error.'));
      }
      cleanupCall();
    }
  };


  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContextClass();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVisuals = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const levels = [];
          const barCount = 16;
          const step = Math.floor(dataArray.length / barCount) || 1;
          for (let i = 0; i < barCount; i++) {
            const val = dataArray[i * step] || 0;
            const h = 4 + Math.floor((val / 255) * 24);
            levels.push(h);
          }
          setAudioLevels(levels);
          animationFrameRef.current = requestAnimationFrame(updateVisuals);
        }
      };

      updateVisuals();

      recorder.onstop = async () => {
        cleanupVisuals();
        stream.getTracks().forEach(track => track.stop());
        if (chunks.length === 0) return;

        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        if (audioBlob.size < 1000) return;

        const audioFile = new File([audioBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('file', audioFile);

        try {
          const res = await fetch(`${SOCKET_URL}/api/upload`, {
            method: 'POST',
            body: formData
          });
          const data = await res.json();

          if (data.success && socket && activeSessionIdRef.current) {
            socket.emit('send_message', {
              sessionId: activeSessionIdRef.current,
              sender: 'merchant',
              content: '',
              fileUrl: data.fileUrl,
              fileType: 'audio',
              merchantId: user._id,
              senderId: user._id,
              senderName: myWidgetProfile.name,
              senderProfilePic: myWidgetProfile.profilePic || '',
              replyTo: replyingTo ? {
                messageId: replyingTo._id,
                content: replyingTo.content,
                sender: replyingTo.sender,
                senderName: replyingTo.sender === 'visitor' ? activeSession.visitorName : (replyingTo.senderName || '')
              } : undefined
            });
            playSendSound();
            setReplyingTo(null);
          }
        } catch (err) {
          console.error('Failed to upload audio message:', err);
        }
      };

      setAudioChunks(chunks);
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      recorder.start();

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Microphone access denied or error starting recording:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopAndSendRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
  };

  const cancelRecording = () => {
    cleanupVisuals();
    if (mediaRecorder) {
      mediaRecorder.onstop = () => { };
      if (mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
      if (mediaRecorder.stream) {
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
      }
    }
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [inputMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  useEffect(() => {
    isChatVisibleRef.current = isChatVisible;
  }, [isChatVisible]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    const unread = sessions.reduce((sum, s) => sum + (s.unreadCount || 0), 0);
    setTotalUnread(unread);
  }, [sessions, setTotalUnread]);


  useEffect(() => {
    if (!user) return;

    const newSocket = io(SOCKET_URL);
    newSocket.on('new_invite', (inviteData) => {
      window.dispatchEvent(new CustomEvent('new_invite_received', { detail: inviteData }));
      if (Notification.permission === 'granted') {
        new Notification('New Widget Access Invite', {
          body: `${inviteData.ownerName} invited you to manage chat for ${inviteData.domain}`,
        });
      }
    });

    newSocket.on('invite_responded', (data) => {
      window.dispatchEvent(new CustomEvent('invite_responded_received', { detail: data }));
    });

    setSocket(newSocket);
    socketRef.current = newSocket;
    newSocket.emit('merchant_join', user._id);


    newSocket.on('all_sessions', (allSessions) => {
      setSessions(allSessions);
    });

    newSocket.on('new_session', (session) => {
      setSessions(prev => {
        if (!prev.find(s => s._id === session._id)) {
          return [session, ...prev];
        }
        return prev;
      });
    });

    newSocket.on('session_updated', (updatedSession) => {
      setSessions(prev => {
        const existing = prev.find(s => s._id === updatedSession._id);
        if (existing && existing.status !== 'closed' && updatedSession.status === 'closed') {
          playEndSessionSound();
        }
        const filtered = prev.filter(s => s._id !== updatedSession._id);
        return [updatedSession, ...filtered];
      });
    });

    newSocket.on('receive_message', (msg) => {
      if (msg.sender === 'visitor') {
        const foundSession = sessionsRef.current.find(s => s._id === msg.sessionId);
        const isUnassigned = !foundSession || !foundSession.assignedAgent;
        const isAssignedToMe = foundSession && foundSession.assignedAgent && foundSession.assignedAgent.toString() === user._id.toString();

        if (isUnassigned || isAssignedToMe) {
          if (activeSessionIdRef.current !== msg.sessionId || !isChatVisibleRef.current) {
            if (isCurrentUserOnline()) {
              const audio = new Audio(`${SOCKET_URL}/sound-effect/mixkit-hard-pop-click-2364.wav`);
              audio.play().catch(e => console.log('Audio error:', e));
            }
          }
        }
      }
      setMessages(prev => {
        const sessionMsgs = prev[msg.sessionId] || [];
        if (sessionMsgs.find(m => m._id === msg._id)) return prev;
        return { ...prev, [msg.sessionId]: [...sessionMsgs, msg] };
      });
    });

    newSocket.on('chat_history_merchant', ({ sessionId, messages }) => {
      setMessages(prev => ({ ...prev, [sessionId]: messages }));
    });

    newSocket.on('message_updated', (updatedMsg) => {
      setMessages(prev => {
        const sessionMsgs = prev[updatedMsg.sessionId] || [];
        return {
          ...prev,
          [updatedMsg.sessionId]: sessionMsgs.map(m => m._id === updatedMsg._id ? updatedMsg : m)
        };
      });
    });

    newSocket.on('messages_status_updated', ({ sessionId: sId, status }) => {
      setMessages(prev => {
        const sessionMsgs = prev[sId] || [];
        return {
          ...prev,
          [sId]: sessionMsgs.map(m => m.sender === 'merchant' && m.status !== 'read' ? { ...m, status } : m)
        };
      });
    });

    newSocket.on('typing_start', ({ sessionId, sender }) => {
      if (sender === 'visitor') {
        setTypingStatus(prev => ({ ...prev, [sessionId]: true }));
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 10);
      }
    });

    newSocket.on('typing_end', ({ sessionId, sender }) => {
      if (sender === 'visitor') {
        setTypingStatus(prev => ({ ...prev, [sessionId]: false }));
      }
    });

    // WebRTC Call Listeners
    newSocket.on('incoming_call', ({ sessionId: cId, callerName, callerType, visitorName }) => {
      if (callStateRef.current !== 'idle') {
        newSocket.emit('call_reject', { sessionId: cId, reason: 'busy' });
        return;
      }

      const foundSession = sessionsRef.current.find(s => s._id === cId);
      const isUnassigned = !foundSession || !foundSession.assignedAgent;
      const isAssignedToMe = foundSession && foundSession.assignedAgent && foundSession.assignedAgent.toString() === user._id.toString();

      if (!isUnassigned && !isAssignedToMe) {
        return; // ignore call events for chats claimed by other agents
      }

      if (cId === activeSessionIdRef.current && isChatVisibleRef.current) {
        updateCallState('incoming');
        setActiveVisitorName(visitorName || callerName || 'Guest');
        if (isCurrentUserOnline()) {
          playRingtone('ringing');
        }
      } else {
        if (isCurrentUserOnline()) {
          window.dispatchEvent(new CustomEvent('global_incoming_call', {
            detail: {
              sessionId: cId,
              callerName,
              callerType,
              visitorName: visitorName || callerName || 'Guest'
            }
          }));
        }
      }
    });

    newSocket.on('call_accepted', () => {
      stopRingtone();
      updateCallState('active');
      setCallDuration(0);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
      setupWebRTC(true);
    });

    newSocket.on('call_rejected', ({ sessionId: cId, reason }) => {
      window.dispatchEvent(new CustomEvent('global_call_dismiss', { detail: { sessionId: cId } }));
      if (cId !== activeSessionIdRef.current) return;
      cleanupCall();
      if (reason === 'busy') {
        alert('Line busy. The visitor is currently in another call.');
      } else {
        alert('Call declined by visitor.');
      }
    });

    newSocket.on('webrtc_offer_received', async ({ sessionId: cId, offer }) => {
      if (cId !== activeSessionIdRef.current) return;
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
          remoteDescriptionSetRef.current = true;
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          newSocket.emit('webrtc_answer', { sessionId: sessionIdRef.current, answer });

          // Apply any buffered ICE candidates
          for (const candidate of pendingCandidatesRef.current) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding buffered candidate:", e));
          }
          pendingCandidatesRef.current = [];
        } else {
          pendingOfferRef.current = offer;
        }
      } catch (err) {
        console.error('Error handling WebRTC offer:', err);
      }
    });

    newSocket.on('webrtc_answer_received', async ({ sessionId: cId, answer }) => {
      if (cId !== activeSessionIdRef.current) return;
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          remoteDescriptionSetRef.current = true;

          // Apply any buffered ICE candidates
          for (const candidate of pendingCandidatesRef.current) {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding buffered candidate:", e));
          }
          pendingCandidatesRef.current = [];
        } else {
          pendingAnswerRef.current = answer;
        }
      } catch (err) {
        console.error('Error handling WebRTC answer:', err);
      }
    });

    newSocket.on('webrtc_ice_received', async ({ sessionId: cId, candidate }) => {
      if (cId !== activeSessionIdRef.current) return;
      try {
        if (peerConnectionRef.current && remoteDescriptionSetRef.current) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          pendingCandidatesRef.current.push(candidate);
        }
      } catch (err) {
        console.error('Error adding remote ICE candidate:', err);
      }
    });

    newSocket.on('call_hungup', ({ sessionId: cId }) => {
      window.dispatchEvent(new CustomEvent('global_call_dismiss', { detail: { sessionId: cId } }));
      if (cId !== activeSessionIdRef.current) return;
      cleanupCall();
    });


    return () => newSocket.close();
  }, [user]);

  useEffect(() => {
    const handleGlobalAccept = (e) => {
      const { sessionId: cId } = e.detail || {};
      setTimeout(() => {
        if (cId === activeSessionIdRef.current) {
          acceptCall();
        } else {
          console.log("Global accept session ID mismatch, forcing accept for:", cId);
          sessionIdRef.current = cId;
          acceptCall();
        }
      }, 100);
    };

    const handleGlobalDecline = (e) => {
      const { sessionId: cId } = e.detail || {};
      if (socket) {
        socket.emit('call_reject', { sessionId: cId, reason: 'declined' });
      }
      cleanupCall();
    };

    window.addEventListener('global_call_accepted', handleGlobalAccept);
    window.addEventListener('global_decline_call', handleGlobalDecline);

    return () => {
      window.removeEventListener('global_call_accepted', handleGlobalAccept);
      window.removeEventListener('global_decline_call', handleGlobalDecline);
    };
  }, [socket, activeSessionId]);


  const activeSession = sessions.find(s => s._id === activeSessionId);
  const activeWidget = activeSession
    ? (user?.widgets?.find(w => w._id === activeSession.widgetId) ||
      user?.sharedWidgets?.find(w => w._id === activeSession.widgetId))
    : null;

  const isOwner = activeWidget && user && (activeWidget.ownerId?.toString() === user._id?.toString() || user.widgets?.some(w => w._id === activeWidget._id));

  let myWidgetProfile = {
    name: user?.name,
    profilePic: user?.profilePic || '',
    designation: 'Support'
  };

  if (activeWidget) {
    if (isOwner) {
      myWidgetProfile = {
        name: activeWidget.ownerNickname || user.name,
        profilePic: activeWidget.ownerProfilePic || user.profilePic || '',
        designation: activeWidget.ownerDesignation || 'Owner'
      };
    } else {
      const myMember = activeWidget.authorizedUsers?.find(au => {
        const auId = au.user?._id || au.user;
        return auId && auId.toString() === user._id.toString();
      });
      if (myMember) {
        myWidgetProfile = {
          name: myMember.nickname || user.name,
          profilePic: myMember.profilePic || user.profilePic || '',
          designation: myMember.designation || 'Agent'
        };
      }
    }
  }

  const getAgentDetails = (senderId, senderName) => {
    if (!activeWidget) return { name: senderName, designation: 'Support Agent', profilePic: '', email: '', role: 'Agent' };

    const isOwnerMatch = (activeWidget.ownerId && activeWidget.ownerId.toString() === senderId?.toString()) ||
      (activeWidget.ownerNickname && activeWidget.ownerNickname === senderName) ||
      (!activeWidget.ownerNickname && user.name === senderName && isOwner);
    if (isOwnerMatch) {
      return {
        name: activeWidget.ownerNickname || user.name,
        designation: activeWidget.ownerDesignation || 'Owner',
        profilePic: activeWidget.ownerProfilePic || user.profilePic || '',
        email: user.email,
        role: 'Owner'
      };
    }

    const matchedMember = activeWidget.authorizedUsers?.find(au => {
      const auId = au.user?._id || au.user;
      return (auId && auId.toString() === senderId?.toString()) || (au.nickname && au.nickname === senderName);
    });

    if (matchedMember) {
      return {
        name: matchedMember.nickname || matchedMember.user?.name || senderName,
        designation: matchedMember.designation || 'Support Agent',
        profilePic: matchedMember.profilePic || matchedMember.user?.profilePic || '',
        email: matchedMember.user?.email || '',
        role: matchedMember.role === 'admin' ? 'Admin' : 'Agent'
      };
    }

    return { name: senderName, designation: 'Support Agent', profilePic: '', role: 'Agent' };
  };

  useEffect(() => {
    setSelectedProfileInfo(null);
    if (activeSessionId && socket) {
      if (!messages[activeSessionId]) {
        socket.emit('get_chat_history', activeSessionId);
      }

      if (activeSession && activeSession.unreadCount > 0) {
        socket.emit('mark_as_read', { sessionId: activeSessionId, merchantId: user._id });
      }

      socket.emit('agent_viewing_session', {
        sessionId: activeSessionId,
        agentId: user._id,
        name: myWidgetProfile.name,
        profilePic: myWidgetProfile.profilePic || ''
      });
    }

    return () => {
      if (socket) {
        socket.emit('agent_viewing_session', { sessionId: null });
      }
    };
  }, [activeSessionId, socket, activeSession, user._id, messages, myWidgetProfile.name, myWidgetProfile.profilePic]);

  const formatCallTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  const renderCallOverlay = () => {
    return (
      <div 
        className="flex-1 flex flex-col items-center justify-between p-8 text-white select-none animate-fade-in"
        style={{ backgroundColor: '#111b21' }}
      >
        <audio ref={remoteAudioRef} className="hidden" autoPlay />
        
        {/* Top area: Info & Avatar */}
        <div className="flex flex-col items-center mt-12 space-y-4 w-full">
          <div className="relative">
            {(callState === 'dialing' || callState === 'incoming') && (
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '2s' }} />
            )}
            {callState === 'active' && (
              <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-pulse" />
            )}
            
            <div 
              className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-xl relative z-10 bg-[#00a884]"
            >
              {activeVisitorName.charAt(0).toUpperCase()}
            </div>
          </div>
          
          <h2 className="text-lg font-bold tracking-wide mt-2">{activeVisitorName}</h2>
          
          {callState === 'dialing' && (
            <p className="text-xs text-emerald-400 font-semibold animate-pulse tracking-widest uppercase">Calling...</p>
          )}
          {callState === 'incoming' && (
            <p className="text-xs text-emerald-400 font-semibold animate-pulse tracking-widest uppercase">Incoming call...</p>
          )}
          {callState === 'active' && (
            <div className="flex flex-col items-center space-y-1">
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-bold font-mono tracking-widest">
                {formatCallTime(callDuration)}
              </span>
              <p className="text-[10px] text-gray-400 uppercase tracking-widest">Call in progress</p>
            </div>
          )}
        </div>

        {/* Bottom area: Controls */}
        <div className="flex items-center justify-center w-full mb-12 space-x-6">
          {callState === 'incoming' ? (
            <>
              {/* Decline Button */}
              <button
                onClick={rejectCall}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-lg transform transition active:scale-95 cursor-pointer animate-in fade-in"
                title="Decline Call"
              >
                <PhoneOff size={24} />
              </button>
              
              {/* Accept Button */}
              <button
                onClick={acceptCall}
                className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white shadow-lg transform transition active:scale-95 cursor-pointer animate-in fade-in"
                title="Accept Call"
              >
                <Phone size={24} className="fill-white animate-bounce" />
              </button>
            </>
          ) : (
            <>
              {/* Mute Button */}
              {callState === 'active' && (
                <button
                  onClick={toggleCallMute}
                  style={{ backgroundColor: isCallMuted ? '#ef4444' : 'rgba(255,255,255,0.1)' }}
                  className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md hover:bg-white/20 transition active:scale-95 cursor-pointer"
                  title={isCallMuted ? 'Unmute' : 'Mute'}
                >
                  {isCallMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>
              )}
              
              {/* End Call Button */}
              <button
                onClick={hangupCall}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-lg transform transition active:scale-95 cursor-pointer"
                title="End Call"
              >
                <PhoneOff size={24} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const currentMessagesRaw = activeSessionId ? (messages[activeSessionId] || []) : [];
  const currentMessages = isSearching && searchQuery
    ? currentMessagesRaw.filter(msg => msg.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : currentMessagesRaw;

  const filteredSessions = sidebarSearch
    ? sessions.filter(s => s.visitorName?.toLowerCase().includes(sidebarSearch.toLowerCase()))
    : sessions;

  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }, 10);
  }, [currentMessages, activeSessionId]);

  const playSendSound = () => {
    const audio = new Audio(`${SOCKET_URL}/sound-effect/mixkit-hard-pop-click-2364.wav`);
    audio.play().catch(e => console.log('Audio error:', e));
  };

  const playEndSessionSound = () => {
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3');
    audio.play().catch(e => console.log('Audio play error:', e));
  };

  const scrollToMessage = (msgId) => {
    if (!msgId) return;
    const element = document.getElementById(`msg-${msgId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      element.classList.add('animate-highlight');
      setTimeout(() => element.classList.remove('animate-highlight'), 2500);
    }
  };

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !socket || !activeSessionId) return;
    if (activeSession && activeSession.status === 'closed') return;

    if (editingMessage) {
      socket.emit('edit_message', { messageId: editingMessage.id, newContent: inputMessage, sessionId: activeSessionId, merchantId: user._id });
      setEditingMessage(null);
    } else {
      const newMsg = {
        sessionId: activeSessionId,
        sender: 'merchant',
        content: inputMessage,
        merchantId: user._id,
        senderId: user._id,
        senderName: myWidgetProfile.name,
        senderProfilePic: myWidgetProfile.profilePic || '',
        replyTo: replyingTo ? {
          messageId: replyingTo._id,
          content: replyingTo.content,
          sender: replyingTo.sender,
          senderName: replyingTo.sender === 'visitor' ? activeSession.visitorName : (replyingTo.senderName || '')
        } : undefined
      };
      socket.emit('send_message', newMsg);
      playSendSound();
      setReplyingTo(null);
    }

    setInputMessage('');
    setShowEmojiPicker(false);
    socket.emit('typing_end', { sessionId: activeSessionId, sender: 'merchant', merchantId: user._id });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const onEmojiClick = (emojiObject) => {
    setInputMessage(prev => prev + emojiObject.emoji);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${SOCKET_URL}/api/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();

      if (data.success && socket && activeSessionId) {
        socket.emit('send_message', {
          sessionId: activeSessionId,
          sender: 'merchant',
          content: '',
          fileUrl: data.fileUrl,
          fileType: data.fileType,
          merchantId: user._id,
          senderId: user._id,
          senderName: myWidgetProfile.name,
          senderProfilePic: myWidgetProfile.profilePic || '',
          replyTo: replyingTo ? {
            messageId: replyingTo._id,
            content: replyingTo.content,
            sender: replyingTo.sender,
            senderName: replyingTo.sender === 'visitor' ? activeSession.visitorName : (replyingTo.senderName || '')
          } : undefined
        });
        playSendSound();
        setReplyingTo(null);
      }
    } catch (err) {
      console.error('File upload failed', err);
    }
  };

  const handleEditMessage = (msgId, content) => {
    setEditingMessage({ id: msgId, content });
    setInputMessage(content);
  };

  const handleDeleteMessage = (msgId) => {
    socket.emit('delete_message', { messageId: msgId, sessionId: activeSessionId, merchantId: user._id });
  };

  const handleTyping = (e) => {
    setInputMessage(e.target.value);

    if (socket && activeSessionId) {
      socket.emit('typing_start', {
        sessionId: activeSessionId,
        sender: 'merchant',
        merchantId: user._id,
        senderName: myWidgetProfile.name,
        senderProfilePic: myWidgetProfile.profilePic || ''
      });

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing_end', { sessionId: activeSessionId, sender: 'merchant', merchantId: user._id });
      }, 1500);
    }
  };

  const formatTime = (ts) => new Date(ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const formatLastMsgTime = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getInitials = (name) => (name || 'G').charAt(0).toUpperCase();

  const AvatarCircle = ({ name, profilePic, size = 'md', color = '#00a884', onClick, className = '' }) => {
    const sizeClasses = size === 'lg' ? 'w-12 h-12 text-lg' : size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-10 h-10 text-sm';
    return profilePic ? (
      <img src={profilePic} alt={name} onClick={onClick}
        className={`${sizeClasses} rounded-full object-cover flex-shrink-0 ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`} />
    ) : (
      <div onClick={onClick}
        style={{ backgroundColor: color }}
        className={`${sizeClasses} rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''} ${className}`}>
        {getInitials(name)}
      </div>
    );
  };

  return (
    <div className="flex flex-1 w-full h-full" style={{ backgroundColor: '#111b21' }}>

      {/* Sidebar - Chat List */}
      <div className={`w-full md:w-[360px] flex-col h-full flex-shrink-0 ${activeSession ? 'hidden md:flex' : 'flex'}`}
        style={{ backgroundColor: '#111b21', borderRight: '1px solid #202c33' }}>

        {/* Sidebar Header */}
        <div className="h-[59px] flex items-center justify-between px-4 py-2 flex-shrink-0" style={{ backgroundColor: '#202c33' }}>
          <div className="flex items-center space-x-3">
            <AvatarCircle name={user?.name} profilePic={user?.profilePic} size="sm" color="#00a884" />
            <h2 className="font-semibold text-base" style={{ color: '#e9edef' }}>Messages</h2>
          </div>
          <div className="flex space-x-3" style={{ color: '#8696a0' }}>
            <button className="hover:opacity-75 transition-opacity p-1 rounded-full hover:bg-white/10">
              <MoreVertical size={20} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="px-3 py-2 flex-shrink-0" style={{ backgroundColor: '#111b21' }}>
          <div className="relative flex items-center rounded-lg overflow-hidden" style={{ backgroundColor: '#202c33' }}>
            <Search size={16} className="absolute left-3" style={{ color: '#8696a0' }} />
            <input
              type="text"
              value={sidebarSearch}
              onChange={e => setSidebarSearch(e.target.value)}
              placeholder="Search or start new chat"
              className="w-full py-2 pl-9 pr-4 text-sm bg-transparent outline-none"
              style={{ color: '#e9edef' }}
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto wa-scroll">
          {filteredSessions.length === 0 && (
            <div className="p-6 text-center text-sm mt-8" style={{ color: '#8696a0' }}>
              <MessageSquare size={40} className="mx-auto mb-3 opacity-30" />
              No active chats right now
            </div>
          )}
          {filteredSessions.map(session => {
            const isActive = session._id === activeSessionId;
            const hasUnread = session.unreadCount > 0;
            const isTyping = typingStatus[session._id];
            return (
              <div
                key={session._id}
                onClick={() => setActiveSessionId(session._id)}
                className="flex items-center px-3 py-3 cursor-pointer transition-colors"
                style={{
                  backgroundColor: isActive ? '#2a3942' : 'transparent',
                  borderBottom: '1px solid rgba(134,150,160,0.1)'
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = '#202c33'; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <AvatarCircle name={session.visitorName} size="lg" color="#00a884" />
                  <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#111b21] ${session.visitorStatus === 'offline' ? 'bg-gray-500' :
                    session.visitorStatus === 'minimized' ? 'bg-yellow-400' :
                      'bg-[#00a884]'
                    }`} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0 ml-3">
                  <div className="flex justify-between items-baseline mb-0.5">
                    <h3 className={`text-sm truncate ${hasUnread ? 'font-semibold' : 'font-normal'}`}
                      style={{ color: '#e9edef' }}>
                      {session.visitorName || 'Guest'}
                    </h3>
                    <span className={`text-xs whitespace-nowrap ml-2 flex-shrink-0 ${hasUnread ? 'font-medium' : ''}`}
                      style={{ color: hasUnread ? '#00a884' : '#8696a0', fontSize: '11px' }}>
                      {formatLastMsgTime(session.lastMessageAt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="flex-1 min-w-0">
                      {session.isOfflineLead && (
                        <span className="text-[9px] bg-[#2a3942] text-[#8696a0] border border-[#3b4a54] px-1.5 py-0.5 rounded font-semibold uppercase mr-1.5 flex-shrink-0 inline-block leading-none">
                          Offline Lead
                        </span>
                      )}
                      {session.assignedAgent ? (
                        <span className="text-[10px] mr-1" style={{ color: session.assignedAgent.toString() === user._id.toString() ? '#00a884' : '#53bdeb' }}>
                          [{session.assignedAgent.toString() === user._id.toString() ? 'You' : (session.assignedAgentName || 'Agent')}] · 
                        </span>
                      ) : (
                        <span className="text-[10px] mr-1 text-[#ffe600]">
                          [Unassigned] · 
                        </span>
                      )}
                      {session.source && (
                        <span className="text-[10px] mr-1" style={{ color: '#8696a0' }}>via {session.source} · </span>
                      )}
                      {isTyping ? (
                        <span className="text-xs italic" style={{ color: '#00a884' }}>typing...</span>
                      ) : (
                        <p className={`text-xs truncate ${hasUnread ? 'font-medium' : ''}`}
                          style={{ color: hasUnread ? '#e9edef' : '#8696a0' }}>
                          {session.lastMessage || (session.status === 'active' ? 'Active session' : 'Closed')}
                        </p>
                      )}
                    </div>
                    {hasUnread && (
                      <div className="ml-2 flex-shrink-0 min-w-[20px] h-5 rounded-full flex items-center justify-center px-1 text-[11px] font-semibold text-[#111b21] unread-badge"
                        style={{ backgroundColor: '#00a884' }}>
                        {session.unreadCount}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className={`flex-1 flex h-full relative ${!activeSession ? 'hidden md:flex' : 'flex'}`} style={{ backgroundColor: '#efeae2' }}>
        {activeSession ? (
          <>
            {/* Chat Messages Panel */}
            <div className="flex-1 flex flex-col h-full relative overflow-hidden">

              {/* Chat Header */}
              <div className="h-[59px] flex items-center justify-between px-4 py-2 flex-shrink-0 z-10"
                style={{ backgroundColor: '#202c33', borderBottom: '1px solid #2a3942' }}>
                {isSearching ? (
                  <div className="flex-1 flex items-center rounded-lg px-3 py-1.5 mx-2"
                    style={{ backgroundColor: '#2a3942' }}>
                    <Search size={16} style={{ color: '#8696a0' }} className="mr-2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search messages..."
                      className="bg-transparent border-none outline-none w-full text-sm"
                      style={{ color: '#e9edef' }}
                      autoFocus
                    />
                    <button onClick={() => { setIsSearching(false); setSearchQuery(''); }}
                      className="ml-2 hover:opacity-75 transition-opacity"
                      style={{ color: '#8696a0' }}>
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center flex-1 h-full cursor-pointer min-w-0 mr-2"
                    onClick={() => setSelectedProfileInfo({
                      type: 'visitor',
                      name: activeSession.visitorName,
                      status: activeSession.visitorStatus,
                      domain: activeSession.visitorDomain,
                      path: activeSession.visitorPath,
                      createdAt: activeSession.createdAt,
                      source: activeSession.source,
                      email: activeSession.visitorEmail,
                      phone: activeSession.visitorPhone,
                      details: activeSession.visitorDetails,
                      isOfflineLead: activeSession.isOfflineLead,
                      offlineFields: activeSession.offlineFields
                    })}
                  >
                    <button onClick={(e) => { e.stopPropagation(); setActiveSessionId(null); }}
                      className="md:hidden mr-2 p-1.5 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
                      style={{ color: '#8696a0' }}>
                      <ChevronLeft size={22} />
                    </button>

                    <div className="relative flex-shrink-0 mr-3">
                      <AvatarCircle name={activeSession.visitorName} size="md" color="#00a884" />
                      <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 ${activeSession.visitorStatus === 'offline' ? 'bg-gray-500 border-[#202c33]' :
                        activeSession.visitorStatus === 'minimized' ? 'bg-yellow-400 border-[#202c33]' :
                          'bg-[#00a884] border-[#202c33]'
                        }`} />
                    </div>

                    <div className="flex flex-col justify-center min-w-0 flex-1">
                      <h3 className="font-semibold text-sm leading-tight truncate" style={{ color: '#e9edef' }}>
                        {activeSession.visitorName}
                      </h3>
                      <p className="text-xs leading-tight mt-0.5 truncate" style={{ color: '#8696a0' }}>
                        {typingStatus[activeSessionId]
                          ? <span style={{ color: '#00a884' }}>typing...</span>
                          : (activeSession.visitorStatus === 'offline' ? 'offline' :
                            activeSession.visitorStatus === 'minimized' ? 'away' : 'online')
                        }
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center space-x-1" style={{ color: '#8696a0' }}>
                  {activeSession && activeSession.status !== 'closed' && (
                    <button onClick={startCall}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors"
                      title="Voice Call"
                    >
                      <Phone size={20} className="fill-[#8696a0]" />
                    </button>
                  )}
                  {!isSearching && (
                    <button onClick={() => setIsSearching(true)}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors">
                      <Search size={20} />
                    </button>
                  )}
                  <div className="relative" ref={dropdownRef}>
                    <button onClick={() => setShowDropdown(!showDropdown)}
                      className="p-2 rounded-full hover:bg-white/10 transition-colors">
                      <MoreVertical size={20} />
                    </button>
                    {showDropdown && (
                      <div className="absolute top-10 right-0 w-44 rounded-md shadow-xl py-1 z-[100] animate-fade-in"
                        style={{ backgroundColor: '#233138', border: '1px solid #2a3942' }}>
                        {activeSession && activeSession.assignedAgent && activeSession.assignedAgent.toString() === user._id.toString() && (
                          <button
                            onClick={() => {
                              socket.emit('leave_session', {
                                sessionId: activeSession._id,
                                agentName: myWidgetProfile.name,
                                merchantId: activeSession.merchantId
                              });
                              setShowDropdown(false);
                            }}
                            className="block w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/10"
                            style={{ color: '#e9edef' }}>
                            Leave Session
                          </button>
                        )}
                        <button
                          onClick={() => {
                            socket.emit('close_session', { sessionId: activeSessionId });
                            setShowDropdown(false);
                          }}
                          className="block w-full text-left px-4 py-2 text-sm transition-colors hover:bg-white/10"
                          style={{ color: '#ef4444' }}>
                          End Session
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {callState !== 'idle' ? (
                renderCallOverlay()
              ) : (
                <>
                  {/* Messages Area */}
                  <div
                style={{
                  backgroundColor: activeWidget?.bgType === 'solid' ? activeWidget.bgColor : '#efeae2',
                  backgroundImage: activeWidget?.bgType === 'solid' ? 'none' : `url(${activeWidget?.bgImage || 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png'})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                  flex: 1,
                  overflowY: 'auto',
                  padding: '12px 5%',
                }}
                className="wa-scroll"
              >
                {currentMessages.length === 0 && (
                  <div className="flex justify-center mt-6">
                    <span className="text-xs px-3 py-1.5 rounded-md shadow-sm"
                      style={{ backgroundColor: 'rgba(255,255,255,0.85)', color: '#8696a0' }}>
                      🔒 Messages are end-to-end encrypted
                    </span>
                  </div>
                )}

                {/* Date separator helper */}
                {currentMessages.map((msg, idx) => {
                  if (msg.sender === 'system') {
                    const prevMsg = currentMessages[idx - 1];
                    const showDateSep = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();
                    return (
                      <React.Fragment key={idx}>
                        {showDateSep && (
                          <div className="flex justify-center my-3">
                            <span className="text-xs px-3 py-1 rounded-md shadow-sm font-medium"
                              style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#54656f' }}>
                              {new Date(msg.timestamp).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-center my-3 animate-in fade-in duration-200">
                          {msg.content.includes('ended') || msg.content.includes('closed') ? (
                            <span className="text-xs px-3.5 py-1.5 rounded-md border border-red-500/20 text-red-500 bg-red-500/10 font-semibold shadow-xs">
                              🚫 {msg.content}
                            </span>
                          ) : (
                            <span className="text-xs px-3.5 py-1.5 rounded-md border border-[#00a884]/20 text-[#00a884] bg-[#00a884]/10 font-semibold shadow-xs flex items-center space-x-1.5">
                              <UserCheck size={14} className="text-[#00a884]" />
                              <span>{msg.content}</span>
                            </span>
                          )}
                        </div>
                      </React.Fragment>
                    );
                  }
                  const isOut = msg.sender === 'merchant';
                  const isIn = msg.sender === 'visitor';
                  const prevMsg = currentMessages[idx - 1];
                  const showDateSep = !prevMsg || new Date(msg.timestamp).toDateString() !== new Date(prevMsg.timestamp).toDateString();

                  return (
                    <React.Fragment key={idx}>
                      {showDateSep && (
                        <div className="flex justify-center my-3">
                          <span className="text-xs px-3 py-1 rounded-md shadow-sm font-medium"
                            style={{ backgroundColor: 'rgba(255,255,255,0.9)', color: '#54656f' }}>
                            {new Date(msg.timestamp).toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <div
                        id={`msg-${msg._id || idx}`}
                        className={`flex ${isOut ? 'justify-end' : 'justify-start'} mb-1 items-end animate-slide-up`}
                        style={{ animationDelay: `${Math.min(idx * 0.02, 0.15)}s` }}
                        onMouseEnter={() => setHoveredMessage(msg._id)}
                        onMouseLeave={() => setHoveredMessage(null)}
                      >
                        {/* Visitor Avatar — incoming */}
                        {isIn && (
                          <div
                            onClick={() => setSelectedProfileInfo({
                              type: 'visitor',
                              name: activeSession.visitorName,
                              status: activeSession.visitorStatus,
                              domain: activeSession.visitorDomain,
                              path: activeSession.visitorPath,
                              createdAt: activeSession.createdAt,
                              source: activeSession.source
                            })}
                            title="View visitor details"
                            className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-[10px] mr-1.5 mb-1 cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: '#00a884', fontSize: '11px' }}
                          >
                            {getInitials(activeSession.visitorName)}
                          </div>
                        )}

                        {/* Action buttons — BEFORE bubble for outgoing (appear to LEFT of bubble) */}
                        {isOut && (
                          <div
                            className={`flex items-center space-x-0.5 mr-1.5 mb-1 flex-shrink-0 transition-all duration-150 ${hoveredMessage === msg._id ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                              }`}
                          >
                            <button
                              onClick={() => setReplyingTo(msg)}
                              className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                              style={{ color: '#8696a0' }}
                              title="Reply"
                            >
                              <CornerUpLeft size={14} />
                            </button>
                            {!msg.isDeleted && (
                              <>
                                <button
                                  onClick={() => handleEditMessage(msg._id, msg.content)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                                  style={{ color: '#8696a0' }}
                                  title="Edit"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button
                                  onClick={() => handleDeleteMessage(msg._id)}
                                  className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-red-900/30"
                                  style={{ color: '#ef4444' }}
                                  title="Delete"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        )}

                        {/* Message Bubble */}
                        <div className="relative max-w-[65%]">
                          <div
                            className="relative rounded-lg px-3 py-2 shadow-sm"
                            style={{
                              backgroundColor: isOut ? '#005c4b' : '#202c33',
                              borderRadius: isOut ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                              minWidth: '80px',
                            }}
                          >
                            {/* Sender name for merchant messages */}
                            {isOut && (
                              <span className="block text-[10px] font-semibold mb-0.5" style={{ color: '#00a884' }}>
                                {msg.senderId === user._id ? 'You' : msg.senderName || 'Support Agent'}
                              </span>
                            )}

                            {/* Reply quote */}
                            {msg.replyTo && !msg.isDeleted && (
                              <div
                                onClick={() => scrollToMessage(msg.replyTo.messageId)}
                                className="mb-1.5 rounded-md overflow-hidden cursor-pointer"
                                style={{
                                  borderLeft: '3px solid #00a884',
                                  backgroundColor: isOut ? 'rgba(0,0,0,0.2)' : 'rgba(255,255,255,0.05)',
                                  padding: '6px 8px'
                                }}
                              >
                                <p className="text-[10px] font-semibold mb-0.5" style={{ color: '#00a884' }}>
                                  {msg.replyTo.sender === 'merchant' ? 'You' : activeSession.visitorName}
                                </p>
                                <p className="text-[11px] truncate" style={{ color: '#8696a0' }}>
                                  {msg.replyTo.content || '📎 Attachment'}
                                </p>
                              </div>
                            )}

                            {/* File/Image/Audio attachment */}
                            {msg.fileUrl && (
                              <div className="mb-1">
                                {msg.fileType === 'image' ? (
                                  <img
                                    src={msg.fileUrl}
                                    alt="attachment"
                                    className="max-w-full rounded-md object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                    style={{ maxHeight: '220px' }}
                                    onClick={() => setFullScreenImage(msg.fileUrl)}
                                  />
                                ) : msg.fileType === 'audio' ? (
                                  <AudioPlayer url={msg.fileUrl} />
                                ) : (
                                  <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center space-x-2 text-sm hover:opacity-80 transition-opacity"
                                    style={{ color: '#53bdeb' }}>
                                    <Paperclip size={15} /> <span>Download File</span>
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Message text */}
                            {msg.content && (
                              <p className={`text-sm break-words leading-relaxed ${msg.isDeleted ? 'italic' : ''}`}
                                style={{ color: msg.isDeleted ? '#8696a0' : '#e9edef', whiteSpace: 'pre-wrap' }}>
                                {msg.isDeleted && <span className="mr-1">🚫</span>}
                                {msg.content}
                                {msg.isEdited && !msg.isDeleted && (
                                  <span className="text-[10px] ml-1.5" style={{ color: '#8696a0' }}>(edited)</span>
                                )}
                              </p>
                            )}

                            {/* Timestamp + ticks */}
                            <div className="flex items-center justify-end mt-1 space-x-1">
                              <span className="text-[10px]" style={{ color: '#8696a0' }}>
                                {formatTime(msg.timestamp)}
                              </span>
                              {isOut && (
                                <span className="flex items-center" style={{ color: msg.status === 'read' ? '#53bdeb' : '#8696a0' }}>
                                  {(!msg.status || msg.status === 'sent') && (
                                    <svg viewBox="0 0 16 15" width="14" height="14">
                                      <path d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879 2.44 7.753a.365.365 0 0 0-.51 0l-.432.432a.365.365 0 0 0 0 .511l2.56 2.56c.182.182.478.181.66-.001l6.43-8.082a.365.365 0 0 0-.068-.521z" fill="currentColor" />
                                    </svg>
                                  )}
                                  {(msg.status === 'delivered' || msg.status === 'read') && (
                                    <svg viewBox="0 0 16 15" width="16" height="15">
                                      <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.319.319 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879 2.44 7.752a.365.365 0 0 0-.51 0l-.432.432a.365.365 0 0 0 0 .511l2.56 2.56c.182.182.478.181.661-.001L10.95 3.84a.365.365 0 0 0-.039-.524z" fill="currentColor" />
                                    </svg>
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Action button — AFTER bubble for incoming (Reply only, to RIGHT of bubble) */}
                        {isIn && (
                          <div
                            className={`flex items-center ml-1.5 mb-1 flex-shrink-0 transition-all duration-150 ${hoveredMessage === msg._id ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                              }`}
                          >
                            <button
                              onClick={() => setReplyingTo(msg)}
                              className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
                              style={{ color: '#8696a0' }}
                              title="Reply"
                            >
                              <CornerUpLeft size={14} />
                            </button>
                          </div>
                        )}

                        {/* Merchant Avatar — outgoing */}
                        {isOut && (
                          <div
                            title={`Click to view ${msg.senderName || 'Agent'}'s profile`}
                            className="ml-1.5 mb-1 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => {
                              const details = getAgentDetails(msg.senderId, msg.senderName);
                              setSelectedProfileInfo({ type: 'merchant', ...details });
                            }}
                          >
                            <AvatarCircle
                              name={msg.senderId === user._id ? myWidgetProfile.name : (msg.senderName || 'Agent')}
                              profilePic={msg.senderProfilePic}
                              size="sm"
                              color="#00a884"
                            />
                          </div>
                        )}
                      </div>
                    </React.Fragment>
                  );
                })}

                {/* Typing indicator */}
                {typingStatus[activeSessionId] && (
                  <div className="flex justify-start items-end mb-2">
                    <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-[10px] mr-1.5 mb-1"
                      style={{ backgroundColor: '#00a884' }}>
                      {getInitials(activeSession.visitorName)}
                    </div>
                    <div className="rounded-lg px-4 py-3 shadow-sm"
                      style={{ backgroundColor: '#202c33', borderRadius: '2px 12px 12px 12px' }}>
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 rounded-full typing-dot" style={{ backgroundColor: '#8696a0' }} />
                        <div className="w-2 h-2 rounded-full typing-dot" style={{ backgroundColor: '#8696a0' }} />
                        <div className="w-2 h-2 rounded-full typing-dot" style={{ backgroundColor: '#8696a0' }} />
                      </div>
                    </div>
                  </div>
                )}

                {activeSession.status === 'closed' && (
                  <div className="flex justify-center my-3 animate-in fade-in duration-200">
                    <span className="text-xs px-3.5 py-1.5 rounded-md border border-red-500/20 text-red-500 bg-red-500/10 font-semibold shadow-xs">
                      🚫 This chat session has ended
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              {activeSession.status === 'closed' ? (
                <div className="flex-shrink-0 py-5 px-4 text-center border-t"
                  style={{ backgroundColor: '#202c33', borderColor: '#2a3942' }}>
                  <p className="text-sm font-semibold" style={{ color: '#8696a0' }}>
                    This chat session has ended.
                  </p>
                </div>
              ) : !activeSession.assignedAgent ? (
                <div className="flex-shrink-0 py-6 px-4 text-center border-t flex flex-col items-center justify-center space-y-3"
                  style={{ backgroundColor: '#202c33', borderColor: '#2a3942' }}>
                  <p className="text-sm font-semibold text-gray-300">
                    This chat session is currently unassigned.
                  </p>
                  <button
                    onClick={() => {
                      if (socket) {
                        socket.emit('join_session', {
                          sessionId: activeSession._id,
                          agentId: user._id,
                          agentName: myWidgetProfile.name,
                          merchantId: activeSession.merchantId
                        });
                      }
                    }}
                    className="bg-[#00a884] hover:bg-[#008f6f] text-white font-semibold py-2.5 px-6 rounded-lg shadow-md transition-all active:scale-95 text-xs cursor-pointer"
                  >
                    Join / Enroll Session
                  </button>
                </div>
              ) : activeSession.assignedAgent.toString() !== user._id.toString() ? (
                <div className="flex-shrink-0 py-6 px-4 text-center border-t flex items-center justify-center space-x-2"
                  style={{ backgroundColor: '#202c33', borderColor: '#2a3942', color: '#8696a0' }}>
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0 animate-pulse" />
                  <p className="text-sm font-semibold">
                    Agent <strong className="text-white">{activeSession.assignedAgentName || 'another agent'}</strong> is handling this conversation.
                  </p>
                </div>
              ) : (
                <div className="flex-shrink-0" style={{ backgroundColor: '#202c33' }}>
                  {showEmojiPicker && (
                    <div className="absolute bottom-[72px] left-4 z-50 shadow-2xl rounded-xl overflow-hidden"
                      style={{ border: '1px solid #2a3942' }}>
                      <EmojiPicker theme="dark" onEmojiClick={onEmojiClick} height={320} width={300} searchDisabled />
                    </div>
                  )}

                  {/* Editing banner */}
                  {editingMessage && (
                    <div className="px-4 py-2 text-xs flex justify-between items-center"
                      style={{ backgroundColor: '#2a3942', borderTop: '1px solid #3b4a54', color: '#8696a0' }}>
                      <span className="flex items-center">
                        <Edit2 size={12} className="mr-2" style={{ color: '#00a884' }} />
                        <span style={{ color: '#00a884' }}>Editing message</span>
                      </span>
                      <button onClick={() => { setEditingMessage(null); setInputMessage(''); }}
                        className="hover:opacity-75 transition-opacity" style={{ color: '#8696a0' }}>
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {/* Reply preview */}
                  {replyingTo && (
                    <div className="px-4 py-2 flex items-center justify-between"
                      style={{ backgroundColor: '#2a3942', borderTop: '1px solid #3b4a54' }}>
                      <div className="flex-1 rounded-md overflow-hidden"
                        style={{ borderLeft: '3px solid #00a884', backgroundColor: '#233138', padding: '6px 10px' }}>
                        <p className="text-[10px] font-semibold mb-0.5" style={{ color: '#00a884' }}>
                          {replyingTo.sender === 'merchant' ? 'You' : activeSession.visitorName}
                        </p>
                        <p className="text-xs truncate max-w-sm" style={{ color: '#8696a0' }}>
                          {replyingTo.content || '📎 Attachment'}
                        </p>
                      </div>
                      <button onClick={() => setReplyingTo(null)}
                        className="ml-3 p-1 rounded-full hover:bg-white/10 transition-colors"
                        style={{ color: '#8696a0' }}>
                        <X size={18} />
                      </button>
                    </div>
                  )}

                  {/* Main input row */}
                  <div className="py-2 px-3 md:py-3 md:px-4 flex items-end space-x-2">
                    {isRecording ? (
                      <>
                        {/* Cancel/Discard Button */}
                        <button
                          onClick={cancelRecording}
                          className="p-2.5 text-red-500 hover:bg-red-500/10 rounded-full transition-colors flex-shrink-0 mb-0.5"
                          title="Discard recording"
                        >
                          <Trash2 size={22} className="w-[22px] h-[22px]" />
                        </button>

                        {/* Recording status capsule */}
                        <div className="flex-1 flex items-center justify-between bg-[#2a3942] rounded-2xl px-4 py-2.5 min-h-[40px] shadow-inner text-white">
                          <div className="flex items-center space-x-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                            <span className="text-sm font-semibold tracking-wider tabular-nums text-[#e9edef]">
                              {formatRecordingTime(recordingTime)}
                            </span>
                          </div>

                          {/* Dancing Waveform Visualizer */}
                          <div className="flex-1 flex items-center justify-center space-x-0.75 px-4 h-6">
                            {audioLevels.map((level, idx) => (
                              <div
                                key={idx}
                                className="w-0.75 bg-red-500 rounded-full transition-all duration-75"
                                style={{ height: `${level}px`, minHeight: '4px' }}
                              />
                            ))}
                          </div>
                        </div>

                        {/* Stop and Send Button */}
                        <button
                          onClick={stopAndSendRecording}
                          className="w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center text-white transition-all shadow-md flex-shrink-0 hover:brightness-110 active:scale-95 mb-0.5"
                          style={{ backgroundColor: '#00a884' }}
                          title="Send voice message"
                        >
                          <Send size={18} className="ml-0.5 w-[18px] h-[18px] md:w-[20px] md:h-[20px]" />
                        </button>
                      </>
                    ) : (
                      <>
                        {/* Input Capsule (like WhatsApp / Messenger) */}
                        <div className="flex-1 flex items-end bg-[#2a3942] rounded-2xl px-2 py-1.5 min-h-[40px] shadow-inner">
                          {/* Emoji Button */}
                          <button
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="p-1.5 text-[#8696a0] hover:text-[#00a884] hover:bg-white/5 rounded-full transition-colors flex-shrink-0 mb-0.5"
                            title="Emoji"
                          >
                            <Smile size={20} className="w-5 h-5 md:w-[22px] md:h-[22px]" />
                          </button>

                          {/* Textarea */}
                          <textarea
                            ref={textareaRef}
                            rows={1}
                            value={inputMessage}
                            onChange={handleTyping}
                            onKeyDown={handleKeyDown}
                            placeholder="Type a message..."
                            className="flex-1 bg-transparent text-sm text-[#e9edef] outline-none resize-none mx-2 max-h-[120px] py-1 md:py-1.5 wa-scroll placeholder:text-[#8696a0]"
                            style={{ border: 'none' }}
                          />

                          {/* File Upload Button */}
                          <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="p-1.5 text-[#8696a0] hover:text-[#e9edef] hover:bg-white/5 rounded-full transition-colors flex-shrink-0 mb-0.5"
                            title="Attach file"
                          >
                            <Paperclip size={20} className="w-5 h-5 md:w-[22px] md:h-[22px]" />
                          </button>
                        </div>

                        {/* Send / Mic Toggle Button */}
                        {inputMessage.trim() ? (
                          <button
                            onClick={handleSendMessage}
                            className="w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center text-white transition-all shadow-md flex-shrink-0 hover:brightness-110 active:scale-95 mb-0.5"
                            style={{ backgroundColor: '#00a884' }}
                            title="Send message"
                          >
                            <Send size={18} className="ml-0.5 w-[18px] h-[18px] md:w-[20px] md:h-[20px]" />
                          </button>
                        ) : (
                          <button
                            onClick={startRecording}
                            className="w-10 h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center text-white transition-all shadow-md flex-shrink-0 hover:brightness-110 active:scale-95 mb-0.5"
                            style={{ backgroundColor: '#00a884' }}
                            title="Record voice message"
                          >
                            <Mic size={18} className="w-[18px] h-[18px] md:w-[20px] md:h-[20px]" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
                </>
              )}
            </div>

            {/* Profile Drawer */}
            {selectedProfileInfo && (
              <div className="absolute inset-y-0 right-0 z-50 w-full sm:w-[300px] md:relative md:w-[300px] flex flex-col h-full flex-shrink-0 animate-slide-in-right md:animate-none"
                style={{ backgroundColor: '#111b21', borderLeft: '1px solid #202c33' }}>

                {/* Drawer Header */}
                <div className="h-[59px] flex items-center justify-between px-4 flex-shrink-0"
                  style={{ backgroundColor: '#202c33', borderBottom: '1px solid #2a3942' }}>
                  <h4 className="font-semibold text-sm" style={{ color: '#e9edef' }}>
                    {selectedProfileInfo.type === 'visitor' ? 'Visitor Info' : 'Agent Profile'}
                  </h4>
                  <button
                    onClick={() => setSelectedProfileInfo(null)}
                    className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
                    style={{ color: '#8696a0' }}>
                    <X size={18} />
                  </button>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto wa-scroll">
                  {/* Avatar + name section */}
                  <div className="flex flex-col items-center py-8 px-6 text-center"
                    style={{ background: 'linear-gradient(180deg, #202c33 0%, #111b21 100%)' }}>
                    {selectedProfileInfo.type === 'visitor' ? (
                      <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-3xl mb-3 shadow-lg"
                        style={{ backgroundColor: '#00a884' }}>
                        {getInitials(selectedProfileInfo.name)}
                      </div>
                    ) : (
                      <div className="relative mb-3">
                        {selectedProfileInfo.profilePic ? (
                          <img src={selectedProfileInfo.profilePic} alt={selectedProfileInfo.name}
                            className="w-20 h-20 rounded-full object-cover shadow-lg" />
                        ) : (
                          <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-lg"
                            style={{ backgroundColor: '#7c3aed' }}>
                            {getInitials(selectedProfileInfo.name)}
                          </div>
                        )}
                        <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 bg-[#00a884]"
                          style={{ borderColor: '#111b21' }} />
                      </div>
                    )}
                    <h5 className="font-semibold text-base mb-1" style={{ color: '#e9edef' }}>
                      {selectedProfileInfo.name}
                    </h5>
                    {selectedProfileInfo.type === 'visitor' ? (
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${selectedProfileInfo.status === 'offline' ? 'bg-gray-700 text-gray-400' : 'bg-[#005c4b] text-[#00a884]'
                        }`}>
                        {selectedProfileInfo.status === 'offline' ? '● Offline' : '● Online'}
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                        {selectedProfileInfo.designation}
                      </span>
                    )}
                  </div>

                  {/* Info fields */}
                  <div className="px-4 pb-6 space-y-2">
                    {selectedProfileInfo.type === 'visitor' ? (
                      <>
                        {[
                          { label: 'Email', value: selectedProfileInfo.email || 'Not provided' },
                          { label: 'Phone', value: selectedProfileInfo.phone || 'Not provided' },
                          { label: 'Pre-Chat Details', value: selectedProfileInfo.details || 'None' },
                          { label: 'Domain', value: selectedProfileInfo.domain || 'Unknown' },
                          { label: 'Current Page', value: selectedProfileInfo.path || '/' },
                          { label: 'Source', value: selectedProfileInfo.source || 'Website Widget' },
                          { label: 'First Visit', value: selectedProfileInfo.createdAt ? new Date(selectedProfileInfo.createdAt).toLocaleString() : 'N/A' },
                        ].map(({ label, value }) => (
                          <div key={label} className="rounded-lg p-3" style={{ backgroundColor: '#202c33' }}>
                            <span className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#8696a0' }}>
                              {label}
                            </span>
                            <span className="text-sm break-all" style={{ color: '#e9edef' }}>{value}</span>
                          </div>
                        ))}
                        {selectedProfileInfo.isOfflineLead && selectedProfileInfo.offlineFields && (
                          Object.entries(selectedProfileInfo.offlineFields instanceof Map ? Object.fromEntries(selectedProfileInfo.offlineFields) : selectedProfileInfo.offlineFields).map(([k, v]) => {
                            if (['name', 'email', 'phone', 'message'].includes(k.toLowerCase())) return null;
                            const fieldLabel = k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                            return (
                              <div key={k} className="rounded-lg p-3" style={{ backgroundColor: '#202c33' }}>
                                <span className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#8696a0' }}>
                                  {fieldLabel}
                                </span>
                                <span className="text-sm break-all" style={{ color: '#e9edef' }}>{v}</span>
                              </div>
                            );
                          })
                        )}
                      </>
                    ) : (
                      <>
                        {[
                          { label: 'Email', value: selectedProfileInfo.email || 'N/A' },
                          { label: 'Widget Role', value: selectedProfileInfo.role },
                          { label: 'Status', value: '● Online', valueColor: '#00a884' },
                        ].map(({ label, value, valueColor }) => (
                          <div key={label} className="rounded-lg p-3" style={{ backgroundColor: '#202c33' }}>
                            <span className="block text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: '#8696a0' }}>
                              {label}
                            </span>
                            <span className="text-sm" style={{ color: valueColor || '#e9edef' }}>{value}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          // Empty state
          <div className="flex-1 flex items-center justify-center flex-col" style={{ backgroundColor: '#222e35' }}>
            <div className="mb-6 opacity-10">
              <MessageSquare size={96} style={{ color: '#e9edef' }} />
            </div>
            <h2 className="text-2xl font-light mb-3" style={{ color: '#e9edef' }}>OChat Dashboard</h2>
            <p className="text-sm text-center max-w-xs leading-relaxed" style={{ color: '#8696a0' }}>
              Select a conversation from the sidebar to start messaging your visitors in real-time
            </p>
            <div className="mt-6 flex items-center space-x-2 text-xs" style={{ color: '#8696a0' }}>
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm-.75 3.25a.75.75 0 0 1 1.5 0v4.5a.75.75 0 0 1-1.5 0v-4.5zM8 11.5a.75.75 0 1 1 0 1.5.75.75 0 0 1 0-1.5z" />
              </svg>
              <span>End-to-end encrypted messages</span>
            </div>
          </div>
        )}
      </div>

      {/* Full Screen Image Modal */}
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setFullScreenImage(null)}>
          <button
            className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 transition-colors"
            style={{ color: '#e9edef' }}
            onClick={(e) => { e.stopPropagation(); setFullScreenImage(null); }}>
            <X size={28} />
          </button>
          <img
            src={fullScreenImage}
            alt="Full screen preview"
            className="max-w-full max-h-full object-contain animate-slide-up rounded-md"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default Chat;
