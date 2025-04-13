<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    
    const dispatch = createEventDispatcher();
    
    function triggerFlow() {
      dispatch('triggerFlow');
    }
  </script>
  
  <div class="trigger-node">
    <button on:click={triggerFlow}>Start Flow</button>
  </div>
  
  <style>
    .trigger-node {
      position: absolute;
      padding: 12px;
      background: var(--bg-elevated);
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .trigger-node button {
      background: var(--accent);
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
    }
  </style>