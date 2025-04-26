<script>
    import { onMount } from 'svelte';
    
    onMount(() => {
        window.opener.postMessage({ 
            type: 'oauth-callback',
            url: window.location.href
        }, window.location.origin);
        window.close();
    });
</script>

<div class="p-4">Completing authorization...</div>