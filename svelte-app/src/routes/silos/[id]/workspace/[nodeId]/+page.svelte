<script lang="ts">
    import { page } from '$app/stores';
    import WorkspaceDetail from '$lib/components/WorkspaceDetail.svelte';
  </script>
  
  <WorkspaceDetail 
    siloId={$page.params.id} 
    nodeId={$page.params.nodeId} 
  />