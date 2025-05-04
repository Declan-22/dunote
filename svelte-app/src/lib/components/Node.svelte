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
  import { noteStore } from '$lib/stores/noteStore';
  import { user } from '$lib/stores/userStore';
  import { supabase } from '$lib/supabaseClient';
  export let contextNodeId: string | null;
  export let node: SiloNode;

  let isEditingTitle = false;
  export let siloId: string;
  export let scale: number = 1;
  const dispatch = createEventDispatcher();
  let isDragging = false;
  let isExpanded = false;

  let isNodePanelOpen = false;
  let startPos = { x: 0, y: 0 };
  let startNodePos = { x: 0, y: 0 };
  let nodeElement: HTMLElement | null = null;
  let nodePanelElement: HTMLDivElement;
  let titleInput: HTMLInputElement;
  let newTitle = node.title; 
  let isAddingComment = false;
  let commentText = '';
  // Add these variables to your script section
  let isContextMenuOpen = false;
  let contextMenuPosition = { x: 0, y: 0 };
  let isStatusDropdownOpen = false;

  let longPressTimeout: number;
  let touchStartTime = 0;

  // Add this function to get a short description
  function getShortDescription(text: string): string {
    const words = text.split(' ');
    return words.slice(0, 5).join(' ') + (words.length > 5 ? '...' : '');
  }

  
  $: nodeData = node.data || {};
  $: safeTitle = nodeData.title || nodeData.label || "Untitled Node";
  $: safeDescription = nodeData.description || (nodeData.original_text || ` He ${safeTitle}`);
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
    // Financial node functions
    case 'income':
      return [
        ...baseFunctions,
        { id: 'add_transaction', label: 'Add Transaction', icon: 'plus' },
        { id: 'categorize', label: 'Categorize', icon: 'tag' },
        { id: 'generate_report', label: 'Generate Report', icon: 'bar-chart' }
      ];
    case 'expense':
      return [
        ...baseFunctions,
        { id: 'add_expense', label: 'Add Expense', icon: 'plus' },
        { id: 'categorize', label: 'Categorize', icon: 'tag' },
        { id: 'set_recurrence', label: 'Set Recurrence', icon: 'repeat' }
      ];
    case 'goal':
      return [
        ...baseFunctions,
        { id: 'set_target', label: 'Set Target', icon: 'target' },
        { id: 'track_progress', label: 'Track Progress', icon: 'trending-up' },
        { id: 'adjust_timeline', label: 'Adjust Timeline', icon: 'calendar' }
      ];
    case 'invoice':
      return [
        ...baseFunctions,
        { id: 'create_invoice', label: 'Create Invoice', icon: 'file-plus' },
        { id: 'send_invoice', label: 'Send Invoice', icon: 'send' },
        { id: 'mark_paid', label: 'Mark as Paid', icon: 'check' }
      ];
    case 'budget':
      return [
        ...baseFunctions,
        { id: 'allocate_funds', label: 'Allocate Funds', icon: 'divide' },
        { id: 'compare_actual', label: 'Compare to Actual', icon: 'pie-chart' },
        { id: 'adjust_budget', label: 'Adjust Budget', icon: 'edit' }
      ];
    // Commission node functions
    case 'client':
      return [
        ...baseFunctions,
        { id: 'add_contact', label: 'Add Contact Info', icon: 'user-plus' },
        { id: 'view_history', label: 'View History', icon: 'clock' },
        { id: 'add_notes', label: 'Add Notes', icon: 'edit-3' }
      ];
    case 'deliverable':
      return [
        ...baseFunctions,
        { id: 'set_specifications', label: 'Set Specifications', icon: 'list' },
        { id: 'set_deadline', label: 'Set Deadline', icon: 'calendar' },
        { id: 'mark_delivered', label: 'Mark as Delivered', icon: 'package' }
      ];
    case 'contract':
      return [
        ...baseFunctions,
        { id: 'create_terms', label: 'Create Terms', icon: 'file-text' },
        { id: 'send_for_signature', label: 'Send for Signature', icon: 'send' },
        { id: 'mark_signed', label: 'Mark as Signed', icon: 'check-square' }
      ];
    case 'payment':
      return [
        ...baseFunctions,
        { id: 'record_payment', label: 'Record Payment', icon: 'dollar-sign' },
        { id: 'send_receipt', label: 'Send Receipt', icon: 'mail' },
        { id: 'schedule_payment', label: 'Schedule Payment', icon: 'calendar' }
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
  if (e.button === 2) { // Right click
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY);
    return;
  }
  
  // Handle normal drag start
  if (e.target && (e.target as HTMLElement).closest('.port, .context-menu, .edit-popup')) {
    return;
  }
  
  isDragging = true;
  startPos = { x: e.clientX, y: e.clientY };
  startNodePos = { x: node.position.x, y: node.position.y };
  dispatch('dragstart', { node });
  e.stopPropagation();
}


