import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Paper,
    Typography,
    IconButton,
    Slider,
    Tooltip,
    Avatar,
    styled,
    Fab
} from '@mui/material';
import Draggable from 'react-draggable';
import playIcon from '../icons/icons8-play-в-круге-50.png';
import pauseIcon from '../icons/icons8-стой-50.png';
import musicIcon from '../icons/logo.png';
import closeIcon from '../icons/eye_closed.png';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import stopIcon from '../icons/eye_closed.png';     
import config from '../config';
import ReactPlayer from 'react-player';

const PlayerContainer = styled(Paper)(({ theme }) => ({
    position: 'fixed',
    bottom: 20,
    right: 20,
    width: 300,
    backgroundColor: theme.palette.background.paper,
    borderRadius: 8,
    boxShadow: theme.shadows[3],
    padding: theme.spacing(2),
    zIndex: 1000,
    cursor: 'move',
    '&:hover': {
        boxShadow: theme.shadows[6],
    },
}));

const DragHandle = styled(DragIndicatorIcon)(({ theme }) => ({
    cursor: 'move',
    position: 'absolute',
    top: 8,
    right: 8,
    color: theme.palette.text.secondary,
}));

const PlayerContent = styled(Box)(({ theme }) => ({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
}));

const TrackInfo = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
}));

const Controls = styled(Box)(({ theme }) => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
}));

const ToggleButton = styled(Fab)(({ theme }) => ({
    position: 'fixed',
    bottom: 20,
    right: 20,
    zIndex: 1000,
    backgroundColor: theme.palette.primary.main,
    '&:hover': {
        backgroundColor: theme.palette.primary.dark,
    },
}));

const formatTime = (ms) => {
    if (!ms) return '0:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// SVG компоненты для стрелок
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

const VolumeUpSVG = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="3,9 9,9 13,5 13,19 9,15 3,15" fill="#ff0aca" />
    <path d="M16 7C17.6569 8.65685 17.6569 11.3431 16 13" stroke="#ff0aca" strokeWidth="2" fill="none" />
  </svg>
);

