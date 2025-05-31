from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from datetime import datetime, timedelta
import models, schemas
from typing import List, Optional, Dict, Any
from fastapi import HTTPException
import secrets

# User operations
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    print(f"Looking up user with email: {email}")
    user = db.query(models.User).filter(models.User.email == email).first()
    print(f"User found: {user is not None}")
    if user:
        print(f"User details: id={user.id}, username={user.username}, is_active={user.is_active}")
    return user

def get_user_by_username(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.User).offset(skip).limit(limit).all()

def create_user(db: Session, user: schemas.UserCreate):
    from auth import get_password_hash  # import inside function to avoid circular dependency
    
    print(f"Creating user with email: {user.email}")
    print(f"Password: {user.password}")
    print(f"Password length: {len(user.password)}")
    print(f"Password bytes: {[ord(c) for c in user.password]}")
    
    hashed_password = get_password_hash(user.password)
    print(f"Generated hash: {hashed_password}")
    
    # Verify the hash immediately
    from auth import verify_password
    verification_result = verify_password(user.password, hashed_password)
    print(f"Immediate verification of generated hash: {verification_result}")
    
    db_user = models.User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password,
        is_active=True,
        is_verified=False,
        created_at=datetime.utcnow()
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def update_user(db: Session, user_id: int, user: schemas.UserUpdate):
    db_user = get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = user.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    db.commit()
    db.refresh(db_user)
    return db_user

def create_login_history(db: Session, user_id: int, ip_address: str, user_agent: str, success: bool = True):
    db_history = models.LoginHistory(
        user_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent,
        success=success
    )
    db.add(db_history)
    db.commit()
    db.refresh(db_history)
    return db_history

def log_login_attempt(db: Session, ip_address: str, success: bool) -> None:
    """
    Log a login attempt.
    """
    try:
        login_history = models.LoginHistory(
            ip_address=ip_address,
            success=success,
            login_time=datetime.utcnow()
        )
        db.add(login_history)
        db.commit()
    except Exception as e:
        print(f"Error logging login attempt: {str(e)}")
        db.rollback()

def get_login_history(db: Session, user_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.LoginHistory)\
        .filter(models.LoginHistory.user_id == user_id)\
        .order_by(models.LoginHistory.login_time.desc())\
        .offset(skip).limit(limit).all()

# Server operations
def get_server(db: Session, server_id: int):
    return db.query(models.Server).filter(models.Server.id == server_id).first()

def get_servers(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Server).offset(skip).limit(limit).all()

def get_user_servers(db: Session, user_id: int):
    return db.query(models.Server)\
        .join(models.ServerMember)\
        .filter(models.ServerMember.user_id == user_id)\
        .all()

def create_server(db: Session, server: schemas.ServerCreate, owner_id: int):
    db_server = models.Server(
        **server.dict(),
        owner_id=owner_id,
        created_at=datetime.utcnow()
    )
    db.add(db_server)
    db.commit()
    db.refresh(db_server)
    
    # Добавляем владельца как участника сервера с ролью ADMIN
    db_member = models.ServerMember(
        user_id=owner_id,
        server_id=db_server.id,
        role_type=models.UserRole.ADMIN,
        joined_at=datetime.utcnow()
    )
    db.add(db_member)
    db.commit()
    
    return db_server

def update_server(db: Session, server_id: int, server: schemas.ServerUpdate):
    db_server = get_server(db, server_id)
    if not db_server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    update_data = server.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_server, field, value)
    
    db.commit()
    db.refresh(db_server)
    return db_server

def delete_server(db: Session, server_id: int):
    db_server = get_server(db, server_id)
    if not db_server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    db.delete(db_server)
    db.commit()
    return {"message": "Server deleted successfully"}

def get_role(db: Session, role_id: int):
    return db.query(models.Role).filter(models.Role.id == role_id).first()

def get_server_roles(db: Session, server_id: int):
    return db.query(models.Role).filter(models.Role.server_id == server_id).all()

def create_role(db: Session, role: schemas.RoleCreate, server_id: int):
    db_role = models.Role(**role.dict(), server_id=server_id)
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    return db_role

def update_role(db: Session, role_id: int, role: schemas.RoleUpdate):
    db_role = get_role(db, role_id)
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    update_data = role.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_role, field, value)
    
    db.commit()
    db.refresh(db_role)
    return db_role

def delete_role(db: Session, role_id: int):
    db_role = get_role(db, role_id)
    if not db_role:
        raise HTTPException(status_code=404, detail="Role not found")
    
    db.delete(db_role)
    db.commit()
    return {"message": "Role deleted successfully"}

# Channel operations
def get_channel(db: Session, channel_id: int):
    return db.query(models.Channel).filter(models.Channel.id == channel_id).first()

def get_server_channels(db: Session, server_id: int):
    return db.query(models.Channel)\
        .filter(models.Channel.server_id == server_id)\
        .order_by(models.Channel.position)\
        .all()

