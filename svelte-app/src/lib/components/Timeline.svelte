<script lang="ts">
	import { onMount, afterUpdate, tick } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { user } from '$lib/stores/userStore';
	import { siloStore } from '$lib/stores/siloStore';
	import { tweened } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { fade, slide } from 'svelte/transition';
	import type { Silo, SiloNode, SiloEdge } from '$lib/stores/siloStore';
	import { format, addDays } from 'date-fns';

  import { goto } from '$app/navigation';
  
  // Add these variables
  let showResourceModal = false;
  let selectedResource: SiloNode | null = null;
  let containerWidth = 0;

	export let siloId: string;
	let isLoading = true;
	let error: Error | null = null;
	let silo: Silo | undefined;
	let timeline: HTMLElement;
  let startDate: Date = new Date(); // Initialize with current date
  let endDate: Date = new Date();   // Initialize with current date
	let dateRange: Date[] = [];
	let viewMode: 'day' | 'week' | 'month' = 'week';
	let isDragging = false;
	let dragStartX = 0;
	let dragStartScrollLeft = 0;
	let scrollPosition = tweened(0, {
		duration: 300,
		easing: cubicOut
	});

  let draggedTask: SiloNode | null = null;
  let dragType: 'move' | 'resize-start' | 'resize-end' | null = null;
  let originalTaskDate: Date | null = null;
  let originalTaskDuration: number = 0;

  
	let currentDateRange = '';
	let showDone = false;
	let bookmarkedTasks: Set<string> = new Set();

	// Define some default colors for task gradients
	const taskColors = [
		{ start: '#ffa07a', end: '#ff7f50' }, // Coral
		{ start: '#87cefa', end: '#1e90ff' }, // Light blue
		{ start: '#98fb98', end: '#3cb371' }, // Green
		{ start: '#dda0dd', end: '#9370db' }, // Purple
		{ start: '#fffacd', end: '#ffd700' }  // Yellow
	];

	$: silo = $siloStore.find(s => s.id === siloId);
	$: taskNodes = (silo?.nodes || []).filter(n => n.type === 'task') || [];
	$: resourceNodes = (silo?.nodes || []).filter(n => n.type === 'resource') || [];
	$: projectNodes = (silo?.nodes || []).filter(n => n.type === 'project') || [];
	$: filteredTasks = showDone 
		? taskNodes 
		: taskNodes.filter(task => !task.data?.isComplete);

    onMount(() => { // Remove async from onMount declaration
    (async () => { // Use IIFE for async operations
      isLoading = true;
      if ($user) {
        await loadSiloData();
        initializeTimeline();
      }
      isLoading = false;
    })();

    // Event listeners setup
    if (timeline) {
      timeline.addEventListener('mousedown', handleMouseDown);
      // ... other listeners
    }

    return () => { // Cleanup function directly returned
      if (timeline) {
        timeline.removeEventListener('mousedown', handleMouseDown);
        // ... other cleanup
      }
    };
  });

	async function loadSiloData() {
		// This would load your silo data if needed
		// Assuming the siloStore already handles this
		await tick();
	}

  function initializeTimeline() {
  // Get dates from tasks or default to current week
  const taskDates = taskNodes
    .map(task => task.data?.dueDate)
    .filter(date => date)
    .map(date => new Date(date));

  if (taskDates.length > 0) {
    // Sort dates and get min and max
    taskDates.sort((a, b) => a.getTime() - b.getTime());
    startDate = taskDates[0];
    endDate = taskDates[taskDates.length - 1];
    
    // Add buffer days
    startDate.setDate(startDate.getDate() - 2);
    endDate.setDate(endDate.getDate() + 2);
  } else {
    // Default to current week
    startDate = new Date();
    startDate.setDate(startDate.getDate() - startDate.getDay()); // Start on Sunday
    endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 13); // Show 2 weeks
  }

  // Generate date range for display
  regenerateDateRange();
  
  // Set initial date range display
  updateDateRangeDisplay();
  
  // Set initial scroll position to show today
  setTimeout(() => {
    const today = new Date();
    const daysSinceStart = Math.floor((today.getTime() - startDate.getTime()) / (86400000));
    const totalDays = dateRange.length;
    const scrollPercent = daysSinceStart / totalDays;
    
    timeline.scrollLeft = timeline.scrollWidth * scrollPercent;
  }, 100);
}

	function regenerateDateRange() {
		dateRange = [];
		let currentDate = new Date(startDate);
		
		while (currentDate <= endDate) {
			dateRange.push(new Date(currentDate));
			currentDate.setDate(currentDate.getDate() + 1);
		}
	}

	function updateDateRangeDisplay() {
		const start = format(startDate, 'd MMM');
		const end = format(endDate, 'd MMM');
		currentDateRange = `${start} - ${end}`;
	}

  function setViewMode(mode: 'day' | 'week' | 'month') {
    viewMode = mode;
    goto(`?view=${mode}`, { replaceState: true });
		// Adjust the date range based on view mode
		const today = new Date();
		
		if (mode === 'day') {
			startDate = today;
			endDate = today;
		} else if (mode === 'week') {
			startDate = new Date(today);
			startDate.setDate(today.getDate() - today.getDay()); // Start on Sunday
			endDate = new Date(startDate);
			endDate.setDate(endDate.getDate() + 6); // Show 1 week
		} else if (mode === 'month') {
			startDate = new Date(today.getFullYear(), today.getMonth(), 1);
			endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
		}
		
		regenerateDateRange();
		updateDateRangeDisplay();
	}

	function navigatePrevious() {
		if (viewMode === 'day') {
			startDate.setDate(startDate.getDate() - 1);
			endDate.setDate(endDate.getDate() - 1);
		} else if (viewMode === 'week') {
			startDate.setDate(startDate.getDate() - 7);
			endDate.setDate(endDate.getDate() - 7);
		} else if (viewMode === 'month') {
			startDate.setMonth(startDate.getMonth() - 1);
			endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
		}
		
		regenerateDateRange();
		updateDateRangeDisplay();
	}

	function navigateNext() {
		if (viewMode === 'day') {
			startDate.setDate(startDate.getDate() + 1);
			endDate.setDate(endDate.getDate() + 1);
		} else if (viewMode === 'week') {
			startDate.setDate(startDate.getDate() + 7);
			endDate.setDate(endDate.getDate() + 7);
		} else if (viewMode === 'month') {
			startDate.setMonth(startDate.getMonth() + 1);
			endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
		}
		
		regenerateDateRange();
		updateDateRangeDisplay();
	}

  function handleTaskMouseDown(e: MouseEvent, task: SiloNode, type: 'move' | 'resize-start' | 'resize-end') {
  // Prevent timeline dragging when interacting with tasks
  e.stopPropagation();
  
  draggedTask = task;
  dragType = type;
  dragStartX = e.clientX;
  
  // Store original values
  originalTaskDate = task.data?.dueDate ? new Date(task.data.dueDate) : null;
  originalTaskDuration = task.data?.duration || 1;
  
  // Add global event listeners
  window.addEventListener('mousemove', handleTaskDragMove);
  window.addEventListener('mouseup', handleTaskDragEnd);
}

