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
  let viewMode = 'priority';
  let error: Error | null = null;

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
    // Add other node data properties as needed
  };

  $: parsedContent = marked.parse(outputContent || '');
  $: silo = $siloStore.find(s => s.id === siloId);
  $: completedNodes = (silo?.nodes as SiloNode[] | undefined)?.filter(n => n.data.isComplete) || [];
  
  
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

  function safeNodeTitle(node: SiloNode) {
    return node.data?.title || 'Untitled Node';
  }

  function safeNodeResult(node: SiloNode) {
    return node.data?.result || {};
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
    
    // Add summaries from resource nodes
    const resourceNodes = silo.nodes.filter(n => n.type === 'resource' && n.data.result);
    if (resourceNodes.length > 0) {
      content += '## Resources\n\n';
      resourceNodes.forEach(node => {
        content += `### ${node.data.title}\n`;
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
        const status = node.data.result?.new_status || node.data.status || 'not-started';
        const statusEmoji = status === 'completed' ? '✅' : 
                           status === 'in-progress' ? '🔄' : '⏳';
        content += `- ${statusEmoji} **${node.data.title}**: ${status}\n`;
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
        content += `- ${statusEmoji} **${node.data.title}**: ${achieved ? 'Achieved' : 'In Progress'}\n`;
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
          content += `### ${node.data.title}\n`;
          content += `Progress: ${progress}%\n`;
          content += `Tasks completed: ${node.data.result.tasks_completed}/${node.data.result.tasks_total}\n\n`;
        }
      });
    }
    
    outputContent = content;
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
</script>

