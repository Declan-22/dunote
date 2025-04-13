<!-- src/routes/plan/+page.svelte -->
<script lang="ts">
    import { siloStore } from '$lib/stores/siloStore';
    import DependencyGraph from '$lib/components/DependencyGraph.svelte';
    import { NODE_TYPES } from '$lib/types/nodes'; // Import your node types
    // Get the active silo or first silo
    $: activeSilo = $siloStore.length > 0 ? $siloStore[0] : null;
    
    // Transform nodes to match the expected format for DependencyGraph
    $: transformedNodes = activeSilo?.nodes.map(node => ({
        type: node.type,
        x: node.position.x,
        y: node.position.y,
        status: 'active',
        icon: NODE_TYPES[node.type]?.icon || 'default-icon', // Add icon from NODE_TYPES or fallback
        data: {
        title: node.data.title
        }
    })) || [];
  </script>
  
  <main class="min-h-screen bg-gray-50 dark:bg-gray-900 p-8 transition-colors duration-300">
    <div class="max-w-7xl mx-auto">
      <h1 class="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Task Plan</h1>
      
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow p-4 h-[600px]">
        {#if activeSilo}
          <DependencyGraph nodes={transformedNodes} edges={activeSilo.edges || []} />
        {:else}
          <div class="flex items-center justify-center h-full">
            <p class="text-gray-500 dark:text-gray-400">No plan data available</p>
          </div>
        {/if}
      </div>
    </div>
  </main>