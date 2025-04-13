import type { SiloNode, SiloEdge, Position } from '$lib/stores/siloStore';
import { NODE_TYPES } from '$lib/types/nodes';
import type { NodeType } from '$lib/types/nodes';
import type { Node, NodeData, Connection } from '$lib/types/nodes';

export function validateNode(node: SiloNode): SiloNode {
  // Ensure required fields exist
  return {
    ...node,
    data: {
      ...node.data,
      title: node.data?.title || NODE_TYPES[node.type].name,
      description: node.data?.description || '',
      url: validateUrl(node.data?.url),
      status: node.data?.status || 'not-started'
    }
  };
}

export function validateUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    new URL(url);
    return url;
  } catch {
    return undefined;
  }
}

export const VALID_CONNECTIONS: Record<NodeType, NodeType[]> = {
  project: ['task', 'milestone', 'output'],
  task: ['dependency', 'resource', 'team', 'deadline'],
  milestone: ['task', 'dependency'],
  dependency: ['task', 'milestone'],
  resource: ['task', 'team'],
  team: ['task', 'resource'],
  deadline: ['task', 'milestone'],

  output: [],
  review: ['task', 'milestone'],
  decision: ['task', 'project'],
  risk: ['task', 'milestone'],
  deliverable: ['task', 'project']
};

export function calculateConnectionPath(source: { x: number; y: number }, target: { x: number; y: number }): string {
  const { x: x1, y: y1 } = source;
  const { x: x2, y: y2 } = target;
  return `M${x1},${y1} L${x2},${y2}`;
}

export function snapToGrid(position: { x: number; y: number }, gridSize = 20): { x: number; y: number } {
  return {
    x: Math.round(position.x / gridSize) * gridSize,
    y: Math.round(position.y / gridSize) * gridSize
  };
}

export interface ValidationResult {
  isValid: boolean;
  missingConnections: NodeType[];
}

export function validateNodeConnections(node: SiloNode, edges: SiloEdge[], allNodes: SiloNode[]): ValidationResult {
  const required: NodeType[] = [];
  
  // Tasks require at least one resource if they have children
  if (node.type === 'task' && node.children?.length) {
      const hasResource = edges.some(e => 
          e.source === node.id && 
          allNodes.find(n => n.id === e.target)?.type === 'resource'
      );
      if (!hasResource) required.push('resource');
  }

  // Resources must connect to their parent task
  if (node.type === 'resource') {
      const hasTaskConnection = edges.some(e => 
          e.target === node.parent || 
          e.source === node.parent
      );
      if (!hasTaskConnection) required.push('task');
  }

  return {
      isValid: required.length === 0,
      missingConnections: required
  };
}

export const nodeUtils = {
  createNode: (type: NodeType, position: { x: number; y: number }, siloId: string): Node => {
    return {
      id: crypto.randomUUID(),
      type,
      position,
      siloId,
      data: {
        title: NODE_TYPES[type].name,
        description: '',
        status: 'not-started'
      },
      validation: {
        isValid: true,
        missingConnections: []
      }
    };
  },

  updateNodeData: (node: Node, newData: Partial<NodeData>): Node => {
    return {
      ...node,
      data: {
        ...node.data,
        ...newData
      }
    };
  },

  addFunction: (node: Node, functionName: string, output: any): Node => {
    return {
      ...node,
      data: {
        ...node.data,
        [functionName]: output
      }
    };
  },

  getAvailableFunctions: (type: NodeType): string[] => {
    switch (type) {
      case 'resource':
        return ['extract_quotes', 'summarize', 'generate_citations'];
      case 'task':
        return ['add_subtask', 'check_requirements'];
      case 'project':
        return ['create_milestone', 'generate_timeline'];
      case 'milestone':
        return ['check_dependencies', 'update_status'];
      default:
        return [];
    }
  },

  validateConnection: (sourceNode: Node, targetNode: Node): boolean => {
    // Prevent self-connections
    if (sourceNode.id === targetNode.id) return false;

    // Prevent circular dependencies
    const visited = new Set<string>();
    const stack = [targetNode.id];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (currentId === sourceNode.id) return false;
      if (visited.has(currentId)) continue;
      visited.add(currentId);
    }

    // Type-specific validation rules
    switch (sourceNode.type) {
      case 'resource':
        return ['task', 'project'].includes(targetNode.type);
      case 'task':
        return ['project', 'milestone'].includes(targetNode.type);
      case 'project':
        return ['milestone'].includes(targetNode.type);
      case 'milestone':
        return false; // Milestones can't be sources
      default:
        return false;
    }
  },

  calculateNodePosition: (node: Node, connectedNodes: Node[]): { x: number; y: number } => {
    if (connectedNodes.length === 0) {
      return node.position;
    }

    const avgX = connectedNodes.reduce((sum, n) => sum + n.position.x, 0) / connectedNodes.length;
    const avgY = connectedNodes.reduce((sum, n) => sum + n.position.y, 0) / connectedNodes.length;

    return {
      x: avgX + 200, // Offset to the right
      y: avgY
    };
  },

  // Helper functions for node operations
  extractQuotes: (node: Node) => {
    return {
      quotes: node.data.content?.split('\n').filter(line => line.startsWith('>')) || []
    };
  },

  summarizeContent: (node: Node) => {
    return {
      summary: node.data.content?.substring(0, 200) + '...' || ''
    };
  },

  generateCitations: (node: Node) => {
    return {
      citations: [{
        title: node.data.title,
        url: node.data.url,
        date: new Date().toISOString()
      }]
    };
  },

  createDefaultSubtask: () => {
    return {
      id: crypto.randomUUID(),
      title: 'New Subtask',
      status: 'not-started'
    };
  },

  checkRequirements: (node: Node, connections: Connection[]) => {
    const edges = connections.filter(e => e.targetId === node.id);
    return {
      hasDependencies: edges.length > 0,
      isComplete: node.data.status === 'completed'
    };
  }
};