const PersistentMusicPlayer = ({ channelId }) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [currentTrack, setCurrentTrack] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [prevTrackId, setPrevTrackId] = useState(null);
    const POLL_INTERVAL = 2000; // Increase polling interval to 2 seconds

    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);

    const playerRef = useRef(null);

    const getTrackId = (track) => {
        if (!track) return null;
        return `${track.name || ''}__${track.artist || ''}`;
    };

    // Effect to set initial volume and handle volume changes
    useEffect(() => {
        if (playerRef.current) {
            playerRef.current.volume = 1; // Set initial volume to 100%
        }
    }, []);

    // Effect to handle play/pause based on isPlaying state
    useEffect(() => {
        console.log('isPlaying state changed:', isPlaying);
        console.log(`ReactPlayer playing prop set to: ${isPlaying}`);
    }, [isPlaying]); // Depend on isPlaying state

    // Handlers for audio element events
    const handleTimeUpdate = () => {
        if (playerRef.current) {
            setCurrentTime(playerRef.current.getCurrentTime());
        }
    };

    const handleLoadedMetadata = () => {
        if (playerRef.current) {
            setDuration(playerRef.current.getDuration());
        }
    };

    const handleVolumeChange = (event, newValue) => {
        if (playerRef.current) {
            playerRef.current.volume = newValue / 100; // Slider value is 0-100, volume is 0-1
        }
    };

    // Handler for when the audio track ends
    const handleTrackEnded = async () => {
        console.log('Track ended. Skipping to next...');
        console.log('[FRONTEND] handleTrackEnded called. currentTrack:', currentTrack, 'isPlaying:', isPlaying);
        // Call the backend API to skip to the next track
        if (channelId) {
            try {
                await fetch(`${config.API_BASE_URL}/music/skip-next?channel_id=${channelId}`, {
                    method: 'POST',
                });
                // The polling useEffect will fetch the new current track and state
            } catch (error) {
                console.error('Error skipping to next track after end:', error);
            }
        }
    };

    useEffect(() => {
        console.log('Polling effect triggered. channelId:', channelId);
        console.log('[FRONTEND] Polling effect dependencies changed. channelId:', channelId, 'isVisible:', isVisible, 'prevTrackId:', prevTrackId, 'isPlaying:', isPlaying);
        if (!channelId) {
            setCurrentTrack(null);
            setIsPlaying(false);
            setPrevTrackId(null);
            console.log('No channel selected, resetting player state.');
            return; // Don't poll if no channel is selected
        }
        const pollInterval = setInterval(async () => {
            try {
                console.log('Fetching current track state for channel:', channelId);
                const response = await fetch(`${config.API_BASE_URL}/music/current-track?channel_id=${channelId}`);
                const data = await response.json();
                console.log('Received track state data:', data);
                console.log('[FRONTEND] Polling received data:', data);
                if (data && !data.error) {
                    // Update current track and playback state
                    setCurrentTrack(data.current_track);
                    setIsPlaying(data.is_playing);
                    // Note: current_time from backend is not used for frontend playback time

                    // Check if the track has changed and update the audio source
                    const newTrackId = getTrackId(data.current_track);
                    console.log('Current Track:', data.current_track, 'Prev Track ID:', prevTrackId, 'New Track ID:', newTrackId);
                    if (playerRef.current && prevTrackId !== newTrackId) {
                        console.log('Track changed. Loading new audio source:', data.current_track?.url);
                        // ReactPlayer loads the new URL automatically when the 'url' prop changes
                        setPrevTrackId(newTrackId);
                    } else if (playerRef.current && data.current_track && isPlaying && !playerRef.current.getInternalPlayer()?.playing) {
                         // If track hasn't changed but state is playing and audio is paused, try playing
                         console.log('Track same, but isPlaying is true and audio paused. Attempting play.');
                         // ReactPlayer handles playing via the 'playing' prop
                    }
                } else {
                    console.log('Received empty or error data for track state.');
                    setCurrentTrack(null);
                    setIsPlaying(false);
                    setPrevTrackId(null);
                }
            } catch (error) {
                console.error('Error fetching current track:', error);
            }
        }, POLL_INTERVAL);

        return () => {
            clearInterval(pollInterval);
            console.log('Polling interval cleared. Pausing and resetting audio.');
            // ReactPlayer handles cleanup when the component unmounts or the url changes
        };
    }, [channelId, isVisible, prevTrackId, isPlaying]); // Added isPlaying to dependency array

    const handleDragStop = (e, data) => {
        setPosition({ x: data.x, y: data.y });
    };

    const handlePlayPause = async () => {
        if (!channelId || !currentTrack) return; // Don't do anything if no channel or track
        console.log('[FRONTEND] handlePlayPause called. current isPlaying:', isPlaying);
        try {
            const newState = !isPlaying;
            console.log('[FRONTEND] handlePlayPause sending is_playing:', newState);
            const response = await fetch(`${config.API_BASE_URL}/music/playback-state?channel_id=${channelId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    is_playing: newState
                })
            });
            if (response.ok) {
                // Only update local state if backend call was successful
                setIsPlaying(newState);
                console.log('[FRONTEND] handlePlayPause received OK response. Updated local isPlaying to:', newState);
                // ReactPlayer will automatically play/pause based on the updated isPlaying state
            }
        } catch (error) {
            console.error('Error toggling playback:', error);
        }
    };

    const handleSkipNext = async () => {
        console.log('Attempting to skip to next track...');
        console.log('[FRONTEND] handleSkipNext called. currentTrack:', currentTrack);
        if (channelId) {
            try {
                const response = await fetch(`${config.API_BASE_URL}/music/skip-next?channel_id=${channelId}`, {
                    method: 'POST',
                });
                if (response.ok) {
                    // Backend handles updating the current track and playback state
                    // The polling useEffect will pick up the changes
                }
            } catch (error) {
                console.error('Error skipping to next track:', error);
            }
        }
    };

    const handleSkipPrevious = async () => {
        console.log('Attempting to skip to previous track...');
        console.log('[FRONTEND] handleSkipPrevious called. currentTrack:', currentTrack);
        if (channelId) {
            try {
                const response = await fetch(`${config.API_BASE_URL}/music/skip-previous?channel_id=${channelId}`, {
                    method: 'POST',
                });
                if (response.ok) {
                    // Backend handles updating the current track and playback state
                    // The polling useEffect will pick up the changes
                }
            } catch (error) {
                console.error('Error skipping to previous track:', error);
            }
        }
    };

    const handleSeek = (event, newValue) => {
        if (playerRef.current) {
            playerRef.current.seekTo(newValue);
        }
    };

    return (
        <>
            {!isVisible && (
                <ToggleButton
                    color="primary"
                    onClick={() => setIsVisible(true)}
                    size="medium"
                >
                    <img src={musicIcon} alt="music" style={{ width: 24, height: 24 }} />
                </ToggleButton>
            )}
            
            {isVisible && (
                <Draggable
                    handle=".drag-handle"
                    bounds="parent"
                    position={position}
                    onStop={(e, data) => setPosition({ x: data.x, y: data.y })}
                >
                    <PlayerContainer>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                            <IconButton
                                size="small"
                                onClick={() => setIsVisible(false)}
                                sx={{ position: 'absolute', top: 4, right: 30 }}
                            >
                                <img src={closeIcon} alt="close" style={{ width: 24, height: 24 }} />
                            </IconButton>
                            <DragHandle className="drag-handle" />
                        </Box>
                        
                        <PlayerContent>
                            <TrackInfo>
                                {currentTrack?.image_url && (
                                    <Avatar
                                        src={currentTrack.image_url}
                                        alt={currentTrack?.name}
                                        variant="rounded"
                                        sx={{ width: 48, height: 48 }}
                                    />
                                )}
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="subtitle1" noWrap>
                                        {currentTrack?.name ? currentTrack.name : 'Нет активного трека'}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" noWrap>
                                        {currentTrack?.artist ? currentTrack.artist : 'Выберите музыку для воспроизведения'}
                                    </Typography>
                                </Box>
                            </TrackInfo>

                            {/* Playback progress slider and time display */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body2" sx={{ color: '#ff78e2' }}>{formatTime(currentTime * 1000)}</Typography>
                                <Slider
                                    value={currentTime}
                                    max={duration}
                                    onChange={handleSeek}
                                    disabled={!currentTrack}
                                    sx={{
                                        flexGrow: 1,
                                        color: '#ff0aca',
                                        '& .MuiSlider-thumb': {
                                            width: 12,
                                            height: 12,
                                        },
                                    }}
                                />
                                <Typography variant="body2" sx={{ color: '#ff78e2' }}>{formatTime(duration * 1000)}</Typography>
                            </Box>

                            <Controls>
                                <Box>
                                    <IconButton size="small" disabled={!currentTrack} onClick={handleSkipPrevious}>
                                        <SkipPrevSVG />
                                    </IconButton>
                                    <IconButton 
                                        onClick={handlePlayPause}
                                        disabled={!currentTrack}
                                    >
                                        {isPlaying ? <img src={pauseIcon} alt="pause" style={{ width: 24, height: 24 }} /> : <img src={playIcon} alt="play" style={{ width: 24, height: 24 }} />}
                                    </IconButton>
                                    <IconButton size="small" disabled={!currentTrack} onClick={handleSkipNext}>
                                        <SkipNextSVG />
                                    </IconButton>
                                </Box>
                                <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
                                    <img src={VolumeUpSVG} alt="volume_up" style={{ width: 24, height: 24 }} />
                                    <Slider
                                        value={playerRef.current ? playerRef.current.volume * 100 : 100}
                                        onChange={handleVolumeChange}
                                        sx={{ width: 100, ml: 1 }}
                                    />
                                </Box>
                            </Controls>

                            {/* ReactPlayer component */}
                            {currentTrack?.url && (
                                <ReactPlayer
                                    ref={playerRef}
                                    url={currentTrack.url}
                                    playing={isPlaying}
                                    volume={playerRef.current ? playerRef.current.volume : 1} // Use playerRef for volume
                                    onDuration={duration => setDuration(duration)}
                                    onEnded={handleTrackEnded}
                                    onError={e => console.error('ReactPlayer error:', e)}
                                    onReady={() => console.log('ReactPlayer ready')}
                                    onStart={() => console.log('ReactPlayer started')}
                                    onPlay={() => { console.log('ReactPlayer playing'); if (!isPlaying) setIsPlaying(true); /* Optional: update backend? */ }}
                                    onPause={() => { console.log('ReactPlayer paused'); if (isPlaying) setIsPlaying(false); /* Optional: update backend? */ }}
                                    onBuffer={() => console.log('ReactPlayer buffering')}
                                    onBufferEnd={() => console.log('ReactPlayer buffer end')}
                                    onSeek={e => console.log('ReactPlayer seek', e)}
                                    onProgress={state => {
                                        // console.log('ReactPlayer progress', state);
                                        setCurrentTime(state.playedSeconds);
                                    }}
                                    width='100%'
                                    height='100%'
                                />
                            )}
                        </PlayerContent>
                    </PlayerContainer>
                </Draggable>
            )}
        </>
    );
};

export default PersistentMusicPlayer; 