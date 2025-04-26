<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { supabase } from '$lib/supabaseClient';
	import { user } from '$lib/stores/userStore';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	import { spaces } from '$lib/stores/spaceStore';
	import { toast } from 'svelte-french-toast';
	import { v4 as uuidv4 } from 'uuid';
	import { clickOutside } from '$lib/actions/clickOutside';
	
	// Types
	type Point = { x: number; y: number };
	type DrawingTool = 'select' | 'pencil' | 'eraser' | 'text' | 'image' | 'shape' | 'connector';
	type ToolType = 'select' | 'pencil' | 'eraser' | 'text' | 'shape' | 'connector';
	type ShapeType = 'rectangle' | 'ellipse' | 'triangle';
	
	interface Element {
	  id: string;
	  type: string;
	  position: Point;
	  selected?: boolean;
	  zIndex: number;
	}
	interface User {
  id: string;
  email?: string;
  color?: string;
  // other properties...
}
	
	interface PathElement extends Element {
	  type: 'path';
	  points: Point[];
	  color: string;
	  size: number;
	}
	
	interface TextElement extends Element {
	  type: 'text';
	  content: string;
	  color: string;
	  fontSize: number;
	  width: number;
	  height: number;
	  editing?: boolean;
	}
	
	interface ImageElement extends Element {
	  type: 'image';
	  src: string;
	  width: number;
	  height: number;
	  rotation: number;
	}
	
	interface ShapeElement extends Element {
	  type: 'shape';
	  shapeType: ShapeType;
	  width: number;
	  height: number;
	  color: string;
	  borderSize: number;
	  fillColor: string;
	  rotation: number;
	}
	
	interface ConnectorElement extends Element {
	  type: 'connector';
	  startId: string;
	  endId: string;
	  startPoint: Point;
	  endPoint: Point;
	  color: string;
	  size: number;
	  label?: string;
	}
	
	type WhiteboardElement = PathElement | TextElement | ImageElement | ShapeElement | ConnectorElement;
	
	type Collaborator = {
	  id: string;
	  name: string;
	  color: string;
	  position: Point;
	  tool?: DrawingTool;
	};
	
	type SpaceMember = {
	  id: string;
	  user_id: string;
	  space_id: string;
	  role: 'owner' | 'editor' | 'viewer';
	  email?: string;
	  full_name?: string;
	};
	
	// Space data
	let spaceId = $page.params.id;
	let spaceName = '';
	let spaceData: any = null;
	let isOwner = false;
	let userRole: 'owner' | 'editor' | 'viewer' = 'viewer';
	let spaceMembers: SpaceMember[] = [];
	
	// Canvas state
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let isDrawing = false;
	let isDragging = false;
	let isResizing = false;
	let resizeDirection = '';
	let currentTool: DrawingTool = 'select';
	let selectedShape: ShapeType = 'rectangle';
	let elements: WhiteboardElement[] = [];
	let selectedElements: WhiteboardElement[] = [];
	let dragStartPosition: Point = { x: 0, y: 0 };
	let lastPosition: Point = { x: 0, y: 0 };
	let scale = 1;
	let offsetX = 0;
	let offsetY = 0;
	let collaborators: Collaborator[] = [];
	let presenceChannel: any = null;
	let realtimeChannel: any = null;
	let saveTimeout: any = null;
	let lastSaved = new Date();
	let isSaving = false;
	let undoStack: WhiteboardElement[][] = [];
	let redoStack: WhiteboardElement[][] = [];
	let showMembersModal = false;
	let inviteEmail = '';
	let menuOpen = false;
	
	// Style options
	let brushColor = '#000000';
	let brushSize = 3;
	let textColor = '#000000';
	let fontSize = 16;
	let shapeFillColor = 'rgba(200, 200, 200, 0.5)';
	let shapeBorderColor = '#000000';
	let shapeBorderSize = 2;
	let connectorColor = '#000000';
	let connectorSize = 2;
	
	// Toolbar position
	let toolbarPosition = { x: 20, y: 20 };
	let showToolbar = true;
	let isDraggingToolbar = false;
	let toolbarDragStart = { x: 0, y: 0 };
	
	// Utils
	const generateId = () => uuidv4();
	
	const getCanvasCoordinates = (e: MouseEvent | TouchEvent): Point => {
	  const rect = canvas.getBoundingClientRect();
	  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
	  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
	  return {
		x: (clientX - rect.left - offsetX) / scale,
		y: (clientY - rect.top - offsetY) / scale
	  };
	};
	
	// Check if point is inside element bounds
	const isPointInElement = (point: Point, element: WhiteboardElement): boolean => {
	  if (element.type === 'path') {
		const pathElem = element as PathElement;
		// For paths, check if point is close to any segment
		for (let i = 1; i < pathElem.points.length; i++) {
		  const p1 = pathElem.points[i - 1];
		  const p2 = pathElem.points[i];
		  const d = distanceToSegment(point, p1, p2);
		  if (d < pathElem.size + 5) return true;
		}
		return false;
	  } else if (element.type === 'connector') {
		const connElem = element as ConnectorElement;
		// For connectors, check if point is close to the line
		const d = distanceToSegment(point, connElem.startPoint, connElem.endPoint);
		return d < connElem.size + 5;
	  } else {
		// For other elements with bounds
		const bounds = getElementBounds(element);
		return (
		  point.x >= bounds.x &&
		  point.x <= bounds.x + bounds.width &&
		  point.y >= bounds.y &&
		  point.y <= bounds.y + bounds.height
		);
	  }
	};
	
	// Calculate distance from point to line segment
	const distanceToSegment = (p: Point, v: Point, w: Point): number => {
	  const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
	  if (l2 === 0) return Math.sqrt(Math.pow(p.x - v.x, 2) + Math.pow(p.y - v.y, 2));
	  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
	  t = Math.max(0, Math.min(1, t));
	  return Math.sqrt(
		Math.pow(p.x - (v.x + t * (w.x - v.x)), 2) +
		Math.pow(p.y - (v.y + t * (w.y - v.y)), 2)
	  );
	};

	


