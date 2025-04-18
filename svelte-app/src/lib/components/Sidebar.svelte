<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { sidebarCollapsed } from '$lib/stores/uiStore';
  import { user } from '$lib/stores/userStore';
  import { supabase } from '$lib/supabaseClient';
  import { onMount } from 'svelte';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { fly, fade } from 'svelte/transition';
  import { writable } from 'svelte/store';

  let email = '';
  let password = '';
  let error = '';
  let loading = false;
  let showProfileCard = false;
  let profileCardPosition = { x: 0, y: 0 };
  let userProfile: { display_name?: string } | null = null;
  let editModeActive = false;
  let showNewTabModal = false;
  let newTabName = '';
  let newTabIcon = 'document';
  let showContextMenu = false;
  let contextMenuPosition = { x: 0, y: 0 };
  let contextMenuTabIndex = -1;
  let isMobile = false;
  
  // Default navigation items
  const defaultNavItems = [
    { id: 'home', name: 'Home', href: '/', icon: 'home', default: true },
    { id: 'silos', name: 'Silos', href: '/silos', icon: 'nodes', default: true },
    { id: 'notes', name: 'Notes', href: '/notes', icon: 'document', default: true }
  ];
  
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
  onMount(() => {
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Load custom nav items from localStorage if available
    const savedNavItems = localStorage.getItem('userNavItems');
    if (savedNavItems) {
      userNavItems.set(JSON.parse(savedNavItems));
    }
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });
  
  // Save nav items when they change
  $: {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('userNavItems', JSON.stringify($userNavItems));
    }
  }
  
  function checkMobile() {
    isMobile = window.innerWidth < 768;
    if (isMobile && !$sidebarCollapsed) {
      sidebarCollapsed.set(true);
    }
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
    
    if (!target?.closest('.new-tab-modal') && !target?.closest('.add-tab-button')) {
      showNewTabModal = false;
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

  // Fetch user profile when user changes
  $: if ($user) {
    loadUserProfile();
  }

  async function loadUserProfile() {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', $user?.id || '')
      .single();

    if (!error) userProfile = data;
  }

  // Update getDisplayName
  const getDisplayName = () => {
    return userProfile?.display_name || $user?.email?.split('@')[0] || 'User';
  };
  
  // Add new tab
  function addNewTab() {
    if (!newTabName) return;
    
    const newTab = {
      id: `custom-${Date.now()}`,
      name: newTabName,
      href: `/custom/${newTabName.toLowerCase().replace(/\s+/g, '-')}`,
      icon: newTabIcon,
      default: false
    };
    
    userNavItems.update(items => [...items, newTab]);
    newTabName = '';
    newTabIcon = 'document';
    showNewTabModal = false;
  }
  
  // Remove tab
  function removeTab(index: number) {
    userNavItems.update(items => {
      const newItems = [...items];
      newItems.splice(index, 1);
      return newItems;
    });
    showContextMenu = false;
  }
  
  // Reset to defaults
  function resetToDefaults() {
    userNavItems.set([...defaultNavItems]);
    showContextMenu = false;
  }
  
  // Show context menu for tab
  function showTabContextMenu(event: MouseEvent, index: number) {
    event.preventDefault();
    contextMenuPosition = { x: event.clientX, y: event.clientY };
    contextMenuTabIndex = index;
    showContextMenu = true;
  }
  
  // Handle long press for mobile
  let longPressTimer: ReturnType<typeof setTimeout> | null = null;
  let longPressTabIndex = -1;
  
  function handleTouchStart(index: number) {
    if (!isMobile) return;
    
    longPressTabIndex = index;
    longPressTimer = setTimeout(() => {
      showContextMenu = true;
      contextMenuTabIndex = index;
      contextMenuPosition = { 
        x: window.innerWidth / 2, 
        y: window.innerHeight / 3 
      };
    }, 800); // 800ms for long press
  }
  
  function handleTouchEnd() {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  }
  
  // Get icon SVG based on icon name
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
      default:
        return `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>`;
    }
  }
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

    <!-- Navigation -->
    <nav class="flex-1 p-2 space-y-1 overflow-y-auto overflow-x-hidden">
      {#each $userNavItems as item, index}
        <div 
          class="relative group nav-item"
          on:contextmenu={(e) => showTabContextMenu(e, index)}
          on:touchstart={() => handleTouchStart(index)}
          on:touchend={handleTouchEnd}
        >
        <a href={item.href}
        class={`w-full flex items-center justify-center p-3 rounded-lg transition-all duration-200
          ${$sidebarCollapsed ? 'hover:bg-[var(--bg-primary)]' : 'transform hover:scale-105'}
          ${$page.url.pathname === item.href 
            ? 'bg-[var(--brand-green)] text-white shadow-md' 
            : 'hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]'}`}
      >
        <div class="flex ${!$sidebarCollapsed ? 'justify-start w-full' : ''}">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {@html getIconSvg(item.icon)}
          </svg>
          
          {#if !$sidebarCollapsed}
            <span class="ml-3 whitespace-nowrap overflow-hidden text-ellipsis" transition:fade={{ duration: 150 }}>
              {item.name}
            </span>
          {/if}
        </div>
      </a>
          
          {#if $sidebarCollapsed}
            <div class="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-50">
              {item.name}
            </div>
          {/if}
        </div>
      {/each}
      
      <!-- Add new tab button -->
      <button
        on:click={() => showNewTabModal = true}
        class="add-tab-button w-full flex items-center p-3 rounded-lg transition-all duration-200 hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] mt-4 transform hover:scale-105"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/>
        </svg>
        
        {#if !$sidebarCollapsed}
          <span class="ml-3" transition:fade={{ duration: 150 }}>Add New Tab</span>
        {/if}
      </button>
      
      {#if editModeActive}
        <button
          on:click={() => { editModeActive = false; }}
          class="w-full flex items-center p-3 rounded-lg transition-all duration-200 hover:bg-[var(--bg-primary)] text-[var(--text-secondary)] mt-1"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
          </svg>
          
          {#if !$sidebarCollapsed}
            <span class="ml-3" transition:fade={{ duration: 150 }}>Done</span>
          {/if}
        </button>
      {/if}
    </nav>

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
    style={`left: ${contextMenuPosition.x}px; top: ${contextMenuPosition.y}px;`}
    transition:fade={{ duration: 150 }}
  >
    {#if !$userNavItems[contextMenuTabIndex]?.default}
      <button 
        on:click={() => removeTab(contextMenuTabIndex)}
        class="w-full text-left px-3 py-2 rounded hover:bg-[var(--bg-primary)] transition-colors flex items-center"
      >
        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        Remove Tab
      </button>
    {:else}
      <div class="w-full text-left px-3 py-2 text-[var(--text-secondary)] text-sm italic">
        Cannot remove default tab
      </div>
    {/if}
    
    <button 
      on:click={resetToDefaults}
      class="w-full text-left px-3 py-2 rounded hover:bg-[var(--bg-primary)] transition-colors flex items-center mt-1"
    >
      <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
      </svg>
      Reset to Defaults
    </button>
  </div>
{/if}

<!-- New Tab Modal -->
{#if showNewTabModal}
  <div 
    class="fixed inset-0 bg-opacity-30 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
    transition:fade={{ duration: 200 }}
  >
    <div 
      class="new-tab-modal bg-[var(--bg-secondary)] rounded-xl p-5 max-w-md w-full shadow-2xl"
      transition:fly={{ y: -20, duration: 300 }}
    >
      <h3 class="text-lg font-medium mb-4">Add New Tab</h3>
      
      <form on:submit|preventDefault={addNewTab} class="space-y-4">
        <div>
          <label class="block text-sm font-medium mb-1">Tab Name</label>
          <input 
            type="text" 
            bind:value={newTabName} 
            placeholder="My Custom Tab"
            class="w-full p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]"
          />
        </div>
        
        <div>
          <label class="block text-sm font-medium mb-1">Icon</label>
          <select 
            bind:value={newTabIcon}
            class="w-full p-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)]"
          >
            {#each iconOptions as icon}
              <option value={icon.value}>{icon.label}</option>
            {/each}
          </select>
        </div>
        
        <div class="flex justify-end space-x-3 mt-6">
          <button 
            type="button" 
            on:click={() => showNewTabModal = false}
            class="px-4 py-2 border border-[var(--border-color)] rounded-lg hover:bg-[var(--bg-primary)] transition-colors"
          >
            Cancel
          </button>
          <button 
            type="submit"
            class="px-4 py-2 bg-[var(--brand-green)] text-white rounded-lg hover:bg-opacity-90 transition-colors"
          >
            Add Tab
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}