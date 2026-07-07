from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from app.database import get_session
from app.models import User
from app.auth import get_password_hash, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

class UserAuth(BaseModel):
    email: str
    password: str

@router.post("/register")
def register(user_data: UserAuth, session: Session = Depends(get_session)):
    email = user_data.email.strip().lower()
    # Basic validation
    if not email or "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Invalid email format")
    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")
        
    statement = select(User).where(User.email == email)
    existing_user = session.exec(statement).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email is already registered")
        
    hashed_pwd = get_password_hash(user_data.password)
    new_user = User(email=email, hashed_password=hashed_pwd)
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    
    token = create_access_token(data={"sub": new_user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": new_user.id, "email": new_user.email}
    }

@router.post("/login")
def login(user_data: UserAuth, session: Session = Depends(get_session)):
    email = user_data.email.strip().lower()
    statement = select(User).where(User.email == email)
    user = session.exec(statement).first()
    
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password"
        )
        
    token = create_access_token(data={"sub": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "email": user.email}
    }

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {"id": current_user.id, "email": current_user.email}
