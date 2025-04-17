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
  let currentHoverNodeId: string | null = null;
  let currentHoverIsOutput: boolean | null = null;
  
  $: silo = $siloStore.find(s => s.id === siloId) || {
    id: siloId,
    nodes: [],
    edges: [],
    name: 'Loading...'
  };

  function handleCreateConnection(event: CustomEvent<{ source: string; target: string }>) {
  const { source, target } = event.detail;
  createConnection(siloId, source, target);
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

  function handlePortHover(event: CustomEvent) {
  const { nodeId, isOutput } = event.detail;
  currentHoverNodeId = nodeId;
  currentHoverIsOutput = isOutput;
  
  console.log("Port hover:", nodeId, isOutput ? "output" : "input");
}



  // Connection drawing handlers
  function handleConnectionStart(event: CustomEvent) {
  const { nodeId, position, isOutput } = event.detail;
  
  console.log("CONNECTION START", {
    nodeId, position, isOutput
  });
  
  isDrawingConnection = true;
  connectionStartNode = nodeId;
  connectionStartIsOutput = isOutput;
  
  if (container) {
    const rect = container.getBoundingClientRect();
    
    // Calculate relative position in the viewport
    connectionStartPosition = {
      x: (position.x - rect.left) / viewport.zoom,
      y: (position.y - rect.top) / viewport.zoom
    };
    
    connectionEndPosition = { ...connectionStartPosition };
  }
  
  // Prevent default behavior
  event.preventDefault && event.preventDefault();
}



function handleConnectionEnd(event: CustomEvent) {
  if (!isDrawingConnection || !connectionStartNode) {
    console.log("CONNECTION END - Not drawing or no start node");
    return;
  }
  
  const { nodeId, isOutput } = event.detail;
  
  const endNodeId = currentHoverNodeId || event.detail.nodeId;
  const endIsOutput = currentHoverIsOutput !== null ? currentHoverIsOutput : event.detail.isOutput;
  
  console.log("CONNECTION END", {
    isDrawingConnection,
    startNode: connectionStartNode,
    startIsOutput: connectionStartIsOutput,
    endNode: endNodeId,
    endIsOutput
  });

  if (!endNodeId) {
    console.log("Connection cancelled: no target node");
    return;
  }

  if (connectionStartNode === endNodeId) {
    console.log(`Blocked self-connection on ${endNodeId}`);
    return;
  }
  
  // Only create connection if source and target are different nodes
  if (endNodeId && connectionStartNode !== endNodeId) {
    // Determine which node is source and which is target
    let sourceId, targetId;
    
    if (connectionStartIsOutput && !endIsOutput) {
      // Normal flow: output → input
      sourceId = connectionStartNode;
      targetId = endNodeId;
      console.log(`Creating connection from ${sourceId} to ${targetId}`);
      createConnection(siloId, sourceId, targetId);
    } else if (!connectionStartIsOutput && endIsOutput) {
      // Reverse flow: input → output
      sourceId = endNodeId;
      targetId = connectionStartNode;
      console.log(`Creating connection from ${sourceId} to ${targetId}`);
      createConnection(siloId, sourceId, targetId);
    } else {
      console.log("Cannot connect: both ports are inputs or both are outputs");
    }
  } else {
    console.log(`Cannot connect: same node (${endNodeId}) or nodeId is null`);
  }
  
  // Reset all state
  isDrawingConnection = false;
  connectionStartNode = null;
  currentHoverNodeId = null;
  currentHoverIsOutput = null;
}

function handleGlobalMouseMove(e: MouseEvent) {
  if (!isDrawingConnection || !container) return;
  
  const rect = container.getBoundingClientRect();
  connectionEndPosition = {
    x: (e.clientX - rect.left) / viewport.zoom,
    y: (e.clientY - rect.top) / viewport.zoom
  };
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'D' && e.ctrlKey) {
    debugShowState = !debugShowState;
    console.log('%c DEBUG STATE ', 'background: orange; color: white', {
      silo,
      viewport,
      isDrawingConnection,
      connectionStartNode,
      connectionStartIsOutput,
      debugConnectionAttempts
    });
  }
}

onMount(() => {
  // Existing code
  updateAllConnectionPaths(siloId);
  
  // Add GLOBAL mouse move listener
  document.addEventListener('mousemove', handleGlobalMouseMove);
  
  return () => {
    document.removeEventListener('mousemove', handleGlobalMouseMove);
  };
});


let debugConnectionAttempts: Array<{
  startTime: Date;
  startNode: string;
  startIsOutput: boolean;
  complete: boolean;
  endNode?: string;
  endIsOutput?: boolean;
  endTime?: Date;
  duration?: number;
  shouldCreateConnection?: boolean;
}> = [];
let debugShowState = false;
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
    {#if isDrawingConnection && connectionStartNode !== currentHoverNodeId}
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
       on:porthover={handlePortHover}  
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