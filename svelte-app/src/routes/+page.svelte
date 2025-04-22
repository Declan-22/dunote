<script lang="ts">
  import TaskDump from '$lib/components/TaskDump.svelte';
  import { theme } from '$lib/stores/themeStore';
  import { goto } from '$app/navigation';
  import { siloStore } from '$lib/stores/siloStore';

  let taskInput = '';
  let isLoading = false;
  
  async function handleProcess(event: CustomEvent<{ tasks: any[] }>) {
  isLoading = true;
  
  try {
    const parsedTasks = event.detail.tasks;
    
    if (parsedTasks?.length) {
      const siloId = crypto.randomUUID();
      const siloName = parsedTasks[0].name.substring(0, 30);

      const nodeData = parsedTasks.map((task, index) => ({
        id: task.id,
        type: 'task',
        position: { 
          x: 100 + (index % 3) * 300, 
          y: 100 + Math.floor(index / 3) * 150 
        },
        siloId,
        data: {
          title: task.name,
          description: '',
          status: task.status,
          priority: task.priority,
          dueDate: task.due_date,
          resources: task.resources,
          blockedBy: task.blocked_by
        }
      }));

      siloStore.update(store => [
        ...store,
        {
          id: siloId,
          name: siloName,
          nodes: nodeData,
          edges: [],
          isLoading: false
        }
      ]);

      goto(`/silos/${siloId}`);
    }
  } catch (error) {
    console.error('Error:', error);
    alert('Failed to process tasks');
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