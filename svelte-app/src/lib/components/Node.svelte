<script lang="ts">
  let inputPortElements: HTMLElement[] = [];
  let outputPortElements: HTMLElement[] = [];
  
  import { createEventDispatcher, onMount } from 'svelte';
  import { fade, fly,  } from 'svelte/transition';
  import type { SiloNode, SiloEdge, Position, PortPosition } from '$lib/stores/siloStore';
  import { siloStore, removeConnection, deleteNode, } from '$lib/stores/siloStore';
  import { validateUrl } from '$lib/utils/nodeUtils';
  import { NODE_TYPES } from '$lib/types/nodes';
  import type { NodeType } from '$lib/types/nodes';
  import { shouldHaveInputPort, shouldHaveOutputPort, setNodePortPositions } from '$lib/stores/siloStore';
  export let viewport = { x: 0, y: 0, zoom: 1 };
  $: screenX = node.position.x * viewport.zoom + viewport.x;
  $: screenY = node.position.y * viewport.zoom + viewport.y;

  export let node: SiloNode;
  export let siloId: string;
  export let scale: number = 1;
  const dispatch = createEventDispatcher();
  let isDragging = false;
  let isExpanded = false;
  let isStatusDropdownOpen = false;
  let isEditingTitle = false;
  let isNodePanelOpen = false;
  let startPos = { x: 0, y: 0 };
  let startNodePos = { x: 0, y: 0 };
  let nodeElement: HTMLElement | null = null;
  let nodePanelElement: HTMLDivElement;
  let titleInput: HTMLInputElement;
  let newTitle = '';
  let isAddingComment = false;
  let commentText = '';
  
  $: nodeData = node.data || {};
  $: safeTitle = nodeData.title || nodeData.label || "Untitled Node";
  $: safeDescription = nodeData.description || (nodeData.original_text || `No description provided for ${safeTitle}`);
  $: safeUrl = nodeData.url ? validateUrl(nodeData.url) : null;
  $: isTaskNode = node.type === 'task';
  $: isResourceNode = node.type === 'resource';
  $: nodeClass = isResourceNode ? 'resource-node' : (isTaskNode ? 'task-node' : `${node.type}-node`);
  $: safeNodeType = (node.type && Object.keys(NODE_TYPES).includes(node.type)) 
     ? (node.type as NodeType) 
     : 'task';
  $: nodeStyle = NODE_TYPES[safeNodeType];
  $: connections = $siloStore.find(s => s.id === siloId)?.edges.filter(e => 
        e.source === node.id || e.target === node.id
    ) || [];
  $: inputConnections = connections.filter(e => e.target === node.id);
  $: outputConnections = connections.filter(e => e.source === node.id);
  
  // Status options
  const statusOptions = ['not-started', 'in-progress', 'completed'];
  
  // Node functions (examples - would be customized based on node type)
  $: nodeFunctions = getNodeFunctions(node.type);


  // Toggle comment adding mode
function toggleComment(e) {
  e.stopPropagation();
  isAddingComment = !isAddingComment;
  
  if (isAddingComment) {
    setTimeout(() => {
      const input = document.querySelector('.comment-input');
      if (input) input.focus();
    }, 50);
  }
}

// Handle keydown in comment input
function handleCommentKeydown(e) {
  if (e.key === 'Enter') {
    saveComment();
  } else if (e.key === 'Escape') {
    cancelComment();
  }
}

// Save a new comment
function saveComment() {
  if (commentText.trim()) {
    // Create comments array if it doesn't exist
    if (!node.data.comments) {
      dispatch('updatenode', {
        nodeId: node.id,
        updates: {
          data: {
            ...node.data,
            comments: []
          }
        }
      });
    }
    
    // Add the comment
    dispatch('updatenode', {
      nodeId: node.id,
      updates: {
        data: {
          ...node.data,
          comments: [...(node.data.comments || []), { 
            text: commentText.trim(),
            timestamp: new Date().toISOString(),
            author: 'You' // Or get from user context
          }]
        }
      }
    });
    
    commentText = '';
    isAddingComment = false;
  }
}

// Cancel comment adding
function cancelComment() {
  commentText = '';
  isAddingComment = false;
}

// Remove a comment
function removeComment(index) {
  const updatedComments = [...(node.data.comments || [])];
  updatedComments.splice(index, 1);
  
  dispatch('updatenode', {
    nodeId: node.id,
    updates: {
      data: {
        ...node.data,
        comments: updatedComments
      }
    }
  });
}

