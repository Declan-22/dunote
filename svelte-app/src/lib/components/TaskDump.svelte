<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  
  export let value = '';
  let isProcessing = false;
  const dispatch = createEventDispatcher();

  async function processTasks() {
      isProcessing = true;
      try {
        // Dispatch the raw tasks for processing
        dispatch('process', { tasks: value });
      } finally {
        isProcessing = false;
      }
    }
</script>

<div class="task-dump-container resizable">
    <div class="header">
            <h2 class="text-3xl font-bold mb-2 text-brand-green">Task Dump</h2>
            <p class="instruction">Dump all the stuff you have to do, here.</p>
    </div>

    <textarea
            bind:value
            class="task-input"
            placeholder="Example:
-Go to a meeting at 3:30 PM
-Take notes on quantum mechanics
-Study for geometry unit"
            rows="6"
    ></textarea>

    <button
            on:click={processTasks}
            class="process-btn"
            disabled={isProcessing}
    >
            {#if isProcessing}
                    <span class="processing">
                            <svg class="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                            </svg>
                            Analyzing Tasks...
                    </span>
            {:else}
                    <span class="flex items-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
                            </svg>
                            Generate Smart Plan
                    </span>
            {/if}
    </button>
</div>

<style lang="postcss">


  .task-dump-container {
      max-width: 768px; /* Equivalent to max-w-screen-md */
      margin: 0 auto; /* Equivalent to mx-auto */
      padding: 1.5rem; /* Equivalent to p-6 */
      border-radius: 0.75rem; /* Equivalent to rounded-xl */
      transition: background-color 0.3s, color 0.3s; /* Equivalent to transition-colors duration-300 */
      background-color: var(--bg-secondary);
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-lg);
  }

  .header {
      margin-bottom: 1.5rem; /* Equivalent to mb-6 */
      text-align: center; /* Equivalent to text-center */
  }

  .instruction {
      font-size: 0.875rem; /* Equivalent to text-sm */
      color: var(--neutral-500); /* Equivalent to text-neutral-500 */
  }

  .task-input {
      width: 100%; /* Equivalent to w-full */
      padding: 1rem; /* Equivalent to p-4 */
      border-radius: 0.5rem; /* Equivalent to rounded-lg */
      border: 1px solid var(--border-color);
      resize: none; /* Equivalent to resize-none */
      transition: all 0.2s; /* Equivalent to transition-all duration-200 */
      background-color: var(--bg-primary);
      color: var(--text-primary);
      caret-color: var(--brand-green);
      min-height: 160px;

      &::placeholder {
          color: var(--neutral-500);
      }

      &:focus {
          outline: none; /* Equivalent to outline-none */
          border-color: var(--brand-green);
          box-shadow: 0 0 0 3px var(--brand-green-light);
      }
  }

  .process-btn {
      margin-top: 1rem; /* Equivalent to mt-4 */
      width: 100%; /* Equivalent to w-full */
      padding: 0.75rem 1.5rem; /* Equivalent to py-3 px-6 */
      border-radius: 0.5rem; /* Equivalent to rounded-lg */
      font-weight: 600; /* Equivalent to font-semibold */
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s; /* Equivalent to transition-all duration-200 */
      background-color: var(--brand-green);
      color: var(--light-text);

      &:hover:not(:disabled) {
          background-color: var(--brand-green-dark);
          transform: translateY(-1px);
          box-shadow: var(--shadow-md);
      }

      &:disabled {
          opacity: 0.75; /* Equivalent to opacity-75 */
          cursor: not-allowed; /* Equivalent to cursor-not-allowed */
      }
  }

  .processing {
      display: inline-flex; /* Equivalent to inline-flex */
      align-items: center; /* Equivalent to items-center */
      font-size: 0.875rem; /* Equivalent to text-sm */
  }

.task-input {
    border-color: var(--neutral-500); /* Equivalent to border-neutral-700 */

  }
</style>