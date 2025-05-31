from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
import config
import re

from database import *
import models
import crud
import pyotp
import qrcode
from io import BytesIO
import base64

# Настройки JWT
SECRET_KEY = config.SECRET_KEY  # Use the same secret key as config.py
ALGORITHM = config.ALGORITHM  # Use the same algorithm as config.py
ACCESS_TOKEN_EXPIRE_MINUTES = config.ACCESS_TOKEN_EXPIRE_MINUTES

# Настройки паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a password against its hash.
    """
    try:
        print(f"Verifying password:")
        print(f"Plain password: {plain_password}")
        print(f"Plain password length: {len(plain_password)}")
        print(f"Plain password bytes: {[ord(c) for c in plain_password]}")
        print(f"Hashed password: {hashed_password}")
        
        result = pwd_context.verify(plain_password, hashed_password)
        print(f"Password verification result: {result}")
        return result
    except Exception as e:
        print(f"Error verifying password: {str(e)}")
        return False

def get_password_hash(password: str) -> str:
    """
    Hash a password.
    """
    try:
        print(f"Hashing password:")
        print(f"Password length: {len(password)}")
        
        hashed = pwd_context.hash(password)
        print(f"Hashed password: {hashed}")
        return hashed
    except Exception as e:
        print(f"Error hashing password: {str(e)}")
        raise

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a new JWT access token.
    """
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    try:
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    except Exception as e:
        print(f"Token creation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create access token"
        )

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    """
    Get the current user from the JWT token.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError as e:
        print(f"JWT decode error: {str(e)}")
        raise credentials_exception
    
    user = crud.get_user_by_email(db, email=email)
    if user is None:
        raise credentials_exception
    
    return user

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def generate_totp_secret() -> str:
    return pyotp.random_base32()

def verify_totp(secret: str, token: str) -> bool:
    totp = pyotp.TOTP(secret)
    return totp.verify(token)

def generate_totp_qr_code(secret: str, email: str) -> str:
    totp = pyotp.TOTP(secret)
    provisioning_uri = totp.provisioning_uri(email, issuer_name="Dump")
    
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(provisioning_uri)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode()
    
    return f"data:image/png;base64,{img_str}"

def check_login_attempts(db: Session, email: str, ip_address: str) -> bool:
    """
    Check if there have been too many failed login attempts.
    Returns True if login is allowed, False if too many attempts.
    """
    try:
        user = crud.get_user_by_email(db, email)
        if not user:
            return True  # Allow attempts for non-existent users
        
        recent_attempts = db.query(models.LoginHistory)\
            .filter(
                models.LoginHistory.user_id == user.id,
                models.LoginHistory.ip_address == ip_address,
                models.LoginHistory.success == False,
                models.LoginHistory.login_time >= datetime.utcnow() - timedelta(minutes=15)
            )\
            .count()
        
        return recent_attempts < 5
    except Exception as e:
        print(f"Error checking login attempts: {str(e)}")
        return True  # Allow login attempt if there's an error checking 