function toggleExpand(e) {
  e.stopPropagation();
  isExpanded = !isExpanded;
}

  function getNodeFunctions(type: NodeType) {
    const baseFunctions = [
      { id: 'run', label: 'Run', icon: 'play' }
    ];

    switch(type) {
      case 'resource':
        return [
          ...baseFunctions,
          { id: 'extract_quotes', label: 'Extract Quotes', icon: 'message-square' },
          { id: 'summarize', label: 'Summarize', icon: 'file-text' },
          { id: 'generate_citations', label: 'Generate Citations', icon: 'book' }
        ];
      case 'milestone':
        return [
          ...baseFunctions,
          { id: 'check_requirements', label: 'Check Requirements', icon: 'check-circle' },
          { id: 'validate_sources', label: 'Validate Sources', icon: 'shield' },
          { id: 'complete_milestone', label: 'Complete', icon: 'flag' }
        ];
      case 'task':
        return [
          ...baseFunctions,
          { id: 'add_subtask', label: 'Add Subtask', icon: 'plus' },
          { id: 'assign_owner', label: 'Assign Owner', icon: 'user' },
          { id: 'set_deadline', label: 'Set Deadline', icon: 'calendar' }
        ];
      default:
        return baseFunctions;
    }
  }
  let isEditingDescription = false;
  let newDescription = '';
    
  
  // Default port positions
    const defaultPortPositions: PortPosition = {
    input: { x: 0, y: 30 },
    output: { x: 150, y: 30 } // assuming node width of 150px
  };
  

  function handleEditDescription(e: MouseEvent) {
    e.stopPropagation();
    isEditingDescription = true;
    newDescription = safeDescription;
    
    setTimeout(() => {
      const textarea = document.querySelector('.description-edit-input') as HTMLTextAreaElement;
      textarea?.focus();
    }, 50);
  }

  function saveDescription() {
    if (newDescription.trim()) {
      dispatch('updatedescription', {
        nodeId: node.id,
        description: newDescription.trim()
      });
    }
    isEditingDescription = false;
  }

  function handleDescriptionKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveDescription();
    } else if (e.key === 'Escape') {
      isEditingDescription = false;
    }
  }
  function handleMouseDown(e: MouseEvent) {
    // Don't drag from control elements
    if (e.target && (e.target as HTMLElement).closest('.node-control-btn, .expanded-panel, .port, .status-selector')) {
      return;
    }
    
    isDragging = true;
    startPos = { x: e.clientX, y: e.clientY };
    
    // Dispatch with node data for context in parent
    dispatch('dragstart', { node });
    
    e.stopPropagation(); // Prevent panning
  }
  
  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    
    const dx = e.clientX - startPos.x;
    const dy = e.clientY - startPos.y;
    
    dispatch('drag', { dx, dy, nodeId: node.id });
  }
  
  function handleMouseUp() {
    if (isDragging) {
      dispatch('dragend', { nodeId: node.id });
      isDragging = false;
    }
  }
  
  // Toggle node panel
  function toggleNodePanel(e: MouseEvent) {
    e.stopPropagation();
    isNodePanelOpen = !isNodePanelOpen;
    
    if (isNodePanelOpen) {
      // Close any other open panels
      isExpanded = false;
      isStatusDropdownOpen = false;
      isEditingTitle = false;
    }
  }

  // Port connection handlers
  function handlePortMouseDown(e: MouseEvent, isOutput: boolean) {
    e.stopPropagation();
    
    const portElement = e.currentTarget as HTMLElement;
    const rect = portElement.getBoundingClientRect();
    const portIndex = parseInt(portElement.dataset.portIndex || '0');
    
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
    
    dispatch('connectionstart', { 
      nodeId: node.id,
      position,
      isOutput,
      portIndex  // Add port index to event
    });
  }

  function handlePortMouseUp(e: MouseEvent, isOutput: boolean) {
    e.stopPropagation();
    
    const portElement = e.currentTarget as HTMLElement;
    const portIndex = parseInt(portElement.dataset.portIndex || '0');
    
    dispatch('connectionend', { 
      nodeId: node.id,
      isOutput,
      portIndex  // Add port index to event
    });
  }
  
  type Position = { x: number; y: number };

  function getNodePosition(siloId: string, nodeId: string): Position | null {
    const silo = $siloStore.find(s => s.id === siloId);
    const node = silo?.nodes.find(n => n.id === nodeId);
    return node ? { x: node.position.x, y: node.position.y } : null;
  }

  function getPortPosition(nodeId: string): Position {
    const pos = getNodePosition(siloId, nodeId);
    return pos ? { x: pos.x + 240, y: pos.y + 40 } : { x: 0, y: 0 };
  }

  function getResourceData(node: SiloNode) {
    return {
      url: node.data?.url,
      summary: node.data?.summary,
      key_points: node.data?.key_points || []
    };
  }
  
  // Handle delete node
  function handleDeleteNode(e: MouseEvent) {
    e.stopPropagation();
    
    // Remove the node from the siloStore
    const silo = $siloStore.find(s => s.id === siloId);
    if (silo) {
      // First remove all connections to/from this node
      const affectedEdges = connections.map(edge => edge.id);
      affectedEdges.forEach(edgeId => {
        removeConnection(siloId, edgeId);
      });
      
      // Then remove the node
      deleteNode(siloId, node.id);
    }
    
    dispatch('delete', { nodeId: node.id });
  }
  
  // Handle edit node title
  function handleEditTitle(e: MouseEvent) {
    e.stopPropagation();
    isEditingTitle = true;
    newTitle = safeTitle;
    
    // Focus the input after rendering
    setTimeout(() => {
      if (titleInput) {
        titleInput.focus();
        titleInput.select();
      }
    }, 50);
  }
  
  // Save the edited title
  function saveTitle() {
    if (newTitle.trim()) {
      dispatch('updatenode', {
        nodeId: node.id,
        updates: {
          data: {
            title: newTitle.trim()
          }
        }
      });
    }
    isEditingTitle = false;
  }
  
  // Handle title input keydown
  function handleTitleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      saveTitle();
    } else if (e.key === 'Escape') {
      isEditingTitle = false;
    }
  }
  
  // Execute node function
  function executeFunction(functionId: string) {
    dispatch('executefunction', {
      nodeId: node.id,
      functionId
    });
  }
  
  // Toggle status dropdown
  function toggleStatusDropdown(e: MouseEvent) {
    e.stopPropagation();
    isStatusDropdownOpen = !isStatusDropdownOpen;
  }
  
  // Update node status
  function updateStatus(status: string) {
    dispatch('updatestatus', { 
      nodeId: node.id, 
      status: status 
    });
    isStatusDropdownOpen = false;
  }
  
  // Resource specific actions
  function viewSourceLink(e: MouseEvent) {
    e.stopPropagation();
    const resourceData = getResourceData(node);
    dispatch('action', { nodeId: node.id, action: 'source', data: resourceData.url });
  }
  
  function viewQuotes(e: MouseEvent) {
    e.stopPropagation();
    dispatch('action', { nodeId: node.id, action: 'quotes' });
  }
  
  function viewSummary(e: MouseEvent) {
    e.stopPropagation();
    const resourceData = getResourceData(node);
    dispatch('action', { nodeId: node.id, action: 'summary', data: resourceData.summary });
  }
  
  function viewKeyPoints(e: MouseEvent) {
    e.stopPropagation();
    dispatch('action', { nodeId: node.id, action: 'keypoints' });
  }
  function closeNodePanel(e) {
    e.stopPropagation(); // Prevent event from propagating
    isNodePanelOpen = false;
  }
  // Close expanded panels when clicking outside
  function handleClickOutside(e) {
    // First check if panel is open
    if (isNodePanelOpen) {
      // Check if click is outside the panel
      const nodePanelElement = document.querySelector('.node-panel');
      // Make sure we don't close when clicking inside the panel
      // unless it's the close button
      if (nodePanelElement && !nodePanelElement.contains(e.target) || 
          e.target.closest('.panel-close-btn')) {
        isNodePanelOpen = false;
      }
    }
    
    if (isStatusDropdownOpen) {
      isStatusDropdownOpen = false;
    }
    
    if (isEditingTitle && !(e.target as HTMLElement).closest('.title-edit-input')) {
      saveTitle();
    }
  }

  $: inputData = getInputData();
  
  function getInputData() {
    const silo = $siloStore.find(s => s.id === siloId);
    if (!silo) return {};
    
    const inputs: Record<string, any> = {};
    
    // Get all input connections
    inputConnections.forEach(connection => {
      const sourceNode = silo.nodes.find(n => n.id === connection.source);
      if (sourceNode) {
        inputs[connection.id] = {
          node: sourceNode,
          data: sourceNode.data.outputData || {} // Output data from source node
        };
      }
    });
    
    return inputs;
  }
  
  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  onMount(() => {
    if (!node.portPositions) {
      // Set default port positions if not already set
      setNodePortPositions(node.siloId, node.id, defaultPortPositions);
    }

    onMount(() => {
    console.log('Node mounted:', node.id, viewport);
  });
    
    // After the component is rendered, recalculate actual port positions
    updatePortPositions();
  });

  function updatePortPositions() {
    if (!nodeElement) return;
    
    const nodeRect = nodeElement.getBoundingClientRect();
    const inputPort = nodeElement.querySelector('.input-port');
    const outputPort = nodeElement.querySelector('.output-port');
    
    const newPortPositions: PortPosition = {
      input: { x: 0, y: 30 },
      output: { x: nodeRect.width, y: 30 }
    };
    
    if (inputPort) {
      const inputRect = inputPort.getBoundingClientRect();
      newPortPositions.input = {
        x: inputRect.left - nodeRect.left,
        y: inputRect.top - nodeRect.top + inputRect.height / 2
      };
    }
    
    if (outputPort) {
      const outputRect = outputPort.getBoundingClientRect();
      newPortPositions.output = {
        x: outputRect.left - nodeRect.left + outputRect.width,
        y: outputRect.top - nodeRect.top + outputRect.height / 2
      };
    }
    
    // Update the node's port positions
    setNodePortPositions(node.siloId, node.id, newPortPositions);
  }
  function handleDragStart(e: MouseEvent) {
    e.stopPropagation(); // Prevent panning
        if (!nodeElement) return;

        const rect = nodeElement.getBoundingClientRect();
        startPos = {
            x: (e.clientX - rect.left) / viewport.zoom,
            y: (e.clientY - rect.top) / viewport.zoom
        };
        dispatch('dragstart');
    }

  function handleDragMove(e: MouseEvent) {
    if (!isDragging || !nodeGroup) return;

    const svgRoot = (e.target as SVGElement).closest('svg');
    if (!svgRoot) return;
    const svgRect = svgRoot.getBoundingClientRect();

    const newX = (e.clientX - svgRect.left - startPos.x) / viewport.zoom + startNodePos.x;
    const newY = (e.clientY - svgRect.top - startPos.y) / viewport.zoom + startNodePos.y;

    dispatch('drag', {
      dx: newX - node.position.x,
      dy: newY - node.position.y
    });
  }
  function handleDragEnd(event: MouseEvent) {
    // Handle node drag end
    dispatch('dragend', {
      nodeId: node.id,
      position: { x: node.position.x, y: node.position.y }
    });
    
    // Update port positions after drag
    updatePortPositions();
  }
  
  // Format dates if available
  function formatDate(dateString: string | undefined): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString();
  }

  // Helper function to get status display name
  function getStatusDisplay(status: string): string {
    switch(status) {
      case 'not-started': return 'Not Started';
      case 'in-progress': return 'In Progress';
      case 'completed': return 'Completed';
      default: return 'Unknown Status'; // Handle unexpected status values
    }
  }
  
  // Get icon for node function
  function getFunctionIcon(iconName: string): string {
  const icons: Record<string, string> = {
    'play': '<polygon points="5 3 19 12 5 21 5 3"></polygon>',
      'rotate-cw': '<polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>',
      'filter': '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>',
      'git-merge': '<circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M6 21V9a9 9 0 0 0 9 9"></path>',
      'scissors': '<circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line>'
    };
    
    return icons[iconName] || '<circle cx="12" cy="12" r="10"></circle>';
  }
