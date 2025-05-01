<script>
    import Profile from '$lib/components/Profile.svelte';
    import { onMount } from 'svelte';
	import { user } from '$lib/stores/userStore';
    import { goto } from '$app/navigation';
    
    onMount(() => {
      // Redirect to login if not authenticated
      if (!$user) {
        goto('/login');
      }
    });
  </script>
  
  <svelte:head>
    <title>Profile | Productivity App</title>
  </svelte:head>
  
  <section class="min-h-screen">
    {#if $user}
      <Profile />
    {:else}
      <div class="flex justify-center items-center h-screen">
        <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--brand-green)]"></div>
      </div>
    {/if}
  </section>