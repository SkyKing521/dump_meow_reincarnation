// Server configuration
const SERVER_IP = "26.34.237.219";
const SERVER_PORT = '8000'; // Fixed server port
const CLIENT_PORT = '3001'; // Fixed client port

// API endpoints
const API_BASE_URL = `https://${SERVER_IP}:${SERVER_PORT}`;
const WS_BASE_URL = `wss://${SERVER_IP}:${SERVER_PORT}`;

export default {
    SERVER_IP,
    SERVER_PORT,
    CLIENT_PORT,
    API_BASE_URL,
    WS_BASE_URL
}; 
