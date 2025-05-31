from fastapi import FastAPI, Depends, HTTPException, status, Request, UploadFile, File, WebSocket, WebSocketDisconnect, Form
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
import uvicorn
from datetime import datetime, timedelta
import json
from jose import JWTError, jwt
import socket
import base64
import websockets
import os
import shutil
import uuid
import asyncio
import time
import httpx
import subprocess

from database import *
import models as models
import schemas as schemas
import auth as auth
import crud as crud
import config
from audio_handler import audio_handler

# In-memory storage for music queues and playback state
# Structure: { channel_id: { 'queue': [{id, url, title, artist, duration}, ...], 'current_index': int, 'is_playing': bool, 'current_time': float } }
music_players: Dict[int, Dict[str, Any]] = {}

# Import User model explicitly
from models import User, Channel, ServerMember, Message

# Create database tables
try:
    # Only create tables if they don't exist
    models.Base.metadata.create_all(bind=engine)
    print("Database tables created successfully")
except Exception as e:
    print(f"Error creating database tables: {e}")

app = FastAPI(title="Dump API")

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:3002",
        "http://26.34.237.219:3000",
        "https://26.34.237.219:3000",
        "https://26.34.237.219:3001",
        "https://26.34.237.219:3002",
        "https://26.34.237.219:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600
)

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

manager = ConnectionManager()

