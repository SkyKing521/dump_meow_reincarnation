import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import ServerView from './components/ServerView';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PersistentMusicPlayer from './components/PersistentMusicPlayer';
import { Box } from '@mui/material';
import GifWidgetsBoard from './components/GifWidgetsBoard';
import logoIcon from './icons/logo.png';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#ff0aca',
      contrastText: '#fff',
    },
    secondary: {
      main: '#ffb6ea',
    },
    background: {
      default: '#000000',
      paper: '#000000',
    },
    text: {
      primary: '#ff0aca',
      secondary: '#ff0aca',
      disabled: '#ff0aca',
    },
  },
  typography: {
    allVariants: {
      color: '#ff0aca',
    },
  },
});

const PrivateRoute = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" />;
};

const AppContent = () => {
  const { isAuthenticated } = useAuth();
  const [selectedChannelId, setSelectedChannelId] = React.useState(null);

  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />
        <Route
          path="/servers/:serverId"
          element={
            <PrivateRoute>
              <ServerView onChannelSelect={setSelectedChannelId} />
            </PrivateRoute>
          }
        />
      </Routes>
      <PersistentMusicPlayer channelId={selectedChannelId} />
      <GifWidgetsBoard />
    </>
  );
};

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App; 