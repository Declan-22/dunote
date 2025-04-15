<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { fly, fade } from 'svelte/transition';
  
  let email = '';
  let password = '';
  let error = '';
  let loading = false;
  let mounted = false;

  onMount(() => {
    mounted = true;
  });

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
</script>

<div class="max-w-md mx-auto mt-20 p-8 bg-[var(--bg-secondary)] rounded-lg shadow-lg border border-[var(--border-color)] transition-all duration-300 fade-in">
  <h1 class="text-3xl font-light mb-8 text-center text-[var(--text-primary)]">Login</h1>
  
  {#if error}
    <div 
      class="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md border border-red-200 dark:border-red-800"
      transition:fly={{ y: -10, duration: 300 }}
    >
      {error}
    </div>
  {/if}
  
  <form on:submit|preventDefault={handleLogin} class="space-y-5">
    <div class="space-y-2">
      <label for="email" class="block text-sm font-medium text-[var(--text-secondary)]">Email</label>
      <input
        id="email"
        type="email"
        bind:value={email}
        class="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-green-light)] transition-all duration-300"
        required
      />
    </div>
    
    <div class="space-y-2">
      <div class="flex justify-between items-center">
        <label for="password" class="block text-sm font-medium text-[var(--text-secondary)]">Password</label>
        <a href="/reset-password" class="text-xs text-[var(--brand-green-light)] hover:text-[var(--brand-green)] transition-colors duration-300">
          Forgot password?
        </a>
      </div>
      <input
        id="password"
        type="password"
        bind:value={password}
        class="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-green-light)] transition-all duration-300"
        required
      />
    </div>
    
    <button
      type="submit"
      class="w-full py-3 px-4 bg-[var(--brand-green)] text-white rounded-md hover:bg-[var(--brand-green-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-green-light)] focus:ring-offset-2 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
      disabled={loading}
    >
      {#if loading}
        <span class="inline-flex items-center">
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Logging in...
        </span>
      {:else}
        Login
      {/if}
    </button>
  </form>
  
  <div class="mt-8 text-center">
    <span class="text-sm text-[var(--text-secondary)]">Need an account? </span>
    <a 
      href="/signup" 
      class="text-[var(--brand-green-light)] font-medium hover:text-[var(--brand-green)] transition-colors duration-300 hover:underline"
    >
      Sign up
    </a>
  </div>
</div>