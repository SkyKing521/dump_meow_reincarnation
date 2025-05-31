import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Drawer,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Typography,
    TextField,
    Button,
    IconButton,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Divider,
    Tooltip,
    Avatar,
    Badge,
    Paper,
    Grid,
    Chip,
    Slider
} from '@mui/material';
import {
    Add as AddIcon,
    MoreVert as MoreVertIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    VolumeUp,
    Chat as ChatIcon,
    Category as CategoryIcon,
    EmojiEmotions as EmojiIcon,
    AttachFile as AttachFileIcon,
    Send as SendIcon,
    Settings as SettingsIcon,
    Security as SecurityIcon,
    History as HistoryIcon,
    MusicNote,
    Games,
    Image,
    VideoLibrary,
    AudioFile,
    PlayArrow,
    Pause,
    SkipNext,
    SkipPrevious,
    ContentCopy as ContentCopyIcon,
    ArrowBack as ArrowBackIcon,
    Mic as MicIcon,
    Stop as StopIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import config from '../config';
import VoiceChannel from './VoiceChannel';
import serverIcon from '../icons/server.png';
import friendsIcon from '../icons/friends.png';
import chatIcon from '../icons/chat.png';
import settingsIcon from '../icons/settings.png';
import emojiIcon from '../icons/emoji.png';
import photoIcon from '../icons/photo.png';
import fileIcon from '../icons/file.png';
import videoIcon from '../icons/video.png';
import linkIcon from '../icons/link.png';
import savedIcon from '../icons/saved.png';
import searchIcon from '../icons/search.png';
import avatar1 from '../icons/avatar1.png';
// Import new icons
import editIconNew from '../icons/icons8-редактировать-48.png';
import deleteIconNew from '../icons/icons8-мусор-24.png';
import backIconNew from '../icons/icons8-стрелка-влево-в-круге-2-50.png';
// Import new menu icon
import menuIconNew from '../icons/icons8-меню-2-50.png';
// Import new plus icon
import plusIconNew from '../icons/icons8-плюс-64.png';
// Import new megaphone and create new icons
import megaphoneIconNew from '../icons/icons8-мегафон-24.png';
import createNewIconNew from '../icons/icons8-создать-новый-64.png';
// Import new audit log icon
import auditLogIconNew from '../icons/icons8-заметки-30.png';
// Import MusicNoteIcon for music input button
import MusicNoteIcon from '@mui/icons-material/MusicNote';
// SVG компоненты для недостающих иконок:
const SkipNextSVG = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="8,5 16,12 8,19" fill="#ff0aca" />
  </svg>
);
const SkipPrevSVG = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="16,5 8,12 16,19" fill="#ff0aca" />
  </svg>
);
const PlayArrowSVG = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="8,5 19,12 8,19" fill="#ff0aca" />
  </svg>
);
const PauseSVG = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="5" width="4" height="14" fill="#ff0aca" />
    <rect x="14" y="5" width="4" height="14" fill="#ff0aca" />
  </svg>
);
const VolumeUpSVG = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="3,9 9,9 13,5 13,19 9,15 3,15" fill="#ff0aca" />
    <path d="M16 7C17.6569 8.65685 17.6569 11.3431 16 13" stroke="#ff0aca" strokeWidth="2" fill="none" />
  </svg>
);
const GamesSVG = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="#ff0aca" strokeWidth="2" fill="none" />
    <rect x="7" y="11" width="2" height="2" fill="#ff0aca" />
    <rect x="15" y="11" width="2" height="2" fill="#ff0aca" />
    <rect x="11" y="7" width="2" height="2" fill="#ff0aca" />
    <rect x="11" y="15" width="2" height="2" fill="#ff0aca" />
  </svg>
);
const ImageSVG = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="5" width="18" height="14" rx="2" fill="#ff0aca" />
    <circle cx="8" cy="9" r="2" fill="#fff" />
    <path d="M21 19L15 13L9 19" stroke="#fff" strokeWidth="2" />
  </svg>
);

