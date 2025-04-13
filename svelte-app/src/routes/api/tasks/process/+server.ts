// src/routes/api/tasks/process/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { NODE_TYPES } from '$lib/types/nodes';
import type { NodeType } from '$lib/types/nodes';
import type { SiloNode } from '$lib/stores/siloStore';

export const POST: RequestHandler = async ({ request }) => {
  try {
    // Log the incoming request for debugging
    const requestBody = await request.json();
    console.log('Request body:', requestBody);
    
    // Validate input
    if (!requestBody.tasks || typeof requestBody.tasks !== 'string') {
      console.error('Invalid input: tasks must be a string');
      return json(
        { 
          success: false, 
          error: 'Invalid input: tasks must be a string' 
        }, 
        { status: 400 }
      );
    }
    
    const tasks = requestBody.tasks;
    console.log('Parsing tasks:', tasks);
    
    // Simple task parsing - in a real app, you might want to use AI or more complex parsing
    const taskLines = tasks.split('\n').filter((line: string) => line.trim() !== '');
    console.log('Task lines:', taskLines);
    
    // Create nodes from tasks
    const nodes: SiloNode[] = taskLines.map((task: string, index: number) => {
      // Determine node type based on task content
      let nodeType: NodeType = 'task'; // default type
      
      // Check if NODE_TYPES exists and contains your node types
      if (!NODE_TYPES) {
        console.error('NODE_TYPES is undefined');
        nodeType = 'task' as NodeType; // Force as NodeType if there's an issue
      } else {
        if (task.toLowerCase().includes('dependency') || task.toLowerCase().includes('required')) {
          nodeType = 'dependency' as NodeType;
        } else if (task.toLowerCase().includes('milestone') || task.toLowerCase().includes('complete')) {
          nodeType = 'milestone' as NodeType;
        } else if (index === 0) {
          nodeType = 'project' as NodeType; // First task becomes the project node
        }
      }
      
      // Calculate position
      const x = 100 + (index % 3) * 250; 
      const y = 100 + Math.floor(index / 3) * 150;
      
      return {
        id: crypto.randomUUID(),
        type: nodeType,
        position: { x, y },
        data: { 
          title: task.trim().substring(0, 30), // Truncate long titles
          description: task.trim()
        },
        siloId: 'demo-silo'
      };
    });
    
    console.log('Generated nodes:', nodes);
    
    // Return processed nodes
    return json({
      success: true,
      nodes
    });
  } catch (error) {
    console.error('Error processing tasks:', error);
    return json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to process tasks' 
      }, 
      { status: 500 }
    );
  }
};