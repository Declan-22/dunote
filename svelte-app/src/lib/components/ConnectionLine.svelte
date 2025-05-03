<!-- ConnectionLine.svelte -->
<script lang="ts">
  import type { SiloEdge } from '$lib/stores/siloStore';

export let selected = false;
export let animated = false;
export let scale = 1;
export let edge: SiloEdge;
export let viewport = { x: 0, y: 0, zoom: 1 };
export let contextNodeId: string | null;
  
  // Check if connection belongs to context node
  $: isContextConnection = contextNodeId && (edge.source === contextNodeId || edge.target === contextNodeId);

// Calculate adjusted positions based on viewport
$: adjusted = {
  sourceX: (edge.pathData?.sourceX || 0) * viewport.zoom + viewport.x,
  sourceY: (edge.pathData?.sourceY || 0) * viewport.zoom + viewport.y,
  targetX: (edge.pathData?.targetX || 0) * viewport.zoom + viewport.x,
  targetY: (edge.pathData?.targetY || 0) * viewport.zoom + viewport.y,
  controlPoint1X: ((edge.pathData?.controlPoint1X || edge.pathData?.sourceX || 0) * viewport.zoom + viewport.x),
  controlPoint1Y: ((edge.pathData?.controlPoint1Y || edge.pathData?.sourceY || 0) * viewport.zoom + viewport.y),
  controlPoint2X: ((edge.pathData?.controlPoint2X || edge.pathData?.targetX || 0) * viewport.zoom + viewport.x),
  controlPoint2Y: ((edge.pathData?.controlPoint2Y || edge.pathData?.targetY || 0) * viewport.zoom + viewport.y)
};

$: pathCommand = `M ${adjusted.sourceX} ${adjusted.sourceY}
                 C ${adjusted.controlPoint1X} ${adjusted.controlPoint1Y},
                   ${adjusted.controlPoint2X} ${adjusted.controlPoint2Y},
                   ${adjusted.targetX} ${adjusted.targetY}`;
                   
$: pathClass = `connection-path ${selected ? 'selected' : ''} ${animated ? 'animated' : ''}`;
</script>
<path 
  class={pathClass} 
  d={pathCommand} 
  marker-start="url(#startdot)"
  style="opacity: {contextNodeId ? (isContextConnection ? 1 : 0.3) : 1}"
/>
<svg class="connection-container" 
   width="100%" 
   height="100%" 
   style="position: absolute; top: 0; left: 0; pointer-events: none; z-index: 0;">
   <path 
   d={pathCommand}
   class={pathClass}
   marker-start="url(#startdot)"
   style="opacity: {contextNodeId ? (isContextConnection ? 1 : 0.3) : 1}"
 />
  
  <defs>
      <marker
          id="startdot"
          viewBox="0 0 10 10"
          refX="5"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
      >
          <circle cx="5" cy="5" r="3" 

                stroke="var(--text-primary)" 
                stroke-width="2"/>
      </marker>
  </defs>
</svg>

<style>

  .connection-path {
    fill: none;
    stroke: var(--text-primary);
    stroke-width: 1.5px;
    pointer-events: none;
    transition: stroke-width 0.2s ease;
  }
    
  .connection-path.selected {
    stroke: #3498db;
    stroke-width: 3px;
  }
    
  .connection-path.animated {
    stroke-dasharray: 5 3;
    animation: flow 0.5s linear infinite;
  }
  
  @keyframes flow {
    to {
      stroke-dashoffset: -8;
    }
  }
</style>