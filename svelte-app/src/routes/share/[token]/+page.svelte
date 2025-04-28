<script lang="ts">
    import { onMount } from 'svelte';
    import { supabase } from '$lib/supabaseClient';
    import { marked } from 'marked';
    import type {  Silo } from '$lib/stores/siloStore';

    
    export let token: string;
    
    let isLoading = true;
    let error: string | null = null;
    let silo: Silo | null = null;
    let clientNode: Node | null = null;
    let commissionData: {
      contract: Node | null,
      deliverables: Node[]
    } = {
      contract: null,
      deliverables: []
    };
  
    onMount(async () => {
      try {
        // Verify the token
        const { data, error: dbError } = await supabase
          .from('share_tokens')
          .select('silo_id, client_node_id, expires_at')
          .eq('token', token)
          .single();
  
        if (dbError || !data) throw new Error('Invalid or expired link');
        if (new Date(data.expires_at) < new Date()) throw new Error('Link has expired');
  
        // Fetch silo data
        const { data: siloData, error: siloError } = await supabase
          .from('silos')
          .select('*')
          .eq('id', data.silo_id)
          .single();
  
        if (siloError || !siloData) throw new Error('Project not found');
        
        // Filter nodes to only show commission-related and non-sensitive data
        const filteredSilo = {
          ...siloData,
          nodes: siloData.nodes.filter((n: Node) => 
            ['client', 'contract', 'payment', 'deliverable'].includes(n.type)
          )
        };
  
        const foundClientNode = filteredSilo.nodes.find((n: Node) => n.id === data.client_node_id);
        if (!foundClientNode) throw new Error('Client data not found');
        
        silo = filteredSilo;
        clientNode = foundClientNode;
        commissionData = {
          contract: filteredSilo.nodes.find((n: Node) => n.type === 'contract') || null,
          deliverables: filteredSilo.nodes.filter((n: Node) => n.type === 'deliverable')
        };
  
      } catch (err: unknown) {
        error = err instanceof Error ? err.message : 'An unknown error occurred';
      } finally {
        isLoading = false;
      }
    });
  </script>
  
  {#if isLoading}
    <div class="flex justify-center items-center h-screen">
      <div class="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[var(--brand-green)]"></div>
    </div>
  {:else if error}
    <div class="max-w-2xl mx-auto p-6 text-center">
      <h1 class="text-2xl font-bold mb-4">Invalid Link</h1>
      <p class="text-gray-600">{error}</p>
    </div>
  {:else}
    <main class="max-w-4xl mx-auto p-6">
      <header class="mb-8">
        <h1 class="text-3xl font-bold mb-2">{clientNode.data.company} Project</h1>
        <p class="text-gray-600">Shared progress updates</p>
      </header>
  
      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-4">Contract Terms</h2>
        {#if commissionData.contract}
          <div class="prose border rounded-lg p-6">
            {@html marked.parse(commissionData.contract.data.terms)}
          </div>
        {:else}
          <p class="text-gray-500">No contract terms available</p>
        {/if}
      </section>
  
      <section class="mb-8">
        <h2 class="text-xl font-semibold mb-4">Progress Overview</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {#each commissionData.deliverables as deliverable}
            <div class="border rounded-lg p-4">
              <h3 class="font-medium mb-2">{deliverable.data.title}</h3>
              <div class="flex items-center gap-2">
                <div class={`w-3 h-3 rounded-full ${
                  deliverable.data.status === 'approved' ? 'bg-green-500' :
                  deliverable.data.status === 'pending' ? 'bg-yellow-500' :
                  'bg-gray-300'
                }`} />
                <span class="text-sm capitalize">{deliverable.data.status}</span>
              </div>
              {#if deliverable.data.notes}
                <p class="text-sm text-gray-600 mt-2">{deliverable.data.notes}</p>
              {/if}
            </div>
          {/each}
        </div>
      </section>
  
      <div class="text-center text-sm text-gray-500">
        This link will expire on {new Date(silo.share_expiry).toLocaleDateString()}
      </div>
    </main>
  {/if}