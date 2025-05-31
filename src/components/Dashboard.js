import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  IconButton,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Home as HomeIcon,
  Logout as LogoutIcon,
  ContentCopy as ContentCopyIcon,
  PersonAdd as PersonAddIcon
} from '@mui/icons-material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import config from '../config';
import logoIcon from '../icons/logo.png';

const drawerWidth = 240;

function Dashboard() {
  const [servers, setServers] = useState([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [selectedServer, setSelectedServer] = useState(null);
  const [inviteCodeGenerated, setInviteCodeGenerated] = useState('');
  const navigate = useNavigate();
  const { logout, token } = useAuth();

  useEffect(() => {
    fetchServers();
  }, []);

  const fetchServers = async () => {
    try {
      const response = await axios.get(`${config.API_BASE_URL}/servers/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setServers(response.data);
    } catch (error) {
      console.error('Error fetching servers:', error);
    }
  };

  const handleCreateServer = async () => {
    try {
      const response = await axios.post(
        `${config.API_BASE_URL}/servers/`,
        { name: newServerName },
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setServers([...servers, response.data]);
      setShowCreateDialog(false);
      setNewServerName('');
    } catch (error) {
      console.error('Error creating server:', error);
      alert('Failed to create server. Please try again.');
    }
  };

  const handleJoinServer = async () => {
    try {
      const response = await axios.post(
        `${config.API_BASE_URL}/servers/join/${inviteCode}`,
        {},
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setServers([...servers, response.data]);
      setShowJoinDialog(false);
      setInviteCode('');
    } catch (error) {
      console.error('Error joining server:', error);
      alert('Failed to join server. Invalid invite code or you are already a member.');
    }
  };

  const handleGenerateInvite = async (serverId) => {
    try {
      const response = await axios.post(
        `${config.API_BASE_URL}/servers/${serverId}/invite`,
        {},
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      setInviteCodeGenerated(response.data.code);
      setShowInviteDialog(true);
    } catch (error) {
      console.error('Error generating invite code:', error);
      alert('Failed to generate invite code. Please try again.');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Invite code copied to clipboard!');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            bgcolor: '#2f3136',
          },
        }}
      >
        <Box sx={{ overflow: 'auto', height: '100%', display: 'flex', flexDirection: 'column' }}>
          <List>
            <ListItem button onClick={() => navigate('/')}>
              <ListItemIcon>
                <img src={logoIcon} alt="logo" style={{ width: 32, height: 32, marginRight: 8 }} />
              </ListItemIcon>
              <ListItemText
                primary={<span style={{ display: 'flex', alignItems: 'center', color: '#ff78e2', fontWeight: 700, fontSize: 22 }}>
                  DUMP
                </span>}
              />
            </ListItem>
          </List>
          <Typography variant="subtitle2" sx={{ px: 2, mt: 2, color: 'gray' }}>
            СЕРВЕРЫ
          </Typography>
          <List>
            {servers.map((server) => (
              <ListItem
                key={server.id}
                button
                onClick={() => navigate(`/servers/${server.id}`)}
                secondaryAction={
                  <Tooltip title="Generate Invite">
                    <IconButton
                      edge="end"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedServer(server);
                        handleGenerateInvite(server.id);
                      }}
                    >
                      <PersonAddIcon />
                    </IconButton>
                  </Tooltip>
                }
              >
                <ListItemText
                  primary={server.name}
                  secondary={`Owner: ${server.owner?.username || 'Unknown'}`}
                />
              </ListItem>
            ))}
            <ListItem button onClick={() => setShowCreateDialog(true)}>
              <ListItemIcon>
                <AddIcon sx={{ color: 'white' }} />
              </ListItemIcon>
              <ListItemText primary="Создать сервер" />
            </ListItem>
          </List>
          <List sx={{ mt: 'auto' }}>
            <ListItem button onClick={handleLogout}>
              <ListItemIcon>
                <LogoutIcon sx={{ color: 'white' }} />
              </ListItemIcon>
              <ListItemText primary="Выйти" />
            </ListItem>
          </List>
        </Box>
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ flex: 1 }}>Сервера</Typography>
          
          <Button variant="outlined" color="primary" onClick={() => setShowJoinDialog(true)}>
            Присоединиться по инвайт-коду
          </Button>
        </Box>
        <Typography variant="h4" sx={{ mb: 2 }}>
          Добро пожаловать!
        </Typography>
        <Typography variant="body1">
          Выберите сервер из списка слева или создайте новый.
        </Typography>
        <Box sx={{ mt: 3 }}>
          <Button variant="outlined" color="primary" onClick={() => setShowJoinDialog(true)}>
            Присоединиться по инвайт-коду
          </Button>
        </Box>
      </Box>

      <Dialog open={showCreateDialog} onClose={() => setShowCreateDialog(false)}>
        <DialogTitle>Создать новый сервер</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Название сервера"
            fullWidth
            value={newServerName}
            onChange={(e) => setNewServerName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCreateDialog(false)}>Отмена</Button>
          <Button onClick={handleCreateServer} variant="contained">
            Создать
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showJoinDialog} onClose={() => setShowJoinDialog(false)}>
        <DialogTitle>Присоединиться к серверу по инвайт-коду</DialogTitle>
        <DialogContent>
          <TextField
            label="Инвайт-код"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            fullWidth
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowJoinDialog(false)}>Отмена</Button>
          <Button onClick={handleJoinServer} variant="contained" color="primary">Присоединиться</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showInviteDialog} onClose={() => setShowInviteDialog(false)}>
        <DialogTitle>Инвайт-код для сервера</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <TextField value={inviteCodeGenerated} InputProps={{ readOnly: true }} fullWidth />
            <IconButton onClick={() => copyToClipboard(inviteCodeGenerated)}>
              <ContentCopyIcon />
            </IconButton>
          </Box>
          <Typography variant="caption" color="text.secondary">Передайте этот код другу для присоединения к серверу.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowInviteDialog(false)}>Закрыть</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Dashboard; 