def create_channel(db: Session, channel: schemas.ChannelCreate, server_id: int):
    # Get the last position in the server
    last_channel = db.query(models.Channel)\
        .filter(models.Channel.server_id == server_id)\
        .order_by(models.Channel.position.desc())\
        .first()
    
    position = (last_channel.position + 1) if last_channel else 0
    
    # Create channel data without position
    channel_data = channel.dict()
    channel_data.pop('position', None)  # Remove position from input data
    
    db_channel = models.Channel(
        **channel_data,
        server_id=server_id,
        position=position,
        created_at=datetime.utcnow()
    )
    db.add(db_channel)
    db.commit()
    db.refresh(db_channel)
    return db_channel

def update_channel(db: Session, channel_id: int, channel: schemas.ChannelUpdate):
    db_channel = get_channel(db, channel_id)
    if not db_channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    update_data = channel.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_channel, field, value)
    
    db.commit()
    db.refresh(db_channel)
    return db_channel

def delete_channel(db: Session, channel_id: int):
    db_channel = get_channel(db, channel_id)
    if not db_channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    db.delete(db_channel)
    db.commit()
    return {"message": "Channel deleted successfully"}

# Message operations
def get_message(db: Session, message_id: int):
    return db.query(models.Message).filter(models.Message.id == message_id).first()

def get_channel_messages(db: Session, channel_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Message)\
        .filter(models.Message.channel_id == channel_id)\
        .join(models.User, models.Message.author_id == models.User.id)\
        .order_by(models.Message.created_at.asc())\
        .offset(skip).limit(limit).all()

def create_message(db: Session, message: schemas.MessageCreate, author_id: int, channel_id: int):
    db_message = models.Message(
        **message.dict(),
        author_id=author_id,
        channel_id=channel_id,
        created_at=datetime.utcnow()
    )
    db.add(db_message)
    db.commit()
    db.refresh(db_message)
    return db_message

def update_message(db: Session, message_id: int, message: schemas.MessageUpdate):
    db_message = get_message(db, message_id)
    if not db_message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    update_data = message.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_message, field, value)
    
    db_message.is_edited = True
    db_message.edited_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_message)
    return db_message

def delete_message(db: Session, message_id: int):
    db_message = get_message(db, message_id)
    if not db_message:
        raise HTTPException(status_code=404, detail="Message not found")
    
    db.delete(db_message)
    db.commit()
    return {"message": "Message deleted successfully"}

def add_message_reaction(db: Session, message_id: int, user_id: int, emoji: str):
    db.execute(
        models.message_reactions.insert().values(
            message_id=message_id,
            user_id=user_id,
            emoji=emoji
        )
    )
    db.commit()
    return {"message": "Reaction added successfully"}

def remove_message_reaction(db: Session, message_id: int, user_id: int, emoji: str):
    db.execute(
        models.message_reactions.delete().where(
            and_(
                models.message_reactions.c.message_id == message_id,
                models.message_reactions.c.user_id == user_id,
                models.message_reactions.c.emoji == emoji
            )
        )
    )
    db.commit()
    return {"message": "Reaction removed successfully"}

