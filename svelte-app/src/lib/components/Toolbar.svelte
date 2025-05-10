<!-- Toolbar.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
    import { sidebarCollapsed } from '$lib/stores/uiStore';
  
  const dispatch = createEventDispatcher();
  
  // Active dropdown tracker
  let activeDropdown: string | null = null;
  
  // Menu data structure
  const menus = [
   
    {
      id: 'file',
      label: 'File',
      items: [
        { id: 'new-task', label: 'New Task', action: () => dispatch('action', { type: 'new-task' }) },
        { id: 'new-note', label: 'New Note', action: () => dispatch('action', { type: 'new-note' }) },
        { id: 'new-space', label: 'New Space', action: () => dispatch('action', { type: 'new-space' }) },
        { type: 'separator' },
        { id: 'export', label: 'Export Data', action: () => dispatch('action', { type: 'export' }) },
      ]
    },
    {
      id: 'edit',
      label: 'Edit',
      items: [
        { id: 'undo', label: 'Undo', action: () => dispatch('action', { type: 'undo' }) },
        { id: 'redo', label: 'Redo', action: () => dispatch('action', { type: 'redo' }) },
        { type: 'separator' },
        { id: 'cut', label: 'Cut', action: () => dispatch('action', { type: 'cut' }) },
        { id: 'copy', label: 'Copy', action: () => dispatch('action', { type: 'copy' }) },
        { id: 'paste', label: 'Paste', action: () => dispatch('action', { type: 'paste' }) },
        { type: 'separator' },
        { id: 'preferences', label: 'Preferences', action: () => dispatch('action', { type: 'preferences' }) },
      ]
    },
    {
      id: 'view',
      label: 'View',
      items: [
        { id: 'completed', label: 'Show Completed Tasks', action: () => dispatch('action', { type: 'toggle-completed' }) },
        { id: 'all-notes', label: 'All Notes', action: () => dispatch('action', { type: 'all-notes' }) },
        { type: 'separator' },
        { id: 'dark-mode', label: 'Toggle Dark Mode', action: () => dispatch('action', { type: 'toggle-theme' }) },
        { id: 'sidebar', label: 'Toggle Sidebar', action: () => dispatch('action', { type: 'toggle-sidebar' }) },
      ]
    },
    {
      id: 'window',
      label: 'Window',
      items: [
        { id: 'home', label: 'Home', action: () => dispatch('action', { type: 'navigate', path: '/' }) },
        { id: 'silos', label: 'Silos', action: () => dispatch('action', { type: 'navigate', path: '/silos' }) },
        { id: 'notes', label: 'Notes', action: () => dispatch('action', { type: 'navigate', path: '/notes' }) },
        { type: 'separator' },
        { id: 'pricing', label: 'Pricing', action: () => dispatch('action', { type: 'navigate', path: '/pricing' }) },
        { id: 'settings', label: 'Settings', action: () => dispatch('action', { type: 'navigate', path: '/settings' }) },
      ]
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        { id: 'documentation', label: 'Documentation', action: () => dispatch('action', { type: 'help-docs' }) },
        { id: 'shortcuts', label: 'Keyboard Shortcuts', action: () => dispatch('action', { type: 'help-shortcuts' }) },
        { type: 'separator' },
        { id: 'about', label: 'About', action: () => dispatch('action', { type: 'about' }) },
      ]
    }
  ];
  
  // Handle menu item click
  function handleMenuItemClick(item: any) {
    activeDropdown = null;
    if (item.action) item.action();
  }
  
  // Toggle dropdown menu
  function toggleDropdown(menuId: string) {
    activeDropdown = activeDropdown === menuId ? null : menuId;
  }
  
  // Close all dropdowns
  function closeDropdowns() {
    activeDropdown = null;
  }
  
  // Handle keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeDropdowns();
    }
  }
  
  // Click outside implementation
  function clickOutside(node: HTMLElement) {
    const handleClick = (event: MouseEvent) => {
      if (node && !node.contains(event.target as Node) && !event.defaultPrevented) {
        node.dispatchEvent(new CustomEvent('click_outside'));
      }
    };
    
    document.addEventListener('click', handleClick, true);
    
    return {
      destroy() {
        document.removeEventListener('click', handleClick, true);
      }
    };
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="toolbar" use:clickOutside on:click_outside={closeDropdowns}>
  <div class="toolbar-content">

    <div class="toolbar-icons">
<button
  on:click={() => sidebarCollapsed.update(c => !c)}
  class="sidebar-toggle px-2 py-1 h-10 flex items-center justify-center"
  title="Toggle sidebar"
>
  <svg
    class="w-5 h-5 "
    viewBox="0 0 56 56"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M7.715 49.574h40.57c4.899 0 7.36-2.437 7.36-7.265V13.69c0-4.828-2.461-7.265-7.36-7.265H7.715C2.84 6.426.355 8.84.355 13.69v28.62c0 4.851 2.485 7.265 7.36 7.265m.07-3.773c-2.344 0-3.656-1.242-3.656-3.68V13.88c0-2.438 1.312-3.68 3.656-3.68h10.43v35.602ZM48.215 10.2c2.32 0 3.656 1.242 3.656 3.68v28.24c0 2.438-1.336 3.68-3.656 3.68h-26.32V10.199Zm-34.5 8.696c.703 0 1.336-.633 1.336-1.313c0-.703-.633-1.312-1.336-1.312h-5.04c-.702 0-1.312.609-1.312 1.312c0 .68.61 1.313 1.313 1.313Zm0 6.07c.703 0 1.336-.633 1.336-1.336s-.633-1.29-1.336-1.29h-5.04c-.702 0-1.312.587-1.312 1.29s.61 1.336 1.313 1.336Zm0 6.047c.703 0 1.336-.586 1.336-1.29c0-.702-.633-1.312-1.336-1.312h-5.04c-.702 0-1.312.61-1.312 1.313s.61 1.289 1.313 1.289Z" />
  </svg>
</button>
</div>
    {#each menus as menu}
      <div class="menu-item">
        <button 
          class="menu-button" 
          class:active={activeDropdown === menu.id}
          on:click|stopPropagation={() => toggleDropdown(menu.id)}
        >
          {menu.label}
        </button>
        
        {#if activeDropdown === menu.id}
          <div class="dropdown" transition:fade={{ duration: 100 }}>
            {#each menu.items as item}
              {#if item.type === 'separator'}
                <div class="separator"></div>
              {:else}
                <button 
                  class="dropdown-item" 
                  on:click|stopPropagation={() => handleMenuItemClick(item)}
                >
                  {item.label}
                </button>
              {/if}
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<style>


  .toolbar-icons {
    margin-left: auto;
    display: flex;
    gap: 8px;
    padding-right: 12px;
  }
  
  .sidebar-toggle {
    padding: 2px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--text-primary);
  }
  
  .sidebar-toggle:hover {
    opacity: 0.8;
  }
  .toolbar {
    height: 28px;
    width: 100%;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border-color);
    display: flex;
    align-items: center;
    padding: 0 8px;
    user-select: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 1001; /* Ensure toolbar is above sidebar */
    font-size: 13px;
  }
  
  .toolbar-content {
    display: flex;
    align-items: center;
    height: 100%;
  }
  
  .menu-item {
    position: relative;
    height: 100%;
    display: flex;
    align-items: center;
  }
  
  .menu-button {
    padding: 0 10px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: default;
    font-weight: 400;
  }
  
  .menu-button:hover {
    background-color: var(--bg-primary); /* Mac-style blue hover color */
    color: var(--light-primary);
  }
  
  .menu-button.active {
    background-color: var(--brand-primary);
    color: var(--light-primary);
  }
  
  .dropdown {
    position: absolute;
    top: 28px;
    left: 0;
    min-width: 200px;
    background: var(--bg-secondary);
    border-radius: 6px;
    box-shadow: var(--shadow-md);
    z-index: 1001;
    padding: 4px;
    display: flex;
    flex-direction: column;
    margin-top: 2px;
    border: 1px solid var(--border-color);
  }
  
  .dropdown-item {
    padding: 6px 12px;
    text-align: left;
    background: transparent;
    border: none;
    color: var(--text-primary);
    cursor: default;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
  }
  
  .dropdown-item:hover {
    background-color: var(--bg-primary); /* Mac-style blue hover color */
    color: var(--light-primary);
  }
  
  .separator {
    height: 1px;
    background-color: var(--border-color);
    margin: 4px 0;
  }
</style>