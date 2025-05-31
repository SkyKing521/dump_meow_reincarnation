import React, { useEffect, useRef, useState } from 'react';
import {
    Box,
    Button,
    Typography,
    IconButton,
    Paper,
    Avatar,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    Slider,
    Tooltip,
    Badge,
    Divider,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Grid
} from '@mui/material';
import {
    Mic as MicIcon,
    MicOff as MicOffIcon,
    VolumeUp as VolumeUpIcon,
    VolumeOff as VolumeOffIcon,
    Headset as HeadsetIcon,
    HeadsetOff as HeadsetOffIcon,
    Settings as SettingsIcon,
    ScreenShare as ScreenShareIcon,
    Videocam as VideoIcon,
    VideocamOff as VideoOffIcon,
    MoreVert as MoreVertIcon,
    CallEnd as CallEndIcon,
    Chat as ChatIcon
} from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import config from '../config';
import axios from 'axios';
import { useNavigate, useLocation } from 'react-router-dom';
import cameraOn from '../icons/camera_on.png';
import cameraOff from '../icons/camera_off.png';
import callIcon from '../icons/call.png';
import settingsIcon from '../icons/settings.png';
import chatIcon from '../icons/chat.png';
import friendsIcon from '../icons/friends.png';
import serverIcon from '../icons/server.png';
import avatar1 from '../icons/avatar1.png';
import eyeOpen from '../icons/eye_open.png';
import eyeClosed from '../icons/eye_closed.png';
import searchIcon from '../icons/search.png';
import savedIcon from '../icons/saved.png';
import videoIcon from '../icons/video.png';
import linkIcon from '../icons/link.png';
import fileIcon from '../icons/file.png';
import photoIcon from '../icons/photo.png';
import emojiIcon from '../icons/emoji.png';

// SVG для screenShareIcon
const ScreenShareSVG = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="5" width="18" height="12" rx="2" fill="#ff0aca" />
    <rect x="7" y="15" width="10" height="2" fill="#fff" />
    <polygon points="12,8 15,12 9,12" fill="#fff" />
  </svg>
);
// SVG для headsetIcon
const HeadsetSVG = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 15V12C4 7.03 8.03 3 13 3C17.97 3 22 7.03 22 12V15" stroke="#ff0aca" strokeWidth="2" fill="none" />
    <rect x="2" y="15" width="4" height="6" rx="2" fill="#ff0aca" />
    <rect x="18" y="15" width="4" height="6" rx="2" fill="#ff0aca" />
  </svg>
);