# Voice channel WebSocket connection manager
class VoiceChannelManager:
    def __init__(self):
        self.voice_channels = {}  # channel_id -> set of user_ids
        self.user_channels = {}   # user_id -> channel_id
        self.audio_streams = {}   # (channel_id, user_id) -> {'input': stream, 'output': stream}
        self.user_websockets = {} # user_id -> websocket
        self.connection_locks = {} # channel_id -> asyncio.Lock
        self._cleanup_task = None
        self.user_states = {}     # user_id -> {'isMuted': bool, 'isDeafened': bool}

    async def _start_cleanup_task(self):
        """Запускает периодическую очистку неактивных соединений"""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_inactive_connections())

    async def _cleanup_inactive_connections(self):
        """Периодически проверяет и очищает неактивные соединения"""
        while True:
            try:
                await asyncio.sleep(300)  # Проверка каждые 5 минут
                current_time = datetime.now()
                
                # Очистка неактивных WebSocket соединений
                for user_id, websocket in list(self.user_websockets.items()):
                    if not websocket.client_state.CONNECTED:
                        await self.disconnect_user(user_id)
                
                # Очистка неиспользуемых аудио потоков
                for stream_id, streams in list(self.audio_streams.items()):
                    channel_id, user_id = stream_id
                    if user_id not in self.user_websockets:
                        audio_handler.close_stream(stream_id)
                        del self.audio_streams[stream_id]
            except Exception as e:
                print(f"Error in cleanup task: {e}")

    async def connect_user(self, websocket, channel_id, user_id):
        try:
            print(f"[VOICE] Attempting to connect user {user_id} to channel {channel_id}")
            
            # Получаем или создаем блокировку для канала
            if channel_id not in self.connection_locks:
                self.connection_locks[channel_id] = asyncio.Lock()
            
            async with self.connection_locks[channel_id]:
                if channel_id not in self.voice_channels:
                    self.voice_channels[channel_id] = set()
                
                # Проверяем, не подключен ли уже пользователь
                if user_id in self.user_channels:
                    old_channel_id = self.user_channels[user_id]
                    if old_channel_id != channel_id:
                        print(f"[VOICE] User {user_id} was in channel {old_channel_id}, disconnecting")
                        await self.disconnect_user(user_id)
                
                # Добавляем пользователя в канал
                self.voice_channels[channel_id].add(user_id)
                self.user_channels[user_id] = channel_id
                self.user_websockets[user_id] = websocket
                
                # Инициализируем состояние пользователя
                self.user_states[user_id] = {
                    'isMuted': False,
                    'isDeafened': False,
                    'isVideoEnabled': False,
                    'isScreenSharing': False
                }
                
                # Создаем аудио потоки
                input_stream = audio_handler.create_input_stream((channel_id, user_id))
                output_stream = audio_handler.create_output_stream((channel_id, user_id))
                
                if input_stream and output_stream:
                    self.audio_streams[(channel_id, user_id)] = {
                        'input': input_stream,
                        'output': output_stream
                    }
                    print(f"[VOICE] Audio streams created for user {user_id} in channel {channel_id}")
                else:
                    raise RuntimeError("Failed to create audio streams")
                
                # Запускаем задачу очистки, если она еще не запущена
                await self._start_cleanup_task()
                
                # Уведомляем других участников
                await self.broadcast_user_joined(channel_id, user_id)
                
                # Отправляем список участников всем пользователям в канале
                await self.send_participants_list(channel_id)
                
                print(f"[VOICE] User {user_id} successfully connected to channel {channel_id}")
                
                try:
                    while True:
                        try:
                            data = await websocket.receive()
                        except WebSocketDisconnect:
                            print(f"[VOICE] User {user_id} disconnected")
                            break
                        except Exception as e:
                            print(f"[VOICE] Exception in receive: {e}")
                            break
                            
                        if data['type'] == 'websocket.disconnect':
                            print(f"[VOICE] Disconnect received for user {user_id}")
                            break
                            
                        if 'text' in data:
                            try:
                                msg = data['text']
                                parsed = json.loads(msg)
                                
                                if parsed['type'] == 'audio':
                                    print(f"[VOICE] Received audio from user {user_id}")
                                    await self.handle_audio_data(channel_id, user_id, parsed['data'])
                                elif parsed['type'] == 'video':
                                    await self.broadcast_video(channel_id, user_id, parsed['data'])
                                elif parsed['type'] == 'screen':
                                    await self.broadcast_screen(channel_id, user_id, parsed['data'])
                                elif parsed['type'] == 'state_update':
                                    # Обновляем состояние пользователя
                                    if user_id in self.user_states:
                                        self.user_states[user_id].update(parsed.get('state', {}))
                                        # Уведомляем других участников об изменении состояния
                                        await self.broadcast_user_state(channel_id, user_id)
                                elif parsed['type'] == 'join':
                                    await self.send_participants_list(channel_id)
                            except json.JSONDecodeError as e:
                                print(f"Error decoding message from user {user_id}: {e}")
                            except Exception as e:
                                print(f"Error processing message from user {user_id}: {e}")
                finally:
                    await self.disconnect_user(user_id)
        except Exception as e:
            print(f"Error in connect_user: {e}")
            await self.disconnect_user(user_id)
            raise

    async def disconnect_user(self, user_id):
        try:
            if user_id in self.user_channels:
                channel_id = self.user_channels[user_id]
                
                # Удаляем пользователя из канала
                if channel_id in self.voice_channels:
                    self.voice_channels[channel_id].discard(user_id)
                    if not self.voice_channels[channel_id]:
                        del self.voice_channels[channel_id]
                
                # Закрываем аудио потоки
                stream_id = (channel_id, user_id)
                if stream_id in self.audio_streams:
                    audio_handler.close_stream(stream_id)
                    del self.audio_streams[stream_id]
                
                # Удаляем WebSocket соединение
                if user_id in self.user_websockets:
                    del self.user_websockets[user_id]
                
                # Удаляем информацию о канале пользователя
                del self.user_channels[user_id]
                
                # Уведомляем других участников
                await self.broadcast_user_left(channel_id, user_id)
                await self.send_participants_list(channel_id)
        except Exception as e:
            print(f"Error in disconnect_user: {e}")

    async def handle_audio_data(self, channel_id, sender_id, audio_data):
        if channel_id in self.voice_channels:
            for user_id in self.voice_channels[channel_id]:
                if user_id != sender_id:
                    try:
                        websocket = self.user_websockets.get(user_id)
                        if websocket and websocket.client_state.CONNECTED:
                            # Проверяем, что аудио данные не пустые
                            if not audio_data:
                                print(f"Empty audio data from user {sender_id}")
                                continue

                            # Отправляем аудио данные
                            await websocket.send_json({
                                'type': 'audio',
                                'sender_id': sender_id,
                                'data': audio_data,
                                'channel_id': channel_id,
                                'timestamp': datetime.now().timestamp()
                            })
                            
                            # Воспроизводим аудио локально
                            stream_id = (channel_id, user_id)
                            if stream_id in self.audio_streams:
                                audio_handler.play_audio(stream_id, audio_data)
                    except Exception as e:
                        print(f"Error sending audio to user {user_id}: {e}")
                        # Если не удалось отправить аудио, отключаем пользователя
                        await self.disconnect_user(user_id)

    async def broadcast_user_joined(self, channel_id, user_id):
        if channel_id in self.voice_channels:
            state = self.user_states.get(user_id, {})
            message = {
                'type': 'participant_joined',
                'participant': {
                    'id': user_id,
                    'isMuted': state.get('isMuted', False),
                    'isDeafened': state.get('isDeafened', False),
                    'isVideoEnabled': state.get('isVideoEnabled', False),
                    'isScreenSharing': state.get('isScreenSharing', False)
                },
                'channel_id': channel_id
            }
            print(f"[VOICE] Broadcasting user {user_id} joined to channel {channel_id}")
            await self.broadcast_to_channel(channel_id, message)

    async def broadcast_user_left(self, channel_id, user_id):
        if channel_id in self.voice_channels:
            message = {
                'type': 'participant_left',
                'userId': user_id
            }
            await self.broadcast_to_channel(channel_id, message)

    async def broadcast_to_channel(self, channel_id, message):
        if channel_id in self.voice_channels:
            for user_id in self.voice_channels[channel_id]:
                try:
                    websocket = self.user_websockets.get(user_id)
                    if websocket:
                        await websocket.send_json(message)
                except Exception as e:
                    print(f"Error broadcasting to user {user_id}: {e}")
                    # Если не удалось отправить сообщение, отключаем пользователя
                    await self.disconnect_user(user_id)

    async def broadcast_video(self, channel_id, sender_id, video_data):
        if channel_id in self.voice_channels:
            message = {
                'type': 'video',
                'sender_id': sender_id,
                'data': video_data
            }
            await self.broadcast_to_channel(channel_id, message)

    async def broadcast_screen(self, channel_id, sender_id, screen_data):
        if channel_id in self.voice_channels:
            message = {
                'type': 'screen',
                'sender_id': sender_id,
                'data': screen_data
            }
            await self.broadcast_to_channel(channel_id, message)

    async def broadcast_user_state(self, channel_id, user_id):
        if channel_id in self.voice_channels:
            state = self.user_states.get(user_id, {})
            message = {
                'type': 'participant_state',
                'participant': {
                    'id': user_id,
                    'isMuted': state.get('isMuted', False),
                    'isDeafened': state.get('isDeafened', False),
                    'isVideoEnabled': state.get('isVideoEnabled', False),
                    'isScreenSharing': state.get('isScreenSharing', False)
                },
                'channel_id': channel_id
            }
            await self.broadcast_to_channel(channel_id, message)

    def cleanup(self):
        # Clean up all audio streams
        for stream_key in list(self.audio_streams.keys()):
            try:
                if 'input' in self.audio_streams[stream_key]:
                    self.audio_streams[stream_key]['input'].stop_stream()
                    self.audio_streams[stream_key]['input'].close()
                if 'output' in self.audio_streams[stream_key]:
                    self.audio_streams[stream_key]['output'].stop_stream()
                    self.audio_streams[stream_key]['output'].close()
            except Exception as e:
                print(f"Error cleaning up audio stream {stream_key}: {e}")
        self.audio_streams.clear()
        audio_handler.cleanup()

    async def send_participants_list(self, channel_id):
        if channel_id in self.voice_channels:
            participants = []
            for user_id in self.voice_channels[channel_id]:
                state = self.user_states.get(user_id, {})
                participants.append({
                    'id': user_id,
                    'isMuted': state.get('isMuted', False),
                    'isDeafened': state.get('isDeafened', False),
                    'isVideoEnabled': state.get('isVideoEnabled', False),
                    'isScreenSharing': state.get('isScreenSharing', False)
                })
            
            message = {
                'type': 'participants',
                'participants': participants,
                'channel_id': channel_id
            }
            
            print(f"[VOICE] Sending participants list for channel {channel_id}: {participants}")
            await self.broadcast_to_channel(channel_id, message)

