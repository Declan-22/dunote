import { writable, get, derived } from 'svelte/store';
import type { NodeType } from '$lib/types/nodes';
import { browser } from '$app/environment';
import { validateNodeConnections } from '$lib/utils/nodeUtils';
import { NODE_TYPES } from '$lib/types/nodes';
import { nodeUtils } from '$lib/utils/nodeUtils';
import { goto } from '$app/navigation';
import { supabase } from '$lib/supabaseClient';
import { user } from '$lib/stores/userStore';



export type Position = { x: number; y: number };
export type SiloNodeId = string;

export interface PortPosition {
  input: Position;
  output: Position;
}

export interface ConnectionPoint {
  nodeId: string;
  portType: 'input' | 'output';
}


export interface SiloNode {
  updated_at: string;
  created_at: string;
  id: SiloNodeId;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    title: string;
    description?: string;
    url?: string;
    summary?: string;
    key_points?: string[];
    status?: 'not-started' | 'in-progress' | 'completed';
    comments?: Array<{ text: string; timestamp: string; author: string }>;
    [key: string]: any;
  };
  parent?: string;
  children?: string[];
  siloId: string;
  portPositions?: PortPosition;
  validation?: {
    isValid: boolean;
    missingConnections: NodeType[];
  };
  width?: number; // Add width property
}


export interface SiloEdge {
  id: string;
  source: string;
  sourceHandle?: string;
  target: string;
  targetHandle?: string;
  siloId: string;
  animated?: boolean;
  type?: string;
  // Use a union type instead of string
  pathType?: 'straight' | 'bezier' | 'step';
  pathData?: {
    sourceX: number;
    sourceY: number;
    targetX: number;
    targetY: number;
    controlPoint1X?: number;
    controlPoint1Y?: number;
    controlPoint2X?: number;
    controlPoint2Y?: number;
  };
}


export function calculateConnectionPath(
  sourceNode: SiloNode,
  targetNode: SiloNode,
  sourceHandle: string | undefined,
  targetHandle: string | undefined
): SiloEdge['pathData'] {
  // Default to node center if no port positions are available
  let sourceX = sourceNode.position.x + 75; // assuming node width of 150
  let sourceY = sourceNode.position.y + 50; // assuming node height of 100
  let targetX = targetNode.position.x + 75;
  let targetY = targetNode.position.y + 50;

  // Extract port index from handle name if available
  const sourcePortIndex = sourceHandle ? parseInt(sourceHandle.split('-')[1] || '0') : 0;
  const targetPortIndex = targetHandle ? parseInt(targetHandle.split('-')[1] || '0') : 0;

  // Use port positions if available
  if (sourceNode.portPositions && sourceHandle?.startsWith('output')) {
    sourceX = sourceNode.position.x + sourceNode.portPositions.output.x;
    sourceY = sourceNode.position.y + sourceNode.portPositions.output.y;
  }

  if (targetNode.portPositions && targetHandle?.startsWith('input')) {
    targetX = targetNode.position.x + targetNode.portPositions.input.x;
    targetY = targetNode.position.y + targetNode.portPositions.input.y;
  }

  // Calculate control points for bezier curve
  // Make the curve more pronounced based on distance
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Control point offset proportional to distance
  const offset = Math.min(distance * 0.5, 150);
  
  const controlPoint1X = sourceX + offset;
  const controlPoint1Y = sourceY;
  const controlPoint2X = targetX - offset;
  const controlPoint2Y = targetY;

  return {
    sourceX,
    sourceY,
    targetX,
    targetY,
    controlPoint1X,
    controlPoint1Y,
    controlPoint2X,
    controlPoint2Y
  };
}


export interface Silo {
  id: string;
  name: string;
  nodes: SiloNode[];
  edges: SiloEdge[];
  viewState?: {
    zoom: number;
    pan: Position;
  };
  isLoading?: boolean;
  selectedNode?: SiloNode | null; // Add this line
}

// Load from localStorage if in browser
const initialSilos = browser 
  ? JSON.parse(localStorage.getItem('silos') || '[]').map((silo: any) => ({
      ...silo,
      nodes: silo.nodes || [],
      edges: silo.edges || [],
      selectedNode: null
    }))
  : [];

export const siloDataStore = writable<Silo[]>(initialSilos);

export async function createAndPersistSilo(siloName: string, nodes: SiloNode[] = [], edges: SiloEdge[] = []) {
  const currentUser = get(user);
  if (!currentUser) {
    console.error('Cannot create silo: No user is logged in');
    return null;
  }
  
  const siloId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  try {
    // First create the silo in Supabase
    const { error: siloError } = await supabase
      .from('silos')
      .insert({
        id: siloId,
        name: siloName,
        user_id: currentUser.id,
        created_at: timestamp,
        updated_at: timestamp
      });
      
    if (siloError) throw siloError;
    
    // Then insert all nodes if there are any
    if (nodes.length > 0) {
      const nodeInserts = nodes.map(node => ({
        id: node.id,
        silo_id: siloId, 
        type: node.type,
        position: node.position,
        data: node.data,
        user_id: currentUser.id,
        created_at: node.created_at || timestamp,
        updated_at: node.updated_at || timestamp
      }));
      
      const { error: nodesError } = await supabase
        .from('nodes')
        .insert(nodeInserts);
        
      if (nodesError) throw nodesError;
    }
    
    // Finally insert all edges if there are any
    if (edges.length > 0) {
      const edgeInserts = edges.map(edge => ({
        id: edge.id,
        silo_id: siloId,
        source: edge.source,
        target: edge.target,
        source_handle: edge.sourceHandle,
        target_handle: edge.targetHandle,
        path_type: edge.pathType || 'bezier',
        path_data: edge.pathData,
        user_id: currentUser.id,
        created_at: timestamp,
        updated_at: timestamp
      }));
      
      const { error: edgesError } = await supabase
        .from('edges')
        .insert(edgeInserts);
        
      if (edgesError) throw edgesError;
    }
    
    // Update the local store only after successful database operations
    const newSilo: Silo = {
      id: siloId,
      name: siloName,
      nodes,
      edges,
      isLoading: false
    };
    
    siloStore.update(store => [...store, newSilo]);
    
    return siloId;
  } catch (err) {
    console.error('Failed to create and persist silo:', err);
    return null;
  }
}