const VoiceChannel = ({ channelId }) => {
    const { token, setToken } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isDeafened, setIsDeafened] = useState(false);
    const [isVideoEnabled, setIsVideoEnabled] = useState(false);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [participants, setParticipants] = useState([]);
    const [volume, setVolume] = useState(100);
    const [showSettings, setShowSettings] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'disconnected', 'connecting', 'connected'
    const [error, setError] = useState('');
    const [isEchoMode, setIsEchoMode] = useState(false);
    
    // Add new state variables for audio handling
    const [audioStream, setAudioStream] = useState(null);
    const [audioContext, setAudioContext] = useState(null);
    const [audioProcessor, setAudioProcessor] = useState(null);
    
    const wsRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const audioContextRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const videoStreamRef = useRef(null);
    const screenStreamRef = useRef(null);
    const videoContainerRef = useRef(null);
    const localVideoRef = useRef(null);
    const [showPreview, setShowPreview] = useState(true);
    const [previewParticipants, setPreviewParticipants] = useState([]);
    const [isJoining, setIsJoining] = useState(false);
    const [audioDevices, setAudioDevices] = useState({
        input: [],
        output: []
    });
    const [selectedDevices, setSelectedDevices] = useState({
        input: '',
        output: ''
    });
    const navigate = useNavigate();
    const location = useLocation();

    // Initialize participants list
    useEffect(() => {
        setParticipants([]);
        if (showPreview) {
            loadChannelParticipants();
        }
    }, [channelId, showPreview]);

    useEffect(() => {
        loadAudioDevices();
        return () => {
            // Очистка при размонтировании
            if (audioContext && audioContext.state !== 'closed') {
                audioContext.close().catch(console.error);
            }
            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                audioContextRef.current.close().catch(console.error);
            }
        };
    }, []);

    const loadChannelParticipants = async () => {
        try {
            const response = await axios.get(`/api/channels/${channelId}/participants`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setPreviewParticipants(response.data.participants || []);
        } catch (error) {
            console.error('Error loading channel participants:', error);
            setError('Failed to load channel participants');
        }
    };

    const handleJoinChannel = async () => {
        try {
            setShowPreview(false);
            setIsJoining(true);
            await connect();
        } catch (error) {
            console.error('Error joining channel:', error);
            setError('Failed to join voice channel');
            setIsJoining(false);
        }
    };

    const handleClosePreview = () => {
        setShowPreview(false);
        // Здесь можно добавить логику для возврата к предыдущему экрану
    };

    const connect = async () => {
        try {
            setConnectionStatus('connecting');
            setError('');

            // Try to refresh token before connecting
            try {
                const response = await axios.post('/token/refresh', {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (response.ok) {
                    const newToken = response.data.access_token;
                    localStorage.setItem('token', newToken);
                    setToken(newToken);
                    console.log('Token refreshed successfully');
                }
            } catch (error) {
                console.error('Error refreshing token:', error);
                setError('Authentication failed. Please log in again.');
                return;
            }

            // Get the WebSocket protocol based on the current protocol
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//${config.SERVER_IP}:${config.SERVER_PORT}/ws/voice/${channelId}?token=${encodeURIComponent(token)}`;
            
            console.log('Connecting to WebSocket:', wsUrl);
            
            // Close existing connection if any
            if (wsRef.current) {
                wsRef.current.close();
            }
            
            wsRef.current = new WebSocket(wsUrl);

            // Set connection timeout
            const connectionTimeout = setTimeout(() => {
                if (wsRef.current?.readyState !== WebSocket.OPEN) {
                    console.error('WebSocket connection timeout');
                    setError('Connection timeout. Please try again.');
                    wsRef.current?.close();
                }
            }, 5000);

            // Set up ping interval to keep connection alive
            const pingInterval = setInterval(() => {
                if (wsRef.current?.readyState === WebSocket.OPEN) {
                    try {
                        wsRef.current.send(JSON.stringify({ type: 'ping' }));
                        console.log('Sent ping message');
                    } catch (error) {
                        console.error('Error sending ping:', error);
                    }
                }
            }, 15000);

            // Set up connection health check
            const healthCheckInterval = setInterval(() => {
                if (wsRef.current?.readyState !== WebSocket.OPEN) {
                    console.log('Connection health check failed, attempting to reconnect...');
                    reconnect();
                }
            }, 30000);

            wsRef.current.onopen = async () => {
                console.log('WebSocket connected successfully');
                clearTimeout(connectionTimeout);
                clearInterval(pingInterval);
                clearInterval(healthCheckInterval);
                setConnectionStatus('connected');
                setIsConnected(true);
                
                // Send join message to server
                try {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                        wsRef.current.send(JSON.stringify({
                            type: 'join'
                        }));
                        console.log('Sent join message');
                        
                        // Start audio stream after successful connection
                        await startAudioStream();
                    }
                } catch (error) {
                    console.error('Error sending join message or starting audio stream:', error);
                    setError('Failed to join voice channel. Please try again.');
                    disconnect();
                }
            };

            wsRef.current.onclose = async (event) => {
                console.log('WebSocket closed:', event.code, event.reason);
                clearTimeout(connectionTimeout);
                clearInterval(pingInterval);
                clearInterval(healthCheckInterval);
                setConnectionStatus('disconnected');
                setIsConnected(false);
                stopAudioStream();
                stopVideoStream();
                stopScreenShare();
                
                // Handle specific error codes
                switch (event.code) {
                    case 4000:
                        setError('Authentication failed. Please log in again.');
                        break;
                    case 4001:
                        setError('Invalid voice channel.');
                        break;
                    case 4002:
                        setError('You are not a member of this server.');
                        break;
                    case 4003:
                        setError('User not found. Please log in again.');
                        break;
                    case 1006:
                        setError('Connection lost. Attempting to reconnect...');
                        reconnect();
                        break;
                    default:
                        setError(`Connection closed: ${event.reason || 'Unknown error'}`);
                        // Try to reconnect if the connection was lost
                        if (event.code !== 1000) {
                            reconnect();
                        }
                }
            };

            wsRef.current.onerror = (error) => {
                console.error('WebSocket error:', error);
                // Don't clear intervals or disconnect on error
                // Let the onclose handler handle the cleanup
            };

            wsRef.current.onmessage = async (event) => {
                if (event.data instanceof Blob) {
                    try {
                        console.log('Received audio data blob, size:', event.data.size);
                        await playAudio(event.data);
                    } catch (error) {
                        console.error('Error processing audio data:', error);
                    }
                } else {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('Received WebSocket message:', data);
                        
                        if (data.type === 'token_refresh') {
                            // Update token in localStorage and component
                            localStorage.setItem('token', data.token);
                            setToken(data.token);
                            console.log('Token refreshed successfully');
                            return;
                        }
                        
                        if (data.type === 'ping') {
                            try {
                                wsRef.current.send(JSON.stringify({ type: 'pong' }));
                                console.log('Sent pong response');
                            } catch (error) {
                                console.error('Error sending pong:', error);
                            }
                            return;
                        }
                        
                        handleWebSocketMessage(data);
                    } catch (error) {
                        console.error('Error parsing WebSocket message:', error);
                    }
                }
            };
        } catch (error) {
            console.error('Error connecting to voice channel:', error);
            setError('Failed to connect to voice channel. Please try again later.');
            setConnectionStatus('disconnected');
            setIsJoining(false);
        }
    };

    const handleWebSocketMessage = (data) => {
        console.log('Handling WebSocket message:', data);
        switch (data.type) {
            case 'participants':
                if (Array.isArray(data.participants)) {
                    setParticipants(data.participants);
                }
                break;
            case 'participant_joined':
                if (data.participant) {
                    setParticipants(prev => [...prev, data.participant]);
                }
                break;
            case 'participant_left':
                if (data.userId) {
                    setParticipants(prev => prev.filter(p => p.id !== data.userId));
                }
                break;
            case 'audio':
                console.log('Получено аудио-сообщение:', data);
                if (!isDeafened && data.data && data.channel_id === channelId) {
                    console.log('Вызов playAudio для входящего аудио');
                    playAudio(data.data);
                }
                break;
            case 'echo':
                // Handle echo message
                if (data.original_message && 
                    data.original_message.type === 'audio' && 
                    data.original_message.channel_id === channelId) {
                    console.log('Received echo audio data');
                    if (!isDeafened && data.original_message.data) {
                        playAudio(data.original_message.data);
                    }
                }
                break;
            case 'connection_status':
                console.log('Connection status:', data.status);
                if (data.status === 'connected') {
                    setConnectionStatus('connected');
                    setIsConnected(true);
                }
                break;
            case 'pong':
                console.log('Received pong response');
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    };

    const reconnect = () => {
        console.log('Attempting to reconnect...');
        setTimeout(() => {
            if (wsRef.current?.readyState !== WebSocket.OPEN) {
                connect();
            }
        }, 3000);
    };

    const disconnect = async () => {
        try {
            // First stop all audio processing
            if (audioProcessor) {
                audioProcessor.disconnect();
                audioProcessor.onaudioprocess = null;
                setAudioProcessor(null);
            }

            // Then stop all tracks
            if (audioStream) {
                audioStream.getTracks().forEach(track => {
                    track.stop();
                    track.enabled = false;
                });
                setAudioStream(null);
            }

            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => {
                    track.stop();
                    track.enabled = false;
                });
                mediaStreamRef.current = null;
            }

            // Close audio contexts
            if (audioContext && audioContext.state !== 'closed') {
                await audioContext.close();
                setAudioContext(null);
            }

            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                await audioContextRef.current.close();
                audioContextRef.current = null;
            }

            // Close WebSocket connection
            if (wsRef.current) {
                if (wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        type: 'leave'
                    }));
                }
                wsRef.current.close();
                wsRef.current = null;
            }

            // Reset all states
            setIsConnected(false);
            setIsMuted(false);
            setIsDeafened(false);
            stopVideoStream();
            stopScreenShare();
        } catch (error) {
            console.error('Error during disconnect:', error);
        }
    };

    const startAudioStream = async () => {
        try {
            if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
                setError('Your browser does not support audio devices or the site is not served over http/https!');
                console.error('navigator.mediaDevices.getUserMedia is not available');
                return;
            }

            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                    channelCount: 1,
                    latency: 0
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);

            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop());
            }

            mediaStreamRef.current = stream;
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000,
                latencyHint: 'interactive'
            });
            audioContextRef.current = audioContext;

            const source = audioContext.createMediaStreamSource(stream);
            const processor = audioContext.createScriptProcessor(1024, 1, 1);
            setAudioProcessor(processor);

            const gainNode = audioContext.createGain();
            gainNode.gain.value = 1.0;

            const compressor = audioContext.createDynamicsCompressor();
            compressor.threshold.value = -50;
            compressor.knee.value = 40;
            compressor.ratio.value = 12;
            compressor.attack.value = 0;
            compressor.release.value = 0.25;

            source.connect(compressor);
            compressor.connect(gainNode);
            gainNode.connect(processor);
            processor.connect(audioContext.destination);

            processor.onaudioprocess = (e) => {
                if (!isMuted && wsRef.current?.readyState === WebSocket.OPEN && isConnected) {
                    const inputData = e.inputBuffer.getChannelData(0);
                    const pcmData = new Int16Array(inputData.length);
                    for (let i = 0; i < inputData.length; i++) {
                        const sample = Math.max(-0.99, Math.min(0.99, inputData[i]));
                        pcmData[i] = Math.round(sample * 32767);
                    }
                    const buffer = new ArrayBuffer(pcmData.length * 2);
                    const view = new DataView(buffer);
                    for (let i = 0; i < pcmData.length; i++) {
                        view.setInt16(i * 2, pcmData[i], true);
                    }
                    const base64Data = btoa(String.fromCharCode.apply(null, new Uint8Array(buffer)));
                    try {
                        wsRef.current.send(JSON.stringify({
                            type: 'audio',
                            data: base64Data,
                            channel_id: channelId,
                            timestamp: Date.now()
                        }));
                    } catch (error) {
                        console.error('Error sending audio data:', error);
                    }
                }
            };

            setAudioStream(stream);
            setAudioContext(audioContext);
        } catch (error) {
            console.error('Error starting audio stream:', error);
            setError('Failed to access microphone. Please make sure you have granted microphone permissions.');
            throw error;
        }
    };

    const stopAudioStream = () => {
        if (audioProcessor) {
            audioProcessor.disconnect();
            setAudioProcessor(null);
        }
        if (audioContext) {
            audioContext.close();
            setAudioContext(null);
        }
        if (audioStream) {
            audioStream.getTracks().forEach(track => track.stop());
            setAudioStream(null);
        }
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
        }
    };

    const startVideoStream = async () => {
        try {
            // Request both video and audio to ensure we have the right permissions
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user'
                },
                audio: true 
            });
            
            console.log('Video stream started:', stream.getVideoTracks()[0].label);
            videoStreamRef.current = stream;
            setIsVideoEnabled(true);
            
            // Send video stream to other participants
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'video_start',
                    userId: localStorage.getItem('userId')
                }));
            }

            // Set the stream to the video element
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
        } catch (error) {
            console.error('Error accessing camera:', error);
            setError('Failed to access camera. Please make sure you have granted camera permissions.');
            setIsVideoEnabled(false);
        }
    };

    const stopVideoStream = () => {
        if (videoStreamRef.current) {
            videoStreamRef.current.getTracks().forEach(track => track.stop());
            videoStreamRef.current = null;
            setIsVideoEnabled(false);
            
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'video_stop',
                    userId: localStorage.getItem('userId')
                }));
            }

            // Clear the video stream
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = null;
            }
        }
    };

    const startScreenShare = async () => {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
            screenStreamRef.current = stream;
            setIsScreenSharing(true);
            
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'screen_share_start',
                    userId: localStorage.getItem('userId')
                }));
            }
        } catch (error) {
            console.error('Error sharing screen:', error);
        }
    };

    const stopScreenShare = () => {
        if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach(track => track.stop());
            screenStreamRef.current = null;
            setIsScreenSharing(false);
            
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'screen_share_stop',
                    userId: localStorage.getItem('userId')
                }));
            }
        }
    };

    const playAudio = async (audioData) => {
        try {
            console.log('playAudio вызван, audioData:', audioData);
            // Конвертируем base64 обратно в Int16Array
            const binaryString = atob(audioData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const int16Data = new Int16Array(bytes.buffer);
            const float32Data = new Float32Array(int16Data.length);
            for (let i = 0; i < int16Data.length; i++) {
                float32Data[i] = int16Data[i] / 32767.0;
            }
            // Используем sampleRate 48000 для совместимости
            const audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 48000,
                latencyHint: 'interactive'
            });
            const audioBuffer = audioContext.createBuffer(1, float32Data.length, 48000);
            audioBuffer.getChannelData(0).set(float32Data);
            const source = audioContext.createBufferSource();
            const gainNode = audioContext.createGain();
            gainNode.gain.value = volume / 100;
            source.buffer = audioBuffer;
            source.connect(gainNode);
            gainNode.connect(audioContext.destination);
            source.onended = () => {
                source.disconnect();
                gainNode.disconnect();
                audioContext.close();
            };
            source.start(0);
        } catch (error) {
            console.error('Ошибка воспроизведения аудио:', error);
        }
    };

    const sendWebSocketMessage = (message) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            try {
                wsRef.current.send(typeof message === 'string' ? message : JSON.stringify(message));
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
            }
        } else {
            console.warn('WebSocket is not in OPEN state. Current state:', wsRef.current?.readyState);
        }
    };

    const toggleMute = () => {
        if (mediaStreamRef.current) {
            const audioTrack = mediaStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                const newMuteState = !isMuted;
                audioTrack.enabled = !newMuteState;
                setIsMuted(newMuteState);
                
                // Обновляем состояние процессора
                if (audioProcessor) {
                    audioProcessor.disconnect();
                    if (!newMuteState) {
                        // Если размутили, переподключаем процессор
                        const source = audioContext.createMediaStreamSource(mediaStreamRef.current);
                        const gainNode = audioContext.createGain();
                        gainNode.gain.value = 1.0;
                        
                        const compressor = audioContext.createDynamicsCompressor();
                        compressor.threshold.value = -50;
                        compressor.knee.value = 40;
                        compressor.ratio.value = 12;
                        compressor.attack.value = 0;
                        compressor.release.value = 0.25;
                        
                        source.connect(compressor);
                        compressor.connect(gainNode);
                        gainNode.connect(audioProcessor);
                        audioProcessor.connect(audioContext.destination);
                    }
                }
                
                sendWebSocketMessage({
                    type: 'mute_state',
                    isMuted: newMuteState
                });
            }
        }
    };

    const toggleDeafen = () => {
        setIsDeafened(!isDeafened);
        if (audioContextRef.current) {
            const gainNode = audioContextRef.current.createGain();
            gainNode.gain.value = isDeafened ? volume / 100 : 0;
        }
        sendWebSocketMessage({
            type: 'deafen_state',
            isDeafened: !isDeafened
        });
    };

    const toggleVideo = () => {
        if (isVideoEnabled) {
            stopVideoStream();
        } else {
            startVideoStream();
        }
        sendWebSocketMessage({
            type: 'video_state',
            isEnabled: !isVideoEnabled
        });
    };

    const toggleScreenShare = () => {
        if (isScreenSharing) {
            stopScreenShare();
        } else {
            startScreenShare();
        }
        sendWebSocketMessage({
            type: 'screen_share_state',
            isEnabled: !isScreenSharing
        });
    };

    const handleVolumeChange = (event, newValue) => {
        setVolume(newValue);
        if (audioContextRef.current && !isDeafened) {
            audioContextRef.current.destination.volume = newValue / 100;
        }
    };

    const handleLeaveChannel = async () => {
        try {
            // Сначала отключаем все аудио потоки
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => {
                    track.stop();
                    track.enabled = false;
                });
                mediaStreamRef.current = null;
            }

            if (audioStream) {
                audioStream.getTracks().forEach(track => {
                    track.stop();
                    track.enabled = false;
                });
                setAudioStream(null);
            }

            // Отключаем и очищаем аудио процессор
            if (audioProcessor) {
                audioProcessor.disconnect();
                audioProcessor.onaudioprocess = null;
                setAudioProcessor(null);
            }

            // Закрываем WebSocket соединение
            if (wsRef.current) {
                if (wsRef.current.readyState === WebSocket.OPEN) {
                    try {
                        wsRef.current.send(JSON.stringify({
                            type: 'leave'
                        }));
                    } catch (error) {
                        console.error('Error sending leave message:', error);
                    }
                }
                wsRef.current.close();
                wsRef.current = null;
            }

            // Закрываем аудио контексты
            if (audioContext && audioContext.state !== 'closed') {
                try {
                    await audioContext.close();
                } catch (error) {
                    console.error('Error closing audio context:', error);
                }
                setAudioContext(null);
            }

            if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
                try {
                    await audioContextRef.current.close();
                } catch (error) {
                    console.error('Error closing audio context ref:', error);
                }
                audioContextRef.current = null;
            }

            // Сбрасываем все состояния
            setIsConnected(false);
            setIsMuted(false);
            setIsDeafened(false);
            stopVideoStream();
            stopScreenShare();
            setIsJoining(false);

            // Принудительно останавливаем все медиа потоки
            const tracks = mediaStreamRef.current?.getTracks() || [];
            tracks.forEach(track => {
                track.stop();
                track.enabled = false;
            });
            mediaStreamRef.current = null;
        } catch (error) {
            console.error('Error during disconnect:', error);
        }
    };

    // Добавляем эффект для загрузки доступных аудио устройств
    useEffect(() => {
        loadAudioDevices();
    }, []);

    const loadAudioDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInputs = devices.filter(device => device.kind === 'audioinput');
            const audioOutputs = devices.filter(device => device.kind === 'audiooutput');

            setAudioDevices({
                input: audioInputs,
                output: audioOutputs
            });

            // Устанавливаем устройства по умолчанию, если они еще не выбраны
            if (!selectedDevices.input && audioInputs.length > 0) {
                setSelectedDevices(prev => ({
                    ...prev,
                    input: audioInputs[0].deviceId
                }));
            }
            if (!selectedDevices.output && audioOutputs.length > 0) {
                setSelectedDevices(prev => ({
                    ...prev,
                    output: audioOutputs[0].deviceId
                }));
            }
        } catch (error) {
            console.error('Error loading audio devices:', error);
            setError('Failed to load audio devices');
        }
    };

    const handleDeviceChange = async (type, deviceId) => {
        try {
            // Сначала останавливаем текущие потоки
            if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => {
                    track.stop();
                    track.enabled = false;
                });
            }

            // Обновляем выбранное устройство
            setSelectedDevices(prev => ({
                ...prev,
                [type]: deviceId
            }));

            // Если канал активен, переподключаемся
            if (isConnected) {
                await handleLeaveChannel();
                await handleJoinChannel();
            }
        } catch (error) {
            console.error('Error changing device:', error);
            setError('Failed to change audio device');
        }
    };

    const handleOpenSettings = () => {
        setShowSettings(true);
        loadAudioDevices(); // Обновляем список устройств при открытии настроек
    };

    const handleCloseSettings = () => {
        setShowSettings(false);
    };

    // Добавляем компонент настроек
    const renderSettingsDialog = () => (
        <Dialog 
            open={showSettings} 
            onClose={handleCloseSettings}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                Voice Settings
            </DialogTitle>
            <DialogContent>
                <Grid container spacing={3} sx={{ mt: 1 }}>
                    <Grid item xs={12}>
                        <FormControl fullWidth>
                            <InputLabel>Input Device</InputLabel>
                            <Select
                                value={selectedDevices.input}
                                onChange={(e) => handleDeviceChange('input', e.target.value)}
                                label="Input Device"
                            >
                                {audioDevices.input.map((device) => (
                                    <MenuItem key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                        <FormControl fullWidth>
                            <InputLabel>Output Device</InputLabel>
                            <Select
                                value={selectedDevices.output}
                                onChange={(e) => handleDeviceChange('output', e.target.value)}
                                label="Output Device"
                            >
                                {audioDevices.output.map((device) => (
                                    <MenuItem key={device.deviceId} value={device.deviceId}>
                                        {device.label || `Speaker ${device.deviceId.slice(0, 5)}`}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                        <Typography variant="subtitle2" gutterBottom>
                            Volume
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <img src={cameraOn} alt="camera on" style={{ width: 24, height: 24 }} />
                            <Slider
                                value={volume}
                                onChange={handleVolumeChange}
                                aria-labelledby="volume-slider"
                                min={0}
                                max={100}
                            />
                        </Box>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleCloseSettings} color="primary">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );

    // Добавляем функцию для перехода в текстовый канал
    const handleGoToTextChannel = async () => {
        try {
            await handleLeaveChannel();
            // Используем правильный путь для навигации
            const textChannelPath = location.pathname.replace('/voice/', '/');
            navigate(textChannelPath);
        } catch (error) {
            console.error('Error navigating to text channel:', error);
            setError('Failed to switch to text channel');
        }
    };

    // Добавляем эффект для отслеживания изменения маршрута
    useEffect(() => {
        // Если мы покидаем голосовой канал, отключаемся
        if (!location.pathname.includes('/voice/')) {
            handleLeaveChannel();
        }
    }, [location.pathname]);

    return (
        <>
            <Dialog 
                open={showPreview} 
                onClose={handleClosePreview}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Voice Channel Preview
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6" gutterBottom>
                            Current Participants
                        </Typography>
                        <List>
                            {previewParticipants.map((participant) => (
                                <ListItem key={participant.id}>
                                    <ListItemAvatar>
                                        <Badge
                                            overlap="circular"
                                            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                            badgeContent={
                                                <Box sx={{ 
                                                    width: 12, 
                                                    height: 12, 
                                                    borderRadius: '50%',
                                                    bgcolor: participant.isMuted ? 'error.main' : 'success.main',
                                                    border: '2px solid',
                                                    borderColor: 'background.paper'
                                                }} />
                                            }
                                        >
                                            <Avatar>{participant.username?.[0] || '?'}</Avatar>
                                        </Badge>
                                    </ListItemAvatar>
                                    <ListItemText 
                                        primary={participant.username || 'Unknown User'}
                                        secondary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {participant.isMuted && <img src={cameraOff} alt="camera off" style={{ width: 24, height: 24 }} />}
                                                {participant.isDeafened && <img src={eyeClosed} alt="eye closed" style={{ width: 24, height: 24 }} />}
                                                {participant.isVideoEnabled && <img src={cameraOn} alt="camera on" style={{ width: 24, height: 24 }} />}
                                                {participant.isScreenSharing && <ScreenShareSVG />}
                                            </Box>
                                        }
                                    />
                                </ListItem>
                            ))}
                            {previewParticipants.length === 0 && (
                                <ListItem>
                                    <ListItemText 
                                        primary="No participants in the channel"
                                        secondary="Be the first to join!"
                                    />
                                </ListItem>
                            )}
                        </List>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClosePreview} color="inherit">
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleJoinChannel} 
                        variant="contained" 
                        color="primary"
                        startIcon={<HeadsetSVG />}
                    >
                        Join Channel
                    </Button>
                </DialogActions>
            </Dialog>

            {!showPreview && (
                <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    height: '100%',
                    bgcolor: 'background.paper'
                }}>
                    {/* Connection Status */}
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}
                    
                    {connectionStatus === 'connecting' && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Connecting to voice channel...
                        </Alert>
                    )}

                    {/* Video Container */}
                    <Box 
                        ref={videoContainerRef}
                        sx={{ 
                            p: 2, 
                            display: 'flex', 
                            justifyContent: 'center',
                            bgcolor: 'background.default'
                        }}
                    >
                        {isVideoEnabled ? (
                            <video
                                ref={localVideoRef}
                                autoPlay
                                muted
                                playsInline
                                style={{
                                    width: '100%',
                                    maxHeight: '200px',
                                    objectFit: 'cover',
                                    borderRadius: '8px'
                                }}
                            />
                        ) : (
                            <Typography variant="body2" color="text.secondary">
                                Camera is disabled
                            </Typography>
                        )}
                    </Box>

                    {/* Participants List */}
                    <List sx={{ flex: 1, overflow: 'auto' }}>
                        {Array.isArray(participants) && participants.map((participant) => (
                            <ListItem key={participant.id}>
                                <ListItemAvatar>
                                    <Badge
                                        overlap="circular"
                                        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                                        badgeContent={
                                            <Box sx={{ 
                                                width: 12, 
                                                height: 12, 
                                                borderRadius: '50%',
                                                bgcolor: participant.isMuted ? 'error.main' : 'success.main',
                                                border: '2px solid',
                                                borderColor: 'background.paper'
                                            }} />
                                        }
                                    >
                                        <Avatar>{participant.username?.[0] || '?'}</Avatar>
                                    </Badge>
                                </ListItemAvatar>
                                <ListItemText 
                                    primary={participant.username || 'Unknown User'}
                                    secondary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {participant.isMuted && <img src={cameraOff} alt="camera off" style={{ width: 24, height: 24 }} />}
                                            {participant.isDeafened && <img src={eyeClosed} alt="eye closed" style={{ width: 24, height: 24 }} />}
                                            {participant.isVideoEnabled && <img src={cameraOn} alt="camera on" style={{ width: 24, height: 24 }} />}
                                            {participant.isScreenSharing && <ScreenShareSVG />}
                                        </Box>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>

                    {/* Controls */}
                    <Box sx={{ 
                        p: 2, 
                        borderTop: 1, 
                        borderColor: 'divider',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        {/* Voice Channel Controls */}
                        <Box sx={{ 
                            display: 'flex',
                            justifyContent: 'center',
                            gap: 2,
                            mt: 2
                        }}>
                            {/* Microphone Mute Button */}
                            <IconButton onClick={toggleMute} sx={{ color: isMuted ? 'red' : 'white' }}>
                                {isMuted ? <MicOffIcon /> : <MicIcon />}
                            </IconButton>

                            {/* Headset Mute Button */}
                            <IconButton onClick={toggleDeafen} sx={{ color: isDeafened ? 'red' : 'white' }}>
                                {isDeafened ? <HeadsetOffIcon /> : <HeadsetIcon />}
                            </IconButton>

                            {/* Camera Button */}
                            <IconButton onClick={toggleVideo} sx={{ color: isVideoEnabled ? 'lightgreen' : 'white' }}>
                                {isVideoEnabled ? <VideoIcon /> : <VideoOffIcon />}
                            </IconButton>

                            {/* Screen Share Button */}
                            <IconButton onClick={toggleScreenShare} sx={{ color: isScreenSharing ? 'lightgreen' : 'white' }}>
                                {isScreenSharing ? <ScreenShareIcon /> : <ScreenShareIcon />}
                            </IconButton>

                            {/* Settings Button (Optional, keep if needed for device selection) */}
                            {/* <IconButton onClick={handleOpenSettings} sx={{ color: 'white' }}>
                                <SettingsIcon />
                            </IconButton> */}

                            {/* Disconnect Button */}
                            <IconButton onClick={handleLeaveChannel} sx={{ color: 'red' }}>
                                <CallEndIcon />
                            </IconButton>
                        </Box>

                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 200 }}>
                            <img src={cameraOn} alt="camera on" style={{ width: 24, height: 24 }} />
                            <Slider
                                value={volume}
                                onChange={handleVolumeChange}
                                aria-labelledby="volume-slider"
                                min={0}
                                max={100}
                            />
                        </Box>

                        {/* Remove Go to Text Channel Button */}
                        {/* <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="Go to Text Channel">
                                <IconButton onClick={handleGoToTextChannel} color="default">
                                    <img src={chatIcon} alt="chat" style={{ width: 24, height: 24 }} />
                                </IconButton>
                            </Tooltip>
                        </Box> */}

                    </Box>
                </Box>
            )}

            {renderSettingsDialog()}
        </>
    );
};

export default VoiceChannel; 