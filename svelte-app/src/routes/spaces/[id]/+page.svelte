<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import { user } from '$lib/stores/userStore';
	import Output from '$lib/components/Output.svelte';
	import Notes from '$lib/components/Notes.svelte';

  const spaceId = $page.params.id;
	let spaceName = '';
	type SpaceData = {
		id: string;
		name: string;
		icon: string;
		color?: string;
		created_at: string;
	};

	let spaceData: SpaceData | null = null;
	let loading = true;

	onMount(async () => {
		if ($user) {
			await loadSpaceData();
		}
	});

	async function loadSpaceData() {
		loading = true;
		const { data, error } = await supabase
			.from('spaces')
			.select('*')
			.eq('id', spaceId)
			.single();

		if (!error && data) {
			spaceData = data;
			spaceName = data.name;
		}
		loading = false;
	}
</script>

<div class="container mx-auto px-6 py-8">
	{#if loading}
		<div class="flex justify-center items-center h-40">
			<div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[var(--brand-green)]"></div>
		</div>
	{:else if spaceData}
		<!-- Space Header -->
		<div class="mb-8">
			<h1 class="text-4xl font-bold flex items-center gap-3">
				<span class="text-2xl">{spaceData.icon}</span>
				<span>{spaceName}</span>
			</h1>
			<p class="text-[var(--text-secondary)] mt-1">Create, edit, and organize your ideas beautifully.</p>
		</div>

		<!-- Main Content Area (Notion-style) -->
		<div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
			<!-- Output Section -->
			<div class="col-span-2 bg-[var(--bg-secondary)] rounded-xl shadow-md p-6 space-y-4">
				<h2 class="text-xl font-semibold text-[var(--text-primary)]">Your Output</h2>
				<Output spaceId={spaceId} />
			</div>

			<!-- Notes Sidebar -->
			<div class="bg-[var(--bg-secondary)] rounded-xl shadow-md p-6 space-y-4">
				<h2 class="text-xl font-semibold text-[var(--text-primary)]">Notes</h2>
				<Notes spaceId={spaceId} />
			</div>
		</div>
	{:else}
		<div class="text-center py-12">
			<h2 class="text-xl font-medium text-[var(--text-secondary)]">Space not found</h2>
			<p class="mt-2">This space doesn't exist or you don't have access to it.</p>
		</div>
	{/if}
</div>

<style>
	:global(body) {
		background-color: var(--bg-primary);
	}
</style>
