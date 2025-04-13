<script lang="ts">
  import { page } from '$app/stores';
  import { siloStore, updateNodePosition, addNode, getNodePosition, renameSilo, deleteSilo, createConnection, type Position } from '$lib/stores/siloStore';
  import Node from "$lib/components/Node.svelte";
  import NodeLibrary from '$lib/components/NodeLibrary.svelte';
  import TaskDump from '$lib/components/TaskDump.svelte';
  import { calculateConnectionPath } from '$lib/utils/nodeUtils';
  import type { SiloNode } from '$lib/stores/siloStore';
  import type { NodeType } from '$lib/types/nodes';
  import { goto } from '$app/navigation';

  // State variables
  let showLibrary = false;
  let showTaskEditor = false;
  let taskEditorText = '';
  let activeNode: SiloNode | null = null;
  let renamingSilo = false;
  let newSiloName = 'My New Silo';
  let connectionStart: { nodeId: string, position: Position, isOutput: boolean } | null = null;
  let tempConnectionPath = '';
  let tempConnectionClass = '';
  let isLoading = false;
  let processingError = '';

  
  // Reactive variables
  $: silo = $siloStore.find(s => s.id === $page.params.id);
  $: if (silo) {
    newSiloName = silo.name;
    taskEditorText = silo.nodes.map(node => node.data.title).join('\n');
  }

  // Create a new silo
  function createNewSilo() {
    const siloId = crypto.randomUUID();
    siloStore.update(store => [...store, {
      id: siloId,
      name: newSiloName,
      nodes: [],
      edges: [],
      isLoading: false
    }]);
    goto(`/silos/${siloId}`);
  }

  // Delete a silo
  function handleDelete(siloId: string, e: MouseEvent) {
    e.preventDefault();
    deleteSilo(siloId);
    goto('/silos');
  }


</script>

