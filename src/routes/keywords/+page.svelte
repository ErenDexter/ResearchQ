<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { Tag, Plus, Trash2, Search, AlertCircle } from 'lucide-svelte';

	interface Keyword {
		id: string;
		term: string;
		isBaseKeyword: boolean;
	}

	let keywords = $state<Keyword[]>([]);
	let loading = $state(true);
	let newTerm = $state('');
	let adding = $state(false);
	let error = $state('');
	let searchQuery = $state('');
	let deletingId = $state<string | null>(null);

	function getProjectId(): string {
		if (typeof window === 'undefined') return '';
		return (window as any).__currentProjectId || localStorage.getItem('currentProjectId') || '';
	}

	let filteredKeywords = $derived(
		searchQuery.trim()
			? keywords.filter((k) => k.term.toLowerCase().includes(searchQuery.toLowerCase()))
			: keywords
	);

	let baseCount = $derived(keywords.filter((k) => k.isBaseKeyword).length);
	let customCount = $derived(keywords.filter((k) => !k.isBaseKeyword).length);

	async function loadKeywords() {
		loading = true;
		const projectId = getProjectId();
		const url = projectId ? `/api/keywords?projectId=${projectId}` : '/api/keywords';
		const res = await fetch(url);
		if (res.ok) {
			keywords = await res.json();
		}
		loading = false;
	}

	async function addKeyword() {
		if (!newTerm.trim()) return;

		adding = true;
		error = '';

		const res = await fetch('/api/keywords', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ term: newTerm.trim(), projectId: getProjectId() })
		});

		if (res.ok) {
			newTerm = '';
			await loadKeywords();
		} else {
			const data = await res.json();
			error = data.error || 'Failed to add keyword';
		}

		adding = false;
	}

	async function deleteKeyword(id: string) {
		deletingId = id;
		const projectId = getProjectId();
		const res = await fetch(`/api/keywords?id=${id}&projectId=${projectId}`, { method: 'DELETE' });
		if (res.ok) {
			keywords = keywords.filter((k) => k.id !== id);
		}
		deletingId = null;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			addKeyword();
		}
	}

	$effect(() => {
		loadKeywords();
	});
</script>

<div class="space-y-6">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold text-zinc-900">Keywords</h1>
		<p class="mt-1 text-sm text-zinc-500">
			Manage search keywords used for discovering papers. Base keywords come from the analysis framework.
		</p>
	</div>

	<!-- Stats -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
		<Card class="p-4">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-zinc-100 p-2">
					<Tag class="h-5 w-5 text-zinc-700" />
				</div>
				<div>
					<p class="text-2xl font-bold text-zinc-900">{keywords.length}</p>
					<p class="text-xs text-zinc-500">Total Keywords</p>
				</div>
			</div>
		</Card>
		<Card class="p-4">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-blue-50 p-2">
					<Tag class="h-5 w-5 text-blue-700" />
				</div>
				<div>
					<p class="text-2xl font-bold text-zinc-900">{baseCount}</p>
					<p class="text-xs text-zinc-500">Base Keywords</p>
				</div>
			</div>
		</Card>
		<Card class="p-4">
			<div class="flex items-center gap-3">
				<div class="rounded-lg bg-emerald-50 p-2">
					<Plus class="h-5 w-5 text-emerald-700" />
				</div>
				<div>
					<p class="text-2xl font-bold text-zinc-900">{customCount}</p>
					<p class="text-xs text-zinc-500">Custom Keywords</p>
				</div>
			</div>
		</Card>
	</div>

	<!-- Add Keyword -->
	<Card class="p-5">
		<h2 class="mb-3 text-sm font-semibold text-zinc-900">Add New Keyword</h2>
		<div class="flex gap-3">
			<div class="flex-1">
				<Input
					type="text"
					placeholder="Enter a keyword or phrase..."
					bind:value={newTerm}
					onkeydown={handleKeydown}
					disabled={adding}
				/>
			</div>
			<Button onclick={addKeyword} disabled={adding || !newTerm.trim()}>
				<Plus class="h-4 w-4" />
				{adding ? 'Adding...' : 'Add'}
			</Button>
		</div>
		{#if error}
			<div class="mt-2 flex items-center gap-1.5 text-sm text-red-600">
				<AlertCircle class="h-4 w-4" />
				{error}
			</div>
		{/if}
	</Card>

	<!-- Search & List -->
	<Card class="p-5">
		<div class="mb-4 flex items-center gap-3">
			<div class="relative flex-1">
				<Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
				<Input
					type="text"
					placeholder="Filter keywords..."
					class="pl-9"
					bind:value={searchQuery}
				/>
			</div>
			<p class="text-sm text-zinc-500">
				{filteredKeywords.length} keyword{filteredKeywords.length !== 1 ? 's' : ''}
			</p>
		</div>

		{#if loading}
			<p class="py-8 text-center text-sm text-zinc-500">Loading keywords...</p>
		{:else if filteredKeywords.length === 0}
			<div class="flex flex-col items-center py-8 text-center">
				<Tag class="mb-3 h-10 w-10 text-zinc-300" />
				<p class="text-sm text-zinc-500">
					{searchQuery ? 'No keywords match your filter.' : 'No keywords yet.'}
				</p>
			</div>
		{:else}
			<div class="space-y-1.5">
				{#each filteredKeywords as keyword (keyword.id)}
					<div
						class="group flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-2.5 transition-colors hover:bg-zinc-50"
					>
						<div class="flex items-center gap-3">
							<Tag class="h-4 w-4 text-zinc-400" />
							<span class="text-sm font-medium text-zinc-900">{keyword.term}</span>
							{#if keyword.isBaseKeyword}
								<Badge variant="secondary" class="text-[10px]">base</Badge>
							{:else}
								<Badge variant="outline" class="text-[10px]">custom</Badge>
							{/if}
						</div>
						<button
							onclick={() => deleteKeyword(keyword.id)}
							disabled={deletingId === keyword.id}
							class="rounded p-1.5 text-zinc-400 opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100 disabled:opacity-50"
							title="Delete keyword"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</Card>
</div>
