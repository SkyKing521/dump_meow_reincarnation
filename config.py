# Server configuration
SERVER_IP = "0.0.0.0"  # Network IP address
SERVER_PORT = 8000

# Database configuration
import os
DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
os.makedirs(DB_DIR, exist_ok=True)
DATABASE_URL = f"sqlite:///{os.path.join(DB_DIR, 'dump.db')}"

# JWT Configuration
SECRET_KEY = "hui228"  # Match with main.py and auth.py
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Media configuration
UPLOAD_DIR = "uploads"
MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {
    "image": ["jpg", "jpeg", "png", "gif"],
    "video": ["mp4", "webm", "mov"],
    "audio": ["mp3", "wav", "ogg"],
    "document": ["pdf", "doc", "docx", "txt"]
}

# Game configuration
MAX_PLAYERS_PER_GAME = 10
GAME_TYPES = ["CHESS", "TIC_TAC_TOE", "HANGMAN", "QUIZ"]

# Music configuration
MAX_QUEUE_SIZE = 50
SUPPORTED_AUDIO_FORMATS = ["mp3", "wav", "ogg"]

# CORS configuration
CORS_ORIGINS = [
    "http://localhost:3000",  # React development server
    "http://127.0.0.1:3000",
    "http://localhost:8000",  # API server
    "ws://localhost:8000",    # WebSocket
    "wss://localhost:8000",   # Secure WebSocket
    f"http://{SERVER_IP}:3000",  # Network React server
    f"http://{SERVER_IP}:8000",  # Network API server
    f"ws://{SERVER_IP}:8000",    # Network WebSocket
    f"wss://{SERVER_IP}:8000"    # Network Secure WebSocket
] 