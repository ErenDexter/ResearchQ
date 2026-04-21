<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { BookOpen, Search, Database } from 'lucide-svelte';

	let journalList = $state<any[]>([]);
	let loading = $state(true);
	let filterPublisher = $state('');

	function getProjectId(): string {
		if (typeof window === 'undefined') return '';
		return (window as any).__currentProjectId || localStorage.getItem('currentProjectId') || '';
	}

	async function loadJournals() {
		loading = true;
		const projectId = getProjectId();
		const url = projectId ? `/api/journals?projectId=${projectId}` : '/api/journals';
		const res = await fetch(url);
		if (res.ok) {
			journalList = await res.json();
		}
		loading = false;
	}

	$effect(() => {
		loadJournals();
	});

	// Unique publishers for filter
	let publishers = $derived(
		[...new Set(journalList.map((j) => j.publisher).filter(Boolean))].sort()
	);

	let filtered = $derived(
		filterPublisher
			? journalList.filter((j) => j.publisher === filterPublisher)
			: journalList
	);

	// Group by relevance rank
	let coreVenues = $derived(filtered.filter((j) => j.relevanceRank === 'core'));
	let relevantVenues = $derived(filtered.filter((j) => j.relevanceRank === 'relevant'));
	let otherVenues = $derived(
		filtered.filter((j) => !j.relevanceRank || (j.relevanceRank !== 'core' && j.relevanceRank !== 'relevant'))
	);

	function getRankColor(rank: string | null) {
		if (rank === 'core') return 'success';
		if (rank === 'relevant') return 'warning';
		return 'secondary';
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-zinc-900">Venues</h1>
		<p class="mt-1 text-sm text-zinc-500">Journals, conferences, and proceedings discovered from your searches</p>
	</div>

	{#if loading}
		<p class="py-12 text-center text-sm text-zinc-500">Loading...</p>
	{:else if journalList.length === 0}
		<Card class="py-12 text-center">
			<BookOpen class="mx-auto mb-3 h-10 w-10 text-zinc-300" />
			<p class="text-sm text-zinc-500">No venues discovered yet.</p>
			<a href="/search" class="mt-2 inline-block text-sm font-medium text-zinc-900 hover:underline">Start a search</a>
		</Card>
	{:else}
		<!-- Publisher filter -->
		{#if publishers.length > 0}
			<div class="flex flex-wrap items-center gap-2">
				<Database class="h-4 w-4 text-zinc-400" />
				<span class="text-sm font-medium text-zinc-600">Filter by database:</span>
				<button
					class="rounded-full border px-3 py-1 text-xs font-medium transition-colors {filterPublisher === '' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'}"
					onclick={() => (filterPublisher = '')}
				>
					All ({journalList.length})
				</button>
				{#each publishers as pub}
					{@const count = journalList.filter((j) => j.publisher === pub).length}
					<button
						class="rounded-full border px-3 py-1 text-xs font-medium transition-colors {filterPublisher === pub ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'}"
						onclick={() => (filterPublisher = filterPublisher === pub ? '' : pub)}
					>
						{pub} ({count})
					</button>
				{/each}
			</div>
		{/if}

		<!-- Core venues -->
		{#if coreVenues.length > 0}
			<div>
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">Core Venues ({coreVenues.length})</h2>
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
					{#each coreVenues as journal}
						{@render venueCard(journal)}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Relevant venues -->
		{#if relevantVenues.length > 0}
			<div>
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-700">Relevant Venues ({relevantVenues.length})</h2>
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
					{#each relevantVenues as journal}
						{@render venueCard(journal)}
					{/each}
				</div>
			</div>
		{/if}

		<!-- Other / unranked venues -->
		{#if otherVenues.length > 0}
			<div>
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
					{coreVenues.length > 0 || relevantVenues.length > 0 ? 'Other' : 'All'} Venues ({otherVenues.length})
				</h2>
				<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
					{#each otherVenues as journal}
						{@render venueCard(journal)}
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

{#snippet venueCard(journal: any)}
	<Card class="p-4">
		<div class="space-y-2">
			<div class="flex items-start justify-between gap-2">
				<h3 class="text-sm font-semibold text-zinc-900 line-clamp-2">{journal.name}</h3>
				{#if journal.relevanceRank}
					<Badge variant={getRankColor(journal.relevanceRank)} class="shrink-0">{journal.relevanceRank}</Badge>
				{/if}
			</div>

			<div class="flex flex-wrap items-center gap-1.5">
				{#if journal.publisher}
					<Badge variant="outline" class="text-xs">
						<Database class="mr-1 h-3 w-3" />
						{journal.publisher}
					</Badge>
				{/if}
				{#if journal.type && journal.type !== 'journal'}
					<Badge variant="secondary" class="text-xs">{journal.type}</Badge>
				{/if}
				<Badge variant="secondary" class="text-xs">{journal.paperCount} papers</Badge>
				{#if journal.issn}
					<span class="text-xs text-zinc-400">ISSN: {journal.issn}</span>
				{/if}
			</div>

			{#if journal.relevanceScore != null}
				<div class="h-1.5 rounded-full bg-zinc-100">
					<div
						class="h-1.5 rounded-full bg-zinc-700 transition-all"
						style="width: {Math.round(journal.relevanceScore * 100)}%"
					></div>
				</div>
			{/if}

			<div class="flex items-center gap-2">
				{#if journal.openalexId}
					<a
						href={journal.openalexId}
						target="_blank"
						rel="noopener"
						class="text-xs text-blue-600 hover:underline"
					>
						OpenAlex
					</a>
				{/if}
				<a href="/search" class="text-xs text-zinc-500 hover:text-zinc-700">
					<Search class="inline h-3 w-3" /> Search this venue
				</a>
			</div>
		</div>
	</Card>
{/snippet}
