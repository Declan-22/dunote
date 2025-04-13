from fastapi import FastAPI, HTTPException, Depends, Query, Request
from fastapi.security import OAuth2PasswordBearer
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
import json
import os
from datetime import datetime
import logging
from supabase import create_client, Client

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from task_model import Task, Silo, TaskStatus, TaskPriority, TaskRelationship
from task_processor import TaskProcessor

from contextlib import asynccontextmanager
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
class ProcessTasksRequest(BaseModel):
    tasks: list[str]
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
# Initialize Supabase client


# Initialize OAuth2 scheme for token-based authentication
async def get_current_user(token: str = Depends(oauth2_scheme)):
    user = await supabase.auth.get_user(token)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return user

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup code
    try:
        load_from_file()
    except Exception as e:
        print(f"Error loading data: {e}")
    yield
    # Shutdown code would go here

app = FastAPI(title="Silo Task Manager API", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with actual frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize task processor
task_processor = TaskProcessor()

# In-memory storage (replace with proper database in production)
tasks = {}
silos = {}

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url}")
    try:
        response = await call_next(request)
    except Exception as exc:
        logger.error(f"Request error: {str(exc)}", exc_info=True)
        raise
    logger.info(f"Response status: {response.status_code}")
    return response

# Data storage helpers
def save_to_file():
    """Save data to a JSON file (temporary solution)"""
    data = {
        "tasks": tasks,
        "silos": silos
    }
    with open("data.json", "w") as f:
        json.dump(data, f, default=str)

def load_from_file():
    """Load data from a JSON file (temporary solution)"""
    global tasks, silos
    if not os.path.exists("data.json"):
        return
    
    with open("data.json", "r") as f:
        data = json.load(f)
        # Convert string keys back to objects
        tasks = {k: Task.parse_obj(v) for k, v in data.get("tasks", {}).items()}
        silos = {k: Silo.parse_obj(v) for k, v in data.get("silos", {}).items()}

# Try to load existing data on startup
@app.on_event("startup")
async def startup_event():
    try:
        load_from_file()
    except Exception as e:
        print(f"Error loading data: {e}")

@app.get("/test-ai")
async def test_ai():
    test_task = "Write research paper about AI ethics"
    processed = task_processor.parse_task(test_task)
    return processed

# Models for API requests
class TaskCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    silo_id: Optional[str] = None
    parse_with_ai: Optional[bool] = True

class SiloCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    color: Optional[str] = "#4f46e5"
    parent_id: Optional[str] = None
    icon: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    estimated_time: Optional[str] = None
    silo_id: Optional[str] = None
    completion_percentage: Optional[int] = None
    note: Optional[str] = None

class SiloUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    parent_id: Optional[str] = None
    icon: Optional[str] = None

# API endpoints for Tasks
@app.post("/api/tasks", response_model=Task)
async def create_task(task_data: TaskCreate):
    if task_data.parse_with_ai:
        # Use AI to parse the task
        parsed_task = task_processor.parse_task(
            f"{task_data.title}\n{task_data.description}"
        )
        
        # If silo_id is not provided, suggest one
        if not task_data.silo_id:
            available_silos = list(silos.values())
            if available_silos:
                task_data.silo_id = task_processor.suggest_silo(parsed_task, available_silos)
            else:
                raise HTTPException(status_code=400, detail="No silos available. Create a silo first.")
        
        # Use the original title and description if they were provided explicitly
        if task_data.title:
            parsed_task.title = task_data.title
        if task_data.description:
            parsed_task.description = task_data.description
            
        parsed_task.silo_id = task_data.silo_id
        
        # Estimate completion time if not set
        if not parsed_task.estimated_time:
            parsed_task.estimated_time = task_processor.estimate_completion_time(parsed_task)
        
        # Save the task
        tasks[parsed_task.id] = parsed_task
        
        # Add task to silo
        if parsed_task.silo_id in silos:
            silos[parsed_task.silo_id].add_task(parsed_task.id)
        
        save_to_file()
        return parsed_task
    else:
        # Create task manually without AI processing
        if not task_data.silo_id:
            raise HTTPException(status_code=400, detail="Silo ID is required when AI parsing is disabled")
            
        new_task = Task(
            title=task_data.title,
            description=task_data.description or "",
            silo_id=task_data.silo_id
        )
        
        tasks[new_task.id] = new_task
        
        # Add task to silo
        if new_task.silo_id in silos:
            silos[new_task.silo_id].add_task(new_task.id)
        
        save_to_file()
        return new_task