// 5. Fix broadcastCursorPosition function
const broadcastCursorPosition = (position: Point) => {
  if (!presenceChannel || !$user) return;
  
  presenceChannel.track({
    userId: $user.id,
    userName: $user.email || $user.id,
    position,
    color: $user.color || `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`,
    tool: currentTool
  });
};

// 6. Fix scheduleSave function
const scheduleSave = () => {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(saveWhiteboard, 2000);
};

// 7. Fix the event handling in startDrawing function
const startDrawing = (point: Point, e?: MouseEvent | TouchEvent) => {
  if (!canEdit()) return;
  
  // Clear selection if not using select tool
  if (currentTool !== 'select') {
    clearSelection();
  }
  
  isDrawing = true;
  lastPosition = { ...point };
  
  switch (currentTool) {
    case 'select':
      // Check if clicking on an element
      const clickedElement = findElementAtPosition(point);
      
      if (clickedElement) {
        // Handle selection (with shift for multi-select)
        if (e && 'shiftKey' in e && e.shiftKey) {
          clearSelection();
        }
        
        selectElement(clickedElement);
        isDragging = true;
        dragStartPosition = { ...point };
      } else {
        // Clicking on empty canvas clears selection
        clearSelection();
      }
      break;
      
    case 'pencil':
      saveSnapshot();
      const newPath = createPathElement(point);
      elements = [...elements, newPath];
      break;
      
    case 'eraser':
      // Similar to pencil but with white color
      saveSnapshot();
      const eraserPath = createPathElement(point);
      eraserPath.color = '#FFFFFF';
      eraserPath.size = brushSize * 2;
      elements = [...elements, eraserPath];
      break;
      
    case 'text':
      saveSnapshot();
      const newText = createTextElement(point);
      elements = [...elements, newText];
      selectedElements = [newText];
      isDrawing = false; // Don't continue drawing for text
      break;
      
    case 'shape':
      saveSnapshot();
      const newShape = createShapeElement(point);
      elements = [...elements, newShape];
      selectedElements = [newShape];
      break;
      
    case 'connector':
      saveSnapshot();
      const newConnector = createConnectorElement(point);
      elements = [...elements, newConnector];
      selectedElements = [newConnector];
      break;
  }
  
  redrawCanvas();
  broadcastCursorPosition(point);
};