// Load all silos from Supabase for the current user
export async function loadSilosFromDatabase() {
  const currentUser = get(user);
  if (!currentUser) return false;
  
  try {
    // First get all silos for this user
    const { data: silos, error: silosError } = await supabase
      .from('silos')
      .select('*')
      .eq('user_id', currentUser.id);
      
    if (silosError) throw silosError;
    
    const fullSilos: Silo[] = [];
    
    // For each silo, get its nodes and edges
    for (const silo of silos) {
      // Get nodes
      const { data: nodes, error: nodesError } = await supabase
        .from('nodes')
        .select('*')
        .eq('silo_id', silo.id);
        
      if (nodesError) throw nodesError;
      
      // Get edges
      const { data: edges, error: edgesError } = await supabase
        .from('edges')
        .select('*')
        .eq('silo_id', silo.id);
        
      if (edgesError) throw edgesError;
      
      // Convert database formats to app formats
      const formattedNodes: SiloNode[] = nodes.map(node => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: node.data,
        siloId: silo.id,
        portPositions: node.port_positions || {
          input: { x: 0, y: 30 },
          output: { x: 150, y: 30 }
        },
        updated_at: node.updated_at,
        created_at: node.created_at
      }));
      
      const formattedEdges: SiloEdge[] = edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.source_handle,
        target: edge.target,
        targetHandle: edge.target_handle,
        siloId: silo.id,
        pathType: edge.path_type || 'bezier',
        pathData: edge.path_data
      }));
      
      fullSilos.push({
        id: silo.id,
        name: silo.name,
        nodes: formattedNodes,
        edges: formattedEdges,
        isLoading: false
      });
    }
    
    // Update the store with database data
    siloStore.set(fullSilos);
    return true;
  } catch (err) {
    console.error('Failed to load silos from database:', err);
    return false;
  }
}

// Sync local silos to Supabase (useful for initial load or reconnection)
export async function syncSilosToDatabase() {
  const currentUser = get(user);
  if (!currentUser) return false;
  
  try {
    const localSilos = get(siloStore);
    
    // For each local silo, check if it exists in the database
    for (const silo of localSilos) {
      const { data: existingSilo, error } = await supabase
        .from('silos')
        .select('id')
        .eq('id', silo.id)
        .maybeSingle();
        
      if (error) throw error;
      
      // If silo doesn't exist in DB, create it along with its nodes and edges
      if (!existingSilo) {
        await createAndPersistSilo(silo.name, silo.nodes, silo.edges);
      }
    }
    
    return true;
  } catch (err) {
    console.error('Failed to sync silos to database:', err);
    return false;
  }
}

// Initialize with a default silo if none exists
export function initializeSilos() {
  const storedSilos = get(siloStore);
  if (storedSilos.length === 0) {
    const defaultSilo = createDefaultSilo();
    siloStore.set([defaultSilo]);
    
    // Also save the default silo to Supabase if user is logged in
    createAndPersistSilo(defaultSilo.name, defaultSilo.nodes, defaultSilo.edges)
      .catch(err => console.error('Failed to persist default silo:', err));
  }
}

function createDefaultSilo(): Silo {
  const siloId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  
  return {
    id: siloId,
    name: 'My Project',
    nodes: [{
      id: crypto.randomUUID(),
      type: 'project',
      position: { x: 400, y: 200 },
      data: { title: 'Main Project', description: 'Manage project workflow' },
      siloId,
      updated_at: timestamp,
      created_at: timestamp,
    }],
    edges: [],
  };
}

// Create a new node with given type and position
export function createNode(type: NodeType, siloId: string, position: Position): SiloNode {
  const defaultPortPositions: PortPosition = {
    input: { x: 0, y: 30 },  // Left side, 30px from top
    output: { x: 150, y: 30 } // Right side, 30px from top (assuming node width is 150px)
  };

  return {
    id: crypto.randomUUID(),
    type,
    position,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    siloId,
    data: {
      title: NODE_TYPES[type].name, // Default title
      description: '',
      status: 'not-started'
    },
    portPositions: defaultPortPositions,
    validation: {
      isValid: true,
      missingConnections: []
    }
  };
}

function processNodeData(data: { nodes: SiloNode[]; edges: SiloEdge[] }, siloId: string) {
  const { nodes, edges }: { nodes: SiloNode[]; edges: SiloEdge[] } = data;
  
  // Create additional edges based on children arrays
  const additionalEdges: SiloEdge[] = [];
  
  nodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      node.children.forEach(childId => {
        additionalEdges.push({
          id: `edge-${node.id}-${childId}`,
          source: node.id,
          target: childId,
          type: 'resource-connection',
          siloId: siloId
        });
      });
    }
  });
  
  // Combine with any existing edges
  const allEdges = [...edges, ...additionalEdges];
  
  // Update the siloStore with both nodes and edges
  siloStore.update(silos => {
    return silos.map(silo => {
      if (silo.id !== siloId) {
        return silo;
      }
      return {
        ...silo,
        nodes: nodes.map(n => ({
          ...n,
          type: n.type === 'resource' ? 'resource' : 'task', // Ensure type consistency
          data: {
            ...n.data,
            // Ensure required fields
            title: n.data?.title || 'Untitled',
            status: n.data?.status || 'not-started'
          }
        })),
        edges: allEdges
      };
    });
  });
}

// Create a connection between nodes
export function createEdge(
  source: string, 
  sourceHandle: 'input' | 'output', 
  target: string, 
  targetHandle: 'input' | 'output', 
  siloId: string
): SiloEdge {
  return {
    id: crypto.randomUUID(),
    source,
    sourceHandle,
    target,
    targetHandle,
    siloId,
    animated: false
  };
}

// Get a node's position
export function getNodePosition(siloId: string, nodeId: string): Position | undefined {
  const silos = get(siloStore);
  const silo = silos.find(s => s.id === siloId);
  const node = silo?.nodes.find(n => n.id === nodeId);
  return node?.position;
}