@app.get("/api/tasks", response_model=List[Task])
async def get_tasks(
    skip: int = 0, 
    limit: int = 50, 
    silo_id: Optional[str] = None, 
    status: Optional[str] = None, 
    priority: Optional[str] = None
):
    result = list(tasks.values())
    
    # Apply filters
    if silo_id:
        result = [t for t in result if t.silo_id == silo_id]
    if status:
        result = [t for t in result if t.status.value == status]
    if priority:
        result = [t for t in result if t.priority.value == priority]
    
    return result[skip : skip + limit]

@app.get("/api/tasks/{task_id}", response_model=Task)
async def get_task(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
    return tasks[task_id]

@app.put("/api/tasks/{task_id}", response_model=Task)
async def update_task(task_id: str, task_update: TaskUpdate):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task = tasks[task_id]
    
    # Update fields if provided
    if task_update.title is not None:
        task.title = task_update.title
    if task_update.description is not None:
        task.description = task_update.description
    if task_update.status is not None:
        try:
            task.status = TaskStatus(task_update.status)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid status: {task_update.status}")
    if task_update.priority is not None:
        try:
            task.priority = TaskPriority(task_update.priority)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid priority: {task_update.priority}")
    if task_update.due_date is not None:
        try:
            task.due_date = datetime.fromisoformat(task_update.due_date) if task_update.due_date else None
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
    if task_update.estimated_time is not None:
        task.estimated_time = task_update.estimated_time
    if task_update.silo_id is not None:
        # Remove from old silo
        if task.silo_id and task.silo_id in silos:
            silos[task.silo_id].remove_task(task_id)
        
        # Add to new silo
        task.silo_id = task_update.silo_id
        if task.silo_id in silos:
            silos[task.silo_id].add_task(task_id)
    if task_update.completion_percentage is not None:
        task.completion_percentage = max(0, min(100, task_update.completion_percentage))
        
        # Auto-update status based on completion percentage
        if task.completion_percentage == 100 and task.status != TaskStatus.COMPLETED:
            task.status = TaskStatus.COMPLETED
        elif task.completion_percentage > 0 and task.status == TaskStatus.NOT_STARTED:
            task.status = TaskStatus.IN_PROGRESS
    
    # Add note if provided
    if task_update.note:
        task.add_note(task_update.note)
    
    task.updated_at = datetime.now()
    save_to_file()
    return task

@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task = tasks[task_id]
    
    # Remove from silo
    if task.silo_id and task.silo_id in silos:
        silos[task.silo_id].remove_task(task_id)
    
    # Remove relationships
    for t in tasks.values():
        t.remove_relationship(task_id)
    
    # Remove the task
    del tasks[task_id]
    save_to_file()
    return {"status": "success", "message": "Task deleted"}

@app.post("/api/tasks/process")
async def process_tasks(request: ProcessTasksRequest):
    try:
        if not request.tasks:
            raise HTTPException(status_code=400, detail="No tasks provided")
        
        # Add debug logging
        print(f"Processing {len(request.tasks)} tasks:")
        for task in request.tasks:
            print(f" - {task}")
        
        processed = task_processor.process_task_dump(request.tasks)
        
        # Check for warnings but don't fail the request
        if "error" in processed:
            logger.warning(f"Task processing warning: {processed['error']}")
        
        # Always return a valid response structure, even if analysis partially failed
        return {
            "nodes": processed.get("nodes", []),
            "edges": processed.get("dependencies", []),
            "critical_path": processed.get("critical_path", []),
            "warning": processed.get("warning")  # Include any warnings for the frontend
        }
        
    except Exception as e:
        logger.error(f"Processing error: {str(e)}")
        
        # Try to extract a meaningful error message
        detail = str(e)
        if "500:" in detail:
            detail = detail.split("500:", 1)[1].strip()
        
        # For server errors, still return a useful response with default sequential dependencies
        # This ensures the frontend gets something it can display
        if isinstance(e, HTTPException) and e.status_code >= 500:
            # Try to parse the tasks and create a basic response
            try:
                tasks = []
                for item in request.tasks:
                    # Use a simplified version of your parsing logic
                    if isinstance(item, str):
                        lines = item.strip().split('\n')
                        for line in lines:
                            if line.strip().startswith('-'):
                                tasks.append(line.strip()[1:].strip())
                
                # Create nodes and a simple sequential dependency chain
                nodes = [
                    {
                        "id": f"task_{i}",
                        "type": "task",
                        "title": task,
                        "label": task,
                        "name": task,
                        "taskName": task,
                        "duration": 1.0
                    }
                    for i, task in enumerate(tasks)
                ]
                
                edges = [[f"task_{i}", f"task_{i+1}"] for i in range(len(tasks) - 1)]
                critical_path = [f"task_{i}" for i in range(len(tasks))]
                
                return {
                    "nodes": nodes,
                    "edges": edges,
                    "critical_path": critical_path,
                    "warning": f"AI processing failed: {detail}. Using fallback sequential dependencies."
                }
            except Exception as inner_e:
                logger.error(f"Fallback error: {str(inner_e)}")
                
        # If we couldn't create a fallback, raise the original error
        raise HTTPException(status_code=500, detail=f"Processing failed: {detail}")

# Task relationship endpoints
@app.post("/api/tasks/{task_id}/relationships/{related_task_id}")
async def create_relationship(
    task_id: str, 
    related_task_id: str, 
    relationship_type: TaskRelationship = Query(..., enum=[r.value for r in TaskRelationship])
):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    if related_task_id not in tasks:
        raise HTTPException(status_code=404, detail=f"Related task {related_task_id} not found")
    if task_id == related_task_id:
        raise HTTPException(status_code=400, detail="Cannot create relationship to self")
        
    try:
        rel_type = TaskRelationship(relationship_type)
        tasks[task_id].add_relationship(related_task_id, rel_type)
        save_to_file()
        return {"status": "success", "message": "Relationship created"}
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid relationship type: {relationship_type}")

@app.delete("/api/tasks/{task_id}/relationships/{related_task_id}")
async def delete_relationship(task_id: str, related_task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
        
    tasks[task_id].remove_relationship(related_task_id)
    save_to_file()
    return {"status": "success", "message": "Relationship removed"}

# API endpoints for Silos
@app.post("/api/silos", response_model=Silo)
async def create_silo(silo_data: SiloCreate):
    # Validate parent silo if provided
    if silo_data.parent_id and silo_data.parent_id not in silos:
        raise HTTPException(status_code=404, detail=f"Parent silo {silo_data.parent_id} not found")
        
    new_silo = Silo(
        name=silo_data.name,
        description=silo_data.description,
        color=silo_data.color,
        parent_id=silo_data.parent_id,
        icon=silo_data.icon
    )
    
    silos[new_silo.id] = new_silo
    
    # Add to parent silo if provided
    if new_silo.parent_id:
        silos[new_silo.parent_id].add_child(new_silo.id)
    
    save_to_file()
    return new_silo

@app.get("/api/silos", response_model=List[Silo])
async def get_silos(parent_id: Optional[str] = None):
    result = list(silos.values())
    
    # Filter by parent_id if provided
    if parent_id is not None:
        if parent_id == "":
            # Get root silos (those with no parent)
            result = [s for s in result if s.parent_id is None]
        else:
            # Get silos with specific parent
            result = [s for s in result if s.parent_id == parent_id]
    
    return result

@app.get("/api/silos/{silo_id}", response_model=Silo)
async def get_silo(silo_id: str):
    if silo_id not in silos:
        raise HTTPException(status_code=404, detail="Silo not found")
    return silos[silo_id]

@app.put("/api/silos/{silo_id}", response_model=Silo)
async def update_silo(silo_id: str, silo_update: SiloUpdate):
    if silo_id not in silos:
        raise HTTPException(status_code=404, detail="Silo not found")
        
    silo = silos[silo_id]
    
    # Update fields if provided
    if silo_update.name is not None:
        silo.name = silo_update.name
    if silo_update.description is not None:
        silo.description = silo_update.description
    if silo_update.color is not None:
        silo.color = silo_update.color
    if silo_update.icon is not None:
        silo.icon = silo_update.icon
    
    # Handle parent changes
    if silo_update.parent_id is not None and silo_update.parent_id != silo.parent_id:
        # Check for cycles
        if silo_update.parent_id and silo_update.parent_id == silo_id:
            raise HTTPException(status_code=400, detail="Cannot set self as parent")
            
        # Check if new parent exists
        if silo_update.parent_id and silo_update.parent_id not in silos:
            raise HTTPException(status_code=404, detail=f"Parent silo {silo_update.parent_id} not found")
            
        # Remove from old parent
        if silo.parent_id and silo.parent_id in silos:
            silos[silo.parent_id].remove_child(silo_id)
            
        # Set new parent
        silo.parent_id = silo_update.parent_id
        
        # Add to new parent
        if silo.parent_id:
            silos[silo.parent_id].add_child(silo_id)
    
    silo.updated_at = datetime.now()
    save_to_file()
    return silo

@app.delete("/api/silos/{silo_id}")
async def delete_silo(silo_id: str, reassign_tasks: Optional[str] = None):
    if silo_id not in silos:
        raise HTTPException(status_code=404, detail="Silo not found")
        
    # Check if reassign_tasks silo exists
    if reassign_tasks and reassign_tasks not in silos:
        raise HTTPException(status_code=404, detail=f"Reassignment silo {reassign_tasks} not found")
        
    silo = silos[silo_id]
    
    # Handle child silos
    for child_id in silo.children[:]:  # Create a copy to iterate
        if reassign_tasks:
            # Move child to new parent
            silos[child_id].parent_id = reassign_tasks
            silos[reassign_tasks].add_child(child_id)
        else:
            # Make child a root silo
            silos[child_id].parent_id = None
    
    # Handle tasks
    task_ids = [t_id for t_id in tasks if tasks[t_id].silo_id == silo_id]
    for task_id in task_ids:
        if reassign_tasks:
            # Move task to new silo
            tasks[task_id].silo_id = reassign_tasks
            silos[reassign_tasks].add_task(task_id)
        else:
            # Remove silo association
            tasks[task_id].silo_id = None
    
    # Remove from parent
    if silo.parent_id and silo.parent_id in silos:
        silos[silo.parent_id].remove_child(silo_id)
    
    # Remove the silo
    del silos[silo_id]
    save_to_file()
    return {"status": "success", "message": "Silo deleted"}

# AI-assisted features
@app.post("/api/ai/analyze-task")
async def analyze_task(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task = tasks[task_id]
    analysis = task_processor.analyze_task(task)
    
    # Update the task with analysis
    tasks[task_id] = analysis
    save_to_file()
    
    return analysis

@app.post("/api/ai/suggest-dependencies")
async def suggest_dependencies(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task = tasks[task_id]
    all_tasks = list(tasks.values())
    
    # Remove the task itself from the list
    other_tasks = [t for t in all_tasks if t.id != task_id]
    
    # Get suggested dependencies
    suggestions = task_processor.suggest_dependencies(task, other_tasks)
    
    return {
        "task_id": task_id,
        "suggestions": suggestions
    }

@app.post("/api/ai/breakdown-task")
async def breakdown_task(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="Task not found")
        
    task = tasks[task_id]
    subtasks = task_processor.break_down_task(task)
    
    # Create and save the subtasks
    created_subtasks = []
    for subtask in subtasks:
        subtask.silo_id = task.silo_id
        subtask.add_relationship(task_id, TaskRelationship.CHILD_OF)
        tasks[subtask.id] = subtask
        
        # Add to silo
        if subtask.silo_id in silos:
            silos[subtask.silo_id].add_task(subtask.id)
            
        created_subtasks.append(subtask)
    
    save_to_file()
    return created_subtasks

@app.post("/api/ai/suggest-next-task")
async def suggest_next_task():
    """Suggest the next task to work on based on priority, dependencies, and due dates"""
    if not tasks:
        raise HTTPException(status_code=404, detail="No tasks available")
    
    all_tasks = list(tasks.values())
    suggested_task = task_processor.suggest_next_task(all_tasks)
    
    return suggested_task

@app.post("/api/ai/batch-create")
async def batch_create_tasks(text: str, silo_id: Optional[str] = None):
    """Create multiple tasks from a text description or list"""
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
        
    # If silo_id is not provided but we have silos, use the first one
    if not silo_id and silos:
        silo_id = next(iter(silos))
    
    # Create tasks
    created_tasks = task_processor.create_tasks_from_text(text, silo_id)
    
    # Save tasks
    for task in created_tasks:
        tasks[task.id] = task
        
        # Add to silo
        if task.silo_id and task.silo_id in silos:
            silos[task.silo_id].add_task(task.id)
    
    save_to_file()
    return created_tasks

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)