// 8. Fix the createPathElement function to handle eraser type correctly
const createPathElement = (point: Point): PathElement => ({
  id: generateId(),
  type: 'path',
  position: { ...point },
  points: [{ ...point }],
  color: currentTool === 'eraser' ? '#FFFFFF' : brushColor,
  size: brushSize,
  zIndex: getNextZIndex()
});
	
	const createTextElement = (point: Point): TextElement => ({
	  id: generateId(),
	  type: 'text',
	  position: { ...point },
	  content: 'Double-click to edit',
	  color: textColor,
	  fontSize,
	  width: 200,
	  height: 40,
	  editing: true,
	  selected: true,
	  zIndex: getNextZIndex()
	});
	
	const createShapeElement = (point: Point): ShapeElement => ({
	  id: generateId(),
	  type: 'shape',
	  shapeType: selectedShape,
	  position: { ...point },
	  width: 0,
	  height: 0,
	  color: shapeBorderColor,
	  borderSize: shapeBorderSize,
	  fillColor: shapeFillColor,
	  rotation: 0,
	  zIndex: getNextZIndex()
	});
	
	const createImageElement = (point: Point, src: string, width: number, height: number): ImageElement => ({
	  id: generateId(),
	  type: 'image',
	  position: { ...point },
	  src,
	  width,
	  height,
	  rotation: 0,
	  zIndex: getNextZIndex()
	});
	
	const createConnectorElement = (startPoint: Point): ConnectorElement => ({
	  id: generateId(),
	  type: 'connector',
	  position: { ...startPoint },
	  startId: '',
	  endId: '',
	  startPoint: { ...startPoint },
	  endPoint: { ...startPoint },
	  color: connectorColor,
	  size: connectorSize,
	  zIndex: getNextZIndex()
	});
	
	const getNextZIndex = (): number => {
	  if (elements.length === 0) return 1;
	  return Math.max(...elements.map(el => el.zIndex)) + 1;
	};
	

	
	const continueDrawing = (point: Point) => {
	  if (!isDrawing) return;
	  
	  switch (currentTool) {
		case 'select':
		  if (isDragging && selectedElements.length > 0) {
			const dx = point.x - lastPosition.x;
			const dy = point.y - lastPosition.y;
			
			// Move all selected elements
			selectedElements.forEach(element => {
			  element.position.x += dx;
			  element.position.y += dy;
			  
			  // Update points for paths
			  if (element.type === 'path') {
				const pathElem = element as PathElement;
				pathElem.points = pathElem.points.map(p => ({
				  x: p.x + dx,
				  y: p.y + dy
				}));
			  }
			  
			  // Update connector points
			  if (element.type === 'connector') {
				const connElem = element as ConnectorElement;
				connElem.startPoint.x += dx;
				connElem.startPoint.y += dy;
				connElem.endPoint.x += dx;
				connElem.endPoint.y += dy;
			  }
			});
		  }
		  break;
		  
		case 'pencil':
		case 'eraser':
		  // Add point to the current path
		  const pathElem = elements[elements.length - 1] as PathElement;
		  pathElem.points.push({ ...point });
		  break;
		  
		case 'shape':
		  // Resize the shape based on drag
		  const shapeElem = elements[elements.length - 1] as ShapeElement;
		  const width = point.x - shapeElem.position.x;
		  const height = point.y - shapeElem.position.y;
		  shapeElem.width = Math.abs(width);
		  shapeElem.height = Math.abs(height);
		  
		  // Adjust position if dragging left or up
		  if (width < 0) {
			shapeElem.position.x = point.x;
		  }
		  if (height < 0) {
			shapeElem.position.y = point.y;
		  }
		  break;
		  
		case 'connector':
		  // Update end point of connector
		  const connElem = elements[elements.length - 1] as ConnectorElement;
		  connElem.endPoint = { ...point };
		  
		  // Check if hovering over an element to connect to
		  const targetElement = findElementAtPosition(point);
		  if (targetElement && targetElement.id !== connElem.id) {
			connElem.endId = targetElement.id;
		  } else {
			connElem.endId = '';
		  }
		  break;
	  }
	  
	  lastPosition = { ...point };
	  redrawCanvas();
	  broadcastCursorPosition(point);
	  scheduleSave();
	};
	
	const endDrawing = (point: Point) => {
	  if (!isDrawing) return;
	  
	  switch (currentTool) {
		case 'select':
		  isDragging = false;
		  break;
		  
		case 'connector':
		  // Finalize connector
		  const connElem = elements[elements.length - 1] as ConnectorElement;
		  
		  // If start or end isn't connected to anything, try to find an element
		  const startElement = findElementAtPosition(connElem.startPoint);
		  if (startElement && startElement.id !== connElem.id) {
			connElem.startId = startElement.id;
		  }
		  
		  const endElement = findElementAtPosition(connElem.endPoint);
		  if (endElement && endElement.id !== connElem.id) {
			connElem.endId = endElement.id;
		  }
		  
		  // If connector doesn't connect anything, remove it
		  if (!connElem.startId && !connElem.endId) {
			elements = elements.filter(e => e.id !== connElem.id);
		  }
		  break;
	  }
	  
	  isDrawing = false;
	  redrawCanvas();
	  broadcastElements();
	  saveWhiteboard();
	};
	
	// Element selection functions
	const findElementAtPosition = (point: Point): WhiteboardElement | null => {
	  // Search in reverse order to find top elements first
	  for (let i = elements.length - 1; i >= 0; i--) {
		if (isPointInElement(point, elements[i])) {
		  return elements[i];
		}
	  }
	  return null;
	};
	
	const selectElement = (element: WhiteboardElement) => {
	  element.selected = true;
	  selectedElements = [...selectedElements.filter(e => e.id !== element.id), element];
	  
	  // Bring selected element to front
	  element.zIndex = getNextZIndex();
	  
	  // Sort elements by z-index
	  elements.sort((a, b) => a.zIndex - b.zIndex);
	};
	
	const clearSelection = () => {
	  selectedElements.forEach(element => {
		element.selected = false;
		if (element.type === 'text') {
		  (element as TextElement).editing = false;
		}
	  });
	  selectedElements = [];
	};
	
	// Canvas rendering
	const redrawCanvas = () => {
	  if (!ctx) return;
	  
	  // Clear canvas
	  ctx.clearRect(0, 0, canvas.width, canvas.height);
	  
	  // Apply transformation
	  ctx.save();
	  ctx.translate(offsetX, offsetY);
	  ctx.scale(scale, scale);
	  
	  // Draw grid (optional)
	  drawGrid();
	  
	  // Sort elements by z-index before drawing
	  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);
	  
	  // Draw all elements
	  sortedElements.forEach(element => {
		drawElement(element);
	  });
	  
	  // Draw selection handles for selected elements
	  selectedElements.forEach(element => {
		drawSelectionHandles(element);
	  });
	  
	  ctx.restore();
	  
	  // Draw collaborators (outside the transform)
	  drawCollaborators();
	};
	
	const drawGrid = () => {
	  if (!ctx) return;
	  
	  const gridSize = 20;
	  const width = canvas.width / scale;
	  const height = canvas.height / scale;
	  
	  ctx.beginPath();
	  ctx.strokeStyle = '#E0E0E0';
	  ctx.lineWidth = 0.5;
	  
	  // Vertical lines
	  for (let x = 0; x <= width; x += gridSize) {
		ctx.moveTo(x, 0);
		ctx.lineTo(x, height);
	  }
	  
	  // Horizontal lines
	  for (let y = 0; y <= height; y += gridSize) {
		ctx.moveTo(0, y);
		ctx.lineTo(width, y);
	  }
	  
	  ctx.stroke();
	};
	
	const drawElement = (element: WhiteboardElement) => {
	  if (!ctx) return;
	  
	  ctx.globalCompositeOperation = element.type === 'eraser' ? 'destination-out' : 'source-over';
	  
	  switch (element.type) {
		case 'path':
		  drawPath(element as PathElement);
		  break;
		case 'text':
		  drawText(element as TextElement);
		  break;
		case 'shape':
		  drawShape(element as ShapeElement);
		  break;
		case 'image':
		  drawImage(element as ImageElement);
		  break;
		case 'connector':
		  drawConnector(element as ConnectorElement);
		  break;
	  }
	};
	
	const drawPath = (element: PathElement) => {
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
	
	const drawText = (element: TextElement) => {
	  ctx.font = `${element.fontSize}px Arial`;
	  ctx.fillStyle = element.color;
	  ctx.textBaseline = 'top';
	  
	  // Draw background if editing
	  if (element.editing) {
		ctx.fillStyle = 'rgba(200, 200, 255, 0.3)';
		ctx.fillRect(
		  element.position.x - 4,
		  element.position.y - 4,
		  element.width + 8,
		  element.height + 8
		);
		ctx.fillStyle = element.color;
	  }
	  
	  // Split text into lines and draw each line
	  const lines = element.content.split('\n');
	  const lineHeight = element.fontSize * 1.2;
	  
	  lines.forEach((line, i) => {
		ctx.fillText(
		  line,
		  element.position.x,
		  element.position.y + i * lineHeight
		);
	  });
	};
	
	const drawShape = (element: ShapeElement) => {
	  ctx.fillStyle = element.fillColor;
	  ctx.strokeStyle = element.color;
	  ctx.lineWidth = element.borderSize;
	  
	  // Save context for rotation
	  ctx.save();
	  
	  // Translate to the center of the shape for rotation
	  const centerX = element.position.x + element.width / 2;
	  const centerY = element.position.y + element.height / 2;
	  ctx.translate(centerX, centerY);
	  ctx.rotate(element.rotation * Math.PI / 180);
	  ctx.translate(-centerX, -centerY);
	  
	  switch (element.shapeType) {
		case 'rectangle':
		  ctx.beginPath();
		  ctx.rect(
			element.position.x,
			element.position.y,
			element.width,
			element.height
		  );
		  break;
		  
		case 'ellipse':
		  ctx.beginPath();
		  ctx.ellipse(
			element.position.x + element.width / 2,
			element.position.y + element.height / 2,
			element.width / 2,
			element.height / 2,
			0,
			0,
			Math.PI * 2
		  );
		  break;
		  
		case 'triangle':
		  ctx.beginPath();
		  ctx.moveTo(element.position.x + element.width / 2, element.position.y);
		  ctx.lineTo(element.position.x + element.width, element.position.y + element.height);
		  ctx.lineTo(element.position.x, element.position.y + element.height);
		  ctx.closePath();
		  break;
	  }
	  
	  ctx.fill();
	  ctx.stroke();
	  
	  // Restore context
	  ctx.restore();
	};
	
	const drawImage = (element: ImageElement) => {
	  // Find the image in our loaded images cache or load it
	  const img = new Image();
	  img.src = element.src;
	  
	  if (img.complete) {
		drawLoadedImage(element, img);
	  } else {
		img.onload = () => {
		  drawLoadedImage(element, img);
		};
	  }
	};
	
	const drawLoadedImage = (element: ImageElement, img: HTMLImageElement) => {
	  // Save context for rotation
	  ctx.save();
	  
	  // Translate to the center of the image for rotation
	  const centerX = element.position.x + element.width / 2;
	  const centerY = element.position.y + element.height / 2;
	  ctx.translate(centerX, centerY);
	  ctx.rotate(element.rotation * Math.PI / 180);
	  ctx.translate(-centerX, -centerY);
	  
	  // Draw the image
	  ctx.drawImage(
		img,
		element.position.x,
		element.position.y,
		element.width,
		element.height
	  );
	  
	  // Restore context
	  ctx.restore();
	};
	
	const drawConnector = (element: ConnectorElement) => {
	  ctx.beginPath();
	  ctx.strokeStyle = element.color;
	  ctx.lineWidth = element.size;
	  ctx.lineCap = 'round';
	  
	  // Get actual start and end points (considering connected elements)
	  let startPoint = { ...element.startPoint };
	  let endPoint = { ...element.endPoint };
	  
	  if (element.startId) {
		const startElement = elements.find(e => e.id === element.startId);
		if (startElement) {
		  const bounds = getElementBounds(startElement);
		  startPoint = {
			x: bounds.x + bounds.width / 2,
			y: bounds.y + bounds.height / 2
		  };
		}
	  }
	  
	  if (element.endId) {
		const endElement = elements.find(e => e.id === element.endId);
		if (endElement) {
		  const bounds = getElementBounds(endElement);
		  endPoint = {
			x: bounds.x + bounds.width / 2,
			y: bounds.y + bounds.height / 2
		  };
		}
	  }
	  
	  // Update element's points
	  element.startPoint = startPoint;
	  element.endPoint = endPoint;
	  
	  // Draw the line
	  ctx.moveTo(startPoint.x, startPoint.y);
	  ctx.lineTo(endPoint.x, endPoint.y);
	  ctx.stroke();
	  
	  // Draw an arrow at the end
	  drawArrow(endPoint, startPoint, 10);
	  
	  // Draw label if exists
	  if (element.label) {
		const midX = (startPoint.x + endPoint.x) / 2;
		const midY = (startPoint.y + endPoint.y) / 2;
		
		ctx.font = '12px Arial';
		ctx.fillStyle = element.color;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText(element.label, midX, midY);
	  }
	};
	
	const drawArrow = (tip: Point, base: Point, size: number) => {
	  // Calculate the angle of the line
	  const angle = Math.atan2(tip.y - base.y, tip.x - base.x);
	  
	  // Draw the arrow head
	  ctx.beginPath();
	  ctx.moveTo(tip.x, tip.y);
	  ctx.lineTo(
		tip.x - size * Math.cos(angle - Math.PI / 6),
		tip.y - size * Math.sin(angle - Math.PI / 6)
	  );
	  ctx.lineTo(
		tip.x - size * Math.cos(angle + Math.PI / 6),
		tip.y - size * Math.sin(angle + Math.PI / 6)
	  );
	  ctx.closePath();
	  ctx.fillStyle = ctx.strokeStyle;
	  ctx.fill();
	};
	
	const drawSelectionHandles = (element: WhiteboardElement) => {
  const bounds = getElementBounds(element);
  const handleSize = 8 / scale;
  
  ctx.fillStyle = '#4285F4';
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1 / scale;
  
  // Draw selection rectangle
  ctx.strokeRect(
    bounds.x - handleSize / 2,
    bounds.y - handleSize / 2,
    bounds.width + handleSize,
    bounds.height + handleSize
  );
  
  // Draw handles (only for shapes, images, text)
  if (['shape', 'image', 'text'].includes(element.type)) {
    // Draw the 8 resize handles
    const handles = [
      { x: bounds.x, y: bounds.y, cursor: 'nwse-resize', dir: 'tl' },
      { x: bounds.x + bounds.width / 2, y: bounds.y, cursor: 'ns-resize', dir: 't' },
      { x: bounds.x + bounds.width, y: bounds.y, cursor: 'nesw-resize', dir: 'tr' },
      { x: bounds.x, y: bounds.y + bounds.height / 2, cursor: 'ew-resize', dir: 'l' },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height / 2, cursor: 'ew-resize', dir: 'r' },
      { x: bounds.x, y: bounds.y + bounds.height, cursor: 'nesw-resize', dir: 'bl' },
      { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height, cursor: 'ns-resize', dir: 'b' },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height, cursor: 'nwse-resize', dir: 'br' }
    ];
    
    // Draw each handle
    handles.forEach(handle => {
      ctx.fillRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      );
      ctx.strokeRect(
        handle.x - handleSize / 2,
        handle.y - handleSize / 2,
        handleSize,
        handleSize
      );
    });
  }
};