function handleTaskDragMove(e: MouseEvent) {
  if (!draggedTask || !dragType || !originalTaskDate) return;
  
  // Calculate days moved based on mouse movement and timeline width
  const timelineWidth = timeline.clientWidth;
  const daysTotal = dateRange.length;
  const pixelsPerDay = timelineWidth / daysTotal;
  const daysMoved = Math.round((e.clientX - dragStartX) / pixelsPerDay);
  
  if (daysMoved === 0) return;
  
  // Create updated task data
  const updatedTask = { ...draggedTask };
  
  if (dragType === 'move') {
    // Move the whole task
    const newDueDate = new Date(originalTaskDate);
    newDueDate.setDate(originalTaskDate.getDate() + daysMoved);
    updatedTask.data = { ...updatedTask.data, dueDate: newDueDate.toISOString() };
  } else if (dragType === 'resize-start') {
    // Resize from start (changing duration)
    const newDuration = Math.max(1, originalTaskDuration - daysMoved);
    updatedTask.data = { ...updatedTask.data, duration: newDuration };
  } else if (dragType === 'resize-end') {
    // Resize from end (changing duration)
    const newDuration = Math.max(1, originalTaskDuration + daysMoved);
    updatedTask.data = { ...updatedTask.data, duration: newDuration };
  }
  
  // Update in store
  const siloIndex = $siloStore.findIndex(s => s.id === siloId);
  if (siloIndex >= 0) {
    const nodeIndex = $siloStore[siloIndex].nodes.findIndex(n => n.id === draggedTask?.id);
    if (nodeIndex >= 0) {
      $siloStore[siloIndex].nodes[nodeIndex] = updatedTask;
    }
  }
}

