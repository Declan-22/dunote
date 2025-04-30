
<script lang="ts">
  import TaskDump from '$lib/components/TaskDump.svelte';
  import IOSNotificationTasks from '$lib/components/IOSNotificationTasks.svelte'; // Add this import
  import { theme } from '$lib/stores/themeStore';
  import { goto } from '$app/navigation';
  import { siloStore } from '$lib/stores/siloStore';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { calculateConnectionPath } from '$lib/stores/siloStore';

  let taskInput = '';
  let isLoading = false;
  let welcomeMessage = '';

  let userName = '';

  
  // Welcome message options
  const welcomeMessages = [
    "What are you working on today?",
    "Ready to organize your tasks?",
    "Let's map out your project",
    "Drop your tasks below to get started"
  ];
  
  onMount(async () => {
    // Get the current user
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Get user's metadata which contains the display_name
      userName = user.user_metadata?.display_name || '';
      
      // Create personalized welcome message if user is logged in
      if (userName) {
        welcomeMessage = `Hello ${userName}, ${welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)].toLowerCase()}`;
      } else {
        // Default message if no display name is found
        welcomeMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
      }
    } else {
      // Default message if user is not logged in
      welcomeMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
    }
  });
  

  async function handleProcess(event: CustomEvent<{ tasks: any[] }>) {
  isLoading = true;
  
  try {
    const parsedTasks = event.detail.tasks;
    
    if (parsedTasks?.length) {
      const siloId = crypto.randomUUID();
      const siloName = parsedTasks[0].name.substring(0, 30);

      // Create task nodes with port positions
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
        },
        portPositions: {
          input: { x: 0, y: 30 },
          output: { x: 150, y: 30 }
        },
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }));

      // Process resources and connections
      const resourceNodes = [];
      const edges = [];
      const resourceMap = new Map();

      parsedTasks.forEach(task => {
        const resources = task.resources 
          ? Array.isArray(task.resources) 
            ? task.resources 
            : [task.resources]
          : [];

        resources.forEach(resourceName => {
          if (!resourceMap.has(resourceName)) {
            const resourceId = crypto.randomUUID();
            resourceMap.set(resourceName, resourceId);
            
            resourceNodes.push({
              id: resourceId,
              type: 'resource',
              position: {
                x: 100 + (resourceNodes.length % 3) * 300,
                y: 400 + Math.floor(resourceNodes.length / 3) * 150
              },
              siloId,
              data: {
                title: resourceName,
                description: ''
              },
              portPositions: {
                input: { x: 0, y: 30 },
                output: { x: 150, y: 30 }
              },
              updated_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            });
          }

          const resourceId = resourceMap.get(resourceName);
          edges.push({
            id: crypto.randomUUID(),
            source: task.id,
            target: resourceId,
            siloId,
            pathType: 'bezier',
            pathData: calculateConnectionPath(
              nodeData.find(n => n.id === task.id),
              resourceNodes.find(n => n.id === resourceId),
              'output',
              'input'
            )
          });
        });
      });

      // Combine all nodes and edges
      const allNodes = [...nodeData, ...resourceNodes];
      
      // Get the current user information
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      
      if (!currentUser) {
        throw new Error('No user is currently logged in');
      }
      
      // First, create the silo in Supabase
      const { data: siloData, error: siloError } = await supabase
        .from('silos')
        .insert({
          id: siloId,
          name: siloName,
          user_id: currentUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select();
        
      if (siloError) throw siloError;
      
      // Next, insert all nodes
      const nodeInserts = allNodes.map(node => ({
        id: node.id,
        silo_id: siloId,
        type: node.type,
        position: node.position,
        data: node.data,
        user_id: currentUser.id,
        created_at: node.created_at,
        updated_at: node.updated_at
      }));
      
      if (nodeInserts.length > 0) {
        const { error: nodesError } = await supabase
          .from('nodes')
          .insert(nodeInserts);
          
        if (nodesError) throw nodesError;
      }
      
      // Finally, insert all edges
      const edgeInserts = edges.map(edge => ({
        id: edge.id,
        silo_id: siloId,
        source: edge.source,
        target: edge.target,
        path_type: edge.pathType,
        path_data: edge.pathData,
        user_id: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      
      if (edgeInserts.length > 0) {
        const { error: edgesError } = await supabase
          .from('edges')
          .insert(edgeInserts);
          
        if (edgesError) throw edgesError;
      }

      // Update local store
      siloStore.update(store => [
        ...store,
        {
          id: siloId,
          name: siloName,
          nodes: allNodes,
          edges: edges,
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
  <div class="max-w-3xl mx-auto">
    <div class="flex items-center justify-center mb-6">
      <img src="dunotepen.svg" alt="dunote logo" class="h-12 w-12 mr-3 theme-logo" />
      <p class="text-xl text-center font-serif text-[var(--text-primary)]">
        {welcomeMessage}
      </p>
    </div>

    <div class="relative mt-25 mb-55">
      <TaskDump bind:value={taskInput} on:process={handleProcess} />
      
      {#if isLoading}
        <div class="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center rounded-lg">
          <div class="spinner border-4 border-blue-500 border-t-transparent h-12 w-12 rounded-full animate-spin"></div>
          <span class="ml-3 text-white font-medium">Generating Smart Plan...</span>
        </div>
      {/if}


    </div>
    
    <!-- Add the iOS-style notification tasks component here -->
    <IOSNotificationTasks />
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