voice_manager = VoiceChannelManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle incoming WebSocket messages here
            await manager.broadcast(f"Message: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        await manager.broadcast("Client disconnected")

@app.websocket("/ws/voice/{channel_id}")
async def voice_channel_endpoint(websocket: WebSocket, channel_id: int, token: str):
    user = None
    db = None
    try:
        print(f"[{datetime.now()}] WebSocket connection attempt for channel {channel_id}")
        
        # Decode token and get user
        try:
            payload = jwt.decode(token, config.SECRET_KEY, algorithms=[config.ALGORITHM])
            user_email = payload.get("sub")
            if not user_email:
                print(f"[{datetime.now()}] Invalid token - no user email")
                await websocket.close(code=4000, reason="Invalid token")
                return
        except jwt.ExpiredSignatureError:
            print(f"[{datetime.now()}] Token expired, attempting to refresh")
            # Try to refresh the token
            try:
                db = SessionLocal()
                user = db.query(User).filter(User.email == payload.get("sub")).first()
                if user:
                    # Create new token
                    access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
                    new_token = auth.create_access_token(
                        data={"sub": user.email}, expires_delta=access_token_expires
                    )
                    # Update last login
                    user.last_login = datetime.now()
                    db.commit()
                    # Send new token to client
                    await websocket.accept()
                    await websocket.send_json({
                        "type": "token_refresh",
                        "token": new_token
                    })
                    token = new_token
                else:
                    await websocket.close(code=4000, reason="User not found")
                    return
            except Exception as e:
                print(f"[{datetime.now()}] Error refreshing token: {str(e)}")
                await websocket.close(code=4000, reason="Token refresh failed")
                return
        except jwt.JWTError as e:
            print(f"[{datetime.now()}] JWT decode error: {str(e)}")
            await websocket.close(code=4000, reason="Invalid token")
            return

        # Get user from database
        if not db:
            db = SessionLocal()
        try:
            user = db.query(User).filter(User.email == user_email).first()
            if not user:
                print(f"[{datetime.now()}] User not found for email: {user_email}")
                await websocket.close(code=4000, reason="User not found")
                return

            # Get channel and verify user is a member
            channel = db.query(Channel).filter(Channel.id == channel_id).first()
            if not channel:
                print(f"[{datetime.now()}] Channel not found: {channel_id}")
                await websocket.close(code=4000, reason="Channel not found")
                return

            # Check if user is a member of the server
            membership = db.query(ServerMember).filter(
                ServerMember.server_id == channel.server_id,
                ServerMember.user_id == user.id
            ).first()
            
            if not membership:
                print(f"[{datetime.now()}] User {user.id} is not a member of server {channel.server_id}")
                await websocket.close(code=4000, reason="Not a member of this server")
                return

            # Accept the WebSocket connection
            await websocket.accept()
            print(f"[{datetime.now()}] User {user.username} connected to voice channel {channel_id}")

            # Send initial connection success message
            try:
                await websocket.send_json({
                    "type": "connection_status",
                    "status": "connected",
                    "message": "Successfully connected to voice channel"
                })
                print(f"[{datetime.now()}] Sent initial connection status to user {user.username}")
            except Exception as e:
                print(f"[{datetime.now()}] Error sending initial status: {str(e)}")
                return

            # Main message handling loop
            while True:
                try:
                    data = await websocket.receive()
                    print(f"[{datetime.now()}] Received data from user {user.username}: {data['type']}")
                    
                    if data["type"] == "websocket.disconnect":
                        print(f"[{datetime.now()}] WebSocket disconnected for user {user.username}")
                        break
                        
                    if data["type"] == "websocket.receive":
                        if "text" in data:
                            message = json.loads(data["text"])
                            print(f"[{datetime.now()}] Received message from user {user.username}: {message}")
                            
                            # Handle different message types
                            if message.get("type") == "join":
                                print(f"[{datetime.now()}] User {user.username} joining voice channel")
                                # Add user to voice channel participants
                                await voice_manager.connect_user(websocket, channel_id, user.id)
                                break
                            elif message.get("type") == "leave":
                                print(f"[{datetime.now()}] User {user.username} leaving voice channel")
                                # Remove user from voice channel participants
                                await voice_manager.disconnect_user(user.id)
                                break
                            elif message.get("type") == "audio":
                                # Обработка аудио данных
                                audio_data = message.get("data")
                                if audio_data:
                                    await voice_manager.handle_audio_data(channel_id, user.id, audio_data)
                            elif message.get("type") == "ping":
                                # Respond to ping with pong
                                try:
                                    await websocket.send_json({"type": "pong"})
                                    print(f"[{datetime.now()}] Sent pong response to user {user.username}")
                                except Exception as e:
                                    print(f"[{datetime.now()}] Error sending pong: {str(e)}")
                                    break
                            else:
                                # Echo the message back to the sender
                                try:
                                    await websocket.send_json({
                                        "type": "echo",
                                        "original_message": message
                                    })
                                except Exception as e:
                                    print(f"[{datetime.now()}] Error echoing message: {str(e)}")
                                    break
                                
                        elif "bytes" in data:
                            # Handle binary audio data
                            audio_data = data["bytes"]
                            print(f"[{datetime.now()}] Received binary audio data from user {user.username}: {len(audio_data)} bytes")
                            
                            # Отправляем аудио другим пользователям
                            await voice_manager.handle_audio_data(channel_id, user.id, audio_data)

                except WebSocketDisconnect:
                    print(f"[{datetime.now()}] WebSocket disconnected for user {user.username}")
                    break
                except Exception as e:
                    print(f"[{datetime.now()}] Error processing message: {str(e)}")
                    # Don't break the connection on general errors
                    continue

        except Exception as e:
            print(f"[{datetime.now()}] Database error: {str(e)}")
            try:
                await websocket.close(code=4000, reason="Database error")
            except Exception:
                pass
            return

    except Exception as e:
        print(f"[{datetime.now()}] Error in voice channel: {str(e)}")
        try:
            await websocket.close(code=4000, reason="Internal server error")
        except Exception:
            pass
    finally:
        # Clean up resources
        if user and channel_id:
            print(f"[{datetime.now()}] Cleaning up resources for user {user.username}")
            await voice_manager.disconnect_user(user.id)
        if db:
            db.close()

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

@app.post("/token")
async def login_for_access_token(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    try:
        # Get client IP
        client_ip = request.client.host
        print(f"Login attempt from IP: {client_ip}")

        # Debug logging
        print(f"Login attempt for email: {form_data.username}")
        print(f"Password received: {form_data.password}")
        print(f"Password length: {len(form_data.password)}")
        print(f"Password bytes: {[ord(c) for c in form_data.password]}")

        # Get user and verify password
        user = crud.get_user_by_email(db, form_data.username)
        if not user:
            print(f"User not found: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )

        if not auth.verify_password(form_data.password, user.hashed_password):
            print(f"Invalid password for user: {form_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Incorrect email or password"
            )

        # Create access token
        access_token = auth.create_access_token(data={"sub": user.email})
        print(f"Login successful for user: {form_data.username}")

        # Log successful attempt
        crud.log_login_attempt(db, client_ip, True)

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "username": user.username,
                "is_active": user.is_active
            }
        }
    except HTTPException as he:
        # Log failed attempt
        crud.log_login_attempt(db, request.client.host, False)
        raise he
    except Exception as e:
        print(f"Login error: {str(e)}")
        crud.log_login_attempt(db, request.client.host, False)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred during login"
        )