// Add a node to a silo
export async function addNode(siloId: string, nodeType: NodeType, position: Position, initialData: any = {}) {
  const currentUser = get(user);
  if (!currentUser) return null;
  
  const newNodeId = `node_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const nodeData = {
    title: `New ${nodeType}`,
    description: '',
    status: 'not-started',
    ...initialData
  };
  
  const newNode: SiloNode = {
    id: newNodeId,
    type: nodeType,
    position,
    data: nodeData,
    siloId,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };
  
  try {
    // Save to database first
    const { error } = await supabase
      .from('nodes')
      .insert({
        id: newNodeId,
        silo_id: siloId,
        type: nodeType,
        position,
        data: nodeData,
        user_id: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
    if (error) throw error;
    
    // Then update local store
    siloStore.update(store => 
      store.map(silo => {
        if (silo.id !== siloId) return silo;
        return {
          ...silo,
          nodes: [...silo.nodes, newNode]
        };
      })
    );
    
    return newNodeId;
  } catch (err) {
    console.error('Failed to add node:', err);
    return null;
  }
}

// Update a node's position
export async function updateNodePosition(siloId: string, nodeId: string, position: Position) {
  try {
    // Update local store first for responsiveness
    siloStore.update(stores => {
      return stores.map(silo => {
        if (silo.id !== siloId) return silo;
        
        const updatedNodes = silo.nodes.map(node => {
          if (node.id !== nodeId) return node;
          
          return {
            ...node,
            position,
            updated_at: new Date().toISOString()
          };
        });
        
        // Update all connections involving this node
        const updatedEdges = silo.edges.map(edge => {
          if (edge.source !== nodeId && edge.target !== nodeId) return edge;
          
          const sourceNode = edge.source === nodeId 
            ? { ...silo.nodes.find(n => n.id === nodeId), position } 
            : silo.nodes.find(n => n.id === edge.source);
          
          const targetNode = edge.target === nodeId 
            ? { ...silo.nodes.find(n => n.id === nodeId), position } 
            : silo.nodes.find(n => n.id === edge.target);
          
          if (!sourceNode || !targetNode) return edge;
          
          const pathData = calculateConnectionPath(
            sourceNode as SiloNode,
            targetNode as SiloNode,
            edge.sourceHandle,
            edge.targetHandle
          );
          
          return {
            ...edge,
            pathType: 'bezier' as const,
            pathData,
            updated_at: new Date().toISOString()
          };
        });
        
        return {
          ...silo,
          nodes: updatedNodes,
          edges: updatedEdges
        };
      });
    });
    
    // Then sync with database
    const { error } = await supabase
      .from('nodes')
      .update({ 
        position, 
        updated_at: new Date().toISOString() 
      })
      .eq('id', nodeId);
      
    if (error) throw error;
    
    // Validate connections after position update
    validateSiloNodes(siloId);
    
    return true;
  } catch (err) {
    console.error('Failed to update node position:', err);
    return false;
  }
}

export function addComment(siloId: string, nodeId: string, comment: string) {
  siloStore.update(store => {
    // Implement the logic to update the store here
    return store;
  });
}

export function deleteComment(siloId: string, nodeId: string, index: number) {
  siloStore.update(store => {
    // Implement the logic to update the store here
    return store;
  });
}

// Add a function to set the port positions for a node
export function setNodePortPositions(siloId: string, nodeId: string, portPositions: PortPosition) {
  siloStore.update(stores => {
    const updatedStores = stores.map(silo => {
      if (silo.id !== siloId) return silo;
      
      // Update the node port positions
      const updatedNodes = silo.nodes.map(node => {
        if (node.id !== nodeId) return node;
        
        return {
          ...node,
          portPositions
        };
      });
      
      // Update all connections involving this node
      const updatedEdges = silo.edges.map(edge => {
        if (edge.source !== nodeId && edge.target !== nodeId) return edge;
        
        const sourceNode = silo.nodes.find(n => n.id === edge.source);
        const targetNode = silo.nodes.find(n => n.id === edge.target);
        
        if (!sourceNode || !targetNode) return edge;
        
        // If the source or target node is the one we're updating, use the new port positions
        const updatedSourceNode = edge.source === nodeId 
          ? { ...sourceNode, portPositions } 
          : sourceNode;
        
        const updatedTargetNode = edge.target === nodeId 
          ? { ...targetNode, portPositions } 
          : targetNode;
        
        const pathData = calculateConnectionPath(
          updatedSourceNode,
          updatedTargetNode,
          edge.sourceHandle,
          edge.targetHandle
        );
        
        // Use type assertion to ensure the literal type
        return {
          ...edge,
          pathType: 'bezier' as const,
          pathData
        };
      });
      
      return {
        ...silo,
        nodes: updatedNodes,
        edges: updatedEdges
      };
    });
    
    return updatedStores;
  });
}

if (browser) {
  siloDataStore.subscribe((value) => {
    localStorage.setItem('silos', JSON.stringify(value));
  });
}

// Delete a silo
export async function deleteSilo(siloId: string) {
  const currentUser = get(user);
  if (!currentUser) return false;
  
  try {
    // First delete from database
    const { error } = await supabase
      .from('silos')
      .delete()
      .eq('id', siloId)
      .eq('user_id', currentUser.id);
      
    if (error) throw error;
    
    // Then update local store
    siloStore.update(store => store.filter(s => s.id !== siloId));
    return true;
  } catch (err) {
    console.error('Failed to delete silo:', err);
    return false;
  }
}

// Rename a silo
export async function renameSilo(siloId: string, newName: string) {
  const currentUser = get(user);
  if (!currentUser) return false;
  
  try {
    // First update in database
    const { error } = await supabase
      .from('silos')
      .update({ name: newName })
      .eq('id', siloId)
      .eq('user_id', currentUser.id);
      
    if (error) throw error;
    
    // Then update local store
    siloStore.update(store => 
      store.map(s => s.id === siloId ? {...s, name: newName} : s)
    );
    
    return true;
  } catch (err) {
    console.error('Failed to rename silo:', err);
    return false;
  }
}

// Delete a node
export async function deleteNode(siloId: string, nodeId: string) {
  try {
    // Get all edges connected to this node to delete them first
    const silo = get(siloStore).find(s => s.id === siloId);
    if (!silo) throw new Error('Silo not found');
    
    const connectedEdges = silo.edges.filter(
      edge => edge.source === nodeId || edge.target === nodeId
    );
    
    // First delete all connected edges from database
    for (const edge of connectedEdges) {
      await removeConnection(siloId, edge.id);
    }
    
    // Then delete the node from database
    const { error } = await supabase
      .from('nodes')
      .delete()
      .eq('id', nodeId);
      
    if (error) throw error;
    
    // Then update local store
    siloStore.update(stores => {
      return stores.map(silo => {
        if (silo.id !== siloId) return silo;
        return {
          ...silo,
          nodes: silo.nodes.filter(node => node.id !== nodeId)
        };
      });
    });
    
    return true;
  } catch (err) {
    console.error('Failed to delete node:', err);
    return false;
  }
}

export function triggerNodeFlow(siloId: string, nodeId: string) {
  siloStore.update(store => {
    return store.map(silo => {
      if (silo.id !== siloId) return silo;
      
      // Find the node and its connections
      const node = silo.nodes.find(n => n.id === nodeId);
      if (!node) return silo;
      
      // Process the node (this would be your business logic)
      const outputData = processNode(node);
      
      // Update the node with output
      const updatedNodes = silo.nodes.map(n => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          data: {
            ...n.data,
            output: outputData
          }
        };
      });
      
      // Propagate to connected nodes
      const edges = silo.edges.filter(e => e.source === nodeId);
      edges.forEach(edge => {
        triggerNodeFlow(siloId, edge.target);
      });
      
      return {
        ...silo,
        nodes: updatedNodes
      };
    });
  });
}

function processNode(node: SiloNode): any {
  // Your node processing logic here
  switch(node.type) {
    case 'resource':
      return { type: 'resource', content: node.data.content };
    case 'milestone':
      return { status: 'completed', date: new Date().toISOString() };
    default:
      return { processed: true, timestamp: Date.now() };
  }
}
// Update a node's data
export function updateNode(siloId: string, nodeId: string, updates: Partial<SiloNode>) {
  siloStore.update(store => 
    store.map(silo => {
      if (silo.id !== siloId) return silo;
      
      const updatedNodes = silo.nodes.map(node => {
        if (node.id !== nodeId) return node;
        
        return {
          ...node,
          ...updates,
          data: {
            ...node.data,
            ...(updates.data || {})
          }
        };
      });
      
      return {
        ...silo,
        nodes: updatedNodes
      };
    })
  );
}

// Add data propagation function
// In siloStore.ts - Update the propagateData function
export function propagateData(siloId: string, nodeId: string, outputData: any) {
  siloStore.update(store => {
    const silo = store.find(s => s.id === siloId);
    if (!silo) return store;
    
    // Update the source node's output data
    let updatedNodes = [...silo.nodes];
    const sourceNodeIndex = updatedNodes.findIndex(n => n.id === nodeId);
    
    if (sourceNodeIndex >= 0) {
      updatedNodes[sourceNodeIndex] = {
        ...updatedNodes[sourceNodeIndex],
        data: {
          ...updatedNodes[sourceNodeIndex].data,
          outputData,
          lastRun: new Date().toISOString()
        }
      };
    }
    
    // Find all connected output edges
    const connectedEdges = silo.edges.filter(e => e.source === nodeId);
    
    // For each connected node, update its input data
    connectedEdges.forEach(edge => {
      const targetNodeIndex = updatedNodes.findIndex(n => n.id === edge.target);
      
      if (targetNodeIndex >= 0) {
        const targetNode = updatedNodes[targetNodeIndex];
        const currentInputs = targetNode.data.inputData || {};
        
        // Add the output from the source node to this node's inputs
        updatedNodes[targetNodeIndex] = {
          ...targetNode,
          data: {
            ...targetNode.data,
            inputData: {
              ...currentInputs,
              [edge.id]: {
                sourceNode: nodeId,
                data: outputData,
                timestamp: new Date().toISOString()
              }
            }
          }
        };
      }
    });
    
    return store.map(s => {
      if (s.id !== siloId) return s;
      return { ...s, nodes: updatedNodes };
    });
  });
}

function getConnectedResource(nodeId: string, siloId: string): SiloNode | null {
  const silo = get(siloStore).find(s => s.id === siloId);
  if (!silo) return null;

  // Find first connected resource node
  const connection = silo.edges.find(e => 
    e.source === nodeId && 
    silo.nodes.find(n => n.id === e.target)?.type === 'resource'
  );

  if (!connection) return null;
  return silo.nodes.find(n => n.id === connection.target) || null;
}

export async function executeNodeFunction(siloId: string, nodeId: string, functionId: string) {
  console.log(`Executing ${Function} on node ${nodeId} in silo ${siloId}`);
  const stores = get(siloStore);
  const silo = stores.find(s => s.id === siloId);
  if (!silo) return;

  const node = silo.nodes.find(n => n.id === nodeId);
  if (!node) return;

  let result;
  
  // 4. Add async to the function and fix missing title
  const processExtract = async (node: SiloNode) => {
    const resourceNode = getConnectedResource(node.id, siloId);
    if (!resourceNode) return;
    
    const response = await fetch('/api/extract', {
      method: 'POST',
      body: JSON.stringify({
        content: resourceNode.data.sourceContent,
        thesis: node.data.thesis
      })
    });
    
    const result = await response.json();
    updateNode(siloId, node.id, { 
      data: {
        ...node.data, // Preserve existing data
        title: node.data.title, // Ensure title exists
        result 
      }
    });
  };

  const processSummarize = async (node: SiloNode) => {
    const resourceNode = getConnectedResource(node.id, siloId);
    if (!resourceNode) return;
    
    const response = await fetch('/api/summarize', {
      method: 'POST',
      body: JSON.stringify({
        content: resourceNode.data.sourceContent
      })
    });
    
    const result = await response.json();
    updateNode(siloId, node.id, { 
      data: {
        ...node.data,
        title: node.data.title,
        result 
      }
    });
  };

  async function saveNodeToDatabase(node: SiloNode) {
    if (!$user) return;
    
    try {
      const { error } = await supabase
        .from('nodes')
        .insert({
          id: node.id,
          silo_id: siloId,
          type: node.type,
          position: node.position,
          data: node.data,
          user_id: $user.id,
          updated_at: new Date().toISOString()
        });
        
      if (error) throw error;
    } catch (err) {
      console.error('Failed to save node to database:', err);
    }
  }



async function processFunction(functionId: string, node: SiloNode, silo: Silo, siloId: string, nodeId: string) {
    let result;
  
    switch (functionId) {
      case 'extract_quotes': {
        const resourceContent = node.data.sourceContent || node.data.content;
        if (!resourceContent) {
          return { error: "No content available for extraction" };
        }
  
        try {
          const response = await fetch('/api/extract', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: resourceContent,
              count: 2,
            })
          });
  
          if (!response.ok) throw new Error('Extraction API failed');
          const result = await response.json();
  
          updateNode(siloId, nodeId, {
            data: {
              ...node.data,
              result: {
                ...node.data.result,
                quotes: result.quotes
              }
            }
          });
  
          return result;
        } catch (error) {
          return { error: error instanceof Error ? error.message : "Unknown error" };
        }
      }
  
      case 'summarize':
        await processSummarize(node);
        break;
  
      case 'run':
        result = processNodeRun(node, silo);
        break;
  
      case 'generate_citations':
        result = generateCitations(node);
        break;
  
      case 'add_subtask':
        result = {
          subtasks: [...(node.data.subtasks || []), createDefaultSubtask()]
        };
        break;
  
      case 'check_requirements':
        result = checkRequirements(node, silo);
        break;
  
      default:
        result = { message: "Function not implemented" };
    }
  
    return result;
  }
  
  function summarizeContent(node: SiloNode): any {
    return { summary: '' };
  }
  
  function generateCitations(node: SiloNode): any {
    return { citations: [] };
  }
  
function addSubtask(parentNodeId: string) {
  if (!silo) return;
  
  // Create a new task node with parent reference
  const newSubtask = {
    id: crypto.randomUUID(),
    type: 'task',
    position: { x: 0, y: 0 },
    data: {
      title: 'New Subtask',
      status: 'not-started',
      isComplete: false,
      parentId: parentNodeId,
      priority: 'medium'
    },
    updated_at: new Date().toISOString()
  };
  
  // Add to siloStore
  $siloStore = $siloStore.map(s => {
    if (s.id === siloId) {
      return {
        ...s,
        nodes: [...s.nodes, newSubtask]
      };
    }
    return s;
  });
  
  // Save to database
  saveNodeToDatabase(newSubtask);
}
  
  function checkRequirements(node: SiloNode, silo: Silo): any {
    return { requirementsMet: false };
  }

  
  // Update the node with the result and propagate data
  updateNode(siloId, nodeId, { 
    data: { 
      ...node.data,
      functionResult: result
    }
  });
  
  // Propagate the output data to connected nodes
  propagateData(siloId, nodeId, result);
}

// Execute workflow starting from a specific node
export async function executeWorkflow(siloId: string) {
  const silo = get(siloStore).find(s => s.id === siloId);
  if (!silo) return;
  
  // Find starting nodes (nodes with no incoming connections)
  const startNodes = silo.nodes.filter(node => {
    const hasIncomingEdges = silo.edges.some(edge => edge.target === node.id);
    return !hasIncomingEdges;
  });
  
  // Set all nodes to not running
  siloStore.update(store => 
    store.map(s => {
      if (s.id !== siloId) return s;
      return {
        ...s,
        nodes: s.nodes.map(n => ({
          ...n,
          data: { ...n.data, isRunning: false, isComplete: false }
        }))
      };
    })
  );

  // Start execution from each start node
  startNodes.forEach(node => {
    executeNode(siloId, node.id);
  });
}

// Execute a single node
export async function executeNode(siloId: string, nodeId: string) {
  // Mark node as running
  siloStore.update(store => 
    store.map(s => {
      if (s.id !== siloId) return s;
      return {
        ...s,
        nodes: s.nodes.map(n => {
          if (n.id !== nodeId) return n;
          return {
            ...n,
            data: { ...n.data, isRunning: true }
          };
        })
      };
    })
  );
  
  // Get the node
  const silo = get(siloStore).find(s => s.id === siloId);
  if (!silo) return;
  
  const node = silo.nodes.find(n => n.id === nodeId);
  if (!node) return;
  
  try {
    // Execute node based on type
    const result = await processNodeExecution(node, silo);
    
    // Update node with result and mark as complete
    siloStore.update(store => 
      store.map(s => {
        if (s.id !== siloId) return s;
        return {
          ...s,
          nodes: s.nodes.map(n => {
            if (n.id !== nodeId) return n;
            
            // Only update status if it's not "not-started"
            const newStatus = n.data.status !== 'not-started' ? 'completed' : n.data.status;
            
            return {
              ...n,
              data: { 
                ...n.data, 
                isRunning: false,
                status: newStatus,
                result,
                lastRun: new Date().toISOString()
              }
            };
          })
        };
      })
    );
    
    // Find all outgoing connections and execute those nodes
    const outgoingEdges = silo.edges.filter(edge => edge.source === nodeId);
    
    // Execute next nodes sequentially with small delay for visual effect
    for (const edge of outgoingEdges) {
      // Animate the edge
      siloStore.update(store => 
        store.map(s => {
          if (s.id !== siloId) return s;
          return {
            ...s,
            edges: s.edges.map(e => {
              if (e.id !== edge.id) return e;
              return { ...e, animated: true };
            })
          };
        })
      );
      
      // Small delay before executing next node
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Execute the next node
      await executeNode(siloId, edge.target);
      
      // Stop edge animation
      siloStore.update(store => 
        store.map(s => {
          if (s.id !== siloId) return s;
          return {
            ...s,
            edges: s.edges.map(e => {
              if (e.id !== edge.id) return e;
              return { ...e, animated: false };
            })
          };
        })
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error executing node ${nodeId}:`, errorMessage);
    
    // Mark node as failed
    siloStore.update(store => 
      store.map(s => {
        if (s.id !== siloId) return s;
        return {
          ...s,
          nodes: s.nodes.map(n => {
            if (n.id !== nodeId) return n;
            return {
              ...n,
              data: { 
                ...n.data, 
                error: errorMessage
              }
            };
          })
        };
      })
    );
  }
  await goto(`/silos/${siloId}/output`);
}