const ServerView = ({ onChannelSelect }) => {
    const { serverId } = useParams();
    const navigate = useNavigate();
    const { token } = useAuth();
    const [server, setServer] = useState(null);
    const [channels, setChannels] = useState([]);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [selectedChannel, setSelectedChannel] = useState(null);
    const [newChannelName, setNewChannelName] = useState('');
    const [showNewChannelInput, setShowNewChannelInput] = useState(false);
    const [channelType, setChannelType] = useState('text');
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedItem, setSelectedItem] = useState(null);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [editName, setEditName] = useState('');
    const [showAuditLogs, setShowAuditLogs] = useState(false);
    const [auditLogs, setAuditLogs] = useState([]);
    const [showRoles, setShowRoles] = useState(false);
    const [roles, setRoles] = useState([]);
    const [showNewRoleDialog, setShowNewRoleDialog] = useState(false);
    const [newRole, setNewRole] = useState({ name: '', color: '#000000', permissions: {} });
    const messagesEndRef = useRef(null);
    const [showMediaUpload, setShowMediaUpload] = useState(false);
    const [showGameDialog, setShowGameDialog] = useState(false);
    const [showMusicPlayer, setShowMusicPlayer] = useState(false);
    const [mediaFiles, setMediaFiles] = useState([]);
    const [currentGame, setCurrentGame] = useState(null);
    const [musicQueue, setMusicQueue] = useState([]);
    const [currentMusic, setCurrentMusic] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(100);
    const [inviteLink, setInviteLink] = useState('');
    const [showInviteCopied, setShowInviteCopied] = useState(false);

    // State for voice recording
    const [recording, setRecording] = useState(false);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [audioURL, setAudioURL] = useState(null);
    const audioChunks = useRef([]);

    // State for music input
    const [musicInput, setMusicInput] = useState('');

    // Voice recording functions - Moving these here
    const startRecording = async () => {
        console.log('Attempting to start recording...');
        try {
            console.log('Requesting microphone access...');
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Microphone access granted.');
            const recorder = new MediaRecorder(stream);

            recorder.ondataavailable = (event) => {
                audioChunks.current.push(event.data);
            };

            recorder.onstop = () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' }); // Adjust type if needed
                const url = URL.createObjectURL(audioBlob);
                setAudioURL(url);
                audioChunks.current = []; // Clear chunks for next recording
                // Here you would typically send the audioBlob to the server
                console.log('Recorded audio blob:', audioBlob);
                handleSendVoiceMessage(audioBlob); // Call the send function here
            };

            recorder.start();
            setRecording(true);
            setMediaRecorder(recorder);
        } catch (error) {
            console.error('Error starting recording:', error);
            alert('Failed to start voice recording. Please ensure microphone access is granted.');
        }
    };

    const stopRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
            setRecording(false);
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        console.log('messages:', messages);
      }, [messages]);

    useEffect(() => {
        const fetchServerData = async () => {
            try {
                const [serverRes, channelsRes] = await Promise.all([
                    axios.get(`${config.API_BASE_URL}/servers/${serverId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    axios.get(`${config.API_BASE_URL}/servers/${serverId}/channels`, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                ]);
                setServer(serverRes.data);
                setChannels(channelsRes.data);
                if (channelsRes.data.length > 0) {
                    setSelectedChannel(channelsRes.data[0]);
                }
            } catch (error) {
                console.error('Error fetching server data:', error);
            }
        };

        fetchServerData();
    }, [serverId, token]);

    useEffect(() => {
        if (selectedChannel) {
            fetchMessages();
        }
    }, [selectedChannel]);

    const fetchMessages = async () => {
        try {
            const response = await axios.get(
                `${config.API_BASE_URL}/channels/${selectedChannel.id}/messages`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setMessages(response.data);
        } catch (error) {
            console.error('Error fetching messages:', error);
        }
    };

    const handleSendMessage = async (e) => {
        if (e) {
            e.preventDefault();
        }
        if (!newMessage.trim()) return;

        try {
            const formData = new FormData();
            formData.append('content', newMessage);

            const response = await axios.post(
                `${config.API_BASE_URL}/channels/${selectedChannel.id}/messages`,
                formData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`
                        // Не указываем Content-Type, axios сам выставит boundary
                    }
                }
            );
            
            if (response.data) {
                setMessages(prevMessages => [...prevMessages, response.data]);
                setNewMessage('');
            }
        } catch (error) {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please try again.');
        }
    };

    const handleSendVoiceMessage = async (audioBlob) => {
        if (!selectedChannel || selectedChannel.type !== 'text') return;

        const formData = new FormData();
        formData.append('file', audioBlob, 'voice_message.wav');
        formData.append('media_type', 'audio');

        try {
            const response = await axios.post(
                `${config.API_BASE_URL}/channels/${selectedChannel.id}/messages`,
                formData,
                {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    }
                }
            );

            if (response.data) {
                setMessages(prevMessages => [...prevMessages, response.data]);
            }
        } catch (error) {
            console.error('Error sending voice message:', error);
            alert('Failed to send voice message. Please try again.');
        }
    };

    const handleCreateChannel = async () => {
        if (!newChannelName.trim()) return;

        try {
            const response = await axios.post(
                `${config.API_BASE_URL}/servers/${serverId}/channels/`,
                {
                    name: newChannelName,
                    type: channelType
                },
                {
                    headers: { 
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            setChannels([...channels, response.data]);
            setNewChannelName('');
            setShowNewChannelInput(false);
        } catch (error) {
            console.error('Error creating channel:', error);
            alert('Failed to create channel. Please try again.');
        }
    };

    const handleMenuClick = (event, item) => {
        setAnchorEl(event.currentTarget);
        setSelectedItem(item);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedItem(null);
    };

    const handleEdit = () => {
        setEditName(selectedItem.name);
        setShowEditDialog(true);
        handleMenuClose();
    };

    const handleDelete = async () => {
        try {
            if (selectedItem.type === 'channel') {
                await axios.delete(
                    `${config.API_BASE_URL}/channels/${selectedItem.id}`,
                    {
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );
                setChannels(channels.filter(c => c.id !== selectedItem.id));
            }
            handleMenuClose();
        } catch (error) {
            console.error('Error deleting item:', error);
        }
    };

    const handleSaveEdit = async () => {
        try {
            if (selectedItem.type === 'channel') {
                const response = await axios.put(
                    `${config.API_BASE_URL}/channels/${selectedItem.id}`,
                    { name: editName },
                    {
                        headers: { Authorization: `Bearer ${token}` }
                    }
                );
                setChannels(channels.map(c => c.id === selectedItem.id ? response.data : c));
            }
            setShowEditDialog(false);
        } catch (error) {
            console.error('Error updating item:', error);
        }
    };

    const handleViewAuditLogs = async () => {
        try {
            const response = await axios.get(
                `${config.API_BASE_URL}/servers/${serverId}/audit-logs`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setAuditLogs(response.data);
            setShowAuditLogs(true);
        } catch (error) {
            console.error('Error fetching audit logs:', error);
        }
    };

    const handleViewRoles = async () => {
        try {
            const response = await axios.get(
                `${config.API_BASE_URL}/servers/${serverId}/roles`,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setRoles(response.data);
            setShowRoles(true);
        } catch (error) {
            console.error('Error fetching roles:', error);
        }
    };

    const handleCreateRole = async () => {
        try {
            const response = await axios.post(
                `${config.API_BASE_URL}/servers/${serverId}/roles`,
                newRole,
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            setRoles([...roles, response.data]);
            setShowNewRoleDialog(false);
            setNewRole({ name: '', color: '#000000', permissions: {} });
        } catch (error) {
            console.error('Error creating role:', error);
        }
    };

    const handleAddReaction = async (messageId, emoji) => {
        try {
            await axios.post(
                `${config.API_BASE_URL}/messages/${messageId}/reactions/${emoji}`,
                {},
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            fetchMessages();
        } catch (error) {
            console.error('Error adding reaction:', error);
        }
    };

    const handleMediaUpload = async (event) => {
        const files = Array.from(event.target.files);
        
        for (const file of files) {
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                const response = await axios.post(
                    `${config.API_BASE_URL}/channels/${selectedChannel.id}/messages`,
                    formData,
                    {
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'multipart/form-data'
                        }
                    }
                );
                
                if (response.data) {
                    // Add the new message to the messages list
                    setMessages(prevMessages => [...prevMessages, response.data]);
                }
            } catch (error) {
                console.error('Error uploading media:', error);
                if (error.response?.data?.detail) {
                    alert(`Upload failed: ${error.response.data.detail}`);
                } else {
                    alert('Failed to upload file. Please try again.');
                }
            }
        }
    };

    const handleCreateGame = async (gameType) => {
        try {
            const response = await fetch(`/api/channels/${selectedChannel}/games/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ game_type: gameType })
            });
            if (response.ok) {
                const game = await response.json();
                setCurrentGame(game);
                setShowGameDialog(false);
            }
        } catch (error) {
            console.error('Error creating game:', error);
        }
    };

    const handleJoinGame = async (gameId) => {
        try {
            const response = await fetch(`/api/games/${gameId}/players/`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (response.ok) {
                const player = await response.json();
                setCurrentGame(prev => ({
                    ...prev,
                    players: [...prev.players, player]
                }));
            }
        } catch (error) {
            console.error('Error joining game:', error);
        }
    };

    const handleAddMusicToQueue = async () => {
        if (!musicInput.trim() || !selectedChannel) return;

        try {
            const response = await fetch(`${config.API_BASE_URL}/channels/${selectedChannel.id}/music/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    url: musicInput,
                    title: 'Music Title', // TODO: Fetch metadata based on URL/name
                    artist: 'Artist',   // TODO: Fetch metadata based on URL/name
                    duration: 1,        // Changed placeholder to 1
                    position: 0, // Add a placeholder position
                    status: 'queued', // Add a default status
                })
            });

            if (response.ok) {
                setMusicInput(''); // Clear the input field on success
                // Optionally, fetch and update the music queue in the UI
                // fetchMusicQueue(); // You would need to implement this
            } else {
                console.error('Failed to add music to queue:', response.statusText);
                alert('Failed to add music to queue. Please try again.');
            }
        } catch (error) {
            console.error('Error adding music to queue:', error);
            alert('Failed to add music to queue. Please try again.');
        }
    };

    // Function to fetch the music queue for the current channel
    const fetchMusicQueue = async () => {
        if (!selectedChannel) return;
        try {
            const response = await fetch(`${config.API_BASE_URL}/channels/${selectedChannel.id}/music/`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (response.ok) {
                const queue = await response.json();
                setMusicQueue(queue);
            } else {
                console.error('Failed to fetch music queue:', response.statusText);
            }
        } catch (error) {
            console.error('Error fetching music queue:', error);
        }
    };

    // Call onChannelSelect when selectedChannel changes
    useEffect(() => {
        if (selectedChannel) {
            onChannelSelect(selectedChannel.id);
        } else {
            onChannelSelect(null);
        }
    }, [selectedChannel, onChannelSelect]);

    // Fetch music queue when the music player dialog is opened or channel changes
    useEffect(() => {
        if (showMusicPlayer && selectedChannel) {
            fetchMusicQueue();
        }
    }, [showMusicPlayer, selectedChannel]); // Depend on showMusicPlayer and selectedChannel

    // Function to handle playing a specific track from the queue
    const handlePlayTrackFromQueue = async (musicId) => {
        if (!selectedChannel) return;
        try {
            const response = await fetch(`${config.API_BASE_URL}/music/${musicId}/play?channel_id=${selectedChannel.id}`, {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (!response.ok) {
                console.error('Failed to play track from queue:', response.statusText);
                alert('Failed to play track. Please try again.');
            }
            // The PersistentMusicPlayer will pick up the change via polling
        } catch (error) {
            console.error('Error playing track from queue:', error);
            alert('Failed to play track. Please try again.');
        }
    };

    // Function to generate an invite link
    const generateInviteLink = async () => {
        if (!serverId) return;
        try {
            // Assuming backend has an endpoint to generate invite links
            // Replace with the actual endpoint if different
            const response = await axios.post(`${config.API_BASE_URL}/servers/${serverId}/invite`, {}, {
                 headers: { Authorization: `Bearer ${token}` }
            });
            if (response.data && response.data.invite_code) {
                const inviteUrl = `${window.location.origin}/invite/${response.data.invite_code}`; // Construct full invite URL
                navigator.clipboard.writeText(inviteUrl);
                setInviteLink(inviteUrl); // Optional: if you want to display the link
                setShowInviteCopied(true);
                setTimeout(() => setShowInviteCopied(false), 2000); // Hide tooltip after 2 seconds
            }
        } catch (error) {
            console.error('Error generating invite link:', error);
            alert('Failed to generate invite link.');
        }
    };

    // Function to navigate back to the servers list
    const handleBackToServers = () => {
        navigate('/');
    };

    return (
        <Box sx={{ display: 'flex', height: '100vh' }}>
            {/* Server Header */}
            <Box sx={{ 
                p: 2, 
                borderBottom: 1, 
                borderColor: 'divider',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
            }}>
                <Typography variant="h6">{server?.name}</Typography>
                <Tooltip title={showInviteCopied ? "Copied!" : "Copy Invite Link"}>
                    <IconButton onClick={generateInviteLink}>
                        <img src={linkIcon} alt="copy invite link" style={{ width: 24, height: 24 }} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Боковая панель с каналами */}
            <Drawer
                variant="permanent"
                sx={{
                    width: 240,
                    flexShrink: 0,
                    '& .MuiDrawer-paper': {
                        width: 240,
                        boxSizing: 'border-box',
                        backgroundColor: '#2f3136',
                        color: 'white'
                    }
                }}
            >
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ color: '#ff78e2' }}>
                        {server?.name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                        <Tooltip title="Настройки сервера">
                            <IconButton size="small" onClick={() => navigate(`/servers/${serverId}/settings`)}>
                                <img src={settingsIcon} alt="settings" style={{ width: 24, height: 24 }} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Журнал аудита">
                            <IconButton size="small" onClick={handleViewAuditLogs}>
                                <img src={auditLogIconNew} alt="audit log" style={{ width: 24, height: 24 }} />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Управление ролями">
                            <IconButton size="small" onClick={handleViewRoles}>
                                <img src={createNewIconNew} alt="manage roles" style={{ width: 24, height: 24 }} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                </Box>
                <Divider sx={{ backgroundColor: '#40444b' }} />
                <List>
                    <ListItem button onClick={handleBackToServers}>
                        <ListItemIcon>
                            <img src={backIconNew} alt="arrow_back" style={{ width: 24, height: 24 }} />
                        </ListItemIcon>
                        <ListItemText primary="Back to Servers" />
                    </ListItem>
                    <Divider sx={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
                    <ListItem>
                        <ListItemText 
                            primary={<span style={{ color: '#ff78e2' }}>{server?.name || 'Loading...'}</span>} 
                            secondary={<span style={{ color: '#ff78e2' }}>Server</span>}
                        />
                    </ListItem>
                    {channels.map((channel) => (
                        <ListItem
                            key={channel.id}
                            button
                            selected={selectedChannel?.id === channel.id}
                            onClick={() => setSelectedChannel(channel)}
                            sx={{
                                '&.Mui-selected': {
                                    backgroundColor: '#40444b'
                                }
                            }}
                        >
                            <ListItemIcon>
                                {channel.type === 'text' ? (
                                    <img src={chatIcon} alt="chat" style={{ width: 24, height: 24 }} />
                                ) : channel.type === 'voice' ? (
                                    <img src={megaphoneIconNew} alt="voice channel" style={{ width: 24, height: 24 }} />
                                ) : (
                                    <img src={CategoryIcon} alt="category" style={{ width: 24, height: 24 }} />
                                )}
                            </ListItemIcon>
                            <ListItemText primary={channel.name} />
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleMenuClick(e, { ...channel, type: 'channel' });
                                }}
                            >
                                <img src={menuIconNew} alt="menu" style={{ width: 24, height: 24 }} />
                            </IconButton>
                        </ListItem>
                    ))}
                    <ListItem button onClick={() => setShowNewChannelInput(true)}>
                        <ListItemIcon>
                            <img src={plusIconNew} alt="add" style={{ width: 24, height: 24 }} />
                        </ListItemIcon>
                        <ListItemText primary="Создать канал" />
                    </ListItem>
                </List>
            </Drawer>

            {/* Основная область с сообщениями */}
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                {selectedChannel ? (
                    <>
                        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                            <Typography variant="h6">
                                {selectedChannel.type === 'text' ? '#' : '🔊'} {selectedChannel.name}
                            </Typography>
                        </Box>
                        
                        {selectedChannel.type === 'voice' ? (
                            <VoiceChannel channelId={selectedChannel.id} />
                        ) : (
                            <>
                                <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
                                    {messages.map((message) => (
                                        <Box key={message.id} sx={{ mb: 2 }}>
                                            <Grid container spacing={1}>
                                                <Grid item>
                                                    <Avatar>
                                                        {message.author?.username?.[0] || '?'}
                                                    </Avatar>
                                                </Grid>
                                                <Grid item xs>
                                                    <Box>
                                                        <Typography variant="subtitle2" component="span">
                                                            {message.author?.username || 'Unknown User'}
                                                        </Typography>
                                                        <Typography
                                                            variant="caption"
                                                            color="text.secondary"
                                                            sx={{ ml: 1 }}
                                                        >
                                                            {new Date(message.created_at).toLocaleString()}
                                                        </Typography>
                                                    </Box>
                                                    {(message.content || message.text) && (
                                                        <Typography variant="body1">{message.content || message.text}</Typography>
                                                    )}
                                                    {message.media_url && (
                                                        <Box sx={{ mt: 1 }}>
                                                            {message.media_type === 'image' && (
                                                                <img 
                                                                    src={`${config.API_BASE_URL}${message.media_url}`}
                                                                    alt="Uploaded content"
                                                                    style={{ maxWidth: '100%', maxHeight: '300px' }}
                                                                />
                                                            )}
                                                            {message.media_type === 'video' && (
                                                                <video 
                                                                    controls
                                                                    style={{ maxWidth: '100%', maxHeight: '300px' }}
                                                                >
                                                                    <source src={`${config.API_BASE_URL}${message.media_url}`} />
                                                                    Your browser does not support the video tag.
                                                                </video>
                                                            )}
                                                            {message.media_type === 'audio' && (
                                                                <audio controls>
                                                                    <source src={`${config.API_BASE_URL}${message.media_url}`} />
                                                                    Your browser does not support the audio tag.
                                                                </audio>
                                                            )}
                                                            {message.media_type === 'file' && (
                                                                <Paper
                                                                    sx={{
                                                                        p: 1,
                                                                        mt: 1,
                                                                        backgroundColor: '#2f3136',
                                                                        color: 'white'
                                                                    }}
                                                                >
                                                                    <Typography variant="body2">
                                                                        <a 
                                                                            href={`${config.API_BASE_URL}${message.media_url}`}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            style={{ color: 'white', textDecoration: 'none' }}
                                                                        >
                                                                            Download File
                                                                        </a>
                                                                    </Typography>
                                                                </Paper>
                                                            )}
                                                        </Box>
                                                    )}
                                                    <Box sx={{ mt: 1 }}>
                                                        {message.reactions?.map((reaction, index) => (
                                                            <Chip
                                                                key={index}
                                                                label={reaction.emoji}
                                                                size="small"
                                                                onClick={() => handleAddReaction(message.id, reaction.emoji)}
                                                                sx={{ mr: 0.5 }}
                                                            />
                                                        ))}
                                                    </Box>
                                                </Grid>
                                            </Grid>
                                        </Box>
                                    ))}
                                    <div ref={messagesEndRef} />
                                </Box>
                                
                                <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                                    <Grid container spacing={2}>
                                        <Grid item>
                                            <input
                                                type="file"
                                                multiple
                                                accept="image/*,video/*,audio/*"
                                                style={{ display: 'none' }}
                                                id="media-upload"
                                                onChange={handleMediaUpload}
                                            />
                                            <label htmlFor="media-upload">
                                                <IconButton component="span">
                                                    <img src={fileIcon} alt="file upload" style={{ width: 24, height: 24 }} />
                                                </IconButton>
                                            </label>
                                        </Grid>
                                        <Grid item>
                                            {/* Voice recording buttons */}
                                            {!recording ? (
                                                <IconButton onClick={startRecording}>
                                                    <MicIcon sx={{ color: 'white' }} />
                                                </IconButton>
                                            ) : (
                                                <IconButton onClick={stopRecording}>
                                                    <StopIcon sx={{ color: 'red' }} />
                                                </IconButton>
                                            )}
                                        </Grid>
                                        <Grid item xs={4}> {/* Уменьшаем размер поля для музыки */}
                                            <TextField
                                                fullWidth
                                                variant="outlined"
                                                placeholder="Add music by link or name..."
                                                value={musicInput}
                                                onChange={(e) => setMusicInput(e.target.value)}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleAddMusicToQueue();
                                                    }
                                                }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        backgroundColor: '#40444b',
                                                        color: 'white',
                                                        '& fieldset': {
                                                            borderColor: 'rgba(255,255,255,0.1)',
                                                        },
                                                        '&:hover fieldset': {
                                                            borderColor: 'rgba(255,255,255,0.2)',
                                                        },
                                                        '&.Mui-focused fieldset': {
                                                            borderColor: '#7289da',
                                                        },
                                                    },
                                                    '& .MuiInputBase-input': {
                                                        color: 'white',
                                                    },
                                                }}
                                            />
                                        </Grid>
                                        <Grid item>
                                            <IconButton
                                                onClick={handleAddMusicToQueue}
                                                disabled={!musicInput.trim() || !selectedChannel}
                                                sx={{
                                                    color: (musicInput.trim() && selectedChannel) ? '#7289da' : 'rgba(255,255,255,0.3)',
                                                    '&:hover': {
                                                        color: (musicInput.trim() && selectedChannel) ? '#5b6eae' : 'rgba(255,255,255,0.3)',
                                                    }
                                                }}
                                            >
                                                <MusicNoteIcon />
                                            </IconButton>
                                        </Grid>
                                        <Grid item xs={8}> {/* Расширяем поле для текстового сообщения */}
                                            <TextField
                                                fullWidth
                                                variant="outlined"
                                                placeholder="Type a message..."
                                                value={newMessage}
                                                onChange={(e) => setNewMessage(e.target.value)}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSendMessage();
                                                    }
                                                }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        backgroundColor: '#40444b',
                                                        color: 'white',
                                                        '& fieldset': {
                                                            borderColor: 'rgba(255,255,255,0.1)',
                                                        },
                                                        '&:hover fieldset': {
                                                            borderColor: 'rgba(255,255,255,0.2)',
                                                        },
                                                        '&.Mui-focused fieldset': {
                                                            borderColor: '#7289da',
                                                        },
                                                    },
                                                    '& .MuiInputBase-input': {
                                                        color: 'white',
                                                    },
                                                }}
                                            />
                                        </Grid>
                                        <Grid item>
                                            <IconButton
                                                onClick={handleSendMessage}
                                                disabled={!newMessage.trim()}
                                                sx={{
                                                    color: newMessage.trim() ? '#7289da' : 'rgba(255,255,255,0.3)',
                                                    '&:hover': {
                                                        color: newMessage.trim() ? '#5b6eae' : 'rgba(255,255,255,0.3)',
                                                    }
                                                }}
                                            >
                                                <img src={fileIcon} alt="send" style={{ width: 24, height: 24 }} />
                                            </IconButton>
                                        </Grid>
                                    </Grid>
                                </Box>
                            </>
                        )}
                    </>
                ) : (
                    <Box sx={{ p: 2 }}>
                        <Typography>Выберите канал</Typography>
                    </Box>
                )}
            </Box>

            {/* Диалог создания нового канала */}
            <Dialog open={showNewChannelInput} onClose={() => setShowNewChannelInput(false)}>
                <DialogTitle>Создать новый канал</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Название канала"
                        fullWidth
                        value={newChannelName}
                        onChange={(e) => setNewChannelName(e.target.value)}
                    />
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2">Тип канала</Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            <Button
                                variant={channelType === 'text' ? 'contained' : 'outlined'}
                                onClick={() => setChannelType('text')}
                            >
                                Текстовый
                            </Button>
                            <Button
                                variant={channelType === 'voice' ? 'contained' : 'outlined'}
                                onClick={() => setChannelType('voice')}
                            >
                                Голосовой
                            </Button>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowNewChannelInput(false)}>Отмена</Button>
                    <Button onClick={handleCreateChannel} variant="contained">
                        Создать
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Меню действий */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={handleEdit}>
                    <ListItemIcon>
                        <img src={editIconNew} alt="edit" style={{ width: 24, height: 24 }} />
                    </ListItemIcon>
                    <ListItemText>Редактировать</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleDelete}>
                    <ListItemIcon>
                        <img src={deleteIconNew} alt="delete" style={{ width: 24, height: 24 }} />
                    </ListItemIcon>
                    <ListItemText>Удалить</ListItemText>
                </MenuItem>
            </Menu>

            {/* Диалог редактирования */}
            <Dialog open={showEditDialog} onClose={() => setShowEditDialog(false)}>
                <DialogTitle>Редактировать</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Название"
                        fullWidth
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowEditDialog(false)}>Отмена</Button>
                    <Button onClick={handleSaveEdit} variant="contained">
                        Сохранить
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Диалог журнала аудита */}
            <Dialog
                open={showAuditLogs}
                onClose={() => setShowAuditLogs(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Журнал аудита</DialogTitle>
                <DialogContent>
                    <List>
                        {auditLogs.map((log) => (
                            <ListItem key={log.id}>
                                <ListItemText
                                    primary={`${log.action} - ${log.target_type}`}
                                    secondary={
                                        <>
                                            <Typography component="span" variant="body2">
                                                {new Date(log.created_at).toLocaleString()}
                                            </Typography>
                                            <br />
                                            <Typography component="span" variant="body2">
                                                Изменения: {JSON.stringify(log.changes)}
                                            </Typography>
                                        </>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowAuditLogs(false)}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            {/* Диалог управления ролями */}
            <Dialog
                open={showRoles}
                onClose={() => setShowRoles(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Управление ролями</DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 2 }}>
                        <Button
                            variant="contained"
                            startIcon={<img src={plusIconNew} alt="add" style={{ width: 24, height: 24 }} />}
                            onClick={() => setShowNewRoleDialog(true)}
                        >
                            Создать роль
                        </Button>
                    </Box>
                    <List>
                        {roles.map((role) => (
                            <ListItem key={role.id}>
                                <ListItemText
                                    primary={role.name}
                                    secondary={
                                        <>
                                            <Typography component="span" variant="body2">
                                                Цвет: {role.color}
                                            </Typography>
                                            <br />
                                            <Typography component="span" variant="body2">
                                                Права: {JSON.stringify(role.permissions)}
                                            </Typography>
                                        </>
                                    }
                                />
                            </ListItem>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowRoles(false)}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            {/* Диалог создания новой роли */}
            <Dialog open={showNewRoleDialog} onClose={() => setShowNewRoleDialog(false)}>
                <DialogTitle>Создать новую роль</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Название роли"
                        fullWidth
                        value={newRole.name}
                        onChange={(e) => setNewRole({ ...newRole, name: e.target.value })}
                    />
                    <TextField
                        margin="dense"
                        label="Цвет"
                        type="color"
                        fullWidth
                        value={newRole.color}
                        onChange={(e) => setNewRole({ ...newRole, color: e.target.value })}
                    />
                    <Box sx={{ mt: 2 }}>
                        <Typography variant="subtitle2">Права</Typography>
                        {/* Здесь можно добавить чекбоксы для различных прав */}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowNewRoleDialog(false)}>Отмена</Button>
                    <Button onClick={handleCreateRole} variant="contained">
                        Создать
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Game Dialog */}
            <Dialog open={showGameDialog} onClose={() => setShowGameDialog(false)}>
                <DialogTitle>Select Game</DialogTitle>
                <DialogContent>
                    <List>
                        <ListItem button onClick={() => handleCreateGame('CHESS')}>
                            <ListItemText primary="Chess" />
                        </ListItem>
                        <ListItem button onClick={() => handleCreateGame('TIC_TAC_TOE')}>
                            <ListItemText primary="Tic Tac Toe" />
                        </ListItem>
                        <ListItem button onClick={() => handleCreateGame('HANGMAN')}>
                            <ListItemText primary="Hangman" />
                        </ListItem>
                        <ListItem button onClick={() => handleCreateGame('QUIZ')}>
                            <ListItemText primary="Quiz" />
                        </ListItem>
                    </List>
                </DialogContent>
            </Dialog>

            {/* Music Player */}
            <Dialog 
                open={showMusicPlayer} 
                onClose={() => setShowMusicPlayer(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Music Player</DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 2 }}>
                        <Typography variant="h6">
                            {currentMusic ? currentMusic.title : 'No music playing'}
                        </Typography>
                        <Typography variant="subtitle1">
                            {currentMusic ? currentMusic.artist : ''}
                        </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        {/* Removed skip previous button from dialog */}
                        {/* Removed play/pause buttons from dialog */}
                         {/* Removed skip next button from dialog */}
                        <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
                            <img src={VolumeUpSVG()} alt="volume_up" style={{ width: 24, height: 24 }} />
                            <Slider
                                value={volume}
                                onChange={(e, newValue) => setVolume(newValue)}
                                sx={{ width: 100, ml: 1 }}
                            />
                        </Box>
                    </Box>

                    <Typography variant="h6" sx={{ mb: 1 }}>Queue</Typography>
                    <List>
                        {musicQueue.length === 0 ? (
                            <ListItem><ListItemText primary="Queue is empty" /></ListItem>
                        ) : (
                            musicQueue.map((music) => (
                                <ListItem key={music.id} secondaryAction={
                                    <IconButton edge="end" aria-label="play" onClick={() => handlePlayTrackFromQueue(music.id)}>
                                        <img src={PlayArrowSVG()} alt="play_arrow" style={{ width: 24, height: 24 }} />
                                    </IconButton>
                                }>
                                    <ListItemText
                                        primary={music.title || 'Unknown Title'}
                                        secondary={music.artist || 'Unknown Artist'}
                                    />
                                </ListItem>
                            ))
                        )}
                    </List>
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default ServerView; 