<script lang="ts">
  import { onMount, afterUpdate, tick } from 'svelte';
  import { siloStore } from '$lib/stores/siloStore';
  import { fade, slide } from 'svelte/transition';
  import type { Silo, SiloNode, SiloEdge } from '$lib/stores/siloStore';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/userStore';
  import { marked } from 'marked';
  import type { NodeType } from '$lib/types/nodes';
  import { NODE_TYPES } from '$lib/types/nodes';
  import type { SiloOutput } from '$lib/types/database';
  import { executeNodeFunction } from '$lib/stores/siloStore';

  export let siloId: string;
  let isEditing = false;
  let outputContent = '';
  let editableContent = '';
  let silo: Silo | undefined;
  let outputTitle = 'Workflow Output';
  let isEditingTitle = false;
  let editableTitle = '';
  let selectedProject = 'all';
  let selectedFilter = 'priority';
  let viewMode = 'all';
  let error: Error | null = null;
  let isEditingResource = false;
  let editingResourceNodeId = '';
  let editableResourceContent = '';
  let editableResourceTitle = '';
  export let spaceId: string;

  type PortPosition = {
    input: { x: number; y: number };
    output: { x: number; y: number };
  };

  type NodeData = {
    title?: string;
    description?: string;
    status?: string;
    isComplete?: boolean;
    result?: any;
    priority?: string;
    dueDate?: string;
    project?: string;
    // Add other node data properties as needed
  };

  $: filteredTasks = (() => {
  let tasks = [...taskNodes];
  if (selectedFilter === 'Priority') {
    return tasks.sort((a, b) => {
      const priorityRank: Record<string, number> = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };
      return priorityRank[getNodePriority(a) || 'medium'] - priorityRank[getNodePriority(b) || 'medium'];
    });
  } else if (selectedFilter === 'Due Date') {
    return tasks.sort((a, b) => {
      const dateA = getNodeDueDate(a) ? new Date(getNodeDueDate(a)) : new Date(9999, 0, 1);
      const dateB = getNodeDueDate(b) ? new Date(getNodeDueDate(b)) : new Date(9999, 0, 1);
      return dateA.getTime() - dateB.getTime();
    });
  } else if (selectedFilter === 'Project') {
    return tasks.sort((a, b) => {
      const projA = getNodeProject(a) || '';
      const projB = getNodeProject(b) || '';
      return projA.localeCompare(projB);
    });
  }
  return tasks;
})();

  $: parsedContent = marked.parse(outputContent || '');
  $: silo = $siloStore.find(s => s.id === siloId);
  $: completedTasks = taskNodes.filter(n => n.data.isComplete) || [];
  $: totalTasks = taskNodes.length;
  $: progressPercentage = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;
  $: taskNodes = (silo?.nodes || []).filter(n => n.type === 'task') || [];
  $: resourceNodes = (silo?.nodes || []).filter(n => n.type === 'resource') || [];
  $: projectNodes = (silo?.nodes || []).filter(n => n.type === 'project') || [];
  $: milestoneNodes = (silo?.nodes || []).filter(n => n.type === 'milestone') || [];
  
  let isLoading = true;
  onMount(async () => {
    isLoading = true;
    try {
      // Wait for silo to be available
      await tick();
      
      const savedOutput = await loadSavedOutput(siloId);
      console.log('Loaded output:', savedOutput);

      if (savedOutput) {
        outputContent = savedOutput.content;
        outputTitle = savedOutput.title;
      } else {
        console.log('No saved output - generating default');
        generateDefaultOutput();
      }
    } catch (e) {
      error = e as Error;
      console.error('Initialization error:', e);
    } finally {
      isLoading = false;
    }
  });
  
  afterUpdate(() => {
    // Regenerate output when nodes are completed and no manual edits
    if (!isEditing && !outputContent) {
      generateDefaultOutput();
    }
  });

  function updatePriority(node: SiloNode, priority: string) {
    node.data.priority = priority;
    saveOutput();
  }

  
  function getPriorityStyle(priority: string): string {
  let bgColor, textColor, borderColor;
  
  switch(priority?.toLowerCase()) {
    case 'urgent':
      bgColor = 'var(--bg-primary)';
      textColor = '#ab0909'; // red-700
      borderColor = '#7d0707'; // red-500
      break;
    case 'high':
      bgColor = 'var(--bg-primary)';
      textColor = '#f23838'; // red-600
      borderColor = '#c22121'; // orange-500
      break;
    case 'medium':
      bgColor = 'var(--bg-primary)';
      textColor = '#A16207'; // amber-700
      borderColor = '#F59E0B'; // amber-500
      break;
    case 'low':
    default:
      bgColor = 'var(--bg-primary)';
      textColor = '#047857'; // emerald-700
      borderColor = '#10B981'; // emerald-500
      break;
  }
  
  return `border-color: ${borderColor}; color: ${textColor}; background-color: ${bgColor};`;
}
  

  async function updateResourceContent(nodeId: string, newContent: string, newTitle: string) {
  const node = silo?.nodes.find(n => n.id === nodeId);
  if (!node) return;
  
  try {
    
    // Update local store
    const updatedData = {
      ...node.data,
      sourceContent: newContent,
      title: newTitle || node.data.title
    };
    
    updateNode(siloId, nodeId, { data: updatedData });
    
    // Sync with database
    const { error } = await supabase
      .from('nodes')
      .update({ data: updatedData })
      .eq('id', nodeId);
      
    if (error) throw error;
    
    // If extraction nodes are connected, you might want to re-run them
    const extractionEdges = silo?.edges.filter(e => 
  e.source === nodeId && 
  silo.nodes.find(n => n.id === e.target)?.type === 'extract'
) || [];

    
    for (const edge of extractionEdges) {
      await executeNodeFunction(siloId, edge.target, 'extract_quotes');
    }
    
    return true;
  } catch (err) {
    console.error('Failed to update resource content:', err);
    return false;
  }
}

  

  function safeNodeTitle(node: SiloNode) {
    return node.data?.title || 'Untitled Node';
  }

  function safeNodeResult(node: SiloNode) {
  return (node.data?.result as { [key: string]: any }) || {}; // Type assertion
}

  function getNodeStatus(node: SiloNode) {
    return node.data?.result?.new_status || node.data?.status || 'not-started';
  }

  function getNodePriority(node: SiloNode) {
    return node.data?.priority || 'medium';
  }

  function getNodeDueDate(node: SiloNode) {
    return node.data?.dueDate || '';
  }

  function getNodeProject(node: SiloNode) {
    return node.data?.project || '';
  }

  function openResourceEditor(nodeId: string) {
  const node = silo?.nodes.find(n => n.id === nodeId);
  if (!node) return;
  
  editingResourceNodeId = nodeId;
  editableResourceContent = node.data?.sourceContent || '';
  editableResourceTitle = node.data?.title || '';
  isEditingResource = true;
}

