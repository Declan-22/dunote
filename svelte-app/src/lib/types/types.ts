export interface TaskDump {
  title: string;
  description: string;
  tasks: string[];
  dependencies: string[];
  resources: string[];
}

export interface TaskNode {
  id: string;
  title: string;
  status: 'not-started' | 'in-progress' | 'completed';
  dependencies: string[];
  assignees: string[];
  dueDate?: Date;
}

export interface ProjectFlow {
  id: string;
  name: string;
  nodes: TaskNode[];
  edges: DependencyEdge[];
  version: number;
}

export interface DependencyEdge {
  source: string;
  target: string;
  type: 'blocking' | 'sequential' | 'resource';
}

export type Space = {
  id: string;
  name: string;
  href: string;
  icon: string;
  default: boolean;
  user_id?: string;
  color?: string; // Add this line
};