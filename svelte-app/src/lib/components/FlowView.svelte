<!-- FlowView.svelte -->
<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { siloStore, updateAllConnectionPaths, updateNodePosition } from '$lib/stores/siloStore';
  import ConnectionLine from './ConnectionLine.svelte';
  import Node from './Node.svelte';
  import type { SiloNode, SiloEdge, Silo } from '$lib/stores/siloStore';

  export let siloId: string;
  
  let container: HTMLElement | null = null;
  let viewport = { x: 0, y: 0, zoom: 1 };
  let isPanning = false;
  let startPan = { x: 0, y: 0 };
  let dragNode: SiloNode | null = null;
  let startNodeDrag: { x: number, y: number } | null = null;
  
  // Connection drawing state
  let isDrawingConnection = false;
  let connectionStartNode: string | null = null;
  let connectionStartIsOutput = false;
  let connectionStartPosition = { x: 0, y: 0 };
  let connectionEndPosition = { x: 0, y: 0 };
  
  $: silo = $siloStore.find(s => s.id === siloId) || {
    id: siloId,
    nodes: [],
    edges: [],
    name: 'Loading...'
  };
  
  // Optimized pan/zoom handlers
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (!container) return; 
    const rect = container.getBoundingClientRect();
    const delta = e.deltaY < 0 ? 1.1 : 0.9;
    
    // Mouse position relative to container
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate new zoom and position
    const newZoom = Math.min(Math.max(0.1, viewport.zoom * delta), 3);
    const newX = viewport.x - ((mouseX - viewport.x) * (delta - 1));
    const newY = viewport.y - ((mouseY - viewport.y) * (delta - 1));
    
    // Update viewport
    viewport = {
      x: newX,
      y: newY,
      zoom: newZoom
    };
    
    // Update connection paths
    updateAllConnectionPaths(siloId);
  }
  

  function startPanning(e: MouseEvent) {
    // Only start panning on middle-mouse or if not over a node (e.target check)
    if (e.button !== 0 || (e.target as HTMLElement).closest('.node')) return;
    isPanning = true;
    startPan = { x: e.clientX - viewport.x, y: e.clientY - viewport.y };
    if (container) {
      container.style.cursor = 'grabbing';
    }
  }

  function doPanning(e: MouseEvent) {
    if (!isPanning) {
      // If drawing a connection, update end position
      if (isDrawingConnection) {
        const rect = container!.getBoundingClientRect();
        connectionEndPosition = {
          x: (e.clientX - rect.left - viewport.x) / viewport.zoom,
          y: (e.clientY - rect.top - viewport.y) / viewport.zoom
        };
      }
      return;
    }
    
    // Update viewport for panning
    viewport = {
      ...viewport,
      x: e.clientX - startPan.x,
      y: e.clientY - startPan.y
    };
  }

  function endPanning() {
    isPanning = false;
    if (container) {
      container.style.cursor = 'default';
    }
  }

  // Node dragging handlers
  function handleNodeDragStart(event: CustomEvent) {
    dragNode = event.detail.node;
    startNodeDrag = { ...dragNode.position };
  }

  function handleNodeDrag(event: CustomEvent) {
    if (!dragNode || !startNodeDrag) return;
    
    const { dx, dy } = event.detail;
    
    // Apply the zoom factor to get correct movement scale
    const dragScale = 1 / viewport.zoom;
    const newPos = {
      x: startNodeDrag.x + dx * dragScale,
      y: startNodeDrag.y + dy * dragScale
    };
    
    updateNodePosition(siloId, dragNode.id, newPos);
    
    // When a node moves, update all its connections
    updateAllConnectionPaths(siloId);
  }

  function handleNodeDragEnd() {
    dragNode = null;
    startNodeDrag = null;
  }

  // Connection drawing handlers
  function handleConnectionStart(event: CustomEvent) {
    const { nodeId, position, isOutput } = event.detail;
    isDrawingConnection = true;
    connectionStartNode = nodeId;
    connectionStartIsOutput = isOutput;
    connectionStartPosition = {
      x: (position.x - viewport.x) / viewport.zoom,
      y: (position.y - viewport.y) / viewport.zoom
    };
    connectionEndPosition = { ...connectionStartPosition };
  }

  function handleConnectionEnd(event: CustomEvent) {
    if (!isDrawingConnection) return;
    
    const { nodeId, isOutput } = event.detail;
    
    // Only create connection if source is output and target is input
    if (connectionStartNode && 
        connectionStartNode !== nodeId && 
        connectionStartIsOutput !== isOutput) {
      
      // Create new connection
      const source = connectionStartIsOutput ? connectionStartNode : nodeId;
      const target = connectionStartIsOutput ? nodeId : connectionStartNode;
      
      dispatch('createconnection', { source, target });
    }
    
    // Reset connection drawing state
    isDrawingConnection = false;
    connectionStartNode = null;
  }

  onMount(() => {
    // Initial setup
    updateAllConnectionPaths(siloId);
  });
</script>

<div class="flow-container" bind:this={container} role="application"
  tabindex="0"
  on:mousedown={startPanning}
  on:mousemove={doPanning}
  on:mouseup={endPanning}
  on:mouseleave={endPanning}
  on:wheel={handleWheel}
>
  <!-- SVG layer for connections -->
  <svg class="connections-layer" width="100%" height="100%">
    <!-- Existing connections -->
    {#each silo.edges as edge (edge.id)}
      <ConnectionLine {edge} {viewport}/>
    {/each}
    
    <!-- Drawing connection if active -->
    {#if isDrawingConnection}
      <path 
        class="connection-drawing"
        d={`M ${connectionStartPosition.x * viewport.zoom + viewport.x} 
              ${connectionStartPosition.y * viewport.zoom + viewport.y} 
            C ${connectionStartPosition.x * viewport.zoom + viewport.x + 50} 
              ${connectionStartPosition.y * viewport.zoom + viewport.y},
              ${connectionEndPosition.x * viewport.zoom + viewport.x - 50} 
              ${connectionEndPosition.y * viewport.zoom + viewport.y},
              ${connectionEndPosition.x * viewport.zoom + viewport.x} 
              ${connectionEndPosition.y * viewport.zoom + viewport.y}`}
        stroke="#888" 
        stroke-width="2" 
        stroke-dasharray="5,5"
        fill="none"
      />
    {/if}
  </svg>
  
  <!-- HTML layer for nodes -->
  <div class="nodes-layer" style="transform: translate({viewport.x}px, {viewport.y}px) scale({viewport.zoom});">
    {#each silo.nodes as node (node.id)}
      <Node 
        {node}
        {siloId}
        {viewport}
        scale={viewport.zoom}
        on:dragstart={handleNodeDragStart}
        on:drag={handleNodeDrag}
        on:dragend={handleNodeDragEnd}
        on:connectionstart={handleConnectionStart}
        on:connectionend={handleConnectionEnd}
      />
    {/each}
  </div>
</div>

<style>
  .flow-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: var(--bg-primary)
  }

  .connections-layer {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1;
  }

  .nodes-layer {
    position: absolute;
    top: 0;
    left: 0;
    transform-origin: 0 0;
    z-index: 2;
  }
  
  .connection-drawing {
    pointer-events: none;
  }
</style>