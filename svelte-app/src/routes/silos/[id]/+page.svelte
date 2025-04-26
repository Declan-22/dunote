<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import { siloStore, updateNodePosition, getNodePosition, renameSilo, deleteSilo, createConnection, executeWorkflow, type Position } from '$lib/stores/siloStore';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/userStore';
  
  
  // Components
  import FlowView from '$lib/components/FlowView.svelte';
  import Output from '$lib/components/Output.svelte';
  import NotesList from '$lib/components/NotesList.svelte';
  import TriggerNode from '$lib/components/TriggerNode.svelte';
  import NodeLibrary from '$lib/components/NodeLibrary.svelte';
  import CalendarHeatmap from '$lib/components/CalendarHeatmap.svelte';
  import WorkspaceView from '$lib/components/WorkspaceView.svelte';
  import Timeline from '$lib/components/Timeline.svelte';
  import type { SiloNode } from '$lib/stores/siloStore';
  import type { NodeType } from '$lib/types/nodes';
  
  // Type definitions
  type ViewMode = 'flow' | 'output' | 'space' | 'calendar' | 'timeline';
  
  // State variables
  let currentView: ViewMode = 'flow';
  let showLibrary = false;
  let showTaskEditor = false;
  let taskEditorText = '';
  let renamingSilo = false;
  let newSiloName = '';
  let siloId = $page.params.id;
  let spaceData: any = null;
  let isLoading = false;
  let processingError = '';
  let activeNode: SiloNode | null = null;
  let connectionStart: { nodeId: string, position: Position, isOutput: boolean } | null = null;
  let tempConnectionPath = '';
  let tempConnectionClass = '';
  
  // Reactive variables
  $: silo = $siloStore.find(s => s.id === siloId);
  $: if (silo) newSiloName = silo.name;
  
  onMount(async () => {
    // Load data based on the URL
    if (siloId && $user) {
      // Determine the initial view based on the URL path
      if ($page.url.pathname.includes('/output')) {
        currentView = 'output';
      } else if ($page.url.pathname.includes('/spaces')) {
        currentView = 'space';
        // The component now handles its own data loading
      } else if ($page.url.pathname.includes('/calendar')) {
        currentView = 'calendar';
      } else if ($page.url.pathname.includes('/timeline')) {
        currentView = 'timeline';
      }
    }
  });
  
  async function loadSpaceData(id: string) {
    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('id', id)
      .single();
      
    if (!error && data) {
      spaceData = data;
      newSiloName = data.name;
    }
  }
  
  function handleFlowStart() {
    if (!silo) return;
    
    // Execute the workflow
    executeWorkflow(silo.id);
    
    // Add animation for trigger node
    const triggerButton = document.querySelector('.trigger-button');
    if (triggerButton) {
      triggerButton.classList.add('running');
      setTimeout(() => {
        triggerButton.classList.remove('running');
      }, 2000);
    }
  }
  
  function setViewMode(mode: ViewMode) {
    currentView = mode;
    // Update URL without full page reload
    const baseUrl = `/silos/${siloId}`;
    const url = mode === 'flow' ? baseUrl : 
                mode === 'output' ? `${baseUrl}/output` :
                mode === 'space' ? `/spaces/${siloId}` :
                mode === 'timeline' ? `${baseUrl}/timeline` :
                `${baseUrl}/calendar`;
                
    history.pushState(null, '', url);
  }

  // Add a node from the library
  async function handleAddNode(event: CustomEvent<NodeType>) {
    const type = event.detail;
    if (!silo) return;
    await addNode(silo.id, type, { x: 100, y: 100 });
    showLibrary = false;
  }

  async function addNode(siloId: string, type: string, position: Position) {
    try {
      if (!$user) throw new Error("User not logged in");
      
      const { data, error } = await supabase
        .from('nodes')
        .insert({
          title: `Untitled ${type.charAt(0).toUpperCase() + type.slice(1)} Node`,
          type: type,
          position: position,
          silo_id: siloId,
          user_id: $user.id
        })
        .select()
        .single();

      if (error) throw error;

      siloStore.update(store => 
        store.map(silo => 
          silo.id === siloId 
            ? { ...silo, nodes: [...silo.nodes, data] } 
            : silo
        )
      );
      
      return data;
    } catch (err) {
      console.error("Node creation failed:", err);
      return null;
    }
  }

  // Connection handling for temporary connections during dragging
  function handleConnectionStart(event: CustomEvent<{ nodeId: string, position: Position, isOutput: boolean }>) {
    connectionStart = event.detail;
    document.addEventListener('mousemove', handleConnectionDrag);
    document.addEventListener('mouseup', handleConnectionDragEnd);
  }

  function handleConnectionDrag(e: MouseEvent) {
    if (!connectionStart) return;
    
    // Update temporary connection line
    const mousePos = { x: e.clientX, y: e.clientY };
    tempConnectionPath = calculateConnectionPath(
      connectionStart.position,
      mousePos
    );
    tempConnectionClass = "connection-line dragging-connection";
  }

  function handleConnectionDragEnd() {
    document.removeEventListener('mousemove', handleConnectionDrag);
    document.removeEventListener('mouseup', handleConnectionDragEnd);
    tempConnectionPath = '';
  }

  function handleConnectionEnd(event: CustomEvent<{ nodeId: string, position: Position, isOutput: boolean }>) {
    if (!connectionStart || !silo) return;
    
    // Only connect from outputs to inputs
    if (connectionStart.isOutput && !event.detail.isOutput) {
      createConnection(connectionStart.nodeId, event.detail.nodeId, silo.id);
    } else if (!connectionStart.isOutput && event.detail.isOutput) {
      createConnection(event.detail.nodeId, connectionStart.nodeId, silo.id);
    }
    
    connectionStart = null;
    tempConnectionPath = '';
  }

  // Process tasks from task editor
  async function handleUpdateTasks() {
    if (!silo) return;
    isLoading = true;
    processingError = '';
    
    try {
      const tasks = taskEditorText.split('\n').filter(t => t.trim());
      
      if (tasks.length === 0) {
        throw new Error("Please enter at least one task");
      }
      
      // Show loading state
      siloStore.update(store => {
        return store.map(s => s.id === silo.id 
          ? {...s, isLoading: true}
          : s
        );
      });

      const response = await fetch('/api/tasks/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks, siloId: silo.id })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Processing failed');
      }

      // Update the current silo with new nodes/edges
      if (data.nodes && data.edges) {
        // Create nodes from the response
        const actualNodes = data.nodes.slice(1);
        
        const nodeData = actualNodes.map((nodeRow: any, index: number) => {
          const taskId = nodeRow[0];
          
          return {
            id: `node-${index}-${Date.now()}`,
            type: 'task' as NodeType,
            position: { x: index * 300, y: 100 + (index % 3) * 100 },
            siloId: silo.id,
            data: { 
              title: typeof taskId === 'string' ? taskId.substring(0, 50) : `Task ${index}`,
              description: "",
              status: 'not-started'
            },
            portPositions: undefined,
            validation: {
              isValid: true,
              missingConnections: []
            }
          };
        });
        
        // Create edges between the nodes
        const edgeData = data.edges.flatMap((edge: string, index: number) => {
          const sourceNode = nodeData.find((n: any) => n.data.title.includes(edge));
          
          if (!sourceNode) return [];
          
          return nodeData
            .filter((n: any) => n.id !== sourceNode.id)
            .map((targetNode: any, edgeIndex: number) => ({
              id: `edge-${index}-${edgeIndex}-${Date.now()}`,
              source: sourceNode.id,
              target: targetNode.id,
              siloId: silo.id,
              pathType: 'bezier',
              pathData: null // Will be calculated by ConnectionLine
            }));
        });
        
        // Update the store
        siloStore.update(store => {
          return store.map(s => {
            if (s.id === silo.id) {
              return {
                ...s,
                nodes: [...nodeData],
                edges: [...edgeData],
                isLoading: false
              };
            }
            return s;
          });
        });
      }
      
      showTaskEditor = false;
    } catch (err) {
      processingError = err instanceof Error ? err.message : 'Unknown error';
      
      // Reset loading state in case of error
      siloStore.update(store => {
        return store.map(s => s.id === silo.id 
          ? {...s, isLoading: false}
          : s
        );
      });
    } finally {
      isLoading = false;
    }
  }

  // Utility function (needed for temp connections)
  function calculateConnectionPath(startPos: Position, endPos: Position): string {
    const deltaX = endPos.x - startPos.x;
    const offset = Math.abs(deltaX) / 2;
    
    return `M ${startPos.x} ${startPos.y} C ${startPos.x + offset} ${startPos.y}, ${endPos.x - offset} ${endPos.y}, ${endPos.x} ${endPos.y}`;
  }
