<!-- src/lib/components/TaskNode.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TaskNode } from '$lib/types/task';
    import { TaskPriority, TaskStatus } from '$lib/types/task';
    
    export let node: TaskNode;
    export let selected = false;
    export let showDetails = false;
    
    const dispatch = createEventDispatcher();
    
    // Handle click on the node
    function handleClick() {
      dispatch('select', { id: node.id });
    }
    
    // Handle double click to show details
    function handleDoubleClick() {
      showDetails = !showDetails;
      dispatch('toggleDetails', { id: node.id, showDetails });
    }
    
    // Handle drag start
    function handleDragStart(event: DragEvent) {
      if (event.dataTransfer) {
        event.dataTransfer.setData('text/plain', node.id);
        event.dataTransfer.effectAllowed = 'move';
      }
    }
    
    // Get priority color class based on TaskPriority enum
    function getPriorityColor(): string {
      switch (node.priority?.toLowerCase()) {
        case TaskPriority.URGENT:
          return 'bg-red-200 border-red-500';
        case TaskPriority.HIGH:
          return 'bg-orange-200 border-orange-500';
        case TaskPriority.MEDIUM:
          return 'bg-yellow-200 border-yellow-500';
        case TaskPriority.LOW:
          return 'bg-green-200 border-green-500';
        default:
          return 'bg-gray-200 border-gray-500';
      }
    }
    
    // Get node type color/style
    function getNodeTypeStyle(): string {
      return node.type === 'source' 
        ? 'bg-purple-100 border-purple-400'
        : getPriorityColor();
    }
    
    // Calculate progress percentage based on task status
    function getProgressPercentage(): number {
      if (!node.children || node.children.length === 0) {
        // For leaf nodes, check status
        return node.status === TaskStatus.COMPLETED ? 100 : 
               node.status === TaskStatus.IN_PROGRESS ? 50 : 0;
      }
      
      // In a real implementation, you would track the status of child nodes
      // For now, default to 0% if logic isn't implemented
      return 0;
    }
    
    // Format date string to readable format
    function formatDate(dateString: string | null | undefined): string {
      if (!dateString) return '';
      try {
        const date = new Date(dateString);
        return date.toLocaleDateString();
      } catch (e) {
        return '';
      }
    }
    
    // Check if node is a source node
    function isSourceNode(): boolean {
      return node.type === 'source';
    }
    
    // Truncate text with ellipsis
    function truncate(text: string | undefined, maxLength: number = 30): string {
      if (!text) return '';
      return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
    }
    
    // Validate URL for source nodes
    function isValidUrl(url: string | undefined): boolean {
      if (!url) return false;
      try {
        new URL(url);
        return true;
      } catch (e) {
        return false;
      }
    }
    
    // Format URL for display
    function formatUrl(url: string | undefined): string {
      if (!url) return '';
      try {
        const urlObj = new URL(url);
        return urlObj.hostname;
      } catch (e) {
        return url;
      }
    }
</script>

<div 
  class="node {getNodeTypeStyle()} {selected ? 'ring-2 ring-blue-500' : ''} 
  p-3 rounded-lg border-2 shadow-md cursor-pointer transition-all duration-200 transform hover:scale-105 hover:shadow-lg"
  style="width: 220px; position: absolute; left: {node.position?.x || 0}px; top: {node.position?.y || 0}px;"
  onclick={handleClick}
  ondblclick={handleDoubleClick}
  ondragstart={handleDragStart}
  draggable="true"
  role="button"
  tabindex="0"
  aria-selected={selected}
  data-node-id={node.id}
  data-node-type={node.type}