function showContextMenu(x: number, y: number) {
  // Convert screen coordinates to viewport coordinates
  const viewportX = (x - viewport.x) / viewport.zoom;
  const viewportY = (y - viewport.y) / viewport.zoom;
  
  // Convert to local node coordinates
  contextMenuPosition = {
    x: viewportX - node.position.x,
    y: viewportY - node.position.y
  };
  isContextMenuOpen = true;

  // Close context menu when clicking outside
  setTimeout(() => {
    window.addEventListener('click', closeContextMenuOnClickOutside);
  }, 10);
}

function closeContextMenu() {
  isContextMenuOpen = false;
  isStatusDropdownOpen = false;
  window.removeEventListener('click', closeContextMenuOnClickOutside);
}

function closeContextMenuOnClickOutside(e: MouseEvent) {
  if (nodeElement && !nodeElement.contains(e.target as Node)) {
    closeContextMenu();
  }
}

// Add touch support for mobile
function handleTouchStart(e: TouchEvent) {
  e.preventDefault();
  
  // Track time for distinguishing between tap and long press
  touchStartTime = Date.now();
  
  // Set long press timeout
  longPressTimeout = window.setTimeout(() => {
    const touch = e.touches[0];
    showContextMenu(touch.clientX, touch.clientY);
  }, 500); // 500ms for long press
  
  // Normal drag start
  if (e.target && !(e.target as HTMLElement).closest('.port, .context-menu, .edit-popup')) {
    isDragging = true;
    const touch = e.touches[0];
    startPos = { x: touch.clientX, y: touch.clientY };
    startNodePos = { x: node.position.x, y: node.position.y };
    dispatch('dragstart', { node });
  }
  
  e.stopPropagation();
}

function handleTouchMove(e: TouchEvent) {
  // Clear long press timeout on move
  window.clearTimeout(longPressTimeout);
  
  if (!isDragging) return;
  
  const touch = e.touches[0];
  const dx = (touch.clientX - startPos.x) / viewport.zoom;
  const dy = (touch.clientY - startPos.y) / viewport.zoom;
  
  dispatch('drag', { dx, dy, nodeId: node.id });
  e.stopPropagation();
}

function handleTouchEnd(e: TouchEvent) {
  // Clear long press timeout
  window.clearTimeout(longPressTimeout);
  
  // Check if this was a quick tap (not a long press or drag)
  const touchDuration = Date.now() - touchStartTime;
  if (touchDuration < 500 && !isDragging) {
    // Handle tap if needed
  }
  
  if (isDragging) {
    dispatch('dragend', { nodeId: node.id });
    isDragging = false;
  }
  
  e.stopPropagation();
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
  e.preventDefault(); // Prevent other handlers
  
  const portElement = e.currentTarget as HTMLElement;
  const rect = portElement.getBoundingClientRect();
  const portIndex = parseInt(portElement.dataset.portIndex || '0');
  
  // Calculate position in screen coordinates
  const position = {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2
  };
  
  console.log("Port mouse down:", node.id, position, isOutput);
  
  dispatch('connectionstart', { 
    nodeId: node.id,
    position,
    isOutput,
    portIndex
  });
}

function handlePortMouseOver(e: MouseEvent, isOutput: boolean) {
  e.stopPropagation();
  
  const portElement = e.currentTarget as HTMLElement;
  const portIndex = parseInt(portElement.dataset.portIndex || '0');
  
  // Dispatch a hover event
  dispatch('porthover', {
    nodeId: node.id,
    isOutput,
    portIndex
  });
}

