<script lang="ts">
  import TaskDump from '$lib/components/TaskDump.svelte';
  import { theme } from '$lib/stores/themeStore';
  import { goto } from '$app/navigation';
  import { siloStore } from '$lib/stores/siloStore';

  let taskInput = '';
  let isLoading = false;
  
  async function handleProcess(event: CustomEvent<string>) {
    isLoading = true;
    
    try {
      // Extract the tasks from the event
      const tasks = event.detail;
      
      // If tasks exist, process them directly here instead of just navigating
      if (tasks) {
        // Navigate to the silos page with the processed tasks
        const response = await fetch('/api/tasks/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tasks: tasks.split('\n').filter(t => t.trim()) })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.error || 'Processing failed');
        }
        
        // Handle successful response by creating a new silo
        if (data.nodes && data.edges) {
          const siloId = crypto.randomUUID();
          const siloName = `Project: ${tasks.split('\n')[0]?.substring(0, 20) || 'New Project'}...`;
          
          // Format nodes with proper structure
          const nodeData = data.nodes.slice(1).map((nodeRow: [string, string], index: number) => {
            const taskId = nodeRow[0];
            
            return {
              id: `node-${index}-${Date.now()}`,
              type: 'task',
              position: { x: 100 + (index % 3) * 300, y: 100 + Math.floor(index / 3) * 150 },
              siloId,
              data: { 
                title: typeof taskId === 'string' ? taskId.substring(0, 50) : `Task ${index}`,
                description: nodeRow[1] || "",
                status: 'not-started'
              },
              validation: {
                isValid: true,
                missingConnections: []
              }
            };
          });
          
          // Create edges based on dependencies
          const edgeData = data.edges.map((edge: [number, number], index: number) => {
            const [sourceIdx, targetIdx] = edge;
            const sourceId = `node-${sourceIdx}-${Date.now()}`;
            const targetId = `node-${targetIdx}-${Date.now()}`;
            
            return {
              id: `edge-${index}-${Date.now()}`,
              source: sourceId,
              target: targetId,
              siloId
            };
          });
          
          // Add to store
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
          
          // Navigate to new silo
          goto(`/silos/${siloId}`);
        }
      }
    } catch (error) {
      console.error('Error processing tasks:', error);
      alert('Failed to process tasks. Please try again.');
    } finally {
      isLoading = false;
    }
  }
</script>

<main class="min-h-screen bg-background-light dark:bg-background-dark p-8 transition-colors duration-300">
  <div class="max-w-7xl mx-auto">
    <div class="text-center mb-12">
      <div class="flex justify-center items-center mb-6">
        <img src="dunote.svg" alt="donezo logo" class="h-16 w-16 mr-3 theme-logo" />
        <h1 class="text-5xl font-extrabold text-[var(--bg-light)]">
          dunote
        </h1>
      </div>
      <p class="text-xl font-[350] text-gray-600 dark:text-gray-400">
        AI-powered task organization and dependency mapping
      </p>
    </div>

    <div class="relative">
      <TaskDump bind:value={taskInput} on:process={handleProcess} />
      
      {#if isLoading}
        <div class="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center rounded-lg">
          <div class="spinner border-4 border-blue-500 border-t-transparent h-12 w-12 rounded-full animate-spin"></div>
          <span class="ml-3 text-white font-medium">Generating Smart Plan...</span>
        </div>
      {/if}
    </div>




      

</main>

<style>
  .feature-card {
    background-color: var(--background-light);
    color: var(--card-dark);
    padding: 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid var(--border-color);
    transition: all 0.3s ease;
  }

  .feature-title {
    color: var(--text-primary);
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .feature-description {
    color: var(--text-secondary);
    font-size: 0.875rem;
  }

  .icon-bg {
    width: 3rem;
    height: 3rem;
    border-radius: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }

  main {
      background-color: var(--background-light);
      color: var(--background-dark);
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
</style>