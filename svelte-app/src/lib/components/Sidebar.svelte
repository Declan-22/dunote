<script lang="ts">
// Import statements
import { page } from '$app/stores';
import { goto } from '$app/navigation';
import { sidebarCollapsed } from '$lib/stores/uiStore';
import { user } from '$lib/stores/userStore';
import { supabase } from '$lib/supabaseClient';
import { onMount, onDestroy } from 'svelte';
import { tweened } from 'svelte/motion';
import { cubicOut } from 'svelte/easing';
import { fly, fade, slide } from 'svelte/transition';
import { spaces, type Space, initSpaces, addSpace, removeSpace } from '$lib/stores/spaceStore';
import { folders, type Folder, initFolders, addFolder, removeFolder, toggleFolder, addSpaceToFolder, removeSpaceFromFolder } from '$lib/stores/folderStore';
import { flip } from 'svelte/animate';
import { writable } from 'svelte/store';
  
// Types
interface Space {
  id: string;
  name: string;
  href: string;
  icon: string;
  default?: boolean;
  color?: string;
  user_id?: string;
}
  
  interface Folder {
    id: string;
    name: string;
    color: string;
    isOpen: boolean;
    spaces: string[];
  }

// State variables
let email = '';
let password = '';
let error = '';
let loading = false;
let showProfileCard = false;
let profileCardPosition = { x: 0, y: 0 };
let userProfile: { display_name?: string } | null = null;
let showNewSpaceModal = false;
let showNewFolderModal = false;
let showContextMenu = false;
let contextMenuPosition = { x: 0, y: 0 };
let contextMenuSpaceIndex = -1;
let contextMenuFolderId = '';
let contextMenuType = ''; // 'space', 'folder', or 'emptyArea'
let isMobile = false;
let newSpaceIcon = 'document';
let newSpaceName = '';
let newSpaceColor = '#4CAF50';
let newFolderName = '';
let newFolderColor = '#2196F3';
let draggedSpace: Space | null = null;
let dragOverFolderId: string | null = null;
let currentDragSpace: Space | null = null;

  // Fetch user profile
async function loadUserProfile() {
  if (!$user) return;
  
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', $user.id)
    .single();

  if (!error) userProfile = data;
}
  
  // Default navigation items
  const defaultNavItems = [
  { id: 'home', name: 'Home', href: '/', icon: 'home', default: true },
  { id: 'silos', name: 'Silos', href: '/silos', icon: 'nodes', default: true },
  { id: 'notes', name: 'Notes', href: '/notes', icon: 'document', default: true },
  { id: 'pricing', name: 'Pricing', href: '/pricing', icon: 'pricing', default: true }
];

// Create spaces store in separate file
  const userSpaces = writable([...defaultNavItems]);
  
  // User customizable navigation items
  const userNavItems = writable([...defaultNavItems]);
  
  // Icon options for new tabs
  const iconOptions = [
    { value: 'document', label: 'Document' },
    { value: 'home', label: 'Home' },
    { value: 'nodes', label: 'Nodes' },
    { value: 'calendar', label: 'Calendar' },
    { value: 'settings', label: 'Settings' },
    { value: 'chat', label: 'Chat' },
    { value: 'pricing', label: 'Pricing' },
    { value: 'search', label: 'Search' }
  ];
  
  // Animation for sidebar width
  const sidebarWidth = tweened($sidebarCollapsed ? 70 : 180, {
  duration: 300,
  easing: cubicOut
});

