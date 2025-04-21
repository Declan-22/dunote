<script lang="ts">
  import { calculateConnectionPath } from '$lib/utils/nodeUtils';
  import { getNodePosition, siloStore } from '$lib/stores/siloStore';
  import type { SiloNode, SiloEdge, } from '$lib/stores/siloStore';

  // Define props with proper types
  export let activeSiloId: string;
  export let nodes: SiloNode[] = [];
  export let edges: SiloEdge[] = [];
  export let siloId;
  // Track loading state locally since it's not in Silo type
  let isLoading = false;
  $: currentSilo = $siloStore.find(s => s.id === siloId);
  $: edges = currentSilo ? currentSilo.edges : [];
  function getNodePos(nodeId: string) {
      return getNodePosition(activeSiloId, nodeId) ?? { x: 0, y: 0 };
  }

  // React to store changes
  $: {
      const activeSilo = $siloStore.find(s => s.id === activeSiloId);
      if (activeSilo) {
          nodes = activeSilo.nodes.map(node => ({
              ...node,
              // Ensure required fields exist
              x: node.position?.x ?? 0,
              y: node.position?.y ?? 0,
              status: node.data?.status ?? 'not-started',
              icon: node.data?.icon
          }));
          edges = activeSilo.edges;
          isLoading = $siloStore.find(s => s.id === activeSiloId)?.isLoading ?? false;
      }
  }
</script>
{#each edges as edge (edge.id)}
  <path
    d={calculateConnectionPath(
      getNodePos(edge.source),
      getNodePos(edge.target)
    )}
    class="connection-line"
  />
{/each}
{#if isLoading}
  <div class="loading-overlay">
      <svg class="animate-spin h-8 w-8 text-brand-green" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke="currentColor" fill="none" stroke-width="4"/>
      </svg>
      Building your plan...
  </div>
{:else}
  <div class="dependency-graph">
      <svg class="connections-layer">
          {#each edges as edge (edge.id)}
              <path
                  d={calculateConnectionPath(
                      getNodePos(edge.source),
                      getNodePos(edge.target)
                  )}
                  class="connection-line"
              />
          {/each}
      </svg>
      
      {#each nodes as node (node.id)}
          <div 
              class="task-node" 
              style="left: {node.position?.x ?? 0}px; top: {node.position?.y ?? 0}px"
          >
              <div class="node-header {node.data?.status ?? 'not-started'}">
                  {#if node.data?.icon}
                      <div class="node-icon">{node.data.icon}</div>
                  {/if}
                  <span>{node.data?.title ?? 'Untitled'}</span>
              </div>
          </div>
      {/each}
  </div>
{/if}

<style>
  .dependency-graph {
      position: relative;
      height: 100%;
      background: var(--bg-primary);
  }

  .connections-layer {
      position: absolute;
      width: 100%;
      height: 100%;
      pointer-events: none;
  }

  .connection-line {
      stroke: var(--border-color);
      stroke-width: 2px;
      fill: none;
  }

  .task-node {
      position: absolute;
      width: 240px;
      background: var(--bg-secondary);
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 1rem;
      transition: all 0.2s ease;
  }

  .node-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      border-radius: 4px;
  }

  .node-header.not-started {
      background: var(--brand-green);
  }

  .node-header.in-progress {
      background: var(--accent-blue);
  }

  .node-header.completed {
      background: var(--neutral-500);
  }

  .loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      z-index: 1000;
  }
</style>

