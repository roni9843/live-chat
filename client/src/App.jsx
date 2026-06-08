import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Paperclip, Smile, CornerUpLeft, ChevronLeft, MoreVertical, Globe, ShieldCheck, Lock, Mic, MicOff, Play, Pause, Trash2, Phone, PhoneOff, UserCheck } from 'lucide-react';
import io from 'socket.io-client';
import EmojiPicker from 'emoji-picker-react';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'https://jh5nng6t-5000.asse.devtunnels.ms';

const AudioPlayer = ({ url, primaryColor, isDark, darkTheme }) => {
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
    const count = 22;
    const heights = [];
    for (let i = 0; i < count; i++) {
      const envelope = Math.sin(Math.PI * (i + 0.5) / count);
      const randomFactor = 0.3 + 0.7 * Math.abs(Math.sin(hash * (i + 1) * 456.789));
      const h = 3 + Math.floor(envelope * randomFactor * 17);
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
    <div
      className="flex items-center space-x-2 py-1.5 px-2.5 rounded-xl min-w-[170px] sm:min-w-[210px] max-w-[260px] text-white"
      style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)' }}
    >
      <audio ref={audioRef} src={url} preload="metadata" />

      <button
        onClick={togglePlay}
        className="w-7 h-7 rounded-full flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-all flex-shrink-0"
        style={{ backgroundColor: primaryColor }}
      >
        {isPlaying ? <Pause size={12} fill="white" /> : <Play size={12} className="ml-0.5" fill="white" />}
      </button>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Waveform track */}
        <div className="flex items-center space-x-0.75 h-6 cursor-pointer select-none px-1">
          {waveform.map((height, idx) => {
            const isActive = (idx / waveform.length) <= progress;
            return (
              <div
                key={idx}
                onClick={() => handleBarClick(idx)}
                className="w-0.75 rounded-full transition-colors duration-150"
                style={{
                  height: `${height}px`,
                  backgroundColor: isActive ? primaryColor : (isDark ? '#4b5563' : '#d1d5db'),
                  minHeight: '3px'
                }}
              />
            );
          })}
        </div>
        <div className="flex justify-between items-center mt-0.5 text-[9px]" style={{ color: darkTheme.textSecondary }}>
          <span>{formatAudioTime(currentTime)} / {formatAudioTime(duration || 0)}</span>

          <button
            onClick={handleSpeedToggle}
            className="px-1 py-0.5 rounded text-[8px] font-bold select-none transition-colors"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
              color: isDark ? '#e9edef' : '#111b21'
            }}
          >
            {playbackRate}x
          </button>
        </div>
      </div>
    </div>
  );
};

