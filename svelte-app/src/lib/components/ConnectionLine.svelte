<!-- ConnectionLine.svelte -->
<script lang="ts">
  import type { SiloEdge } from '$lib/stores/siloStore';

  export let selected = false;
  export let animated = false;
  export let scale = 1;
  export let containerOffset = { x: 0, y: 0 };
  export let edge: SiloEdge;
  export let viewport = { x: 0, y: 0, zoom: 1 };
  $: adjusted = {
        sourceX: (edge.pathData?.sourceX || 0) * viewport.zoom + viewport.x,
        sourceY: (edge.pathData?.sourceY || 0) * viewport.zoom + viewport.y,
        targetX: (edge.pathData?.targetX || 0) * viewport.zoom + viewport.x,
        targetY: (edge.pathData?.targetY || 0) * viewport.zoom + viewport.y
    };

    let pathCommand = '';
    $: {
    if (edge.pathData) {
      pathCommand = `M ${edge.pathData.sourceX * viewport.zoom + viewport.x} 
                     ${edge.pathData.sourceY * viewport.zoom + viewport.y}
                     C ${(edge.pathData.controlPoint1X || edge.pathData.sourceX) * viewport.zoom + viewport.x} 
                       ${edge.pathData.sourceY * viewport.zoom + viewport.y},
                       ${(edge.pathData.controlPoint2X || edge.pathData.targetX) * viewport.zoom + viewport.x} 
                       ${edge.pathData.targetY * viewport.zoom + viewport.y},
                       ${edge.pathData.targetX * viewport.zoom + viewport.x} 
                       ${edge.pathData.targetY * viewport.zoom + viewport.y}`;
    }
  }
  // Adjust positions for current view transform
  $: adjustedSource = {
        x: (edge.pathData?.sourceX || 0) * scale + containerOffset.x,
        y: (edge.pathData?.sourceY || 0) * scale + containerOffset.y
    };
    
    $: adjustedTarget = {
        x: (edge.pathData?.targetX || 0) * scale + containerOffset.x,
        y: (edge.pathData?.targetY || 0) * scale + containerOffset.y
    };

  // Calculate control points relative to adjusted positions
  $: deltaX = adjustedTarget.x - adjustedSource.x;
  $: deltaY = adjustedTarget.y - adjustedSource.y;
  $: controlOffset = Math.min(Math.abs(deltaX) * 0.5, 200);
  
  $: pathData = {
      sourceX: adjustedSource.x,
      sourceY: adjustedSource.y,
      targetX: adjustedTarget.x,
      targetY: adjustedTarget.y,
      controlPoint1X: adjustedSource.x + (deltaX > 0 ? controlOffset : -controlOffset),
      controlPoint1Y: adjustedSource.y,
      controlPoint2X: adjustedTarget.x - (deltaX > 0 ? controlOffset : -controlOffset),
      controlPoint2Y: adjustedTarget.y
  };



  $: pathClass = `connection-path ${selected ? 'selected' : ''} ${animated ? 'animated' : ''}`;
</script>
<path class="connection-path" d={pathCommand} />
<svg class="connection-container" 
   width="100%" 
   height="100%" 
   style="position: absolute; top: 0; left: 0; pointer-events: none; z-index: 0;">
  <path 
      d={pathCommand}
      class={pathClass}
      marker-end="url(#arrowhead)"
  />
  
  <defs>
      <marker
          id="arrowhead"
          viewBox="0 0 15 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="4"
          orient="auto"
      >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--brand-green-light)" />
      </marker>
  </defs>
</svg>

<style>
    .connection-path {
        fill: none;
        stroke: var(--brand-green-light);
        stroke-width: 2px;
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