// Update width when sidebar collapsed state changes
$: {
  sidebarWidth.set($sidebarCollapsed ? 70 : 180);
}

  // Check if we're on mobile
  onMount(async () => {

    try {
    const start = performance.now();
    const { data, error } = await supabase.from('_health').select('*').limit(1);
    const end = performance.now();
    
    console.log(`Supabase connectivity check: ${error ? 'FAILED' : 'OK'} (${Math.round(end - start)}ms)`);
    if (error) {
      console.error("Supabase connection error:", error);
    }
  } catch (e) {
    console.error("Failed to check Supabase connection:", e);
  }

  checkMobile();
  window.addEventListener('resize', checkMobile);
  
  // First, set up auth state listener
  const { data: authListener } = supabase.auth.onAuthStateChange(
    async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        console.log("Auth state change: user signed in", session?.user?.id);
        // Wait for user store to update
        await new Promise(resolve => setTimeout(resolve, 100));
        await initUserData();
      } else if (event === 'SIGNED_OUT') {
        console.log("Auth state change: user signed out");
        // Handle signed out state - maybe load from localStorage
        const storedSpaces = localStorage.getItem('userSpaces');
        if (storedSpaces) {
          try {
            spaces.set(JSON.parse(storedSpaces));
          } catch (e) {
            console.error("Failed to parse stored spaces:", e);
            spaces.set([...defaultNavItems]);
          }
        } else {
          spaces.set([...defaultNavItems]);
        }
      }
    }
  );
  
  // Check if we're already authenticated
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    console.log("User already authenticated on mount:", session.user.id);
    await initUserData();
  } else {
    console.log("No authenticated user on mount");
    // Load from localStorage
    const storedSpaces = localStorage.getItem('userSpaces');
    const storedFolders = localStorage.getItem('userFolders');
    
    if (storedSpaces) {
      try {
        spaces.set(JSON.parse(storedSpaces));
      } catch (e) {
        console.error("Failed to parse stored spaces:", e);
        spaces.set([...defaultNavItems]);
      }
    }
    
    if (storedFolders) {
      try {
        folders.set(JSON.parse(storedFolders));
      } catch (e) {
        console.error("Failed to parse stored folders:", e);
        folders.set([]);
      }
    }
  }
  
  return () => {
    window.removeEventListener('resize', checkMobile);
    authListener.subscription.unsubscribe();
  };
});

async function debugSpaces(userId) {
  console.log("DEBUG: Directly checking spaces table for user", userId);
  
  
  try {
    const { data, error } = await supabase
      .from('spaces')
      .select('*')
      .eq('user_id', userId);
      
    if (error) {
      console.error("DEBUG: Error fetching spaces:", error);
      return;
    }
    
    console.log("DEBUG: Raw spaces data from DB:", data);
    console.log("DEBUG: Count of spaces:", data ? data.length : 0);
    
    // If no data, let's check if the table exists and has any records
    if (!data || data.length === 0) {
      const { data: allSpaces, error: allError } = await supabase
        .from('spaces')
        .select('count');
        
      console.log("DEBUG: Total spaces in table:", allSpaces);
      console.log("DEBUG: Error checking all spaces:", allError);
    }
  } catch (e) {
    console.error("DEBUG: Fatal error checking spaces:", e);
  }
}

// Subscribe to spaces and folders changes to save to localStorage
const unsubscribeSpaces = spaces.subscribe(value => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('userSpaces', JSON.stringify(value));
  }
});

const unsubscribeFolders = folders.subscribe(value => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('userFolders', JSON.stringify(value));
  }
});

onDestroy(() => {
  unsubscribeSpaces();
  unsubscribeFolders();
});

async function initUserData() {
  if (!$user) {
    console.warn("initUserData called but no user in store");
    return;
  }
  
  console.log("Initializing user data for:", $user.id);
  
  // Load user profile
  loadUserProfile();
  
  // Load spaces first
  try {
    await initSpaces($user.id);
    console.log("Spaces loaded:", $spaces.length);
  } catch (err) {
    console.error("Error loading spaces:", err);
  }
  
  // Then load folders
  try {
    await initFolders($user.id);
    console.log("Folders loaded:", $folders.length);
  } catch (err) {
    console.error("Error loading folders:", err);
  }
}
  
  function checkMobile() {
    isMobile = window.innerWidth < 768;
    if (isMobile && !$sidebarCollapsed) {
      sidebarCollapsed.set(true);
    }
  }

  async function handleAddSpace() {
  if (!newSpaceName) return;
  
  if ($user?.id) {
    await addSpace(newSpaceName, newSpaceIcon, $user.id, newSpaceColor);
  } else {
    // Local handling
    spaces.update(items => [...items, {
      id: `space-${Date.now()}`,
      name: newSpaceName,
      href: `/spaces/${newSpaceName.toLowerCase().replace(/\s+/g, '-')}`,
      icon: newSpaceIcon,
      default: false,
      color: newSpaceColor
    }]);
  }
  
  newSpaceName = '';
  newSpaceIcon = 'document';
  newSpaceColor = '#4CAF50';
  showNewSpaceModal = false;
}

