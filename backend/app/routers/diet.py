from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from app.database import get_session
from app.models import DietEntry, User
from app.auth import get_current_user

router = APIRouter(prefix="/api/diet", tags=["diet"])

class DietEntryCreate(BaseModel):
    meal_type: str
    description: str
    calories: Optional[int] = 0
    protein: Optional[int] = 0
    carbs: Optional[int] = 0
    fat: Optional[int] = 0
    status: Optional[str] = "todo"
    date: datetime

class DietEntryUpdate(BaseModel):
    meal_type: Optional[str] = None
    description: Optional[str] = None
    calories: Optional[int] = None
    protein: Optional[int] = None
    carbs: Optional[int] = None
    fat: Optional[int] = None
    status: Optional[str] = None
    date: Optional[datetime] = None

@router.get("", response_model=List[DietEntry])
def get_diet_entries(
    date: str,  # Format: YYYY-MM-DD
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
        
    statement = select(DietEntry).where(DietEntry.user_id == current_user.id)
    entries = session.exec(statement).all()
    
    # Filter in-memory by date to ensure perfect portability between SQLite and PostgreSQL
    filtered = [e for e in entries if e.date.date() == target_date]
    return filtered

@router.post("", response_model=DietEntry)
def create_diet_entry(
    entry_data: DietEntryCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    new_entry = DietEntry(
        meal_type=entry_data.meal_type,
        description=entry_data.description,
        calories=entry_data.calories,
        protein=entry_data.protein,
        carbs=entry_data.carbs,
        fat=entry_data.fat,
        status=entry_data.status,
        date=entry_data.date,
        user_id=current_user.id
    )
    session.add(new_entry)
    session.commit()
    session.refresh(new_entry)
    return new_entry

@router.put("/{entry_id}", response_model=DietEntry)
def update_diet_entry(
    entry_id: int,
    entry_data: DietEntryUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    statement = select(DietEntry).where(DietEntry.id == entry_id, DietEntry.user_id == current_user.id)
    entry = session.exec(statement).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Diet entry not found")
        
    update_dict = entry_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(entry, key, value)
        
    session.add(entry)
    session.commit()
    session.refresh(entry)
    return entry

@router.delete("/{entry_id}")
def delete_diet_entry(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    statement = select(DietEntry).where(DietEntry.id == entry_id, DietEntry.user_id == current_user.id)
    entry = session.exec(statement).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Diet entry not found")
        
    session.delete(entry)
    session.commit()
    return {"detail": "Diet entry deleted successfully"}
