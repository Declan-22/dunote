<script lang="ts">
	import { page } from '$app/stores';
	import { onMount, afterUpdate, tick } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { user } from '$lib/stores/userStore';
	import { siloStore, executeNodeFunction } from '$lib/stores/siloStore';
	import { fade, slide } from 'svelte/transition';
	import type { Silo, SiloNode, SiloEdge } from '$lib/stores/siloStore';
    import { noteStore } from '$lib/stores/noteStore';
    
    

	export let siloId: string;
	let isLoading = true;
	let error: Error | null = null;
	let silo: Silo | undefined;
	let isEditing = false;
	let isEditingResource = false;
	let editingResourceNodeId = '';
	let editableResourceContent = '';
	let editableResourceTitle = '';
	let selectedFilter = 'Priority';
    let shareLink: string | null = null;
    let isGeneratingLink = false;
    let selectedResourceOption = null;
    let userNotes = [];
    let notesLoading = false;
    let noteSearchQuery = '';
    

    $: commissionNodes = (silo?.nodes || []).filter(n => ['client', 'contract', 'payment', 'deliverable'].includes(n.type)) || [];
    $: hasCommissionNodes = commissionNodes.length > 0;
    $: clientNode = commissionNodes.find(n => n.type === 'client');
    $: contractNode = commissionNodes.find(n => n.type === 'contract');
    $: shareLink = hasCommissionNodes ? `${window.location.origin}/share/${siloId}/${clientNode?.id}` : '';
    $: filteredNotes = noteSearchQuery 
        ? userNotes.filter(note => 
            note.title?.toLowerCase().includes(noteSearchQuery.toLowerCase()) || 
            stripHtml(note.content)?.toLowerCase().includes(noteSearchQuery.toLowerCase())
          )
        : userNotes;

	$: silo = $siloStore.find(s => s.id === siloId);
	$: taskNodes = (silo?.nodes || []).filter(n => n.type === 'task') || [];
	$: resourceNodes = (silo?.nodes || []).filter(n => n.type === 'resource') || [];
	$: projectNodes = (silo?.nodes || []).filter(n => n.type === 'project') || [];
	$: completedTasks = taskNodes.filter(n => n.data?.isComplete) || [];
	$: totalTasks = taskNodes.length;
	$: progressPercentage = totalTasks > 0 ? Math.round((completedTasks.length / totalTasks) * 100) : 0;

	$: filteredTasks = (() => {
		let tasks = [...taskNodes];
		if (selectedFilter === 'Priority') {
			return tasks.sort((a, b) => {
				const priorityRank: Record<string, number> = { 'urgent': 0, 'high': 1, 'medium': 2, 'low': 3 };
				return priorityRank[getNodePriority(a) || 'medium'] - priorityRank[getNodePriority(b) || 'medium'];
			});
		} else if (selectedFilter === 'Due Date') {
			return tasks.sort((a, b) => {
				const dateA = getNodeDueDate(a) ? new Date(getNodeDueDate(a)) : new Date(9999, 0, 1);
				const dateB = getNodeDueDate(b) ? new Date(getNodeDueDate(b)) : new Date(9999, 0, 1);
				return dateA.getTime() - dateB.getTime();
			});
		} else if (selectedFilter === 'Project') {
			return tasks.sort((a, b) => {
				const projA = getNodeProject(a) || '';
				const projB = getNodeProject(b) || '';
				return projA.localeCompare(projB);
			});
		}
		return tasks;
	})();

	onMount(async () => {
		isLoading = true;
		if ($user) {
			await loadSiloData();
		}
		isLoading = false;
	});

	async function loadSiloData() {
		// This would load your silo data if needed
		// Assuming the siloStore already handles this
		await tick();
	}

    async function generateShareLink(): Promise<string> {
    console.log("Starting link generation...");
    if (!clientNode) {
      throw new Error('Client information not available');
    }

    try {
      // Generate a unique token
      const token = crypto.randomUUID();
      console.log("Generated token:", token)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 1 week expiration
      
      // Insert into database
      const { error } = await supabase
      
        .from('share_tokens')
        .insert([{
          token,
          silo_id: siloId,
          client_node_id: clientNode.id,
          expires_at: expiresAt.toISOString()
        }]);

      if (error) {
        throw error;
      }

      // Update the client node with expiry date if needed
      if (clientNode.data) {
        clientNode.data.share_expiry = expiresAt.toISOString();
      }

      // Return the full shareable URL
      return `${window.location.origin}/share/${token}`;
    } catch (error) {
      console.error('Failed to generate share link:', error);
      throw new Error('Failed to create share link. Please try again.');
    }
  }

  function stripHtml(html) {
        if (!html) return '';
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.body.textContent || '';
    }
    
    function selectResourceOption(option) {
        selectedResourceOption = option;
        
        if (option === 'attach') {
            loadUserNotes();
        }
    }
    
    async function loadUserNotes() {
        notesLoading = true;
        try {
            userNotes = await noteStore.loadNotes();
        } catch (error) {
            console.error('Failed to load notes:', error);
        } finally {
            notesLoading = false;
        }
    }
    
    function selectNote(note) {
        // Set the resource content based on the note
        editableResourceTitle = note.title || 'Note Link';
        editableResourceContent = `Note: ${note.title}\n\nID: ${note.id}\n\n${stripHtml(note.content).substring(0, 100)}...`;
        
        // Here you'd handle the note attachment logic
        // This depends on how you want to implement the relationship between resources and notes
        attachNoteToResource(note.id);
        
        // Return to editor to review before saving
        selectedResourceOption = 'new';
    }
    
    function attachNoteToResource(noteId) {
        // This function would handle the actual relationship
        // You might want to extend your resource model to include noteId
        console.log(`Attaching note ${noteId} to current resource`);
        // Implementation depends on your data model
    }
    
    function createNewNote() {
        // Create a new note and then attach it
        noteStore.createNewNote().then(note => {
            // Navigate to note editor or handle as needed
            console.log('Created new note:', note);
            // You might want to redirect to the note editor here
        });
    }
    
    // Reset the selected option when the modal is closed
    $: if (!isEditingResource) {
        selectedResourceOption = null;
    }

	function getNodeStatus(node: SiloNode) {
		return node.data?.result?.new_status || node.data?.status || 'not-started';
	}

	function getNodePriority(node: SiloNode) {
		return node.data?.priority || 'medium';
	}

	function getNodeDueDate(node: SiloNode) {
		return node.data?.dueDate || '';
	}

	function getNodeProject(node: SiloNode) {
		return node.data?.project || '';
	}

	function safeNodeTitle(node: SiloNode) {
		return node.title || 'Untitled Node';
	}

	function updatePriority(node: SiloNode, priority: string) {
		if (node && node.data) {
			node.data.priority = priority;
			// Update the node in the siloStore
			$siloStore = [...$siloStore];
			updateProjectProgress();
			saveNode(node);
		}
	}

	function toggleNodeCompletion(node: SiloNode) {
		if (node && node.data) {
			node.data.isComplete = !node.data.isComplete;
			// Update the node in the siloStore
			$siloStore = [...$siloStore];
			updateProjectProgress();
			saveNode(node);
		}
	}

	function getPriorityClass(priority: string) {
		if (!priority) return 'bg-gray-100 text-gray-800';
		
		switch(priority.toLowerCase().trim()) {
			case 'high':
				return 'bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-100';
			case 'urgent':
				return 'bg-red-300 text-red-800 dark:bg-red-900 dark:text-red-100';
			case 'medium':
				return 'bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-100';
			case 'low':
				return 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100';
			default:
				return 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100';
		}
	}

	function formatTimeAgo(timestamp: string) {
		if (!timestamp) return '';
		
		const now = new Date();
		const updated = new Date(timestamp);
		const diff = Math.floor((now.getTime() - updated.getTime()) / 1000);
		
		if (diff < 60) return 'just now';
		if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
		if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
		return `${Math.floor(diff / 86400)}d ago`;
	}

	function openResourceEditor(nodeId: string) {
		const node = silo?.nodes.find(n => n.id === nodeId);
		if (!node) return;
		
		editingResourceNodeId = nodeId;
		editableResourceContent = node.data?.sourceContent || '';
		editableResourceTitle = node.data?.title || '';
		isEditingResource = true;
	}

	async function saveResourceEdit() {
		if (!editingResourceNodeId) return;
		
		await updateResourceContent(editingResourceNodeId, editableResourceContent, editableResourceTitle);
		isEditingResource = false;
	}

	async function updateResourceContent(nodeId: string, newContent: string, newTitle: string) {
		const node = silo?.nodes.find(n => n.id === nodeId);
		if (!node) return;
		
		try {
			// Update local store
			const updatedData = {
				...node.data,
				sourceContent: newContent,
				title: newTitle || node.data.title
			};
			
			updateNode(siloId, nodeId, { data: updatedData });
			
			// Sync with database
			const { error } = await supabase
				.from('nodes')
				.update({ data: updatedData })
				.eq('id', nodeId);
				
			if (error) throw error;
			
			// If extraction nodes are connected, you might want to re-run them
			const extractionEdges = silo?.edges.filter(e => 
				e.source === nodeId && 
				silo.nodes.find(n => n.id === e.target)?.type === 'extract'
			) || [];
			
			for (const edge of extractionEdges) {
				await executeNodeFunction(siloId, edge.target, 'extract_quotes');
			}
			
			return true;
		} catch (err) {
			console.error('Failed to update resource content:', err);
			return false;
		}
	}

	function updateNode(siloId: string, nodeId: string, updates: any) {
		// Update node in local store
		if (!silo) return;
		
		const nodeIndex = silo.nodes.findIndex(n => n.id === nodeId);
		if (nodeIndex === -1) return;
		
		// Create updated node
		const updatedNode = {
			...silo.nodes[nodeIndex],
			...updates,
			data: {
				...silo.nodes[nodeIndex].data,
				...(updates.data || {})
			}
		};
		
		// Update in siloStore
		$siloStore = $siloStore.map(s => {
			if (s.id === siloId) {
				return {
					...s,
					nodes: s.nodes.map(n => n.id === nodeId ? updatedNode : n)
				};
			}
			return s;
		});
	}

	function updateProjectProgress() {
		// Add type annotation for projectUpdates
		const projectUpdates: Record<string, {
			progress: number;
			tasks_completed: number;
			tasks_total: number;
		}> = {};

		// Add optional chaining for silo
		if (!silo) return;

		projectNodes.forEach(projectNode => {
			// Add type safety for task filtering
			const connectedTasks = taskNodes.filter(task => 
				getNodeProject(task) === safeNodeTitle(projectNode)
			);
			
			const totalTasks = connectedTasks.length;
			const completedTasks = connectedTasks.filter(t => t.data?.isComplete).length;
			const progress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
			
			projectUpdates[projectNode.id] = {
				progress,
				tasks_completed: completedTasks,
				tasks_total: totalTasks
			};
		});

		// Update all projects with null checks
		Object.entries(projectUpdates).forEach(([nodeId, data]) => {
			const node = silo?.nodes.find(n => n.id === nodeId);
			if (!node) return;

			updateNode(siloId, nodeId, {
				data: {
					...node.data,
					result: data
				}
			});
		});
	}

	async function saveNode(node: SiloNode) {
		try {
			const { error } = await supabase
				.from('nodes')
				.update({ data: node.data })
				.eq('id', node.id);
			
			if (error) throw error;
		} catch (err) {
			console.error('Failed to save node:', err);
		}
	}

	function getStatusDisplay(status: string) {
		switch(status) {
			case 'not-started': return 'Not Started';
			case 'in-progress': return 'In Progress';
			case 'completed': return 'Completed';
			default: return status;
		}
	}

	function getProgressColor(percentage: number) {
        if (percentage < 33) return 'bg-red-500';
        if (percentage < 66) return 'bg-yellow-500';
        return 'bg-[var(--brand-green)]';
    }

