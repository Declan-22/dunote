<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import { siloStore } from '$lib/stores/siloStore';
  import { goto } from '$app/navigation';
  const dispatch = createEventDispatcher();
  export let siloId: string;
  
  let isRunning = false;
  let hovered = false;
  
  function startFlow() {
    if (isRunning) return;
    
    isRunning = true;
    dispatch('triggerFlow', { siloId });
    
    // Reset after animation completes
    setTimeout(() => {
      isRunning = false;
    }, 2000);
  }
</script>

<div 
  class="trigger-node {isRunning ? 'running' : ''}"
  on:click={startFlow}
  on:mouseenter={() => hovered = true}
  on:mouseleave={() => hovered = false}
  transition:fade
>
  <div class="trigger-button">
    {#if isRunning}
      <div class="spinner"></div>
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="5 3 19 12 5 21 5 3"></polygon>
      </svg>
    {/if}
  </div>
  
  {#if hovered}
    <div class="tooltip" transition:fade={{ duration: 150 }}>Run Workflow</div>
  {/if}
</div>

<style>
  .trigger-node {
    position: fixed;
    bottom: 2rem;
    right: 50%;
    transform: translateX(50%);
    z-index: 100;
    cursor: pointer;
  }
  
  .trigger-button {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: var(--brand-green);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1), 0 1px 3px rgba(0, 0, 0, 0.06);
    transition: transform 0.2s ease, background-color 0.2s ease;
  }
  
  .trigger-button:hover {
    background: var(--brand-green-dark);
    transform: scale(1.1);
  }
  
  .running .trigger-button {
    background: var(--text-secondary);
  }

  
  .tooltip {
    position: absolute;
    background: var(--bg-secondary);
    border: 1px solid var(--border-color);
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    font-size: 0.8rem;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 0.5rem;
    white-space: nowrap;
    color: var(--text-primary);
  }
  
  .spinner {
    width: 24px;
    height: 24px;
    border: 2px solid transparent;
    border-top-color: white;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>