// Process execution for different node types
async function processNodeExecution(node: SiloNode, silo: Silo) {
  // Get input data from incoming connections
  const inputData = collectNodeInputs(node, silo);
  
  // Wait a bit to simulate processing
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1000));
  
  switch(node.type) {
    case 'resource':
      return processResourceNode(node, inputData);
    case 'task':
      return processTaskNode(node, inputData);
    case 'milestone':
      return processMilestoneNode(node, inputData);
    case 'project':
      return processProjectNode(node, inputData);
    case 'client':
      return processClientNode(node, inputData);
    case 'contract':
      return processContractNode(node, inputData);
    case 'payment':
      return processPaymentNode(node, inputData);
    case 'deliverable':
      return processDeliverableNode(node, inputData);
    // Add more node types as needed
    default:
      return { message: `Processed ${node.type} node`, timestamp: new Date().toISOString() };
  }
}

function processClientNode(node: SiloNode, inputs: any[]) {
  return {
    type: 'client',
    company: node.data.company,
    contacts: node.data.contacts || [],
    agreements: inputs.filter(i => i.nodeType === 'contract')
  };
}

function processContractNode(node: SiloNode, inputs: any[]) {
  const client = inputs.find(i => i.nodeType === 'client');
  return {
    type: 'contract',
    status: node.data.status || 'draft',
    terms: node.data.terms,
    client: client?.data
  };
}

