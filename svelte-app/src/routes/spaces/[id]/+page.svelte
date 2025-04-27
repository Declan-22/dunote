

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabaseClient';
	import { user } from '$lib/stores/userStore';
	import { fly, fade } from 'svelte/transition';
	import { createEventDispatcher } from 'svelte';
	
	// Types
	type Point = { x: number; y: number };
	type DrawingTool = 'pencil' | 'eraser' | 'select' | 'pan';
	type CanvasElement = {
	  id: string;
	  type: 'path' | 'shape';
	  points: Point[];
	  color: string;
	  size: number;
	};
	
	type Collaborator = {
	  id: string;
	  name: string;
	  color: string;
	  position: Point | null;
	  online: boolean;
	};
	
	type WhiteboardMember = {
	  id: string;
	  name: string;
	  email: string;
	  avatar_url?: string;
	};
	
	// Props
	export let width = '100%';
	export let height = '100%';
	export let readOnly = false;
	export let spaceId: string;
	
	// Create event dispatcher
	const dispatch = createEventDispatcher();
	
	// State
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let isDrawing = false;
	let isPanning = false;
	let lastPanPosition: Point | null = null;
	let currentTool: DrawingTool = 'pencil';
	let brushColor = '#333333';
	let brushSize = 2;
	let elements: CanvasElement[] = [];
	let currentElement: CanvasElement | null = null;
	let scale = 1;
	let offsetX = 0;
	let offsetY = 0;
	let collaborators: Collaborator[] = [];
	let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
	let activeMembers: WhiteboardMember[] = [];
	let allMembers: WhiteboardMember[] = [];
	let showMembersModal = false;
	let searchQuery = '';
	let isLoading = true;
	let isSaving = false;
	let debounceTimeout: NodeJS.Timeout | null = null;
  
	// Utils
	const generateId = () => Math.random().toString(36).substring(2, 9);
  
  const getCanvasCoordinates = (e: MouseEvent | TouchEvent): Point => {
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale
    };
  };
  
  // Drawing functions
  const startDrawing = (point: Point) => {
    if (readOnly || currentTool === 'pan') return;
    
    currentElement = {
      id: generateId(),
      type: currentTool === 'eraser' ? 'path' : 'path',
      points: [point],
      color: currentTool === 'eraser' ? '#ffffff' : brushColor,
      size: brushSize
    };
    isDrawing = true;
  };
  
  const continueDrawing = (point: Point) => {
    if (!isDrawing || !currentElement) return;
    currentElement.points.push(point);
    redrawCanvas();
  };
  
  const endDrawing = () => {
    if (!isDrawing || !currentElement) return;
    elements.push(currentElement);
    currentElement = null;
    isDrawing = false;
    saveWhiteboardState();
  };
  
  const startPanning = (point: Point) => {
    if (currentTool !== 'pan') return;
    isPanning = true;
    lastPanPosition = point;
  };
  
  const continuePanning = (point: Point) => {
    if (!isPanning || !lastPanPosition) return;
    offsetX += (point.x - lastPanPosition.x) * scale;
    offsetY += (point.y - lastPanPosition.y) * scale;
    lastPanPosition = point;
    redrawCanvas();
  };
  
  const endPanning = () => {
    isPanning = false;
    lastPanPosition = null;
  };
  
  const redrawCanvas = () => {
    if (!ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);
  
    // Draw all elements
    elements.forEach(element => {
      drawElement(element);
    });
  
    // Draw current element in progress
    if (currentElement) {
      drawElement(currentElement);
    }
  
    ctx.restore();
    
    // Draw collaborators
    drawCollaborators();
  };
  
  const drawElement = (element: CanvasElement) => {
    if (!ctx) return;
    
    ctx.beginPath();
    ctx.strokeStyle = element.color;
    ctx.lineWidth = element.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  
    element.points.forEach((point, i) => {
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
  
    ctx.stroke();
  };
  
  const clearCanvas = () => {
    elements = [];
    redrawCanvas();
    saveWhiteboardState();
  };


   // Whiteboard data handling functions
   const saveWhiteboardState = () => {
    if (!$user || !spaceId || readOnly) return;
    
    // Debounce the save operation
    if (debounceTimeout) clearTimeout(debounceTimeout);
    
    debounceTimeout = setTimeout(async () => {
      isSaving = true;
      
      try {
        const { data, error } = await supabase
          .from('whiteboard_data')
          .upsert({
            space_id: spaceId,
            user_id: $user.id,
            elements: elements,
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'space_id'
          })
          .select();
          
        if (error) throw error;
        
        dispatch('saved', { timestamp: new Date() });
      } catch (error) {
        console.error('Failed to save whiteboard:', error);
      } finally {
        isSaving = false;
      }
    }, 1000);
  };
  
  const loadWhiteboardState = async () => {
    if (!spaceId) return;
    
    isLoading = true;
    
    try {
      const { data, error } = await supabase
        .from('whiteboard_data')
        .select('elements')
        .eq('space_id', spaceId)
        .single();
        
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data?.elements) {
        elements = data.elements;
        redrawCanvas();
      }
    } catch (error) {
      console.error('Failed to load whiteboard:', error);
    } finally {
      isLoading = false;
    }
  };
  
 // Collaboration functions
 const setupCollaboration = async () => {
    if (!browser || !$user || !spaceId) return;
    
    // First load existing whiteboard data
    await loadWhiteboardState();
    
    // Load members with access to this whiteboard
    await loadWhiteboardMembers();
    
    // Set up real-time presence channel
    presenceChannel = supabase.channel(`whiteboard-${spaceId}`, {
      config: {
        presence: {
          key: $user.id
        }
      }
    });
  
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const newState = presenceChannel?.presenceState();
        if (newState) {
          collaborators = Object.values(newState).flat() as Collaborator[];
          redrawCanvas();
        }
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('New user joined:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && $user) {
          await presenceChannel?.track({
            id: $user.id,
            name: $user.user_metadata?.full_name || $user.email || 'Anonymous',
            color: getRandomColor(),
            position: null,
            online: true
          });
        }
      });
      
    // Subscribe to whiteboard updates
    const whiteboardChanges = supabase
      .channel(`whiteboard-updates-${spaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'whiteboard_data',
          filter: `space_id=eq.${spaceId}`
        },
        (payload) => {
          if (payload.new && payload.new.user_id !== $user.id) {
            elements = payload.new.elements;
            redrawCanvas();
          }
        }
      )
      .subscribe();
  
    // Update cursor position
    const updateCursorPosition = throttle((e: MouseEvent) => {
      if (!$user || !presenceChannel) return;
      const pos = getCanvasCoordinates(e);
      presenceChannel.track({
        id: $user.id,
        name: $user.user_metadata?.full_name || $user.email || 'Anonymous',
        color: getCollaboratorColor($user.id),
        position: pos,
        online: true
      });
    }, 100);
  
    canvas.addEventListener('mousemove', updateCursorPosition);
  
    return () => {
      canvas.removeEventListener('mousemove', updateCursorPosition);
      if (whiteboardChanges) supabase.removeChannel(whiteboardChanges);
      if (presenceChannel) supabase.removeChannel(presenceChannel);
    };
  };
  
  const drawCollaborators = () => {
    if (!$user || !ctx) return;
    
    collaborators.forEach(collaborator => {
      if (collaborator.id === $user?.id || !collaborator.position) return;
      
      const { x, y } = collaborator.position;
      
      // Draw cursor
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      
      // Draw pointer triangle
      ctx.beginPath();
      ctx.fillStyle = collaborator.color;
      ctx.moveTo(x, y);
      ctx.lineTo(x + 8, y + 4);
      ctx.lineTo(x, y + 12);
      ctx.closePath();
      ctx.fill();
      
      // Draw name tag
      ctx.fillStyle = '#f0f0f0';
      ctx.strokeStyle = '#cccccc';
      const nameWidth = ctx.measureText(collaborator.name).width + 16;
      ctx.fillRect(x + 14, y - 10, nameWidth, 20);
      ctx.strokeRect(x + 14, y - 10, nameWidth, 20);
      
      // Draw name
      ctx.fillStyle = '#333333';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(collaborator.name, x + 22, y + 4);
      
      ctx.restore();
    });
  };
  
  const getCollaboratorColor = (userId: string) => {
    const existingCollaborator = collaborators.find(c => c.id === userId);
    if (existingCollaborator) return existingCollaborator.color;
    return getRandomColor();
  };

    // Member management
	const loadWhiteboardMembers = async () => {
    if (!spaceId || !$user) return;
    
    try {
      // Get all members of this whiteboard
      const { data: memberData, error: memberError } = await supabase
        .from('whiteboard_members')
        .select('user_id')
        .eq('space_id', spaceId);
        
      if (memberError) throw memberError;
      
      if (memberData && memberData.length > 0) {
        const memberIds = memberData.map(m => m.user_id);
        
        // Get user details for these members
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('id, display_name, email, avatar_url')
          .in('id', memberIds);
          
        if (userError) throw userError;
        
        if (userData) {
          activeMembers = userData.map(user => ({
            id: user.id,
            name: user.display_name || user.email,
            email: user.email,
            avatar_url: user.avatar_url
          }));
        }
      }
    } catch (error) {
      console.error('Failed to load whiteboard members:', error);
    }
  };
  
  const addMember = async (memberId: string) => {
    if (!spaceId || !$user) return;
    
    try {
      // Check if member already exists
      const { data: existingMember, error: checkError } = await supabase
        .from('whiteboard_members')
        .select('*')
        .eq('space_id', spaceId)
        .eq('user_id', memberId)
        .single();
        
      if (checkError && checkError.code !== 'PGRST116') throw checkError;
      
      if (existingMember) return; // Member already exists
      
      // Add new member
      const { error: insertError } = await supabase
        .from('whiteboard_members')
        .insert({
          space_id: spaceId,
          user_id: memberId,
          added_by: $user.id
        });
        
      if (insertError) throw insertError;
      
      // Refresh member list
      await loadWhiteboardMembers();
      
    } catch (error) {
      console.error('Failed to add member:', error);
    }
  };
  
  const removeMember = async (memberId: string) => {
    if (!spaceId || !$user) return;
    
    try {
      const { error } = await supabase
        .from('whiteboard_members')
        .delete()
        .eq('space_id', spaceId)
        .eq('user_id', memberId);
        
      if (error) throw error;
      
      // Refresh member list
      await loadWhiteboardMembers();
      
    } catch (error) {
      console.error('Failed to remove member:', error);
    }
  };
  
  const searchUsers = async () => {
    if (!searchQuery.trim() || !$user) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, email, avatar_url')
        .ilike('email', `%${searchQuery}%`)
        .limit(10);
        
      if (error) throw error;
      
      allMembers = data.map(user => ({
        id: user.id,
        name: user.display_name || user.email,
        email: user.email,
        avatar_url: user.avatar_url
      }));
    } catch (error) {
      console.error('Failed to search users:', error);
    }
  };


  
  const getRandomColor = () => {
    const colors = [
      '#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F97316', 
      '#FACC15', '#84CC16', '#10B981', '#14B8A6', '#06B6D4', 
      '#0EA5E9', '#3B82F6'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  };
  
  const throttle = <T extends unknown[]>(fn: (...args: T) => void, delay: number) => {
    let lastCall = 0;
    return (...args: T) => {
      const now = new Date().getTime();
      if (now - lastCall < delay) return;
      lastCall = now;
      return fn(...args);
    };
  };
  
  // Event handlers
  const handleMouseDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    if (currentTool === 'pan') {
      startPanning(getCanvasCoordinates(e));
    } else {
      startDrawing(getCanvasCoordinates(e));
    }
  };
  
  const handleMouseMove = (e: MouseEvent) => {
    if (isPanning) {
      continuePanning(getCanvasCoordinates(e));
    } else if (isDrawing) {
      continueDrawing(getCanvasCoordinates(e));
    }
  };
  
  const handleMouseUp = () => {
    if (isPanning) {
      endPanning();
    } else if (isDrawing) {
      endDrawing();
    }
  };
  
  const handleTouchStart = (e: TouchEvent) => {
    e.preventDefault();
    if (currentTool === 'pan') {
      startPanning(getCanvasCoordinates(e));
    } else {
      startDrawing(getCanvasCoordinates(e));
    }
  };
  
  const handleTouchMove = (e: TouchEvent) => {
    e.preventDefault();
    if (isPanning) {
      continuePanning(getCanvasCoordinates(e));
    } else if (isDrawing) {
      continueDrawing(getCanvasCoordinates(e));
    }
  };
  
  const handleTouchEnd = () => {
    if (isPanning) {
      endPanning();
    } else if (isDrawing) {
      endDrawing();
    }
  };
  
  const handleZoom = (e: WheelEvent) => {
    e.preventDefault();
    const zoomIntensity = 0.1;
    const mouseX = e.offsetX;
    const mouseY = e.offsetY;
    
    // Determine direction and calculate new scale
    const direction = e.deltaY > 0 ? -1 : 1;
    const factor = Math.pow(1 + zoomIntensity, direction);
    const newScale = scale * factor;
    
    // Limit scale to reasonable bounds
    if (newScale < 0.1 || newScale > 10) return;
    
    // Calculate new offsets to zoom towards mouse position
    offsetX = mouseX - (mouseX - offsetX) * factor;
    offsetY = mouseY - (mouseY - offsetY) * factor;
    scale = newScale;
    
    redrawCanvas();
  };
  
  // Initialize
  onMount(() => {
  if (!browser) return;
  
  ctx = canvas.getContext('2d')!;
  resizeCanvas();
  
  // Add logging
  console.log("Whiteboard mounted, loading state:", isLoading);
    
    // Event listeners
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('wheel', handleZoom, { passive: false });
    
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    
    // Setup collaboration if user exists
    if ($user && spaceId) {
      setupCollaboration();
    }
    
    window.addEventListener('resize', resizeCanvas);
    
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('wheel', handleZoom);
      
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
      
      window.removeEventListener('resize', resizeCanvas);
      
      // Clean up presence channel
      if (presenceChannel) {
        supabase.removeChannel(presenceChannel);
      }
      
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
    };
  });
  
  const resizeCanvas = () => {
    if (!canvas) return;
    const rect = canvas.parentElement?.getBoundingClientRect();
    if (rect) {
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawCanvas();
    }
	setTimeout(() => {
    if (isLoading) {
      console.log("Forcing exit from loading state after timeout");
      isLoading = false;
    }
  }, 5000);

  };
</script>
  
<div class="whiteboard-container" style="width: {width}; height: {height}">
	<!-- Loading overlay -->
	{#if isLoading}
	  <div class="absolute inset-0 bg-white/80 dark:bg-gray-900/80 flex items-center justify-center z-10">
		<div class="flex flex-col items-center">
		  <svg class="animate-spin h-8 w-8 text-gray-500 dark:text-gray-400 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
			<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
			<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		  </svg>
		  <span class="text-gray-600 dark:text-gray-300">Loading whiteboard...</span>
		</div>
	  </div>
	{/if}
	
	<!-- Saving indicator -->
	{#if isSaving}
	  <div class="absolute top-4 right-4 px-3 py-1 bg-gray-800/80 text-white text-sm rounded-md flex items-center shadow-md z-10">
		<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
		  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
		  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
		</svg>
		Saving...
	  </div>
	{/if}
	
	<canvas
	  bind:this={canvas}
	  class="whiteboard"
	  style="cursor: {currentTool === 'pencil' ? 'crosshair' : 
					 currentTool === 'eraser' ? 'cell' : 
					 currentTool === 'pan' ? 'grab' : 'default'}"
	/>
	
	<!-- Toolbar -->
	<div class="toolbar">
	  <div class="flex space-x-1">
		<!-- Pencil tool -->
		<button
		  class="tool-button {currentTool === 'pencil' ? 'active' : ''}"
		  on:click={() => currentTool = 'pencil'}
		  title="Pencil"
		>
		  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path>
		  </svg>
		</button>
		
		<!-- Eraser tool -->
		<button
		  class="tool-button {currentTool === 'eraser' ? 'active' : ''}"
		  on:click={() => currentTool = 'eraser'}
		  title="Eraser"
		>
		  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"></path>
			<path d="M22 21H7"></path>
			<path d="m5 11 9 9"></path>
		  </svg>
		</button>
		
		<!-- Pan tool -->
    <button
    class="tool-button {currentTool === 'pan' ? 'active' : ''}"
    on:click={() => currentTool = 'pan'}
    title="Pan"
  >
    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18 24h-6.55c-1.08 0-2.14-.45-2.89-1.23l-7.3-7.61l2.07-1.83c.62-.55 1.53-.66 2.26-.27L8 14.34V4.79a2.5 2.5 0 0 1 3.01-2.45C11.1 1.04 12.18.01 13.5.01c.86 0 1.61.43 2.06 1.09c.29-.12.61-.18.94-.18a2.5 2.5 0 0 1 2.5 2.5v.28a2.5 2.5 0 0 1 3 2.45V20c0 2.21-1.79 4-4 4M4.14 15.28l5.86 6.1c.38.39.9.62 1.44.62H18c1.1 0 2-.9 2-2V6.15c0-.28-.22-.5-.5-.5s-.5.22-.5.5V12h-2V3.42c0-.28-.22-.5-.5-.5s-.5.22-.5.5V12h-2V2.51c0-.28-.22-.5-.5-.5s-.5.22-.5.5V12h-2V4.79c0-.28-.22-.5-.5-.5s-.5.23-.5.5v12.87l-5.35-2.83z" />
    </svg>
  </button>
	  </div>
	  
	  <div class="flex space-x-1 ml-2">
		<!-- Color picker -->
		<div class="relative">
		  <button 
		  class="tool-button" 
		  style="background-color: {brushColor}; border: 1px solid #ccc;" 
		  title="Color"
		  >
			<input 
			  type="color" 
			  bind:value={brushColor} 
			  class="absolute inset-0 opacity-0 cursor-pointer" 
			/>
		  </button>
		</div>
		
		<!-- Brush size -->
		<select 
		  bind:value={brushSize} 
		  class="tool-select" 
		  title="Brush size"
		>
		  <option value="1">Fine</option>
		  <option value="2">Thin</option>
		  <option value="3">Medium</option>
		  <option value="5">Thick</option>
		  <option value="8">Bold</option>
		</select>
	  </div>
	  
	  <div class="flex space-x-1 ml-2">
		<!-- Clear canvas -->
		<button
		  class="tool-button"
		  on:click={clearCanvas}
		  title="Clear canvas"
		>
		  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M3 6h18"></path>
			<path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
			<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
		  </svg>
		</button>
		
		<!-- Members button -->
		<button
		  class="tool-button relative"
		  on:click={() => showMembersModal = true}
		  title="Manage members"
		>
		  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
			<circle cx="9" cy="7" r="4"></circle>
			<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
			<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
		  </svg>
		  {#if activeMembers.length > 0}
			<span class="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
			  {activeMembers.length}
			</span>
		  {/if}
		</button>
	  </div>
	</div>
	
	<!-- Members Modal -->
	{#if showMembersModal}
	  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" transition:fade={{ duration: 150 }}>
		<div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4" transition:fly={{ y: 20, duration: 300 }}>
		  <div class="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
			<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">Whiteboard Collaborators</h3>
			<button class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200" on:click={() => showMembersModal = false}>
			  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18"></line>
				<line x1="6" y1="6" x2="18" y2="18"></line>
			  </svg>
			</button>
		  </div>
		  
		  <div class="p-4">
			<!-- Search for users -->
			<div class="mb-4">
			  <label for="search-users" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Add collaborator</label>
			  <div class="flex">
				<input
				  id="search-users"
				  type="text"
				  placeholder="Search by email"
				  bind:value={searchQuery}
				  on:input={searchUsers}
				  class="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-l-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
				/>
				<button
				  class="px-3 py-2 bg-blue-600 text-white rounded-r-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
				  on:click={searchUsers}
				>
				  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8"></circle>
					<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
				  </svg>
				</button>
			  </div>
			</div>
			
			<!-- Search results -->
			{#if searchQuery && allMembers.length > 0}
			  <div class="mb-4 p-2 border border-gray-200 dark:border-gray-700 rounded-md max-h-40 overflow-y-auto">
				<h4 class="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Search results</h4>
				{#each allMembers as member}
				  <div class="flex items-center justify-between py-2 px-1 border-b border-gray-100 dark:border-gray-800 last:border-0">
					<div class="flex items-center">
					  <div class="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden mr-2 flex-shrink-0">
						{#if member.avatar_url}
						  <img src={member.avatar_url} alt={member.name} class="w-full h-full object-cover" />
						{:else}
						  <div class="w-full h-full flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm font-medium uppercase">
							{member.name ? member.name[0] : '?'}
						  </div>
						{/if}
					  </div>
					  <div>
						<div class="text-sm font-medium text-gray-900 dark:text-gray-100">{member.name}</div>
						<div class="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
					  </div>
					</div>
					<button
					  class="ml-2 p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
					  on:click={() => addMember(member.id)}
					  disabled={activeMembers.some(m => m.id === member.id)}
					>
					  {#if activeMembers.some(m => m.id === member.id)}
						<span class="text-xs text-gray-500 dark:text-gray-400">Added</span>
					  {:else}
						<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						  <path d="M12 5v14"></path>
						  <path d="M5 12h14"></path>
						</svg>
					  {/if}
					</button>
				  </div>
				{/each}
			  </div>
			{/if}
			
			<!-- Current members -->
			<div>
			  <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Current collaborators</h4>
			  {#if activeMembers.length === 0}
				<div class="text-sm text-gray-500 dark:text-gray-400 py-4 text-center border border-dashed border-gray-300 dark:border-gray-600 rounded-md">
				  No collaborators yet
				</div>
			  {:else}
				<div class="max-h-60 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-md">
				  {#each activeMembers as member}
					<div class="flex items-center justify-between py-2 px-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
					  <div class="flex items-center">
						<div class="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full overflow-hidden mr-2 flex-shrink-0">
						  {#if member.avatar_url}
							<img src={member.avatar_url} alt={member.name} class="w-full h-full object-cover" />
						  {:else}
							<div class="w-full h-full flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm font-medium uppercase">
							  {member.name ? member.name[0] : '?'}
							</div>
						  {/if}
						</div>
						<div>
						  <div class="text-sm font-medium text-gray-900 dark:text-gray-100">{member.name}</div>
						  <div class="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
						</div>
					  </div>
					  {#if member.id !== $user?.id}
						<button
						  class="ml-2 p-1 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
						  on:click={() => removeMember(member.id)}
						>
						  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 6h18"></path>
							<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
							<line x1="10" y1="11" x2="10" y2="17"></line>
							<line x1="14" y1="11" x2="14" y2="17"></line>
							<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
						  </svg>
						</button>
					  {:else}
						<span class="text-xs px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 rounded-full">
						  You
						</span>
					  {/if}
					</div>
				  {/each}
				</div>
			  {/if}
			</div>
		  </div>
		  
		  <div class="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end">
			<button
			  class="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600 dark:focus:ring-offset-gray-800"
			  on:click={() => showMembersModal = false}
			>
			  Close
			</button>
		  </div>
		</div>
	  </div>
	{/if}
	
	<!-- CSS for the whiteboard -->
	<style>
	  .whiteboard-container {
		position: relative;
		background-color: #fff;
		border-radius: 0.375rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
		overflow: hidden;
	  }
	  
	  :global(.dark) .whiteboard-container {
		background-color: #1f2937;
	  }
	  
	  .whiteboard {
		width: 100%;
		height: 100%;
		display: block;
		touch-action: none;
	  }
	  
	  .toolbar {
		position: absolute;
		top: 1rem;
		left: 1rem;
		display: flex;
		background-color: #fff;
		border-radius: 0.375rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
		padding: 0.5rem;
		z-index: 5;
	  }
	  
	  :global(.dark) .toolbar {
		background-color: #374151;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2);
	  }
	  
	  .tool-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 0.25rem;
		color: #4b5563;
		background-color: transparent;
		border: none;
		cursor: pointer;
		transition: all 0.15s ease;
	  }
	  
	  :global(.dark) .tool-button {
		color: #d1d5db;
	  }
	  
	  .tool-button:hover {
		background-color: #f3f4f6;
		color: #111827;
	  }
	  
	  :global(.dark) .tool-button:hover {
		background-color: #4b5563;
		color: #f9fafb;
	  }
	  
	  .tool-button.active {
		background-color: #e5e7eb;
		color: #111827;
	  }
	  
	  :global(.dark) .tool-button.active {
		background-color: #6b7280;
		color: #f9fafb;
	  }
	  
	  .tool-select {
		height: 2rem;
		border-radius: 0.25rem;
		background-color: #f9fafb;
		border: 1px solid #e5e7eb;
		color: #4b5563;
		padding: 0 0.5rem;
		font-size: 0.875rem;
		cursor: pointer;
	  }
	  
	  :global(.dark) .tool-select {
		background-color: #374151;
		border-color: #4b5563;
		color: #d1d5db;
	  }
	</style>
  </div>

