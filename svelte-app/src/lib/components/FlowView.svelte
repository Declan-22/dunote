<!-- FlowView.svelte -->
<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { siloStore, updateAllConnectionPaths, updateNodePosition, createConnection } from '$lib/stores/siloStore';
  import ConnectionLine from './ConnectionLine.svelte';
  import Node from './Node.svelte';
  import type { SiloNode, SiloEdge, Silo } from '$lib/stores/siloStore';

  export let siloId: string;
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher(); // Add this at the top
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
  let tempConnectionPath = '';
  
  $: silo = $siloStore.find(s => s.id === siloId) || {
    id: siloId,
    nodes: [],
    edges: [],
    name: 'Loading...'
  };

  function handleCreateConnection(event) {
    const { source, target } = event.detail;
    createConnection(source, target, siloId);
  }
  
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
    if (isDrawingConnection && container) {
      const rect = container.getBoundingClientRect();
      connectionEndPosition = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
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
  
  // Store the actual position (not scaled by viewport)
  connectionStartPosition = {
    x: position.x,
    y: position.y
  };
  connectionEndPosition = { ...connectionStartPosition };
}

function handleConnectionEnd(event: CustomEvent) {
  if (!isDrawingConnection || !connectionStartNode) return;
  
  const { nodeId, isOutput } = event.detail;
  
  // Only create connection if source and target are different nodes
  // and source is output and target is input (or vice versa)
  if (nodeId && connectionStartNode !== nodeId) {
    let source, target;
    
    // Determine which node is source and which is target
    if (connectionStartIsOutput && !isOutput) {
      // Starting from output, ending at input (normal case)
      source = connectionStartNode;
      target = nodeId;
    } else if (!connectionStartIsOutput && isOutput) {
      // Starting from input, ending at output (reverse case)
      source = nodeId;
      target = connectionStartNode;
    } else {
      // Can't connect output to output or input to input
      isDrawingConnection = false;
      connectionStartNode = null;
      return;
    }
    
    // Create the actual connection
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
        d={`M ${connectionStartPosition.x} ${connectionStartPosition.y} 
            C ${connectionStartPosition.x + 100} ${connectionStartPosition.y},
            ${connectionEndPosition.x - 100} ${connectionEndPosition.y},
            ${connectionEndPosition.x} ${connectionEndPosition.y}`}
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
        on:createconnection={handleCreateConnection}
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