function processPaymentNode(node: SiloNode, inputs: any[]) {
  const contract = inputs.find(i => i.nodeType === 'contract');
  return {
    type: 'payment',
    amount: node.data.amount,
    status: node.data.status || 'pending',
    contract: contract?.data
  };
}

function processDeliverableNode(node: SiloNode, inputs: any[]) {
  const contract = inputs.find(i => i.nodeType === 'contract');
  return {
    type: 'deliverable',
    status: node.data.status || 'pending',
    requirements: node.data.requirements,
    contract: contract?.data
  };
}

// Collect inputs from connected nodes
function collectNodeInputs(targetNode: SiloNode, silo: Silo) {
  // Find all incoming connections
  const incomingEdges = silo.edges.filter(edge => edge.target === targetNode.id);
  
  // Collect data from source nodes
  const inputs = incomingEdges.map(edge => {
    const sourceNode = silo.nodes.find(n => n.id === edge.source);
    if (!sourceNode) return null;
    
    return {
      nodeId: sourceNode.id,
      nodeType: sourceNode.type,
      data: sourceNode.data.result || {},
      title: sourceNode.data.title || 'Untitled',
      edgeId: edge.id
    };
  }).filter(Boolean);
  
  return inputs;
}

// Processing functions for different node types
function processResourceNode(node: SiloNode, inputs: any[]) {
  // Sample resource processing
  const url = node.data.url || '';
  const title = node.data.title || 'Untitled Resource';
  
  return {
    type: 'resource',
    title,
    url,
    processed: true,
    summary: node.data.summary || `Summary of ${title}`,
    key_points: node.data.key_points || ['Point 1', 'Point 2'],
    inputs: inputs.map(i => i.title)
  };
}