def create_audit_log(db: Session, server_id: int, user_id: int, action: str, target_type: str, target_id: int, changes: Dict[str, Any]):
    db_log = models.AuditLog(
        server_id=server_id,
        user_id=user_id,
        action=action,
        target_type=target_type,
        target_id=target_id,
        changes=changes
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def get_server_audit_logs(db: Session, server_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.AuditLog)\
        .filter(models.AuditLog.server_id == server_id)\
        .order_by(models.AuditLog.created_at.desc())\
        .offset(skip).limit(limit).all()

# Media operations
def get_media(db: Session, media_id: int):
    return db.query(models.Media).filter(models.Media.id == media_id).first()

def get_channel_media(db: Session, channel_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.Media)\
        .filter(models.Media.channel_id == channel_id)\
        .order_by(models.Media.created_at.desc())\
        .offset(skip).limit(limit).all()

def create_media(db: Session, media: schemas.MediaCreate, uploaded_by_id: int, channel_id: int):
    db_media = models.Media(
        **media.dict(),
        uploaded_by_id=uploaded_by_id,
        channel_id=channel_id
    )
    db.add(db_media)
    db.commit()
    db.refresh(db_media)
    return db_media

def delete_media(db: Session, media_id: int):
    db_media = get_media(db, media_id)
    if not db_media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    db.delete(db_media)
    db.commit()
    return {"message": "Media deleted successfully"}

# Game operations
def get_game_session(db: Session, game_id: int):
    return db.query(models.GameSession).filter(models.GameSession.id == game_id).first()

def get_channel_games(db: Session, channel_id: int, skip: int = 0, limit: int = 100):
    return db.query(models.GameSession)\
        .filter(models.GameSession.channel_id == channel_id)\
        .order_by(models.GameSession.created_at.desc())\
        .offset(skip).limit(limit).all()

def create_game_session(db: Session, game: schemas.GameSessionCreate, created_by_id: int, channel_id: int):
    db_game = models.GameSession(
        **game.dict(),
        created_by_id=created_by_id,
        channel_id=channel_id,
        status="active"
    )
    db.add(db_game)
    db.commit()
    db.refresh(db_game)
    return db_game

def update_game_session(db: Session, game_id: int, game: Dict[str, Any]):
    db_game = get_game_session(db, game_id)
    if not db_game:
        raise HTTPException(status_code=404, detail="Game session not found")
    
    for field, value in game.items():
        setattr(db_game, field, value)
    
    db.commit()
    db.refresh(db_game)
    return db_game

def add_game_player(db: Session, game_id: int, user_id: int):
    db_player = models.GamePlayer(
        game_id=game_id,
        user_id=user_id,
        status="active"
    )
    db.add(db_player)
    db.commit()
    db.refresh(db_player)
    return db_player

def update_game_player(db: Session, game_id: int, user_id: int, player_data: Dict[str, Any]):
    db_player = db.query(models.GamePlayer)\
        .filter(
            models.GamePlayer.game_id == game_id,
            models.GamePlayer.user_id == user_id
        ).first()
    
    if not db_player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    for field, value in player_data.items():
        setattr(db_player, field, value)
    
    db.commit()
    db.refresh(db_player)
    return db_player

# Music operations
def get_music_queue(db: Session, channel_id: int):
    return db.query(models.MusicQueue)\
        .filter(models.MusicQueue.channel_id == channel_id)\
        .order_by(models.MusicQueue.position)\
        .all()

def add_to_music_queue(db: Session, music: schemas.MusicQueueCreate, added_by_id: int, channel_id: int):
    # Получаем текущую позицию в очереди
    last_position = db.query(models.MusicQueue)\
        .filter(models.MusicQueue.channel_id == channel_id)\
        .order_by(models.MusicQueue.position.desc())\
        .first()
    
    position = (last_position.position + 1) if last_position else 0
    
    db_music = models.MusicQueue(
        **music.dict(),
        added_by_id=added_by_id,
        channel_id=channel_id,
        position=position,
        status="queued"
    )
    db.add(db_music)
    db.commit()
    db.refresh(db_music)
    return db_music

def update_music_status(db: Session, music_id: int, status: str):
    db_music = db.query(models.MusicQueue).filter(models.MusicQueue.id == music_id).first()
    if not db_music:
        raise HTTPException(status_code=404, detail="Music not found")
    
    db_music.status = status
    db.commit()
    db.refresh(db_music)
    return db_music

def remove_from_music_queue(db: Session, music_id: int):
    db_music = db.query(models.MusicQueue).filter(models.MusicQueue.id == music_id).first()
    if not db_music:
        raise HTTPException(status_code=404, detail="Music not found")
    
    db.delete(db_music)
    db.commit()
    return {"message": "Music removed from queue successfully"}

def create_invite_code(db: Session, server_id: int, user_id: int) -> models.InviteCode:
    # Generate a random 8-character code
    code = secrets.token_urlsafe(8)
    
    # Create the invite code
    db_invite = models.InviteCode(
        code=code,
        server_id=server_id,
        created_by=user_id,
        expires_at=datetime.utcnow() + timedelta(days=7)  # Expires in 7 days
    )
    db.add(db_invite)
    db.commit()
    db.refresh(db_invite)
    return db_invite

def get_server_by_invite_code(db: Session, invite_code: str) -> Optional[models.Server]:
    invite = db.query(models.InviteCode).filter(models.InviteCode.code == invite_code).first()
    if not invite:
        return None
    
    # Check if invite has expired
    if invite.expires_at and invite.expires_at < datetime.utcnow():
        return None
    
    return invite.server

def is_user_server_member(db: Session, user_id: int, server_id: int) -> bool:
    return db.query(models.ServerMember).filter(
        models.ServerMember.user_id == user_id,
        models.ServerMember.server_id == server_id
    ).first() is not None

def add_user_to_server(db: Session, user_id: int, server_id: int) -> models.ServerMember:
    # Check if user is already a member
    if is_user_server_member(db, user_id, server_id):
        return db.query(models.ServerMember).filter(
            models.ServerMember.user_id == user_id,
            models.ServerMember.server_id == server_id
        ).first()
    
    # Add user as a member with default role
    db_member = models.ServerMember(
        user_id=user_id,
        server_id=server_id,
        role_type=models.RoleType.MEMBER
    )
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member

def update_user_credentials(db: Session, user_id: int, new_username: str, new_password: str):
    """
    Update both username and password for a user.
    """
    from auth import get_password_hash
    
    print(f"Updating credentials for user {user_id}")
    print(f"New username: {new_username}")
    print(f"New password: {new_password}")
    
    db_user = get_user(db, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Update username
    db_user.username = new_username
    
    # Update password
    hashed_password = get_password_hash(new_password)
    print(f"Generated new hash: {hashed_password}")
    
    # Verify the new hash immediately
    from auth import verify_password
    verification_result = verify_password(new_password, hashed_password)
    print(f"Verification of new hash: {verification_result}")
    
    db_user.hashed_password = hashed_password
    
    db.commit()
    db.refresh(db_user)
    return db_user 