</script>

<div 
  class="node {node.type}-node" 
  bind:this={nodeElement}
  style="transform: translate({node.position.x}px, {node.position.y}px)"
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
>
  <!-- Input ports on left side -->
  <div class="ports-container input-ports">
    {#each Array(node.data.inputPorts || 1) as _, i (i)}
      <div 
        class="port input-port"
        data-port-index={i}
        on:mousedown={(e) => handlePortMouseDown(e, false)}
        on:mouseup={(e) => handlePortMouseUp(e, false)}
      >
        <div class="port-connector"></div>
      </div>
    {/each}
  </div>
  
  <!-- Main Node Box -->
  <div class="node-container">
    <!-- Background Box with title and minimal controls -->
    <div class="node-background">
      <div class="node-header">
        <div class="node-icon" style="color: {nodeStyle.color}">
          {#if node.type === 'task'}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          {:else if node.type === 'milestone'}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          {:else if node.type === 'resource'}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
            </svg>
          {:else}
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="16" x2="12" y2="12"></line>
              <line x1="12" y1="8" x2="12.01" y2="8"></line>
            </svg>
          {/if}
        </div>

        {#if isEditingTitle}
          <input 
            type="text" 
            class="title-edit-input" 
            bind:value={newTitle} 
            bind:this={titleInput}
            on:keydown={handleTitleKeydown}
            on:blur={saveTitle}
            on:click|stopPropagation={() => {}}
          />
        {:else}
          <span class="node-title">
            {safeTitle}
          </span>
        {/if}

        <div class="node-controls">
          <button class="node-control-btn comment-btn" on:click|stopPropagation={toggleComment} title="Add Comment">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
            </svg>
          </button>
          <button class="node-control-btn edit-btn" on:click|stopPropagation={handleEditTitle} title="Edit Title">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="node-control-btn delete-btn" on:click|stopPropagation={handleDeleteNode} title="Delete Node">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>

      <!-- Status selector -->
      <div class="status-container">
        <button class="node-status status-{node.data.status || 'not-started'}" on:click|stopPropagation={toggleStatusDropdown}>
          {getStatusDisplay(node.data.status || 'not-started')}
          <svg class="status-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        
        {#if isStatusDropdownOpen}
          <div class="status-dropdown" transition:fade={{ duration: 100 }}>
            {#each statusOptions as status}
              <button 
                class="status-option status-{status}" 
                class:selected={node.data.status === status}
                on:click|stopPropagation={() => updateStatus(status)}
              >
                {getStatusDisplay(status)}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      
      <!-- Toggle for expandable panel -->
      <button class="expand-toggle" on:click|stopPropagation={toggleExpand}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points={isExpanded ? "18 15 12 9 6 15" : "6 9 12 15 18 9"}></polyline>
        </svg>
      </button>
    </div>
    
    <!-- Comments display -->
    {#if node.data.comments && node.data.comments.length > 0}
      <div class="node-comments">
        {#each node.data.comments as comment, index}
          <div class="comment-tag">
            <span class="comment-text">{comment.text}</span>
            <button class="remove-comment" on:click|stopPropagation={() => removeComment(index)}>×</button>
          </div>
        {/each}
      </div>
    {/if}
    
    <!-- Expandable function box -->
    {#if isExpanded}
      <div class="node-expanded" transition:scale={{ duration: 150, start: 0.95, opacity: 0 }}>
        <!-- Node functions section -->
        <div class="functions-section">
          <h3 class="section-title">Functions</h3>
          <div class="functions-list">
            {#each nodeFunctions as func}
              <button 
                class="function-btn" 
                on:click|stopPropagation={() => executeFunction(func.id)}
                title={func.label}
              >
                <span class="function-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    {@html getFunctionIcon(func.icon)}
                  </svg>
                </span>
                <span class="function-label">{func.label}</span>
              </button>
            {/each}
          </div>
        </div>
        
        <!-- Input/Output displays -->
        <div class="io-section">
          <!-- Inputs display -->
          <div class="inputs-container">
            <h4 class="io-title">Inputs</h4>
            {#if inputConnections.length > 0}
              {#each inputConnections as connection}
                <div class="connection-item">
                  <div class="connection-indicator input-indicator"></div>
                  <span class="connection-name">
                    {$siloStore.find(s => s.id === siloId)?.nodes.find(n => n.id === connection.source)?.data?.title || 'Unknown'}
                  </span>
                  <button class="remove-connection-btn" on:click|stopPropagation={() => removeConnection(siloId, connection.id)}>×</button>
                </div>
              {/each}
            {:else}
              <div class="empty-message">No inputs</div>
            {/if}
          </div>
          
          <!-- Outputs display -->
          <div class="outputs-container">
            <h4 class="io-title">Outputs</h4>
            {#if outputConnections.length > 0}
              {#each outputConnections as connection}
                <div class="connection-item">
                  <div class="connection-indicator output-indicator"></div>
                  <span class="connection-name">
                    {$siloStore.find(s => s.id === siloId)?.nodes.find(n => n.id === connection.target)?.data?.title || 'Unknown'}
                  </span>
                  <button class="remove-connection-btn" on:click|stopPropagation={() => removeConnection(siloId, connection.id)}>×</button>
                </div>
              {/each}
            {:else}
              <div class="empty-message">No outputs</div>
            {/if}
          </div>
        </div>
      </div>
    {/if}
    
    <!-- Comment input when adding -->
    {#if isAddingComment}
      <div class="comment-input-container" transition:fade={{ duration: 150 }}>
        <input 
          type="text" 
          class="comment-input" 
          placeholder="Add a comment..." 
          bind:value={commentText}
          on:keydown={handleCommentKeydown}
        />
        <div class="comment-actions">
          <button class="comment-btn cancel" on:click|stopPropagation={cancelComment}>Cancel</button>
          <button class="comment-btn save" on:click|stopPropagation={saveComment}>Add</button>
        </div>
      </div>
    {/if}
  </div>
  
  <!-- Output ports on right side -->
  <div class="ports-container output-ports">
    {#each Array(node.data.outputPorts || 1) as _, i (i)}
      <div 
        class="port output-port"
        data-port-index={i}
        on:mousedown={(e) => handlePortMouseDown(e, true)}
        on:mouseup={(e) => handlePortMouseUp(e, true)}
      >
        <div class="port-connector"></div>
      </div>
    {/each}
  </div>
</div>

<style>
  /* Base node styling */
  .node {
  position: absolute;
  display: flex;
  align-items: center;
  z-index: 2;
  cursor: pointer;
  transition: transform 0.1s ease-out;
}

.node-container {
  display: flex;
  flex-direction: column;
  width: 280px;
}

.node-background {
  padding: 0.75rem;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  position: relative;
}

.node-background:hover .node-controls {
  opacity: 1;
}

.node.dragging {
  z-index: 10;
  opacity: 0.9;
  filter: drop-shadow(0 0 8px var(--brand-green-light));
}

.node.expanded, .node.panel-open {
  z-index: 100; /* Ensure expanded nodes are on top */
}

.node-card {
  width: 280px;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-fast);
  position: relative;

}



.node-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

/* Node header styling */
.node-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.node-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
}

.node-title {
  font-weight: 500;
  font-size: 0.95rem;
  color: var(--text-primary);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.title-edit-input {
  flex: 1;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 0.25rem 0.5rem;
  font-size: 0.9rem;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.node-description {
  font-size: 0.85rem;
  font-weight: 300;
  margin: 0.5rem 0 0 0;
  color: var(--text-secondary);
  line-height: 1.4;
  max-height: 4.2em;

  display: -webkit-box;
  line-clamp: 3;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

/* Status container and dropdown */
.status-container {
  margin-top: 0.75rem;
  position: relative;
}

.node-status {
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  border-radius: 12px;
  text-transform: capitalize;
  white-space: nowrap;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  border: none;
  cursor: pointer;
  background: transparent;
  border: 1px solid var(--border-color);
}

.status-arrow {
  opacity: 0.6;
}

.status-dropdown {
  position: absolute;
  top: 100%;
  right: 0;
  z-index: 101;
  background: var(--bg-primary);
  border-radius: 6px;
  box-shadow: none;
  border: none;
  min-width: 120px;

  margin-top: 5px;
}

.status-option {
  display: flex;
  width: 100%;
  text-align: left;
  padding: 0.3rem 1rem;
  font-size: 0.6rem;
  border: none;
  border-radius: 15px;
  background: transparent;
  cursor: pointer;
  transition: background 0.2s ease;
  margin-bottom: 0.25rem; /* Added vertical gap */
}

.status-option:hover {
  background: var(--neutral-100);
}

.status-option.selected {
  font-weight: 600;
}
.expand-toggle {
  position: absolute;
  bottom: 5px;
  right: 5px;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-secondary);
  transition: transform 0.2s ease;
}

.node-comments {
  margin-top: 0.5rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.comment-tag {
  background: var(--neutral-100);
  font-size: 0.7rem;
  padding: 0.2rem 0.5rem;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.comment-text {
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remove-comment {
  background: transparent;
  border: none;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}

.remove-comment:hover {
  background: rgba(0, 0, 0, 0.1);
}

/* Comment input */
.comment-input-container {
  margin-top: 0.5rem;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 0.5rem;
  background: var(--bg-primary);
}

.comment-input {
  width: 100%;
  border: none;
  padding: 0.25rem;
  font-size: 0.85rem;
  margin-bottom: 0.5rem;
  background: transparent;
}

.comment-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.comment-btn {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: none;
  font-size: 0.7rem;
  cursor: pointer;
}

.comment-btn.cancel {
  background: transparent;
}

.comment-btn.save {
  background: var(--brand-green);
  color: white;
}

.node-expanded {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-top: none;
  border-radius: 0 0 8px 8px;
  padding: 0.75rem;
}


.expand-indicator {
  font-size: 0.7rem;
  color: var(--text-secondary);
  margin-left: 0.25rem;
}

/* Status colors */
.status-not-started {
  background: transparent;
  color: #e1474d;
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.status-not-started::before {
  content: '';
  display: inline-block;
  vertical-align: middle;
  margin-right: 0.5rem;
  width: 16px;
  height: 16px;
  background: #e1474d;
  mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="m3.517 17l7.058-11.783a1.667 1.667 0 0 1 2.85 0L20.483 17a1.667 1.667 0 0 1-1.425 2.5H4.942A1.666 1.666 0 0 1 3.517 17M12 9a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1m-1 7a1 1 0 0 1 1-1h.008a1 1 0 1 1 0 2H12a1 1 0 0 1-1-1" clip-rule="evenodd"/></svg>') no-repeat center;
  mask-size: contain;
  -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="m3.517 17l7.058-11.783a1.667 1.667 0 0 1 2.85 0L20.483 17a1.667 1.667 0 0 1-1.425 2.5H4.942A1.666 1.666 0 0 1 3.517 17M12 9a1 1 0 0 1 1 1v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1m-1 7a1 1 0 0 1 1-1h.008a1 1 0 1 1 0 2H12a1 1 0 0 1-1-1" clip-rule="evenodd"/></svg>') no-repeat center;
  -webkit-mask-size: contain;
}

.status-in-progress {
  background: transparent;
  color: #84a2e0;
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.status-in-progress::before {
  content: '';
  display: inline-block;
  vertical-align: middle;
  margin-right: 0.5rem;
  width: 16px;
  height: 16px;
  background: #84a2e0;
  mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20.777a9 9 0 0 1-2.48-.969M14 3.223a9.003 9.003 0 0 1 0 17.554m-9.421-3.684a9 9 0 0 1-1.227-2.592M3.124 10.5c.16-.95.468-1.85.9-2.675l.169-.305m2.714-2.941A9 9 0 0 1 10 3.223"/></svg>') no-repeat center;
  mask-size: contain;
  -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20.777a9 9 0 0 1-2.48-.969M14 3.223a9.003 9.003 0 0 1 0 17.554m-9.421-3.684a9 9 0 0 1-1.227-2.592M3.124 10.5c.16-.95.468-1.85.9-2.675l.169-.305m2.714-2.941A9 9 0 0 1 10 3.223"/></svg>') no-repeat center;
  -webkit-mask-size: contain;
}

.status-completed {
  background: transparent;
  color: #18d8b3;
  border: 1px solid var(--border-color);
  border-radius: 12px;
}

.status-completed::before {
  content: '';
  display: inline-block;
  vertical-align: middle;
  margin-right: 0.5rem;
  width: 16px;
  height: 16px;
  background: #18d8b3;
  mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12" /><path d="m17.608 9l-7.726 7.726L6 12.093l1.511-1.31l2.476 3.01l6.207-6.207z" /></g></svg>') no-repeat center;
  mask-size: contain;
  -webkit-mask: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><g fill="currentColor" fill-rule="evenodd" clip-rule="evenodd"><path d="M12 3a9 9 0 1 0 0 18a9 9 0 0 0 0-18M1 12C1 5.925 5.925 1 12 1s11 4.925 11 11s-4.925 11-11 11S1 18.075 1 12" /><path d="m17.608 9l-7.726 7.726L6 12.093l1.511-1.31l2.476 3.01l6.207-6.207z" /></g></svg>') no-repeat center;
  -webkit-mask-size: contain;
}

/* Node type styling */
.task-node .node-card {
  border-left: 4px solid var(--brand-green);
}

.milestone-node .node-card {
  border-left: 4px solid var(--accent-purple);
}

.decision-node .node-card {
  border-left: 4px solid var(--accent-blue);
}

.document-node .node-card {
  border-left: 4px solid var(--accent-yellow);
}

.resource-node .node-card {
  border-left: 4px solid var(--accent-orange, #ff9800);
  position: relative;
}

/* Port styling */
.ports-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.input-ports {
  margin-right: -6px;
}

.output-ports {
  margin-left: -6px;
}

.port {
  width: 12px;
  height: 12px;
  background: var(--bg-secondary);
  border-radius: 50%;
  border: 2px solid var(--border-color);
  cursor: crosshair;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.port:hover {
  transform: scale(1.2);
  border-color: var(--brand-green);
}

.port:hover .port-connector {
  transform: scale(1.2);
}

.port-connector {
  width: 6px;
  height: 6px;
  background: var(--brand-green-light);
  border-radius: 50%;
}

/* Metadata styling */
.node-metadata {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--border-color);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.metadata-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.3rem;
}

.metadata-icon {
  flex-shrink: 0;
}

.metadata-value {
  white-space: nowrap;

  text-overflow: ellipsis;
}

/* Node controls */
.node-controls {
  display: flex;
  gap: 0.3rem;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.node-card:hover .node-controls {
  opacity: 1;
}

.node-control-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.2s ease;
}

.node-control-btn:hover {
  background: rgba(0, 0, 0, 0.05);
}

.delete-btn:hover {
  color: var(--error);
}

/* Node panel (n8n style) */
.node-panel {
  position: absolute;
  top: calc(100% + 10px);
  left: -20px;
  width: 280px;
  background: var(--bg-primary);
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  z-index: 101;

}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.panel-title {
  font-weight: 600;
  font-size: 0.95rem;
  color: var(--text-primary);
}

.panel-close-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: 4px;
    cursor: pointer;
    color: #666;
  }

  .panel-close-btn:hover {
    background: rgba(0, 0, 0, 0.05);
    color: #333;
  }

.panel-content {
  padding: 1rem;
  max-height: 350px;
  overflow-y: auto;
}

.panel-section {
  margin-bottom: 1.25rem;
}

.section-title {
  font-size: 0.8rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--text-secondary);
}

.empty-message {
  font-size: 0.85rem;
  color: var(--text-secondary);
  font-style: italic;
  padding: 0.5rem 0;
}

/* Connection styling in panel */
.panel-connection {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  border-radius: 4px;
  background: var(--neutral-50);
  margin-bottom: 0.5rem;
}

.connection-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.input-indicator {
  background: var(--brand-green);
}

.output-indicator {
  background: var(--accent-blue);
}

.connection-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.connection-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.remove-connection-btn {
  border: none;
  background: transparent;
  padding: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}
.empty-message {
  font-size: 0.75rem;
  color: var(--text-secondary);
  font-style: italic;
}
.remove-connection-btn:hover {
  opacity: 1;
  color: var(--error);
}

/* Functions styling */
.functions-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.function-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.5rem;
  border-radius: 4px;
  border: none;
  background: var(--neutral-100);
  cursor: pointer;
  font-size: 0.75rem;
}

.function-btn:hover {
  background: var(--neutral-200);
}

/* Input/Output section */
.io-section {
  display: flex;
  gap: 1rem;
}

.inputs-container, .outputs-container {
  flex: 1;
}

.io-title {
  font-size: 0.75rem;
  font-weight: 600;
  margin: 0 0 0.5rem 0;
  color: var(--text-secondary);
}

.connection-item {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem;
  background: var(--neutral-50);
  border-radius: 4px;
  margin-bottom: 0.3rem;
  font-size: 0.75rem;
}

.function-icon {
  margin-right: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.function-label {
  font-size: 0.85rem;
  font-weight: 500;
}
.functions-section {
  margin-bottom: 1rem;
}

/* Panel footer */
.panel-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border-color);
  display: flex;
  justify-content: flex-end;
}

.panel-btn {
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  border: none;
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.panel-execute-btn {
  background: var(--brand-green);
  color: white;
}

.panel-execute-btn:hover {
  background: var(--brand-green-dark);
  transform: translateY(-1px);
}

/* Expanded panel styling for resource nodes */
.expanded-panel {
  margin-top: 0.75rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--border-color);
}

.resource-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.resource-action-btn {
  display: flex;
  align-items: center;
  padding: 0.5rem;
  border: none;
  background: var(--neutral-100);
  border-radius: 4px;
  cursor: pointer;
  transition: all var(--transition-fast);
  font-size: 0.85rem;
  text-align: left;
  color: var(--text-primary);
}

.resource-action-btn:hover {
  background: var(--neutral-200);
  transform: translateY(-1px);
}

.action-icon {
  margin-right: 0.5rem;
  font-size: 1rem;
}

.action-label {
  font-size: 0.8rem;
}

/* Connection lines */
.connection-line {
  position: absolute;
  pointer-events: none;
  background: #94a3b8;
  height: 2px;
  transform-origin: 0 0;
  z-index: 1;
  
  /* Dynamic positioning */
  left: calc(var(--source-x) * 1px);
  top: calc(var(--source-y) * 1px);
  width: calc(var(--distance) * 1px);
  transform: rotate(calc(var(--angle) * 1deg));
}

@keyframes connection-pulse {
  0% { opacity: 0.4; }
  50% { opacity: 1; }
  100% { opacity: 0.4; }
}

</style>