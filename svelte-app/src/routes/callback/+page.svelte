<!-- callback/+page.svelte -->
<script>
    import { onMount } from 'svelte';
    
    onMount(() => {
        // Handle OAuth callback if needed
        window.close();
    });
</script>

<div class="p-4">Authorization complete, you can close this window</div>