{#if isLoading}
  <div class="text-center p-8 text-gray-500">Loading output...</div>
{:else if error}
  <div class="error-message p-4 mb-4 bg-red-100 text-red-800 rounded">
    Error: {error.message}
    <button on:click={() => error = null} class="ml-2 px-2 py-1 bg-red-200 hover:bg-red-300 rounded">
      Dismiss
    </button>
  </div>
{:else}
  {#if silo?.nodes.length === 0}
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
          class="text-2xl font-bold text-gray-800 bg-transparent border-b border-gray-300"
          autofocus
        />
      {:else}
        <h1 
          on:click={startEditingTitle}
          class="text-2xl font-bold text-gray-800 cursor-pointer hover:bg-gray-100 px-2 rounded"
        >
          {outputTitle}
        </h1>
      {/if}
    </div>
    <div class="flex items-center space-x-4">
      <span class="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
      <button 
        on:click={startEditing}
        class="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-indigo-700"
      >
        + New Task
      </button>
    </div>
  </div>

  <div class="mt-6 flex items-center justify-between">
    <div class="flex space-x-1">
      <button
        class:active-tab={viewMode === 'all'}
        on:click={() => viewMode = 'all'}
        class="px-3 py-1.5 rounded-lg text-sm font-medium"
      >
        All Tasks
      </button>
      <button
        class:active-tab={viewMode === 'today'}
        on:click={() => viewMode = 'today'}
        class="px-3 py-1.5 rounded-lg text-sm"
      >
        Today
      </button>
      <button
        class:active-tab={viewMode === 'projects'}
        on:click={() => viewMode = 'projects'}
        class="px-3 py-1.5 rounded-lg text-sm"
      >
        Projects
      </button>
    </div>
    <div class="flex items-center space-x-2">
      <span class="text-sm text-gray-500">Filter:</span>
      <select 
        bind:value={selectedFilter}
        class="text-sm border border-gray-300 rounded-md px-2 py-1"
      >
        <option>Priority</option>
        <option>Due Date</option>
        <option>Project</option>
      </select>
    </div>
  </div>
</header>

<div class="rendered-content bg-white p-6 rounded-lg shadow-sm">
  {@html parsedContent}

<!-- Main Content -->
<main class="grid grid-cols-1 md:grid-cols-3 gap-6">
  <!-- Priority Tasks Column -->
  <div class="col-span-2 space-y-5">
    <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div class="flex justify-between items-center mb-4">
        <h2 class="font-medium text-gray-800">Workflow Progress</h2>
        <span class="text-xs bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full">
          {completedNodes.length} of {silo?.nodes.length || 0} complete
        </span>
      </div>

      {#each ((silo?.nodes || []) as SiloNode[]).filter(n => n.type === 'task') as node (node.id)}
      <div class="task-node">
        <h3 class="font-medium text-gray-900">
          {safeNodeTitle(node)}
        </h3>
        <div class="border border-gray-100 rounded-lg p-3 mb-3 hover:shadow-sm transition">
          <div class="flex items-start justify-between">
            <div class="flex items-start space-x-3">
              <div class="mt-0.5">
                <input 
                  type="checkbox" 
                  bind:checked={node.data.isComplete}
                  class="w-4 h-4 rounded border-gray-300 text-indigo-600"
                >
              </div>
              <div>
                <h3 class="font-medium text-gray-900">{node.data.title}</h3>
                <div class="flex items-center mt-1 text-xs text-gray-500 space-x-3">
                  {#if node.data.dueDate}
                    <span class="flex items-center">
                      <svg class="w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.4 0-8-3.6-8-8s3.6-8 8-8 8 3.6 8 8-3.6 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" fill="currentColor"/>
                      </svg>
                      Due {node.data.dueDate}
                    </span>
                  {/if}
                </div>
              </div>
            </div>
            <div>
              <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                {node.data.priority === 'high' ? 'bg-red-100 text-red-800' :
                 node.data.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                 'bg-green-100 text-green-800'}"
              >
                {node.data.priority}
              </span>
            </div>
          </div>
        </div>


          {#if node.type === 'resource' && node.data.result}
            <div class="ml-7 mt-3">
              <div class="bg-gray-50 border border-gray-200 rounded-lg p-2.5 mb-2">
                <div class="flex justify-between items-center mb-1">
                  <div class="text-xs uppercase tracking-wide text-gray-400">Resource</div>
                  <button class="text-xs text-gray-400 hover:text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                    </svg>
                  </button>
                </div>
                <h4 class="text-sm font-medium text-gray-700">{node.data.title}</h4>
                {#if node.data.result.summary}
                  <div class="mt-2 bg-white border border-gray-200 rounded-lg p-2 text-xs">
                    <div class="flex justify-between items-center mb-1">
                      <div class="uppercase tracking-wide text-gray-400">Summary</div>
                      <span class="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded-full">
                        AI Generated
                      </span>
                    </div>
                    <p class="text-gray-600">{node.data.result.summary}</p>
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Sidebar -->
  <div class="space-y-5">
    <!-- Projects Section -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div class="flex justify-between items-center mb-4">
        <h2 class="font-medium text-gray-800">Projects</h2>
      </div>
      <div class="space-y-2">
        {#each ((silo?.nodes || []) as SiloNode[]).filter(n => n.type === 'project') as project (project.id)}
          <div class="flex items-center justify-between p-2 hover:bg-gray-50 rounded-lg">
            <div class="flex items-center">
              <div class="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
              <span class="text-sm text-gray-700">{project.data.title}</span>
            </div>
            <span class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
              {project.data.progress || 0}%
            </span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Resources Section -->
    <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div class="flex justify-between items-center mb-4">
        <h2 class="font-medium text-gray-800">Recent Resources</h2>
      </div>
      <div class="space-y-3">
        {#each ((silo?.nodes || []) as SiloNode[]).filter(n => n.type === 'resource') as resource (resource.id)}
          <div class="border border-gray-200 rounded-lg p-3 hover:shadow-sm transition">
            <div class="flex justify-between items-center mb-1">
              <div class="text-xs uppercase tracking-wide text-gray-400">Resource</div>
              <span class="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                {new Date(resource.updated_at || Date.now()).toLocaleDateString()}
              </span>
            </div>
            <h4 class="text-sm font-medium text-gray-700">{resource.data.title}</h4>
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
</main>
</div>
</div>
{/if}
{/if}


  
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
