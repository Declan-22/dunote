<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { fly, fade } from 'svelte/transition';
  import { onMount } from 'svelte';
  
  let displayName = '';
  let email = '';
  let password = '';
  let error = '';
  let loading = false;
  let success = false;
  let mounted = false;
  let passwordStrength = 0;

  onMount(() => {
    mounted = true;
  });

  function checkPasswordStrength(pass: string) {
    if (!pass) return 0;
    
    let strength = 0;
    // Length check
    if (pass.length >= 8) strength += 1;
    // Contains lowercase
    if (/[a-z]/.test(pass)) strength += 1;
    // Contains uppercase
    if (/[A-Z]/.test(pass)) strength += 1;
    // Contains number
    if (/[0-9]/.test(pass)) strength += 1;
    // Contains special character
    if (/[^A-Za-z0-9]/.test(pass)) strength += 1;
    
    passwordStrength = Math.min(strength, 4);
    return passwordStrength;
  }

  async function handleSignup() {
    loading = true;
    error = '';
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName
          }
        }
      });

      if (authError) throw authError;
      success = true;
    } catch (e) {
      error = e instanceof Error ? e.message : 'An unknown error occurred';
    } finally {
      loading = false;
    }
  }
</script>

<div class="max-w-md mx-auto mt-20 p-8 bg-[var(--bg-secondary)] rounded-lg shadow-lg border border-[var(--border-color)] transition-all duration-300 fade-in">
  <h1 class="text-3xl font-light mb-8 text-center text-[var(--text-primary)]">Sign Up</h1>
  
  {#if error}
    <div 
      class="mb-6 p-4 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-md border border-red-200 dark:border-red-800"
      transition:fly={{ y: -10, duration: 300 }}
    >
      {error}
    </div>
  {/if}
  
  {#if success}
    <div 
      class="p-6 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md border border-green-200 dark:border-green-800 text-center"
      transition:fade={{ duration: 400 }}
    >
      <svg class="w-12 h-12 mx-auto mb-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <h3 class="text-lg font-medium mb-2">Account Created!</h3>
      <p>Check your email to confirm your account.</p>
      <a 
        href="/login" 
        class="mt-4 inline-block text-[var(--brand-green-light)] hover:text-[var(--brand-green)] transition-colors duration-300"
      >
        Return to login
      </a>
    </div>
  {:else}
    <form on:submit|preventDefault={handleSignup} class="space-y-5">
      <div class="space-y-2">
        <label for="displayName" class="block text-sm font-medium text-[var(--text-secondary)]">Display Name</label>
        <input
          id="displayName"
          type="text"
          bind:value={displayName}
          class="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-green-light)] transition-all duration-300"
          required
        />
      </div>
      
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
        <label for="password" class="block text-sm font-medium text-[var(--text-secondary)]">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          on:input={() => checkPasswordStrength(password)}
          class="w-full p-3 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-md text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-green-light)] transition-all duration-300"
          required
        />
        
        {#if password.length > 0}
          <div class="mt-2">
            <div class="flex h-1 overflow-hidden rounded bg-gray-200 dark:bg-gray-700">
              <div 
                class={`transition-all duration-300 ${passwordStrength === 0 ? 'bg-red-500' : 
                  passwordStrength === 1 ? 'bg-orange-500' : 
                  passwordStrength === 2 ? 'bg-yellow-500' : 
                  passwordStrength === 3 ? 'bg-blue-500' : 'bg-green-500'}`}
                style={`width: ${passwordStrength * 25}%`}
              ></div>
            </div>
            <p class="text-xs mt-1 text-[var(--text-secondary)]">
              {passwordStrength === 0 ? 'Very weak' : 
               passwordStrength === 1 ? 'Weak' : 
               passwordStrength === 2 ? 'Fair' : 
               passwordStrength === 3 ? 'Good' : 'Strong'} password
            </p>
          </div>
        {/if}
      </div>
      
      <button
        type="submit"
        class="w-full py-3 px-4 bg-[var(--brand-green)] text-white rounded-md hover:bg-[var(--brand-green-dark)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-green-light)] focus:ring-offset-2 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
        disabled={loading || passwordStrength < 2}
      >
        {#if loading}
          <span class="inline-flex items-center">
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Creating account...
          </span>
        {:else}
          Sign Up
        {/if}
      </button>
    </form>
    
    <div class="mt-8 text-center">
      <span class="text-sm text-[var(--text-secondary)]">Already have an account? </span>
      <a 
        href="/login" 
        class="text-[var(--brand-green-light)] font-medium hover:text-[var(--brand-green)] transition-colors duration-300 hover:underline"
      >
        Login
      </a>
    </div>
  {/if}
</div>