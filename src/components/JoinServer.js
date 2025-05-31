import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    TextField,
    Button,
    Typography,
    Paper,
    Alert
} from '@mui/material';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import config from '../config';

const JoinServer = () => {
    const [inviteCode, setInviteCode] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { token } = useAuth();

    const handleJoin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const response = await axios.post(
                `${config.API_BASE_URL}/servers/join/${inviteCode}`,
                {},
                {
                    headers: { Authorization: `Bearer ${token}` }
                }
            );
            
            // Navigate to the joined server
            navigate(`/servers/${response.data.server.id}`);
        } catch (error) {
            setError(error.response?.data?.detail || 'Failed to join server');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box sx={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '100vh',
            bgcolor: 'background.default'
        }}>
            <Paper sx={{ p: 4, maxWidth: 400, width: '100%' }}>
                <Typography variant="h5" sx={{ mb: 3, textAlign: 'center' }}>
                    Join a Server
                </Typography>
                
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}
                
                <form onSubmit={handleJoin}>
                    <TextField
                        fullWidth
                        label="Invite Code"
                        value={inviteCode}
                        onChange={(e) => setInviteCode(e.target.value)}
                        sx={{ mb: 2 }}
                        required
                    />
                    
                    <Button
                        fullWidth
                        variant="contained"
                        type="submit"
                        disabled={loading}
                    >
                        {loading ? 'Joining...' : 'Join Server'}
                    </Button>
                </form>
            </Paper>
        </Box>
    );
};

export default JoinServer; 