function processTaskNode(node: SiloNode, inputs: any[]) {
  // Update task status
  const status = node.data.status || 'not-started';
  const nextStatus = status === 'not-started' ? 'in-progress' : 
                     status === 'in-progress' ? 'completed' : 'completed';
  
  return {
    type: 'task',
    title: node.data.title,
    previous_status: status,
    new_status: nextStatus,
    completed: nextStatus === 'completed',
    inputs_processed: inputs.length,
    timestamp: new Date().toISOString()
  };
}

function processMilestoneNode(node: SiloNode, inputs: any[]) {
  // Check if all required inputs are complete
  const allComplete = inputs.every(input => input.data && input.data.completed);
  
  return {
    type: 'milestone',
    title: node.data.title,
    achieved: allComplete,
    dependencies_met: allComplete,
    dependency_count: inputs.length,
    timestamp: new Date().toISOString()
  };
}

function processProjectNode(node: SiloNode, inputs: any[]) {
  // Calculate project progress
  const totalTasks = inputs.length || 1;
  const completedTasks = inputs.filter(i => i.data && i.data.completed).length;
  const progress = Math.round((completedTasks / totalTasks) * 100);
  
  return {
    type: 'project',
    title: node.data.title,
    progress: progress,
    tasks_total: totalTasks,
    tasks_completed: completedTasks,
    timestamp: new Date().toISOString()
  };
}

// Sample node processing functions
function processNodeRun(node: SiloNode, silo: Silo) {
  const commonData = {
    title: node.data.title,
    timestamp: new Date().toISOString()
  };

  switch(node.type) {
    case 'resource':
      return {
        ...commonData,
        type: 'resource',
        url: node.data.url,
        processed: true,
        contentSummary: node.data.summary
      };

    case 'task':
      return {
        ...commonData,
        type: 'task',
        status: 'in-progress',
        startedAt: new Date().toISOString(),
        assignedTo: node.data.assignedTo || 'Unassigned'
      };

    case 'milestone':
      const dependencies = getDependencies(node, silo);
      const allCompleted = dependencies.every(n => n.data.status === 'completed');
      
      return {
        ...commonData,
        type: 'milestone',
        allDependenciesCompleted: allCompleted,
        status: allCompleted ? 'completed' : 'in-progress',
        dependentTasks: dependencies.map(d => d.id)
      };

    case 'project':
      const projectTasks = silo.nodes.filter(n => n.parent === node.id);
      const completedTasks = projectTasks.filter(t => t.data.status === 'completed');
      
      return {
        ...commonData,
        type: 'project',
        progress: projectTasks.length > 0 
          ? Math.round((completedTasks.length / projectTasks.length) * 100)
          : 0,
        taskCount: projectTasks.length
      };

    case 'deadline':
      const dueDate = node.data.dueDate ? new Date(node.data.dueDate) : null;
      const now = new Date();
      
      return {
        ...commonData,
        type: 'deadline',
        status: dueDate
          ? dueDate < now ? 'overdue' : 'pending'
          : 'unscheduled',
        daysRemaining: dueDate
          ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 3600 * 24))
          : null
      };

    case 'team':
      return {
        ...commonData,
        type: 'team',
        members: node.data.members || [],
        capacity: node.data.capacity || 0
      };

    case 'risk':
      return {
        ...commonData,
        type: 'risk',
        severity: node.data.severity || 'medium',
        mitigation: node.data.mitigation || ''
      };

    case 'deliverable':
      return {
        ...commonData,
        type: 'deliverable',
        status: node.data.approved ? 'approved' : 'pending-review',
        approvalDate: node.data.approvalDate || null
      };

    case 'review':
      return {
        ...commonData,
        type: 'review',
        reviewers: node.data.reviewers || [],
        approved: node.data.approved || false
      };

    case 'decision':
      return {
        ...commonData,
        type: 'decision',
        options: node.data.options || [],
        selectedOption: node.data.selectedOption || null
      };

    case 'dependency':
      const requiredNodes = getDependencies(node, silo);
      return {
        ...commonData,
        type: 'dependency',
        requirementsMet: requiredNodes.every(n => n.data.status === 'completed'),
        requiredTasks: requiredNodes.map(n => n.id)
      };

    case 'output':
      const inputData = getInputData(node, silo);
      return {
        ...commonData,
        type: 'output',
        generatedContent: generateOutputContent(inputData),
        inputSources: inputData.map(i => i.source)
      };

    default:
      return {
        ...commonData,
        type: 'unknown',
        processed: true,
        warning: 'Unknown node type'
      };
  }
}

