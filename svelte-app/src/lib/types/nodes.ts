export type NodeType = 
  | 'project' 
  | 'task' 
  | 'milestone' 
  | 'resource' 
  | 'output' 
  | 'dependency' 
  | 'team' 
  | 'deadline'
  | 'review'
  | 'decision'
  | 'risk'
  | 'deliverable';

export interface NodeData {
  title: string;
  description?: string;
  url?: string;
  summary?: string;
  key_points?: string[];
  status?: 'not-started' | 'in-progress' | 'completed';
  content?: string;
  [key: string]: any;
}

export interface Node {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: NodeData;
  parent?: string;
  children?: string[];
  siloId: string;
  validation?: {
    isValid: boolean;
    missingConnections: NodeType[];
  };
}

export interface Connection {
  id: string;
  sourceId: string;
  targetId: string;
  type: 'function' | 'resource-connection';
  siloId: string;
}

export interface Silo {
  id: string;
  name: string;
  nodes: Node[];
  connections: Connection[];
  viewState?: {
    zoom: number;
    pan: { x: number; y: number };
  };
  isLoading?: boolean;
  selectedNode?: Node | null;
}

export const NODE_TYPES = {
  resource: {
    icon: '📦',
    name: 'Resource',
    description: 'A source of information or data',
    color: '#4CAF50'
  },
  task: {
    icon: '📦',
    name: 'Task',
    description: 'An actionable item',
    color: '#2196F3'
  },
  project: {
    icon: '📦',
    name: 'Project',
    description: 'A collection of tasks and resources',
    color: '#9C27B0'
  },
  milestone: {
    icon: '📦',
    name: 'Milestone',
    description: 'A significant point in the project',
    color: '#FF9800'
  },
  output: {
    icon: '📦',
    name: 'Output',
    description: 'Final product or result of the workflow',
    color: '#009688'
  },
  dependency: {
    icon: '📦',
    name: 'Dependency',
    description: 'Task that must be completed before others',
    color: '#F44336'
  },
  team: {
    icon: '📦',
    name: 'Team',
    description: 'Group responsible for project components',
    color: '#673AB7'
  },
  deadline: {
    icon: '📦',
    name: 'Deadline',
    description: 'Critical date for project completion',
    color: '#E91E63'
  },
  review: {
    icon: '📦',
    name: 'Review',
    description: 'Quality check or approval point',
    color: '#CDDC39'
  },
  decision: {
    icon: '📦',
    name: 'Decision',
    description: 'Key choice point in the workflow',
    color: '#795548'
  },
  risk: {
    icon: '📦',
    name: 'Risk',
    description: 'Potential issue or obstacle',
    color: '#FF5722'
  },
  deliverable: {
    icon: '📦',
    name: 'Deliverable',
    description: 'Tangible project output',
    color: '#00BCD4'
  }
};
