from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Table, JSON, Enum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum
from datetime import datetime

class ChannelType(str, enum.Enum):
    TEXT = "text"
    VOICE = "voice"
    CATEGORY = "category"
    MUSIC = "music"
    GAME = "game"

class RoleType(str, enum.Enum):
    ADMIN = "admin"
    MODERATOR = "moderator"
    MEMBER = "member"

class MediaType(str, enum.Enum):
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    FILE = "file"

class GameType(str, enum.Enum):
    CHESS = "chess"
    TIC_TAC_TOE = "tic_tac_toe"
    HANGMAN = "hangman"
    QUIZ = "quiz"

# Таблица для реакций на сообщения
message_reactions = Table(
    'message_reactions',
    Base.metadata,
    Column('message_id', Integer, ForeignKey('messages.id')),
    Column('user_id', Integer, ForeignKey('users.id')),
    Column('emoji', String)
)

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    MODERATOR = "moderator"
    MEMBER = "member"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    avatar = Column(String, nullable=True)
    banner_url = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    status = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    two_factor_enabled = Column(Boolean, default=False)
    two_factor_secret = Column(String, nullable=True)
    created_at = Column(DateTime)
    is_online = Column(Integer, default=0)
    last_seen = Column(DateTime, nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Отношения
    owned_servers = relationship("Server", back_populates="owner")
    server_memberships = relationship("ServerMember", back_populates="user")
    messages = relationship("Message", back_populates="author")
    reactions = relationship("Message", secondary=message_reactions, back_populates="reactions")
    login_history = relationship("LoginHistory", back_populates="user")
    uploaded_media = relationship("Media", back_populates="uploaded_by")
    created_games = relationship("GameSession", back_populates="created_by")
    games = relationship("GameSession", secondary="game_players", back_populates="players")
    added_songs = relationship("MusicQueue", back_populates="added_by")
    created_invites = relationship("InviteCode", back_populates="creator")

class LoginHistory(Base):
    __tablename__ = "login_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    ip_address = Column(String)
    user_agent = Column(String)
    login_time = Column(DateTime(timezone=True), server_default=func.now())
    success = Column(Boolean, default=True)

    user = relationship("User", back_populates="login_history")

class Server(Base):
    __tablename__ = "servers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    description = Column(String, nullable=True)
    icon = Column(String, nullable=True)
    banner_url = Column(String, nullable=True)
    created_at = Column(DateTime)
    owner_id = Column(Integer, ForeignKey("users.id"))
    settings = Column(JSON, default={})

    # Отношения
    owner = relationship("User", back_populates="owned_servers")
    members = relationship("ServerMember", back_populates="server")
    channels = relationship("Channel", back_populates="server")
    roles = relationship("Role", back_populates="server")
    audit_logs = relationship("AuditLog", back_populates="server")
    invite_codes = relationship("InviteCode", back_populates="server")

class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    color = Column(String)
    permissions = Column(JSON)
    server_id = Column(Integer, ForeignKey("servers.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    server = relationship("Server", back_populates="roles")
    members = relationship("ServerMember", back_populates="role", foreign_keys="ServerMember.role_id")

class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    type = Column(Enum(ChannelType))
    server_id = Column(Integer, ForeignKey("servers.id"))
    category_id = Column(Integer, ForeignKey("channels.id"), nullable=True)
    position = Column(Integer, default=0)
    is_private = Column(Boolean, default=False)
    created_at = Column(DateTime)
    settings = Column(JSON, default={})

    # Отношения
    server = relationship("Server", back_populates="channels")
    messages = relationship("Message", back_populates="channel")
    category = relationship("Channel", remote_side=[id], backref="subchannels")
    media = relationship("Media", back_populates="channel")
    game_sessions = relationship("GameSession", back_populates="channel")
    music_queue = relationship("MusicQueue", back_populates="channel")

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=True)
    media_url = Column(String, nullable=True)
    media_type = Column(String, nullable=True)  # image, video, audio
    author_id = Column(Integer, ForeignKey("users.id"))
    channel_id = Column(Integer, ForeignKey("channels.id"))
    created_at = Column(DateTime)
    edited_at = Column(DateTime(timezone=True), nullable=True)
    is_edited = Column(Boolean, default=False)
    attachments = Column(JSON, default=[])
    mentions = Column(JSON, default=[])
    parent_id = Column(Integer, ForeignKey("messages.id"), nullable=True)

    # Отношения
    author = relationship("User", back_populates="messages")
    channel = relationship("Channel", back_populates="messages")
    reactions = relationship("User", secondary=message_reactions, back_populates="reactions")
    parent = relationship("Message", remote_side=[id], backref="replies")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    action = Column(String)
    target_type = Column(String)
    target_id = Column(Integer)
    changes = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    server = relationship("Server", back_populates="audit_logs")

class Media(Base):
    __tablename__ = "media"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String)
    type = Column(Enum(MediaType))
    name = Column(String)
    size = Column(Integer)
    duration = Column(Integer, nullable=True)  # Для аудио/видео
    thumbnail_url = Column(String, nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("users.id"))
    channel_id = Column(Integer, ForeignKey("channels.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    uploaded_by = relationship("User", back_populates="uploaded_media")
    channel = relationship("Channel", back_populates="media")

class GameSession(Base):
    __tablename__ = "game_sessions"

    id = Column(Integer, primary_key=True, index=True)
    game_type = Column(Enum(GameType))
    channel_id = Column(Integer, ForeignKey("channels.id"))
    created_by_id = Column(Integer, ForeignKey("users.id"))
    status = Column(String)  # active, finished, cancelled
    settings = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)

    channel = relationship("Channel", back_populates="game_sessions")
    created_by = relationship("User", back_populates="created_games")
    players = relationship("User", secondary="game_players", back_populates="games")

class GamePlayer(Base):
    __tablename__ = "game_players"

    game_id = Column(Integer, ForeignKey("game_sessions.id"), primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    score = Column(Integer, default=0)
    status = Column(String)  # active, won, lost, disconnected
    joined_at = Column(DateTime(timezone=True), server_default=func.now())

class MusicQueue(Base):
    __tablename__ = "music_queues"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(Integer, ForeignKey("channels.id"))
    title = Column(String)
    artist = Column(String, nullable=True)
    url = Column(String)
    duration = Column(Integer)
    added_by_id = Column(Integer, ForeignKey("users.id"))
    position = Column(Integer)
    status = Column(String)  # queued, playing, finished
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    channel = relationship("Channel", back_populates="music_queue")
    added_by = relationship("User", back_populates="added_songs")

class InviteCode(Base):
    __tablename__ = "invite_codes"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String, unique=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"))
    created_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)

    server = relationship("Server", back_populates="invite_codes")
    creator = relationship("User", back_populates="created_invites")

class ServerMember(Base):
    __tablename__ = "server_members"

    id = Column(Integer, primary_key=True, index=True)
    server_id = Column(Integer, ForeignKey("servers.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=True)
    role_type = Column(Enum(UserRole), default=UserRole.MEMBER)
    joined_at = Column(DateTime)

    server = relationship("Server", back_populates="members")
    user = relationship("User", back_populates="server_memberships")
    role = relationship("Role", back_populates="members") 