function handleTaskDragEnd() {
  if (draggedTask) {
    saveNode(draggedTask);
  }
  
  // Reset drag state
  draggedTask = null;
  dragType = null;
  
  // Remove global event listeners
  window.removeEventListener('mousemove', handleTaskDragMove);
  window.removeEventListener('mouseup', handleTaskDragEnd);
}

function handleMouseDown(e: MouseEvent) {
  // Only initiate drag on middle button or when holding space
  if (e.button === 1 || spaceDown) {
    isDragging = true;
    dragStartX = e.pageX;
    dragStartScrollLeft = timeline.scrollLeft;
    timeline.style.cursor = 'grabbing';
    
    // Prevent text selection during drag
    e.preventDefault();
    document.body.style.userSelect = 'none';
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.code === 'Space') {
    spaceDown = true;
    timeline.style.cursor = 'grab';
  }
}

function handleKeyUp(e: KeyboardEvent) {
  if (e.code === 'Space') {
    spaceDown = false;
    timeline.style.cursor = 'default';
  }
}


let spaceDown = false;

	function handleMouseUp() {
		isDragging = false;
		timeline.style.cursor = 'grab';
	}

	function handleMouseMove(e: MouseEvent) {
		if (!isDragging) return;
		
		const x = e.pageX;
		const walk = (x - dragStartX) * 2; // Speed multiplier
		timeline.scrollLeft = dragStartScrollLeft - walk;
		$scrollPosition = timeline.scrollLeft;
	}

	function toggleBookmark(taskId: string) {
		if (bookmarkedTasks.has(taskId)) {
			bookmarkedTasks.delete(taskId);
		} else {
			bookmarkedTasks.add(taskId);
		}
		bookmarkedTasks = new Set(bookmarkedTasks); // Trigger reactivity
	}
  function getStatusColor(status: string) {
  switch(status.toLowerCase()) {
    case 'completed': return '#48bb78';
    case 'in-progress': return '#3182ce';
    case 'at-risk': return '#ed8936';
    case 'blocked': return '#e53e3e';
    case 'not-started': 
    default: return '#a0aec0';
  }
}