// Helper functions
function getDependencies(node: SiloNode, silo: Silo): SiloNode[] {
  return silo.edges
    .filter(e => e.target === node.id)
    .map(e => silo.nodes.find(n => n.id === e.source))
    .filter(n => !!n) as SiloNode[];
}

function getInputData(node: SiloNode, silo: Silo): any[] {
  return silo.edges
    .filter(e => e.target === node.id)
    .map(e => {
      const sourceNode = silo.nodes.find(n => n.id === e.source);
      return sourceNode?.data.outputData;
    })
    .filter(data => !!data);
}

function generateOutputContent(inputs: any[]): string {
  // Implementation depends on your specific output generation logic
  return inputs.map(i => i.content).join('\n\n');
}

// Create a connection between nodes
export async function createConnection(siloId: string, source: string, target: string, sourceHandle?: string, targetHandle?: string) {
  const currentUser = get(user);
  if (!currentUser) return null;
  
  const edgeId = `edge_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  try {
    // Find source and target nodes
    const silo = get(siloStore).find(s => s.id === siloId);
    if (!silo) throw new Error('Silo not found');
    
    const sourceNode = silo.nodes.find(n => n.id === source);
    const targetNode = silo.nodes.find(n => n.id === target);
    
    if (!sourceNode || !targetNode) throw new Error('Source or target node not found');
    
    // Calculate path data
    const pathData = calculateConnectionPath(
      sourceNode,
      targetNode,
      sourceHandle,
      targetHandle
    );
    
    // Create the edge object
    const newEdge: SiloEdge = {
      id: edgeId,
      source,
      target,
      sourceHandle,
      targetHandle,
      siloId,
      animated: false,
      pathType: 'bezier',
      pathData
    };
    
    // Save to database first
    const { error } = await supabase
      .from('edges')
      .insert({
        id: edgeId,
        source,
        target,
        source_handle: sourceHandle,
        target_handle: targetHandle,
        silo_id: siloId,
        animated: false,
        path_type: 'bezier',
        path_data: pathData,
        user_id: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      
    if (error) throw error;
    
    // Then update local store
    siloStore.update(stores => {
      return stores.map(silo => {
        if (silo.id !== siloId) return silo;
        return {
          ...silo,
          edges: [...silo.edges, newEdge]
        };
      });
    });
    
    return edgeId;
  } catch (err) {
    console.error('Failed to create connection:', err);
    return null;
  }
}

export function createTemporaryConnection(
  siloId: string,
  sourceNode: SiloNode,
  currentMousePos: Position
) {
  const sourcePort = sourceNode.portPositions?.output || { x: 150, y: 30 };
  const sourceX = sourceNode.position.x + sourcePort.x;
  const sourceY = sourceNode.position.y + sourcePort.y;

  const tempEdge: SiloEdge = {
    id: 'temp',
    source: 'temp',
    target: 'temp',
    siloId,
    pathData: {
      sourceX,
      sourceY,
      targetX: currentMousePos.x,
      targetY: currentMousePos.y,
      controlPoint1X: sourceX + 100,
      controlPoint1Y: sourceY,
      controlPoint2X: currentMousePos.x - 100,
      controlPoint2Y: currentMousePos.y
    }
  };

  siloStore.update(store => store.map(s => s.id === siloId ? {
    ...s,
    edges: [...s.edges.filter(e => e.id !== 'temp'), tempEdge]
  } : s));
}

export function updateConnectionPath(siloId: string, edgeId: string) {
  siloStore.update(silos => {
    const siloIndex = silos.findIndex(s => s.id === siloId);
    if (siloIndex === -1) return silos;
    
    const silo = {...silos[siloIndex]};
    const edgeIndex = silo.edges.findIndex(e => e.id === edgeId);
    if (edgeIndex === -1) return silos;
    
    const edge = {...silo.edges[edgeIndex]};
    const sourceNode = silo.nodes.find(n => n.id === edge.source);
    const targetNode = silo.nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) return silos;
    
    // Calculate path data based on port positions
    const sourcePos = sourceNode.position;
    const targetPos = targetNode.position;
    
    // Get port positions (use default if not set)
    const sourcePortPos = sourceNode.portPositions?.output || { x: sourceNode.width || 150, y: 30 };
    const targetPortPos = targetNode.portPositions?.input || { x: 0, y: 30 };
    
    edge.pathData = {
      sourceX: sourcePos.x + sourcePortPos.x,
      sourceY: sourcePos.y + sourcePortPos.y,
      targetX: targetPos.x + targetPortPos.x,
      targetY: targetPos.y + targetPortPos.y
    };
    
    // Calculate control points
    const deltaX = edge.pathData.targetX - edge.pathData.sourceX;
    const offset = Math.min(Math.abs(deltaX) * 0.5, 150);
    
    edge.pathData.controlPoint1X = edge.pathData.sourceX + (deltaX > 0 ? offset : -offset);
    edge.pathData.controlPoint1Y = edge.pathData.sourceY;
    edge.pathData.controlPoint2X = edge.pathData.targetX - (deltaX > 0 ? offset : -offset);
    edge.pathData.controlPoint2Y = edge.pathData.targetY;
    
    silo.edges[edgeIndex] = edge;
    silos[siloIndex] = silo;
    
    return [...silos];
  });
}
export function updateAllConnectionPaths(siloId: string) {
  siloStore.update(stores => {
    return stores.map(silo => {
      if (silo.id !== siloId) return silo;
      
      const updatedEdges = silo.edges.map(edge => {
        const sourceNode = silo.nodes.find(n => n.id === edge.source);
        const targetNode = silo.nodes.find(n => n.id === edge.target);
        
        if (!sourceNode || !targetNode) return edge;
        
        // Get port positions (use default if not set)
        const sourcePortPos = sourceNode.portPositions?.output || { x: sourceNode.width || 150, y: 30 };
        const targetPortPos = targetNode.portPositions?.input || { x: 0, y: 30 };
        
        const sourceX = sourceNode.position.x + sourcePortPos.x;
        const sourceY = sourceNode.position.y + sourcePortPos.y;
        const targetX = targetNode.position.x + targetPortPos.x;
        const targetY = targetNode.position.y + targetPortPos.y;
        
        // Calculate control points for bezier curve
        const deltaX = targetX - sourceX;
        const offset = Math.min(Math.abs(deltaX) * 0.5, 150);
        
        return {
          ...edge,
          pathType: 'bezier' as const,
          pathData: {
            sourceX,
            sourceY,
            targetX,
            targetY,
            controlPoint1X: sourceX + (deltaX > 0 ? offset : -offset),
            controlPoint1Y: sourceY,
            controlPoint2X: targetX - (deltaX > 0 ? offset : -offset),
            controlPoint2Y: targetY
          }
        };
      });
      
      return {
        ...silo,
        edges: updatedEdges
      };
    });
  });
}
// Remove a connection
export async function removeConnection(siloId: string, edgeId: string) {
  try {
    // Remove from database first
    const { error } = await supabase
      .from('edges')
      .delete()
      .eq('id', edgeId);
      
    if (error) throw error;
    
    // Then update local store
    siloStore.update(stores => {
      return stores.map(silo => {
        if (silo.id !== siloId) return silo;
        return {
          ...silo,
          edges: silo.edges.filter(edge => edge.id !== edgeId)
        };
      });
    });
    
    return true;
  } catch (err) {
    console.error('Failed to remove connection:', err);
    return false;
  }
}

// Update port positions for a node
export function updateNodePortPositions(siloId: string, nodeId: string, portPositions: PortPosition) {
  siloStore.update(store => 
    store.map(silo => {
      if (silo.id !== siloId) return silo;
      
      const updatedNodes = silo.nodes.map(node => {
        if (node.id !== nodeId) return node;
        
        return {
          ...node,
          portPositions
        };
      });
      
      return {
        ...silo,
        nodes: updatedNodes
      };
    })
  );
}

// Validate all nodes in a silo
export function validateSiloNodes(siloId: string) {
  siloStore.update(store => {
    const silo = store.find(s => s.id === siloId);
    if (!silo) return store;
    
    const updatedNodes = silo.nodes.map(node => {
      const validation = validateNodeConnections(node, silo.edges, silo.nodes);
      
      return {
        ...node,
        validation
      };
    });
    
    return store.map(s => {
      if (s.id !== siloId) return s;
      
      return {
        ...s,
        nodes: updatedNodes
      };
    });
  });
}

function validateConnection(source: SiloNode, target: SiloNode): boolean {
  // Block self-connections
  if (source.id === target.id) {
    console.log(`Self-connection blocked between ${source.id} and ${target.id}`);
    return false;
  }
  
  // Allow all connections except self-connections for now
  // You can add type-specific validation later
  return true;
}

// Update silo view state (pan/zoom)
export function updateSiloViewState(siloId: string, viewState: { zoom: number, pan: Position }) {
  siloStore.update(store => 
    store.map(silo => {
      if (silo.id !== siloId) return silo;
      
      return {
        ...silo,
        viewState
      };
    })
  );
}

export function shouldHaveInputPort(type: NodeType): boolean {
  return type !== 'project'; // Project nodes don't have input ports
}

export function shouldHaveOutputPort(type: NodeType): boolean {
  return type !== 'output'; // Output nodes don't have output ports
}

// Create the store
const createSiloStore = () => {
  const { subscribe, set, update } = writable<{
    nodes: SiloNode[];
    connections: SiloEdge[]; // Changed from Connection[] to SiloEdge[]
    selectedNode: SiloNode | null;
  }>({
    nodes: [],
    connections: [],
    selectedNode: null
  });

  return {
    subscribe,
    // Add a new node
    addNode: (type: NodeType, position: { x: number; y: number }) => {
      update(state => ({
        ...state,
        nodes: [...state.nodes, createNode(type, '', position)]
      }));
    },
    // Update node data
    updateNode: (nodeId: string, newData: Partial<SiloNode>) => {
      update(state => ({
        ...state,
        nodes: state.nodes.map(node =>
          node.id === nodeId ? { ...node, ...newData } : node
        )
      }));
    },
    // Add a function to a node
    addFunction: (nodeId: string, functionName: string, output: any) => {
      update(state => ({
        ...state,
        nodes: state.nodes.map(node =>
          node.id === nodeId ? { ...node, data: { ...node.data, [functionName]: output } } : node
        )
      }));
    },
    // Create a connection between nodes
    createConnection: (siloId: string, sourceId: string, targetId: string) => {
      console.log(`CREATING CONNECTION: silo=${siloId}, source=${sourceId}, target=${targetId}`);
      update(state => {
        const sourceNode = state.nodes.find(n => n.id === sourceId);
        const targetNode = state.nodes.find(n => n.id === targetId);

        if (!sourceNode || !targetNode || !nodeUtils.validateConnection(sourceNode, targetNode)) {
          return state;
        }

        const newConnection: SiloEdge = {
          id: crypto.randomUUID(),
          source: sourceId,  // Changed from sourceId to source
          target: targetId,  // Changed from targetId to target
          siloId: '',        // Add this required property
          type: 'function'
        };
        console.log(`CONNECTION CREATED: ${sourceId} -> ${targetId}`);
        return {
          ...state,
          connections: [...state.connections, newConnection]
          
        };
      });
    },
    // Select a node
    selectNode: (nodeId: string | null) => {
      update(state => ({
        ...state,
        selectedNode: nodeId ? state.nodes.find(n => n.id === nodeId) || null : null
      }));
    },
    // Delete a node and its connections
    deleteNode: (nodeId: string) => {
      update(state => ({
        ...state,
        nodes: state.nodes.filter(n => n.id !== nodeId),
        connections: state.connections.filter(
          c => c.source !== nodeId && c.target !== nodeId
        ),
        selectedNode: state.selectedNode?.id === nodeId ? null : state.selectedNode
      }));
    },
    // Move a node
    moveNode: (nodeId: string, position: { x: number; y: number }) => {
      update(state => ({
        ...state,
        nodes: state.nodes.map(node =>
          node.id === nodeId ? { ...node, position } : node
        )
      }));
    },
    // Reset the store
    reset: () => {
      set({
        nodes: [],
        connections: [],
        selectedNode: null
      });
    }
  };
};

export const siloStore = siloDataStore;

// Derived store for available functions based on selected node
export const availableFunctions = derived(siloStore, $store => {
  const selectedSilo = $store.find(silo => silo.selectedNode);
  if (!selectedSilo?.selectedNode) return [];
  return nodeUtils.getAvailableFunctions(selectedSilo.selectedNode.type);
});

// Derived store for node connections
export const nodeConnections = derived(siloStore, ($store: Silo[]) => {
  return $store.flatMap(silo => 
    silo.nodes.map((node: SiloNode) => ({
      node,
      connections: silo.edges.filter((c: SiloEdge) => c.source === node.id)
    }))
  );
});




