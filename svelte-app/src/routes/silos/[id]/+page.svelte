<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { siloStore, updateNodePosition, getNodePosition, renameSilo, deleteSilo, createConnection, type Position } from '$lib/stores/siloStore';
  import NodeLibrary from '$lib/components/NodeLibrary.svelte';
  import TriggerNode from '$lib/components/TriggerNode.svelte';
  import FlowView from '$lib/components/FlowView.svelte';
  import TaskDump from '$lib/components/TaskDump.svelte';
  import type { SiloNode } from '$lib/stores/siloStore';
  import type { NodeType } from '$lib/types/nodes';
  import { supabase } from '$lib/supabaseClient'; // Import your Supabase client
  import { user } from '$lib/stores/userStore';

  // State variables
  let showLibrary = false;
  let showTaskEditor = false;
  let taskEditorText = '';
  let activeNode: SiloNode | null = null;
  let renamingSilo = false;
  let newSiloName = 'My NFew Trip';
  let connectionStart: { nodeId: string, position: Position, isOutput: boolean } | null = null;
  let tempConnectionPath = '';
  let tempConnectionClass = '';
  let isLoading = false;
  let processingError = '';

  $: silo = $siloStore.find(s => s.id === $page.params.id);
  $: if (silo) newSiloName = silo.name;

  // Add a node from the library
  function handleAddNode(event: CustomEvent<NodeType>) {
      const type = event.detail;
      if (!silo) return;
      addNode(silo.id, type, { x: 100, y: 100 });
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

  function handleFlowStart() {
    // Start node execution logic
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

<div class="silo-editor bg-[var(--bg-primary)] text-[var(--text-primary)]">
  {#if silo}
      <!-- Toolbar -->
      <div class="toolbar bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
          <a href="/silos" class="back-button text-[var(--text-secondary)] hover:bg-opacity-10 hover:bg-[var(--text-primary)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back
          </a>
          
          {#if renamingSilo}
              <input
                  bind:value={newSiloName}
                  on:keydown={(e) => e.key === 'Enter' && renameSilo(silo.id, newSiloName) && (renamingSilo = false)}
                  class="rename-input bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--border-color)]"
              />
              <button on:click={() => { renameSilo(silo.id, newSiloName); renamingSilo = false; }} 
                  class="toolbar-button bg-[var(--brand-green)] text-[var(--light-text)] hover:bg-[var(--brand-green-dark)]">
                  Save
              </button>
          {:else}
              <h2 class="text-[var(--text-primary)]">{silo.name}</h2>
              <button on:click={() => renamingSilo = true} 
                  class="toolbar-button bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:bg-opacity-80">
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
          <div class="loading-overlay bg-[var(--bg-primary)] bg-opacity-80">
              <div class="loading-spinner border-t-[var(--brand-green)]"></div>
              <p class="text-[var(--text-primary)]">Processing your tasks...</p>
          </div>
      {/if}

      <!-- FlowView component for nodes and connections -->
      <FlowView 
          siloId={silo.id} 
          on:connectionstart={handleConnectionStart}
          on:connectionend={handleConnectionEnd}
      />

      <!-- Temporary connection being dragged (outside FlowView for z-index purposes) -->
      {#if tempConnectionPath}
          <svg class="temp-connections-layer">
              <path
                  d={tempConnectionPath}
                  class={tempConnectionClass}
              />
          </svg>
      {/if}
      <div class="trigger-container">
        <TriggerNode on:triggerFlow={handleFlowStart} />
      </div>
      <!-- Add node button -->
      <button
          on:click={() => showLibrary = true}
          class="add-button bg-[var(--brand-green)] hover:bg-[var(--brand-green-dark)] text-white"
          aria-label="Add node"
      >
          +
      </button>
      
      <!-- Edit tasks button -->
      <div class="floating-edit-panel">
          <button 
              on:click={() => showTaskEditor = !showTaskEditor}
              class="edit-tasks-button bg-[var(--brand-green)] hover:bg-[var(--brand-green-dark)] text-white"
          >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              Edit Tasks
          </button>
          
          {#if showTaskEditor}
              <div class="task-editor-panel bg-[var(--bg-secondary)] border border-[var(--border-color)] shadow-md">
                  <h3 class="text-[var(--text-primary)]">Edit Tasks</h3>
                  <p class="task-editor-help text-[var(--text-secondary)]">Add, modify, or remove tasks. One task per line.</p>
                  <textarea 
                      bind:value={taskEditorText} 
                      placeholder="Add or modify tasks..." 
                      class="bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--border-color)]"
                  ></textarea>
                  {#if processingError}
                      <p class="text-[var(--error)] text-sm mb-2">{processingError}</p>
                  {/if}
                  <div class="task-editor-actions">
                      <button 
                          on:click={handleUpdateTasks} 
                          class="btn-primary bg-[var(--brand-green)] hover:bg-[var(--brand-green-dark)] text-white disabled:opacity-50" 
                          disabled={isLoading}
                      >
                          {isLoading ? 'Processing...' : 'Update Tasks'}
                      </button>
                      <button 
                          on:click={() => showTaskEditor = false} 
                          class="btn-secondary bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-color)] hover:bg-opacity-80" 
                          disabled={isLoading}
                      >
                          Cancel
                      </button>
                  </div>
              </div>
          {/if}
      </div>

      <!-- Node Library modal -->
      <NodeLibrary show={showLibrary} on:add={handleAddNode} on:close={() => showLibrary = false} />
  {:else}
      <div class="error-message text-[var(--error)]">
          Silo not found! <a href="/silos" class="text-[var(--brand-green)] hover:text-[var(--brand-green-light)]">Return to silos</a>
      </div>
  {/if}
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