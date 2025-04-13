<script lang="ts">
  import TaskDump from '$lib/components/TaskDump.svelte';
  import DependencyGraph from '$lib/components/DependencyGraph.svelte';
  import { siloStore } from '$lib/stores/siloStore';
  import type { SiloNode } from '$lib/stores/siloStore';
  import { goto } from '$app/navigation';
  import { adaptNodesForGraph } from '$lib/utils/graphAdapters';
  import type { NodeType } from '$lib/types/nodes';
  import { onMount } from 'svelte';
  
  // Initialize active silo from store
  let activeSiloId = $siloStore[0]?.id || '';
  $: activeSilo = $siloStore.find(s => s.id === activeSiloId);
  
  // Initialize with tasks from localStorage if they exist
  let taskInputValue = '';
  onMount(() => {
    const savedTasks = localStorage.getItem('taskDumpContent');
    if (savedTasks) {
      taskInputValue = savedTasks;
    }
  });
  
  // Save task input to localStorage when it changes
  $: if (taskInputValue) {
    localStorage.setItem('taskDumpContent', taskInputValue);
  }
  
  // Process task results
  let processedNodes: SiloNode[] = [];
  $: graphNodes = adaptNodesForGraph(processedNodes.length > 0 ? processedNodes : activeSilo?.nodes || []);
  let processingError = '';
  let isLoading = false;
  
  // Process tasks from the API
  async function processTasks(event: CustomEvent<string | { tasks: string | string[] }>) {
      const rawTasks = event.detail;
    processingError = '';
    isLoading = true;
    
    try {
      // Handle different input formats
      let tasks: string[] = [];
      
      if (typeof rawTasks === 'string') {
        tasks = rawTasks.split('\n').filter(t => t.trim());
      } else if (rawTasks?.tasks) {
        if (typeof rawTasks.tasks === 'string') {
          tasks = [rawTasks.tasks];
        } else {
          tasks = rawTasks.tasks;
        }
      } else if (Array.isArray(rawTasks)) {
        tasks = rawTasks;
      }
      
      console.log('Processing tasks:', tasks);
      
      if (tasks.length === 0) {
        throw new Error("Please enter at least one task");
      }

      const siloName = tasks[0] ? `Project: ${tasks[0].substring(0, 20)}...` : 'New Project';
      const siloId = crypto.randomUUID();

      const response = await fetch('/api/tasks/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks })
      });

      const data = await response.json();
      console.log('API response:', data);

      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }

      // Handle the actual API response format with edges and nodes
      if (data.nodes && data.edges) {
        // Create more intelligent node layout based on graph structure
        const nodeData = data.nodes.slice(1).map((nodeRow: [string, string], index: number) => {
          const taskId = nodeRow[0];
          const taskDescription = nodeRow[1] || "";
          
          // Create more staggered positions for better visualization
          const xPos = 100 + (index % 3) * 300;
          const yPos = 100 + Math.floor(index / 3) * 150;
          
          return {
            id: `node-${index}-${Date.now()}`,
            type: 'task' as NodeType,
            position: { x: xPos, y: yPos },
            siloId,
            data: { 
              title: typeof taskId === 'string' ? taskId.substring(0, 50) : `Task ${index}`,
              description: taskDescription,
              status: 'not-started'
            },
            validation: {
              isValid: true,
              missingConnections: []
            }
          };
        });
        
        // Create edges based on AI-determined dependencies
        const edgeData: { id: string; source: string; target: string; siloId: string }[] = [];
        
        // Convert raw edge data to proper edges
        for (let i = 0; i < data.edges.length; i++) {
          const edge = data.edges[i];
          // Assuming edge format is [sourceIdx, targetIdx] or ["sourceTask", "targetTask"]
          let sourceIndex, targetIndex;
          
          if (Array.isArray(edge)) {
            [sourceIndex, targetIndex] = edge;
          } else if (typeof edge === 'string') {
            // Find node indices by task name
            sourceIndex = data.nodes.findIndex((n: [string, string]) => n[0] === edge.split(',')[0]);
            targetIndex = data.nodes.findIndex((n: [string, string]) => n[0] === edge.split(',')[1]);
          }
          
          if (sourceIndex !== undefined && targetIndex !== undefined) {
            edgeData.push({
              id: `edge-${i}-${Date.now()}`,
              source: `node-${sourceIndex-1}-${Date.now()}`,
              target: `node-${targetIndex-1}-${Date.now()}`,
              siloId
            });
          }
        }
        
        // Update store with new silo
        siloStore.update(store => [
          ...store, 
          {
            id: siloId,
            name: siloName,
            nodes: nodeData,
            edges: edgeData,
            isLoading: false
          }
        ]);
        
        // Clear localStorage after successful processing
        localStorage.removeItem('taskDumpContent');
        
        // Navigate to the new silo
        goto(`/silos/${siloId}`);
      } else {
        throw new Error("Unrecognized API response format. Expected nodes and edges.");
      }
    } catch (err) {
      processingError = err instanceof Error ? err.message : 'Unknown error';
      console.error('Error:', err);
    } finally {
      isLoading = false;
    }
  }
