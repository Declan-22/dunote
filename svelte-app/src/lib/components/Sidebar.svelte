<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { sidebarCollapsed } from '$lib/stores/uiStore';
  import { user } from '$lib/stores/userStore';
  import { supabase } from '$lib/supabaseClient';
  import type { User } from '@supabase/supabase-js';
  import { noteStore } from '$lib/stores/noteStore';
  let showNotesPreview = false;
  
  let email = '';
  let password = '';
  let error = '';
  let loading = false;
  let showProfileCard = false;
  let profileCardPosition = { x: 0, y: 0 };
  let userProfile: { display_name?: string } | null = null;

// Update the getDisplayName function

  
  // Click outside handler
  type ClickableElement = Element & { closest: (selector: string) => Element | null };

  // Update the handler with proper typing
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as ClickableElement | null;
    if (!target?.closest('.profile-card') && !target?.closest('.profile-trigger')) {
      showProfileCard = false;
    }
  }
  
  // Removed duplicate declaration of getDisplayName

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

  const navItems = [
    { name: 'Home', href: '/', icon: 'home' },
    { name: 'Silos', href: '/silos', icon: 'nodes' },
    { name: 'Notes', href: '/notes', icon: 'document' }
  ];


  
  // Ensure all items have a 'name' property
  if (!navItems.every(item => item.name)) {
    throw new Error("Each navItem must have a 'name' property.");
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
</script>
<svelte:window on:click={handleClickOutside} />
<aside class="fixed inset-y-0 z-200 bg-[var(--bg-secondary)] border-r border-[var(--border-color)] transition-all duration-300 h-screen"
        class:w-64={!$sidebarCollapsed}
        class:w-20={$sidebarCollapsed}
        style="top: 0;"
>


  <div class="flex flex-col h-full">
    <!-- Collapse Toggle -->
    <button
      on:click={() => sidebarCollapsed.update((c: boolean) => !c)}
      class="p-4 hover:bg-[var(--bg-primary)] transition-colors"
    >
      {#if $sidebarCollapsed}
        <svg class="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
        </svg>
      {:else}
        <svg class="w-6 h-6 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
        </svg>
      {/if}
    </button>

    <!-- Navigation -->
    <nav class="flex-1 p-2 space-y-1">
      {#each navItems as item}
        <div class="relative group">
          <button
            on:click={() => goto(item.href)}
            class={`w-full flex items-center p-3 rounded-lg transition-colors
              ${$page.url.pathname === item.href 
                ? 'bg-[var(--brand-green)] text-white' 
                : 'hover:bg-[var(--bg-primary)] text-[var(--text-secondary)]'}`}
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {#if item.icon === 'home'}
                <!-- Home Icon -->
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
              {:else if item.icon === 'document'}
                <!-- Notes/Document Icon -->
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
              {:else}
                <!-- New Silos Icon from Iconify -->
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 4c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2H5c-1.655 0-2-.345-2-2m10 9c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2h-4c-1.655 0-2-.345-2-2m-9 7c0-1.655.345-2 2-2h4c1.655 0 2 .345 2 2s-.345 2-2 2H6c-1.655 0-2-.345-2-2m13-9c0-.465 0-.697-.038-.89a2 2 0 0 0-1.572-1.572c-.193-.038-.425-.038-.89-.038h-5c-.465 0-.697 0-.89-.038A2 2 0 0 1 7.038 6.89C7 6.697 7 6.465 7 6m10 9v1c0 1.886 0 2.828-.586 3.414S14.886 20 13 20h-1"/>
              {/if}
            </svg>
            {#if !$sidebarCollapsed}
              <span class="ml-3">{item.name}</span>
            {/if}
          </button>
          
          {#if $sidebarCollapsed}
            <div class="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-[var(--bg-primary)] text-[var(--text-primary)] rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {item.name}
            </div>
          {/if}
        </div>
      {/each}
    </nav>

    <!-- Auth Section -->
    <div class="mt-auto p-2 border-t border-[var(--border-color)]">
      {#if $user}
      <div class="relative profile-trigger">
        <button 
        on:click|stopPropagation={(e) => {
          showProfileCard = !showProfileCard;
          const rect = e.currentTarget.getBoundingClientRect();
          profileCardPosition = { x: rect.left, y: rect.top };
        }}
        class="profile-trigger flex items-center gap-3 p-2 w-full hover:bg-[var(--bg-primary)] rounded transition-colors"
      >
      <div class="w-8 h-8 rounded-full bg-[var(--brand-green)] flex items-center justify-center text-white">
        {getDisplayName().charAt(0).toUpperCase()}
      </div>
          {#if !$sidebarCollapsed}
            <div class="flex-1 min-w-0 text-left">
              <p class="text-sm font-medium truncate">{getDisplayName()}</p>
              <p class="text-xs text-[var(--text-secondary)] truncate">{$user.email}</p>
            </div>
          {/if}
        </button>
    
        {#if showProfileCard && $sidebarCollapsed}
        <div 
        class="absolute profile-card z-50 min-w-[240px] bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg shadow-lg p-4"
        style={`left: ${profileCardPosition.x + 90}px; top: ${profileCardPosition.y + -80}px`}
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
          <form on:submit|preventDefault={handleLogin} class="space-y-2">
            {#if error}
              <div class="text-sm text-red-500">{error}</div>
            {/if}
            <input
              type="email"
              bind:value={email}
              placeholder="Email"
              class="w-full p-2 text-sm bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--border-color)] rounded"
            />
            <input
              type="password"
              bind:value={password}
              placeholder="Password"
              class="w-full p-2 text-sm bg-[var(--bg-primary)] text-[var(--text-primary)] border-[var(--border-color)] rounded"
            />
            <button
              type="submit"
              class="w-full py-2 px-4 bg-[var(--brand-green)] text-white rounded hover:bg-opacity-90"
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>
            <div class="text-center text-sm">
              <a href="/signup" class="text-[var(--brand-green)] underline">Create account</a>
            </div>
          </form>
        {:else}
          <button 
            on:click={() => goto('/login')}
            class="w-full p-2 hover:bg-[var(--bg-primary)] rounded text-[var(--text-primary)]"
          >
            Login
          </button>
        {/if}
      {/if}
    </div>
  </div>
</aside>