</script>

{#if isLoading}
    <div class="flex justify-center items-center h-40">
        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--brand-green)]"></div>
    </div>
{:else if error}
    <div class="text-center py-12">
        <h2 class="text-xl font-medium text-[var(--text-secondary)]">Error</h2>
        <p class="mt-2">{error.message}</p>
    </div>
	{:else}
	<div class="flex flex-col md:flex-row h-screen w-full bg-[var(--bg-primary)] text-[var(--text-primary)]">

    <!-- Mobile Header -->
    <div class="md:hidden p-4 border-b border-[var(--border-color)] space-y-3">
        <div class="flex justify-between items-center">
            <h1 class="text-lg font-semibold">{silo?.name || 'Untitled Silo'}</h1>
            <select bind:value={selectedFilter} class="text-sm p-2 rounded bg-[var(--bg-secondary)]">
                <option>Priority</option>
                <option>Due Date</option>
                <option>Project</option>
            </select>
        </div>
        <div class="flex items-center gap-3">
            <div class="flex-1 h-2 bg-gray-200 rounded-full">
                <div class="h-2 rounded-full {getProgressColor(progressPercentage)}" 
                     style={`width: ${progressPercentage}%`}></div>
            </div>
            <span class="text-sm">{progressPercentage}%</span>
        </div>
    </div>

    <!-- Desktop Left Column -->
    <div class="hidden md:flex md:w-1/3 flex-col border-r border-[var(--border-color)]">
        
        {#if hasCommissionNodes}
        
        <div class="p-4 border-b border-[var(--border-color)] space-y-3">
        <h3 class="text-sm font-medium text-[var(--text-secondary)]">Client Sharing</h3>
        {#if shareLink}
            <div class="flex items-center gap-2">
            <input 
                type="text" 
                value={shareLink} 
                readonly 
                class="flex-1 text-xs p-2 rounded bg-[var(--bg-secondary)] border border-[var(--border-color)] truncate"
            />
            <button 
                on:click={() => navigator.clipboard.writeText(shareLink || '')}
                class="px-3 py-2 text-xs rounded bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary-hover)]"
            >
                Copy
            </button>
            </div>
            {#if clientNode?.data?.share_expiry}
            <div class="text-xs text-[var(--text-secondary)]">
                Expires on {new Date(clientNode.data.share_expiry).toLocaleDateString()}
            </div>
            {/if}
        {:else}
        <button 
        on:click={async () => {
          isGeneratingLink = true;
          try {
            shareLink = await generateShareLink();
          } catch (error) {
            alert(error.message);
          } finally {
            isGeneratingLink = false;
          }
        }}
        disabled={isGeneratingLink}
        class="w-full text-xs px-4 py-2 rounded bg-[var(--brand-green)] text-white hover:bg-[var(--brand-green-light)] disabled:opacity-50"
      >
        {isGeneratingLink ? 'Generating...' : 'Generate Secure Share Link'}
      </button>
        {/if}
        </div>
        {/if}
        
        {#if clientNode}
        {/if}
        {#if hasCommissionNodes}
        <div class="p-4 border-b border-[var(--border-color)] space-y-3">
            <h3 class="text-sm font-medium text-[var(--text-secondary)]">Commission Progress</h3>
            <div class="space-y-2">
                {#each [
                    { name: 'Contract Signed', status: contractNode?.data.status === 'signed' },
                    { name: 'Payment Received', status: contractNode?.data.paymentStatus === 'paid' },
                    { name: 'Delivery Accepted', status: contractNode?.data.deliveryStatus === 'accepted' }
                ] as milestone, i}
                    <div class="flex items-center gap-2">
                        <div class={`w-3 h-3 rounded-full ${milestone.status ? 'bg-[var(--brand-green)]' : 'bg-[var(--border-color)]'}`} />
                        <span class="text-sm">{milestone.name}</span>
                    </div>
                {/each}
            </div>
        </div>
        {/if}
        <div class="p-4 border-b border-[var(--border-color)]">
            <div class="flex items-center gap-3">
                <div class="flex-1">
                    <h2 class="text-lg font-semibold mb-2">{silo?.name || 'Untitled Silo'}</h2>
                    
                    <div class="flex items-center gap-2">
                        <div class="flex-1 h-2 bg-gray-200 rounded-full">
                            <div class="h-2 rounded-full {getProgressColor(progressPercentage)}" 
                                 style={`width: ${progressPercentage}%`}></div>
                        </div>
                        <span class="text-sm">{completedTasks.length}/{totalTasks}</span>
                    </div>
                    
                </div>
                
                <select bind:value={selectedFilter} class="text-sm p-2 rounded bg-[var(--bg-secondary)]">
                    <option>Priority</option>
                    <option>Due Date</option>
                    <option>Project</option>
                </select>
            </div>
        </div>

        <!-- Structured Tasks Table -->
        {#if taskNodes.length > 0}
        <div class="flex-1 overflow-y-auto p-4">
            <h3 class="text-sm font-medium text-[var(--text-secondary)] mb-3">Structured Tasks</h3>
            <table class="w-full text-sm">
                <thead class="bg-[var(--bg-secondary)] text-[var(--text-secondary)] uppercase">
                    <tr>
                        <th class="px-3 py-2">Task</th>
                        <th class="px-3 py-2">Due</th>
                        <th class="px-3 py-2">Priority</th>
                    </tr>
                </thead>
                <tbody>
                    {#each filteredTasks as task}
                        <tr class="bg-[var(--bg-primary)] border-b border-[var(--border-color)]">
                            <td class="px-3 py-2 flex items-center">
                                <input 
                                    type="checkbox" 
                                    checked={task.data?.isComplete} 
                                    on:change={() => toggleNodeCompletion(task)}
                                    class="w-3.5 h-3.5 mr-2 rounded border-[var(--border-color)] text-[var(--brand-green)]"
                                >
                                <span class={task.data?.isComplete ? "line-through text-[var(--text-secondary)]" : ""}>
                                    {safeNodeTitle(task)}
                                </span>
                            </td>
                            <td class="px-3 py-2">{getNodeDueDate(task) || '—'}</td>
                            <td class="px-3 py-2">
                                <span class="priority-badge {getNodePriority(task).toLowerCase()}">
                                    {getNodePriority(task)}
                                </span>
                            </td>
                        </tr>
                    {/each}
                    {#if filteredTasks.length === 0}
                        <tr class="bg-[var(--bg-primary)]">
                            <td colspan="3" class="px-3 py-6 text-center text-[var(--text-secondary)]">
                                No tasks available yet. Create tasks in the Flow Editor.
                            </td>
                        </tr>
                    {/if}
                </tbody>
            </table>
        </div>
        {:else if !hasCommissionNodes}
        <div class="flex-1 flex items-center justify-center p-4">
            <p class="text-[var(--text-secondary)] text-center">No tasks or commissions found<br/>Create nodes in the Flow Editor</p>
        </div>
        {/if}
    </div>

    <!-- Main Content Area -->
    <div class="flex-1 flex flex-col overflow-hidden">
        <!-- Desktop Toolbar -->
        <div class="hidden md:flex p-4 items-center justify-between border-b border-[var(--border-color)]">
            <h2 class="text-lg font-semibold">Thought Map</h2>
            <button class="px-4 py-2 text-sm rounded-lg bg-[var(--bg-secondary)] hover:bg-[var(--bg-secondary-hover)]">
                Reset View
            </button>
        </div>
         {#if hasCommissionNodes}
    <div class="p-4 border-b border-[var(--border-color)] space-y-4">
        <h2 class="text-lg font-semibold">Commission Details</h2>
        {#if clientNode}
        <div>
            <h3 class="text-sm font-medium text-[var(--text-secondary)] mb-2">Client Information</h3>
            <p class="text-sm">{clientNode.data.company}</p>
            <p class="text-xs text-[var(--text-secondary)]">Contacts: {clientNode.data.contacts?.join(', ')}</p>
        </div>
        {/if}

        {#if contractNode}
        <div>
            <h3 class="text-sm font-medium text-[var(--text-secondary)] mb-2">Contract Terms</h3>
            <div class="text-sm prose max-w-none"></div>
        </div>
        {/if}
    </div>
    {/if}

        <!-- Mobile Task List -->
        <div class="md:hidden flex-1 overflow-y-auto p-4">
            <div class="space-y-3">
                {#each filteredTasks as task}
                <div class="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <input 
                                type="checkbox" 
                                checked={task.data?.isComplete} 
                                on:change={() => toggleNodeCompletion(task)}
                                class="w-4 h-4 accent-[var(--brand-green)]"
                            >
                            <span class={task.data?.isComplete ? "line-through text-[var(--text-secondary)]" : ""}>
                                {safeNodeTitle(task)}
                            </span>
                        </div>
                        <span class="priority-badge {getNodePriority(task).toLowerCase()}">
                            {getNodePriority(task)}
                        </span>
                    </div>
                    {#if getNodeDueDate(task)}
                        <div class="mt-2 text-xs text-[var(--text-secondary)]">
                            Due: {getNodeDueDate(task)}
                        </div>
                    {/if}
                </div>
                {/each}
            </div>
        </div>

        <!-- Desktop Node Canvas -->
        <div class="hidden md:block flex-1 overflow-y-auto p-6">
            <div class="grid grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-7xl mx-auto">
                {#if taskNodes.length > 0 || resourceNodes.length > 0}
                {#each filteredTasks as node}
                <a 
                  href={`/silos/${siloId}/workspace/${node.id}`}
                  class="block hover:border-[var(--brand-green)] transition-colors"
                >
                  <div class="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)]">
                    <h3 class="text-sm font-medium text-[var(--text-primary)] mb-2">Task Node</h3>
                    <p class="text-sm text-[var(--text-secondary)]">{safeNodeTitle(node)}</p>
                    <div class="mt-3 space-y-1">
                          <div class="flex items-center justify-between">
                              <span class="text-xs text-[var(--text-secondary)]">Priority:</span>
                              <span class="priority-badge {getNodePriority(node).toLowerCase()}">
                                  {getNodePriority(node)}
                              </span>
                          </div>
                          <div class="flex items-center justify-between">
                              <span class="text-xs text-[var(--text-secondary)]">Due:</span>
                              <span class="text-xs text-[var(--text-secondary)]">{getNodeDueDate(node) || 'Not set'}</span>
                          </div>
                      </div>
                      <button 
                      class="mt-3 w-full text-xs px-3 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--brand-green)]"
                      on:click|stopPropagation={() => {/* Existing Attach Resource logic */}}
                    >
                      Attach Resource
                    </button>
                  </div>
                </a>
                {/each}
                {/if}
                {#each commissionNodes as node}
                <div class="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] hover:border-[var(--brand-green)] transition-colors">
                    <h3 class="text-sm font-medium text-[var(--text-primary)] mb-2">
                        {node.type.charAt(0).toUpperCase() + node.type.slice(1)} Node
                    </h3>
                    <p class="text-sm text-[var(--text-secondary)] truncate">{safeNodeTitle(node)}</p>
                    {#if node.type === 'contract'}
                    <div class="mt-3 space-y-1">
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-[var(--text-secondary)]">Status:</span>
                            <span class="text-xs text-[var(--brand-green)]">{node.data.status}</span>
                        </div>
                        <div class="flex items-center justify-between">
                            <span class="text-xs text-[var(--text-secondary)]">Payment:</span>
                            <span class="text-xs text-[var(--text-secondary)]">{node.data.paymentStatus || 'Pending'}</span>
                        </div>
                    </div>
                    {/if}
                </div>
                {/each}
                {#each resourceNodes as node}
                <div class="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border-color)] hover:border-[var(--brand-green)] transition-colors">
                    <h3 class="text-sm font-medium text-[var(--text-primary)] mb-2">Resource Node</h3>
                    <p class="text-sm text-[var(--text-secondary)] truncate">{safeNodeTitle(node)}</p>
                    <button 
                        on:click={() => openResourceEditor(node.id)}
                        class="mt-3 w-full text-xs px-3 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--border-color)] hover:border-[var(--brand-green)]"
                    >
                        Edit Resource
                    </button>
                </div>
                {/each}
                <div class="border-2 border-dashed border-[var(--border-color)] rounded-xl flex items-center justify-center hover:border-[var(--brand-green)] cursor-pointer">
                    <p class="text-sm text-[var(--text-secondary)]">+ New Node</p>
                </div>
            </div>
        </div>
    </div>

        <!-- RESOURCE EDITOR MODAL (ORIGINAL) -->
        {#if isEditingResource}
        <div class="fixed inset-0 bg-opacity-30 backdrop-blur-sm flex items-center justify-center z-50" 
             transition:fade={{ duration: 150 }}
             on:click|self={() => isEditingResource = false}>
            
            {#if !selectedResourceOption}
                <!-- Initial Selection Modal -->
                <div class="bg-[var(--bg-primary)] rounded-lg shadow-xl border border-[var(--border-color)] border-opacity-20 w-full max-w-md mx-2"
                     transition:slide={{ duration: 150 }}>
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-lg font-semibold text-[var(--text-primary)]">Resource Options</h3>
                            <button on:click={() => isEditingResource = false} 
                                    class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div class="space-y-3">
                            <!-- Create New Option -->
                            <button 
                                on:click={() => selectResourceOption('new')}
                                class="w-full group flex items-center p-4 border border-[var(--border-color)] border-opacity-30 rounded-lg bg-[var(--bg-secondary)] hover:border-[var(--brand-green)] hover:bg-[var(--bg-accent)] transition-all duration-200">
                                <div class="flex-shrink-0 mr-4 p-2 rounded-full bg-[var(--node-icon-bg)] group-hover:bg-[var(--brand-green)] group-hover:bg-opacity-20 transition-colors duration-200">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--brand-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M12 5v14m-7-7h14" />
                                    </svg>
                                </div>
                                <div class="flex-1">
                                    <h4 class="text-[var(--text-primary)] font-medium">New Resource</h4>
                                    <p class="text-[var(--text-secondary)] text-sm">Create from scratch</p>
                                </div>
                            </button>
                            
                            <!-- Link Note Option -->
                            <button 
                                on:click={() => selectResourceOption('attach')}
                                class="w-full group flex items-center p-4 border border-[var(--border-color)] border-opacity-30 rounded-lg bg-[var(--bg-secondary)] hover:border-[var(--brand-green)] hover:bg-[var(--bg-accent)] transition-all duration-200">
                                <div class="flex-shrink-0 mr-4 p-2 rounded-full bg-[var(--node-icon-bg)] group-hover:bg-[var(--brand-green)] group-hover:bg-opacity-20 transition-colors duration-200">
                                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--brand-accent)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                                    </svg>
                                </div>
                                <div class="flex-1">
                                    <h4 class="text-[var(--text-primary)] font-medium">Link Note</h4>
                                    <p class="text-[var(--text-secondary)] text-sm">Attach existing note</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            
            {:else if selectedResourceOption === 'new'}
                <!-- New Resource Editor -->
                <div class="bg-[var(--bg-primary)] rounded-lg shadow-xl w-full max-w-2xl mx-2"
                     transition:slide={{ duration: 150 }}>
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-semibold text-[var(--text-primary)]">New Resource</h3>
                            <button on:click={() => selectedResourceOption = null} class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M19 12H5M12 19l-7-7 7-7" />
                                </svg>
                            </button>
                        </div>
                        
                        <div class="mb-4">
                            <label for="resourceTitle" class="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Title
                            </label>
                            <input 
                                id="resourceTitle"
                                type="text" 
                                bind:value={editableResourceTitle} 
                                class="w-full px-3 py-2 border border-[var(--border-color)] rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand-green)] focus:border-[var(--brand-green)] bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                            />
                        </div>
                        
                        <div class="mb-5">
                            <label for="resourceContent" class="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                Content
                            </label>
                            <textarea 
                                id="resourceContent"
                                bind:value={editableResourceContent} 
                                class="w-full px-3 py-2 border border-[var(--border-color)] rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand-green)] focus:border-[var(--brand-green)] font-mono h-64 bg-[var(--bg-secondary)] text-[var(--text-primary)]"
                            ></textarea>
                        </div>
                        
                        <div class="flex justify-end space-x-3">
                            <button 
                                on:click={() => selectedResourceOption = null} 
                                class="px-4 py-2 border border-[var(--border-color)] rounded-md text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] transition-colors duration-200"
                            >
                                Back
                            </button>
                            <button 
                                on:click={saveResourceEdit} 
                                class="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[var(--brand-green)] hover:bg-[var(--brand-green-light)] transition-colors duration-200"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
                
            {:else if selectedResourceOption === 'attach'}
                <!-- Note Selection -->
                <div class="bg-[var(--bg-primary)] rounded-lg shadow-xl w-full max-w-2xl mx-2"
                     transition:slide={{ duration: 150 }}>
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-lg font-semibold text-[var(--text-primary)]">Link Existing Note</h3>
                            <button on:click={() => selectedResourceOption = null} class="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M19 12H5M12 19l-7-7 7-7" />
                                </svg>
                            </button>
                        </div>
                        
                        {#if notesLoading}
                            <div class="flex justify-center items-center py-12">
                                <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--brand-green)]"></div>
                            </div>
                        {:else if userNotes && userNotes.length > 0}
                            <div class="mb-4">
                                <input 
                                    type="text" 
                                    placeholder="Search notes..." 
                                    bind:value={noteSearchQuery}
                                    class="w-full px-3 py-2 border border-[var(--border-color)] rounded-md shadow-sm focus:outline-none focus:ring-[var(--brand-green)] focus:border-[var(--brand-green)] bg-[var(--bg-secondary)] text-[var(--text-primary)] mb-3"
                                />
                                
                                <div class="max-h-80 overflow-y-auto pr-1 space-y-2">
                                    {#each filteredNotes as note (note.id)}
                                        <button 
                                            on:click={() => selectNote(note)}
                                            class="w-full text-left p-3 rounded-md border border-[var(--border-color)] hover:border-[var(--brand-green)] hover:bg-[var(--bg-accent)] transition-all duration-200 group">
                                            <div class="flex justify-between items-center">
                                                <h4 class="font-medium text-[var(--text-primary)] truncate">{note.title || 'Untitled Note'}</h4>
                                                <span class="text-xs text-[var(--text-secondary)]">
                                                    {new Date(note.updated_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <p class="text-sm text-[var(--text-secondary)] mt-1 line-clamp-2">
                                                {note.content ? stripHtml(note.content) : 'No content'}
                                            </p>
                                            <div class="flex justify-end mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                <span class="text-xs text-[var(--brand-accent)]">Click to attach</span>
                                            </div>
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        {:else}
                            <div class="text-center py-8">
                                <p class="text-[var(--text-secondary)]">No notes found</p>
                                <button 
                                    on:click={createNewNote}
                                    class="mt-3 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-[var(--brand-green)] hover:bg-[var(--brand-green-light)] transition-colors duration-200">
                                    Create New Note
                                </button>
                            </div>
                        {/if}
                        
                        <div class="flex justify-end space-x-3 mt-4">
                            <button 
                                on:click={() => selectedResourceOption = null} 
                                class="px-4 py-2 border border-[var(--border-color)] rounded-md text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-primary)] transition-colors duration-200"
                            >
                                Back
                            </button>
                        </div>
                    </div>
                </div>

			{/if}
            
		</div>
		{/if}
    </div>
    {/if}


<style>
   .task-card, .resource-card {
        border-radius: 12px;
        border: 1px solid var(--border-color);
        transition: all 0.2s ease;
    }

    .task-card:hover, .resource-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }

	.priority-badge {
    font-size: 0.75rem; /* text-xs */
    font-weight: 500;   /* font-medium */
    padding: 0.25rem 0.5rem; /* px-2 py-1 */
    border-radius: 9999px; /* rounded-full */
}

.priority-badge.urgent {
    background-color: #ffb3b3; /* bg-red-100 */
    color: #991b1b; /* text-red-800 */
}

.priority-badge.high {
    background-color: #ffb5a7; /* bg-orange-100 */
    color: #9a3412; /* text-orange-800 */
}

.priority-badge.medium {
    background-color: #fef9c3; /* bg-yellow-100 */
    color: #854d0e; /* text-yellow-800 */
}

.priority-badge.low {
    background-color: #dcfce7; /* bg-green-100 */
    color: #166534; /* text-green-800 */
}

/* Scrollbar Styling */
.overflow-y-auto::-webkit-scrollbar {
        width: 8px;
		height: 8px;
    }
    .overflow-y-auto::-webkit-scrollbar-track {
        background: var(--bg-secondary);
    }
    .overflow-y-auto::-webkit-scrollbar-thumb {
        background: var(--border-color);
        border-radius: 4px;
    }
</style>