const drawCollaborators = () => {
  if (!ctx) return;
  
  ctx.save();
  collaborators.forEach(collaborator => {
    if (collaborator.id === $user?.id) return; // Skip self
    
    // Draw cursor at collaborator's position
    const x = collaborator.position.x * scale + offsetX;
    const y = collaborator.position.y * scale + offsetY;
    
    // Draw cursor
    ctx.fillStyle = collaborator.color;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 15, y + 5);
    ctx.lineTo(x + 5, y + 15);
    ctx.closePath();
    ctx.fill();
    
    // Draw name
    ctx.font = '12px Arial';
    ctx.fillStyle = collaborator.color;
    ctx.fillText(collaborator.name, x + 10, y - 5);
    
    // Draw tool indicator if available
    if (collaborator.tool) {
      ctx.fillText(collaborator.tool, x + 10, y + 15);
    }
  });
  ctx.restore();
};
  
  // Keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    if (!canEdit()) return;
    
    // Prevent default for special keys
    if (['Delete', 'Backspace', 'Escape', 'z', 'y', 'c', 'v', 'x', 'a'].includes(e.key)) {
      e.preventDefault();
    }
    
    // Delete selected elements
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedElements.length > 0) {
        saveSnapshot();
        elements = elements.filter(el => !selectedElements.some(sel => sel.id === el.id));
        selectedElements = [];
        redrawCanvas();
        broadcastElements();
        saveWhiteboard();
      }
    }
    
    // Escape to clear selection
    if (e.key === 'Escape') {
      clearSelection();
      redrawCanvas();
    }
    
    // Undo (Ctrl+Z)
    if (e.key === 'z' && (e.ctrlKey || e.metaKey)) {
      if (!e.shiftKey) {
        undo();
      } else {
        redo();
      }
    }
    
    // Redo (Ctrl+Y or Ctrl+Shift+Z)
    if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) ||
        (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
      redo();
    }
    
    // Cut (Ctrl+X)
    if (e.key === 'x' && (e.ctrlKey || e.metaKey)) {
      if (selectedElements.length > 0) {
        saveSnapshot();
        // Store selected elements in clipboard
        localStorage.setItem('whiteboard-clipboard', JSON.stringify(selectedElements));
        
        // Remove selected elements
        elements = elements.filter(el => !selectedElements.some(sel => sel.id === el.id));
        selectedElements = [];
        redrawCanvas();
        broadcastElements();
        saveWhiteboard();
      }
    }
    
    // Copy (Ctrl+C)
    if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      if (selectedElements.length > 0) {
        // Store selected elements in clipboard
        localStorage.setItem('whiteboard-clipboard', JSON.stringify(selectedElements));
      }
    }
    
    // Paste (Ctrl+V)
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      const clipboardContent = localStorage.getItem('whiteboard-clipboard');
      if (clipboardContent) {
        saveSnapshot();
        try {
          const pastedElements: WhiteboardElement[] = JSON.parse(clipboardContent);
          
          // Create new IDs and offset position
          const newElements = pastedElements.map(el => {
            const newEl = { ...el, id: generateId(), selected: true, zIndex: getNextZIndex() };
            
            // Offset position to make it clear it's a copy
            newEl.position = { x: newEl.position.x + 20, y: newEl.position.y + 20 };
            
            // Update points for paths
            if (newEl.type === 'path') {
              const pathElem = newEl as PathElement;
              pathElem.points = pathElem.points.map(p => ({
                x: p.x + 20,
                y: p.y + 20
              }));
            }
            
            // Update connector points
            if (newEl.type === 'connector') {
              const connElem = newEl as ConnectorElement;
              connElem.startPoint = { x: connElem.startPoint.x + 20, y: connElem.startPoint.y + 20 };
              connElem.endPoint = { x: connElem.endPoint.x + 20, y: connElem.endPoint.y + 20 };
              
              // Clear connections as they might not exist anymore
              connElem.startId = '';
              connElem.endId = '';
            }
            
            return newEl;
          });
          
          // Clear current selection
          clearSelection();
          
          // Add new elements and select them
          elements = [...elements, ...newElements];
          selectedElements = newElements;
          
          redrawCanvas();
          broadcastElements();
          saveWhiteboard();
        } catch (err) {
          console.error('Failed to paste elements:', err);
        }
      }
    }
    
    // Select all (Ctrl+A)
    if (e.key === 'a' && (e.ctrlKey || e.metaKey)) {
      selectedElements = [...elements];
      elements.forEach(el => {
        el.selected = true;
      });
      redrawCanvas();
    }
  };
  
  // History management (undo/redo)
  const saveSnapshot = () => {
    undoStack.push(JSON.parse(JSON.stringify(elements)));
    redoStack = [];
  };
  
  const undo = () => {
    if (undoStack.length === 0) return;
    
    // Save current state to redo stack
    redoStack.push(JSON.parse(JSON.stringify(elements)));
    
    // Restore last state from undo stack
    elements = undoStack.pop() || [];
    clearSelection();
    redrawCanvas();
    broadcastElements();
    saveWhiteboard();
  };
  
  const redo = () => {
    if (redoStack.length === 0) return;
    
    // Save current state to undo stack
    undoStack.push(JSON.parse(JSON.stringify(elements)));
    
    // Restore last state from redo stack
    elements = redoStack.pop() || [];
    clearSelection();
    redrawCanvas();
    broadcastElements();
    saveWhiteboard();
  };
  
  // Image handling
  const addImage = (file: File) => {
    if (!canEdit()) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        saveSnapshot();
        
        const img = new Image();
        img.onload = () => {
          // Create new image element at center of viewport
          const vWidth = canvas.width / scale;
          const vHeight = canvas.height / scale;
          const centerX = (-offsetX / scale) + vWidth / 2;
          const centerY = (-offsetY / scale) + vHeight / 2;
          
          // Calculate size while maintaining aspect ratio
          const maxSize = 300;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > maxSize) {
              height = (height * maxSize) / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = (width * maxSize) / height;
              height = maxSize;
            }
          }
          
          const newImage = createImageElement(
            { x: centerX - width / 2, y: centerY - height / 2 },
            e.target?.result as string,
            width,
            height
          );
          
          elements = [...elements, newImage];
          clearSelection();
          selectElement(newImage);
          redrawCanvas();
          broadcastElements();
          saveWhiteboard();
        };
        img.src = e.target?.result as string;
      }
    };
    reader.readAsDataURL(file);
  };
  
  // Toolbar management
  const handleToolbarMouseDown = (e: MouseEvent) => {
    if (e.target && (e.target as HTMLElement).closest('.toolbar-drag-handle')) {
      isDraggingToolbar = true;
      toolbarDragStart = { x: e.clientX - toolbarPosition.x, y: e.clientY - toolbarPosition.y };
      e.preventDefault();
    }
  };
  
  const handleToolbarMouseMove = (e: MouseEvent) => {
    if (isDraggingToolbar) {
      toolbarPosition = {
        x: e.clientX - toolbarDragStart.x,
        y: e.clientY - toolbarDragStart.y
      };
      e.preventDefault();
    }
  };
  
  const handleToolbarMouseUp = () => {
    isDraggingToolbar = false;
  };
  
  // Collaborative features
  const setupRealtimeCollaboration = async () => {
    if (!spaceId || !$user) return;
    
    // Presence channel for cursor positions
    presenceChannel = supabase.channel(`presence-whiteboard-${spaceId}`);
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState();
        updateCollaborators(state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('Join:', key, newPresences);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('Leave:', key, leftPresences);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await trackPresence();
        }
      });
    
    // Realtime channel for elements
    realtimeChannel = supabase.channel(`whiteboard-${spaceId}`);
    
    realtimeChannel
      .on('broadcast', { event: 'elements' }, ({ payload }) => {
        if (payload.userId !== $user?.id) {
          elements = payload.elements;
          clearSelection();
          redrawCanvas();
        }
      })
      .subscribe();
  };
  
  const trackPresence = async () => {
    if (!presenceChannel || !$user) return;
    
    // Generate random color for user if not already assigned
    const userColor = `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`;
    
    await presenceChannel.track({
      userId: $user.id,
      userName: $user.email || $user.id,
      position: { x: 0, y: 0 },
      color: userColor,
      tool: currentTool
    });
  };
  
  const updateCollaborators = (state: any) => {
    const newCollaborators: Collaborator[] = [];
    
    Object.keys(state).forEach(key => {
      const presenceData = state[key][0];
      if (presenceData && presenceData.userId !== $user?.id) {
        newCollaborators.push({
          id: presenceData.userId,
          name: presenceData.userName,
          color: presenceData.color,
          position: presenceData.position,
          tool: presenceData.tool
        });
      }
    });
    
    collaborators = newCollaborators;
    redrawCanvas();
  };
  

  
  // Save and load functionality
  const saveWhiteboard = async () => {
    if (!spaceId || !$user || !canEdit()) return;
    
    // Prevent too frequent saves
    const now = new Date();
    if (isSaving || (now.getTime() - lastSaved.getTime() < 1000)) {
      return scheduleSave();
    }
    
    isSaving = true;
    
    try {
      const { error } = await supabase
        .from('whiteboard_data')
        .upsert({
          space_id: spaceId,
          data: JSON.stringify(elements),
          updated_at: new Date().toISOString()
        }, { onConflict: 'space_id' });
      
      if (error) {
        throw error;
      }
      
      lastSaved = new Date();
    } catch (error) {
      console.error('Error saving whiteboard:', error);
      toast.error('Failed to save whiteboard');
    } finally {
      isSaving = false;
    }
  };
  
  const loadWhiteboard = async () => {
    if (!spaceId) return;
    
    try {
      const { data, error } = await supabase
        .from('whiteboard_data')
        .select('data')
        .eq('space_id', spaceId)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      
      if (data?.data) {
        elements = JSON.parse(data.data);
        redrawCanvas();
      }
    } catch (error) {
      console.error('Error loading whiteboard:', error);
      toast.error('Failed to load whiteboard');
    }
  };
  

  
  const inviteMember = async () => {
    if (!spaceId || !canManageMembers() || !inviteEmail) return;
    
    try {
      // First check if user exists
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail)
        .single();
      
      if (userError) {
        toast.error('User not found with this email');
        return;
      }
      
      // Check if already a member
      const existingMember = spaceMembers.find(m => m.user_id === userData.id);
      if (existingMember) {
        toast.error('User is already a member of this space');
        return;
      }
      
      // Add member
      const { data, error } = await supabase
        .from('space_members')
        .insert({
          space_id: spaceId,
          user_id: userData.id,
          role: 'editor' // Default role
        })
        .select('id, user_id, space_id, role');
      
      if (error) throw error;
      
      if (data?.[0]) {
        spaceMembers = [...spaceMembers, {
          ...data[0],
          email: inviteEmail,
          full_name: ''
        }];
        
        toast.success(`Invited ${inviteEmail} successfully`);
        inviteEmail = '';
      }
    } catch (error) {
      console.error('Error inviting member:', error);
      toast.error('Failed to invite member');
    }
  };

  
  
  const removeMember = async (memberId: string) => {
    if (!spaceId || !canManageMembers()) return;
    
    try {
      const { error } = await supabase
        .from('space_members')
        .delete()
        .eq('id', memberId);
      
      if (error) throw error;
      
      spaceMembers = spaceMembers.filter(m => m.id !== memberId);
      toast.success('Member removed successfully');
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Failed to remove member');
    }
  };
  
  const updateMemberRole = async (memberId: string, role: 'owner' | 'editor' | 'viewer') => {
    if (!spaceId || !canManageMembers()) return;
    
    try {
      const { error } = await supabase
        .from('space_members')
        .update({ role })
        .eq('id', memberId);
      
      if (error) throw error;
      
      spaceMembers = spaceMembers.map(m => 
        m.id === memberId ? { ...m, role } : m
      );
      
      toast.success('Member role updated successfully');
    } catch (error) {
      console.error('Error updating member role:', error);
      toast.error('Failed to update member role');
    }
  };
  
  // Permission checks
  const canEdit = (): boolean => {
    return isOwner || userRole === 'owner' || userRole === 'editor';
  };
  
  const canManageMembers = (): boolean => {
    return isOwner || userRole === 'owner';
  };
  
  // Lifecycle hooks
  onMount(async () => {
    if (!browser) return;
    
    // Initialize canvas
    canvas = document.getElementById('whiteboard-canvas') as HTMLCanvasElement;
    ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    
    // Set canvas size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      redrawCanvas();
    };
    
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
    
    // Load space data and whiteboard
    await loadSpaceData();
    await loadWhiteboard();
    
    // Setup realtime collaboration
    await setupRealtimeCollaboration();
    
    // Event listeners
    canvas.addEventListener('mousedown', (e) => startDrawing(getCanvasCoordinates(e)));
    canvas.addEventListener('mousemove', (e) => continueDrawing(getCanvasCoordinates(e)));
    canvas.addEventListener('mouseup', (e) => endDrawing(getCanvasCoordinates(e)));
    canvas.addEventListener('mouseleave', (e) => endDrawing(getCanvasCoordinates(e)));
    
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      startDrawing(getCanvasCoordinates(e));
    });
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      continueDrawing(getCanvasCoordinates(e));
    });
    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      endDrawing(getCanvasCoordinates(e));
    });
    
    // Wheel event for zooming
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      
      // Get mouse position before zoom
      const pos = getCanvasCoordinates(e);
      
      // Adjust scale by wheel delta
      const zoomFactor = 0.1;
      const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor;
      const newScale = Math.max(0.1, Math.min(5, scale + delta));
      
      // Adjust offset to zoom around mouse position
      if (newScale !== scale) {
        const scaleFactor = newScale / scale;
        offsetX = pos.x * scale - pos.x * newScale + offsetX;
        offsetY = pos.y * scale - pos.y * newScale + offsetY;
        scale = newScale;
      }
      
      redrawCanvas();
    });
    
    // Keyboard events
    window.addEventListener('keydown', handleKeyDown);
    
    // Toolbar drag events
    window.addEventListener('mousedown', handleToolbarMouseDown);
    window.addEventListener('mousemove', handleToolbarMouseMove);
    window.addEventListener('mouseup', handleToolbarMouseUp);
    
    // File drop events for images
    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file.type.startsWith('image/')) {
          addImage(file);
        }
      }
    });
  });
  
  onDestroy(() => {
    // Clean up event listeners
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('mousedown', handleToolbarMouseDown);
    window.removeEventListener('mousemove', handleToolbarMouseMove);
    window.removeEventListener('mouseup', handleToolbarMouseUp);
    
    // Clean up realtime channels
    if (presenceChannel) {
      presenceChannel.unsubscribe();
    }
    
    if (realtimeChannel) {
      realtimeChannel.unsubscribe();
    }
    
    // Save changes
    saveWhiteboard();
  });
  
  // Menu toggle
  const toggleMenu = () => {
    menuOpen = !menuOpen;
  };
  
  // Members modal toggle
  const toggleMembersModal = () => {
    showMembersModal = !showMembersModal;
  };
  
  // Reset canvas position and zoom
  const resetView = () => {
    scale = 1;
    offsetX = 0;
    offsetY = 0;
    redrawCanvas();
  };

</script>