// Define the openResourceEditor function to fix that error
function openResourceEditor(resourceId: string) {
  return () => {
    if (!resourceId) return;
    goto(`/silo/${siloId}/resource/${resourceId}`);
  };
}

  function getTaskPosition(task: SiloNode): { left: string, width: string } {
  const dueDate = task.data?.dueDate ? new Date(task.data.dueDate) : null;
  if (!dueDate || !startDate || !endDate) return { left: '0%', width: '100px' };
  
  // Default task duration to 1 day if not specified
  const duration = task.data?.duration || 1;
  
  // Calculate position based on date range
  const startTs = startDate.getTime();
  const endTs = endDate.getTime();
  const totalDays = (endTs - startTs) / (1000 * 60 * 60 * 24);
  
  // Calculate task start date (due date - duration)
  const taskStartDate = new Date(dueDate);
  taskStartDate.setDate(taskStartDate.getDate() - duration + 1);
  
  // Calculate left position as percentage
  const daysSinceStart = (taskStartDate.getTime() - startTs) / (1000 * 60 * 60 * 24);
  const leftPercent = (daysSinceStart / totalDays) * 100;
  
  // Calculate width based on duration
  const widthPercent = (duration / totalDays) * 100;
  
  return {
    left: `${Math.max(0, leftPercent)}%`,
    width: `${Math.min(100, widthPercent)}%`
  };
}

	function getTaskColor(task: SiloNode) {
		// Use hash of task id to consistently assign colors
		const hashCode = Array.from(task.id).reduce((acc, char) => {
			return char.charCodeAt(0) + ((acc << 5) - acc);
		}, 0);
		
		const index = Math.abs(hashCode) % taskColors.length;
		
		// Return different style if bookmarked
		if (bookmarkedTasks.has(task.id)) {
			return {
				background: `linear-gradient(45deg, ${taskColors[index].start}, ${taskColors[index].end})`,
				opacity: 1
			};
		}
		
		// Regular task style
		return {
			background: task.data?.isComplete ? 'var(--bg-secondary)' : 'var(--bg-secondary)',
			opacity: task.data?.isComplete ? 0.7 : 1
		};
	}

	function getTaskConnections(task: SiloNode) {
		if (!silo) return [];
		
		// Find all edges where this task is the source
		return silo.edges.filter(edge => edge.source === task.id || edge.target === task.id);
	}
  
  function drawConnection(edge: SiloEdge) {
  if (!silo || !timeline) return null;
  
  const sourceNode = silo.nodes.find(n => n.id === edge.source);
  const targetNode = silo.nodes.find(n => n.id === edge.target);
  if (!sourceNode || !targetNode) return null;

  const sourceEl = timeline.querySelector(`[data-task-id="${sourceNode.id}"]`);
  const targetEl = timeline.querySelector(`[data-task-id="${targetNode.id}"]`);
  if (!sourceEl || !targetEl) return null;

  const sourceRect = sourceEl.getBoundingClientRect();
  const targetRect = targetEl.getBoundingClientRect();
  
  // Determine ports (right side of source, left side of target)
  const sourcePort = {
    x: sourceRect.right,
    y: sourceRect.top + sourceRect.height / 2
  };
  
  const targetPort = {
    x: targetRect.left,
    y: targetRect.top + targetRect.height / 2
  };
  
  // Calculate offset to route the line around other tasks
  const timelineRect = timeline.getBoundingClientRect();
  const midX = (sourcePort.x + targetPort.x) / 2;
  const offsetY = Math.min(30, Math.abs(sourcePort.y - targetPort.y) / 2);
  
  // Create a path that routes around obstacles
  let path;
  if (sourcePort.x < targetPort.x) {
    // Simple case: source is to the left of target
    path = `
      M ${sourcePort.x} ${sourcePort.y}
      C ${sourcePort.x + 20} ${sourcePort.y}, 
        ${targetPort.x - 20} ${targetPort.y}, 
        ${targetPort.x} ${targetPort.y}
    `;
  } else {
    // Complex case: source is to the right of target, need to route around
    path = `
      M ${sourcePort.x} ${sourcePort.y}
      C ${sourcePort.x + 20} ${sourcePort.y}, 
        ${sourcePort.x + 40} ${sourcePort.y - offsetY}, 
        ${midX} ${sourcePort.y - offsetY}
      L ${midX} ${targetPort.y + offsetY}
      C ${midX} ${targetPort.y + offsetY}, 
        ${targetPort.x - 40} ${targetPort.y + offsetY}, 
        ${targetPort.x} ${targetPort.y}
    `;
  }
  
  return {
    path,
    color: edge.data?.color || '#2563eb'
  };
}

    // Add container width tracking
    onMount(() => {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('keyup', handleKeyUp);
    const resizeObserver = new ResizeObserver(entries => {
      containerWidth = entries[0].contentRect.width;
    });
    if (timeline) resizeObserver.observe(timeline);
    return () => {
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
  };
});


	function getNodeStatus(node: SiloNode) {
		return node.data?.result?.new_status || node.data?.status || 'not-started';
	}

	function getNodePriority(node: SiloNode) {
		return node.data?.priority || 'medium';
	}

	function safeNodeTitle(node: SiloNode) {
		return node.title || 'Untitled Node';
	}

	function getPriorityColor(priority: string) {
		switch(priority.toLowerCase()) {
			case 'urgent': return '#f56565';
			case 'high': return '#ed8936';
			case 'medium': return '#ecc94b';
			case 'low': return '#48bb78';
			default: return '#a0aec0';
		}
	}

	function toggleNodeCompletion(node: SiloNode) {
		if (node && node.data) {
			node.data.isComplete = !node.data.isComplete;
			// Update the node in the siloStore
			$siloStore = [...$siloStore];
			saveNode(node);
		}
	}

	async function saveNode(node: SiloNode) {
		try {
			const { error } = await supabase
				.from('nodes')
				.update({ data: node.data })
				.eq('id', node.id);
			
			if (error) throw error;
		} catch (err) {
			console.error('Failed to save node:', err);
		}
	}