</script>

<div class="unified-container bg-[var(--bg-primary)] text-[var(--text-primary)] h-screen flex flex-col overflow-hidden">
  <!-- Header with Navigation Tabs -->
  <header class="rounded-lg shadow-md mx-4 my-3 bg-[var(--bg-secondary)] border-[var(--border-color)]">
    {#if silo}
      <div class="p-4">
        <!-- Project Name and Controls -->
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <a href="/silos" class="text-[var(--text-primary)] hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </a>
            
            {#if renamingSilo}
              <div class="flex items-center gap-2">
                <input
                  bind:value={newSiloName}
                  on:keydown={(e) => e.key === 'Enter' && renameSilo(silo.id, newSiloName) && (renamingSilo = false)}
                  class="bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter name"
                  autofocus
                />
                <button 
                  on:click={() => { renameSilo(silo.id, newSiloName); renamingSilo = false; }} 
                  class="bg-[var(--brand-green)] hover:bg-[var(--brand-dark)] text-[var(--text-primary)] px-3 py-2 rounded-md text-sm font-medium transition-colors">
                  Save
                </button>
              </div>
            {:else}
              <div class="flex items-center gap-2">
                <h1 class="text-xl font-semibold text-[var(--text-primary)]">{silo.name}</h1>
                <button 
                  on:click={() => renamingSilo = true} 
                  class="text-[var(--text-primary)] hover:text-[var(--bg-primary)] dark:text-[var(--text-primary)] dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
              </div>
            {/if}
          </div>
          
          <!-- Run and Action Buttons -->
          <div class="flex items-center gap-3">
            <button 
              on:click={handleFlowStart} 
              class="bg-[var(--brand-green)] text-white px-4 py-2 rounded-md font-medium shadow-sm flex items-center gap-2 transition-all transform hover:scale-105">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              <span class="sm:inline hidden">Run Flow</span>
            </button>
            
            <button 
              on:click={() => showTaskEditor = !showTaskEditor} 
              class="bg-[var(--bg-accenttwo)] transition-all transform hover:scale-105 text-[var(--text-primary)] border border-[var(--border-color)] px-3 py-2 rounded-md flex items-center gap-2 ">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span class="sm:inline hidden">Edit Tasks</span>
            </button>
          </div>
        </div>
        
        <!-- View Tabs -->
        <div class="flex space-x-1 sm:space-x-2 border-b border-[var(--bg-primary)]">
          <button 
            class="tab-button flex items-center gap-2 px-4 py-3 font-medium rounded-t-lg transition-colors {currentView === 'flow' ? 'text-green-600 dark:text-green-600 border-b-2 border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-900/10' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30'}" 
            on:click={() => setViewMode('flow')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            <span class="sm:inline hidden">Flow Editor</span>
          </button>
          <button 
            class="tab-button flex items-center gap-2 px-4 py-3 font-medium rounded-t-lg transition-colors {currentView === 'output' ? 'text-green-600 dark:text-green-600 border-b-2 border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-900/10' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30'}" 
            on:click={() => setViewMode('output')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
            </svg>
            <span class="sm:inline hidden">Output</span>
          </button>
          <button 
            class="tab-button flex items-center gap-2 px-4 py-3 font-medium rounded-t-lg transition-colors {currentView === 'space' ? 'text-green-600 dark:text-green-600 border-b-2 border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-900/10' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30'}" 
            on:click={() => setViewMode('space')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <span class="sm:inline hidden">Workspace</span>
          </button>
          <button 
            class="tab-button flex items-center gap-2 px-4 py-3 font-medium rounded-t-lg transition-colors {currentView === 'timeline' ? 'text-green-600 dark:text-green-600 border-b-2 border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-900/10' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30'}" 
            on:click={() => setViewMode('timeline')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="20" x2="12" y2="10"></line>
              <line x1="18" y1="20" x2="18" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="16"></line>
            </svg>
            <span class="sm:inline hidden">Timeline</span>
          </button>
          <button 
            class="tab-button flex items-center gap-2 px-4 py-3 font-medium rounded-t-lg transition-colors {currentView === 'calendar' ? 'text-green-600 dark:text-green-600 border-b-2 border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-900/10' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/30'}" 
            on:click={() => setViewMode('calendar')}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
            <span class="sm:inline hidden">Calendar</span>
          </button>
        </div>
      </div>
    {/if}
  </header>
  
  <!-- Main Content Area -->
  <main class="flex-1 overflow-hidden relative">
    {#if silo}
      <!-- Loading overlay -->
      {#if silo.isLoading}
        <div class="loading-overlay bg-[var(--bg-primary)] bg-opacity-80">
          <div class="loading-spinner border-t-[var(--brand-green)]"></div>
          <p class="text-[var(--text-primary)]">Processing your tasks...</p>
        </div>
      {/if}
    
      {#if currentView === 'flow'}
        <div class="h-full" in:fade={{ duration: 150 }}>
          <FlowView 
            siloId={siloId} 
            on:connectionstart={handleConnectionStart}
            on:connectionend={handleConnectionEnd}
          />
          
          <!-- Temporary connection being dragged -->
          {#if tempConnectionPath}
            <svg class="temp-connections-layer">
              <path
                d={tempConnectionPath}
                class={tempConnectionClass}
              />
            </svg>
          {/if}
          
          <!-- Add Node Button -->
          <button
            on:click={() => showLibrary = true}
            class="add-button bg-[var(--brand-green)] hover:bg-[var(--brand-green-dark)] text-white fixed bottom-6 right-6 w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg"
            aria-label="Add node"
          >
            +
          </button>
        </div>

      {:else if currentView === 'space'}
      <div class="h-full" in:fade={{ duration: 150 }}>
        <WorkspaceView {siloId} />
      </div>
      {:else if currentView === 'output'}
        <div class="h-full p-6 overflow-auto" in:fade={{ duration: 150 }}>
          <Output siloId={siloId} />
        </div>

        {:else if currentView === 'calendar'}
        <div class="h-full p-6 overflow-auto" in:fade={{ duration: 150 }}>
          <div class="bg-[var(--bg-secondary)] rounded-xl shadow-md p-6">
            <h2 class="text-xl font-semibold text-[var(--text-primary)] mb-4">Activity Calendar</h2>
            <CalendarHeatmap siloId={siloId} />
          </div>
        </div>
      
      <!-- Add Timeline View Here -->
      {:else if currentView === 'timeline'}
        <div class="h-full p-6 overflow-auto" in:fade={{ duration: 150 }}>
          <div class="bg-[var(--bg-secondary)] rounded-xl shadow-md p-6">
            <h2 class="text-xl font-semibold text-[var(--text-primary)] mb-4">Project Timeline</h2>
            <Timeline {siloId} />
          </div>
        </div>
      {/if}
      
      <!-- Task Editor Panel -->
      {#if showTaskEditor}
        <div class="task-editor-overlay fixed inset-0 bg-transparent bg-opacity-40 flex items-center justify-center z-50" in:fade={{ duration: 150 }}>
          <div class="task-editor-panel bg-[var(--bg-secondary)] rounded-xl shadow-lg w-full max-w-2xl m-4 p-6" in:slide={{ duration: 200 }}>
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-xl font-semibold text-[var(--text-primary)]">Edit Tasks</h3>
              <button 
                on:click={() => showTaskEditor = false} 
                class="text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <p class="task-editor-help text-[var(--text-secondary)] mb-3">Add, modify, or remove tasks. One task per line.</p>
            <textarea 
              bind:value={taskEditorText} 
              placeholder="Add or modify tasks..." 
              class="bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] p-3 rounded w-full h-48 mb-4"
            ></textarea>
            {#if processingError}
              <p class="text-[var(--error)] text-sm mb-2">{processingError}</p>
            {/if}
            <div class="flex justify-end gap-3">
              <button 
                on:click={() => showTaskEditor = false} 
                class="btn-secondary bg-[var(--bg-primary)] text-[var(--text-secondary)] border border-[var(--border-color)] px-4 py-2 rounded hover:bg-opacity-80"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button 
                on:click={handleUpdateTasks} 
                class="btn-primary bg-[var(--brand-green)] hover:bg-[var(--brand-green-dark)] text-white px-4 py-2 rounded"
                disabled={isLoading}
              >
                {isLoading ? 'Processing...' : 'Update Tasks'}
              </button>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Node Library modal -->
      {#if showLibrary}
        <NodeLibrary show={showLibrary} on:add={handleAddNode} on:close={() => showLibrary = false} />
      {/if}
    {:else}
      <div class="flex items-center justify-center h-full">
        <div class="text-center py-12">
          <h2 class="text-xl font-medium text-[var(--text-secondary)]">Project not found</h2>
          <p class="mt-2">This project doesn't exist or you don't have access to it.</p>
          <a href="/silos" class="text-[var(--brand-green)] hover:text-[var(--brand-green-light)] mt-4 inline-block">Return to Projects</a>
        </div>
      </div>
    {/if}
  </main>
</div>

<style>
  .silo-editor {
      position: relative;
      width: 100%;
      height: 100vh;
      overflow: hidden;
      transition: background-color var(--transition-normal), color var(--transition-normal);
  }
  
  .toolbar {
      display: flex;
      align-items: center;
      padding: 0.5rem 1rem;
      transition: background-color var(--transition-normal), border-color var(--transition-normal);
      z-index: 10;
  }
  
  .back-button {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      text-decoration: none;
      font-size: 0.9rem;
      padding: 0.3rem 0.5rem;
      border-radius: 0.25rem;
      transition: background-color var(--transition-normal);
  }
  
  h2 {
      margin: 0 1rem;
      font-size: 1.2rem;
      font-weight: 600;
      flex-grow: 1;
  }
  
  .rename-input {
      margin: 0 1rem;
      padding: 0.3rem 0.5rem;
      font-size: 1.2rem;
      border-width: 1px;
      border-radius: 0.25rem;
      flex-grow: 1;
      transition: background-color var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
  }
  
  .toolbar-button {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      padding: 0.3rem 0.6rem;
      border: none;
      border-radius: 0.25rem;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background-color var(--transition-normal), color var(--transition-normal);
  }
  
  .temp-connections-layer {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 10;
  }
  
  .connection-line {
      fill: none;
      stroke: var(--text-secondary);
      stroke-width: 2;
  }
  
  .dragging-connection {
      stroke-dasharray: 5 3;
  }
  
  .add-button {
      position: absolute;
      bottom: 2rem;
      right: 2rem;
      width: 3rem;
      height: 3rem;
      border-radius: 50%;
      border: none;
      font-size: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--shadow-md);
      cursor: pointer;
      z-index: 100;
      transition: transform var(--transition-fast), background-color var(--transition-normal);
  }
  
  .add-button:hover {
      transform: scale(1.1);
  }
  
  .floating-edit-panel {
      position: absolute;
      bottom: 2rem;
      left: 2rem;
      z-index: 100;
  }
  
  .edit-tasks-button {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 0.25rem;
      cursor: pointer;
      font-size: 0.9rem;
      box-shadow: var(--shadow-sm);
      transition: background-color var(--transition-normal);
  }
  
  .task-editor-panel {
      position: absolute;
      bottom: 3.5rem;
      left: 0;
      width: 320px;
      border-radius: 0.5rem;
      padding: 1rem;
      transition: background-color var(--transition-normal), border-color var(--transition-normal);
  }
  
  .task-editor-panel h3 {
      margin-top: 0;
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
  }
  
  .task-editor-help {
      font-size: 0.85rem;
      margin-bottom: 0.5rem;
  }
  
  .task-editor-panel textarea {
      width: 100%;
      height: 150px;
      padding: 0.5rem;
      border-width: 1px;
      border-radius: 0.25rem;
      resize: vertical;
      font-family: inherit;
      margin-bottom: 0.5rem;
      transition: background-color var(--transition-normal), color var(--transition-normal), border-color var(--transition-normal);
  }
  
  .task-editor-actions {
      display: flex;
      gap: 0.5rem;
  }
  
  .btn-primary {
      padding: 0.4rem 0.8rem;
      border: none;
      border-radius: 0.25rem;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background-color var(--transition-normal);
  }
  
  .btn-secondary {
      padding: 0.4rem 0.8rem;
      border-width: 1px;
      border-radius: 0.25rem;
      cursor: pointer;
      font-size: 0.9rem;
      transition: background-color var(--transition-normal), color var(--transition-normal);
  }
  
  .error-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-size: 1.1rem;
  }
  
  .error-message a {
      margin-top: 1rem;
      text-decoration: none;
      transition: color var(--transition-normal);
  }
  
  .loading-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      transition: background-color var(--transition-normal);
  }
  
  .loading-spinner {
    display: inline-block;
    animation: wave 1.2s ease-in-out infinite;
    animation-delay: calc(0.1s * var(--i));
  }
  
  @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
  }
</style>