@app.post("/token/refresh")
async def refresh_token(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    try:
        # Create new access token
        access_token_expires = timedelta(minutes=config.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = auth.create_access_token(
            data={"sub": current_user.email}, expires_delta=access_token_expires
        )
        
        # Update last login time
        current_user.last_login = datetime.now()
        db.commit()
        
        return {"access_token": access_token, "token_type": "bearer"}
    except Exception as e:
        print(f"Error refreshing token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

@app.post("/users/", response_model=schemas.User)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    print(f"Registration attempt for email: {user.email}")
    print(f"Username: {user.username}")
    print(f"Password length: {len(user.password)}")
    
    # Check if email is already registered
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        print(f"Email already registered: {user.email}")
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if username is already taken
    db_user = crud.get_user_by_username(db, username=user.username)
    if db_user:
        print(f"Username already taken: {user.username}")
        raise HTTPException(status_code=400, detail="Username already taken")
    
    print("Creating new user...")
    new_user = crud.create_user(db=db, user=user)
    print(f"User created successfully: id={new_user.id}, email={new_user.email}, username={new_user.username}")
    return new_user

@app.get("/users/me/", response_model=schemas.User)
def read_users_me(current_user: models.User = Depends(auth.get_current_user)):
    return current_user

@app.put("/users/me/", response_model=schemas.User)
def update_user_me(
    user: schemas.UserUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return crud.update_user(db=db, user_id=current_user.id, user=user)

@app.get("/users/me/login-history/", response_model=List[schemas.LoginHistory])
def read_login_history(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    return crud.get_login_history(db=db, user_id=current_user.id, skip=skip, limit=limit)

@app.post("/servers/", response_model=schemas.Server)
def create_server(
    server: schemas.ServerCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    return crud.create_server(db=db, server=server, owner_id=current_user.id)

@app.get("/servers/", response_model=List[schemas.Server])
def read_servers(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    return crud.get_user_servers(db=db, user_id=current_user.id)

@app.get("/servers/{server_id}", response_model=schemas.Server)
def read_server(
    server_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_server = crud.get_server(db=db, server_id=server_id)
    if db_server is None:
        raise HTTPException(status_code=404, detail="Server not found")
    return db_server

@app.put("/servers/{server_id}", response_model=schemas.Server)
def update_server(
    server_id: int,
    server: schemas.ServerUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_server = crud.get_server(db=db, server_id=server_id)
    if db_server is None:
        raise HTTPException(status_code=404, detail="Server not found")
    if db_server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    updated_server = crud.update_server(db=db, server_id=server_id, server=server)
    crud.create_audit_log(
        db=db,
        server_id=server_id,
        user_id=current_user.id,
        action="update_server",
        target_type="server",
        target_id=server_id,
        changes=server.dict(exclude_unset=True)
    )
    return updated_server

@app.delete("/servers/{server_id}")
def delete_server(
    server_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_server = crud.get_server(db=db, server_id=server_id)
    if db_server is None:
        raise HTTPException(status_code=404, detail="Server not found")
    if db_server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    crud.create_audit_log(
        db=db,
        server_id=server_id,
        user_id=current_user.id,
        action="delete_server",
        target_type="server",
        target_id=server_id,
        changes={}
    )
    return crud.delete_server(db=db, server_id=server_id)

@app.post("/servers/{server_id}/roles/", response_model=schemas.Role)
def create_role(
    server_id: int,
    role: schemas.RoleCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_server = crud.get_server(db=db, server_id=server_id)
    if db_server is None:
        raise HTTPException(status_code=404, detail="Server not found")
    if db_server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    created_role = crud.create_role(db=db, role=role, server_id=server_id)
    crud.create_audit_log(
        db=db,
        server_id=server_id,
        user_id=current_user.id,
        action="create_role",
        target_type="role",
        target_id=created_role.id,
        changes=role.dict()
    )
    return created_role

@app.get("/servers/{server_id}/roles/", response_model=List[schemas.Role])
def read_roles(
    server_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_server = crud.get_server(db=db, server_id=server_id)
    if db_server is None:
        raise HTTPException(status_code=404, detail="Server not found")
    return crud.get_server_roles(db=db, server_id=server_id)

@app.put("/roles/{role_id}", response_model=schemas.Role)
def update_role(
    role_id: int,
    role: schemas.RoleUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_role = crud.get_role(db=db, role_id=role_id)
    if db_role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    
    db_server = crud.get_server(db=db, server_id=db_role.server_id)
    if db_server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    updated_role = crud.update_role(db=db, role_id=role_id, role=role)
    crud.create_audit_log(
        db=db,
        server_id=db_role.server_id,
        user_id=current_user.id,
        action="update_role",
        target_type="role",
        target_id=role_id,
        changes=role.dict(exclude_unset=True)
    )
    return updated_role

@app.delete("/roles/{role_id}")
def delete_role(
    role_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_role = crud.get_role(db=db, role_id=role_id)
    if db_role is None:
        raise HTTPException(status_code=404, detail="Role not found")
    
    db_server = crud.get_server(db=db, server_id=db_role.server_id)
    if db_server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    crud.create_audit_log(
        db=db,
        server_id=db_role.server_id,
        user_id=current_user.id,
        action="delete_role",
        target_type="role",
        target_id=role_id,
        changes={}
    )
    return crud.delete_role(db=db, role_id=role_id)

@app.post("/servers/{server_id}/channels/", response_model=schemas.Channel)
def create_channel(
    server_id: int,
    channel: schemas.ChannelCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_server = crud.get_server(db=db, server_id=server_id)
    if db_server is None:
        raise HTTPException(status_code=404, detail="Server not found")
    if db_server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    created_channel = crud.create_channel(db=db, channel=channel, server_id=server_id)
    crud.create_audit_log(
        db=db,
        server_id=server_id,
        user_id=current_user.id,
        action="create_channel",
        target_type="channel",
        target_id=created_channel.id,
        changes=channel.dict()
    )
    return created_channel

@app.get("/servers/{server_id}/channels/", response_model=List[schemas.Channel])
def read_channels(
    server_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_server = crud.get_server(db=db, server_id=server_id)
    if db_server is None:
        raise HTTPException(status_code=404, detail="Server not found")
    return crud.get_server_channels(db=db, server_id=server_id)

@app.put("/channels/{channel_id}", response_model=schemas.Channel)
def update_channel(
    channel_id: int,
    channel: schemas.ChannelUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_channel = crud.get_channel(db=db, channel_id=channel_id)
    if db_channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    db_server = crud.get_server(db=db, server_id=db_channel.server_id)
    if db_server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    updated_channel = crud.update_channel(db=db, channel_id=channel_id, channel=channel)
    crud.create_audit_log(
        db=db,
        server_id=db_channel.server_id,
        user_id=current_user.id,
        action="update_channel",
        target_type="channel",
        target_id=channel_id,
        changes=channel.dict(exclude_unset=True)
    )
    return updated_channel

@app.delete("/channels/{channel_id}")
def delete_channel(
    channel_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_channel = crud.get_channel(db=db, channel_id=channel_id)
    if db_channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    db_server = crud.get_server(db=db, server_id=db_channel.server_id)
    if db_server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    
    crud.create_audit_log(
        db=db,
        server_id=db_channel.server_id,
        user_id=current_user.id,
        action="delete_channel",
        target_type="channel",
        target_id=channel_id,
        changes={}
    )
    return crud.delete_channel(db=db, channel_id=channel_id)

@app.post("/channels/{channel_id}/messages", response_model=schemas.Message)
async def create_message(
    channel_id: int,
    content: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Check if channel exists
    db_channel = crud.get_channel(db, channel_id)
    if not db_channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    media_url = None
    media_type = None

    if file:
        # Create media directory if it doesn't exist
        os.makedirs("media", exist_ok=True)
        
        # Generate unique filename
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{uuid.uuid4()}{file_extension}"
        file_path = os.path.join("media", unique_filename)
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Determine media type
        content_type = file.content_type
        if content_type.startswith('image/'):
            media_type = 'image'
        elif content_type.startswith('video/'):
            media_type = 'video'
        elif content_type.startswith('audio/'):
            media_type = 'audio'
        else:
            media_type = 'file'
        
        media_url = f"/media/{unique_filename}"
    else:
        media_type = 'text'

    # Create message
    message_data = schemas.MessageCreate(
        content=content,
        media_url=media_url,
        media_type=media_type
    )
    
    # Create the message in the database
    db_message = crud.create_message(
        db=db,
        message=message_data,
        author_id=current_user.id,
        channel_id=channel_id
    )
    
    # Get the full message with author information
    return db.query(models.Message).filter(models.Message.id == db_message.id).first()

@app.get("/channels/{channel_id}/messages/", response_model=List[schemas.Message])
def read_messages(
    channel_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    db_channel = crud.get_channel(db=db, channel_id=channel_id)
    if db_channel is None:
        raise HTTPException(status_code=404, detail="Channel not found")
    return crud.get_channel_messages(db=db, channel_id=channel_id, skip=skip, limit=limit)

@app.put("/messages/{message_id}", response_model=schemas.Message)
def update_message(
    message_id: int,
    message: schemas.MessageUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_message = crud.get_message(db=db, message_id=message_id)
    if db_message is None:
        raise HTTPException(status_code=404, detail="Message not found")
    if db_message.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return crud.update_message(db=db, message_id=message_id, message=message)

@app.delete("/messages/{message_id}")
def delete_message(
    message_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_message = crud.get_message(db=db, message_id=message_id)
    if db_message is None:
        raise HTTPException(status_code=404, detail="Message not found")
    if db_message.author_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return crud.delete_message(db=db, message_id=message_id)

@app.post("/messages/{message_id}/reactions/{emoji}")
def add_reaction(
    message_id: int,
    emoji: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_message = crud.get_message(db=db, message_id=message_id)
    if db_message is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return crud.add_message_reaction(db=db, message_id=message_id, user_id=current_user.id, emoji=emoji)

@app.delete("/messages/{message_id}/reactions/{emoji}")
def remove_reaction(
    message_id: int,
    emoji: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    db_message = crud.get_message(db=db, message_id=message_id)
    if db_message is None:
        raise HTTPException(status_code=404, detail="Message not found")
    return crud.remove_message_reaction(db=db, message_id=message_id, user_id=current_user.id, emoji=emoji)

@app.get("/servers/{server_id}/audit-logs/", response_model=List[schemas.AuditLog])
def read_audit_logs(
    server_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100
):
    db_server = crud.get_server(db=db, server_id=server_id)
    if db_server is None:
        raise HTTPException(status_code=404, detail="Server not found")
    if db_server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return crud.get_server_audit_logs(db=db, server_id=server_id, skip=skip, limit=limit)

# Media endpoints
@app.get("/channels/{channel_id}/messages", response_model=List[schemas.Message])
def get_messages(
    channel_id: int,
    skip: int = 0,
    limit: int = 100,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Check if channel exists
    db_channel = crud.get_channel(db, channel_id)
    if not db_channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Check if user is a member of the server
    membership = db.query(models.ServerMember).filter(
        models.ServerMember.server_id == db_channel.server_id,
        models.ServerMember.user_id == current_user.id
    ).first()
    
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member of this server")
    
    return crud.get_channel_messages(db=db, channel_id=channel_id, skip=skip, limit=limit)

@app.post("/channels/{channel_id}/media", response_model=schemas.Message)
async def upload_media(
    channel_id: int,
    file: UploadFile = File(...),
    content: Optional[str] = None,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Check if channel exists
    db_channel = crud.get_channel(db, channel_id)
    if not db_channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Create media directory if it doesn't exist
    os.makedirs("media", exist_ok=True)
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join("media", unique_filename)
    
    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Determine media type
    content_type = file.content_type
    if content_type.startswith('image/'):
        media_type = 'image'
    elif content_type.startswith('video/'):
        media_type = 'video'
    elif content_type.startswith('audio/'):
        media_type = 'audio'
    else:
        media_type = 'file'
    
    media_url = f"/media/{unique_filename}"
    
    # Create message
    message_data = schemas.MessageCreate(
        content=content,
        media_url=media_url,
        media_type=media_type
    )
    
    return crud.create_message(
        db=db,
        message=message_data,
        author_id=current_user.id,
        channel_id=channel_id
    )

@app.get("/channels/{channel_id}/media/", response_model=List[schemas.Media])
def get_channel_media(
    channel_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.get_channel_media(db, channel_id, skip, limit)

@app.delete("/media/{media_id}")
def delete_media(
    media_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.delete_media(db, media_id)

# Game endpoints
@app.post("/channels/{channel_id}/games/", response_model=schemas.GameSession)
def create_game(
    channel_id: int,
    game: schemas.GameSessionCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.create_game_session(db, game, current_user.id, channel_id)

@app.get("/channels/{channel_id}/games/", response_model=List[schemas.GameSession])
def get_channel_games(
    channel_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.get_channel_games(db, channel_id, skip, limit)

@app.post("/games/{game_id}/players/", response_model=schemas.GamePlayer)
def join_game(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.add_game_player(db, game_id, current_user.id)

@app.put("/games/{game_id}/players/{user_id}", response_model=schemas.GamePlayer)
def update_player_status(
    game_id: int,
    user_id: int,
    player_data: Dict[str, Any],
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.update_game_player(db, game_id, user_id, player_data)

# Music endpoints
@app.get("/channels/{channel_id}/music/", response_model=List[schemas.MusicQueue])
def get_music_queue(
    channel_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    # Return the music queue from in-memory storage
    player_state = music_players.get(channel_id, {'queue': []})
    # Convert internal queue format to schema for response
    return [schemas.MusicQueue(**track) for track in player_state['queue']]

@app.post("/channels/{channel_id}/music/", response_model=schemas.MusicQueue)
def add_to_queue(
    channel_id: int,
    music: schemas.MusicQueueCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    print(f"[BACKEND] add_to_queue called for channel {channel_id} with URL {music.url}")
    # Add the music track to the in-memory queue
    if channel_id not in music_players:
        music_players[channel_id] = {'queue': [], 'current_index': -1, 'is_playing': False, 'current_time': 0.0}

    # --- Извлечение информации о треке с помощью yt-dlp ---
    try:
        # Команда для вызова yt-dlp и получения информации в формате JSON
        # -f bestaudio: Выбираем наилучший аудиоформат
        # --dump-single-json: Выводит информацию о треке в формате JSON
        command = ['yt-dlp', '-f', 'bestaudio', '--dump-single-json', music.url]
        
        # Запускаем yt-dlp как подпроцесс
        result = subprocess.run(command, capture_output=True, text=True, check=True)
        
        # Парсим JSON вывод
        video_info = json.loads(result.stdout)
        
        # Извлекаем нужные данные
        # yt-dlp может возвращать разные поля в зависимости от источника.
        # Попробуем использовать common fields. Возможно, для VK/Яндекс потребуются корректировки.
        extracted_url = video_info.get('url') or video_info.get('original_url') or video_info.get('http_url')
        title = video_info.get('title', 'Unknown Title')
        # yt-dlp не всегда предоставляет отдельное поле для исполнителя.
        # Можно попробовать использовать uploader или комбинировать поля.
        artist = video_info.get('artist') or video_info.get('uploader') or 'Unknown Artist'
        duration = int(video_info.get('duration', 0) or 0)
        
        if not extracted_url:
             raise ValueError("Could not extract playable URL from the provided link.")

        # Используем извлеченные данные для создания объекта трека
        track_data = {
            'id': len(music_players[channel_id]['queue']), # Assign a simple ID
            'channel_id': channel_id,
            'title': title,
            'artist': artist,
            'url': extracted_url, # Используем извлеченную URL
            'duration': duration,
            'added_by_id': current_user.id,
            'created_at': datetime.utcnow(), # Add the missing created_at field
            'position': len(music_players[channel_id]['queue']), # Use index as position
            'status': "queued",
            # Можно добавить другие поля, если yt-dlp их предоставляет (например, thumbnail)
            'image_url': video_info.get('thumbnail')
        }
        
    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="yt-dlp not found. Please install it.")
    except subprocess.CalledProcessError as e:
        print(f"Error calling yt-dlp: {e.stderr}")
        raise HTTPException(status_code=400, detail=f"Could not process the link: {e.stderr.strip()}")
    except (json.JSONDecodeError, ValueError) as e:
        print(f"Error processing yt-dlp output or invalid data: {e}")
        raise HTTPException(status_code=500, detail="Failed to extract music information from the link.")
    except Exception as e:
        print(f"An unexpected error occurred during music extraction: {e}")
        raise HTTPException(status_code=500, detail="An internal error occurred while processing the link.")
    # --- Конец секции yt-dlp ---

    # Add the track data to the queue
    music_players[channel_id]['queue'].append(track_data)

    # If this is the first track, set it as current and start playing
    if len(music_players[channel_id]['queue']) == 1:
        music_players[channel_id]['current_index'] = 0
        music_players[channel_id]['is_playing'] = True
        music_players[channel_id]['current_time'] = 0.0
        print(f"[BACKEND] First track added, setting is_playing to True for channel {channel_id}")

    # Return the added track (simplified response model mapping)
    # Возвращаем объект, который соответствует схеме MusicQueue
    response_track = schemas.MusicQueue(**track_data)
    print(f"[BACKEND] add_to_queue finished for channel {channel_id}. Queue length: {len(music_players[channel_id]['queue'])}, Current index: {music_players[channel_id]['current_index']}, is_playing: {music_players[channel_id]['is_playing']}")
    return response_track

@app.put("/music/{music_id}/status", response_model=schemas.MusicQueue)
def update_music_status(
    music_id: int,
    status: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.update_music_status(db, music_id, status)

@app.delete("/music/{music_id}")
def remove_from_queue(
    music_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user)
):
    return crud.remove_from_music_queue(db, music_id)

@app.put("/music/{music_id}/play")
def play_specific_track(music_id: int, channel_id: int):
    """Set a specific track from the queue as currently playing."""
    player_state = music_players.get(channel_id)
    if not player_state or not player_state['queue']:
        raise HTTPException(status_code=400, detail="Music queue is empty or channel not found")

    # Find the index of the track with the given music_id
    try:
        track_index = next((i for i, track in enumerate(player_state['queue']) if track.get('id') == music_id), -1)
    except StopIteration:
         track_index = -1

    if track_index == -1:
        raise HTTPException(status_code=404, detail="Track not found in queue")

    player_state['current_index'] = track_index
    player_state['is_playing'] = True
    player_state['current_time'] = 0.0 # Reset time when playing a new track

    return {"status": "success", "current_track": player_state['queue'][track_index]}

@app.post("/servers/{server_id}/invite", response_model=schemas.InviteCode)
def create_server_invite(
    server_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Check if user is a member of the server
    if not crud.is_user_server_member(db=db, user_id=current_user.id, server_id=server_id):
        raise HTTPException(status_code=403, detail="Not a member of this server")
    
    # Create invite code
    invite = crud.create_invite_code(db=db, server_id=server_id, user_id=current_user.id)
    
    # Log the action
    crud.create_audit_log(
        db=db,
        server_id=server_id,
        user_id=current_user.id,
        action="create_invite",
        target_type="invite",
        target_id=invite.id,
        changes={"code": invite.code}
    )
    
    return invite

@app.post("/servers/join/{invite_code}")
async def join_server(
    invite_code: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Get server by invite code
    server = crud.get_server_by_invite_code(db, invite_code)
    if not server:
        raise HTTPException(status_code=404, detail="Invalid or expired invite code")
    
    # Check if user is already a member
    if crud.is_user_server_member(db, current_user.id, server.id):
        raise HTTPException(status_code=400, detail="Already a member of this server")
    
    # Add user to server
    member = crud.add_user_to_server(db, current_user.id, server.id)
    
    # Log the action
    crud.create_audit_log(
        db=db,
        server_id=server.id,
        user_id=current_user.id,
        action="join_server",
        target_type="server",
        target_id=server.id,
        changes={}
    )
    
    return {"message": "Successfully joined server", "server": server}

@app.put("/users/{user_id}/credentials")
def update_credentials(
    user_id: int,
    credentials: schemas.UserCredentialsUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Only allow users to update their own credentials
    if current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    
    return crud.update_user_credentials(
        db=db,
        user_id=user_id,
        new_username=credentials.username,
        new_password=credentials.password
    )

@app.put("/fix-credentials/{user_id}")
def fix_swapped_credentials(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    Fix swapped username and password for a user.
    This is a temporary endpoint to fix the issue.
    """
    db_user = crud.get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # The current username is actually the password
    current_password = db_user.username
    # The current password hash is for the username
    current_username = db_user.hashed_password
    
    # Update with correct values
    db_user.username = current_username
    db_user.hashed_password = current_password
    
    db.commit()
    db.refresh(db_user)
    
    return {"message": "Credentials fixed successfully"}

# Создаем директорию для медиафайлов
MEDIA_DIR = "media"
os.makedirs(MEDIA_DIR, exist_ok=True)

# Эндпоинты для управления участниками сервера
@app.post("/servers/{server_id}/members", response_model=schemas.ServerMemberResponse)
def add_server_member(
    server_id: int,
    member: schemas.ServerMemberCreate,
    db: Session = Depends(get_db)
):
    db_member = ServerMember(
        server_id=server_id,
        user_id=member.user_id,
        role=member.role
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

@app.put("/servers/{server_id}/members/{user_id}")
def update_member_role(
    server_id: int,
    user_id: int,
    role: str,
    db: Session = Depends(get_db)
):
    member = db.query(ServerMember).filter(
        ServerMember.server_id == server_id,
        ServerMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    member.role = role
    db.commit()
    return {"status": "success"}

@app.delete("/servers/{server_id}/members/{user_id}")
def remove_server_member(
    server_id: int,
    user_id: int,
    db: Session = Depends(get_db)
):
    member = db.query(ServerMember).filter(
        ServerMember.server_id == server_id,
        ServerMember.user_id == user_id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    db.delete(member)
    db.commit()
    return {"status": "success"}

# Эндпоинт для загрузки медиафайлов
@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    # Генерируем уникальное имя файла
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = os.path.join(MEDIA_DIR, unique_filename)
    
    # Сохраняем файл
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    return {
        "filename": unique_filename,
        "original_name": file.filename,
        "url": f"/media/{unique_filename}"
    }

# Add static file serving for media
from fastapi.staticfiles import StaticFiles
app.mount("/media", StaticFiles(directory="media"), name="media")

@app.get("/api/channels/{channel_id}/participants")
def get_channel_participants(channel_id: int):
    participants = []
    if channel_id in voice_manager.voice_channels:
        for user_id in voice_manager.voice_channels[channel_id]:
            state = voice_manager.user_states.get(user_id, {})
            participants.append({
                "id": user_id,
                "isMuted": state.get("isMuted", False),
                "isDeafened": state.get("isDeafened", False),
                "isVideoEnabled": state.get("isVideoEnabled", False),
                "isScreenSharing": state.get("isScreenSharing", False)
            })
    return {"participants": participants}

@app.get("/music/current-track")
def get_current_track(channel_id: int):
    print(f"[BACKEND] get_current_track called for channel {channel_id}")
    """Get the current playing track for a channel."""
    player_state = music_players.get(channel_id)
    if not player_state or player_state['current_index'] == -1:
        print(f"[BACKEND] get_current_track: No track playing for channel {channel_id}")
        return {"current_track": None, "is_playing": False, "current_time": 0.0}

    current_track = player_state['queue'][player_state['current_index']]
    print(f"[BACKEND] get_current_track: Returning track {current_track.get('title')} for channel {channel_id}, is_playing: {player_state['is_playing']}")
    return {
        "current_track": current_track,
        "is_playing": player_state['is_playing'],
        "current_time": player_state['current_time'] # Placeholder for tracking time
    }

@app.put("/music/playback-state")
def update_playback_state(channel_id: int, state: Dict[str, bool]):
    print(f"[BACKEND] update_playback_state called for channel {channel_id} with state {state}")
    """Update the playback state (play/pause) for a channel."""
    player_state = music_players.get(channel_id)
    if not player_state or player_state['current_index'] == -1:
        raise HTTPException(status_code=400, detail="No track is currently playing or queued in this channel")

    if 'is_playing' in state:
        player_state['is_playing'] = state['is_playing']
        print(f"[BACKEND] Playback state updated to is_playing: {player_state['is_playing']} for channel {channel_id}")

    # In a real implementation, you would control audio playback here
    # For now, we just update the state

    return {"status": "success", "is_playing": player_state['is_playing']}

@app.post("/music/skip-next")
def skip_next_track(channel_id: int):
    print(f"[BACKEND] skip_next_track called for channel {channel_id}")
    """Skip to the next track in the queue for a channel."""
    player_state = music_players.get(channel_id)
    if not player_state or not player_state['queue']:
        raise HTTPException(status_code=400, detail="Music queue is empty")

    next_index = player_state['current_index'] + 1
    if next_index < len(player_state['queue']):
        player_state['current_index'] = next_index
        player_state['is_playing'] = True # Assume playing after skipping
        player_state['current_time'] = 0.0 # Reset time on skip
        # In a real implementation, start playing the new track here
        print(f"[BACKEND] Skipping to next track {next_index} for channel {channel_id}. Setting is_playing to True.")
        return {"status": "success", "current_track": player_state['queue'][next_index]}
    else:
        # Reached end of queue
        player_state['current_index'] = -1
        player_state['is_playing'] = False
        player_state['current_time'] = 0.0
        print(f"[BACKEND] Reached end of queue for channel {channel_id}. Setting is_playing to False.")
        return {"status": "success", "current_track": None, "message": "End of queue"}

@app.post("/music/skip-previous")
def skip_previous_track(channel_id: int):
    print(f"[BACKEND] skip_previous_track called for channel {channel_id}")
    """Skip to the previous track in the queue for a channel."""
    player_state = music_players.get(channel_id)
    if not player_state or not player_state['queue']:
        raise HTTPException(status_code=400, detail="Music queue is empty")

    prev_index = player_state['current_index'] - 1
    if prev_index >= 0:
        player_state['current_index'] = prev_index
        player_state['is_playing'] = True # Assume playing after skipping
        player_state['current_time'] = 0.0 # Reset time on skip
        # In a real implementation, start playing the new track here
        print(f"[BACKEND] Skipping to previous track {prev_index} for channel {channel_id}. Setting is_playing to True.")
        return {"status": "success", "current_track": player_state['queue'][prev_index]}
    else:
        # Already at the beginning
        print(f"[BACKEND] Already at beginning of queue for channel {channel_id}.")
        return {"status": "success", "current_track": player_state['queue'][0], "message": "Already at the beginning"}

if __name__ == "__main__":
    def find_free_port(start_port=8000, max_port=8999):
        for port in range(start_port, max_port + 1):
            try:
                with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                    s.bind(('', port))
                    return port
            except OSError:
                continue
        return None

    port = find_free_port()
    if port is None:
        print("No free ports available")
        exit(1)
        
    print(f"Starting server on port {port}")
    uvicorn.run(app, host=config.SERVER_IP, port=port) 