// Add this function to save the resource edits
function saveResourceEdit() {
  if (!editingResourceNodeId) return;
  
  updateResourceContent(editingResourceNodeId, editableResourceContent, editableResourceTitle);
  isEditingResource = false;
}

  

function getPriorityClass(priority: string) {
  // Handle null or undefined priority gracefully
  if (!priority) return 'bg-gray-100 text-gray-800';
  
  // Normalize the priority string and check
  switch(priority.toLowerCase().trim()) {
    case 'high':
      return 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-100';
    case 'urgent':
      return 'bg-red-300 text-red-800 dark:bg-red-900 dark:text-red-100';
    case 'medium':
      return 'bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-100';
    case 'low':
      return 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100';
    default:
      return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
  }
}

  function updateNode(siloId: string, nodeId: string, updates: any) {
  // Update node in local store
  if (!silo) return;
  
  const nodeIndex = silo.nodes.findIndex(n => n.id === nodeId);
  if (nodeIndex === -1) return;
  
  // Create updated node
  const updatedNode = {
    ...silo.nodes[nodeIndex],
    ...updates,
    data: {
      ...silo.nodes[nodeIndex].data,
      ...(updates.data || {})
    }
  };
  
  // Update in siloStore
  $siloStore = $siloStore.map(s => {
    if (s.id === siloId) {
      return {
        ...s,
        nodes: s.nodes.map(n => n.id === nodeId ? updatedNode : n)
      };
    }
    return s;
  });
}



