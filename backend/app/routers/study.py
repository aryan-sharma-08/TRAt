from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from app.database import get_session
from app.models import StudySubject, StudyBlock, StudySession, User
from app.auth import get_current_user

router = APIRouter(prefix="/api/study", tags=["study"])

# Schemas
class SubjectCreate(BaseModel):
    name: str
    target_hours: Optional[float] = 2.0
    priority: Optional[str] = "Medium"
    exam_date: Optional[datetime] = None

class SubjectUpdate(BaseModel):
    name: Optional[str] = None
    target_hours: Optional[float] = None
    priority: Optional[str] = None
    exam_date: Optional[datetime] = None

class BlockCreate(BaseModel):
    subject_name: str
    start_time: str
    end_time: str
    day_of_week: int

class SessionCreate(BaseModel):
    subject_id: Optional[int] = None
    subject_name: str
    start_time: datetime
    end_time: datetime
    duration_seconds: int

# --- Subjects Endpoints ---
@router.get("/subjects", response_model=List[StudySubject])
def get_subjects(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    statement = select(StudySubject).where(StudySubject.user_id == current_user.id)
    return session.exec(statement).all()

@router.post("/subjects", response_model=StudySubject)
def create_subject(
    subject_data: SubjectCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    new_sub = StudySubject(
        name=subject_data.name,
        target_hours=subject_data.target_hours,
        priority=subject_data.priority,
        exam_date=subject_data.exam_date,
        user_id=current_user.id
    )
    session.add(new_sub)
    session.commit()
    session.refresh(new_sub)
    return new_sub

@router.put("/subjects/{subject_id}", response_model=StudySubject)
def update_subject(
    subject_id: int,
    subject_data: SubjectUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    statement = select(StudySubject).where(StudySubject.id == subject_id, StudySubject.user_id == current_user.id)
    subject = session.exec(statement).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    update_dict = subject_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(subject, key, value)
        
    session.add(subject)
    session.commit()
    session.refresh(subject)
    return subject

@router.delete("/subjects/{subject_id}")
def delete_subject(
    subject_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    statement = select(StudySubject).where(StudySubject.id == subject_id, StudySubject.user_id == current_user.id)
    subject = session.exec(statement).first()
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
        
    session.delete(subject)
    session.commit()
    return {"detail": "Subject deleted successfully"}

# --- Study Blocks Endpoints ---
@router.get("/blocks", response_model=List[StudyBlock])
def get_study_blocks(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    statement = select(StudyBlock).where(StudyBlock.user_id == current_user.id)
    return session.exec(statement).all()

@router.post("/blocks", response_model=StudyBlock)
def create_study_block(
    block_data: BlockCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    new_block = StudyBlock(
        subject_name=block_data.subject_name,
        start_time=block_data.start_time,
        end_time=block_data.end_time,
        day_of_week=block_data.day_of_week,
        user_id=current_user.id
    )
    session.add(new_block)
    session.commit()
    session.refresh(new_block)
    return new_block

@router.delete("/blocks/{block_id}")
def delete_study_block(
    block_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    statement = select(StudyBlock).where(StudyBlock.id == block_id, StudyBlock.user_id == current_user.id)
    block = session.exec(statement).first()
    if not block:
        raise HTTPException(status_code=404, detail="Study block not found")
        
    session.delete(block)
    session.commit()
    return {"detail": "Study block deleted successfully"}

# --- Study Sessions Endpoints ---
@router.get("/sessions", response_model=List[StudySession])
def get_study_sessions(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    statement = select(StudySession).where(StudySession.user_id == current_user.id).order_by(StudySession.start_time.desc())
    return session.exec(statement).all()

@router.post("/sessions", response_model=StudySession)
def log_study_session(
    session_data: SessionCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    # Verify subject belongs to user if subject_id is provided
    if session_data.subject_id:
        statement = select(StudySubject).where(StudySubject.id == session_data.subject_id, StudySubject.user_id == current_user.id)
        sub = session.exec(statement).first()
        if not sub:
            raise HTTPException(status_code=400, detail="Invalid subject ID")

    new_session = StudySession(
        subject_id=session_data.subject_id,
        subject_name=session_data.subject_name,
        start_time=session_data.start_time,
        end_time=session_data.end_time,
        duration_seconds=session_data.duration_seconds,
        user_id=current_user.id
    )
    session.add(new_session)
    session.commit()
    session.refresh(new_session)
    return new_session
