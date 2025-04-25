<script lang="ts">
    import { onMount, afterUpdate, tick } from 'svelte';
    import { siloStore } from '$lib/stores/siloStore';
    import { fade, slide } from 'svelte/transition';
    import type { Silo, SiloNode, SiloEdge } from '$lib/stores/siloStore';
    import { supabase } from '$lib/supabaseClient';
    import { user } from '$lib/stores/userStore';
    import { browser } from '$app/environment';
    import { formatDateStr, getDaysBetweenDates, formatTimeAgo } from '$lib/utils/dateUtils';
  
    export let siloId: string;
    export let spaceId: string;
  
    let silo: Silo | undefined;
    let isLoading = true;
    let error: Error | null = null;
    let viewMode: 'day' | 'week' | 'month' = 'week';
    let showDone = false;
    let currentTimelineStart: Date;
    let currentTimelineEnd: Date;
    let visibleDays: Date[] = [];
    let timelineItems: TimelineItem[] = [];
    let timelineContainerWidth = 0;
    let containerEl: HTMLElement;
    let isDragging = false;
    let dragStartX = 0;
    let scrollLeftStart = 0;
    let currentFilter = 'all';
    let currentSort = 'date';
    let isProcessing = false;
    let pendingTimelineUpdate = false;
  
    type TimelineItem = {
      id: string;
      title: string;
      type: 'task' | 'milestone' | 'resource' | 'project';
      dueDate?: Date;
      startDate?: Date;
      endDate?: Date;
      status: string;
      priority?: string;
      project?: string;
      color?: string;
      progress?: number;
      isComplete?: boolean;
      members?: string[];
      description?: string;
      connections?: string[];
      position?: number;
    };
  
    // Initialize timeline dates
    function initializeTimeline() {
      const today = new Date();
      
      // Set default date range - 2 weeks before and after today
      currentTimelineStart = new Date(today);
      currentTimelineStart.setDate(today.getDate() - 14);
      
      currentTimelineEnd = new Date(today);
      currentTimelineEnd.setDate(today.getDate() + 14);
      
      generateVisibleDays();
    }
  
    function generateVisibleDays() {
      visibleDays = [];
      let currentDate = new Date(currentTimelineStart);
      
      while (currentDate <= currentTimelineEnd) {
        visibleDays.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }
  
    function moveTimeline(direction: 'prev' | 'next') {
      const dayCount = getDaysBetweenDates(currentTimelineStart, currentTimelineEnd);
      
      if (direction === 'prev') {
        currentTimelineStart.setDate(currentTimelineStart.getDate() - dayCount);
        currentTimelineEnd.setDate(currentTimelineEnd.getDate() - dayCount);
      } else {
        currentTimelineStart.setDate(currentTimelineStart.getDate() + dayCount);
        currentTimelineEnd.setDate(currentTimelineEnd.getDate() + dayCount);
      }
      
      generateVisibleDays();
      generateTimelineItems();
    }

    function scrollToToday() {
  const today = new Date();
  const startTime = currentTimelineStart.getTime();
  const todayTime = today.getTime();
  const totalDays = getDaysBetweenDates(currentTimelineStart, currentTimelineEnd);
  const dayDiff = (todayTime - startTime) / (1000 * 60 * 60 * 24);
  
  const scrollPosition = (dayDiff / totalDays) * timelineContainerWidth;
  
  // Use smooth scrolling
  containerEl.scrollTo({
    left: scrollPosition - (containerEl.clientWidth / 2),
    behavior: 'smooth'
  });
}
  
    function changeViewMode(mode: 'day' | 'week' | 'month') {
      viewMode = mode;
      const today = new Date();
      
      // Reset date range based on view mode
      switch(mode) {
        case 'day':
          currentTimelineStart = new Date(today);
          currentTimelineStart.setDate(today.getDate() - 1);
          currentTimelineEnd = new Date(today);
          currentTimelineEnd.setDate(today.getDate() + 3);
          break;
        case 'week':
          currentTimelineStart = new Date(today);
          currentTimelineStart.setDate(today.getDate() - 7);
          currentTimelineEnd = new Date(today);
          currentTimelineEnd.setDate(today.getDate() + 14);
          break;
        case 'month':
          currentTimelineStart = new Date(today);
          currentTimelineStart.setDate(1);
          currentTimelineEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
          break;
      }
      
      generateVisibleDays();
      generateTimelineItems();
    }
  
    function getNodeDueDate(node: SiloNode): Date | null {
      if (!node.data?.dueDate) return null;
      return new Date(node.data.dueDate);
    }
    
    function getNodeStartDate(node: SiloNode): Date | null {
      if (!node.data?.startDate) return null;
      return new Date(node.data.startDate);
    }
  
    function getNodeProject(node: SiloNode): string {
      return node.data?.project || '';
    }
  
    function getNodePriority(node: SiloNode): string {
      return node.data?.priority || 'medium';
    }
  
    function getNodeStatus(node: SiloNode): string {
      return node.data?.result?.new_status || node.data?.status || 'not-started';
    }
  
    function getNodeMembers(node: SiloNode): string[] {
      return node.data?.members || [];
    }
  
    function safeNodeTitle(node: SiloNode) {
      return node.data?.title || 'Untitled Node';
    }
    
    function getItemColor(type: string, priority?: string, status?: string): string {
      if (type === 'milestone') return 'var(--brand-green)';
      if (type === 'project') return 'var(--brand-blue)';
      if (type === 'resource') return 'var(--brand-purple)';
      
      // For tasks, use priority colors
      switch(priority?.toLowerCase()) {
        case 'urgent': return '#ab0909';
        case 'high': return '#f23838';
        case 'medium': return '#F59E0B';
        case 'low': return '#10B981';
        default: return '#047857';
      }
    }
  
    function generateTimelineItems() {
    if (isProcessing) {
      pendingTimelineUpdate = true;
      return;
    }
    
    isProcessing = true;
    try {
      const items: TimelineItem[] = [];
      
      // Process task nodes
      if (silo) {
        const taskNodes = silo.nodes.filter(n => n.type === 'task');
        taskNodes.forEach(node => {
          const dueDate = getNodeDueDate(node);
          if (!dueDate) return;
          
          // Skip completed tasks if filter is active
          if (!showDone && node.data?.isComplete) return;
          
          // Filter by project if needed
          if (currentFilter !== 'all' && getNodeProject(node) !== currentFilter) return;
          
          items.push({
            id: node.id,
            title: safeNodeTitle(node),
            type: 'task',
            dueDate,
            status: getNodeStatus(node),
            priority: getNodePriority(node),
            project: getNodeProject(node),
            color: getItemColor('task', getNodePriority(node)),
            isComplete: node.data?.isComplete || false,
            members: getNodeMembers(node),
            description: node.data?.description || '',
            position: calculateItemPosition(dueDate)
          });
        });
        
        // Add similar code for milestones and projects
        // ...
        
        // Sort items based on current sort setting
        if (currentSort === 'priority') {
          const priorityRank: Record<string, number> = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };
          items.sort((a, b) => (priorityRank[a.priority || 'medium'] || 4) - (priorityRank[b.priority || 'medium'] || 4));
        } else if (currentSort === 'project') {
          items.sort((a, b) => (a.project || '').localeCompare(b.project || ''));
        } else {
          // Default sort by date
          items.sort((a, b) => {
            const dateA = a.dueDate || new Date(9999, 0, 1);
            const dateB = b.dueDate || new Date(9999, 0, 1);
            return dateA.getTime() - dateB.getTime();
          });
        }
      }
      
      // Only update the reactive variable once at the end
      timelineItems = items;
    } finally {
      isProcessing = false;
      
      // If updates were requested during processing, schedule another update
      if (pendingTimelineUpdate) {
        pendingTimelineUpdate = false;
        setTimeout(safeGenerateTimelineItems, 0);
      }
    }
  }
    
    function calculateItemPosition(date: Date): number {
      if (!date) return 0;
      
      // Calculate position based on days from start
      const startTime = currentTimelineStart.getTime();
      const dateTime = date.getTime();
      const timelineWidth = timelineContainerWidth;
      const totalDays = getDaysBetweenDates(currentTimelineStart, currentTimelineEnd);
      
      // Calculate position as percentage of timeline width
      const dayDiff = (dateTime - startTime) / (1000 * 60 * 60 * 24);
      return Math.max(0, Math.min(100, (dayDiff / totalDays) * 100));
    }
    
    function calculateItemWidth(startDate: Date, endDate: Date): number {
      if (!startDate || !endDate) return 10; // Default width
      
      const totalDays = getDaysBetweenDates(currentTimelineStart, currentTimelineEnd);
      const itemDays = getDaysBetweenDates(startDate, endDate);
      
      return Math.max(10, (itemDays / totalDays) * 100);
    }
  
    function handleMouseDown(e: MouseEvent) {
  isDragging = true;
  dragStartX = e.clientX;
  scrollLeftStart = containerEl.scrollLeft;
  containerEl.style.cursor = 'grabbing';
  // Prevent text selection during drag
  e.preventDefault();
}