function updateProjectProgress() {
  // Add type annotation for projectUpdates
  const projectUpdates: Record<string, {
    progress: number;
    tasks_completed: number;
    tasks_total: number;
  }> = {};

  // Add optional chaining for silo
  if (!silo) return;

  projectNodes.forEach(projectNode => {
    // Add type safety for task filtering
    const connectedTasks = taskNodes.filter(task => 
      getNodeProject(task) === safeNodeTitle(projectNode)
    );
    
    const totalTasks = connectedTasks.length;
    const completedTasks = connectedTasks.filter(t => t.data?.isComplete).length;
    const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    projectUpdates[projectNode.id] = {
      progress,
      tasks_completed: completedTasks,
      tasks_total: totalTasks
    };
  });

  // Update all projects with null checks
  Object.entries(projectUpdates).forEach(([nodeId, data]) => {
    const node = silo?.nodes.find(n => n.id === nodeId);
    if (!node) return;

    updateNode(siloId, nodeId, {
      data: {
        ...node.data,  // Use the found node's data directly
        result: data
      }
    });
  });
}



  function formatTimeAgo(timestamp: string) {
    if (!timestamp) return '';
    
    const now = new Date();
    const updated = new Date(timestamp);
    const diff = Math.floor((now.getTime() - updated.getTime()) / 1000);
    
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  }
  
  async function loadSavedOutput(siloId: string) {
    if (!$user) {
      console.warn('No authenticated user');
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('silo_outputs')
        .select('content, title')
        .eq('silo_id', siloId)
        .eq('user_id', $user.id)
        .maybeSingle();

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      return data;
    } catch (err) {
      console.error('Failed to load output:', err);
      throw new Error('Failed to load saved output');
    }
  }
  
  async function saveOutput() {
    if (!$user || !silo) {
      console.log('Save prevented - missing user or silo');
      return;
    }

    console.log('Saving output:', {
      siloId,
      userId: $user.id,
      title: outputTitle,
      content: outputContent
    });

    try {
      const { error } = await supabase
        .from('silo_outputs')
        .upsert({
          silo_id: siloId,
          user_id: $user.id,
          title: outputTitle,
          content: outputContent,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Supabase error details:', {
          code: error.code,
          message: error.message,
          details: error.details
        });
        throw error;
      }
      
      console.log('Save successful');
    } catch (err) {
      error = err as Error;
      console.error('Full error object:', err);
    }
  }
  
  function generateDefaultOutput() {
    if (!silo) return;
    
    let content = `# ${silo.name} Output\n\n`;

    const aiNodes = silo.nodes.filter(n => ['extractor', 'summarizer'].includes(n.type));
    
    aiNodes.forEach(node => {
      if (node.type === 'extract' && node.data.result) {
        content += `### Extracted Quotes (${safeNodeTitle(node)})\n`;
        node.data.result.quotes.forEach(quote => {
          content += `> ${quote}\n\n`;
        });
      }
      
      if (node.type === 'summarize' && node.data.result) {
        content += `### AI Summary (${safeNodeTitle(node)})\n`;
        content += `${node.data.result.summary}\n\n`;
      }
    });
    
    // Add summaries from resource nodes
    const resourceNodes = silo.nodes.filter(n => n.type === 'resource' && n.data.result);
    if (resourceNodes.length > 0) {
      content += '## Resources\n\n';
      resourceNodes.forEach(node => {
        content += `### ${safeNodeTitle(node)}\n`;
        if (node.data.result?.summary) {
          content += `${node.data.result.summary}\n\n`;
        }
        if (node.data.result?.url) {
          content += `Source: ${node.data.result.url}\n\n`;
        }
      });
    }
    
    // Add task status
    const taskNodes = silo.nodes.filter(n => n.type === 'task');
    if (taskNodes.length > 0) {
      content += '## Tasks\n\n';
      taskNodes.forEach(node => {
        const status = getNodeStatus(node);
        const statusEmoji = status === 'completed' ? '✅' : 
                           status === 'in-progress' ? '🔄' : '⏳';
        content += `- ${statusEmoji} **${safeNodeTitle(node)}**: ${status}\n`;
      });
      content += '\n';
    }
    
    // Add milestone progress
    const milestoneNodes = silo.nodes.filter(n => n.type === 'milestone');
    if (milestoneNodes.length > 0) {
      content += '## Milestones\n\n';
      milestoneNodes.forEach(node => {
        const achieved = node.data.result?.achieved;
        const statusEmoji = achieved ? '🏆' : '🎯';
        content += `- ${statusEmoji} **${safeNodeTitle(node)}**: ${achieved ? 'Achieved' : 'In Progress'}\n`;
      });
      content += '\n';
    }
    
    // Add project progress
    const projectNodes = silo.nodes.filter(n => n.type === 'project' && n.data.result);
    if (projectNodes.length > 0) {
      content += '## Project Progress\n\n';
      projectNodes.forEach(node => {
        if (node.data.result?.progress !== undefined) {
          const progress = node.data.result.progress;
          content += `### ${safeNodeTitle(node)}\n`;
          content += `Progress: ${progress}%\n`;
          content += `Tasks completed: ${node.data.result.tasks_completed || 0}/${node.data.result.tasks_total || 0}\n\n`;
        }
      });
    }
    
    outputContent = content;
  }

  function getStatusDisplay(status: string) {
  switch(status) {
    case 'not-started': return 'Not Started';
    case 'in-progress': return 'In Progress';
    case 'completed': return 'Completed';
    default: return status;
  }
}

