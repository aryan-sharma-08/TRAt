import os
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from google import genai
from google.genai import types
from app.models import User, Task, DietEntry, StudySubject, StudySession
from app.auth import get_current_user
from app.database import get_session
from sqlmodel import Session, select

router = APIRouter(prefix="/api/ai", tags=["ai"])

# Setup Gemini Config
# Load .env file manually if present
dotenv_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".env"))
if os.path.exists(dotenv_path):
    with open(dotenv_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ[key.strip()] = val.strip()

API_KEY = os.getenv("GEMINI_API_KEY", "")
client = None
if API_KEY:
    client = genai.Client(api_key=API_KEY)

# --- Pydantic Schemas for JSON Structured Outputs ---

class TaskProposalItem(BaseModel):
    title: str = Field(description="Short title of the task")
    description: str = Field(description="Detailed explanation of the task")
    category: str = Field(description="Task category, e.g., Study, Diet, General, Personal")
    priority: str = Field(description="Priority: High, Medium, or Low")
    due_date_offset_days: int = Field(description="Days from today when the task is due (0=today, 1=tomorrow, etc.)")
    due_time: str = Field(description="Time of day when the task is due in 24h format (e.g. '09:00')")

class TaskProposalList(BaseModel):
    tasks: List[TaskProposalItem]

class DietProposalItem(BaseModel):
    meal_type: str = Field(description="Breakfast, Lunch, Dinner, or Snack")
    description: str = Field(description="What the meal contains")
    calories: int = Field(description="Approximate calories in kcal")
    protein: int = Field(description="Approximate protein in grams")
    carbs: int = Field(description="Approximate carbohydrates in grams")
    fat: int = Field(description="Approximate fats in grams")

class DietProposalList(BaseModel):
    meals: List[DietProposalItem]

class DietChatResponse(BaseModel):
    reply: str = Field(description="The conversational text response from the AI assistant to the user.")
    proposed_meals: List[DietProposalItem] = Field(description="List of specific meals/foods mentioned or recommended that the user can directly log to their day.")

class StudyBlockProposalItem(BaseModel):
    subject_name: str = Field(description="Name of the subject to study")
    start_time: str = Field(description="Start time (24h format, e.g. '09:00')")
    end_time: str = Field(description="End time (24h format, e.g. '11:00')")
    day_of_week: int = Field(description="Day of week: 0=Monday, 6=Sunday")

class RebalancedHoursItem(BaseModel):
    subject_name: str
    target_hours: float

class StudyRebalanceProposalList(BaseModel):
    rebalanced_target_hours: List[RebalancedHoursItem]
    proposed_blocks: List[StudyBlockProposalItem]

# --- API Endpoints ---

@router.post("/schedule", response_model=TaskProposalList)
def generate_schedule(
    params: Dict[str, str],  # {"goals": "...", "available_hours": "8"}
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    goals = params.get("goals", "")
    available_hours = params.get("available_hours", "4")

    # Fetch existing tasks to make AI context-aware
    task_statement = select(Task).where(Task.user_id == current_user.id)
    existing_tasks = session.exec(task_statement).all()
    tasks_context = [
        f"- {t.title} ({t.category}, Priority: {t.priority}, Status: {t.status})"
        for t in existing_tasks[:15]
    ]
    tasks_str = "\n".join(tasks_context) if tasks_context else "None"

    prompt = f"""
    Create a highly focused daily schedule of tasks based on these goals: "{goals}".
    The user has {available_hours} hours of available productivity time today.
    
    Here is their current list of tasks to avoid duplicating and prioritize around:
    {tasks_str}
    
    Propose a list of tasks. Map out due date offsets relative to today (0 = today).
    """

    if not API_KEY:
        # Graceful fallback: mock structured JSON proposals if API key is missing
        return TaskProposalList(tasks=[
            TaskProposalItem(
                title="Review Core Study Material",
                description="Go through study material to align with daily goals.",
                category="Study",
                priority="High",
                due_date_offset_days=0,
                due_time="09:00"
            ),
            TaskProposalItem(
                title="Prepare High Energy Lunch",
                description="Make a healthy meal to sustain energy for study blocks.",
                category="Diet",
                priority="Medium",
                due_date_offset_days=0,
                due_time="13:00"
            ),
            TaskProposalItem(
                title="Evening Review & Rebalancing",
                description="Assess today's progress and schedule tomorrow's sessions.",
                category="General",
                priority="Low",
                due_date_offset_days=0,
                due_time="19:00"
            )
        ])

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=TaskProposalList,
            )
        )
        return TaskProposalList(**json.loads(response.text))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Gemini error: {str(e)}")


