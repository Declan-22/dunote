<script lang="ts">
  import '../app.css';
  let { children } = $props();
  import Sidebar from '$lib/components/Sidebar.svelte';
  import Toolbar from '$lib/components/Toolbar.svelte';
  import { theme } from '$lib/stores/themeStore';
  import { sidebarCollapsed } from '$lib/stores/uiStore';
  import { siloStore } from '$lib/stores/siloStore';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import { supabase } from '$lib/supabaseClient';
  import { user } from '$lib/stores/userStore';
  import { tweened } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { invalidateAll } from '$app/navigation';
  import { page } from '$app/stores';
  

  // Animation for main content margin
  const mainMargin = tweened(80, { duration: 300, easing: cubicOut });

  // Update margin when sidebar collapsed state changes
  $effect(() => {
mainMargin.set($sidebarCollapsed ? 0 : 180);
  });

  if (browser) {
    onMount(() => {
      // Existing theme logic
      const savedTheme = localStorage.getItem('theme') || 'dark';
      theme.set(savedTheme);
      const themeUnsubscribe = theme.subscribe(t => {
        document.documentElement.setAttribute('data-theme', t);
        localStorage.setItem('theme', t);
      });

      // New 404 handling logic
      const handle404 = () => {
        if (document.body.textContent?.includes('404')) {
          invalidateAll();
        }
      };
      
      // Check immediately on mount
      handle404();
      
      // Set up observer for future changes
      const observer = new MutationObserver(handle404);
      observer.observe(document.body, { childList: true, subtree: true });

      // Cleanup both subscriptions
      return () => {
        themeUnsubscribe();
        observer.disconnect();
      };
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

  // Handle toolbar actions
  function handleToolbarAction(event) {
    const action = event.detail;
    
    if (action.type === 'toggle-theme') {
      toggleTheme();
    } else if (action.type === 'toggle-sidebar') {
      sidebarCollapsed.update(value => !value);
    } else if (action.type === 'navigate' && action.path) {
      // Handle navigation here if needed
    }
    
    // Other actions can be handled as needed
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

<div class="flex flex-col min-h-screen">
  <Toolbar on:action={handleToolbarAction} />
  <div class="h-7"></div>
  
  <div class="flex flex-1">
    <Sidebar />

<main 
  class="flex-1 bg-[var(--bg-primary)] transition-[margin-left] duration-300 ease-out pt-2"
  style="margin-left: {$mainMargin}px;"
>
      {@render children()}
    </main>
  </div>
</div>