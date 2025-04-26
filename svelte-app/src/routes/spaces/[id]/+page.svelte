<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabaseClient';
	import { user } from '$lib/stores/userStore';
	import type { User } from '@supabase/supabase-js';
  
	// Types
	type Point = { x: number; y: number };
	type DrawingTool = 'pencil' | 'eraser' | 'select';
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
	  position: Point;
	};
  
	// Props
	export let width = '100%';
	export let height = '100%';
	export let readOnly = false;
  
	// State
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let isDrawing = false;
	let currentTool: DrawingTool = 'pencil';
	let brushColor = '#000000';
	let brushSize = 3;
	let elements: CanvasElement[] = [];
	let currentElement: CanvasElement | null = null;
	let scale = 1;
	let offsetX = 0;
	let offsetY = 0;
	let collaborators: Collaborator[] = [];
	let presenceChannel: ReturnType<typeof supabase.channel> | null = null;
  
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
	  if (readOnly) return;
	  
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
  
	// Collaboration functions
	const setupCollaboration = async () => {
	  if (!browser || !$user) return;
	  
	  presenceChannel = supabase.channel('whiteboard-presence', {
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
			  name: $user.email || 'Anonymous', // Using email as name fallback
			  color: getRandomColor(),
			  position: { x: 0, y: 0 }
			});
		  }
		});
  
	  // Update cursor position
	  const updateCursorPosition = throttle((e: MouseEvent) => {
		if (!$user || !presenceChannel) return;
		const pos = getCanvasCoordinates(e);
		presenceChannel.track({
		  id: $user.id,
		  name: $user.email || 'Anonymous',
		  color: getRandomColor(),
		  position: pos
		});
	  }, 100);
  
	  canvas.addEventListener('mousemove', updateCursorPosition);
  
	  return () => {
		canvas.removeEventListener('mousemove', updateCursorPosition);
	  };
	};
  
	const drawCollaborators = () => {
	  if (!$user || !ctx) return;
	  
	  collaborators.forEach(collaborator => {
		if (collaborator.id === $user?.id) return;
		
		const { x, y } = collaborator.position;
		ctx.save();
		ctx.translate(offsetX, offsetY);
		ctx.scale(scale, scale);
		
		// Draw cursor
		ctx.beginPath();
		ctx.fillStyle = collaborator.color;
		ctx.arc(x, y, 5, 0, Math.PI * 2);
		ctx.fill();
		
		// Draw name
		ctx.fillStyle = collaborator.color;
		ctx.font = '12px Arial';
		ctx.fillText(collaborator.name, x + 8, y - 8);
		
		ctx.restore();
	  });
	};
  
	const getRandomColor = () => {
	  const colors = ['#FF5252', '#FF4081', '#E040FB', '#7C4DFF', '#536DFE', '#448AFF', '#40C4FF', '#18FFFF', '#64FFDA', '#69F0AE', '#B2FF59', '#EEFF41', '#FFFF00', '#FFD740', '#FFAB40', '#FF6E40'];
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
	  startDrawing(getCanvasCoordinates(e));
	};
  
	const handleMouseMove = (e: MouseEvent) => {
	  if (!isDrawing) return;
	  continueDrawing(getCanvasCoordinates(e));
	};
  
	const handleMouseUp = () => endDrawing();
  
	const handleTouchStart = (e: TouchEvent) => {
	  e.preventDefault();
	  startDrawing(getCanvasCoordinates(e));
	};
  
	const handleTouchMove = (e: TouchEvent) => {
	  e.preventDefault();
	  if (!isDrawing) return;
	  continueDrawing(getCanvasCoordinates(e));
	};
  
	const handleTouchEnd = () => endDrawing();
  
	// Initialize
	onMount(() => {
	  if (!browser) return;
	  
	  ctx = canvas.getContext('2d')!;
	  resizeCanvas();
  
	  // Event listeners
	  canvas.addEventListener('mousedown', handleMouseDown);
	  canvas.addEventListener('mousemove', handleMouseMove);
	  canvas.addEventListener('mouseup', handleMouseUp);
	  canvas.addEventListener('mouseleave', handleMouseUp);
	  
	  canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
	  canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
	  canvas.addEventListener('touchend', handleTouchEnd);
  
	  // Setup collaboration if user exists
	  if ($user) {
		setupCollaboration();
	  }
  
	  return () => {
		canvas.removeEventListener('mousedown', handleMouseDown);
		canvas.removeEventListener('mousemove', handleMouseMove);
		canvas.removeEventListener('mouseup', handleMouseUp);
		canvas.removeEventListener('mouseleave', handleMouseUp);
		
		canvas.removeEventListener('touchstart', handleTouchStart);
		canvas.removeEventListener('touchmove', handleTouchMove);
		canvas.removeEventListener('touchend', handleTouchEnd);
  
		// Clean up presence channel
		if (presenceChannel) {
		  supabase.removeChannel(presenceChannel);
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
	};
  </script>
  
  <div class="whiteboard-container" style="width: {width}; height: {height}">
	<canvas
	  bind:this={canvas}
	  class="whiteboard"
	  style="cursor: {currentTool === 'select' ? 'default' : 'crosshair'}"
	/>
	
	<div class="toolbar">
	  <button
		class:active={currentTool === 'pencil'}
		on:click={() => currentTool = 'pencil'}
	  >
		✏️ Pencil
	  </button>
	  <button
		class:active={currentTool === 'eraser'}
		on:click={() => currentTool = 'eraser'}
	  >
		🧽 Eraser
	  </button>
	</div>
  </div>
  
  <style>
	/* Same styles as before */
	.whiteboard-container {
	  position: relative;
	  overflow: hidden;
	  background: white;
	  border: 1px solid #e0e0e0;
	}
  
	.whiteboard {
	  display: block;
	  background: white;
	}
  
	.toolbar {
	  position: absolute;
	  bottom: 20px;
	  left: 50%;
	  transform: translateX(-50%);
	  display: flex;
	  gap: 8px;
	  background: white;
	  padding: 8px;
	  border-radius: 8px;
	  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}
  
	button {
	  padding: 8px 12px;
	  border: none;
	  border-radius: 4px;
	  background: #f0f0f0;
	  cursor: pointer;
	}
  
	button.active {
	  background: #007aff;
	  color: white;
	}
  </style>