</script>

<div class="flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)] min-h-screen font-sans">
  <!-- Navigation Header --> 
  <div class="p-4 flex justify-between items-center border-b border-[var(--border-color)]">
    <div class="flex gap-2">
      <button on:click={() => setViewMode('day')} class="px-3 py-1 rounded-md {viewMode === 'day' ? 'bg-[var(--bg-secondary)] text-[var(--brand-accent)]' : ''}">
        Day
      </button>
      <button on:click={() => setViewMode('week')} class="px-3 py-1 rounded-md {viewMode === 'week' ? 'bg-[var(--bg-secondary)] text-[var(--brand-accent)]' : ''}">
        Week
      </button>
      <button on:click={() => setViewMode('month')} class="px-3 py-1 rounded-md {viewMode === 'month' ? 'bg-[var(--bg-secondary)] text-[var(--brand-accent)]' : ''}">
        Month
      </button>
    </div>

    <!-- Date Navigation -->
    <div class="flex items-center bg-[var(--bg-secondary)] rounded-md px-2 py-1">
      <button class="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" on:click={navigatePrevious}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M15 18l-6-6 6-6"/>
        </svg>
      </button>
      <span class="mx-2 text-sm font-medium">{currentDateRange}</span>
      <button class="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]" on:click={navigateNext}>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18l6-6-6-6"/>
        </svg>
      </button>
    </div>

    <!-- Right Controls -->
    <div class="flex items-center space-x-4">
      <label class="flex items-center space-x-2 text-sm text-[var(--text-secondary)] cursor-pointer">
        <span>Show done</span>
        <div class="relative w-10 h-5 bg-[var(--bg-secondary)] rounded-full">
          <input type="checkbox" bind:checked={showDone} class="sr-only" />
          <div class="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform {showDone ? 'translate-x-5' : 'translate-x-0.5'}"></div>
        </div>
      </label>
    </div>
  </div>

  <!-- Timeline Header -->
  <div class="flex border-b border-[var(--border-color)]">
    <div class="w-1/2 px-4 py-2 text-sm text-[var(--text-secondary)]">
      {format(startDate, 'MMMM yyyy')}
    </div>
    {#if format(startDate, 'MMMM yyyy') !== format(endDate, 'MMMM yyyy')}
      <div class="w-1/2 px-4 py-2 text-sm text-[var(--text-secondary)]">
        {format(endDate, 'MMMM yyyy')}
      </div>
    {/if}
  </div>

  <!-- Days of Week -->
  <div class="flex text-xs border-b border-[var(--border-color)] sticky top-0 z-30 bg-[var(--bg-primary)]">
    {#each dateRange as date, i}
      {@const isWeekend = [0, 6].includes(date.getDay())}
      {@const isToday = new Date().toDateString() === date.toDateString()}
      <div 
        class="flex-1 text-center py-2 relative border-r border-[var(--border-color)]
          {isWeekend ? 'bg-[var(--bg-secondary)]' : ''}"
        style={isWeekend ? 'background-image: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(var(--border-color-rgb), 0.1) 5px, rgba(var(--border-color-rgb), 0.1) 10px);' : ''}
      >
        <div class="text-xs text-[var(--text-secondary)]">{format(date, 'E')}</div>
        <div class="text-sm {isToday ? 'font-bold text-[var(--brand-accent)]' : ''}">
          {format(date, 'd')}
        </div>
        
        {#if isToday}
          <div class="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1/2 h-0.5 bg-[var(--brand-accent)]"></div>
        {/if}
      </div>
    {/each}
  </div>

  <!-- Timeline Content -->
  <div 
    class="relative flex-1 overflow-x-auto" 
    bind:this={timeline}
    on:mousedown={handleMouseDown}
    on:mouseup={handleMouseUp}
    on:mousemove={handleMouseMove}
    on:mouseleave={handleMouseUp}
  >
    <!-- Background Grid -->
    <div class="absolute inset-0 z-0">
      <div class="flex h-full">
        {#each dateRange as date, i}
          {@const isWeekend = [0, 6].includes(date.getDay())}
          <div 
            class="flex-1 h-full border-r border-[var(--border-color)] {isWeekend ? 'bg-[var(--bg-secondary)]' : ''}"
            style={isWeekend ? 'background-image: repeating-linear-gradient(-45deg, transparent, transparent 5px, rgba(var(--border-color-rgb), 0.1) 5px, rgba(var(--border-color-rgb), 0.1) 10px);' : ''}
          ></div>
        {/each}
      </div>
    </div>

    <!-- Connections -->
    <svg class="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
      {#each filteredTasks as task}
        {#each getTaskConnections(task) as edge}
          {@const connection = drawConnection(edge)}
          {#if connection}
            <path 
              d={connection.path} 
              stroke={connection.color} 
              fill="none" 
              stroke-width="2"
              stroke-dasharray="4"
            />
          {/if}
        {/each}
      {/each}
    </svg>

    <!-- Task Rows -->
    <div class="relative z-20">
      {#each filteredTasks as task, i}
        {@const position = getTaskPosition(task)}
        {@const style = getTaskColor(task)}
        {@const priority = getNodePriority(task)}
        {@const status = getNodeStatus(task)}
        
        <div class="h-16 relative group border-b border-[var(--border-color)]">
          <!-- Task Bar -->
          <div 
            data-task-id={task.id}
            class="absolute top-1/2 -translate-y-1/2 h-12 rounded-md shadow-sm px-2 flex items-center transition-transform duration-200 
                  border border-[var(--border-color)] hover:z-30 hover:shadow-md cursor-pointer"
            style="left: {position.left}; width: {position.width}; background: {style.background}; opacity: {style.opacity}; border-left: {style.borderLeft};"
            on:mousedown={(e) => handleTaskMouseDown(e, task, 'move')}
          >
            <!-- Left resize handle -->
            <div 
              class="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
              on:mousedown={(e) => handleTaskMouseDown(e, task, 'resize-start')}
            ></div>
            
            <!-- Task content -->
            <div class="flex flex-col w-full overflow-hidden py-1">
              <div class="flex items-center justify-between w-full">
                <span class="truncate text-sm font-medium text-[var(--text-primary)]">
                  {safeNodeTitle(task)}
                </span>
                <div class="flex items-center gap-1">
                  <!-- Status indicator -->
                  <div class="h-2 w-2 rounded-full" style="background-color: {getStatusColor(status)}"></div>
                  
                  <button 
                    on:click|stopPropagation={() => toggleBookmark(task.id)}
                    class="text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill={bookmarkedTasks.has(task.id) ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/>
                    </svg>
                  </button>
                </div>
              </div>
              
              {#if task.data?.resource}
                <div class="text-xs opacity-80 mt-0.5 truncate">
                  {task.data.resource}
                </div>
              {/if}
            </div>
            
            <!-- Connection ports -->
            <div class="absolute left-0 top-1/2 -translate-y-1/2 -ml-1.5 w-3 h-3 rounded-full bg-white border border-[var(--border-color)] opacity-0 group-hover:opacity-100"></div>
            <div class="absolute right-0 top-1/2 -translate-y-1/2 -mr-1.5 w-3 h-3 rounded-full bg-white border border-[var(--border-color)] opacity-0 group-hover:opacity-100"></div>
            
            <!-- Right resize handle -->
            <div 
              class="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
              on:mousedown={(e) => handleTaskMouseDown(e, task, 'resize-end')}
            ></div>
          </div>
        </div>
      {:else}
        <div class="py-12 text-center text-[var(--text-secondary)]">
          No tasks found in this time period
        </div>
      {/each}
    </div>
  </div>

  <!-- Resource Modal -->
  {#if showResourceModal && selectedResource}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" transition:fade>
      <div class="bg-[var(--bg-primary)] rounded-xl max-w-2xl w-full p-6" transition:slide>
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-xl font-semibold">{selectedResource.data?.title}</h2>
          <button on:click={() => showResourceModal = false} class="text-2xl">×</button>
        </div>
        
        <div class="prose max-h-[60vh] overflow-y-auto">
          {@html selectedResource.data?.content}
        </div>
        
        <div class="mt-4 flex gap-2 justify-end">
          <button 
            on:click={() => openResourceEditor(selectedResource.id)}
            class="px-4 py-2 bg-[var(--brand-accent)] text-white rounded-lg"
          >
            Edit
          </button>
          <button 
            on:click={() => showResourceModal = false}
            class="px-4 py-2 border border-[var(--border-color)] rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>


<style>

  /* Timeline scrolling behavior */
  :global(body.space-down) {
    cursor: grab !important;
  }
  
  :global(body.space-down:active) {
    cursor: grabbing !important;
  }

  .timeline-content {
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) var(--bg-secondary);
  }

  .timeline-content::-webkit-scrollbar {
    height: 8px;
    background: var(--bg-secondary);
  }

  .timeline-content::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
  }

  /* Task styling */
  .task-bar {
    transition: transform 0.2s, box-shadow 0.2s;
  }
  
  .task-bar:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
  
  /* Resize handles */
  .resize-handle {
    position: absolute;
    width: 8px;
    height: 100%;
    cursor: ew-resize;
    opacity: 0;
    transition: opacity 0.2s;
  }
  
  .task-bar:hover .resize-handle {
    opacity: 1;
  }
  .timeline-content {
    scrollbar-width: thin;
    scrollbar-color: var(--border-color) var(--bg-secondary);
  }

  .timeline-content::-webkit-scrollbar {
    height: 8px;
    background: var(--bg-secondary);
  }

  .timeline-content::-webkit-scrollbar-thumb {
    background: var(--border-color);
    border-radius: 4px;
  }


  .toggle {
    --toggle-size: 1.5rem;
    position: relative;
    width: calc(var(--toggle-size) * 2);
    height: var(--toggle-size);
    border-radius: var(--toggle-size);
    background: var(--border-color);
    transition: all 0.3s ease;
  }

  .toggle:checked {
    background: var(--brand-accent);
  }

  .toggle::before {
    content: '';
    position: absolute;
    left: 2px;
    top: 2px;
    width: calc(var(--toggle-size) - 4px);
    height: calc(var(--toggle-size) - 4px);
    background: white;
    border-radius: 50%;
    transition: transform 0.3s ease;
  }

  .toggle:checked::before {
    transform: translateX(calc(var(--toggle-size) - 4px));
  }
</style>