@router.post("/diet", response_model=DietProposalList)
def generate_diet(
    params: Dict[str, str],  # {"goal": "...", "preference": "...", "restrictions": "..."}
    current_user: User = Depends(get_current_user)
):
    goal = params.get("goal", "general health")
    preference = params.get("preference", "veg")
    restrictions = params.get("restrictions", "none")

    prompt = f"""
    Generate a daily meal plan (Breakfast, Lunch, Dinner, and 1-2 Snacks) based on:
    - Goal: {goal} (e.g. weight loss, muscle gain, exam energy)
    - Food preference: {preference} (e.g. veg, non-veg, vegan)
    - Dietary restrictions: {restrictions}
    
    Estimate calories and macros (Protein, Carbs, Fat in grams) for each meal.
    """

    if not API_KEY:
        # Mock fallback proposal if key is missing
        c_factor = 1.2 if goal == "muscle gain" else 0.8 if goal == "weight loss" else 1.0
        return DietProposalList(meals=[
            DietProposalItem(
                meal_type="Breakfast",
                description="Oatmeal with chia seeds, banana slices, and a scoop of protein powder (or almond butter)",
                calories=int(400 * c_factor), protein=25, carbs=55, fat=10
            ),
            DietProposalItem(
                meal_type="Lunch",
                description="Quinoa salad bowl with roasted chickpeas, avocado, spinach, and tahini dressing",
                calories=int(550 * c_factor), protein=20, carbs=70, fat=18
            ),
            DietProposalItem(
                meal_type="Snack",
                description="Greek yogurt or mixed nuts with berries",
                calories=int(200 * c_factor), protein=12, carbs=15, fat=8
            ),
            DietProposalItem(
                meal_type="Dinner",
                description="Grilled protein source (Paneer/Tofu for veg, Chicken/Fish for non-veg) with steamed broccoli and brown rice",
                calories=int(500 * c_factor), protein=35, carbs=45, fat=12
            )
        ])

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=DietProposalList,
            )
        )
        return DietProposalList(**json.loads(response.text))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Gemini error: {str(e)}")


@router.post("/diet/chat", response_model=DietChatResponse)
def chat_diet_assistant(
    params: Dict[str, Any],  # {"message": "...", "history": [{"role": "user/assistant", "text": "..."}]}
    current_user: User = Depends(get_current_user)
):
    message = params.get("message", "")
    msg_lower = message.lower()

    reply_text = "Offline Mode Recommendation:"
    proposed = []

    if "banana" in msg_lower or "shake" in msg_lower or "smoothie" in msg_lower:
        reply_text += " I recommend a Banana Milk Shake. Bananas provide potassium and complex carbohydrates for sustained energy."
        proposed.append(DietProposalItem(
            meal_type="Snack",
            description="Banana Milk Shake (1 medium banana, 250ml milk, 1 tsp honey)",
            calories=280, protein=8, carbs=48, fat=6
        ))
    elif "chicken" in msg_lower or "rice" in msg_lower or "dinner" in msg_lower:
        reply_text += " I recommend Grilled Chicken with Brown Rice. Rich in clean proteins and fiber to keep you full."
        proposed.append(DietProposalItem(
            meal_type="Dinner",
            description="Grilled Chicken Breast (150g) with Brown Rice (1 cup)",
            calories=450, protein=38, carbs=44, fat=7
        ))
    elif "egg" in msg_lower or "breakfast" in msg_lower:
        reply_text += " I recommend Boiled Eggs with Toast. A highly bioavailable breakfast option."
        proposed.append(DietProposalItem(
            meal_type="Breakfast",
            description="2 Boiled Eggs with 2 slices of Toast",
            calories=310, protein=18, carbs=28, fat=12
        ))

    return DietChatResponse(
        reply=reply_text,
        proposed_meals=proposed
    )