>
  <!-- Node Type Indicator -->
  <div class="absolute top-0 right-0 text-xs px-1.5 py-0.5 rounded-bl bg-gray-700 text-white">
    {node.type}
  </div>

  <!-- Node Header -->
  <div class="flex justify-between items-start mb-2">
    <h3 class="font-bold text-sm">{truncate(node.data.title || node.data.label || 'Untitled Node')}</h3>
  </div>
  
  <!-- Source Node Content -->
  {#if isSourceNode()}
    <div class="source-content">
      {#if node.data.url && isValidUrl(node.data.url)}
        <a href={node.data.url} target="_blank" rel="noopener noreferrer" 
           class="text-xs text-blue-600 hover:underline block mb-1">
          {formatUrl(node.data.url)} ↗
        </a>
      {/if}
      
      {#if node.data.summary}
        <p class="text-xs text-gray-700 mb-2">{truncate(node.data.summary, 70)}</p>
      {/if}
      
      <!-- Key Points -->
      {#if node.data.key_points && node.data.key_points.length > 0}
        <div class="text-xs mt-1">
          <div class="font-semibold mb-1">Key Points:</div>
          <ul class="pl-4 list-disc">
            {#each node.data.key_points.slice(0, 2) as point}
              <li>{truncate(point, 40)}</li>
            {/each}
            {#if node.data.key_points.length > 2}
              <li>...</li>
            {/if}
          </ul>
        </div>
      {/if}
    </div>
  
  <!-- Task Node Content -->
  {:else}
    {#if node.data.description}
      <p class="text-xs text-gray-700 mb-2">{truncate(node.data.description, 50)}</p>
    {/if}
    
    <!-- Progress bar -->
    <div class="w-full bg-gray-300 rounded-full h-1.5 mb-2">
      <div class="bg-blue-500 h-1.5 rounded-full" style="width: {getProgressPercentage()}%"></div>
    </div>
    
    <!-- Tags -->
    {#if node.tags && node.tags.length > 0}
      <div class="mt-1 flex flex-wrap gap-1">
        {#each node.tags.slice(0, 2) as tag}
          <span class="bg-gray-100 text-gray-700 text-xs px-1.5 py-0.5 rounded">{tag}</span>
        {/each}
        {#if node.tags.length > 2}
          <span class="bg-gray-100 text-gray-700 text-xs px-1.5 py-0.5 rounded">+{node.tags.length - 2}</span>
        {/if}
      </div>
    {/if}
  {/if}
  
  <!-- Footer metadata for all node types -->
  <div class="flex flex-wrap text-xs text-gray-600 justify-between mt-2">
    <!-- Node ID (abbreviated) -->
    <span class="opacity-50">{node.id.substring(0, 6)}...</span>
    
    <!-- Child count -->
    {#if node.children && node.children.length > 0}
      <span class="bg-blue-100 px-1.5 rounded">
        {node.children.length} {node.children.length === 1 ? 'child' : 'children'}
      </span>
    {/if}
  </div>
  
  <!-- Expanded details panel -->
  {#if showDetails}
    <div class="absolute top-full left-0 mt-2 w-72 bg-white shadow-xl rounded-lg border p-3 z-10">
      <div class="flex justify-between items-center mb-2">
        <h4 class="font-bold">{node.data.title || node.data.label || 'Untitled Node'}</h4>
        <span class="bg-gray-200 text-xs px-2 py-0.5 rounded-full">{node.type}</span>
      </div>
      
      {#if isSourceNode()}
        <!-- Source node details -->
        {#if node.data.url}
          <div class="mb-2">
            <span class="text-xs font-semibold">URL:</span>
            <a href={node.data.url} target="_blank" rel="noopener noreferrer" 
              class="text-sm text-blue-600 hover:underline block">
              {node.data.url}
            </a>
          </div>
        {/if}
        
        {#if node.data.summary}
          <div class="mb-2">
            <span class="text-xs font-semibold">Summary:</span>
            <p class="text-sm">{node.data.summary}</p>
          </div>
        {/if}
        
        {#if node.data.key_points && node.data.key_points.length > 0}
          <div class="mb-2">
            <span class="text-xs font-semibold">Key Points:</span>
            <ul class="pl-4 list-disc text-sm">
              {#each node.data.key_points as point}
                <li>{point}</li>
              {/each}
            </ul>
          </div>
        {/if}
      {:else}
        <!-- Task node details -->
        {#if node.data.description}
          <p class="text-sm mb-3">{node.data.description}</p>
        {/if}
        
        <div class="grid grid-cols-2 gap-2 text-xs">
          <div>Priority:</div>
          <div class="font-semibold">{node.priority || 'Medium'}</div>
          
          {#if node.metadata.created_at}
            <div>Created:</div>
            <div class="font-semibold">{formatDate(node.metadata.created_at)}</div>
          {/if}
          
          {#if node.tags && node.tags.length > 0}
            <div>Tags:</div>
            <div class="font-semibold">{node.tags.join(', ')}</div>
          {/if}
        </div>
      {/if}
      
      <!-- Node relationship info -->
      <div class="mt-3 border-t pt-2 text-xs">
        <div class="grid grid-cols-2 gap-1">
          <div>ID:</div>
          <div class="font-mono">{node.id}</div>
          
          {#if node.parent}
            <div>Parent:</div>
            <div class="font-mono">{node.parent}</div>
          {/if}
          
          {#if node.children && node.children.length > 0}
            <div>Children:</div>
            <div class="font-mono">{node.children.length} nodes</div>
          {/if}
        </div>
      </div>
      
      <!-- Actions -->
      <div class="mt-3 flex justify-end gap-2">
        <button 
          class="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600" 
          onclick={() => dispatch('edit', { id: node.id })}
        >
          Edit
        </button>
        <button 
          class="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300" 
          onclick={() => { showDetails = false; dispatch('close', { id: node.id }); }}
        >
          Close
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .node {
    min-height: 120px;
    max-height: 220px;

    user-select: none;
  }
  
  /* Animation for the hover effect */
  .node:hover {
    z-index: 10;
  }
  
  /* Focus outline for accessibility */
  .node:focus {
    outline: none;
    box-shadow: 0 0 0 3px rgba(66, 153, 225, 0.5);
  }
</style>