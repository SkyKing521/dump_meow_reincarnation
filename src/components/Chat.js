import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Paper,
  Typography,
  Avatar,
  Grid
} from '@mui/material';
import { Send, AttachFile } from '@mui/icons-material';
import MediaUpload from './MediaUpload';
import VoiceRecorder from './VoiceRecorder';

const Chat = ({ messages, onSendMessage, currentUser }) => {
  const [message, setMessage] = useState('');
  const [showMediaUpload, setShowMediaUpload] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (message.trim() || showMediaUpload) {
      onSendMessage(message);
      setMessage('');
      setShowMediaUpload(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (file) => {
    onSendMessage('', file);
    setShowMediaUpload(false);
  };

  const handleSendVoice = (voiceUrl) => {
    onSendMessage('', { type: 'voice', url: voiceUrl });
  };

  const renderMessage = (msg) => {
    const isCurrentUser = msg.userId === currentUser.id;
    return (
      <Box
        key={msg.id}
        sx={{
          display: 'flex',
          justifyContent: isCurrentUser ? 'flex-end' : 'flex-start',
          mb: 2
        }}
      >
        <Box
          sx={{
            maxWidth: '70%',
            bgcolor: isCurrentUser ? 'primary.main' : 'grey.100',
            color: isCurrentUser ? 'white' : 'text.primary',
            borderRadius: 2,
            p: 2
          }}
        >
          {!isCurrentUser && (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Avatar src={msg.avatar} sx={{ width: 24, height: 24, mr: 1 }}>
                {msg.username[0]}
              </Avatar>
              <Typography variant="subtitle2">{msg.username}</Typography>
            </Box>
          )}
          
          {msg.media && (
            <Box sx={{ mb: 1 }}>
              {msg.media.type === 'image' && (
                <img
                  src={msg.media.url}
                  alt={msg.media.name}
                  style={{ maxWidth: '100%', borderRadius: 4 }}
                />
              )}
              {msg.media.type === 'video' && (
                <video
                  controls
                  style={{ maxWidth: '100%', borderRadius: 4 }}
                >
                  <source src={msg.media.url} type="video/mp4" />
                </video>
              )}
              {msg.media.type === 'audio' && (
                <audio controls style={{ width: '100%' }}>
                  <source src={msg.media.url} type="audio/mpeg" />
                </audio>
              )}
            </Box>
          )}
          
          {msg.text && (
            <Typography variant="body1">{msg.text}</Typography>
          )}
          
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            {new Date(msg.timestamp).toLocaleTimeString()}
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          bgcolor: 'background.default'
        }}
      >
        {messages.map(renderMessage)}
        <div ref={messagesEndRef} />
      </Box>

      <Paper
        sx={{
          p: 2,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider'
        }}
      >
        {showMediaUpload && (
          <Box sx={{ mb: 2 }}>
            <MediaUpload onFileUpload={handleFileUpload} />
          </Box>
        )}
        
        <Grid container spacing={1} alignItems="center">
          <Grid item>
            <IconButton
              onClick={() => setShowMediaUpload(!showMediaUpload)}
              color={showMediaUpload ? 'primary' : 'default'}
            >
              <AttachFile />
            </IconButton>
          </Grid>
          <Grid item xs>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Введите сообщение..."
              variant="outlined"
              size="small"
            />
          </Grid>
          <Grid item>
            <IconButton
              color="primary"
              onClick={handleSend}
              disabled={!message.trim() && !showMediaUpload}
            >
              <Send />
            </IconButton>
          </Grid>
        </Grid>
      </Paper>

      <Paper
        sx={{
          p: 2,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider'
        }}
      >
        <VoiceRecorder onSend={handleSendVoice} />
      </Paper>
    </Box>
  );
};

export default Chat; 