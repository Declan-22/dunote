<!-- src/lib/components/NodeField.svelte -->
<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import type { TaskNode } from '$lib/types/task';
    import TaskNodeComponent from './TaskNode.svelte';
    import Node from './Node.svelte'; // You'll need to create this
    
    export let nodes: TaskNode[] = [];
    export let selectedNodeId: string | null = null;
    export let showDetailsNodeId: string | null = null;
    
    const dispatch = createEventDispatcher();
    
    // Handle node selection
    function handleSelect(event: CustomEvent) {
      const { id } = event.detail;
      dispatch('select', { id });
    }
    
    // Handle toggle details
    function handleToggleDetails(event: CustomEvent) {
      const { id, showDetails } = event.detail;
      dispatch('toggleDetails', { id, showDetails });
    }
    
    // Handle node editing
    function handleEdit(event: CustomEvent) {
      const { id } = event.detail;
      dispatch('edit', { id });
    }
    
    // Handle closing details
    function handleClose(event: CustomEvent) {
      const { id } = event.detail;
      dispatch('close', { id });
    }
    
    // Helper function to determine if a node should show details
    function shouldShowDetails(nodeId: string): boolean {
      return showDetailsNodeId === nodeId;
    }
</script>

<div class="node-field relative w-full h-full overflow-hidden">
  {#each nodes as node (node.id)}
    <!-- For now, we use TaskNodeComponent for all node types -->
    <!-- Later you can create a separate SourceNodeComponent if needed -->

    <TaskNodeComponent
      {node}
      selected={selectedNodeId === node.id}
      showDetails={shouldShowDetails(node.id)}
      on:select={handleSelect}
      on:toggleDetails={handleToggleDetails}
      on:edit={handleEdit}
      on:close={handleClose}
    />
  {/each}
</div>

<style>
  .node-field {
    min-height: 600px;
    background-color: #f9fafb;
    background-image: 
      linear-gradient(rgba(0, 0, 0, 0.1) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 0, 0, 0.1) 1px, transparent 1px);
    background-size: 20px 20px;
  }
</style>