@router.post("/rebalance", response_model=StudyRebalanceProposalList)
def rebalance_study_schedule(
    params: Dict[str, str],
    current_user: User = Depends(get_current_user),
    session: Session = Depends(get_session)
):
    goals = params.get("goals", "Prepare for examinations")

    # Fetch subjects and actual tracked times
    sub_statement = select(StudySubject).where(StudySubject.user_id == current_user.id)
    subjects = session.exec(sub_statement).all()
    
    session_statement = select(StudySession).where(StudySession.user_id == current_user.id)
    sessions = session.exec(session_statement).all()

    # Calculate actual hours studied per subject
    subject_hours = {}
    for sub in subjects:
        subject_hours[sub.name] = 0.0
    for s in sessions:
        if s.subject_name in subject_hours:
            subject_hours[s.subject_name] += s.duration_seconds / 3600.0

    # Build context prompt
    subjects_context = []
    for sub in subjects:
        actual = round(subject_hours.get(sub.name, 0.0), 2)
        exam_str = f", Exam date: {sub.exam_date.date()}" if sub.exam_date else ""
        subjects_context.append(
            f"- {sub.name} (Target: {sub.target_hours}h/day, Actual Studied: {actual}h total, Priority: {sub.priority}{exam_str})"
        )
    subjects_str = "\n".join(subjects_context) if subjects_context else "None"

    prompt = f"""
    You are an intensive learning advisor. The user is aiming for a 10-12 hours per day study routine.
    They need to rebalance their daily schedule based on their current progress and exam deadlines.
    
    Stated Learning Goals: "{goals}"
    
    Here is their current subject status:
    {subjects_str}
    
    Propose:
    1. Adjusted daily target hours for each subject to allocate time where they are falling behind or where exams are closer.
    2. A structured set of daily study blocks (slots) with start and end times, specifying which subject to study and when. 
       Day of week must be between 0 (Monday) and 6 (Sunday).
    """

    if not API_KEY or not subjects:
        # Mock fallback proposal if key or subjects are missing
        mock_rebalanced = []
        for s in subjects:
            mock_rebalanced.append(RebalancedHoursItem(subject_name=s.name, target_hours=s.target_hours * 1.1))
        if not mock_rebalanced:
            mock_rebalanced = [
                RebalancedHoursItem(subject_name="Physics", target_hours=4.0),
                RebalancedHoursItem(subject_name="Chemistry", target_hours=3.5),
                RebalancedHoursItem(subject_name="Maths", target_hours=3.5)
            ]
            
        return StudyRebalanceProposalList(
            rebalanced_target_hours=mock_rebalanced,
            proposed_blocks=[
                StudyBlockProposalItem(subject_name=mock_rebalanced[0].subject_name, start_time="09:00", end_time="12:00", day_of_week=0),
                StudyBlockProposalItem(subject_name=mock_rebalanced[1].subject_name, start_time="13:00", end_time="16:00", day_of_week=0),
                StudyBlockProposalItem(subject_name=mock_rebalanced[2].subject_name, start_time="16:30", end_time="19:30", day_of_week=0)
            ]
        )

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=StudyRebalanceProposalList,
            )
        )
        return StudyRebalanceProposalList(**json.loads(response.text))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Gemini error: {str(e)}")
