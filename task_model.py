from typing import List, Dict, Optional, Union
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from enum import Enum
import uuid


class TaskStatus(str, Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class TaskPriority(Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"


class Task(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str = Field(default="No description provided", min_length=1)
    status: TaskStatus = TaskStatus.NOT_STARTED
    priority: TaskPriority = TaskPriority.MEDIUM
    created_at: datetime = Field(default_factory=datetime.now)
    due_date: Optional[datetime] = None
    estimated_time: Optional[timedelta] = None
    actual_time: Optional[timedelta] = None
    tags: List[str] = []
    parent_id: Optional[str] = None
    silo_id: str
    dependencies: List[str] = []  # IDs of tasks this task depends on
    dependents: List[str] = []    # IDs of tasks that depend on this task
    ai_generated: bool = False
    completion_percentage: int = 0
    notes: List[Dict[str, Union[str, datetime]]] = []
    
    def add_dependency(self, task_id: str):
        if task_id not in self.dependencies:
            self.dependencies.append(task_id)
            
    def remove_dependency(self, task_id: str):
        if task_id in self.dependencies:
            self.dependencies.remove(task_id)
    
    def add_dependent(self, task_id: str):
        if task_id not in self.dependents:
            self.dependents.append(task_id)
            
    def remove_dependent(self, task_id: str):
        if task_id in self.dependents:
            self.dependents.remove(task_id)
    
    def add_note(self, content: str):
        self.notes.append({
            "content": content,
            "timestamp": datetime.now()
        })


class Silo(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    created_at: datetime = Field(default_factory=datetime.now)
    color: str = "#4f46e5"  # Default indigo color
    tasks: List[str] = []  # List of task IDs
    parent_id: Optional[str] = None
    children: List[str] = []  # List of child silo IDs
    icon: Optional[str] = None
    
    def add_task(self, task_id: str):
        if task_id not in self.tasks:
            self.tasks.append(task_id)
            
    def remove_task(self, task_id: str):
        if task_id in self.tasks:
            self.tasks.remove(task_id)
    
    def add_child(self, silo_id: str):
        if silo_id not in self.children:
            self.children.append(silo_id)
            
    def remove_child(self, silo_id: str):
        if silo_id in self.children:
            self.children.remove(silo_id)


class TaskRelationship(str, Enum):
    DEPENDS_ON = "depends_on"
    BLOCKS = "blocks"
    RELATED_TO = "related_to"