function extractQuotes(quote: string) { // Add type annotation
  // ...
}
  
  function startEditing() {
    editableContent = outputContent;
    isEditing = true;
  }
  
  function saveEdits() {
    outputContent = editableContent;
    isEditing = false;
    saveOutput();
  }
  
  function startEditingTitle() {
    editableTitle = outputTitle;
    isEditingTitle = true;
  }
  
  function saveTitleEdit() {
    outputTitle = editableTitle;
    isEditingTitle = false;
    saveOutput();
  }

  function toggleNodeCompletion(node: SiloNode) {
  if (node && node.data) {
    node.data.isComplete = !node.data.isComplete;
    // Update the node in the siloStore
    $siloStore = [...$siloStore];
    updateProjectProgress(); // Add this line
    saveOutput();
  }
}
</script>

{#if isLoading}
  <div class="text-center p-8 text-gray-500">Loading workflow data...</div>
{:else if error}
  <div class="error-message p-4 mb-4 bg-red-100 text-red-800 rounded">
    Error: {error.message}
    <button on:click={() => error = null} class="ml-2 px-2 py-1 bg-red-200 hover:bg-red-300 rounded">
      Dismiss
    </button>
  </div>
{:else}
  {#if !silo || silo.nodes.length === 0}
    <div class="text-center p-8 text-gray-500">No workflow data available</div>
  {:else}
    <div class="container mx-auto px-4 py-6 max-w-6xl">
      <!-- Header -->
      <header class="mb-8">
        <div class="flex justify-between items-center">
          <div class="flex items-center space-x-4">
            {#if isEditingTitle}
              <input 
                bind:value={editableTitle}
                on:blur={saveTitleEdit}
                on:keydown={(e) => e.key === 'Enter' && saveTitleEdit()}
                class="text-2xl font-bold bg-transparent border-b"
                style="color: var(--text-primary); border-color: var(--border-color)"
                autofocus
              />
            {:else}
              <button 
                on:click={startEditingTitle}
                on:keydown={e => e.key === 'Enter' && startEditingTitle()}
                class="output-header"
              >
                {outputTitle}
              </button>
            {/if}
            <!-- Add aria-label -->
            <button aria-label="Edit title"></button>
          </div>
          <div class="flex items-center space-x-4">
            <span class="text-sm" style="color: var(--text-secondary)">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
            <button 
              on:click={startEditing}
              class="px-3 py-1.5 rounded-lg text-sm"
              style="background-color: var(--brand-green); color: var(--light-text)"
            >
              + New Task
            </button>
          </div>
        </div>

        <div class="mt-6 flex items-center justify-between">
          <div class="flex space-x-1">
            <button
              on:click={() => viewMode = 'all'}
              class="px-3 py-1.5 rounded-lg text-sm font-medium"
              style:background-color={viewMode === 'all' ? 'var(--brand-green)' : 'transparent'}
              style:color={viewMode === 'all' ? 'var(--light-text)' : 'var(--text-secondary)'}
            >
              All Tasks
            </button>
            <button
              class:active-tab={viewMode === 'today'}
              on:click={() => viewMode = 'today'}
              class="px-3 py-1.5 rounded-lg text-sm"
              class:bg-indigo-50={viewMode === 'today'}
              class:text-indigo-700={viewMode === 'today'}
              class:text-gray-600={viewMode !== 'today'}
              class:hover:bg-gray-100={viewMode !== 'today'}
            >
              Today
            </button>
            <button
              class:active-tab={viewMode === 'projects'}
              on:click={() => viewMode = 'projects'}
              class="px-3 py-1.5 rounded-lg text-sm"
              class:bg-indigo-50={viewMode === 'projects'}
              class:text-indigo-700={viewMode === 'projects'}
              class:text-gray-600={viewMode !== 'projects'}
              class:hover:bg-gray-100={viewMode !== 'projects'}
            >
              Projects
            </button>
          </div>
          <div class="flex items-center space-x-2">
            <span class="text-sm" style="color: var(--text-secondary)">Filter:</span>
            <select 
              bind:value={selectedFilter}
              class="text-sm border rounded-md px-2 py-1"
              style="border-color: var(--border-color); color: var(--text-primary); background-color: var(--bg-primary)"
            >
              <option>Priority</option>
              <option>Due Date</option>
              <option>Project</option>
            </select>
          </div>
        </div>
      </header>

      <!-- Main Content -->
      <main class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <!-- Priority Tasks Column -->
        <div class="col-span-2 space-y-5">
          <div class="rounded-xl border p-4"
              style="background-color: [var(--bg-primary)]; border-color: var(--border-color)">
            <div class="flex justify-between items-center mb-4">
              <h2 class="font-medium" style="color: var(--text-primary)">Workflow Progress</h2>
              <span 
              class="text-xs px-2 py-0.5 rounded-full transition-colors"
              style="
                background-color: hsl(
                  {progressPercentage * 1.2}, 
                  70%, 
                  40%
                );
                color: var(--light-text);
              "
            >
              {completedTasks.length} of {totalTasks} tasks complete
            </span>
            </div>

            <!-- Task Cards -->
            {#each filteredTasks as node (node.id)}

            <div class="task-node mb-3">
              <div class="border border-[var(--border-color)] rounded-lg p-3 hover:shadow-sm transition relative overflow-hidden" 
                   data-priority={getNodePriority(node)}>
                <div class="priority-indicator absolute left-0 top-0 bottom-0 w-2 opacity-80"
                     class:bg-red-500={getNodePriority(node) === 'urgent'} 
                     class:bg-red-400={getNodePriority(node) === 'high'} 
                     class:bg-amber-400={getNodePriority(node) === 'medium'}
                     class:bg-emerald-400={getNodePriority(node) === 'low'}>
                </div>
                <div class="bg-gradient-to-r absolute inset-0 z-0 opacity-10 dark:opacity-5"
                     class:from-red-500={getNodePriority(node) === 'urgent'} 
                     class:from-red-400={getNodePriority(node) === 'high'} 
                     class:from-amber-400={getNodePriority(node) === 'medium'}
                     class:from-emerald-400={getNodePriority(node) === 'low'}>
                </div>
                <div class="flex items-start justify-between relative z-10">
                  <div class="flex items-start space-x-3">



                      <div class="mt-0.5 relative">
                        <div 
                          class="w-4 h-4 rounded cursor-pointer border-1 border-[var(--neutral-500)] flex items-center justify-center {node.data.isComplete ? 'bg-[var(--brand-green-light)] border-[var(--brand-green)]' : 'bg-transparent'}"
                          on:click={() => toggleNodeCompletion(node)}
                          on:keypress={(e) => e.key === 'Enter' && toggleNodeCompletion(node)}
                          tabindex="0"
                          role="checkbox"
                          aria-checked={node.data.isComplete}
                        >
                          {#if node.data.isComplete}
                            <svg 
                              width="12" 
                              height="12" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              class="text-white"
                            >
                              <path 
                                d="M5 13l4 4L19 7" 
                                stroke="currentColor" 
                                stroke-width="3" 
                                stroke-linecap="round" 
                                stroke-linejoin="round"
                              />
                            </svg>
                          {/if}
                        </div>
                      </div>
                      <div>
                        <h3 class="font-medium" style="color: var(--text-primary)">{safeNodeTitle(node)}</h3>
                        <div class="flex items-center mt-1 text-xs space-x-3" style="color: var(--text-secondary)">
                          {#if getNodeDueDate(node)}
                            <span class="flex items-center">
                              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                              </svg>
                              Due {getNodeDueDate(node)}
                            </span>
                          {/if}
                          {#if getNodeProject(node)}
                            <span class="flex items-center">
                              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path>
                              </svg>
                              {getNodeProject(node)}
                            </span>
                          {/if}
                        </div>
                      </div>
                    </div>
                    <div class="relative group">
                      <select
                      value={getNodePriority(node)}
                      on:change={(e) => updatePriority(node, (e.target as HTMLInputElement).value)}
                      class="text-sm border rounded-md px-2 py-1 ml-2"
                      style={getPriorityStyle(getNodePriority(node))}
                    >
                      {#each ['low', 'medium', 'high', 'urgent'] as priority}
                        <option value={priority}>{priority}</option>
                      {/each}
                    </select>
                    </div>
                  </div>

                  <!-- Find related resource nodes -->
                  {#each resourceNodes.filter(r => 
                    silo.edges.some(e => 
                      e.source === node.id && e.target === r.id ||
                      e.target === node.id && e.source === r.id
                    )
                  ) as resourceNode}
                    <div class="ml-7 mt-3">
                      <div class="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg p-2.5 mb-2">
                        <div class="flex justify-between items-center mb-1">
                          <div class="text-xs uppercase tracking-wide text-gray-400">Resource</div>
                          <button class="text-xs text-gray-400 hover:text-gray-600">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                            </svg>
                          </button>
                        </div>
                        <h4 class="text-sm font-medium text-[var(--text-secondary)]">{safeNodeTitle(resourceNode)}</h4>
                        {#if resourceNode.data.result?.summary}
                          <div class="mt-2 bg-[var(--bg-accenttwo)] border border-[var(--border-color)] rounded-lg p-2 text-xs">
                            <div class="flex justify-between items-center mb-1">
                              <div class="uppercase tracking-wide text-gray-400">Summary</div>
                              <span class="text-[10px] bg-[var(--bg-secondary)] text-green-600 px-1.5 py-0.5 rounded-full">
                                AI Generated
                              </span>
                            </div>
                            <p class="text-gray-600">{resourceNode.data.result.summary}</p>
                            {#if resourceNode.data.result?.url}
                              <a href={resourceNode.data.result.url} class="mt-1 text-green-600 hover:underline block">View Source</a>
                            {/if}
                          </div>
                        {/if}

                        {#if resourceNode.data.result?.quotes}
                          <div class="mt-2 bg-white border border-gray-200 rounded-lg p-2 text-xs">
                            <div class="flex justify-between items-center mb-1">
                              <div class="uppercase tracking-wide text-gray-400">Extracted Quotes</div>
                              <span class="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">AI Active</span>
                            </div>
                            <p class="text-gray-600 italic">{resourceNode.data.result.quotes[0]} + {resourceNode.data.result.quotes.length - 1} other quotes</p>
                            <button class="mt-1 bg-gray-800 text-white px-2 py-0.5 rounded text-xs hover:bg-black">View All Quotes</button>
                          </div>
                        {/if}
                      </div>
                    </div>
                  {/each}

                  <!-- Find subtasks -->
                  {#if taskNodes.some(t => t.data.parentId === node.id)}
                    <div class="ml-7 mt-2 space-y-2">
                      {#each taskNodes.filter(t => t.data.parentId === node.id) as subtask}
                        <div class="flex items-center justify-between bg-gray-50 p-2 rounded-lg border border-gray-200">
                          <div class="flex items-center">
                            <input type="checkbox" 
                              checked={subtask.data.isComplete} 
                              on:change={() => toggleNodeCompletion(subtask)}
                              class="w-3.5 h-3.5 mr-2 rounded border-gray-300 text-indigo-600">
                            <span class="text-sm text-gray-600">{safeNodeTitle(subtask)}</span>
                          </div>
                          <span class="text-xs text-gray-400">
                            {subtask.data.isComplete ? 'Completed' : getNodeDueDate(subtask) ? `Due ${getNodeDueDate(subtask)}` : 'In Progress'}
                          </span>
                        </div>
                      {/each}
                    </div>
                  {/if}

                  <div class="flex justify-between items-center mt-3 ml-7">
                    <div class="flex space-x-2">
                      <button class="text-xs flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-200">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path>
                        </svg>
                        Add Subtask
                      </button>
                      <button class="text-xs flex items-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all duration-200">
                        <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                        Add Resource
                      </button>
                    </div>
                    <div class="text-xs text-gray-400">Updated {formatTimeAgo(node.updated_at)}</div>
                  </div>
                </div>
              </div>
            {/each}

            <div class="text-center mt-4">
              <button class="text-sm text-[var(--brand-green-light)] hover:text-[var(--brand-green)] transition-all duration-200 font-medium">View all tasks</button>
            </div>
          </div>

          <!-- Upcoming Tasks -->
          <div class="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] p-4 shadow-sm">
            <div class="flex justify-between items-center mb-4">
              <h2 class="font-medium text-[var(--text-primary)]">Upcoming Tasks</h2>
              <button class="text-xs text-gray-500 hover:text-gray-700">View calendar</button>
            </div>
            
            <!-- Group tasks by due date -->
            {#if taskNodes.some(t => getNodeDueDate(t))}
              <!-- Get unique dates -->
              {#each [...new Set(taskNodes.filter(t => getNodeDueDate(t)).map(t => getNodeDueDate(t)))] as date}
                <div class="mb-3">
                  <h3 class="text-sm font-medium text-gray-500 mb-2">{date}</h3>
                  {#each taskNodes.filter(t => getNodeDueDate(t) === date) as task}
                    <div class="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg mb-2">
                      <div class="flex items-center">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 ml-2">
                          {getStatusDisplay(getNodeStatus(task))}
                        </span>
                        <span class="w-2 h-2 rounded-full mr-2"
                              class:bg-red-500={getNodePriority(task) === 'high'}
                              class:bg-yellow-500={getNodePriority(task) === 'medium'}
                              class:bg-green-500={getNodePriority(task) === 'low'}>
                        </span>
                        <span class="text-sm text-gray-700">{safeNodeTitle(task)}</span>
                      </div>
                      <span class="text-xs text-gray-500">{task.data.time || ''}</span>
                    </div>
                  {/each}
                </div>
              {/each}
            {:else}
              <div class="text-center p-4 text-gray-500">No upcoming tasks with due dates</div>
            {/if}
          </div>
        </div>

        <!-- Sidebar -->
        <div class="space-y-5">
          <!-- Projects Section -->
          <div class="rounded-xl border p-4"
               style="background-color: var(--bg-primary); border-color: var(--border-color)">
            <div class="flex justify-between items-center mb-4">
              <h2 class="font-medium" style="color: var(--text-primary)">Projects</h2>
              <button class="text-xs" style="color: var(--text-secondary)">+ New</button>
            </div>
            
            <div class="space-y-2">
              {#each projectNodes as project}
                <div class="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg"
                     style="background-color: var(--bg-secondary)">
                  <div class="flex items-center">
                    <div class="w-3 h-3 bg-[var(--brand-green-light)] rounded-full mr-2"></div>
                    <span class="text-sm text-[var(--text-secondary)]">{safeNodeTitle(project)}</span>
                  </div>
                  <span class="text-xs bg-[var(--bg-accenttwo)] text-green-700 px-2 py-0.5 rounded-full">
                    {project.data.result?.progress || 0}%
                  </span>
                </div>
              {/each}
              
              {#if projectNodes.length === 0}
                <div class="text-center p-2 text-gray-500">No projects available</div>
              {/if}
            </div>
          </div>

          <!-- Resources Section -->
          <div class="bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] p-4 shadow-sm">
            <div class="flex justify-between items-center mb-4">
              <h2 class="font-medium text-[var(--text-primary)]">Recent Resources</h2>
              <button class="text-xs text-gray-500 hover:text-gray-700">View all</button>
            </div>
            <button 
              on:click={() => openResourceEditor(resourceNode.id)}
              class="text-xs text-[var(--brand-green-light)] hover:text-[var(--brand-green)] transition-all duration-200 flex items-center mt-2 mb-2"
            >
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
              </svg>
              Edit Source
            </button>
            
            <div class="space-y-3">
              {#each resourceNodes.slice(0, 3) as resource}
                <div class="border border-[var(--border-color)] rounded-lg p-3 hover:shadow-sm transition">
                  <div class="flex justify-between items-center mb-1">
                    <div class="text-xs uppercase tracking-wide text-gray-400">Resource</div>
                    <span class="text-[10px] bg-transparent text-gray-500 px-1.5 py-0.5 rounded-full">
                      {formatTimeAgo(resource.updated_at)}
                    </span>
                  </div>
                  <h4 class="text-sm font-medium text-[var(--text-secondary)]">{safeNodeTitle(resource)}</h4>
                  {#if resource.data.result?.url}
                    <a href={resource.data.result.url} class="text-xs text-indigo-600 hover:underline mt-1 block">
                      View Source
                    </a>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        </div>
        {#if isEditingResource}
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" 
            transition:fade={{ duration: 150 }}>
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl"
              transition:slide={{ duration: 150 }}>
            <div class="p-6">
              <div class="flex justify-between items-center mb-4">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Edit Resource
                </h3>
                <button on:click={() => isEditingResource = false} class="text-gray-500 hover:text-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div class="mb-4">
                <label for="resourceTitle" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Title
                </label>
                <input 
                  id="resourceTitle"
                  type="text" 
                  bind:value={editableResourceTitle} 
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                />
              </div>
              
              <div class="mb-4">
                <label for="resourceContent" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Content
                </label>
                <textarea 
                  id="resourceContent"
                  bind:value={editableResourceContent} 
                  class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 font-mono h-64 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                ></textarea>
              </div>
              
              <div class="flex justify-end space-x-3">
                <button 
                  on:click={() => isEditingResource = false} 
                  class="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button 
                  on:click={saveResourceEdit} 
                  class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      {/if}
      </main>
    </div>
  {/if}
{/if}
<p>Space ID: {spaceId}</p>





<style>
  .output-container {
    max-width: 800px;
    margin: 2rem auto;
    padding: 2rem;
    border-radius: 8px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    transition: background-color var(--transition-normal), color var(--transition-normal);
  }
  
  .output-header {
    display: flex;
    align-items: center;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid var(--border-color);
    padding-bottom: 1rem;
  }
  
  .output-header h1 {
    margin: 0;
    font-size: 1.8rem;
    flex-grow: 1;
    cursor: pointer;
  }
  
  .edit-title-btn {
    background: none;
    border: none;
    cursor: pointer;
    opacity: 0.6;
    padding: 0.3rem;
    border-radius: 4px;
    transition: opacity 0.2s, background-color 0.2s;
    color: var(--text-secondary);
  }
  
  .edit-title-btn:hover {
    opacity: 1;
    background-color: var(--bg-secondary);
  }
  
  .title-edit-input {
    font-size: 1.8rem;
    padding: 0.3rem 0.5rem;
    border-width: 1px;
    border-radius: 4px;
    width: 100%;
    transition: background-color var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
  }
  
  .output-content {
    position: relative;
  }
  
  .rendered-content {
    min-height: 200px;
    line-height: 1.6;
  }
  
  .rendered-content h2 {
    margin-top: 1.5rem;
    margin-bottom: 1rem;
    font-size: 1.4rem;
    color: var(--text-primary);
  }
  
  .rendered-content h3 {
    margin-top: 1.2rem;
    margin-bottom: 0.8rem;
    font-size: 1.2rem;
    color: var(--text-primary);
  }
  
  .rendered-content p {
    margin-bottom: 1rem;
    color: var(--text-secondary);
  }
  
  .rendered-content ul, .rendered-content ol {
    margin-left: 1.5rem;
    margin-bottom: 1rem;
  }
  
  .edit-content-btn {
    position: absolute;
    bottom: -3rem;
    right: 0;
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background-color var(--transition-normal);
  }
  
  .edit-content-container {
    width: 100%;
  }

  .active-tab {
    background-color: var(--brand-green);
    color: white;
  }
</style>
                    