function handleMouseMove(e: MouseEvent) {
  if (!isDragging) return;
  
  const dx = e.clientX - dragStartX;
  containerEl.scrollLeft = scrollLeftStart - dx;
}

function handleMouseUp() {
  isDragging = false;
  if (containerEl) containerEl.style.cursor = 'grab';
}
    
    function formatDateRange(): string {
      const start = new Date(currentTimelineStart);
      const end = new Date(currentTimelineEnd);
      
      const startStr = start.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      const endStr = end.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      
      return `${startStr} - ${endStr}`;
    }
  
    function isToday(date: Date): boolean {
      const today = new Date();
      return date.getDate() === today.getDate() && 
             date.getMonth() === today.getMonth() && 
             date.getFullYear() === today.getFullYear();
    }
    
    function isWeekend(date: Date): boolean {
      const day = date.getDay();
      return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
    }
    
    function getMonthName(date: Date): string {
      return date.toLocaleDateString('en-US', { month: 'long' });
    }
    
    function getDayName(date: Date): string {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }

    // Add this as a new function
function calculateVerticalPosition(item: TimelineItem, allItems: TimelineItem[]): number {
  const itemDate = item.dueDate || new Date();
  const dateStr = itemDate.toISOString().split('T')[0];
  
  // Group items by date
  const itemsOnSameDay = allItems.filter(otherItem => {
    const otherDate = otherItem.dueDate || new Date();
    return otherDate.toISOString().split('T')[0] === dateStr && otherItem.id !== item.id;
  });
  
  // Find the next available vertical position
  let row = 0;
  const usedRows = new Set(itemsOnSameDay.map(i => i.rowPosition).filter(Boolean));
  
  while (usedRows.has(row)) {
    row++;
  }
  
  return row * 60; // 60px vertical spacing between items
}
    
    function getProjects(): string[] {
      if (!silo) return [];
      const projects = silo.nodes
        .filter(n => n.type === 'project')
        .map(n => safeNodeTitle(n));
      return ['all', ...new Set(projects)];
    }
  
    $: silo = $siloStore.find(s => s.id === siloId);
    $: if (silo && containerEl) {
  setTimeout(() => generateTimelineItems(), 0); // Push to next event loop
}
    $: if (containerEl) timelineContainerWidth = containerEl.clientWidth;
  
    onMount(async () => {
      isLoading = true;
      try {
        initializeTimeline();
        await tick();
        generateTimelineItems();
        
        // Scroll to today
        if (browser && containerEl) {
          const today = new Date();
          const startTime = currentTimelineStart.getTime();
          const todayTime = today.getTime();
          const totalDays = getDaysBetweenDates(currentTimelineStart, currentTimelineEnd);
          const dayDiff = (todayTime - startTime) / (1000 * 60 * 60 * 24);
          
          const scrollPosition = (dayDiff / totalDays) * timelineContainerWidth;
          containerEl.scrollLeft = scrollPosition - (containerEl.clientWidth / 2);
        }
      } catch (e) {
        error = e as Error;
        console.error('Timeline initialization error:', e);
      } finally {
        isLoading = false;
      }
    });
    
    afterUpdate(() => {
      if (silo && visibleDays.length > 0) {
        generateTimelineItems();
      }
    });
  </script>
  
  <div class="timeline-container">
    {#if isLoading}
      <div class="text-center p-8 text-gray-500">Loading timeline data...</div>
    {:else if error}
      <div class="error-message p-4 mb-4 bg-red-100 text-red-800 rounded">
        Error: {error.message}
        <button on:click={() => error = null} class="ml-2 px-2 py-1 bg-red-200 hover:bg-red-300 rounded">
          Dismiss
        </button>
      </div>
    {:else}
      <div class="timeline-header">
        <div class="flex justify-between items-center mb-4">
            <button 
  on:click={scrollToToday}
  class="px-3 py-1.5 rounded-lg text-sm font-medium"
  style="background-color: var(--brand-blue); color: var(--light-text);"
>
  Today
</button>
          <div>
            <h2 class="font-medium text-xl" style="color: var(--text-primary)">Timeline</h2>
            <p class="text-sm" style="color: var(--text-secondary)">
              Detailed, visual representation of a project's journey, highlighting key milestones, 
              progress updates, and upcoming tasks.
            </p>
          </div>
          <div class="flex space-x-4">
            <button 
              on:click={() => changeViewMode('day')} 
              class="px-3 py-1.5 rounded-lg text-sm font-medium"
              style:background-color={viewMode === 'day' ? 'var(--brand-green)' : 'transparent'}
              style:color={viewMode === 'day' ? 'var(--light-text)' : 'var(--text-secondary)'}
            >
              Day
            </button>
            <button 
              on:click={() => changeViewMode('week')} 
              class="px-3 py-1.5 rounded-lg text-sm font-medium"
              style:background-color={viewMode === 'week' ? 'var(--brand-green)' : 'transparent'}
              style:color={viewMode === 'week' ? 'var(--light-text)' : 'var(--text-secondary)'}
            >
              Week
            </button>
            <button 
              on:click={() => changeViewMode('month')} 
              class="px-3 py-1.5 rounded-lg text-sm font-medium"
              style:background-color={viewMode === 'month' ? 'var(--brand-green)' : 'transparent'}
              style:color={viewMode === 'month' ? 'var(--light-text)' : 'var(--text-secondary)'}
            >
              Month
            </button>
          </div>
        </div>
  
        <div class="timeline-controls flex justify-between items-center mb-4">
          <div class="flex items-center space-x-2">
            <button 
              on:click={() => moveTimeline('prev')}
              class="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Previous time period"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
              </svg>
            </button>
            <span class="font-medium">{formatDateRange()}</span>
            <button 
              on:click={() => moveTimeline('next')}
              class="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="Next time period"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
              </svg>
            </button>
          </div>
          
          <div class="flex items-center space-x-4">
            <div class="flex items-center space-x-2">
              <span class="text-sm" style="color: var(--text-secondary)">Show done</span>
              <label class="switch">
                <input type="checkbox" bind:checked={showDone}>
                <span class="slider round"></span>
              </label>
            </div>
            
            <div class="flex items-center space-x-2">
              <span class="text-sm" style="color: var(--text-secondary)">Sort:</span>
              <select 
                bind:value={currentSort}
                class="text-sm border rounded-md px-2 py-1"
                style="border-color: var(--border-color); color: var(--text-primary); background-color: var(--bg-primary)"
              >
                <option value="date">Date</option>
                <option value="priority">Priority</option>
                <option value="project">Project</option>
              </select>
            </div>
            
            <div class="flex items-center space-x-2">
              <span class="text-sm" style="color: var(--text-secondary)">Project:</span>
              <select 
                bind:value={currentFilter}
                class="text-sm border rounded-md px-2 py-1"
                style="border-color: var(--border-color); color: var(--text-primary); background-color: var(--bg-primary)"
              >
                {#each getProjects() as project}
                  <option value={project}>{project}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <div class="timeline-scroll-container"
           bind:this={containerEl}
           on:mousedown={handleMouseDown}
           on:mousemove={handleMouseMove}
           on:mouseup={handleMouseUp}
           on:mouseleave={handleMouseUp}>
        
        <div class="timeline-header-row">
          {#each visibleDays as day, index}
            <div class="timeline-day-header {isWeekend(day) ? 'weekend' : ''} {isToday(day) ? 'today' : ''}">
              <div class="day-name">{getDayName(day)}</div>
              <div class="day-number">{day.getDate()}</div>
              {#if index === 0 || day.getDate() === 1}
                <div class="month-marker">{getMonthName(day)} {day.getFullYear()}</div>
              {/if}
            </div>
          {/each}
        </div>
        
        <div class="timeline-grid">
          <!-- Background grid with day columns -->
          <div class="timeline-grid-background">
            {#each visibleDays as day}
              <div class="timeline-day-column {isWeekend(day) ? 'weekend' : ''} {isToday(day) ? 'today' : ''}"></div>
            {/each}
          </div>
          
          <!-- Timeline items -->
          <div class="timeline-items">
            {#each timelineItems as item}
              {#if item.type === 'project'}
                <!-- Project bars (spans multiple days) -->
                <div 
                class="timeline-item timeline-{item.type} {item.isComplete ? 'completed' : ''}"
                style="left: {item.position}%; top: {item.verticalPosition || 0}px;"
              >
                  <div class="project-bar" style="background-color: {item.color};">
                    <div class="project-progress" style="width: {item.progress || 0}%;"></div>
                  </div>
                  <div class="timeline-item-label">
                    <div class="item-title">{item.title}</div>
                    <div class="item-details">{item.progress || 0}% complete</div>
                  </div>
                </div>
              {:else if item.type === 'milestone'}
                <!-- Milestone markers -->
                <div 
                  class="timeline-item timeline-milestone {item.isComplete ? 'completed' : ''}"
                  style="left: {item.position}%;"
                >
                  <div class="milestone-marker" style="background-color: {item.color};"></div>
                  <div class="timeline-item-label">
                    <div class="item-title">{item.title}</div>
                    <div class="item-details">{item.isComplete ? 'Completed' : 'In Progress'}</div>
                  </div>
                </div>
              {:else}
                <!-- Task items -->
                <div 
                  class="timeline-item timeline-task {item.isComplete ? 'completed' : ''}"
                  style="left: {item.position}%;"
                >
                  <div class="task-box" style="--item-color: {item.color};">
                    <div class="item-title">{item.title}</div>
                    {#if item.project}
                      <div class="item-project">{item.project}</div>
                    {/if}
                    {#if item.priority}
                      <div class="item-priority" style="background-color: {item.color};">{item.priority}</div>
                    {/if}

                                        <!-- Draw connections if any -->
                    {#if item.connections && item.connections.length > 0}
                    {#each item.connections as targetId}
                    {@const targetItem = timelineItems.find(i => i.id === targetId)}
                    {#if targetItem}
                        <svg class="connection-line">
                        <path 
                            d="M{item.position},{item.verticalPosition + 20} 
                            C{(item.position + targetItem.position)/2},{item.verticalPosition + 20} 
                            {(item.position + targetItem.position)/2},{targetItem.verticalPosition + 20} 
                            {targetItem.position},{targetItem.verticalPosition + 20}"
                            stroke={item.color}
                            stroke-width="2"
                            fill="none"
                        />
                        </svg>
                    {/if}
                    {/each}
                {/if}

                </div>
                  </div>

              {/if}
            {/each}
          </div>
          
          <!-- Current time indicator -->
          <div class="current-time-indicator"></div>
        </div>
      </div>
    {/if}
  </div>

  

  <style>

.task-box {
  background: linear-gradient(135deg, white, #f9fafb);
  border: 2px solid var(--item-color, var(--brand-green, #10b981));
  border-radius: 6px;
  padding: 8px;
  min-width: 150px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  position: relative;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.task-box:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}

.task-box.bookmarked {
  background: linear-gradient(135deg, rgba(var(--brand-blue-rgb), 0.05), rgba(var(--brand-green-rgb), 0.1));
}
    .timeline-container {
      width: 100%;
      height: 100%;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      font-family: system-ui, -apple-system, sans-serif;
    }
    
    .timeline-header {
      padding: 1rem;
      background-color: var(--bg-primary, #ffffff);
      border-bottom: 1px solid var(--border-color, #e5e7eb);
    }
    
    .timeline-scroll-container {
      flex: 1;
      overflow-x: auto;
      overflow-y: auto;
      cursor: grab;
      position: relative;
      background-color: var(--bg-primary, #ffffff);
    }
    
    .timeline-scroll-container:active {
      cursor: grabbing;
    }
  
    .timeline-header-row {
      display: flex;
      position: sticky;
      top: 0;
      z-index: 10;
      background-color: var(--bg-primary, #ffffff);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    }
    
    .timeline-day-header {
      min-width: 80px;
      padding: 8px 4px;
      text-align: center;
      border-right: 1px solid var(--border-color, #e5e7eb);
      position: relative;
    }
    
    .timeline-day-header.weekend {
      background-color: var(--bg-secondary, #f9fafb);
    }
    
    .timeline-day-header.today {
      background-color: rgba(var(--brand-green-rgb, 34, 197, 94), 0.1);
    }
    
    .day-name {
      font-size: 0.75rem;
      color: var(--text-secondary, #6b7280);
      text-transform: uppercase;
    }
    
    .day-number {
      font-size: 1rem;
      font-weight: 500;
      color: var(--text-primary, #111827);
    }
    
    .month-marker {
      position: absolute;
      top: -20px;
      left: 0;
      padding: 2px 8px;
      background-color: var(--brand-green, #10b981);
      color: white;
      font-size: 0.75rem;
      border-radius: 4px;
      z-index: 20;
      white-space: nowrap;
    }
    
    .timeline-grid {
      position: relative;
      min-height: 500px;
    }
    
    .timeline-grid-background {
      display: flex;
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1;
    }
    
    .timeline-day-column {
      min-width: 80px;
      height: 100%;
      border-right: 1px solid var(--border-color, #e5e7eb);
    }
    
    .timeline-day-column.weekend {
      background-color: var(--bg-secondary, #f9fafb);
    }
    
    .timeline-day-column.today {
      background-color: rgba(var(--brand-green-rgb, 34, 197, 94), 0.1);
    }
    
    .timeline-items {
      position: relative;
      z-index: 5;
      padding-top: 20px;
      min-height: 100%;
    }
    
    .timeline-item {
      position: absolute;
      transform: translateX(-50%);
      margin-bottom: 10px;
      z-index: 10;
    }
    
    .timeline-task {
      top: 20px;
    }
    
    .timeline-milestone {
      top: 80px;
    }
    
    .timeline-project {
      transform: translateX(0);
      top: 140px;
    }
    
    .task-box {
      background-color: white;
      border: 2px solid var(--item-color, var(--brand-green, #10b981));
      border-radius: 6px;
      padding: 8px;
      min-width: 150px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      position: relative;
    }
    
    .task-box:before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background-color: var(--item-color, var(--brand-green, #10b981));
      border-top-left-radius: 4px;
      border-bottom-left-radius: 4px;
    }
    
    .milestone-marker {
      width: 16px;
      height: 16px;
      background-color: var(--brand-green, #10b981);
      border-radius: 50%;
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      z-index: 2;
    }
    
    .milestone-marker:before {
      content: '';
      position: absolute;
      width: 24px;
      height: 24px;
      border: 2px solid var(--brand-green, #10b981);
      border-radius: 50%;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
    }
    
    .timeline-milestone .timeline-item-label {
      position: absolute;
      top: -40px;
      left: 50%;
      transform: translateX(-50%);
      white-space: nowrap;
    }
    
    .project-bar {
      height: 24px;
      background-color: rgba(var(--brand-green-rgb, 34, 197, 94), 0.2);
      border-radius: 12px;
      position: relative;
      overflow: hidden;
    }
    
    .project-progress {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      background-color: var(--brand-green, #10b981);
      border-radius: 12px;
    }
    
    .timeline-project .timeline-item-label {
      margin-top: 4px;
      white-space: nowrap;
    }
    
    .item-title {
      font-weight: 500;
      font-size: 0.875rem;
      color: var(--text-primary, #111827);
    }
    
    .item-details {
      font-size: 0.75rem;
      color: var(--text-secondary, #6b7280);
    }
    
    .item-project {
      font-size: 0.75rem;
      color: var(--text-secondary, #6b7280);
      margin-top: 2px;
    }
    
    .item-priority {
      position: absolute;
      right: 8px;
      top: 8px;
      font-size: 0.7rem;
      padding: 1px 6px;
      border-radius: 10px;
    }
</style>