<script lang="ts">
  import { NODE_TYPES, type NodeType } from '$lib/types/nodes';
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  const dispatch = createEventDispatcher<{ add: NodeType }>();

  // Group nodes by their categories
  const nodesByCategory = Object.entries(NODE_TYPES).reduce((acc, [type, config]) => {
    if (!acc[config.category]) {
      acc[config.category] = [];
    }
    acc[config.category].push({ type, config });
    return acc;
  }, {} as Record<string, {type: string, config: any}[]>);

  // Categories in the order we want to display them
  const orderedCategories = [
    'Core Nodes', 
    'Function Nodes',
    'Financial Nodes',
    'Commission Nodes',
    'Trigger Nodes',
    'Credential Nodes',
    'Advanced Nodes'
  ];

  // Track expanded sections
  let expandedSections = orderedCategories.reduce((acc, category) => {
    acc[category] = true; // Start with all expanded
    return acc;
  }, {} as Record<string, boolean>);

  function toggleSection(category: string) {
    expandedSections[category] = !expandedSections[category];
    expandedSections = {...expandedSections}; // Force reactivity
  }
</script>

{#if show}
  <div class="node-library">
    <h2 class="library-title">Node Library</h2>
    
    {#each orderedCategories as category}
      {#if nodesByCategory[category] && nodesByCategory[category].length > 0}
        <div class="category-section">
          <button 
            class="category-header" 
            on:click={() => toggleSection(category)}
            aria-expanded={expandedSections[category]}
          >
            <span class="category-name">{category}</span>
            <span class="toggle-icon">
              {#if expandedSections[category]}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
              {/if}
            </span>
          </button>
          
          {#if expandedSections[category]}
            <div class="category-nodes">
              {#each nodesByCategory[category] as {type, config}}
                <button
                  class="node-option group"
                  on:click={() => dispatch('add', type as NodeType)}
                  title={config.description || config.name}
                >
                  <span class="icon-wrapper" aria-hidden="true">
                    {@html config.icon}
                  </span>
                  <span class="label">{config.name}</span>
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <div class="divider"></div>
      {/if}
    {/each}
  </div>
{/if}
  
  <style>
    .node-library {
      position: fixed;
      top: 100px;
      right: 20px;
      background-color: var(--bg-secondary);
      border: 1px solid rgb(209 213 219 / 0.3);
      border-radius: 0.75rem;
      box-shadow: 0 10px 30px -10px rgba(0,0,0,0.2);
      padding: 0.75rem;
      width: 280px;
      z-index: 1000;
      backdrop-filter: blur(12px);
      transition: all 0.2s ease-out;
      max-height: 80vh;
      overflow-y: auto;
    }
  
    .library-title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgb(209 213 219 / 0.3);
      color: var(--text-primary);
    }
  
    .category-section {
      margin-bottom: 0.5rem;
    }
  
    .category-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 0.5rem 0.25rem;
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-primary);
      font-weight: 600;
      font-size: 0.875rem;
      text-align: left;
      border-radius: 0.25rem;
    }
  
    .category-header:hover {
      background-color: rgba(209, 213, 219, 0.1);
    }
  
    .category-name {
      font-size: 0.875rem;
      font-weight: 600;
    }
  
    .divider {
      height: 1px;
      background-color: rgb(209 213 219 / 0.2);
      margin: 0.5rem 0;
    }
  
    .category-nodes {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.25rem 0;
    }
  
    .node-option {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      width: 100%;
      border: none;
      background: none;
      cursor: pointer;
      border-radius: 0.5rem;
      color: var(--text-primary);
      transition: all 0.15s ease-out;
  
      &:hover {
        background-color: var(--brand-green-light);
      }
  
      &:focus-visible {
        outline: 2px solid rgb(59 130 246);
        outline-offset: 2px;
      }
    }
  
    .icon-wrapper {
      display: flex;
      width: 1.5rem;
      height: 1.5rem;
      flex-shrink: 0;
      
      svg {
        width: 100%;
        height: 100%;
        stroke-width: 1.5;
        stroke: currentColor;
        fill: none;
      }
    }
  
    .label {
      font-size: 0.875rem;
      line-height: 1.25rem;
      font-weight: 500;
      text-align: left;
      white-space: nowrap;
    }
  </style>