<!-- Main container -->
<div class="silos-page">
  <!-- Error message if there is one -->
  {#if processingError}
    <div class="error-message">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
      </svg>
      {processingError}
    </div>
  {/if}

  <!-- Either show the silos grid or the silo editor -->
  {#if !$page.params.id}
    <!-- Silos List View -->
    <div class="header">
      <h1>Project Silos</h1>
      <button on:click={createNewSilo} class="create-button">
        + Create New Silo
      </button>
    </div>

    <div class="silos-grid">
      {#each $siloStore as silo}
        <a href="/silos/{silo.id}" class="silo-card" on:click|preventDefault={() => goto(`/silos/${silo.id}`)}>
          <div class="card-header">
            <h3>{silo.name}</h3>
            <button 
              on:click|stopPropagation={(e) => handleDelete(silo.id, e)}
              class="delete-button"
              aria-label="Delete silo"
            >
              ×
            </button>
          </div>
          <p>{silo.nodes.length} nodes • {silo.edges.length} connections</p>
        </a>
      {/each}
    </div>
  {:else}
    <!-- Silo Editor View -->
    <div class="silo-editor">
      {#if silo}
        <!-- Toolbar -->
        <div class="toolbar">
          <a href="/silos" class="back-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </a>
          
          {#if renamingSilo}
            <input
              bind:value={newSiloName}
              on:keydown={(e) => e.key === 'Enter' && renameSilo(silo.id, newSiloName) && (renamingSilo = false)}
              class="rename-input"
            />
            <button on:click={() => { renameSilo(silo.id, newSiloName); renamingSilo = false; }} class="toolbar-button">
              Save
            </button>
          {:else}
            <h2>{silo.name}</h2>
            <button on:click={() => renamingSilo = true} class="toolbar-button">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Rename
            </button>
          {/if}
        </div>

        <!-- Loading overlay -->
        {#if silo.isLoading}
          <div class="loading-overlay">
            <div class="loading-spinner"></div>
            <p>Processing your tasks...</p>
          </div>
        {/if}

        <!-- Connection lines -->
        <svg class="connections-layer">
          <!-- Existing connections -->
          {#each silo.edges as edge}
            <path
              d={calculateConnectionPath(
                getNodePosition(silo.id, edge.source) ?? { x: 0, y: 0 },
                getNodePosition(silo.id, edge.target) ?? { x: 0, y: 0 }
              )}
              class="connection-line"
            />
          {/each}
          
          <!-- Temporary connection being dragged -->
          {#if tempConnectionPath}
            <path
              d={tempConnectionPath}
              class={tempConnectionClass}
            />
          {/if}
        </svg>

 

        <!-- Add node button -->
        <button
          on:click={() => showLibrary = true}
          class="add-button"
          aria-label="Add node"
        >
          +
        </button>
        
        <!-- Edit tasks button -->
        <div class="floating-edit-panel">
          <button 
            on:click={() => showTaskEditor = !showTaskEditor}
            class="edit-tasks-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            Edit Tasks
          </button>
          
          {#if showTaskEditor}
            <div class="task-editor-panel">
              <h3>Edit Tasks</h3>
              <p class="task-editor-help">Add, modify, or remove tasks. One task per line.</p>
              <textarea bind:value={taskEditorText} placeholder="Add or modify tasks..."></textarea>
              <div class="task-editor-actions">

                <button on:click={() => showTaskEditor = false} class="btn-secondary">Cancel</button>
              </div>
            </div>
          {/if}
        </div>


      {:else}
        <div class="error-message">
          Silo not found! <a href="/silos">Return to silos</a>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .silos-page {
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
    padding: 2rem;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2rem;
  }

  .header h1 {
    font-weight: 500;
    color: var(--text-primary);
    font-size: 1.8rem;
  }

  .create-button {
    background: var(--brand-green);
    color: white;
    border: none;
    padding: 0.6rem 1.2rem;
    border-radius: 6px;
    font-size: 0.9rem;
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .create-button:hover {
    background: var(--brand-green-dark);
    transform: translateY(-1px);
  }

  .silos-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
  }

  .silo-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.2rem;
    text-decoration: none;
    color: var(--text-primary);
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .silo-card:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .card-header h3 {
    font-size: 1.1rem;
    font-weight: 500;
    margin: 0;
  }

  .delete-button {
    background: none;
    border: none;
    color: var(--error);
    font-size: 1.2rem;
    cursor: pointer;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .delete-button:hover {
    background: rgba(244, 67, 54, 0.1);
  }

  /* Silo Editor Styles */
  .silo-editor {
    position: relative;
    height: calc(100vh - 4rem);
    overflow: hidden;
    border-radius: 8px;
    background: var(--bg-primary);
  }

  .toolbar {
    padding: 0.75rem 1.2rem;
    background: var(--bg-secondary);
    display: flex;
    gap: 1rem;
    align-items: center;
    border-bottom: 1px solid var(--border-color);
  }

  .back-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--text-primary);
    text-decoration: none;
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
  }

  .back-button:hover {
    background: var(--neutral-200);
  }

  .toolbar h2 {
    font-size: 1.2rem;
    font-weight: 500;
    margin: 0;
    flex-grow: 1;
  }

  .toolbar-button {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.4rem 0.8rem;
    background: var(--brand-green);
    color: white;
    border-radius: 4px;
    border: none;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 400;
  }

  .toolbar-button.delete {
    background: var(--error);
  }

  .rename-input {
    padding: 0.5rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    flex-grow: 1;
    font-size: 1rem;
  }

  .add-button {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    width: 3rem;
    height: 3rem;
    border-radius: 50%;
    background: var(--brand-green);
    color: white;
    font-size: 1.5rem;
    border: none;
    cursor: pointer;
    box-shadow: var(--shadow-md);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform var(--transition-fast), background var(--transition-fast);
  }

  .add-button:hover {
    transform: scale(1.1);
    background: var(--brand-green-dark);
  }

  .connections-layer {
    position: absolute;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
  }

  .connection-line {
    stroke: var(--brand-green);
    stroke-width: 2;
    fill: none;
    filter: drop-shadow(0 0 2px var(--brand-green-light));
  }

  .dragging-connection {
    stroke-dasharray: 5 3;
    animation: dash 7s linear infinite;
  }

  @keyframes dash {
    to {
      stroke-dashoffset: -100;
    }
  }

  .error-message {
    padding: 1rem;
    margin-bottom: 1rem;
    border-radius: 6px;
    background: #fef2f2;
    color: #b91c1c;
    border: 1px solid #fca5a5;
    display: flex;
    align-items: center;
  }

  .error-message a {
    color: #b91c1c;
    margin-left: 0.5rem;
  }

  /* Task Editor Styles */
  .floating-edit-panel {
    position: fixed;
    bottom: 2rem;
    left: 2rem;
    z-index: 10;
  }
  
  .edit-tasks-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--brand-green);
    color: white;
    border: none;
    border-radius: 4px;
    padding: 0.6rem 1rem;
    font-size: 0.9rem;
    cursor: pointer;
    box-shadow: var(--shadow-md);
    transition: background var(--transition-fast);
  }
  
  .edit-tasks-button:hover {
    background: var(--brand-green-dark);
  }
  
  .task-editor-panel {
    position: absolute;
    bottom: 3.5rem;
    left: 0;
    width: 350px;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 1.2rem;
    box-shadow: var(--shadow-lg);
  }
  
  .task-editor-panel h3 {
    font-size: 1.1rem;
    font-weight: 500;
    margin: 0 0 0.5rem 0;
    color: var(--text-primary);
  }
  
  .task-editor-help {
    font-size: 0.85rem;
    color: var(--text-secondary);
    margin-bottom: 0.8rem;
  }
  
  .task-editor-panel textarea {
    width: 100%;
    height: 180px;
    margin: 0.5rem 0 1rem;
    padding: 0.8rem;
    background: var(--bg-primary);
    color: var(--text-primary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    font-size: 0.9rem;
    line-height: 1.5;
    resize: vertical;
  }
  
  .task-editor-actions {
    display: flex;
    gap: 0.8rem;
    justify-content: flex-end;
  }

  /* Loading Styles */
  .loading-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 100;
    color: white;
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 3px solid rgba(255, 255, 255, 0.3);
    border-top-color: var(--brand-green);
    animation: spin 1s infinite linear;
    margin-bottom: 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