</script>

{#if processingError}
  <div class="error-message">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      {processingError}
  </div>
{/if}

<div class="task-page">
  <div class="task-controls">
      <div class="mb-4">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Task Editor</h1>
          <p class="text-gray-600 dark:text-gray-400">Create or edit your task list and generate a smart plan</p>
      </div>
      
      <TaskDump 
          bind:value={taskInputValue} 
          on:process={processTasks} 
          isProcessing={isLoading}
          buttonText="Generate Smart Plan" 
      />
      
      <div class="mt-4">
          <button 
              class="text-blue-600 dark:text-blue-400 text-sm font-medium flex items-center"
              on:click={() => goto('/silos')}
          >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
              </svg>
              Back to Projects
          </button>
      </div>
  </div>

  <div class="graph-preview">
      <h2 class="text-xl font-semibold mb-2 text-gray-900 dark:text-white">Preview</h2>
      <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          The AI will generate a node graph like this based on your tasks
      </p>
      
      <div class="graph-container">
          {#if isLoading}
              <div class="flex items-center justify-center h-full">
                  <div class="spinner h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                  <span class="ml-3 text-gray-700 dark:text-gray-300 font-medium">Generating Smart Plan...</span>
              </div>
          {:else if $siloStore.length > 0}
              <DependencyGraph nodes={graphNodes} edges={activeSilo?.edges || []} />
          {:else}
              <div class="flex items-center justify-center h-full">
                  <p class="text-gray-500 dark:text-gray-400">Enter tasks and generate a plan to see preview</p>
              </div>
          {/if}
      </div>
  </div>
</div>

<style>
  .task-page {
      display: grid;
      grid-template-columns: 350px 1fr;
      gap: 2rem;
      height: 100vh;
      padding: 2rem;
      background: var(--bg-primary);
  }

  .graph-preview {
      display: flex;
      flex-direction: column;
  }
  
  .graph-container {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      background: var(--bg-secondary);
      height: calc(100vh - 150px);
      overflow: hidden;
  }

  .error-message {
      display: flex;
      align-items: center;
      padding: 1rem;
      margin-bottom: 1rem;
      color: #b91c1c;
      border: 1px solid #fca5a5;
      border-radius: 0.5rem;
      background-color: #fef2f2;
  }
  
  .spinner {
      animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
      from {
          transform: rotate(0deg);
      }
      to {
          transform: rotate(360deg);
      }
  }
  
  @media (max-width: 768px) {
      .task-page {
          grid-template-columns: 1fr;
          grid-template-rows: auto 1fr;
      }
      
      .graph-container {
          height: 400px;
      }
  }
</style>