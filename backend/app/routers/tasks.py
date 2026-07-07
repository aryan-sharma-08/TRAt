from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlmodel import Session, select
from app.database import get_session
from app.models import Task, User
from app.auth import get_current_user

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    category: Optional[str] = "General"
    priority: Optional[str] = "Medium"
    due_date: Optional[datetime] = None
    recurrence: Optional[str] = "none"
    status: Optional[str] = "todo"

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[datetime] = None
    recurrence: Optional[str] = None
    status: Optional[str] = None

@router.get("", response_model=List[Task])
def get_tasks(
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    statement = select(Task).where(Task.user_id == current_user.id).order_by(Task.created_at.desc())
    tasks = session.exec(statement).all()
    return tasks

@router.post("", response_model=Task)
def create_task(
    task_data: TaskCreate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    new_task = Task(
        title=task_data.title,
        description=task_data.description,
        category=task_data.category,
        priority=task_data.priority,
        due_date=task_data.due_date,
        recurrence=task_data.recurrence,
        status=task_data.status,
        user_id=current_user.id
    )
    session.add(new_task)
    session.commit()
    session.refresh(new_task)
    return new_task

@router.put("/{task_id}", response_model=Task)
def update_task(
    task_id: int,
    task_data: TaskUpdate,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    statement = select(Task).where(Task.id == task_id, Task.user_id == current_user.id)
    task = session.exec(statement).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    update_dict = task_data.model_dump(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(task, key, value)
        
    session.add(task)
    session.commit()
    session.refresh(task)
    return task

@router.delete("/{task_id}")
def delete_task(
    task_id: int,
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    statement = select(Task).where(Task.id == task_id, Task.user_id == current_user.id)
    task = session.exec(statement).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    session.delete(task)
    session.commit()
    return {"detail": "Task deleted successfully"}
