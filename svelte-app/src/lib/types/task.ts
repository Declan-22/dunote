// src/lib/types/task.ts
import type { NodeType } from "$lib/types/nodes";

export enum TaskPriority {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  URGENT = "urgent"
}
export interface SiloNode {
  id: string;
  type: 'task' | 'source';
  position: Position;
  data: {
    title: string;
    label: string;
    description?: string;
    url?: string;
    summary?: string;
    key_points?: string[];
    status?: string;
    priority?: string;
    tags?: string[];
  };
  children: string[];
  parent?: string;
  metadata: {
    ai_generated: boolean;
    created_at: string;
  };
}
export enum TaskStatus {
  TODO = "todo",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  ARCHIVED = "archived"
}

export interface Position {
  x: number;
  y: number;
}

export interface TaskNodeMetadata {
  ai_generated: boolean;
  created_at: string;
  [key: string]: any;
}

export interface TaskNode {
  id: string;
  type: "task" | "source";
  position: Position;
  data: {
    title: string;
    label: string;
    description?: string;
    url?: string;
    summary?: string;
    key_points?: string[];
  };
  original_text?: string;
  children: string[];
  parent: string | null;
  priority?: string;
  status?: string;  // Add status field
  tags?: string[];
  metadata: TaskNodeMetadata;
}

export interface NodeDependency {
  source: string;
  target: string;
}

export interface TaskProcessorResponse {
  nodes: TaskNode[];
  dependencies: string[][];
  critical_path: string[];
  error?: string;
  warning?: string;
}

// Additional interface to help with creating new nodes
export interface Task {
  title: string;
  description?: string;
  priority: TaskPriority;
  due_date?: Date;
  estimated_time?: Duration;
  tags?: string[];
  silo_id: string;
  ai_generated: boolean;
  status?: TaskStatus;
}

// For time duration
export interface Duration {
  hours: number;
  minutes: number;
}

// For a complete silo containing multiple tasks
export interface Silo {
  id: string;
  name: string;
  description?: string;
  tasks: Task[];
  created_at: Date;
  updated_at: Date;
}