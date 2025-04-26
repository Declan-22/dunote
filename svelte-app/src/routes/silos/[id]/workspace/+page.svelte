<script lang="ts">
    import { page } from '$app/stores';
    import WorkspaceView from '$lib/components/WorkspaceView.svelte';
  </script>
  
  <WorkspaceView siloId={$page.params.id} />