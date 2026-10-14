import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api, getAuthToken, getUserInfo } from '../services/api';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export default function InterviewRoom({ interviewId, user, onLeave, onInterviewCompleted }) {
  // Determine local participant from authenticated user
  const effectiveUser = user || getUserInfo() || {};
  const currentUserId = effectiveUser.id || effectiveUser.user_id;
  const currentUserRole = effectiveUser.role || 'candidate';
  const isInterviewer = currentUserRole === 'interviewer';

  // State: Room & Permissions
  const [permissionState, setPermissionState] = useState('prompt'); // 'prompt', 'granted', 'denied'
  const [permissionError, setPermissionError] = useState('');
  const [consentGranted, setConsentGranted] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(true);
  const [otherPeerConsent, setOtherPeerConsent] = useState(false);

  // State: Live Session Data
  const [interviewData, setInterviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [connectionStatusText, setConnectionStatusText] = useState('Connecting to room...');
  const [remoteParticipant, setRemoteParticipant] = useState(null);
  const [hasRemoteMedia, setHasRemoteMedia] = useState(false);

  // State: Media & Controls
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingUploading, setRecordingUploading] = useState(false);

  // State: Questions
  const [questions, setQuestions] = useState([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState(null);

  // State: Duration Timer
  const [durationSecs, setDurationSecs] = useState(0);

  // State: In-room chat
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [activeSideTab, setActiveSideTab] = useState('questions'); // Interviewer: 'questions'|'chat', Candidate: 'chat'

  // State: Live Speech-to-Text Transcript Turns & Recognition State
  const [liveTranscriptTurns, setLiveTranscriptTurns] = useState([]);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isSpeechListening, setIsSpeechListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [speechStatusNotice, setSpeechStatusNotice] = useState('');

  const liveSpeechRecognizerRef = useRef(null);
  const liveTranscriptTurnsRef = useRef([]);
  const isRecognizingActiveRef = useRef(false);
  const isAudioMutedRef = useRef(false);
  const durationSecsRef = useRef(0);
  const activeQuestionRef = useRef(null);
  const currentQuestionIdxRef = useRef(0);
  const questionsRef = useRef([]);

  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const pcRef = useRef(null);
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const timerRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);

  // For candidates, default side tab to chat
  useEffect(() => {
    if (!isInterviewer) {
      setActiveSideTab('chat');
    }
  }, [isInterviewer]);

  // Keep refs synchronized with state to prevent stale closures
  useEffect(() => {
    isAudioMutedRef.current = isAudioMuted;
  }, [isAudioMuted]);

  useEffect(() => {
    durationSecsRef.current = durationSecs;
  }, [durationSecs]);

  useEffect(() => {
    activeQuestionRef.current = activeQuestion;
  }, [activeQuestion]);

  useEffect(() => {
    currentQuestionIdxRef.current = currentQuestionIdx;
  }, [currentQuestionIdx]);

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    liveTranscriptTurnsRef.current = liveTranscriptTurns;
  }, [liveTranscriptTurns]);

  // 1. Initial Load & Session Fetch
  useEffect(() => {
    fetchInterviewDetails();
    return () => {
      cleanupSession();
    };
  }, [interviewId]);

  // Ref Callbacks ensuring instant, reliable video and audio binding upon DOM mount
  const setLocalVideoRef = useCallback((node) => {
    localVideoRef.current = node;
    if (node && localStreamRef.current) {
      if (node.srcObject !== localStreamRef.current) {
        node.srcObject = localStreamRef.current;
      }
      node.muted = true;
      node.play().catch(e => console.warn('Local video autoPlay notice:', e));
    }
  }, []);

  const setRemoteVideoRef = useCallback((node) => {
    remoteVideoRef.current = node;
    if (node && remoteStreamRef.current) {
      if (node.srcObject !== remoteStreamRef.current) {
        node.srcObject = remoteStreamRef.current;
      }
      node.play().catch(e => console.warn('Remote video autoPlay notice:', e));
    }
  }, []);

  const setRemoteAudioRef = useCallback((node) => {
    remoteAudioRef.current = node;
    if (node && remoteStreamRef.current) {
      if (node.srcObject !== remoteStreamRef.current) {
        node.srcObject = remoteStreamRef.current;
      }
      node.play().catch(e => console.warn('Remote audio autoPlay notice:', e));
    }
  }, []);

  // Ensure video and audio elements stay bound
  useEffect(() => {
    if (!isInterviewer && localVideoRef.current && localStreamRef.current) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(e => console.warn('Local preview keepalive notice:', e));
    }
  }, [permissionState, showConsentModal, isInterviewer]);

  useEffect(() => {
    if (isInterviewer && remoteVideoRef.current && remoteStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      remoteVideoRef.current.play().catch(e => console.warn('Remote video keepalive notice:', e));
    } else if (!isInterviewer && remoteAudioRef.current && remoteStreamRef.current) {
      if (remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
      }
      remoteAudioRef.current.play().catch(e => console.warn('Remote audio keepalive notice:', e));
    }
  }, [hasRemoteMedia, isInterviewer]);

  // 2. Duration Timer
  useEffect(() => {
    if (permissionState === 'granted') {
      timerRef.current = setInterval(() => {
        setDurationSecs(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [permissionState]);

  const fetchInterviewDetails = async () => {
    try {
      setLoading(true);
      const data = await api.getInterviewDetail(interviewId);
      setInterviewData(data);
      if (data.questions && data.questions.length > 0) {
        if (isInterviewer) {
          setQuestions(data.questions);
          const idx = data.current_question_index || 0;
          setCurrentQuestionIdx(idx);
          setActiveQuestion(data.questions[idx] || data.questions[0]);
        } else {
          // Candidate receives only current question, never the complete question list
          const idx = data.current_question_index || 0;
          setCurrentQuestionIdx(idx);
          setActiveQuestion(data.questions[idx] || data.questions[0]);
          setQuestions([]); // Empty for candidate to guarantee no leaks
        }
      }
      if (data.recording_consent_candidate && currentUserRole === 'candidate') {
        setConsentGranted(true);
      }
      if (data.recording_consent_interviewer && currentUserRole === 'interviewer') {
        setConsentGranted(true);
      }
    } catch (err) {
      console.error('Failed to load interview details:', err);
    } finally {
      setLoading(false);
    }
  };

  // 3. Request Camera & Mic Permissions
  const handleRequestPermissionsAndJoin = async () => {
    try {
      setPermissionError('');
      let stream;
      if (isInterviewer) {
        // Interviewer: Audio only (Camera not required)
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
      } else {
        // Candidate: Camera + Microphone enabled
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
          audio: true
        });
      }

      localStreamRef.current = stream;

      // Candidate binds local camera preview immediately
      if (!isInterviewer && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        localVideoRef.current.play().catch(e => console.warn('Local preview autoPlay notice:', e));
      }

      setPermissionState('granted');
      setShowConsentModal(false);
      setConnectionStatusText('Connecting to signaling server...');

      // Notify backend that session is in progress if start_time not set
      try {
        await api.updateInterviewSession(interviewId, {
          status: 'in_progress',
          start_time: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Session start notification notice:', e);
      }

      // Record consent on server
      if (consentGranted) {
        try {
          await api.setRecordingConsent(interviewId, true);
        } catch (e) {
          console.warn('Consent save notice:', e);
        }
      }

      // Start Recording if user granted consent
      if (consentGranted) {
        startLocalRecording(stream);
      }

      // Automatically start live speech recognition for dialogue transcription
      startLiveSpeechRecognition();

      // Initialize WebSocket and WebRTC
      initWebSocketAndWebRTC(stream);

    } catch (err) {
      console.error('Media permission error:', err);
      setPermissionState('denied');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError(
          isInterviewer
            ? 'Microphone access was denied. Please allow microphone permissions in your browser settings and try again.'
            : 'Camera and Microphone access was denied. Please allow camera and microphone permissions in your browser settings and try again.'
        );
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionError(
          isInterviewer
            ? 'No microphone found on your device. Please attach a microphone to join.'
            : 'No camera or microphone found on your device. Please attach devices to join.'
        );
      } else {
        setPermissionError(err.message || 'Could not access media devices.');
      }
    }
  };

  // 4. WebSocket & WebRTC Setup
  const initWebSocketAndWebRTC = (stream) => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }

    const token = getAuthToken();
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//127.0.0.1:8000/api/ws/interview/${interviewId}?token=${token}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsConnected(true);
      setConnectionStatusText('Connected to room. Waiting for peer...');
      // Broadcast current consent state
      if (consentGranted) {
        ws.send(JSON.stringify({ type: 'recording-consent', consent: true }));
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      setPeerConnected(false);
      setConnectionStatusText('Signaling disconnected');
    };

    ws.onerror = (e) => {
      console.error('WebSocket connection error:', e);
      setWsConnected(false);
      setConnectionStatusText('Connection error');
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleSignalingMessage(msg, stream);
      } catch (e) {
        console.error('Error handling WebSocket message:', e);
      }
    };
  };

  const createPeerConnection = (stream) => {
    if (pcRef.current && pcRef.current.signalingState !== 'closed') {
      return pcRef.current;
    }

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    const currentStream = stream || localStreamRef.current;

    if (isInterviewer) {
      // Interviewer sends audio only
      if (currentStream) {
        currentStream.getAudioTracks().forEach(track => {
          pc.addTrack(track, currentStream);
        });
      }
      // Interviewer transceives video in recvonly mode
      try {
        pc.addTransceiver('video', { direction: 'recvonly' });
      } catch (e) {
        console.warn('Transceiver recvonly video notice:', e);
      }
    } else {
      // Candidate sends audio and video
      if (currentStream) {
        currentStream.getTracks().forEach(track => {
          pc.addTrack(track, currentStream);
        });
      }
    }

    // Handle incoming remote tracks
    pc.ontrack = (event) => {
      console.log('WebRTC remote track received:', event.track.kind);
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      if (!remoteStreamRef.current.getTracks().some(t => t.id === event.track.id)) {
        remoteStreamRef.current.addTrack(event.track);
      }

      setHasRemoteMedia(true);

      if (isInterviewer) {
        // Interviewer displays candidate's live video and plays audio
        if (remoteVideoRef.current) {
          if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
          }
          remoteVideoRef.current.play().catch(e => console.warn('Remote video playback autoPlay notice:', e));
        }
      } else {
        // Candidate plays interviewer's incoming audio
        if (remoteAudioRef.current) {
          if (remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
            remoteAudioRef.current.srcObject = remoteStreamRef.current;
          }
          remoteAudioRef.current.play().catch(e => console.warn('Remote audio playback autoPlay notice:', e));
        }
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          data: event.candidate
        }));
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE Connection State:', pc.iceConnectionState);
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setPeerConnected(true);
        setConnectionStatusText('Live Call Connected');
      } else if (pc.iceConnectionState === 'disconnected') {
        setConnectionStatusText('Peer disconnected temporarily...');
      } else if (pc.iceConnectionState === 'failed') {
        setPeerConnected(false);
        setConnectionStatusText('Connection failed. Retrying...');
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('Peer Connection State:', pc.connectionState);
      if (pc.connectionState === 'connected') {
        setPeerConnected(true);
        setConnectionStatusText('Live Call Connected');
      } else if (pc.connectionState === 'connecting') {
        setConnectionStatusText('Establishing peer stream...');
      } else if (pc.connectionState === 'disconnected') {
        setPeerConnected(false);
        setConnectionStatusText('Peer disconnected temporarily...');
      } else if (pc.connectionState === 'failed') {
        setPeerConnected(false);
        setConnectionStatusText(isInterviewer ? 'Waiting for Candidate...' : 'Waiting for Interviewer...');
      }
    };

    return pc;
  };

  const drainPendingIceCandidates = async (pc) => {
    if (pendingIceCandidatesRef.current.length > 0) {
      console.log(`Draining ${pendingIceCandidatesRef.current.length} buffered ICE candidates`);
      for (const candidate of pendingIceCandidatesRef.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.warn('Error adding buffered ICE candidate:', e);
        }
      }
      pendingIceCandidatesRef.current = [];
    }
  };

  const handleSignalingMessage = async (msg, stream) => {
    // Prevent processing signaling packets sent by self
    if (msg.sender_id && currentUserId && msg.sender_id === currentUserId) {
      return;
    }

    const pc = pcRef.current || createPeerConnection(stream);

    switch (msg.type) {
      case 'room-state': {
        const otherParticipants = (msg.participants || []).filter(p => !currentUserId || p.user_id !== currentUserId);
        if (otherParticipants.length > 0) {
          const peer = otherParticipants[0];
          setRemoteParticipant(peer);
          setConnectionStatusText(`Connecting to ${peer.user_name}...`);
          // Initiate WebRTC offer to existing participant
          initiateOffer(pc);
        } else {
          setRemoteParticipant(null);
          setConnectionStatusText(isInterviewer ? 'Waiting for Candidate to join...' : 'Waiting for Interviewer to join...');
        }
        break;
      }

      case 'peer-joined': {
        if (currentUserId && msg.user_id === currentUserId) return;
        setRemoteParticipant({
          user_id: msg.user_id,
          user_name: msg.user_name,
          user_role: msg.user_role
        });
        setConnectionStatusText(`${msg.user_name} joined. Establishing peer stream...`);
        break;
      }

      case 'peer-left': {
        if (currentUserId && msg.user_id === currentUserId) return;
        setRemoteParticipant(null);
        setPeerConnected(false);
        setHasRemoteMedia(false);
        remoteStreamRef.current = null;
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
        setConnectionStatusText('Peer left the room');
        break;
      }

      case 'offer': {
        try {
          setConnectionStatusText('Incoming peer connection offer...');
          await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
          await drainPendingIceCandidates(pc);

          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'answer',
              data: answer
            }));
          }
        } catch (e) {
          console.error('Error handling WebRTC offer:', e);
        }
        break;
      }

      case 'answer': {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(msg.data));
          await drainPendingIceCandidates(pc);
        } catch (e) {
          console.error('Error handling WebRTC answer:', e);
        }
        break;
      }

      case 'ice-candidate': {
        try {
          if (msg.data) {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(msg.data));
            } else {
              pendingIceCandidatesRef.current.push(msg.data);
            }
          }
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
        break;
      }

      case 'question-nav': {
        // Synchronized in real time by the interviewer
        if (msg.question_index !== undefined) {
          setCurrentQuestionIdx(msg.question_index);
        }
        if (msg.question) {
          setActiveQuestion(msg.question);
        } else if (questions.length > 0 && msg.question_index !== undefined && questions[msg.question_index]) {
          setActiveQuestion(questions[msg.question_index]);
        }
        break;
      }

      case 'recording-consent': {
        if (!currentUserId || msg.user_id !== currentUserId) {
          setOtherPeerConsent(msg.consent);
        }
        break;
      }

      case 'chat-message': {
        if (!currentUserId || msg.sender_id !== currentUserId) {
          setChatMessages(prev => [...prev, msg]);
        }
        break;
      }

      case 'session-status': {
        if (msg.status === 'completed') {
          handleInterviewEndWorkflow(false);
        }
        break;
      }

      case 'transcript-turn': {
        if (msg.turn) {
          setLiveTranscriptTurns(prev => [...prev, msg.turn]);
        }
        break;
      }

      default:
        break;
    }
  };

  const initiateOffer = async (pc) => {
    try {
      const offerOptions = isInterviewer
        ? { offerToReceiveAudio: true, offerToReceiveVideo: true }
        : { offerToReceiveAudio: true, offerToReceiveVideo: false };

      const offer = await pc.createOffer(offerOptions);
      await pc.setLocalDescription(offer);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'offer',
          data: offer
        }));
      }
    } catch (e) {
      console.error('Error initiating WebRTC offer:', e);
    }
  };

  // 5. Media Control Toggles
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      if (audioTracks.length > 0) {
        const nextState = !isAudioMuted;
        audioTracks[0].enabled = !nextState;
        setIsAudioMuted(nextState);
        isAudioMutedRef.current = nextState;

        if (nextState) {
          // Mic muted -> stop speech recognizer
          if (liveSpeechRecognizerRef.current) {
            try {
              liveSpeechRecognizerRef.current.stop();
            } catch (e) {}
          }
          setIsSpeechListening(false);
          setInterimTranscript('');
        } else {
          // Mic unmuted -> resume speech recognizer
          startLiveSpeechRecognition();
        }

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'media-state',
            audio_enabled: !nextState,
            video_enabled: !isVideoMuted
          }));
        }
      }
    }
  };

  const toggleVideo = () => {
    if (!isInterviewer && localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      if (videoTracks.length > 0) {
        const nextState = !isVideoMuted;
        videoTracks[0].enabled = !nextState;
        setIsVideoMuted(nextState);

        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'media-state',
            audio_enabled: !isAudioMuted,
            video_enabled: !nextState
          }));
        }
      }
    }
  };


  // 7. Question Navigation (Interviewer Control Only)
  const handleNextQuestion = async () => {
    if (!isInterviewer) return;
    if (currentQuestionIdx < questions.length - 1) {
      const nextIdx = currentQuestionIdx + 1;
      setCurrentQuestionIdx(nextIdx);
      const nextQ = questions[nextIdx];
      setActiveQuestion(nextQ);

      // Broadcast to candidate via WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'question-nav',
          question_index: nextIdx,
          question: {
            id: nextQ.id,
            question_text: nextQ.question_text,
            category: nextQ.category,
            difficulty: nextQ.difficulty,
            order_index: nextQ.order_index
          }
        }));
      }

      // Save to backend
      try {
        await api.updateInterviewSession(interviewId, {
          current_question_index: nextIdx
        });
      } catch (e) {
        console.warn('Question index save notice:', e);
      }
    }
  };

  const handlePrevQuestion = async () => {
    if (!isInterviewer) return;
    if (currentQuestionIdx > 0) {
      const prevIdx = currentQuestionIdx - 1;
      setCurrentQuestionIdx(prevIdx);
      const prevQ = questions[prevIdx];
      setActiveQuestion(prevQ);

      // Broadcast to candidate via WebSocket
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'question-nav',
          question_index: prevIdx,
          question: {
            id: prevQ.id,
            question_text: prevQ.question_text,
            category: prevQ.category,
            difficulty: prevQ.difficulty,
            order_index: prevQ.order_index
          }
        }));
      }

      // Save to backend
      try {
        await api.updateInterviewSession(interviewId, {
          current_question_index: prevIdx
        });
      } catch (e) {
        console.warn('Question index save notice:', e);
      }
    }
  };

  const handleSelectQuestionByIndex = async (idx) => {
    if (!isInterviewer) return;
    if (idx >= 0 && idx < questions.length) {
      setCurrentQuestionIdx(idx);
      const targetQ = questions[idx];
      setActiveQuestion(targetQ);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'question-nav',
          question_index: idx,
          question: {
            id: targetQ.id,
            question_text: targetQ.question_text,
            category: targetQ.category,
            difficulty: targetQ.difficulty,
            order_index: targetQ.order_index
          }
        }));
      }

      try {
        await api.updateInterviewSession(interviewId, {
          current_question_index: idx
        });
      } catch (e) {
        console.warn('Question index save notice:', e);
      }
    }
  };

  // 8. In-room Chat
  const handleSendChatMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    wsRef.current.send(JSON.stringify({
      type: 'chat-message',
      text: chatInput.trim()
    }));

    setChatMessages(prev => [
      ...prev,
      {
        sender_id: currentUserId,
        sender_name: effectiveUser.full_name || 'You',
        sender_role: currentUserRole,
        text: chatInput.trim(),
        timestamp: new Date().toISOString()
      }
    ]);
    setChatInput('');
  };

  // Helper: Format duration seconds to MM:SS
  function formatDuration(secs) {
    const s = typeof secs === 'number' && !isNaN(secs) ? secs : 0;
    const mins = Math.floor(s / 60);
    const remainderSecs = s % 60;
    return `${mins.toString().padStart(2, '0')}:${remainderSecs.toString().padStart(2, '0')}`;
  }

  // 9. Speech-to-Text & Recording Functions
  const startLiveSpeechRecognition = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setSpeechStatusNotice('Web Speech API is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
      return;
    }

    // Stop existing recognizer instance if active
    if (liveSpeechRecognizerRef.current) {
      try {
        liveSpeechRecognizerRef.current.abort();
      } catch (e) {}
      liveSpeechRecognizerRef.current = null;
    }

    try {
      const recognizer = new SpeechRecognition();
      recognizer.continuous = true;
      recognizer.interimResults = true;
      recognizer.lang = 'en-US';
      recognizer.maxAlternatives = 1;

      recognizer.onstart = () => {
        setIsSpeechListening(true);
        setSpeechStatusNotice('');
      };

      recognizer.onresult = (event) => {
        let interimText = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const res = event.results[i];
          const spokenText = res[0] ? res[0].transcript.trim() : '';

          if (res.isFinal) {
            if (spokenText) {
              const timestamp = formatDuration(durationSecsRef.current);
              const currentQ = activeQuestionRef.current || (questionsRef.current.length > 0 ? questionsRef.current[currentQuestionIdxRef.current] : null);

              const newTurn = {
                speaker: isInterviewer ? 'interviewer' : 'candidate',
                speaker_name: effectiveUser?.full_name || (isInterviewer ? 'Interviewer' : 'Candidate'),
                text: spokenText,
                timestamp: timestamp,
                question_id: currentQ?.id || (currentQuestionIdxRef.current + 1)
              };

              setLiveTranscriptTurns((prev) => {
                const updated = [...prev, newTurn];
                liveTranscriptTurnsRef.current = updated;
                return updated;
              });

              setInterimTranscript('');

              if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                  type: 'transcript-turn',
                  turn: newTurn
                }));
              }
            }
          } else {
            interimText += (res[0] ? res[0].transcript : '') + ' ';
          }
        }

        if (interimText.trim()) {
          setInterimTranscript(interimText.trim());
        }
      };

      recognizer.onerror = (e) => {
        console.warn('Live SpeechRecognition event notice:', e.error);
        if (e.error === 'not-allowed') {
          setSpeechStatusNotice('Microphone access for speech recognition was blocked.');
          setIsSpeechListening(false);
        } else if (e.error === 'service-not-allowed') {
          setSpeechStatusNotice('Speech recognition service blocked by browser.');
          setIsSpeechListening(false);
        }
      };

      recognizer.onend = () => {
        setIsSpeechListening(false);
        // Chrome automatically ends recognition on silence. Auto-restart if session active and unmuted.
        if (isRecognizingActiveRef.current && !isAudioMutedRef.current) {
          try {
            recognizer.start();
            setIsSpeechListening(true);
          } catch (err) {
            setTimeout(() => {
              if (isRecognizingActiveRef.current && !isAudioMutedRef.current) {
                try {
                  recognizer.start();
                  setIsSpeechListening(true);
                } catch (e) {}
              }
            }, 300);
          }
        }
      };

      recognizer.start();
      isRecognizingActiveRef.current = true;
      liveSpeechRecognizerRef.current = recognizer;
      setIsSpeechListening(true);
    } catch (e) {
      console.warn('Could not initialize live speech recognition:', e);
      setSpeechStatusNotice('Could not start speech recognition: ' + (e.message || 'unknown'));
    }
  }, [effectiveUser?.full_name, isInterviewer]);

  const startLocalRecording = (stream) => {
    try {
      recordedChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.warn('Local recording start notice:', err);
    }
  };

  const stopAndUploadRecording = async () => {
    try {
      isRecognizingActiveRef.current = false;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {}
      }
      if (liveSpeechRecognizerRef.current) {
        try {
          liveSpeechRecognizerRef.current.abort();
        } catch (e) {}
        liveSpeechRecognizerRef.current = null;
      }
      setIsSpeechListening(false);

      if (recordedChunksRef.current.length > 0) {
        const mimeType = recordedChunksRef.current[0].type || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        if (blob.size > 500) {
          await api.uploadRecording(interviewId, blob, `interview_${interviewId}_recording.webm`);
        }
      }

      const turnsToSave = liveTranscriptTurnsRef.current.length > 0 ? liveTranscriptTurnsRef.current : liveTranscriptTurns;
      if (turnsToSave.length > 0) {
        await api.loadTranscriptAndAnalyze(interviewId, {
          transcript: turnsToSave,
          is_sample: false
        });
      }
    } catch (err) {
      console.warn('Recording/transcription upload error:', err);
    }
  };

  // 10. End Interview Session
  const handleEndInterview = async () => {
    const confirmPrompt = isInterviewer
      ? 'Are you sure you want to end this interview session? This will complete the call for both participants.'
      : 'Are you sure you want to leave this interview call?';
    const confirmEnd = window.confirm(confirmPrompt);
    if (!confirmEnd) return;

    await handleInterviewEndWorkflow(isInterviewer);
  };

  const handleInterviewEndWorkflow = async (isInitiator) => {
    try {
      setRecordingUploading(true);

      // If initiator (interviewer), broadcast completion to room
      if (isInitiator && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'session-status',
          status: 'completed'
        }));
      }

      // Upload recording if available
      await stopAndUploadRecording();

      // Only interviewer updates session status to completed
      if (isInitiator) {
        const endTime = new Date().toISOString();
        await api.updateInterviewSession(interviewId, {
          status: 'completed',
          end_time: endTime,
          current_question_index: currentQuestionIdx,
          session_metadata: {
            duration_seconds: durationSecs,
            completed_by: currentUserId,
            questions_covered: currentQuestionIdx + 1,
            total_questions: questions.length
          }
        });
      }

      cleanupSession();

      if (onInterviewCompleted) {
        onInterviewCompleted();
      } else if (onLeave) {
        onLeave();
      }
    } catch (err) {
      console.error('Error during interview end workflow:', err);
      cleanupSession();
      if (onLeave) onLeave();
    } finally {
      setRecordingUploading(false);
    }
  };

  const cleanupSession = () => {
    isRecognizingActiveRef.current = false;
    if (liveSpeechRecognizerRef.current) {
      try {
        liveSpeechRecognizerRef.current.abort();
      } catch (e) {}
      liveSpeechRecognizerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {}
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  // Determine current active question
  const currentQ = activeQuestion || (questions.length > 0 ? questions[currentQuestionIdx] : null);

  // ----------------- PRE-CALL PERMISSION & CONSENT MODAL -----------------
  if (showConsentModal && permissionState !== 'granted') {
    return (
      <div className="modal-backdrop">
        <div className="modal-content" style={{ maxWidth: '580px', padding: '2rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.75rem',
              margin: '0 auto 1rem auto'
            }}>
              {isInterviewer ? 'Audio Console' : 'Video Room'}
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.5rem' }}>
              {isInterviewer ? 'Join Interviewer Console' : 'Join Video Interview Room'}
            </h2>
            <p style={{ fontSize: '0.9rem', color: '#64748b' }}>
              {interviewData?.title || 'Technical Interview Session'} ({interviewData?.job_role || 'Candidate Assessment'})
            </p>
          </div>

          {permissionError && (
            <div className="alert alert-error" style={{ marginBottom: '1.25rem', fontSize: '0.85rem' }}>
              {permissionError}
            </div>
          )}

          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h4 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.75rem' }}>
              Device Requirements & Session Setup:
            </h4>
            <ul style={{ fontSize: '0.85rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '1.25rem' }}>
              {isInterviewer ? (
                <>
                  <li>Your browser will request access to your <strong>Microphone</strong> for two-way conversation. Camera is not required.</li>
                  <li>The candidate's live video and audio will stream directly to your screen.</li>
                  <li>Manage questions, observe responses, and conduct evaluations in real time.</li>
                </>
              ) : (
                <>
                  <li>Your browser will request permission for your <strong>Camera</strong> and <strong>Microphone</strong>.</li>
                  <li>Your video and audio will stream live to the interviewer securely over WebRTC.</li>
                  <li>You will hear the interviewer speaking and view active interview questions on screen.</li>
                </>
              )}
            </ul>

            {/* Recording Consent Checkbox */}
            <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #e2e8f0' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={consentGranted}
                  onChange={(e) => setConsentGranted(e.target.checked)}
                  style={{ width: '18px', height: '18px', marginTop: '2px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.85rem', color: '#0f172a', lineHeight: 1.4 }}>
                  <strong>I give explicit consent</strong> to record this interview session audio and video for evaluation and analysis purposes.
                </span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={onLeave}>
              Cancel & Back
            </button>
            <button
              className="btn btn-primary"
              onClick={handleRequestPermissionsAndJoin}
            >
              Allow & Enter Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ----------------- LIVE INTERVIEW ROOM INTERFACE -----------------
  return (
    <div className="interview-room-container">
      {/* Top Session Bar */}
      <header className="room-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={onLeave} title="Back to dashboard">
            ← Dashboard
          </button>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.2 }}>
              {interviewData?.title || 'Live Interview Room'}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#64748b' }}>
              <span>Role: <strong>{interviewData?.job_role}</strong></span>
              <span>•</span>
              <span>Interviewer: <strong>{interviewData?.interviewer_name || 'Assigned Interviewer'}</strong></span>
              <span>•</span>
              <span>Candidate: <strong>{interviewData?.candidate_name || 'Candidate'}</strong></span>
            </div>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {/* Recording Badge */}
          {isRecording && (
            <div className="recording-badge" title="Session is being recorded with consent">
              <span className="recording-dot"></span>
              <span>REC {formatDuration(durationSecs)}</span>
            </div>
          )}

          {/* Connection Status */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: peerConnected ? '#f0fdf4' : '#fffbeb',
            color: peerConnected ? '#15803d' : '#b45309',
            border: `1px solid ${peerConnected ? '#bbf7d0' : '#fde68a'}`
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: peerConnected ? '#22c55e' : '#f59e0b'
            }}></span>
            <span>{peerConnected ? 'Live Connected' : wsConnected ? 'Waiting for Peer...' : 'Connecting...'}</span>
          </div>

          {/* Call End / Leave Button */}
          <button
            className="btn btn-sm"
            style={{ backgroundColor: '#dc2626', color: '#ffffff', fontWeight: 600 }}
            onClick={handleEndInterview}
            disabled={recordingUploading}
          >
            {recordingUploading ? 'Saving...' : isInterviewer ? 'End Interview' : 'Leave Call'}
          </button>
        </div>
      </header>

      {/* Main Room Body: Videos & Sidebar */}
      <div className="room-body">
        {/* Video Stage */}
        <div className="room-video-stage">
          {/* Current Question Display (Prominent for Interviewer, Clean Active Panel for Candidate) */}
          {currentQ ? (
            <div className="room-question-banner">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className="badge badge-role" style={{ fontSize: '0.7rem' }}>
                    {isInterviewer
                      ? `Question ${currentQuestionIdx + 1} of ${questions.length}`
                      : 'Active Question'}
                  </span>
                  {currentQ.category && (
                    <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.7rem' }}>
                      {currentQ.category}
                    </span>
                  )}
                  {isInterviewer && currentQ.difficulty && (
                    <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.7rem' }}>
                      {currentQ.difficulty}
                    </span>
                  )}
                </div>

                {/* Only Interviewer gets Prev/Next navigation controls */}
                {isInterviewer && (
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      onClick={handlePrevQuestion}
                      disabled={currentQuestionIdx === 0}
                      title="Previous Question"
                    >
                      ◀ Prev
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ padding: '2px 8px', fontSize: '0.75rem' }}
                      onClick={handleNextQuestion}
                      disabled={currentQuestionIdx >= questions.length - 1}
                      title="Next Question"
                    >
                      Next ▶
                    </button>
                  </div>
                )}
              </div>
              <p style={{ fontSize: '0.95rem', fontWeight: 600, color: '#0f172a', margin: 0, lineHeight: 1.4 }}>
                "{currentQ.question_text}"
              </p>

              {/* Candidate Live Spoken Caption Bar */}
              {!isInterviewer && (
                <div style={{
                  marginTop: '0.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.4rem',
                  background: isAudioMuted ? '#f8fafc' : '#eff6ff',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${isAudioMuted ? '#e2e8f0' : '#bfdbfe'}`
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span
                        className="recording-dot"
                        style={{
                          backgroundColor: isAudioMuted ? '#94a3b8' : isSpeechListening ? '#22c55e' : '#f59e0b',
                          boxShadow: isSpeechListening && !isAudioMuted ? '0 0 6px rgba(34, 197, 94, 0.7)' : 'none'
                        }}
                      ></span>
                      <span style={{ fontWeight: 700, color: isAudioMuted ? '#64748b' : '#1e40af' }}>
                        {isAudioMuted
                          ? 'Microphone Muted (Speech Recognition Paused)'
                          : isSpeechListening
                          ? 'Microphone Active & Transcribing'
                          : 'Speech Recognition Ready'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ color: '#64748b' }}>
                        {liveTranscriptTurns.length} answer turn{liveTranscriptTurns.length === 1 ? '' : 's'} recorded
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveSideTab('transcript')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#2563eb',
                          fontWeight: 600,
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '0.75rem',
                          textDecoration: 'underline'
                        }}
                      >
                        View Transcript
                      </button>
                    </div>
                  </div>

                  {/* Active speech line (interim or latest turn) */}
                  <div style={{ fontSize: '0.85rem', color: '#0f172a', minHeight: '22px', display: 'flex', alignItems: 'center' }}>
                    {interimTranscript ? (
                      <span style={{ color: '#2563eb', fontWeight: 500 }}>
                        <span style={{ fontStyle: 'italic', opacity: 0.85 }}>Speaking now: </span>
                        "{interimTranscript}..."
                      </span>
                    ) : liveTranscriptTurns.length > 0 && liveTranscriptTurns[liveTranscriptTurns.length - 1].speaker === 'candidate' ? (
                      <span style={{ color: '#1e293b' }}>
                        <span style={{ fontWeight: 600, color: '#16a34a', fontSize: '0.75rem' }}>Transcribed: </span>
                        "{liveTranscriptTurns[liveTranscriptTurns.length - 1].text}"
                      </span>
                    ) : (
                      <span style={{ color: '#64748b', fontStyle: 'italic', fontSize: '0.8rem' }}>
                        {isAudioMuted
                          ? 'Click Unmute below to begin speaking your answer.'
                          : speechStatusNotice || 'Speak your answer clearly into your microphone...'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="room-question-banner" style={{ background: '#f8fafc', borderLeft: '4px solid #cbd5e1' }}>
              <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                {isInterviewer
                  ? 'No questions loaded for this interview session.'
                  : 'The interviewer will present the active question here.'}
              </p>
            </div>
          )}

          {/* One-Way Video Interview Display */}
          {isInterviewer ? (
            /* =================== INTERVIEWER VIEW =================== */
            /* Displays candidate's live video and plays candidate audio */
            <div className="video-card-main">
              <video
                ref={setRemoteVideoRef}
                autoPlay
                playsInline
                className={`video-feed ${hasRemoteMedia ? 'active-feed' : 'waiting-feed'}`}
                onLoadedMetadata={(e) => {
                  e.target.play().catch(err => console.warn('Candidate video playback autoPlay notice:', err));
                }}
              />

              {!hasRemoteMedia && (
                <div className="video-placeholder">
                  <div className="avatar-placeholder">
                    {interviewData?.candidate_name ? interviewData.candidate_name.charAt(0).toUpperCase() : 'C'}
                  </div>
                  <div style={{ color: '#ffffff', fontWeight: 600, fontSize: '1.05rem', marginTop: '0.85rem' }}>
                    {interviewData?.candidate_name || 'Candidate'}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.4rem', maxWidth: '320px' }}>
                    {peerConnected ? 'Receiving candidate media stream...' : connectionStatusText}
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.75rem', padding: '4px 12px', borderRadius: '12px', background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', fontSize: '0.75rem' }}>
                    <span className="recording-dot" style={{ backgroundColor: peerConnected ? '#22c55e' : '#f59e0b' }}></span>
                    {peerConnected ? 'WebRTC connection established' : 'Waiting for candidate camera stream'}
                  </div>
                </div>
              )}

              {/* Candidate Info Overlay */}
              <div className="video-overlay-info">
                <span className="participant-tag">
                  Candidate: {interviewData?.candidate_name || 'Candidate'}
                  {' '}{hasRemoteMedia ? '• Live Video Connected' : '• Connecting'}
                </span>
              </div>

              {/* Interviewer Self Status Overlay */}
              <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 4 }}>
                <span className="participant-tag" style={{ background: 'rgba(15, 23, 42, 0.85)', border: '1px solid #334155' }}>
                  You (Interviewer) • {isAudioMuted ? 'Mic Muted' : 'Mic Active'}
                </span>
              </div>
            </div>
          ) : (
            /* =================== CANDIDATE VIEW =================== */
            /* Displays candidate's local camera preview and plays interviewer audio */
            <div className="video-card-main">
              {/* Hidden audio element to hear interviewer */}
              <audio
                ref={setRemoteAudioRef}
                autoPlay
              />

              <video
                ref={setLocalVideoRef}
                autoPlay
                playsInline
                muted
                className={`video-feed ${isVideoMuted ? 'hidden-feed' : ''}`}
                onLoadedMetadata={(e) => {
                  e.target.muted = true;
                  e.target.play().catch(err => console.warn('Local preview playback autoPlay notice:', err));
                }}
              />

              {isVideoMuted && (
                <div className="video-placeholder">
                  <div className="avatar-placeholder">
                    {effectiveUser?.full_name?.charAt(0).toUpperCase() || 'C'}
                  </div>
                  <div style={{ color: '#ffffff', fontSize: '0.95rem', marginTop: '0.75rem', fontWeight: 600 }}>
                    Camera Turned Off
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                    Click 'Start Video' below to resume camera stream
                  </div>
                </div>
              )}

              {/* Candidate Self Info Overlay */}
              <div className="video-overlay-info">
                <span className="participant-tag">
                  You ({effectiveUser?.full_name || 'Candidate'}) • Camera Active • {isAudioMuted ? 'Mic Muted' : 'Mic Active'}
                </span>
              </div>

              {/* Interviewer Voice Connection Status Overlay */}
              <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 4 }}>
                <span className="participant-tag" style={{
                  background: peerConnected ? 'rgba(22, 101, 52, 0.85)' : 'rgba(15, 23, 42, 0.85)',
                  border: `1px solid ${peerConnected ? '#22c55e' : '#334155'}`
                }}>
                  {peerConnected ? 'Interviewer Audio Connected' : 'Waiting for Interviewer...'}
                </span>
              </div>
            </div>
          )}

          {/* Media Control Toolbar */}
          <div className="room-controls-bar">
            {/* Audio Toggle (Both Candidate & Interviewer) */}
            <button
              className={`control-btn ${isAudioMuted ? 'muted' : ''}`}
              onClick={toggleAudio}
              title={isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              
              <span>{isAudioMuted ? 'Unmute' : 'Mute'}</span>
            </button>

            {/* Video Toggle (Candidate Only - Interviewer does not use camera) */}
            {!isInterviewer && (
              <button
                className={`control-btn ${isVideoMuted ? 'muted' : ''}`}
                onClick={toggleVideo}
                title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
              >
                
                <span>{isVideoMuted ? 'Start Video' : 'Stop Video'}</span>
              </button>
            )}

            {/* End / Leave Session */}
            <button
              className="control-btn leave"
              onClick={handleEndInterview}
              title={isInterviewer ? 'End Interview' : 'Leave Call'}
            >
              
              <span>{isInterviewer ? 'End Session' : 'Leave Call'}</span>
            </button>
          </div>
        </div>

        {/* Sidebar: Interviewer gets Questions Navigation + Chat; Candidate gets only Chat */}
        <aside className="room-sidebar">
          <div className="sidebar-tabs">
            {isInterviewer && (
              <button
                className={`tab-btn ${activeSideTab === 'questions' ? 'active' : ''}`}
                onClick={() => setActiveSideTab('questions')}
              >
                Questions ({questions.length})
              </button>
            )}
            <button
              className={`tab-btn ${activeSideTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveSideTab('chat')}
            >
              Chat {chatMessages.length > 0 && `(${chatMessages.length})`}
            </button>
            <button
              className={`tab-btn ${activeSideTab === 'transcript' ? 'active' : ''}`}
              onClick={() => setActiveSideTab('transcript')}
            >
              Transcript {liveTranscriptTurns.length > 0 && `(${liveTranscriptTurns.length})`}
            </button>
          </div>

          {/* Tab 1: Questions Navigator (INTERVIEWER ONLY) */}
          {isInterviewer && activeSideTab === 'questions' && (
            <div className="sidebar-content">
              <div style={{ padding: '0.75rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.8rem', color: '#64748b' }}>
                Click any question to broadcast and display it to the candidate in real time.
              </div>

              <div style={{ overflowY: 'auto', flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {questions.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 1rem', fontSize: '0.85rem' }}>
                    No questions prepared for this interview.
                  </div>
                ) : (
                  questions.map((q, idx) => (
                    <div
                      key={q.id || idx}
                      onClick={() => handleSelectQuestionByIndex(idx)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '6px',
                        border: currentQuestionIdx === idx ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        backgroundColor: currentQuestionIdx === idx ? '#eff6ff' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: currentQuestionIdx === idx ? '#2563eb' : '#475569' }}>
                          Q{idx + 1} • {q.category}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                          {q.difficulty}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.825rem', color: '#1e293b', margin: 0, lineHeight: 1.35 }}>
                        {q.question_text}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 2: In-Room Live Chat (ACCESSIBLE TO BOTH) */}
          {activeSideTab === 'chat' && (
            <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ overflowY: 'auto', flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {chatMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 1rem', fontSize: '0.85rem' }}>
                    No messages yet. Send a message or code snippet below.
                  </div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      style={{
                        alignSelf: msg.sender_id === currentUserId ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        backgroundColor: msg.sender_id === currentUserId ? '#2563eb' : '#f1f5f9',
                        color: msg.sender_id === currentUserId ? '#ffffff' : '#0f172a',
                        padding: '0.5rem 0.75rem',
                        borderRadius: '8px',
                        fontSize: '0.825rem'
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', opacity: 0.8, marginBottom: '2px' }}>
                        {msg.sender_name}
                      </div>
                      <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleSendChatMessage} style={{ padding: '0.75rem', borderTop: '1px solid #e2e8f0', display: 'flex', gap: '0.4rem' }}>
                <input
                  type="text"
                  placeholder="Type a message or note..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  style={{
                    flex: 1,
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.825rem'
                  }}
                />
                <button type="submit" className="btn btn-primary btn-sm" style={{ padding: '0.45rem 0.75rem' }}>
                  Send
                </button>
              </form>
            </div>
          )}

          {/* Tab 3: Real-Time Live Speech Transcript */}
          {activeSideTab === 'transcript' && (
            <div className="sidebar-content" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ padding: '0.65rem 0.85rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontWeight: 600 }}>Live Speech Transcription</span>
                <span className={`badge ${isAudioMuted ? 'badge-scheduled' : isSpeechListening ? 'badge-completed' : 'badge-role'}`} style={{ fontSize: '0.7rem' }}>
                  {isAudioMuted ? 'Mic Muted' : isSpeechListening ? 'Listening' : 'Ready'}
                </span>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {liveTranscriptTurns.length === 0 && !interimTranscript ? (
                  <div style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem 1rem', fontSize: '0.825rem' }}>
                    Speak into your microphone. Words are transcribed live here in real time.
                  </div>
                ) : (
                  <>
                    {liveTranscriptTurns.map((turn, idx) => (
                      <div
                        key={idx}
                        style={{
                          background: turn.speaker === 'interviewer' ? '#eff6ff' : '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderLeft: `3px solid ${turn.speaker === 'interviewer' ? '#2563eb' : '#16a34a'}`,
                          borderRadius: '6px',
                          padding: '0.6rem 0.75rem',
                          fontSize: '0.8rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 700, color: turn.speaker === 'interviewer' ? '#2563eb' : '#16a34a', fontSize: '0.75rem' }}>
                            {turn.speaker_name || turn.speaker}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>
                            {turn.timestamp}
                          </span>
                        </div>
                        <p style={{ margin: 0, color: '#1e293b', lineHeight: 1.35 }}>
                          {turn.text}
                        </p>
                      </div>
                    ))}

                    {/* Live in-progress speaking turn */}
                    {interimTranscript && (
                      <div
                        style={{
                          background: '#f0fdf4',
                          border: '1px dashed #86efac',
                          borderLeft: '3px solid #22c55e',
                          borderRadius: '6px',
                          padding: '0.6rem 0.75rem',
                          fontSize: '0.8rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 700, color: '#16a34a', fontSize: '0.75rem' }}>
                            {effectiveUser?.full_name || (isInterviewer ? 'Interviewer' : 'Candidate')} (Speaking now...)
                          </span>
                          <span style={{ color: '#22c55e', fontSize: '0.7rem', fontWeight: 600 }}>
                            Transcribing...
                          </span>
                        </div>
                        <p style={{ margin: 0, color: '#15803d', fontStyle: 'italic', lineHeight: 1.35 }}>
                          "{interimTranscript}..."
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