function App({ merchantId, widgetId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [socket, setSocket] = useState(null);
  const socketRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [unreadMessage, setUnreadMessage] = useState(null);
  const [isMerchantTyping, setIsMerchantTyping] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [hoveredMessage, setHoveredMessage] = useState(null);
  const [replyingTo, setReplyingTo] = useState(null);
  const [activeViewers, setActiveViewers] = useState([]);
  const [typingAgent, setTypingAgent] = useState(null);
  const [selectedAgentProfile, setSelectedAgentProfile] = useState(null);
  const [hoveredFaqIndex, setHoveredFaqIndex] = useState(null);
  const [showInfoPage, setShowInfoPage] = useState(false);
  const [isPreChatSubmitted, setIsPreChatSubmitted] = useState(() => {
    return localStorage.getItem(`preChatSubmitted_${widgetId}`) === 'true';
  });
  const [preChatName, setPreChatName] = useState('');
  const [preChatEmail, setPreChatEmail] = useState('');
  const [preChatPhone, setPreChatPhone] = useState('');
  const [preChatMessage, setPreChatMessage] = useState('');
  const [isOfflineSubmitted, setIsOfflineSubmitted] = useState(false);
  const [offlineFormValues, setOfflineFormValues] = useState({});

  useEffect(() => {
    if (widgetConfig) {
      const initial = {};
      const fields = widgetConfig.offlineForm?.fields || [
        { id: 'name', label: 'Name', type: 'text', required: true },
        { id: 'email', label: 'Email', type: 'email', required: true },
        { id: 'phone', label: 'Phone Number', type: 'tel', required: false },
        { id: 'message', label: 'Message', type: 'textarea', required: true }
      ];
      fields.forEach(f => {
        let val = '';
        if (f.id === 'name') val = localStorage.getItem(`visitorName_${widgetId}`) || '';
        else if (f.id === 'email') val = localStorage.getItem(`visitorEmail_${widgetId}`) || '';
        else if (f.id === 'phone') val = localStorage.getItem(`visitorPhone_${widgetId}`) || '';
        initial[f.id] = val;
      });
      setOfflineFormValues(initial);
    }
  }, [widgetConfig, widgetId]);

  const pendingFirstMessageRef = useRef('');
  const [isSessionEnded, setIsSessionEnded] = useState(false);
  const [visualHeight, setVisualHeight] = useState('100%');

  useEffect(() => {
    if (typeof window === 'undefined' || !window.visualViewport) return;

    const handleResize = () => {
      setVisualHeight(`${window.visualViewport.height}px`);
    };

    window.visualViewport.addEventListener('resize', handleResize);
    window.visualViewport.addEventListener('scroll', handleResize);
    handleResize();

    return () => {
      window.visualViewport.removeEventListener('resize', handleResize);
      window.visualViewport.removeEventListener('scroll', handleResize);
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      const isMobile = window.innerWidth <= 640;
      if (isMobile) {
        const originalHtmlOverflow = document.documentElement.style.overflow;
        const originalHtmlHeight = document.documentElement.style.height;
        const originalBodyOverflow = document.body.style.overflow;
        const originalBodyHeight = document.body.style.height;

        document.documentElement.style.overflow = 'hidden';
        document.documentElement.style.height = '100%';
        document.body.style.overflow = 'hidden';
        document.body.style.height = '100%';

        return () => {
          document.documentElement.style.overflow = originalHtmlOverflow;
          document.documentElement.style.height = originalHtmlHeight;
          document.body.style.overflow = originalBodyOverflow;
          document.body.style.height = originalBodyHeight;
        };
      }
    }
  }, [isOpen]);


  const [widgetConfig, setWidgetConfig] = useState({

    companyName: 'Ochat Support',
    color: '#25D366',
    position: 'right',
    title: 'Chat with us',
    welcomeMessage: "Welcome! We're here to help you live chat with your visitors.",
    spacingBottom: 20,
    spacingSide: 20,
    launcherType: 'icon_only',
    launcherText: 'Chat',
    themeMode: 'light',
    bgType: 'image',
    bgColor: '#efeae2',
    bgImage: 'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png',
    preChatForm: {
      enabled: false,
      fields: {
        name: { enabled: true, required: true, label: 'Name', placeholder: 'Enter your name...' },
        email: { enabled: true, required: true, label: 'Email', placeholder: 'Enter your email...' },
        phone: { enabled: false, required: false, label: 'Phone Number', placeholder: 'Enter your phone number...' },
        message: { enabled: false, required: false, label: 'Message', placeholder: 'How can we help you?' }
      }
    }
  });
  const messagesEndRef = useRef(null);
  const isOpenRef = useRef(isOpen);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const hoverTimeoutRef = useRef(null);
  const textareaRef = useRef(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [audioChunks, setAudioChunks] = useState([]);
  const [audioLevels, setAudioLevels] = useState([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
  const recordingTimerRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animationFrameRef = useRef(null);

  // WebRTC Audio Calling States & Refs
  const [callState, setCallState] = useState('idle'); // 'idle', 'dialing', 'incoming', 'active'
  const [isCallMuted, setIsCallMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [activeAgentName, setActiveAgentName] = useState('');

  const callStateRef = useRef('idle');
  const updateCallState = (state) => {
    setCallState(state);
    callStateRef.current = state;
  };

  const sessionIdRef = useRef(null);
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

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
    setAudioLevels([4, 4, 4, 4, 4, 4, 4, 4, 4, 4]);
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
    setActiveAgentName(widgetConfig.companyName || 'Support Agent');
    playRingtone('dialing');

    socketRef.current.emit('call_request', {
      sessionId: sessionIdRef.current,
      callerName: 'Visitor',
      callerType: 'visitor'
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
        alert('Microphone access blocked: WebRTC requires a Secure Context (localhost or HTTPS). Please run your 3rd party web page on a local web server (e.g. npx serve) instead of opening the index.html directly from file://.');
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
      analyser.fftSize = 32;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const updateVisuals = () => {
        if (analyserRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const levels = [];
          const barCount = 10;
          const step = Math.floor(dataArray.length / barCount) || 1;
          for (let i = 0; i < barCount; i++) {
            const val = dataArray[i * step] || 0;
            const h = 4 + Math.floor((val / 255) * 20);
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

          if (data.success && socket && sessionId) {
            socket.emit('send_message', {
              sessionId,
              sender: 'visitor',
              content: '',
              fileUrl: data.fileUrl,
              fileType: 'audio',
              merchantId,
              replyTo: replyingTo ? {
                messageId: replyingTo._id,
                content: replyingTo.content,
                sender: replyingTo.sender,
                senderName: replyingTo.sender === 'visitor' ? 'Me' : (replyingTo.senderName || widgetConfig.companyName)
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
    isOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (widgetId) {
      fetch(`${SOCKET_URL}/api/widgets/${widgetId}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.companyName) {
            setWidgetConfig(data);
          }
        })
        .catch(err => console.error('Failed to fetch widget settings:', err));
    }
  }, [widgetId]);

  useEffect(() => {
    if (isOpen && !socket) {
      const newSocket = io(SOCKET_URL);
      setSocket(newSocket);
      socketRef.current = newSocket;


      const visitorId = localStorage.getItem('visitorId') || Math.random().toString(36).substring(7);
      localStorage.setItem('visitorId', visitorId);

      const formEnabled = widgetConfig.preChatForm?.enabled;
      const submitted = localStorage.getItem(`preChatSubmitted_${widgetId}`) === 'true';

      if (!formEnabled || submitted) {
        const savedName = localStorage.getItem(`visitorName_${widgetId}`) || ('Guest ' + visitorId.substring(0, 4));
        const savedEmail = localStorage.getItem(`visitorEmail_${widgetId}`) || '';
        const savedPhone = localStorage.getItem(`visitorPhone_${widgetId}`) || '';

        newSocket.emit('visitor_join', {
          merchantId,
          widgetId,
          companyName: widgetConfig.companyName,
          visitorId,
          visitorName: savedName,
          visitorEmail: savedEmail,
          visitorPhone: savedPhone,
          visitorDomain: window.location.hostname,
          visitorPath: window.location.pathname
        });
      }

      newSocket.on('chat_history', ({ sessionId, messages }) => {
        setMessages(messages || []);
        if (sessionId) {
          setSessionId(sessionId);
          if (pendingFirstMessageRef.current?.trim()) {
            newSocket.emit('send_message', {
              sessionId,
              sender: 'visitor',
              content: pendingFirstMessageRef.current,
              merchantId
            });
            pendingFirstMessageRef.current = '';
          }
        }
      });

      newSocket.on('receive_message', (msg) => {
        setMessages((prev) => [...prev, msg]);
        if (msg.sender === 'merchant') {
          if (!isOpenRef.current) {
            const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
            audio.play().catch(e => console.log('Audio error:', e));
            setUnreadMessage(msg.content);
            setTimeout(() => setUnreadMessage(null), 5000);
            newSocket.emit('messages_status_update', { sessionId: msg.sessionId, status: 'delivered', merchantId });
          } else {
            newSocket.emit('messages_status_update', { sessionId: msg.sessionId, status: 'read', merchantId });
          }
        }
      });

      newSocket.on('message_updated', (updatedMsg) => {
        setMessages((prev) => prev.map(m => m._id === updatedMsg._id ? updatedMsg : m));
      });

      newSocket.on('messages_status_updated', ({ sessionId: sId, status }) => {
        setMessages(prev => prev.map(m => m.sender === 'visitor' && m.status !== 'read' ? { ...m, status } : m));
      });

      newSocket.on('new_session', (session) => {
        setSessionId(session._id);
      });

      newSocket.on('typing_start', ({ sender, senderName, senderProfilePic }) => {
        if (sender === 'merchant') {
          setIsMerchantTyping(true);
          setTypingAgent({ name: senderName, profilePic: senderProfilePic });
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 10);
        }
      });

      newSocket.on('typing_end', ({ sender }) => {
        if (sender === 'merchant') {
          setIsMerchantTyping(false);
          setTypingAgent(null);
        }
      });

      newSocket.on('active_viewers_updated', (viewers) => {
        setActiveViewers(viewers || []);
      });

      // WebRTC Call Listeners
      newSocket.on('incoming_call', ({ sessionId: cId, callerName, callerType }) => {
        if (callStateRef.current !== 'idle') {
          newSocket.emit('call_reject', { sessionId: cId, reason: 'busy' });
          return;
        }
        updateCallState('incoming');
        setActiveAgentName(callerName || 'Support Agent');
        playRingtone('ringing');
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

      newSocket.on('call_rejected', ({ reason }) => {
        cleanupCall();
        if (reason === 'busy') {
          alert('Line busy. The agent is currently in another call.');
        } else {
          alert('Call declined by agent.');
        }
      });

      newSocket.on('webrtc_offer_received', async ({ offer }) => {
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

      newSocket.on('webrtc_answer_received', async ({ answer }) => {
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

      newSocket.on('webrtc_ice_received', async ({ candidate }) => {
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


      newSocket.on('call_hungup', () => {
        cleanupCall();
      });

      newSocket.on('session_closed', ({ sessionId: closedId }) => {
        localStorage.removeItem(`preChatSubmitted_${widgetId}`);
        setIsSessionEnded(true);
        setSessionId(null);
        setShowInfoPage(false);
        playEndSessionSound();
      });
    }
  }, [isOpen, socket, merchantId, widgetId, widgetConfig]);

  useEffect(() => {
    if (isOpen) {
      setUnreadMessage(null);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 10);
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (socket && sessionId) {
      socket.emit('widget_state_change', {
        sessionId,
        state: isOpen ? 'online' : 'minimized',
        merchantId
      });
      if (isOpen) {
        socket.emit('messages_status_update', { sessionId, status: 'read', merchantId });
      }
    }
  }, [isOpen, socket, sessionId, merchantId]);

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
    if (!inputMessage.trim() || !socket || !sessionId) return;

    const newMsg = {
      sessionId,
      sender: 'visitor',
      content: inputMessage,
      merchantId,
      replyTo: replyingTo ? {
        messageId: replyingTo._id,
        content: replyingTo.content,
        sender: replyingTo.sender,
        senderName: replyingTo.sender === 'visitor' ? 'Me' : (replyingTo.senderName || widgetConfig.companyName)
      } : undefined
    };

    socket.emit('send_message', newMsg);
    playSendSound();
    setInputMessage('');
    setShowEmojiPicker(false);
    setReplyingTo(null);
    socket.emit('typing_end', { sessionId, sender: 'visitor', merchantId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleFaqClick = (faq) => {
    if (!socket || !sessionId) return;

    // 1. Send the visitor's question
    const visitorMsg = {
      sessionId,
      sender: 'visitor',
      content: faq.question,
      merchantId
    };
    socket.emit('send_message', visitorMsg);
    playSendSound();

    // 2. Simulate agent typing indicator
    setIsMerchantTyping(true);
    setTypingAgent({
      name: widgetConfig.companyName,
      profilePic: widgetConfig.agents?.[0]?.profilePic || ''
    });

    // Scroll to bottom
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);

    // 3. After 1.2 seconds, send the auto-answer from the merchant
    setTimeout(() => {
      setIsMerchantTyping(false);

      const answerMsg = {
        sessionId,
        sender: 'merchant',
        content: faq.answer,
        merchantId,
        senderName: widgetConfig.companyName,
        senderProfilePic: widgetConfig.agents?.[0]?.profilePic || ''
      };

      socket.emit('send_message', answerMsg);

      // Play incoming message pop sound
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audio.play().catch(e => console.log('Audio error:', e));

      // Scroll to bottom
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    }, 1200);
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

      if (data.success && socket && sessionId) {
        socket.emit('send_message', {
          sessionId,
          sender: 'visitor',
          content: '',
          fileUrl: data.fileUrl,
          fileType: data.fileType,
          merchantId,
          replyTo: replyingTo ? {
            messageId: replyingTo._id,
            content: replyingTo.content,
            sender: replyingTo.sender,
            senderName: replyingTo.sender === 'visitor' ? 'Me' : (replyingTo.senderName || widgetConfig.companyName)
          } : undefined
        });
        playSendSound();
        setReplyingTo(null);
      }
    } catch (err) {
      console.error('File upload failed', err);
    }
  };

  const handleTyping = (e) => {
    setInputMessage(e.target.value);
    if (socket && sessionId) {
      socket.emit('typing_start', { sessionId, sender: 'visitor', merchantId });
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing_end', { sessionId, sender: 'visitor', merchantId });
      }, 1500);
    }
  };

  const handleAgentClick = (name, profilePic) => {
    const matchedAgent = widgetConfig.agents?.find(
      a => a.name.toLowerCase() === name.toLowerCase()
    );
    if (matchedAgent) {
      setSelectedAgentProfile(matchedAgent);
    } else {
      setSelectedAgentProfile({
        name,
        profilePic: profilePic || '',
        designation: 'Support Representative'
      });
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setSelectedAgentProfile(null);
      setShowInfoPage(false);
    }
  }, [isOpen]);

  const isDark = widgetConfig.themeMode === 'dark';
  const isRight = widgetConfig.position === 'right';
  const isSideTab = widgetConfig.launcherType === 'side_tab';
  const primaryColor = widgetConfig.color || '#25D366';

  // Dark theme colors
  const darkTheme = {
    headerBg: isDark ? '#202c33' : primaryColor,
    chatBg: isDark ? '#0b141a' : '#efeae2',
    msgOut: isDark ? '#005c4b' : '#d9fdd3',
    msgIn: isDark ? '#202c33' : '#ffffff',
    inputBg: isDark ? '#2a3942' : '#f0f2f5',
    inputFieldBg: isDark ? '#202c33' : '#ffffff',
    textPrimary: isDark ? '#e9edef' : '#111b21',
    textSecondary: isDark ? '#8696a0' : '#667781',
    borderColor: isDark ? '#2a3942' : '#e9edef',
    iconColor: isDark ? '#8696a0' : '#54656f',
  };

  const handleEndSession = () => {
    if (socket && sessionId) {
      socket.emit('close_session', { sessionId });
    }
    localStorage.removeItem(`preChatSubmitted_${widgetId}`);
    setIsSessionEnded(true);
    setSessionId(null);
    setShowInfoPage(false);
    playEndSessionSound();
  };

  const handleStartNewSession = () => {
    setIsSessionEnded(false);
    setMessages([]);
    setIsPreChatSubmitted(false);

    const formEnabled = widgetConfig.preChatForm?.enabled;
    if (!formEnabled && socket) {
      const visitorId = localStorage.getItem('visitorId') || Math.random().toString(36).substring(7);
      localStorage.setItem('visitorId', visitorId);

      const savedName = localStorage.getItem(`visitorName_${widgetId}`) || ('Guest ' + visitorId.substring(0, 4));
      const savedEmail = localStorage.getItem(`visitorEmail_${widgetId}`) || '';
      const savedPhone = localStorage.getItem(`visitorPhone_${widgetId}`) || '';

      socket.emit('visitor_join', {
        merchantId,
        widgetId,
        companyName: widgetConfig.companyName,
        visitorId,
        visitorName: savedName,
        visitorEmail: savedEmail,
        visitorPhone: savedPhone,
        visitorDomain: window.location.hostname,
        visitorPath: window.location.pathname
      });
    }
  };

  const handlePreChatSubmit = (e) => {
    e.preventDefault();
    if (!socket) return;

    const visitorId = localStorage.getItem('visitorId') || Math.random().toString(36).substring(7);
    localStorage.setItem('visitorId', visitorId);

    // Save to localStorage
    localStorage.setItem(`preChatSubmitted_${widgetId}`, 'true');
    if (preChatName) localStorage.setItem(`visitorName_${widgetId}`, preChatName);
    if (preChatEmail) localStorage.setItem(`visitorEmail_${widgetId}`, preChatEmail);
    if (preChatPhone) localStorage.setItem(`visitorPhone_${widgetId}`, preChatPhone);

    setIsPreChatSubmitted(true);

    if (preChatMessage.trim()) {
      pendingFirstMessageRef.current = preChatMessage;
    }

    socket.emit('visitor_join', {
      merchantId,
      widgetId,
      companyName: widgetConfig.companyName,
      visitorId,
      visitorName: preChatName || ('Guest ' + visitorId.substring(0, 4)),
      visitorEmail: preChatEmail || '',
      visitorPhone: preChatPhone || '',
      visitorDetails: preChatMessage || '',
      visitorDomain: window.location.hostname,
      visitorPath: window.location.pathname
    });
  };

  const handleOfflineFormSubmit = (e) => {
    e.preventDefault();
    const nameVal = offlineFormValues.name || '';
    const emailVal = offlineFormValues.email || '';
    const phoneVal = offlineFormValues.phone || '';
    if (nameVal) localStorage.setItem(`visitorName_${widgetId}`, nameVal);
    if (emailVal) localStorage.setItem(`visitorEmail_${widgetId}`, emailVal);
    if (phoneVal) localStorage.setItem(`visitorPhone_${widgetId}`, phoneVal);

    const visitorId = localStorage.getItem('visitorId') || Math.random().toString(36).substring(7);
    localStorage.setItem('visitorId', visitorId);

    const payload = {
      visitorId,
      visitorName: nameVal || 'Guest ' + visitorId.substring(0, 4),
      visitorEmail: emailVal,
      visitorPhone: phoneVal,
      visitorDomain: window.location.hostname,
      visitorPath: window.location.pathname,
      message: offlineFormValues.message || 'Offline lead query',
      fields: offlineFormValues
    };

    fetch(`${SOCKET_URL}/api/widgets/${widgetId}/offline-message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        setIsOfflineSubmitted(true);
        if (data.session && data.session._id) {
          setSessionId(data.session._id);
          localStorage.setItem(`visitorSessionId_${widgetId}`, data.session._id);
        }
      } else {
        alert('Failed to send message. Please try again.');
      }
    })
    .catch(err => {
      console.error(err);
      alert('Error sending message. Please try again.');
    });
  };

  const renderOfflineForm = () => {
    const title = widgetConfig.offlineForm?.title || 'Leave a message';
    const message = widgetConfig.offlineForm?.message || 'All agents are offline. Please state your problems and post them.';
    const fields = widgetConfig.offlineForm?.fields || [
      { id: 'name', label: 'Name', type: 'text', required: true, placeholder: 'Enter your name...' },
      { id: 'email', label: 'Email', type: 'email', required: true, placeholder: 'Enter your email...' },
      { id: 'phone', label: 'Phone Number', type: 'tel', required: false, placeholder: 'Enter your phone number...' },
      { id: 'message', label: 'Message', type: 'textarea', required: true, placeholder: 'Describe your issue...' }
    ];

    return (
      <form
        onSubmit={handleOfflineFormSubmit}
        className="flex-1 flex flex-col justify-between p-6 overflow-y-auto text-left"
        style={{ backgroundColor: darkTheme.chatBg }}
      >
        <div className="space-y-4">
          <div className="text-center space-y-1 mb-2">
            <h4 className="font-bold text-sm" style={{ color: isDark ? '#ffffff' : '#111b21' }}>{title}</h4>
            <p className="text-xs font-normal" style={{ color: darkTheme.textSecondary }}>
              {message}
            </p>
          </div>

          {fields.map(field => (
            <div key={field.id} className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
              <label className="block text-xs font-semibold" style={{ color: isDark ? '#ffffff' : '#54656f' }}>
                {field.label} {field.required && <span className="text-red-500">*</span>}
              </label>
              {field.type === 'textarea' ? (
                <textarea
                  rows={3}
                  required={field.required}
                  value={offlineFormValues[field.id] || ''}
                  onChange={(e) => setOfflineFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                  placeholder={field.placeholder || ''}
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none border focus:ring-1 focus:ring-opacity-50 resize-none"
                  style={{
                    backgroundColor: 'white',
                    color: 'black',
                    borderColor: darkTheme.borderColor,
                    outlineColor: primaryColor
                  }}
                />
              ) : (
                <input
                  type={field.type}
                  required={field.required}
                  value={offlineFormValues[field.id] || ''}
                  onChange={(e) => setOfflineFormValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                  placeholder={field.placeholder || ''}
                  className="w-full px-3 py-2 text-sm rounded-lg outline-none border focus:ring-1 focus:ring-opacity-50"
                  style={{
                    backgroundColor: 'white',
                    color: 'black',
                    borderColor: darkTheme.borderColor,
                    outlineColor: primaryColor
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <button
          type="submit"
          style={{ backgroundColor: primaryColor }}
          className="w-full py-2.5 rounded-lg text-white font-semibold text-sm shadow-md transition-all duration-200 hover:brightness-95 active:scale-[0.98] mt-6 cursor-pointer"
        >
          Post Message
        </button>
      </form>
    );
  };

  const renderOfflineSuccess = () => {
    return (
      <div
        className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4"
        style={{ backgroundColor: darkTheme.chatBg }}
      >
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-[#00a884] mb-2 animate-bounce">
          <ShieldCheck size={36} />
        </div>
        <h4 className="font-bold text-base" style={{ color: isDark ? '#ffffff' : '#111b21' }}>Thank you!</h4>
        <p className="text-xs max-w-xs leading-relaxed" style={{ color: darkTheme.textSecondary }}>
          Your message has been posted. Our team is offline, but we will review your submission and get back to you as soon as possible.
        </p>
        <button
          type="button"
          onClick={() => setIsOfflineSubmitted(false)}
          className="px-6 py-2 rounded-lg text-white font-semibold text-xs transition active:scale-95 cursor-pointer"
          style={{ backgroundColor: primaryColor }}
        >
          Send Another Message
        </button>
      </div>
    );
  };

  const renderPreChatForm = () => {
    const fields = widgetConfig.preChatForm?.fields || {};
    return (
      <form
        onSubmit={handlePreChatSubmit}
        className="flex-1 flex flex-col justify-between p-6 overflow-y-auto text-left"
        style={{ backgroundColor: darkTheme.chatBg }}
      >
        <div className="space-y-4">
          <div className="text-center space-y-1 mb-2">
            <h4 className="font-bold text-sm" style={{ color: isDark ? '#ffffff' : '#111b21' }}>Pre-Chat Form</h4>
            <p className="text-xs" style={{ color: darkTheme.textSecondary }}>
              Please fill out the form below to start a chat with our support team.
            </p>
          </div>

          {fields.name?.enabled && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
              <label className="block text-xs font-semibold" style={{ color: isDark ? '#ffffff' : '#54656f' }}>
                {fields.name.label} {fields.name.required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                required={fields.name.required}
                value={preChatName}
                onChange={(e) => setPreChatName(e.target.value)}
                placeholder={fields.name.placeholder}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none border focus:ring-1 focus:ring-opacity-50"
                style={{
                  backgroundColor: 'white',
                  color: 'black',
                  borderColor: darkTheme.borderColor,
                  outlineColor: primaryColor
                }}
              />
            </div>
          )}

          {fields.email?.enabled && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
              <label className="block text-xs font-semibold" style={{ color: isDark ? '#ffffff' : '#54656f' }}>
                {fields.email.label} {fields.email.required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="email"
                required={fields.email.required}
                value={preChatEmail}
                onChange={(e) => setPreChatEmail(e.target.value)}
                placeholder={fields.email.placeholder}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none border focus:ring-1 focus:ring-opacity-50"
                style={{
                  backgroundColor: 'white',
                  color: 'black',
                  borderColor: darkTheme.borderColor,
                  outlineColor: primaryColor
                }}
              />
            </div>
          )}

          {fields.phone?.enabled && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
              <label className="block text-xs font-semibold" style={{ color: isDark ? '#ffffff' : '#54656f' }}>
                {fields.phone.label} {fields.phone.required && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                required={fields.phone.required}
                value={preChatPhone}
                onChange={(e) => setPreChatPhone(e.target.value)}
                placeholder={fields.phone.placeholder}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none border focus:ring-1 focus:ring-opacity-50"
                style={{
                  backgroundColor: 'white',
                  color: 'black',
                  borderColor: darkTheme.borderColor,
                  outlineColor: primaryColor
                }}
              />
            </div>
          )}

          {fields.message?.enabled && (
            <div className="space-y-1 animate-in fade-in slide-in-from-top-1 duration-150">
              <label className="block text-xs font-semibold" style={{ color: isDark ? '#ffffff' : '#54656f' }}>
                {fields.message.label} {fields.message.required && <span className="text-red-500">*</span>}
              </label>
              <textarea
                rows={3}
                required={fields.message.required}
                value={preChatMessage}
                onChange={(e) => setPreChatMessage(e.target.value)}
                placeholder={fields.message.placeholder}
                className="w-full px-3 py-2 text-sm rounded-lg outline-none border focus:ring-1 focus:ring-opacity-50 resize-none animate-in fade-in"
                style={{
                  backgroundColor: 'white',
                  color: 'black',
                  borderColor: darkTheme.borderColor,
                  outlineColor: primaryColor
                }}
              />
            </div>
          )}
        </div>

        <button
          type="submit"
          style={{ backgroundColor: primaryColor }}
          className="w-full py-2.5 rounded-lg text-white font-semibold text-sm shadow-md transition-all duration-200 hover:brightness-95 active:scale-[0.98] mt-6"
        >
          Start Chat
        </button>
      </form>
    );
  };

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
        <div className="flex flex-col items-center mt-8 space-y-4 w-full">
          <div className="relative">
            {(callState === 'dialing' || callState === 'incoming') && (
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '2s' }} />
            )}
            {callState === 'active' && (
              <div className="absolute inset-0 rounded-full bg-emerald-500/10 animate-pulse" />
            )}

            <div
              style={{ backgroundColor: primaryColor }}
              className="w-24 h-24 rounded-full flex items-center justify-center text-white font-bold text-3xl shadow-xl relative z-10"
            >
              {activeAgentName.charAt(0).toUpperCase()}
            </div>
          </div>

          <h2 className="text-lg font-bold tracking-wide mt-2">{activeAgentName}</h2>

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
        <div className="flex items-center justify-center w-full mb-8 space-x-6">
          {callState === 'incoming' ? (
            <>
              {/* Decline Button */}
              <button
                onClick={rejectCall}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center text-white shadow-lg transform transition active:scale-95 cursor-pointer"
                title="Decline Call"
              >
                <PhoneOff size={24} />
              </button>

              {/* Accept Button */}
              <button
                onClick={acceptCall}
                className="w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center text-white shadow-lg transform transition active:scale-95 cursor-pointer"
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

  const containerStyle = {
    position: 'fixed',
    zIndex: 99999,
    ...(isOpen
      ? {
        bottom: `${widgetConfig.spacingBottom ?? 20}px`,
        [isRight ? 'right' : 'left']: `${widgetConfig.spacingSide ?? 20}px`
      }
      : (isSideTab
        ? {
          top: '50%',
          transform: 'translateY(-50%)',
          [isRight ? 'right' : 'left']: '0px',
          bottom: 'auto'
        }
        : {
          bottom: `${widgetConfig.spacingBottom ?? 20}px`,
          [isRight ? 'right' : 'left']: `${widgetConfig.spacingSide ?? 20}px`
        }
      )
    )
  };

  const merchantMessages = messages.filter(msg => msg.sender === 'merchant');
  const activeAgentsMap = new Map();
  merchantMessages.forEach(msg => {
    const key = msg.senderId ? msg.senderId.toString() : msg.senderName;
    if (key) {
      activeAgentsMap.set(key, {
        name: msg.senderName || 'Representative',
        profilePic: msg.senderProfilePic || ''
      });
    }
  });
  const activeAgents = Array.from(activeAgentsMap.values());

  let headerTitle = widgetConfig.title || widgetConfig.companyName;
  let headerAgents = [];
  let headerSubtitle = widgetConfig.isWidgetOnline === false ? 'Offline' : 'Typically replies in minutes';
  let showLogoInHeader = false;

  if (widgetConfig.isWidgetOnline !== false) {
    if (activeViewers.length === 1) {
      headerTitle = activeViewers[0].name;
      headerAgents = [activeViewers[0]];
      headerSubtitle = 'Online now';
    } else if (activeViewers.length > 1) {
      headerTitle = widgetConfig.companyName;
      headerAgents = activeViewers;
      headerSubtitle = `${activeViewers.length} agents online`;
    } else {
      if (widgetConfig.logo) {
        showLogoInHeader = true;
        headerTitle = widgetConfig.title || widgetConfig.companyName;
        headerSubtitle = 'Typically replies in minutes';
      } else {
        if (activeAgents.length === 1) {
          headerTitle = activeAgents[0].name;
          headerAgents = [activeAgents[0]];
          headerSubtitle = 'Support Representative';
        } else if (activeAgents.length > 1) {
          headerTitle = widgetConfig.companyName;
          headerAgents = activeAgents;
        }
      }
    }
  }

  const formatTime = (ts) => new Date(ts || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const AgentAvatar = ({ agent, size = 'sm', onClick }) => {
    const sz = size === 'sm' ? 'w-7 h-7 text-[10px]' : 'w-20 h-20 text-3xl';
    return agent.profilePic ? (
      <img
        src={agent.profilePic} alt={agent.name}
        className={`${sz} rounded-full object-cover flex-shrink-0 aspect-square ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
        onClick={onClick}
      />
    ) : (
      <div
        style={{ backgroundColor: isDark ? '#2a3942' : 'rgba(255,255,255,0.2)', color: isDark ? '#00a884' : 'white' }}
        className={`${sz} rounded-full flex-shrink-0 flex items-center justify-center font-bold aspect-square ${onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
        onClick={onClick}
      >
        {agent.name.charAt(0).toUpperCase()}
      </div>
    );
  };

  return (
    <div style={{ ...containerStyle, '--visual-height': visualHeight }} className={`font-sans ${isOpen ? 'ochat-container-open' : ''}`}>


      {/* Chat Window */}
      {isOpen && (
        <div
          className="mb-4 flex flex-col overflow-hidden shadow-2xl animate-widget-open ochat-window"

          style={{
            width: '360px',
            maxWidth: `calc(100vw - ${(widgetConfig.spacingSide ?? 20) * 2}px)`,
            height: '560px',
            maxHeight: 'calc(100vh - 100px)',
            borderRadius: '12px',
            backgroundColor: darkTheme.chatBg,
            border: isDark ? '1px solid #2a3942' : 'none',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-3 py-2.5 flex-shrink-0"
            style={{ backgroundColor: darkTheme.headerBg, minHeight: '56px' }}
          >
            <div className="flex items-center flex-1 min-w-0">
              {/* Agent avatars or Logo */}
              {showLogoInHeader && widgetConfig.logo ? (
                <div className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden mr-2.5 border border-white/20 bg-white flex items-center justify-center">
                  <img src={widgetConfig.logo} alt="Logo" className="w-full h-full object-cover" />
                </div>
              ) : headerAgents && headerAgents.length > 0 ? (
                <div className="flex -space-x-2 mr-2.5 overflow-hidden">
                  {headerAgents.slice(0, 3).map((agent, i) => (
                    <AgentAvatar
                      key={i}
                      agent={agent}
                      size="sm"
                      onClick={(e) => {
                        e?.stopPropagation();
                        handleAgentClick(agent.name, agent.profilePic);
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold mr-2.5 text-sm"
                  style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
                >
                  {widgetConfig.companyName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="font-semibold text-sm leading-tight text-white truncate">{headerTitle}</h3>
                <p className="text-[10px] mt-0.5 leading-tight" style={{ color: isDark ? '#8696a0' : 'rgba(255,255,255,0.8)' }}>
                  {headerSubtitle}
                </p>
              </div>
            </div>
            {/* Right side controls */}
            <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
              <span className="text-[10px] font-semibold text-white/80 max-w-[120px] truncate pr-1" title={widgetConfig.companyName}>
                {widgetConfig.companyName}
              </span>
              {sessionId && !isSessionEnded && (
                <button
                  onClick={startCall}
                  className="text-white hover:opacity-75 transition-opacity p-1.5 rounded hover:bg-white/10 flex items-center justify-center cursor-pointer"
                  title="Voice Call"
                >
                  <Phone size={15} className="fill-white" />
                </button>
              )}
              <button
                onClick={() => {
                  setSelectedAgentProfile(null);
                  setShowInfoPage(true);
                }}
                className="text-white hover:opacity-75 transition-opacity p-1 rounded hover:bg-white/10 flex items-center justify-center cursor-pointer"
                title="Company Info"
              >
                <MoreVertical size={16} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white hover:opacity-75 transition-opacity p-1 rounded hover:bg-white/10 flex items-center justify-center cursor-pointer"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Agent Profile Sub-page */}
          {selectedAgentProfile ? (
            <div
              className="flex-1 flex flex-col overflow-hidden animate-slide-up"
              style={{ backgroundColor: isDark ? '#111b21' : '#f0f2f5' }}
            >
              {/* Back button */}
              <div className="flex items-center px-3 py-2 flex-shrink-0"
                style={{ backgroundColor: isDark ? '#202c33' : 'white', borderBottom: `1px solid ${darkTheme.borderColor}` }}>
                <button
                  onClick={() => setSelectedAgentProfile(null)}
                  className="flex items-center space-x-1 text-sm font-medium hover:opacity-75 transition-opacity"
                  style={{ color: isDark ? '#00a884' : primaryColor }}
                >
                  <ChevronLeft size={18} />
                  <span>Back to chat</span>
                </button>
              </div>

              <div className="flex-1 flex flex-col items-center justify-start pt-8 px-6 text-center overflow-y-auto wa-scroll">
                {/* Avatar */}
                <div className="relative mb-4">
                  {selectedAgentProfile.profilePic ? (
                    <img src={selectedAgentProfile.profilePic} alt={selectedAgentProfile.name}
                      className="w-24 h-24 rounded-full object-cover shadow-lg" />
                  ) : (
                    <div
                      className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-bold text-white shadow-lg"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {selectedAgentProfile.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 bg-[#00a884]"
                    style={{ borderColor: isDark ? '#111b21' : '#f0f2f5' }} />
                </div>

                <h4 className="text-base font-semibold mb-1" style={{ color: darkTheme.textPrimary }}>
                  {selectedAgentProfile.name}
                </h4>
                <span
                  className="text-xs px-3 py-1 rounded-full font-medium mb-6"
                  style={{ backgroundColor: isDark ? '#2a3942' : '#e9fce9', color: primaryColor }}
                >
                  {selectedAgentProfile.designation || 'Support Representative'}
                </span>

                {/* Status card */}
                <div className="w-full rounded-xl p-4 text-left"
                  style={{ backgroundColor: isDark ? '#202c33' : 'white', border: `1px solid ${darkTheme.borderColor}` }}>
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#00a884]" />
                    <span className="text-xs font-semibold" style={{ color: '#00a884' }}>Online</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: darkTheme.textSecondary }}>
                    Active support representative. Typically replies within minutes.
                  </p>
                </div>
              </div>
            </div>
          ) : showInfoPage ? (
            <div
              className="flex-1 flex flex-col overflow-hidden animate-slide-up"
              style={{ backgroundColor: isDark ? '#111b21' : '#f0f2f5' }}
            >
              {/* Back button */}
              <div className="flex items-center px-3 py-2 flex-shrink-0"
                style={{ backgroundColor: isDark ? '#202c33' : 'white', borderBottom: `1px solid ${darkTheme.borderColor}` }}>
                <button
                  onClick={() => setShowInfoPage(false)}
                  className="flex items-center space-x-1 text-sm font-medium hover:opacity-75 transition-opacity cursor-pointer"
                  style={{ color: isDark ? '#00a884' : primaryColor }}
                >
                  <ChevronLeft size={18} />
                  <span>Back to chat</span>
                </button>
              </div>

              <div className="flex-1 flex flex-col items-center justify-start pt-6 px-6 text-center overflow-y-auto wa-scroll space-y-6 pb-6">
                {/* Company Logo/Initial */}
                <div className="flex flex-col items-center">
                  {widgetConfig.logo ? (
                    <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-md mb-3 border border-gray-200 bg-white flex items-center justify-center flex-shrink-0">
                      <img src={widgetConfig.logo} alt="Company Logo" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div
                      className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-bold text-white shadow-md mb-3"
                      style={{ backgroundColor: primaryColor }}
                    >
                      {widgetConfig.companyName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <h4 className="text-base font-bold" style={{ color: darkTheme.textPrimary }}>
                    {widgetConfig.companyName}
                  </h4>
                  {widgetConfig.domain && (
                    <a
                      href={`https://${widgetConfig.domain}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs flex items-center space-x-1 mt-1 hover:underline cursor-pointer"
                      style={{ color: primaryColor }}
                    >
                      <Globe size={12} />
                      <span>{widgetConfig.domain}</span>
                    </a>
                  )}
                </div>

                {/* About us / Welcome message */}
                <div className="w-full rounded-xl p-4 text-left space-y-2 animate-in fade-in duration-200"
                  style={{ backgroundColor: isDark ? '#202c33' : 'white', border: `1px solid ${darkTheme.borderColor}` }}>
                  <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: primaryColor }}>
                    Welcome Message
                  </span>
                  <p className="text-xs leading-relaxed" style={{ color: darkTheme.textSecondary }}>
                    {widgetConfig.welcomeMessage}
                  </p>
                </div>

                {/* End Session Button */}
                {sessionId && (
                  <button
                    onClick={handleEndSession}
                    className="w-full py-2.5 rounded-xl text-white font-semibold text-xs shadow-md transition-all duration-200 hover:brightness-95 active:scale-[0.98] cursor-pointer"
                    style={{ backgroundColor: '#ef4444' }}
                  >
                    End Session
                  </button>
                )}

                {/* Encrypted Badge */}
                <div className="flex items-center justify-center space-x-1 text-[10px] opacity-75" style={{ color: darkTheme.textSecondary }}>
                  <ShieldCheck size={14} className="text-emerald-500 animate-pulse" />
                  <span>Verified Secure Connection</span>
                </div>
              </div>
            </div>
          ) : (widgetConfig.isWidgetOnline === false) && (!sessionId || isSessionEnded) && !isOfflineSubmitted ? (
            renderOfflineForm()
          ) : (widgetConfig.isWidgetOnline === false) && (!sessionId || isSessionEnded) && isOfflineSubmitted ? (
            renderOfflineSuccess()
          ) : widgetConfig.preChatForm?.enabled && !isPreChatSubmitted ? (
            renderPreChatForm()
          ) : callState !== 'idle' ? (
            renderCallOverlay()
          ) : (
            <>
              {/* Messages Area */}
              <div
                className="flex-1 overflow-y-auto px-3 py-3 space-y-1 wa-scroll"
                style={{
                  backgroundColor: widgetConfig.bgType === 'solid' ? widgetConfig.bgColor : (isDark ? '#0b141a' : '#efeae2'),
                  backgroundImage: widgetConfig.bgType === 'image' && widgetConfig.bgImage ? `url(${widgetConfig.bgImage})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }}
              >
                {/* Welcome msg */}
                {messages.length === 0 && (
                  <div className="flex justify-center my-3">
                    <div className="px-4 py-3 rounded-xl text-center shadow-sm max-w-[80%]"
                      style={{ backgroundColor: isDark ? 'rgba(32,44,51,0.95)' : 'rgba(255,255,255,0.92)' }}>
                      <p className="text-xs leading-relaxed" style={{ color: darkTheme.textSecondary }}>
                        {widgetConfig.welcomeMessage}
                      </p>
                    </div>
                  </div>
                )}

                {/* Encryption notice */}
                {messages.length === 0 && (
                  <div className="flex justify-center mb-2">
                    <span className="text-[10px] px-2.5 py-1 rounded-md flex items-center space-x-1"
                      style={{
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                        color: isDark ? '#8696a0' : '#8696a0'
                      }}>
                      <Lock size={11} className="text-[#8696a0]" />
                      <span>End-to-end encrypted</span>
                    </span>
                  </div>
                )}

                {/* FAQs / Quick Replies */}
                {((messages.length === 0) || messages.every(msg => msg.sender === 'visitor')) && widgetConfig.faqs && widgetConfig.faqs.length > 0 && (
                  <div className="flex flex-col space-y-2 mt-4 px-2 animate-widget-open">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-center mb-1 animate-pulse"
                      style={{ color: darkTheme.textSecondary }}>
                      Frequently Asked Questions
                    </span>
                    <div className="flex flex-col space-y-2">
                      {widgetConfig.faqs.map((faq, index) => (
                        <button
                          key={index}
                          onClick={() => handleFaqClick(faq)}
                          onMouseEnter={() => setHoveredFaqIndex(index)}
                          onMouseLeave={() => setHoveredFaqIndex(null)}
                          className="w-full text-left px-4 py-2.5 rounded-xl text-xs font-semibold border shadow-xs transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between cursor-pointer"
                          style={{
                            backgroundColor: isDark ? '#202c33' : '#ffffff',
                            borderColor: hoveredFaqIndex === index ? primaryColor : (isDark ? '#2a3942' : '#e9edef'),
                            color: isDark ? '#e9edef' : '#2e2e2e',
                          }}
                        >
                          <span className="pr-2">{faq.question}</span>
                          <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full flex-shrink-0"
                            style={{
                              backgroundColor: hoveredFaqIndex === index ? primaryColor : (isDark ? '#2a3942' : '#f0f2f5'),
                              color: hoveredFaqIndex === index ? '#ffffff' : primaryColor,
                              transition: 'all 0.2s ease-in-out'
                            }}>
                            Ask
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, index) => {
                  if (msg.sender === 'system') {
                    const isClosedMsg = msg.content.includes('ended') || msg.content.includes('closed');
                    return (
                      <div key={index} className="flex justify-center my-3 animate-in fade-in duration-200">
                        {isClosedMsg ? (
                          <span className="text-[10px] px-2.5 py-1.5 rounded-md border border-red-500/20 text-red-500 bg-red-500/10 font-semibold shadow-xs">
                            🚫 {msg.content}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2.5 py-1.5 rounded-md border font-semibold shadow-xs flex items-center space-x-1"
                            style={{
                              backgroundColor: 'rgba(0, 168, 132, 0.08)',
                              borderColor: 'rgba(0, 168, 132, 0.15)',
                              color: '#00a884'
                            }}>
                            <UserCheck size={11} className="text-[#00a884]" />
                            <span>{msg.content}</span>
                          </span>
                        )}
                      </div>
                    );
                  }
                  const isOut = msg.sender === 'visitor';
                  return (
                    <div
                      key={index}
                      id={`msg-${msg._id || `local-${index}`}`}
                      className={`flex ${isOut ? 'justify-end' : 'justify-start'} animate-slide-up items-end mb-1 relative group`}
                      style={{ animationDelay: `${Math.min(index * 0.04, 0.3)}s` }}
                      onMouseEnter={() => {
                        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                        setHoveredMessage(msg._id || `local-${index}`);
                      }}
                      onMouseLeave={() => {
                        hoverTimeoutRef.current = setTimeout(() => setHoveredMessage(null), 300);
                      }}
                    >
                      {/* Agent avatar */}
                      {!isOut && (
                        msg.senderProfilePic ? (
                          <img
                            src={msg.senderProfilePic}
                            alt={msg.senderName || 'Agent'}
                            title={`View ${msg.senderName || 'Agent'}'s profile`}
                            className="w-6 h-6 rounded-full object-cover flex-shrink-0 mr-1.5 mb-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                            onClick={() => handleAgentClick(msg.senderName || 'Representative', msg.senderProfilePic)}
                          />
                        ) : (
                          <div
                            title={`View ${msg.senderName || 'Agent'}'s profile`}
                            className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-[10px] mr-1.5 mb-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                            style={{ backgroundColor: isDark ? '#2a3942' : '#e9edef', color: isDark ? '#00a884' : '#54656f' }}
                            onClick={() => handleAgentClick(msg.senderName || 'Representative', '')}
                          >
                            {(msg.senderName || widgetConfig.companyName).charAt(0).toUpperCase()}
                          </div>
                        )
                      )}

                      {/* Message bubble */}
                      <div className="relative max-w-[78%]">
                        {/* Hover reply button */}
                        {hoveredMessage === (msg._id || `local-${index}`) && (
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 ${isOut ? '-left-8' : '-right-8'} z-10 animate-fade-in`}
                            onMouseEnter={() => {
                              if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                              setHoveredMessage(msg._id || `local-${index}`);
                            }}
                            onMouseLeave={() => {
                              hoverTimeoutRef.current = setTimeout(() => setHoveredMessage(null), 300);
                            }}
                          >
                            <button
                              onClick={() => setReplyingTo(msg)}
                              className="p-1.5 rounded-full shadow-sm transition-colors"
                              style={{
                                backgroundColor: isDark ? '#2a3942' : 'white',
                                color: isDark ? '#8696a0' : '#54656f',
                                border: `1px solid ${darkTheme.borderColor}`
                              }}
                              title="Reply">
                              <CornerUpLeft size={13} />
                            </button>
                          </div>
                        )}

                        <div
                          className="px-3 py-2 shadow-sm"
                          style={{
                            backgroundColor: isOut ? (isDark ? '#005c4b' : '#d9fdd3') : (isDark ? '#202c33' : 'white'),
                            borderRadius: isOut ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                            minWidth: '60px',
                          }}
                        >
                          {/* Agent name */}
                          {!isOut && (
                            <span className="block text-[9px] font-semibold mb-0.5" style={{ color: primaryColor }}>
                              {msg.senderName || widgetConfig.companyName}
                            </span>
                          )}

                          {/* Reply quote */}
                          {msg.replyTo && !msg.isDeleted && (
                            <div
                              onClick={() => scrollToMessage(msg.replyTo.messageId)}
                              className="mb-1.5 rounded-md overflow-hidden cursor-pointer"
                              style={{
                                borderLeft: `3px solid ${primaryColor}`,
                                backgroundColor: isOut
                                  ? (isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.05)')
                                  : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                                padding: '5px 8px'
                              }}
                            >
                              <p className="text-[9px] font-semibold" style={{ color: primaryColor }}>
                                {msg.replyTo.sender === 'visitor' ? 'Me' : (msg.replyTo.senderName || widgetConfig.companyName)}
                              </p>
                              <p className="text-[10px] truncate" style={{ color: darkTheme.textSecondary }}>
                                {msg.replyTo.content || '📎 Attachment'}
                              </p>
                            </div>
                          )}

                          {/* File/image/audio */}
                          {msg.fileUrl && (
                            <div className="mb-1">
                              {msg.fileType === 'image' ? (
                                <img
                                  src={msg.fileUrl}
                                  alt="attachment"
                                  className="max-w-full rounded-md object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  style={{ maxHeight: '180px' }}
                                  onClick={() => setFullScreenImage(msg.fileUrl)}
                                />
                              ) : msg.fileType === 'audio' ? (
                                <AudioPlayer
                                  url={msg.fileUrl}
                                  primaryColor={primaryColor}
                                  isDark={isDark}
                                  darkTheme={darkTheme}
                                />
                              ) : (
                                <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
                                  className="flex items-center space-x-1.5 text-xs hover:opacity-80"
                                  style={{ color: primaryColor }}>
                                  <Paperclip size={13} /> <span>Download File</span>
                                </a>
                              )}
                            </div>
                          )}

                          {/* Message text */}
                          {msg.content && (
                            <p className={`text-sm leading-relaxed break-words ${msg.isDeleted ? 'italic' : ''}`}
                              style={{ color: msg.isDeleted ? darkTheme.textSecondary : (isDark ? '#e9edef' : '#111b21'), whiteSpace: 'pre-wrap' }}>
                              {msg.isDeleted && <span className="mr-1">🚫</span>}
                              {msg.content}
                              {msg.isEdited && !msg.isDeleted && (
                                <span className="text-[9px] ml-1" style={{ color: darkTheme.textSecondary }}>(edited)</span>
                              )}
                            </p>
                          )}

                          {/* Time + ticks */}
                          <div className="flex items-center justify-end mt-0.5 space-x-0.5">
                            <span className="text-[10px]" style={{ color: darkTheme.textSecondary }}>
                              {formatTime(msg.timestamp)}
                            </span>
                            {isOut && (
                              <span style={{ color: msg.status === 'read' ? '#53bdeb' : darkTheme.textSecondary }}>
                                {(!msg.status || msg.status === 'sent') && (
                                  <svg viewBox="0 0 16 15" width="13" height="13">
                                    <path d="M10.91 3.316l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879 2.44 7.753a.365.365 0 0 0-.51 0l-.432.432a.365.365 0 0 0 0 .511l2.56 2.56c.182.182.478.181.66-.001l6.43-8.082a.365.365 0 0 0-.068-.521z" fill="currentColor" />
                                  </svg>
                                )}
                                {(msg.status === 'delivered' || msg.status === 'read') && (
                                  <svg viewBox="0 0 16 15" width="15" height="15">
                                    <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.88a.32.32 0 0 1-.484.032l-.358-.325a.319.319 0 0 0-.484.032l-.378.48a.418.418 0 0 0 .036.54l1.32 1.267a.32.32 0 0 0 .484-.034l6.272-8a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879 2.44 7.752a.365.365 0 0 0-.51 0l-.432.432a.365.365 0 0 0 0 .511l2.56 2.56c.182.182.478.181.661-.001L10.95 3.84a.365.365 0 0 0-.039-.524z" fill="currentColor" />
                                  </svg>
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Visitor "Me" avatar */}
                      {isOut && (
                        <div
                          className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-white font-semibold text-[9px] ml-1.5 mb-0.5"
                          style={{ backgroundColor: primaryColor }}
                        >
                          Me
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Typing indicator */}
                {isMerchantTyping && (
                  <div className="flex justify-start items-end mb-1">
                    {typingAgent?.profilePic ? (
                      <img
                        src={typingAgent.profilePic}
                        alt={typingAgent.name}
                        className="w-6 h-6 rounded-full object-cover flex-shrink-0 mr-1.5 mb-0.5 cursor-pointer hover:opacity-80"
                        onClick={() => typingAgent && handleAgentClick(typingAgent.name, typingAgent.profilePic)}
                      />
                    ) : (
                      <div
                        className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-[10px] mr-1.5 mb-0.5 cursor-pointer hover:opacity-80"
                        style={{ backgroundColor: isDark ? '#2a3942' : '#e9edef', color: isDark ? '#00a884' : '#54656f' }}
                        onClick={() => typingAgent && handleAgentClick(typingAgent.name, '')}
                      >
                        {typingAgent ? typingAgent.name.charAt(0).toUpperCase() : 'A'}
                      </div>
                    )}
                    <div
                      className="px-3 py-2.5 shadow-sm"
                      style={{
                        backgroundColor: isDark ? '#202c33' : 'white',
                        borderRadius: '2px 10px 10px 10px',
                      }}
                    >
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 rounded-full typing-dot" style={{ backgroundColor: darkTheme.textSecondary }} />
                        <div className="w-2 h-2 rounded-full typing-dot" style={{ backgroundColor: darkTheme.textSecondary }} />
                        <div className="w-2 h-2 rounded-full typing-dot" style={{ backgroundColor: darkTheme.textSecondary }} />
                      </div>
                    </div>
                  </div>
                )}

                {isSessionEnded && (
                  <div className="flex justify-center my-3 animate-in fade-in duration-200">
                    <span className="text-[10px] px-2.5 py-1.5 rounded-md border border-red-500/20 text-red-500 bg-red-500/10 font-semibold shadow-xs">
                      🚫 This chat session has ended
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="flex-shrink-0" style={{ backgroundColor: isDark ? '#202c33' : '#f0f2f5' }}>
                {/* Branding "Powered by o-chat" */}
                <div className="flex justify-center pt-1.5 -mb-0.5 select-none opacity-60 hover:opacity-100 transition-opacity">
                  <a
                    href="https://o-chat.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] tracking-wide font-medium flex items-center space-x-0.5 hover:underline cursor-pointer"
                    style={{ color: darkTheme.textSecondary }}
                  >
                    <span>Powered by</span>
                    <span className="font-bold" style={{ color: primaryColor }}>o-chat</span>
                  </a>
                </div>

                {isSessionEnded ? (
                  <div className="flex flex-col items-center justify-center p-5 text-center space-y-2.5 border-t animate-fade-in"
                    style={{ borderColor: darkTheme.borderColor }}>
                    <p className="text-xs font-semibold" style={{ color: darkTheme.textSecondary }}>
                      This chat session has ended.
                    </p>
                    <button
                      onClick={handleStartNewSession}
                      className="px-6 py-2 rounded-lg text-white font-semibold text-xs shadow-md transition-all duration-200 hover:brightness-95 active:scale-[0.98] cursor-pointer"
                      style={{ backgroundColor: primaryColor }}
                    >
                      Start New Chat
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Emoji Picker */}
                    {showEmojiPicker && (
                      <div className="absolute bottom-[60px] left-1 z-50 shadow-2xl rounded-xl overflow-hidden"
                        style={{ border: `1px solid ${darkTheme.borderColor}` }}>
                        <EmojiPicker theme={isDark ? 'dark' : 'light'} onEmojiClick={onEmojiClick} height={300} width={280} searchDisabled />
                      </div>
                    )}

                    {/* Reply preview */}
                    {replyingTo && (
                      <div className="px-3 py-2 flex items-center justify-between"
                        style={{ backgroundColor: isDark ? '#2a3942' : '#ffffff', borderTop: `1px solid ${darkTheme.borderColor}` }}>
                        <div className="flex-1 rounded-md overflow-hidden"
                          style={{ borderLeft: `3px solid ${primaryColor}`, backgroundColor: isDark ? '#233138' : '#f5f5f5', padding: '5px 8px' }}>
                          <p className="text-[10px] font-semibold" style={{ color: primaryColor }}>
                            {replyingTo.sender === 'visitor' ? 'Me' : widgetConfig.companyName}
                          </p>
                          <p className="text-xs truncate" style={{ color: darkTheme.textSecondary }}>
                            {replyingTo.content || '📎 Attachment'}
                          </p>
                        </div>
                        <button onClick={() => setReplyingTo(null)} className="ml-2 p-1 rounded-full hover:opacity-75 transition-opacity"
                          style={{ color: darkTheme.textSecondary }}>
                          <X size={15} />
                        </button>
                      </div>
                    )}

                    {/* Input row */}
                    <div className="flex items-end space-x-2 px-2 py-2">
                      {isRecording ? (
                        <>
                          {/* Cancel Button */}
                          <button
                            onClick={cancelRecording}
                            className="p-2 text-red-500 hover:bg-red-500/10 rounded-full transition-all flex-shrink-0 mb-1 active:scale-95"
                            title="Discard recording"
                          >
                            <Trash2 size={22} />
                          </button>

                          {/* Recording Panel Capsule */}
                          <div
                            className="flex-1 flex items-center justify-between rounded-2xl px-3.5 py-2 min-h-[40px] shadow-inner"
                            style={{
                              backgroundColor: isDark ? '#2a3942' : 'white',
                              border: `1px solid ${darkTheme.borderColor}`
                            }}
                          >
                            <div className="flex items-center space-x-1.5 flex-shrink-0">
                              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                              <span
                                className="text-xs font-semibold tracking-wider tabular-nums"
                                style={{ color: isDark ? '#e9edef' : '#111b21' }}
                              >
                                {formatRecordingTime(recordingTime)}
                              </span>
                            </div>

                            {/* Dancing Waveform Visualizer */}
                            <div className="flex-1 flex items-center justify-center space-x-0.5 px-3 h-5">
                              {audioLevels.map((level, idx) => (
                                <div
                                  key={idx}
                                  className="w-0.75 bg-red-500 rounded-full transition-all duration-75"
                                  style={{ height: `${level}px`, minHeight: '3px' }}
                                />
                              ))}
                            </div>
                          </div>

                          {/* Stop & Send Button */}
                          <button
                            onClick={stopAndSendRecording}
                            style={{ backgroundColor: primaryColor }}
                            className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:brightness-95 transition-all shadow-md active:scale-95 flex-shrink-0 mb-1"
                            title="Send voice message"
                          >
                            <Send size={17} className="ml-0.5" />
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Input Capsule Layout */}
                          <div
                            className="flex-1 flex items-end rounded-2xl px-2 py-1 min-h-[40px] shadow-inner"
                            style={{
                              backgroundColor: isDark ? '#2a3942' : 'white',
                              border: `1px solid ${darkTheme.borderColor}`
                            }}
                          >
                            {/* Emoji Button */}
                            <button
                              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                              className="p-1.5 rounded-full hover:opacity-75 transition-opacity flex-shrink-0 mb-0.5"
                              style={{ color: showEmojiPicker ? primaryColor : darkTheme.iconColor }}
                            >
                              <Smile size={20} />
                            </button>

                            {/* Textarea */}
                            <textarea
                              ref={textareaRef}
                              rows={1}
                              value={inputMessage}
                              onChange={handleTyping}
                              onKeyDown={handleKeyDown}
                              placeholder="Type a message..."
                              className="flex-1 bg-transparent text-sm outline-none resize-none mx-2 max-h-[120px] py-1 wa-scroll"
                              style={{
                                border: 'none',
                                color: isDark ? '#e9edef' : '#111b21',
                              }}
                            />

                            {/* File Upload Button */}
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="p-1.5 rounded-full hover:opacity-75 transition-opacity flex-shrink-0 mb-0.5"
                              style={{ color: darkTheme.iconColor }}
                            >
                              <Paperclip size={20} />
                            </button>
                          </div>

                          {/* Send / Mic Button Toggle */}
                          {inputMessage.trim() ? (
                            <button
                              onClick={handleSendMessage}
                              style={{ backgroundColor: primaryColor }}
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:brightness-95 transition-all shadow-md active:scale-95 flex-shrink-0 mb-1"
                              title="Send message"
                            >
                              <Send size={17} className="ml-0.5" />
                            </button>
                          ) : (
                            <button
                              onClick={startRecording}
                              style={{ backgroundColor: primaryColor }}
                              className="w-10 h-10 rounded-full flex items-center justify-center text-white hover:brightness-95 transition-all shadow-md active:scale-95 flex-shrink-0 mb-1"
                              title="Record voice message"
                            >
                              <Mic size={17} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Launcher Button */}
      {!isOpen && (
        <div className={`relative flex ${isSideTab ? (isRight ? 'flex-row items-center' : 'flex-row-reverse items-center') : `flex-col ${isRight ? 'items-end' : 'items-start'}`}`}>
          {unreadMessage && (
            <div
              className={`${isSideTab ? (isRight ? 'mr-3' : 'ml-3') : 'mb-3'} px-4 py-2 rounded-2xl shadow-lg max-w-[220px] animate-bounce`}
              style={{ backgroundColor: 'white', border: '1px solid #e9edef' }}
            >
              <p className="text-sm text-gray-800 truncate">{unreadMessage}</p>
              <div className={`absolute ${isSideTab
                  ? `top-1/2 -translate-y-1/2 ${isRight ? '-right-1.5 border-t border-r' : '-left-1.5 border-b border-l'}`
                  : `-bottom-2 ${isRight ? 'right-5' : 'left-5'} border-b border-r`
                } w-3 h-3 transform rotate-45 bg-white border-gray-100`} />
            </div>
          )}

          {isSideTab ? (
            <button
              onClick={() => setIsOpen(true)}
              style={{ backgroundColor: primaryColor }}
              className={`flex flex-col items-center justify-center text-white shadow-xl hover:brightness-95 transition-all duration-200 border-t border-b border-white/15 ${isRight
                  ? 'rounded-l-2xl rounded-r-none border-l hover:-translate-x-0.5'
                  : 'rounded-r-2xl rounded-l-none border-r hover:translate-x-0.5'
                } py-4 px-2 w-9 active:scale-95`}
            >
              <MessageCircle size={18} className="mb-2" />
              <span
                style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
                className="text-[10px] font-semibold uppercase tracking-wider select-none whitespace-nowrap"
              >
                {widgetConfig.launcherText || 'Chat'}
              </span>
            </button>
          ) : (
            <button
              onClick={() => setIsOpen(true)}
              style={{ backgroundColor: primaryColor }}
              className={`flex items-center justify-center text-white shadow-lg hover:brightness-95 transition-all hover:scale-105 transform duration-200 ${widgetConfig.launcherType === 'text_and_icon'
                  ? 'px-5 py-3 rounded-full space-x-2 h-auto w-auto'
                  : 'w-14 h-14 rounded-full'
                }`}
            >
              <MessageCircle size={widgetConfig.launcherType === 'text_and_icon' ? 20 : 28} />
              {widgetConfig.launcherType === 'text_and_icon' && (
                <span className="text-sm font-semibold whitespace-nowrap pr-1">{widgetConfig.launcherText || 'Chat'}</span>
              )}
            </button>
          )}
        </div>
      )}

      {/* Full Screen Image Modal */}
      {fullScreenImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4"
          onClick={() => setFullScreenImage(null)}>
          <button
            className="absolute top-5 right-5 text-white hover:opacity-75 transition-opacity"
            onClick={(e) => { e.stopPropagation(); setFullScreenImage(null); }}>
            <X size={32} />
          </button>
          <img
            src={fullScreenImage}
            alt="Full screen preview"
            className="max-w-full max-h-full object-contain animate-slide-up rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

export default App;
