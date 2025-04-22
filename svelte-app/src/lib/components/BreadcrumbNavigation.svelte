<script lang="ts">
    export let items: { label: string; href: string }[] = [];
  </script>
  
  <nav class="breadcrumbs" aria-label="breadcrumb">
    <ol class="flex items-center text-sm">
      {#each items as item, i}
        <li class="flex items-center">
          {#if i > 0}
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              width="16" 
              height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              stroke-width="2" 
              stroke-linecap="round" 
              stroke-linejoin="round" 
              class="mx-1 text-[var(--text-secondary)]"
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          {/if}
          
          {#if i === items.length - 1}
            <span class="text-[var(--text-primary)] font-medium">{item.label}</span>
          {:else}
            <a 
              href={item.href} 
              class="text-[var(--text-secondary)] hover:text-[var(--brand-green)] transition-colors"
            >
              {item.label}
            </a>
          {/if}
        </li>
      {/each}
    </ol>
  </nav>
  
  <style>
    .breadcrumbs {
      overflow-x: auto;
      white-space: nowrap;
      scrollbar-width: none; /* Firefox */
      -ms-overflow-style: none; /* IE/Edge */
    }
    
    .breadcrumbs::-webkit-scrollbar {
      display: none; /* Chrome, Safari, Opera */
    }
  </style>