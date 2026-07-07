from typing import Optional, List
from datetime import datetime
from sqlmodel import SQLModel, Field, Relationship

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    tasks: List["Task"] = Relationship(back_populates="user", cascade_delete=True)
    diets: List["DietEntry"] = Relationship(back_populates="user", cascade_delete=True)
    subjects: List["StudySubject"] = Relationship(back_populates="user", cascade_delete=True)
    study_blocks: List["StudyBlock"] = Relationship(back_populates="user", cascade_delete=True)
    study_sessions: List["StudySession"] = Relationship(back_populates="user", cascade_delete=True)

class Task(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(index=True)
    description: str = Field(default="")
    category: str = Field(default="General")  # e.g., Study, Diet, General, Personal
    priority: str = Field(default="Medium")   # High, Medium, Low
    due_date: Optional[datetime] = Field(default=None)
    recurrence: str = Field(default="none")   # none, daily, weekly, custom
    status: str = Field(default="todo")       # todo, done
    user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    # Relationships
    user: Optional[User] = Relationship(back_populates="tasks")

class DietEntry(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    meal_type: str = Field(index=True)  # Breakfast, Lunch, Dinner, Snack
    description: str
    calories: int = Field(default=0)
    protein: int = Field(default=0)
    carbs: int = Field(default=0)
    fat: int = Field(default=0)
    status: str = Field(default="todo")  # todo, done (eaten)
    date: datetime = Field(index=True)  # Day this entry is scheduled for
    user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: Optional[User] = Relationship(back_populates="diets")

class StudySubject(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True)
    target_hours: float = Field(default=2.0)  # Target study hours per day
    priority: str = Field(default="Medium")   # High, Medium, Low
    exam_date: Optional[datetime] = Field(default=None)
    user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: Optional[User] = Relationship(back_populates="subjects")
    sessions: List["StudySession"] = Relationship(back_populates="subject", cascade_delete=True)

class StudyBlock(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    subject_name: str
    start_time: str = Field(default="09:00")  # e.g., "09:00"
    end_time: str = Field(default="10:00")    # e.g., "10:00"
    day_of_week: int = Field(default=0)       # 0 = Monday, 6 = Sunday
    user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: Optional[User] = Relationship(back_populates="study_blocks")

class StudySession(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    subject_id: Optional[int] = Field(default=None, foreign_key="studysubject.id")
    subject_name: str  # Saved copy in case subject is deleted
    start_time: datetime
    end_time: datetime
    duration_seconds: int = Field(default=0)
    user_id: int = Field(foreign_key="user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    user: Optional[User] = Relationship(back_populates="study_sessions")
    subject: Optional[StudySubject] = Relationship(back_populates="sessions")
