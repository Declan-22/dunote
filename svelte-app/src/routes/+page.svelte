
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
  
  interface NodeInsert {
  id: string;
  silo_id: string;
  type: string;
  position: { x: number; y: number };
  title: string;
  data: any;
  user_id: string;
  created_at: string;
  updated_at: string;
}

  
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
  


  async function handleProcess(event: CustomEvent<{ tasks: any[], integrationMode: boolean, siloId: string | null, title: string }>) {
  isLoading = true;
  
  try {
    const { tasks: parsedTasks, integrationMode, siloId: existingSiloId, title: collectionTitle } = event.detail;
    
    if (parsedTasks?.length) {
      // Get current user FIRST
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) throw new Error('No user is currently logged in');

      // Verify the siloId if in integration mode
      let siloId = integrationMode && existingSiloId ? existingSiloId : crypto.randomUUID();
      
      // Verify that the siloId exists in the database if in integration mode
      if (integrationMode && existingSiloId) {
        const { data: existingSilo, error } = await supabase
          .from('silos')
          .select('id, name')
          .eq('id', existingSiloId)
          .eq('user_id', currentUser.id)
          .single();
          
        if (error || !existingSilo) {
          console.error('Silo not found or not accessible:', error);
          throw new Error('The selected silo was not found or you do not have access to it.');
        }
      }
      
      const siloName = integrationMode && existingSiloId 
        ? '' // We'll fetch the name from the database for existing silos
        : (collectionTitle || `Task Collection ${new Date().toLocaleDateString()}`);

      // Create task nodes with port positions (NOW currentUser is available)
      const nodeData = parsedTasks.map((task, index) => ({
        id: crypto.randomUUID(),
        silo_id: siloId, // Make sure this is set
        type: 'task',
        title: task.name || 'Unnamed Task',
        position: {
          x: 100 + (index % 3) * 300,
          y: 100 + Math.floor(index / 3) * 150
        },
        data: {
          description: task.description || '',
          status: task.status || 'not-started',
          priority: task.priority || 'medium',
          dueDate: task.due_date || null,
          resources: task.resources || [],
          blockedBy: task.blocked_by || []
        },
        portPositions: {
          input: { x: 0, y: 30 },
          output: { x: 150, y: 30 }
        },
        user_id: currentUser.id,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }));

      // Process resources and connections
      const resourceNodes: any[] = [];
      const edges: any[] = [];
      const resourceMap = new Map<string, string>();

      parsedTasks.forEach((task, index) => {
        const resources = task.resources 
          ? Array.isArray(task.resources) 
            ? task.resources 
            : [task.resources]
          : [];

        resources.forEach((resourceName: string) => {
          if (!resourceMap.has(resourceName)) {
            const resourceId = crypto.randomUUID();
            resourceMap.set(resourceName, resourceId);
            
            resourceNodes.push({
              id: resourceId,
              type: 'resource',
              silo_id: siloId, // Make sure this is set
              position: {
                x: 100 + (resourceNodes.length % 3) * 300,
                y: 400 + Math.floor(resourceNodes.length / 3) * 150
              },
              title: resourceName || 'Unnamed Resource',
              data: {
                description: ''
              },
              portPositions: {
                input: { x: 0, y: 30 },
                output: { x: 150, y: 30 }
              },
              user_id: currentUser.id, // Set the user_id directly instead of null
              updated_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
            });
          }

          const resourceId = resourceMap.get(resourceName);
          if (resourceId) {
            const sourceNodeId = nodeData[index].id; // Use the correct node ID
            
            edges.push({
              id: crypto.randomUUID(),
              source: sourceNodeId,
              target: resourceId,
              silo_id: siloId,
              pathType: 'bezier',
              pathData: calculateConnectionPath(
                nodeData.find(n => n.id === sourceNodeId)!,
                resourceNodes.find(n => n.id === resourceId)!,
                'output',
                'input'
              )
            });
          }
        });
      });

      // Combine all nodes
      const allNodes = [...nodeData, ...resourceNodes];
      
      // Only create new silo if not in integration mode
      if (!integrationMode) {
        const { error: siloError } = await supabase
          .from('silos')
          .insert({
            id: siloId,
            name: siloName,
            user_id: currentUser.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          
        if (siloError) throw siloError;
      }
      
      // Insert nodes
      if (allNodes.length > 0) {
        const nodeInserts = allNodes.map(node => ({
          id: node.id,
          silo_id: siloId, // Make sure to use the correct siloId
          type: node.type,
          position: node.position,
          title: node.title,
          data: node.data,
          user_id: currentUser.id,
          created_at: node.created_at,
          updated_at: node.updated_at
        }));
        
        const { error: nodesError } = await supabase
          .from('nodes')
          .insert(nodeInserts);
          
        if (nodesError) throw nodesError;
      }
      
      // Insert edges
      if (edges.length > 0) {
        const edgeInserts = edges.map(edge => ({
          id: edge.id,
          silo_id: siloId, // Make sure to use the correct siloId
          source: edge.source,
          target: edge.target,
          path_type: edge.pathType,
          path_data: edge.pathData,
          user_id: currentUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));
        
        const { error: edgesError } = await supabase
          .from('edges')
          .insert(edgeInserts);
          
        if (edgesError) throw edgesError;
      }

      // For integration mode, fetch the existing silo name
      let displayName = siloName;
      if (integrationMode && existingSiloId) {
        const { data: siloData } = await supabase
          .from('silos')
          .select('name')
          .eq('id', existingSiloId)
          .single();
          
        if (siloData) {
          displayName = siloData.name;
        }
      }

      // Update store and navigate
      siloStore.update(store => {
        // If in integration mode, find and update the existing silo
        if (integrationMode && existingSiloId) {
          return store.map(silo => {
            if (silo.id === existingSiloId) {
              return {
                ...silo,
                nodes: [...silo.nodes, ...allNodes],
                edges: [...silo.edges, ...edges],
                isLoading: false
              };
            }
            return silo;
          });
        } else {
          // Otherwise add a new silo
          return [
            ...store,
            {
              id: siloId,
              name: displayName,
              nodes: allNodes,
              edges: edges,
              isLoading: false
            }
          ];
        }
      });
      
      goto(`/silos/${siloId}`);
    }
  } catch (error) {
    console.error('Error:', error);
    alert(`Failed to process tasks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    isLoading = false;
  }
}
</script>

<main class="min-h-screen bg-background-light dark:bg-background-dark p-8 transition-colors duration-300">
  <div class="max-w-3xl mx-auto">
    <div class="flex items-center justify-center mb-6">
      <img src="dunotepen.svg" alt="dunote logo" class="h-8 w-8 mr-5 theme-logo" />
      <p class="text-xl text-center font-serif text-[var(--text-primary)]">
        {welcomeMessage}
      </p>
    </div>

    <div class="relative mt-25 mb-55">
      <TaskDump bind:value={taskInput} on:process={handleProcess} />
      



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