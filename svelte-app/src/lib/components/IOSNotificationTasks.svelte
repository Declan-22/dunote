<script lang="ts">
    import { onMount } from 'svelte';
    import { siloStore } from '$lib/stores/siloStore';
    import { fly, scale } from 'svelte/transition';
    import { supabase } from '$lib/supabaseClient';
    
    let tasks = [];
    let expanded = false;
    let isLoading = true;
    
    // Get current user's tasks across all silos
    onMount(async () => {
      isLoading = true;
      
      // Get the current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // First get all silos from the store
        const allSilos = $siloStore;
        
        // Extract all task nodes from all silos
        const allTasks = [];
        
        allSilos.forEach(silo => {
          const siloTasks = silo.nodes
            .filter(node => node.type === 'task' && !node.data?.isComplete)
            .map(task => ({
              id: task.id,
              title: task.data?.title || 'Untitled Task',
              priority: task.data?.priority || 'medium',
              dueDate: task.data?.dueDate || null,
              siloId: silo.id,
              siloName: silo.name
            }));
          
          allTasks.push(...siloTasks);
        });
        
        // Sort by priority
        tasks = allTasks.sort((a, b) => {
          const priorityRank = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };
          return priorityRank[a.priority] - priorityRank[b.priority];
        });
      }
      
      isLoading = false;
    });
    
    function toggleExpanded() {
      expanded = !expanded;
    }
    
    function getPriorityColor(priority) {
  switch(priority) {
    case 'urgent': return '#940d00'; // dark red
    case 'high': return '#db2b1a';   // blood orange
    case 'medium': return '#F1C40F'; // yellow
    case 'low': return '#2ECC71';    // green
    default: return '#95A5A6';       // gray (neutral fallback)
  }
}
    
    function formatDate(dateString) {
      if (!dateString) return '';
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  </script>
  
  <div class="mt-16 max-w-3xl mx-auto">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-lg font-medium text-[var(--text-primary)]">My Tasks</h2>
      <button 
        class="text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
        on:click={toggleExpanded}
      >
        {expanded ? 'Collapse' : 'View all'}
      </button>
    </div>
    
    {#if isLoading}
      <div class="flex justify-center py-8">
        <div class="h-6 w-6 border-2 border-t-[var(--brand-green)] rounded-full animate-spin"></div>
      </div>
    {:else if tasks.length === 0}
      <div class="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] text-center">
        <p class="text-sm text-[var(--text-secondary)]">No tasks yet. Add tasks to get started.</p>
      </div>
    {:else}
      <!-- Task Stack Container -->
      <div 
        class="relative"
        on:click={expanded ? null : toggleExpanded}
        class:cursor-pointer={!expanded}
      >
        <!-- Expanded View -->
        {#if expanded}
          <div
            transition:fly={{ y: 20, duration: 300 }}
            class="space-y-3"
          >
            {#each tasks as task, i}
              <div
                in:fly={{ y: 20, delay: i * 50, duration: 300 }}
                class="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] flex items-center"
              >
                <div class="flex-1">
                  <div class="flex items-center">
                    <span
                    class="h-3 w-3 rounded-full mr-2"
                    style="background-color: {getPriorityColor(task.priority)}"
                  ></span>
                    <span class="text-[var(--text-primary)]">{task.title}</span>
                  </div>
                  {#if task.siloName}
                    <p class="text-xs text-[var(--text-secondary)] mt-1">{task.siloName}</p>
                  {/if}
                </div>
                {#if task.dueDate}
                  <span class="text-xs text-[var(--text-secondary)] ml-3">{formatDate(task.dueDate)}</span>
                {/if}
                <a 
                  href={`/silos/${task.siloId}/workspace/${task.id}`} 
                  class="ml-3 text-xs text-[var(--brand-green)] hover:underline"
                >
                  Open
                </a>
              </div>
            {/each}
          </div>
        <!-- Collapsed Stack View -->
        {:else}
          <div class="relative h-[200px]">
            {#each tasks.slice(0, Math.min(4, tasks.length)) as task, i (task.id)}
              <div
                class="absolute w-full bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] shadow-sm transition-all duration-300"
                style="
                  top: {i * 10}px; 
                  z-index: {100 - i};
                  transform: scale({1 - i * 0.02}) translateY({i * 5}px);
                  opacity: {1 - i * 0.1};
                "
              >
                <div class="flex items-center justify-between">
                  <div class="flex items-center">
                    <span
                    class="h-3 w-3 rounded-full mr-2"
                    style="background-color: {getPriorityColor(task.priority)}"
                  ></span>
                    <span class="text-[var(--text-primary)]">{task.title}</span>
                  </div>
                  {#if task.dueDate}
                    <span class="text-xs text-[var(--text-secondary)]">{formatDate(task.dueDate)}</span>
                  {/if}
                </div>
                {#if task.siloName}
                  <p class="text-xs text-[var(--text-secondary)] mt-1">{task.siloName}</p>
                {/if}
              </div>
            {/each}
            
            {#if tasks.length > 4}
              <div
                class="absolute bottom-0 left-0 right-0 text-center pb-3 pt-16 bg-gradient-to-t from-[var(--bg-primary)] to-transparent pointer-events-none"
                style="z-index: 101;"
              >
                <span class="text-sm text-[var(--text-secondary)]">+{tasks.length - 4} more tasks</span>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  </div>