function handlePortMouseUp(e: MouseEvent, isOutput: boolean) {
  e.stopPropagation();
  e.preventDefault(); // Prevent other handlers
  
  const portElement = e.currentTarget as HTMLElement;
  const portIndex = parseInt(portElement.dataset.portIndex || '0');
  
  console.log("Port mouse up:", node.id, isOutput);
  
  dispatch('connectionend', {
    nodeId: node.id,
    isOutput,
    portIndex
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
  async function saveTitle() {
  if (!newTitle.trim()) {
    newTitle = node.title;
    isEditingTitle = false;
    return;
  }

  isEditingTitle = false;
  
  try {
    // Update local store
    siloStore.update(stores => stores.map(s => ({
      ...s,
      nodes: s.nodes.map(n => n.id === node.id ? {...n, title: newTitle.trim()} : n)
    })));

    // Update database
    const { error } = await supabase
      .from('nodes')
      .update({ title: newTitle.trim() })
      .eq('id', node.id);

    if (error) throw error;
  } catch (err) {
    console.error('Failed to update node title:', err);
  }
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
    dispatch('updatenode', { 
      nodeId: node.id,
      updates: {
        data: {
          ...node.data,
          status: status,
          updated_at: new Date().toISOString()
        }
      }
    });
    isStatusDropdownOpen = false;
    dispatch('update'); // Trigger output refresh
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
    // Add right-click handler to prevent browser context menu
    if (nodeElement) {
      nodeElement.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e.clientX, e.clientY);
      });
      
      // Add touch event listeners for mobile
      nodeElement.addEventListener('touchstart', handleTouchStart, { passive: false });
      nodeElement.addEventListener('touchmove', handleTouchMove, { passive: false });
      nodeElement.addEventListener('touchend', handleTouchEnd);
    }
    
    return () => {
      document.removeEventListener('click', handleClickOutside);
      if (nodeElement) {
        nodeElement.removeEventListener('contextmenu', (e) => {
          e.preventDefault();
          showContextMenu(e.clientX, e.clientY);
        });
        nodeElement.removeEventListener('touchstart', handleTouchStart);
        nodeElement.removeEventListener('touchmove', handleTouchMove);
        nodeElement.removeEventListener('touchend', handleTouchEnd);
      }
      window.removeEventListener('click', closeContextMenuOnClickOutside);
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
  const inputPortEl = nodeElement.querySelector('.input-port');
  const outputPortEl = nodeElement.querySelector('.output-port');
  
  if (!inputPortEl || !outputPortEl) return;
  
  const inputRect = inputPortEl.getBoundingClientRect();
  const outputRect = outputPortEl.getBoundingClientRect();
  
  // Calculate port positions relative to the node's top-left corner
  const portPositions = {
    input: {
      x: (inputRect.left + inputRect.width/2) - nodeRect.left,
      y: (inputRect.top + inputRect.height/2) - nodeRect.top
    },
    output: {
      x: (outputRect.left + outputRect.width/2) - nodeRect.left,
      y: (outputRect.top + outputRect.height/2) - nodeRect.top
    }
  };
  
  // Update the node's port positions in the store
  setNodePortPositions(siloId, node.id, portPositions);
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
  export function getFunctionIcon(iconName: string): string {
  const icons: Record<string, string> = {
    // Basic function icons
    'play': '<polygon points="5 3 19 12 5 21 5 3"></polygon>',
    'rotate-cw': '<polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>',
    'filter': '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>',
    'git-merge': '<circle cx="18" cy="18" r="3"></circle><circle cx="6" cy="6" r="3"></circle><path d="M6 21V9a9 9 0 0 0 9 9"></path>',
    'scissors': '<circle cx="6" cy="6" r="3"></circle><circle cx="6" cy="18" r="3"></circle><line x1="20" y1="4" x2="8.12" y2="15.88"></line><line x1="14.47" y1="14.48" x2="20" y2="20"></line><line x1="8.12" y1="8.12" x2="12" y2="12"></line>',
    
    // Resource function icons
    'copy': '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>',
    'paste': '<path d="M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z"></path><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"></path><path d="M16 4h2a2 2 0 0 1 2 2v4"></path><path d="M21 14H11"></path><path d="m15 10-4 4 4 4"></path>',
    'message-square': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>',
    'file-text': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>',
    'book': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>',
    
    // Task function icons
    'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>',
    'shield': '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
    'flag': '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>',
    
    // Additional function icons
    'plus': '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
    'user': '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
    'calendar': '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line>',
    'extract': '<path d="M10 1.5V9h-8.5"></path><path d="M16 3.8c.8.8 1.5 1.5 2.3 2.3"></path><path d="M14 12v7.5L1 12"></path><path d="M5 15h14v6"></path>',
    'summarize': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line>'
  };
  
  return icons[iconName] || '<circle cx="12" cy="12" r="10"></circle>'; // Default circle icon
}
</script>



<div class="node {nodeClass}" 
  bind:this={nodeElement}
  class:dragging={isDragging}
 style="left: {node.position.x}px; top: {node.position.y}px; opacity: {contextNodeId ? (contextNodeId === node.id ? 1 : 0.3) : 1};"
  on:mousedown={handleMouseDown}
  on:mousemove={handleMouseMove}
  on:mouseup={handleMouseUp}
>

  <!-- Status Indicators -->
  {#if node.data.isRunning}
  <div class="node-running-indicator" transition:fade={{ duration: 200 }}>
    <div class="spinner"></div>
  </div>
{:else if node.data.status === 'not-started'}
  <div class="node-error-indicator" transition:fade={{ duration: 200 }}>
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  </div>
{:else if node.data.status === 'completed' || (node.data.isComplete && node.data.status !== 'not-started')}
  <div class="node-complete-indicator" transition:fade={{ duration: 200 }}>
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 6L9 17l-5-5"></path>
    </svg>
  </div>
{:else if node.data.error}
  <div class="node-error-indicator" transition:fade={{ duration: 200 }}>
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  </div>
{/if}
  <!-- Input port (left side) -->
  {#if shouldHaveInputPort(node.type)}
    <div 
      class="port input-port" 
      data-port-type="input"
      data-port-index="0"
      on:mousedown={(e) => handlePortMouseDown(e, false)}
      on:mouseup={(e) => handlePortMouseUp(e, false)}
      on:mouseover={(e) => handlePortMouseOver(e, false)}
    >
      <div class="port-dot"></div>
    </div>
  {/if}
  
<!-- Node content -->
<div class="node-container" style="background: transparent">
  <!-- Main circular node with icon -->
  <div class="node-circle" style="background-color: var(--bg-primary)">
    <div class="node-icon">
      {#if node.type === 'task'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2"></rect>
          <path d="m9 12 2 2 4-4"></path>
        </svg>
      {:else if node.type === 'milestone'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M12 6v6l4 2"></path>
        </svg>
      {:else if node.type === 'resource'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"></path>
        </svg>
      {:else if node.type === 'project'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3h18v18H3V3z"></path>
          <path d="M9 3v18"></path>
          <path d="M3 9h18"></path>
        </svg>
      {:else if node.type === 'output'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 17l5-5-5-5"></path>
          <path d="M12 12h10"></path>
          <path d="M3 4v16"></path>
        </svg>
      {:else if node.type === 'extract'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 10h18"></path>
          <path d="M3 14h18"></path>
          <path d="m8 18 4 4 4-4"></path>
          <path d="m16 6-4-4-4 4"></path>
        </svg>
      {:else if node.type === 'summarize'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
      {:else if node.type === 'transform'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path>
          <path d="M13 13h6"></path>
          <path d="M16 16v-6"></path>
        </svg>
      {:else if node.type === 'webhook'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
        </svg>
      {:else if node.type === 'schedule'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 16 14"></polyline>
        </svg>
      {:else if node.type === 'event'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      {:else if node.type === 'apiKey'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2"></rect>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
        </svg>
      {:else if node.type === 'oauth'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"></path>
        </svg>
      {:else if node.type === 'code'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m18 16 4-4-4-4"></path>
          <path d="m6 8-4 4 4 4"></path>
          <path d="m14.5 4-5 16"></path>
        </svg>
      {:else if node.type === 'condition'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M8 2h8"></path>
          <path d="M4 6h16"></path>
          <path d="M2 10h20"></path>
          <path d="M14 18h2"></path>
          <path d="M8 18h2"></path>
          <path d="M16 22h2"></path>
          <path d="M6 22h2"></path>
          <path d="m22 14-4.5 4.5"></path>
          <path d="m21 18.5-4.5-4.5"></path>
          <path d="m2 14 4.5 4.5"></path>
          <path d="m2.5 18.5 4.5-4.5"></path>
          <path d="M12 22v-6.5"></path>
        </svg>
      {:else if node.type === 'income'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 17a5 5 0 0 0 10 0c0-2.5-2.5-3-2.5-3s2.5-.5 2.5-3a5 5 0 0 0-10 0"></path>
          <path d="M14 17a5 5 0 0 0 10 0c0-2.5-2.5-3-2.5-3s2.5-.5 2.5-3a5 5 0 0 0-10 0"></path>
        </svg>
      {:else if node.type === 'expense'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"></path>
          <path d="M12 18V6"></path>
        </svg>
      {:else if node.type === 'goal'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <circle cx="12" cy="12" r="6"></circle>
          <circle cx="12" cy="12" r="2"></circle>
        </svg>
      {:else if node.type === 'invoice'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <path d="M14 2v6h6"></path>
          <path d="M16 13H8"></path>
          <path d="M16 17H8"></path>
          <path d="M10 9H8"></path>
        </svg>
      {:else if node.type === 'budget'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
        </svg>
      {:else if node.type === 'client'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
          <circle cx="9" cy="7" r="4"></circle>
          <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
        </svg>
      {:else if node.type === 'deliverable'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
          <polyline points="3.29 7 12 12 20.71 7"></polyline>
          <line x1="12" y1="22" x2="12" y2="12"></line>
        </svg>
      {:else if node.type === 'contract'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M20 11.08V8l-6-6H6a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h6"></path>
          <path d="M14 3v5h5"></path>
          <path d="M18 21v-8"></path>
          <path d="M15 16l3 3 3-3"></path>
        </svg>
      {:else if node.type === 'payment'}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="5" width="20" height="14" rx="2"></rect>
          <line x1="2" y1="10" x2="22" y2="10"></line>
        </svg>
      {:else}
        <!-- Default fallback icon -->
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
        </svg>
      {/if}
    </div>
  </div>

    
    <!-- Node label and description -->
    <div class="node-info" >
      <div class="node-title">
        {node.title}</div>
      <div class="node-description">{nodeData.shortDescription || getShortDescription(safeDescription)}</div>
    </div>
  </div>
  
  <!-- Output port (right side) -->
  {#if shouldHaveOutputPort(node.type)}
    <div 
      class="port output-port"
      data-port-type="output" 
      data-port-index="0"
      on:mousedown={(e) => handlePortMouseDown(e, true)}
      on:mouseup={(e) => handlePortMouseUp(e, true)}
    >
      <div class="port-dot"></div>
    </div>
  {/if}

    <!-- Result Panel -->
    {#if node.data.result && isExpanded}
    <div class="node-result-panel" transition:fly={{ y: 20, duration: 200 }}>
      <h4>Result</h4>
      {#if node.data.result.type === 'resource'}
        <p><strong>URL:</strong> {node.data.result.url}</p>
        <p><strong>Summary:</strong> {node.data.result.summary}</p>
      {:else if node.data.result.type === 'task'}
        <p><strong>Status:</strong> {node.data.result.new_status}</p>
        <p><strong>Completed:</strong> {node.data.result.completed ? 'Yes' : 'No'}</p>
      {:else if node.data.result.type === 'milestone'}
        <p><strong>Achieved:</strong> {node.data.result.achieved ? 'Yes' : 'No'}</p>
        <p><strong>Dependencies:</strong> {node.data.result.dependency_count}</p>
      {:else if node.data.result.type === 'project'}
        <p><strong>Progress:</strong> {node.data.result.progress}%</p>
        <p><strong>Tasks:</strong> {node.data.result.tasks_completed}/{node.data.result.tasks_total}</p>
      {:else}
        <pre class="result-json">{JSON.stringify(node.data.result, null, 2)}</pre>
      {/if}
      <p class="result-timestamp">Last run: {new Date(node.data.lastRun).toLocaleString()}</p>
    </div>
  {/if}
  
  <!-- Context menu (shown on right-click or long press) -->
  {#if isContextMenuOpen}
  <div class="context-menu" 
       transition:fade={{ duration: 150 }}
       style="transform: translate({contextMenuPosition.x}px, {contextMenuPosition.y}px)">
      <div class="menu-header">
        <span>{node.title}</span>
        <button class="close-btn" on:click|stopPropagation={closeContextMenu}>×</button>
      </div>
    {#if node.type === 'resource'}
      <div class="menu-section">
        <div class="menu-item" on:click|stopPropagation={() => executeFunction('update_resource')}>
          <svg><!-- document icon --></svg>
          <span>Update Source</span>
        </div>
      </div>
      {/if}
      
      <div class="menu-section">
        <div class="menu-item" on:click|stopPropagation={handleEditTitle}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          <span>Edit Name</span>
        </div>
        <div class="menu-item" on:click|stopPropagation={toggleComment}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          <span>Add Comment</span>
        </div>
        <div class="menu-item status-selector" on:click|stopPropagation={toggleStatusDropdown}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
          <span>Status: {getStatusDisplay(node.data.status || 'not-started')}</span>
        </div>
        {#if isStatusDropdownOpen}
          <div class="status-options">
            {#each statusOptions as status}
              <div class="status-option status-{status}" 
                   class:selected={node.data.status === status}
                   on:click|stopPropagation={() => updateStatus(status)}>
                {getStatusDisplay(status)}
              </div>
            {/each}
          </div>
        {/if}
      </div>
      
      <div class="menu-section">
        <div class="section-title">Functions</div>
        {#each nodeFunctions as func}
          <div class="menu-item" on:click|stopPropagation={() => executeFunction(func.id)}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              {@html getFunctionIcon(func.icon)}
            </svg>
            <span>{func.label}</span>
          </div>
        {/each}
      </div>
      
      <div class="menu-section danger">
        <div class="menu-item delete" on:click|stopPropagation={handleDeleteNode}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <span>Delete Node</span>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Title editing popup -->
  {#if isEditingTitle}
    <div class="edit-popup" transition:fade={{ duration: 150 }}>
      <input 
        type="text" 
        bind:value={newTitle} 
        bind:this={titleInput}
        on:keydown={handleTitleKeydown}
        on:blur={saveTitle}
      />
      <div class="edit-actions">
        <button class="cancel-btn" on:click|stopPropagation={() => isEditingTitle = false}>Cancel</button>
        <button class="save-btn" on:click|stopPropagation={saveTitle}>Save</button>
      </div>
    </div>
  {/if}

  <!-- Add this section for resource input -->
{#if node.type === 'resource' && isNodePanelOpen}
<div class="resource-panel">
  <div class="form-group">
    <label>Source Title</label>
    <input 
      type="text" 
      bind:value={node.data.sourceTitle}
      placeholder="Enter source title"
    />
  </div>
  <div class="form-group">
    <label>Source URL/Content</label>
    <textarea
      bind:value={node.data.sourceContent}
      placeholder="Paste URL or content"
    />
  </div>
  <button on:click|stopPropagation={saveResource}>Save Source</button>
</div>
{/if}
  
  <!-- Comment input popup -->
  {#if isAddingComment}
    <div class="edit-popup" transition:fade={{ duration: 150 }}>
      <input 
        type="text" 
        placeholder="Add a comment..." 
        bind:value={commentText}
        on:keydown={handleCommentKeydown}
      />
      <div class="edit-actions">
        <button class="cancel-btn" on:click|stopPropagation={cancelComment}>Cancel</button>
        <button class="save-btn" on:click|stopPropagation={saveComment}>Add</button>
      </div>
    </div>
  {/if}
  
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
</div>

<style>
  .node {
    position: absolute;
    display: flex;
    align-items: center;
    padding: 0;
    user-select: none;
    z-index: 1;

    transition: transform 0.1s ease;
    background: transparent;
    border: transparent;

  }
  
  .node:hover {

    z-index: 2;
  }
  
  .node-container {
    display: flex;
    align-items: center;
    height: 60px;
    border: transparent;
    padding-left: 8px;
    
  }
  
  .node-circle {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-primary);
    margin-right: 10px;
    transition: transform 0.2s ease;
    border-color: var(--text-primary);
    border-width: 1px;
    margin-left:-6px;
  }
  
  .node:hover .node-circle {
    transform: scale(1.1);

  }
  
  .node-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    max-width: 160px;
    padding-top: 20px;
    padding-right: 12px;

  }
  
  .node-title {
    font-weight: 500;
    font-size: 14px;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

  }
  
  .node-description {
    font-size: 12px;
    color: transparent;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .port {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: transparent;

    position: relative;
    cursor: pointer;
    z-index: 3;
    transition: transform 0.2s ease, background-color 0.2s ease;
  }
  
  .port:hover {
    transform: scale(.8);
    border: 2px solid var(--text-primary);
  }
  
  .input-port {
    margin-right: -6px;
  }
  
  .output-port {
    margin-left: -6px;
  }
  
  .port-connector {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: transparent;
  }
  
  .context-menu {
    position: absolute;
    transform: scale(0.85);
    transform-origin: top left;
    will-change: transform;
    top: 0;
    left: 0;
    width: 150px;
    background-color: var(--bg-secondary);
    border-radius: 4px; 
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    z-index: 10;
    font-size: 0.9em; 
    
  }
  
  .menu-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px;
    border-bottom: 1px solid #444;
    font-weight: 500;
  }
  
  .close-btn {
    background: none;
    border: none;
    color: #999;
    font-size: 18px;
    cursor: pointer;
    padding: 0 3px;
    font-size: 16px;
  }
  
  .menu-section {
    padding: 8px 0;
    gap: 4px;
    border-bottom: 1px solid #444;
  }
  
  .menu-section:last-child {
    border-bottom: none;
  }
  
  .section-title {
    font-size: 11px;
    color: #999;
    padding: 0 8px 4px;
  }
  
  .menu-item {
    display: flex;
    align-items: center;
    padding: 6px 8px; /* Reduced padding */
    font-size: 12px; /* Smaller text */
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .menu-item:hover {
    background-color: #444;
  }
  
  .menu-item svg {
    width: 12px; /* Smaller icons */
    height: 12px;
    margin-right: 6px;
  }
  
  .menu-item.delete {
    color: #ff5555;
  }
  
  .status-options {
    margin: 0 10px;
    background-color: #222;
    border-radius: 4px;
  }
  
  .status-option {
    padding: 4px 8px;
    font-size: 11px;
    cursor: pointer;
    border-radius: 4px;
    margin: 2px 0;
  }
  
  .status-option:hover {
    background-color: #333;
  }
  
  .status-not-started {
    border-left: 3px solid #999;
  }
  
  .status-in-progress {
    border-left: 3px solid #3498db;
  }
  
  .status-completed {
    border-left: 3px solid #2ecc71;
  }
  
  .edit-popup {
    position: absolute;
    top: -40px;
    left: 50%;
    transform: translateX(-50%);
    background-color: #2a2a2a;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    padding: 10px;
    z-index: 10;
    width: 200px;
  }
  
  .edit-popup input {
    width: 100%;
    padding: 6px 8px;
    background-color: #333;
    border: 1px solid #555;
    border-radius: 4px;
    color: #fff;
    margin-bottom: 8px;
  }
  
  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  
  .edit-actions button {
    padding: 4px 8px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .cancel-btn {
    background-color: #555;
    color: #fff;
  }
  
  .save-btn {
    background-color: var(--brand-green-light, #4ade80);
    color: #111;
  }
  
  .node-comments {
    position: absolute;
    top: -30px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 5px;
    max-width: 200px;
    flex-wrap: wrap;
    justify-content: center;
  }
  
  .comment-tag {
    background-color: rgba(74, 222, 128, 0.2);
    border: 1px solid var(--brand-green-light, #4ade80);
    color: var(--brand-green-light, #4ade80);
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 10px;
    display: flex;
    align-items: center;
  }
  
  .remove-comment {
    background: none;
    border: none;
    color: var(--brand-green-light, #4ade80);
    margin-left: 4px;
    cursor: pointer;
    font-size: 14px;
    line-height: 1;
    padding: 0 2px;
  }
  
  /* Node type specific styling */
  .task-node .node-circle {
    background-color: #3498db;
  }
  
  .milestone-node .node-circle {
    background-color: #9b59b6;
  }
  
  .resource-node .node-circle {
    background-color: #2ecc71;
  }

  .node-running-indicator {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 20px;
    height: 20px;
    background: var(--bg-secondary);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--brand-green);
    z-index: 5;
  }

  .node-running-indicator .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid transparent;
    border-top-color: var(--brand-green);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .node-complete-indicator {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 20px;
    height: 20px;
    background: var(--brand-green);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    z-index: 5;
  }

  .node-error-indicator {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 20px;
    height: 20px;
    background: var(--error);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    z-index: 5;
  }

  .node-result-panel {
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 8px;
    margin-top: 8px;
    font-size: 0.8rem;
    max-width: 250px;
  }

  .node-result-panel h4 {
    margin: 0 0 6px 0;
    font-size: 0.9rem;
    color: var(--text-primary);
  }

  .node-result-panel p {
    margin: 4px 0;
    color: var(--text-secondary);
  }

  .result-json {
    font-family: monospace;
    font-size: 0.7rem;
    background: var(--bg-primary);
    padding: 4px;
    border-radius: 3px;
    overflow-x: auto;
    max-height: 100px;
  }

  .result-timestamp {
    font-size: 0.7rem;
    opacity: 0.7;
    text-align: right;
    margin-top: 6px;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>