// Handle folder creation
function handleAddFolder() {
  if (!newFolderName) return;
  
  if ($user?.id) {
    addFolder(newFolderName, newFolderColor, $user.id)
      .then(result => {
        if (!result) {
          console.error("Failed to add folder to database");
        }
        // Reset the form regardless
        newFolderName = '';
        newFolderColor = '#2196F3';
        showNewFolderModal = false;
      });
  } else {
    // Add locally for non-authenticated users
    const newFolder = {
      id: `folder-${Date.now()}`,
      name: newFolderName,
      color: newFolderColor,
      spaces: [],
      isOpen: true
    };
    
    folders.update(items => [...items, newFolder]);
    
    newFolderName = '';
    newFolderColor = '#2196F3';
    showNewFolderModal = false;
  }
}



// Drag and drop handlers
function handleDragStart(space: Space) {
  draggedSpace = space;
}

function handleDragOver(e: DragEvent, folderId: string) {
  e.preventDefault();
  dragOverFolderId = folderId;
}

function handleDragLeave() {
  dragOverFolderId = null;
}

function handleDrop(folderId: string) {
  if (draggedSpace && folderId) {
    if ($user) {
      addSpaceToFolder(draggedSpace.id, folderId);
    } else {
      // Local handling for non-authenticated users
      folders.update(items => {
        const folder = items.find(f => f.id === folderId);
        if (folder && draggedSpace) {
          if (!folder.spaces.includes(draggedSpace.id)) {
            folder.spaces = [...folder.spaces, draggedSpace.id];
          }
        }
        return items;
      });
    }
  }
  draggedSpace = null;
  dragOverFolderId = null;
}

  // Click outside handler
  function handleClickOutside(event: MouseEvent) {
  const target = event.target as Element;
  
  if (!target?.closest('.profile-card') && !target?.closest('.profile-trigger')) {
    showProfileCard = false;
  }
  
  if (!target?.closest('.context-menu') && !target?.closest('.context-menu-trigger')) {
    showContextMenu = false;
  }
  
  if (!target?.closest('.new-space-modal') && !target?.closest('.add-space-button')) {
    showNewSpaceModal = false;
  }
  
  if (!target?.closest('.new-folder-modal') && !target?.closest('.add-folder-button')) {
    showNewFolderModal = false;
  }
}

  function getIconSvg(iconName: string) {
    switch (iconName) {
      case 'home':
        return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>`;
      case 'document':
        return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>`;
      case 'nodes':
        return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 4c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2H5c-1.655 0-2-.345-2-2m10 9c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2h-4c-1.655 0-2-.345-2-2m-9 7c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2H6c-1.655 0-2-.345-2-2m13-9c0-.465 0-.697-.038-.89a2 2 0 0 0-1.572-1.572c-.193-.038-.425-.038-.89-.038h-5c-.465 0-.697 0-.89-.038A2 2 0 0 1 7.038 6.89C7 6.697 7 6.465 7 6m10 9v1c0 1.886 0 2.828-.586 3.414S14.886 20 13 20h-1"/>`;
      case 'calendar':
        return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>`;
      case 'settings':
        return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>`;
      case 'chat':
        return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>`;
      case 'search':
        return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>`;
      case 'pricing':
        return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6h.008v.008H6V6z" />`;
      default:
        return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>`;
    }
  }

  async function handleLogin() {
  loading = true;
  error = '';
  try {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (authError) throw authError;
    window.location.href = $page.url.searchParams.get('returnUrl') || '/';
  } catch (e) {
    error = e instanceof Error ? e.message : 'An unknown error occurred';
  } finally {
    loading = false;
  }
}



// Update getDisplayName
const getDisplayName = () => {
  return userProfile?.display_name || $user?.email?.split('@')[0] || 'User';
};
  
  function showSpaceContextMenu(e: MouseEvent, space: Space, index: number) {
  e.preventDefault();
  contextMenuPosition = { x: e.clientX, y: e.clientY };
  contextMenuSpaceIndex = index;
  contextMenuType = 'space';
  showContextMenu = true;
}

function showFolderContextMenu(e: MouseEvent, folderId: string) {
  e.preventDefault();
  contextMenuPosition = { x: e.clientX, y: e.clientY };
  contextMenuFolderId = folderId;
  contextMenuType = 'folder';
  showContextMenu = true;
}

function showEmptyAreaContextMenu(e: MouseEvent) {
  e.preventDefault();
  e.stopPropagation(); // Add this to prevent event bubbling
  contextMenuPosition = { x: e.clientX, y: e.clientY };
  contextMenuType = 'emptyArea';
  showContextMenu = true;
}

function handleRemoveSpace(spaceId: string) {
    spaces.update(items => items.filter(item => item.id !== spaceId));
    showContextMenu = false;
  }

  function handleRemoveFolder(folderId: string) {
    folders.update(folderItems => folderItems.filter(folder => folder.id !== folderId));
    showContextMenu = false;
  }

// Add touch handling for mobile context menus
function handleTouchStart(index: number) {
  longPressTabIndex = index;
  longPressTimer = setTimeout(() => {
    const space = $spaces[index];
    if (!space) return;
    
    contextMenuPosition = { 
      x: window.innerWidth / 2 - 90, // Center the menu
      y: window.innerHeight / 3
    };
    contextMenuSpaceIndex = index;
    contextMenuType = 'space';
    showContextMenu = true;
  }, 800); // Long press duration
}

function handleTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
}

// Function to reset spaces to defaults
function resetToDefaults() {
  spaces.set([...defaultNavItems]);
  folders.set([]);
  showContextMenu = false;
}
  

  
  // Handle long press for mobile
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressTabIndex = -1;
  

  

</script>

<svelte:window on:click={handleClickOutside} />

<aside 
  class="fixed inset-y-0 z-50 bg-[var(--bg-secondary)] transition-all duration-300 ease-out shadow-lg rounded-2xl m-1 overflow-hidden flex flex-col"
  style="width: {$sidebarWidth}px; max-height: calc(100vh - 10px);"
>
  <div class="flex flex-col h-full relative">
    <!-- Collapse Toggle -->
    <button
      on:click={() => sidebarCollapsed.update((c) => !c)}
      class="p-3 hover:bg-[var(--bg-primary)] transition-all duration-200 rounded-lg mx-2 mt-2 group"
      in:fade={{ duration: 200 }}
    >
      <div class="flex items-center justify-center">
        {#if $sidebarCollapsed}
          <svg class="w-6 h-6 transform transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
          </svg>
        {:else}
          <svg class="w-6 h-6 transform transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
          </svg>
          <span class="ml-3 text-sm font-medium" transition:fade={{ duration: 200 }}>Collapse</span>
        {/if}
      </div>
    </button>

    <!-- Main Navigation -->
    <div class="flex-1 overflow-y-auto overflow-x-hidden">
      <nav class="p-2 space-y-1">

        
        {#each $spaces.filter(space => space.default) as space, index}
          <div 
            class="relative group nav-item"
            draggable={!space.default}
            on:dragstart={() => handleDragStart(space)}
            on:contextmenu={(e) => showSpaceContextMenu(e, space, index)}
          >
            <a href={space.href}
              class="w-full flex items-center p-3 rounded-lg transition-all duration-200
                {$sidebarCollapsed ? 'hover:bg-[var(--bg-primary)]' : 'transform hover:scale-105'}
                {$page.url.pathname === space.href 
                  ? 'bg-[var(--brand-green)] text-white shadow-md' 
                  : 'hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]'}"
            >
              <div class="flex {!$sidebarCollapsed ? 'justify-start w-full' : ''}">
                <svg class="w-5 h-5" fill="none" stroke={space.color || 'currentColor'} viewBox="0 0 24 24">
                  {@html getIconSvg(space.icon)}
                </svg>
                
                {#if !$sidebarCollapsed}
                  <span class="ml-3 whitespace-nowrap overflow-hidden text-ellipsis" transition:fade={{ duration: 150 }}>
                    {space.name}
                  </span>
                {/if}
              </div>
            </a>
            
            {#if $sidebarCollapsed}
              <div class="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
                {space.name}
              </div>
            {/if}
          </div>
        {/each}
      </nav>
      
      <!-- Divider -->
      <div class="mx-2 my-3 border-t border-[var(--border-color)]"></div>
      
      <!-- Custom Spaces Section -->
      <div class="p-2">
        <div class="flex items-center justify-between px-3 py-2">
          <h3 class={`text-xs text-[var(--text-secondary)] ${$sidebarCollapsed ? 'sr-only' : ''}`}>
            Spaces
          </h3>
          {#if !$sidebarCollapsed}
            <button 
              on:click={(e) => {
                e.preventDefault();
                showEmptyAreaContextMenu(e);
              }}
              class="add-button p-1 rounded-md hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]"
              title="Add"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
            </button>
          {/if}
        </div>

        {#if $user && $spaces.length <= 4} <!-- 4 would be your default spaces count -->
        <div class="p-2 text-xs text-[var(--neutral-500)] font-mono flex items-center gap-1">
          <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          {#if !$sidebarCollapsed}
            <span class="ml-1">No spaces loaded</span>
          {/if}
        </div>
{/if}

        <!-- Folders and Spaces -->
        <div class="space-y-1" on:contextmenu={(e) => showEmptyAreaContextMenu(e)}>
          <!-- Standalone Spaces (not in folders) -->
          {#each $spaces.filter(space => !space.default && !$folders.some(folder => folder.spaces.includes(space.id))) as space, index (space.id)}
          <div
          animate:flip={{ duration: 300 }}
          class="relative group nav-item"
          draggable={true}
          on:dragstart={() => handleDragStart(space)}
          on:contextmenu={(e) => showSpaceContextMenu(e, space, index)}
          on:touchstart={() => handleTouchStart(index)} 
          on:touchend={handleTouchEnd}
        >
              <a href={space.href}
                class="w-full flex items-center p-3 rounded-lg transition-all duration-200
                  {$sidebarCollapsed ? 'hover:bg-[var(--bg-primary)]' : 'transform hover:scale-105'}
                  {$page.url.pathname === space.href 
                    ? 'bg-[var(--brand-green)] text-white shadow-md' 
                    : 'hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]'}"
              >
                <div class="flex {!$sidebarCollapsed ? 'justify-start w-full' : ''}">
                  <svg class="w-5 h-5" fill="none" stroke={space.color || 'currentColor'} viewBox="0 0 24 24">
                    {@html getIconSvg(space.icon)}
                  </svg>
                  
                  {#if !$sidebarCollapsed}
                    <span class="ml-3 whitespace-nowrap overflow-hidden text-ellipsis" transition:fade={{ duration: 150 }}>
                      {space.name}
                    </span>
                  {/if}
                </div>
              </a>
              
              {#if $sidebarCollapsed}
                <div class="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
                  {space.name}
                </div>
              {/if}
            </div>
          {/each}
          
          <!-- Folders -->
          {#each $folders as folder (folder.id)}
            <div class="folder-container" 
              on:dragover={(e) => handleDragOver(e, folder.id)}
              on:dragleave={handleDragLeave}
              on:drop={() => handleDrop(folder.id)}
              class:drag-over={dragOverFolderId === folder.id}
            >
              <!-- Folder Header -->
              <div 
                class="flex items-center p-2 rounded-lg hover:bg-[var(--bg-primary)] cursor-pointer transition-all"
                on:click={() => toggleFolder(folder.id)}
                on:contextmenu={(e) => showFolderContextMenu(e, folder.id)}
              >
              <svg class="w-5 h-5 mr-2" fill="none" style="color: {folder.color}" viewBox="0 0 24 24">
                <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d={folder.isOpen 
                      ? "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" 
                      : "M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"} 
                  />
                </svg>
                
                {#if !$sidebarCollapsed}
                  <span class="text-sm font-medium flex-1" style="color: {folder.color}">
                    {folder.name}
                  </span>
                  <span class="text-xs text-[var(--text-secondary)]">
                    {folder.spaces?.length || 0}
                  </span>
                {/if}
              </div>
              
              {#if folder.isOpen && !$sidebarCollapsed}
                <div class="ml-3 pl-2 border-l border-[var(--border-color)] space-y-1" transition:slide>
                  {#each $spaces.filter(space => folder.spaces.includes(space.id)) as space, index (space.id)}
                  <div
                  animate:flip={{ duration: 300 }}
                  class="relative group nav-item"
                  draggable={true}
                  on:dragstart={() => handleDragStart(space)}
                  on:contextmenu={(e) => showSpaceContextMenu(e, space, index)}
                  on:touchstart={() => handleTouchStart(index)} 
                  on:touchend={handleTouchEnd}
                >
                      <a href={space.href}
                        class="w-full flex items-center p-2 rounded-lg transition-all duration-200
                          hover:bg-[var(--bg-primary)] 
                          {$page.url.pathname === space.href 
                            ? 'bg-[var(--brand-green)] bg-opacity-20 text-[var(--brand-green)]' 
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}"
                      >
                        <svg class="w-4 h-4" fill="none" stroke={space.color || 'currentColor'} viewBox="0 0 24 24">
                          {@html getIconSvg(space.icon)}
                        </svg>
                        <span class="ml-2 text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                          {space.name}
                        </span>
                      </a>
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
          
          <!-- Add Space/Folder Button for collapsed view -->
          {#if $sidebarCollapsed}
            <button 
              on:click={() => showNewSpaceModal = true}
              class="add-space-button w-full flex items-center p-3 rounded-lg transition-all duration-200 hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]"
            >
              <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
              </svg>
            </button>
          {/if}
        </div>
      </div>
    </div>

    <!-- Auth Section -->
    <div class="mt-auto p-2 border-t border-[var(--border-color)] mb-2">
      {#if $user}
        <div class="relative profile-trigger">
          <button 
            on:click|stopPropagation={(e) => {
              showProfileCard = !showProfileCard;
              const rect = e.currentTarget.getBoundingClientRect();
              profileCardPosition = { x: rect.left, y: rect.top };
            }}
            class="profile-trigger flex items-center gap-3 p-2 w-full hover:bg-[var(--bg-primary)] rounded-lg transition-all duration-200 transform hover:scale-105"
          >
            <div class="w-8 h-8 rounded-full bg-[var(--brand-green)] flex items-center justify-center text-white">
              {getDisplayName().charAt(0).toUpperCase()}
            </div>
            
            {#if !$sidebarCollapsed}
              <div class="flex-1 min-w-0 text-left" transition:fade={{ duration: 150 }}>
                <p class="text-sm font-medium truncate">{getDisplayName()}</p>
                <p class="text-xs text-[var(--text-secondary)] truncate">{$user.email}</p>
              </div>
            {/if}
          </button>
      
          {#if showProfileCard}
            <div 
              class="absolute profile-card z-50 min-w-[240px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-lg p-4"
              style={`left: ${$sidebarCollapsed ? profileCardPosition.x + 90 : profileCardPosition.x + 5}px; 
                     top: ${profileCardPosition.y - 80}px;`}
              transition:fly={{ y: 10, duration: 200 }}
            >
              <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-full bg-[var(--brand-green)] flex items-center justify-center text-white">
                  {getDisplayName().charAt(0).toUpperCase()}
                </div>
                <div>
                  <p class="font-medium">{getDisplayName()}</p>
                  <p class="text-sm text-[var(--text-secondary)]">{$user.email}</p>
                </div>
              </div>
              
              <button 
                on:click={async () => {
                  await supabase.auth.signOut();
                  showProfileCard = false;
                }}
                class="w-full py-2 px-4 text-left hover:bg-[var(--bg-primary)] rounded transition-colors text-sm"
              >
                Log Out
              </button>
            </div>
          {/if}
        </div>
      {:else}
        <!-- Login Form -->
        {#if !$sidebarCollapsed}
          <form on:submit|preventDefault={handleLogin} class="space-y-2" transition:fade={{ duration: 200 }}>
            {#if error}
              <div class="text-sm text-red-500">{error}</div>
            {/if}
            <input
              type="email"
              bind:value={email}
              placeholder="Email"
              class="w-full p-2 text-sm bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg"
            />
            <input
              type="password"
              bind:value={password}
              placeholder="Password"
              class="w-full p-2 text-sm bg-[var(--bg-primary)] text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg"
            />
            <button
              type="submit"
              class="w-full py-2 px-4 bg-[var(--brand-green)] text-white rounded-lg hover:bg-opacity-90 transition-all duration-200 transform hover:scale-105"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <div class="text-center text-sm">
              <a href="/signup" class="text-[var(--brand-green)] hover:underline">Create account</a>
            </div>
          </form>
        {:else}
          <button 
            on:click={() => goto('/login')}
            class="w-full p-2 hover:bg-[var(--bg-primary)] rounded-lg text-[var(--text-primary)] transition-all duration-200 transform hover:scale-105"
          >
            <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/>
            </svg>
          </button>
        {/if}
      {/if}
    </div>
  </div>
</aside>

      <!-- Context Menu -->
      {#if showContextMenu}
        <div 
          class="fixed context-menu z-[100] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-lg p-2 min-w-[180px]"
          style="left: {contextMenuPosition.x}px; top: {contextMenuPosition.y}px;"
          transition:fade={{ duration: 150 }}
        >
        {#if contextMenuType === 'space'}
        {#if !$spaces[contextMenuSpaceIndex]?.default}
          <button 
            on:click={() => {
              if ($user) {
                removeSpace($spaces[contextMenuSpaceIndex].id);
              } else {
                spaces.update(items => items.filter(item => item.id !== $spaces[contextMenuSpaceIndex].id));
              }
              showContextMenu = false;
            }}
            class="w-full text-left px-3 py-2 rounded hover:bg-[var(--bg-primary)] transition-colors flex items-center"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
            Remove Space
          </button>
          <!-- Rest of your menu items -->
        {/if}
      {:else if contextMenuType === 'folder'}
        <button 
          on:click={() => {
            if ($user) {
              removeFolder(contextMenuFolderId);
            } else {
              folders.update(items => items.filter(folder => folder.id !== contextMenuFolderId));
            }
            showContextMenu = false;
          }}
          class="w-full text-left px-3 py-2 rounded hover:bg-[var(--bg-primary)] transition-colors flex items-center"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
          Remove Folder
        </button>
      {:else if contextMenuType === 'emptyArea'}
      <button 
      on:click|stopPropagation={() => {
        showNewSpaceModal = true;
        showContextMenu = false;
      }}
      class="w-full text-left px-3 py-2 rounded hover:bg-[var(--bg-primary)] transition-colors flex items-center"
    >
      Add Space
    </button>
    <button 
      on:click|stopPropagation={() => {
        showNewFolderModal = true;
        showContextMenu = false;
      }}
      class="w-full text-left px-3 py-2 rounded hover:bg-[var(--bg-primary)] transition-colors flex items-center mt-1"
    >
      Add Folder
    </button>
      {/if}


  </div>
{/if}

<!-- New Space Modal -->
{#if showNewSpaceModal}
  <div 
    class="fixed inset-0 bg-opacity-30 backdrop-blur-sm bg-opacity-30 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
    transition:fade={{ duration: 200 }}
  >
    <div 
      class="new-space-modal bg-[var(--bg-secondary)] rounded-xl p-5 max-w-md w-full shadow-2xl"
      transition:fly={{ y: -20, duration: 300 }}
    >
      <h3 class="text-lg font-medium mb-4">Add New Space</h3>
      
      <form on:submit|preventDefault={handleAddSpace} class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Space Name</label>
          <input 
            type="text" 
            bind:value={newSpaceName} 
            placeholder="My Custom Space"
            class="w-full p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">Icon</label>
          <div class="grid grid-cols-4 gap-2">
            {#each iconOptions as icon}
              <button 
                type="button"
                class="p-2 rounded-lg {newSpaceIcon === icon.value ? 'bg-[var(--brand-green)] text-white' : 'bg-[var(--bg-primary)] hover:bg-[var(--bg-primary-hover)]'}"
                on:click={() => newSpaceIcon = icon.value}
              >
                <svg class="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {@html getIconSvg(icon.value)}
                </svg>
              </button>
            {/each}
          </div>
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">Color (optional)</label>
          <input 
            type="color"
            bind:value={newSpaceColor}
            class="w-full p-1 h-10 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]"
          />
        </div>
        
        <div class="flex justify-end space-x-3 mt-6">
          <button 
            type="button" 
            on:click={() => showNewSpaceModal = false}
            class="px-4 py-2 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-primary)] transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            class="px-4 py-2 bg-[var(--brand-green)] text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Create Space
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- New Folder Modal -->
{#if showNewFolderModal}
  <div 
    class="fixed inset-0 bg-black bg-opacity-30 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
    transition:fade={{ duration: 200 }}
  >
  <div 
  class="new-folder-modal bg-[var(--bg-secondary)] rounded-xl p-5 max-w-md w-full shadow-2xl"  
  transition:fly={{ y: -20, duration: 300 }}
>
      <h3 class="text-lg font-medium mb-4">Add New Folder</h3>
      
      <form on:submit|preventDefault={handleAddFolder} class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Folder Name</label>
          <input 
            type="text" 
            bind:value={newFolderName} 
            placeholder="My Folder"
            class="w-full p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">Color (optional)</label>
          <input 
            type="color"
            bind:value={newFolderColor}
            class="w-full p-1 h-10 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]"
          />
        </div>
        
        <div class="flex justify-end space-x-3 mt-6">
          <button 
            type="button" 
            on:click={() => showNewFolderModal = false}
            class="px-4 py-2 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-primary)] transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            class="px-4 py-2 bg-[var(--brand-green)] text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Create Folder
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}