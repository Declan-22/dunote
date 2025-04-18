<script lang="ts">
  import '../app.css';
  let { children } = $props();
  import Sidebar from '$lib/components/Sidebar.svelte';
  import { theme } from '$lib/stores/themeStore';
  import { sidebarCollapsed } from '$lib/stores/uiStore';
  import { siloStore } from '$lib/stores/siloStore';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/userStore';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';

  // Animation for main content margin
  const mainMargin = tweened(80, { duration: 300, easing: cubicOut });

  // Update margin when sidebar collapsed state changes
  $effect(() => {
  mainMargin.set($sidebarCollapsed ? 80 : 256);
});

  if (browser) {
    onMount(() => {
      const savedTheme = localStorage.getItem('theme') || 'dark';
      theme.set(savedTheme);

      return theme.subscribe(t => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
      });
    });
  }

  $effect(() => {
    if ($user) {
      supabase
        .from('silos')
        .select('*')
        .eq('user_id', $user.id)
        .then(({ data }) => {
          if (data?.length === 0) {
            supabase
              .from('silos')
              .insert({
                name: 'Default Silo',
                user_id: $user.id
              })
              .select()
              .single()
              .then(({ data }) => {
                if (data) siloStore.update((store: any[]) => [...store, data]);
              });
          }
        });
    }
  });

  function toggleTheme() {
    theme.update(t => t === 'dark' ? 'light' : 'dark');
  }

  onMount(() => {
    supabase.auth.getSession().then(({ data }) => {
      user.set(data.session?.user || null);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      user.set(session?.user || null);
    });
  });
</script>

<div class="flex min-h-screen">
  <Sidebar />

  <main 
    class="flex-1 bg-[var(--bg-primary)] transition-all duration-300 ease-out"
    style="margin-left: {$mainMargin}px;"
  >
    <!-- Theme Toggle with improved styling -->
    <button 
      class="theme-toggle fixed top-4 right-4 z-50 p-2 rounded-full bg-[var(--bg-secondary)] shadow-md hover:scale-105 transition-transform duration-200"
      on:click={toggleTheme}
      aria-label="Toggle theme"
    >
      {#if $theme === 'dark'}
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-[var(--text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      {:else}
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-[var(--text-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      {/if}
    </button>

    {@render children()}
  </main>
</div>