<script lang="ts">
  import { NODE_TYPES, type NodeType } from '$lib/types/nodes';
  import { createEventDispatcher } from 'svelte';
  
  export let show = false;
  const dispatch = createEventDispatcher<{ add: NodeType }>();
</script>

{#if show}
  <div class="node-library">
      {#each Object.entries(NODE_TYPES) as [type, style]}
          <button
              class="node-option group"
              on:click={() => dispatch('add', type as NodeType)}
          >
              <span class="icon-wrapper" aria-hidden="true">
                  {@html style.icon}
              </span>
              <span class="label">{style.name}</span>
          </button>
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
      width: 240px;
      z-index: 1000;
      backdrop-filter: blur(12px);
      transition: all 0.2s ease-out;
      

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