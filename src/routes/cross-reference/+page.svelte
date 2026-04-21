<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Filter, ExternalLink } from 'lucide-svelte';

	interface Paper {
		id: string;
		title: string;
		doi: string | null;
		publicationYear: number | null;
		summary: string | null;
		methodologySummary: string | null;
		targetPopulation: string | null;
		focusedRegion: string | null;
		platformDomain: string | null;
		journalName: string | null;
		paperUrl: string | null;
		isRelevant: boolean | null;
		publisher: string | null;
		authors: string[];
		keywords: string[];
		tags: Record<string, string>;
	}

	let papers: Paper[] = $state([]);
	let total = $state(0);
	let currentPage = $state(1);
	let loading = $state(true);
	let expandedRow = $state<string | null>(null);

	// Filters
	let searchQuery = $state('');
	let yearMin = $state('');
	let yearMax = $state('');
	let regionFilter = $state('');
	let platformFilter = $state('');
	let databaseFilter = $state('');
	let keywordFilter = $state('');
	let availableDatabases = $state<string[]>([]);

	// Sort
	let sortBy = $state('year');
	let sortOrder = $state<'asc' | 'desc'>('desc');

	const limit = 30;

	let projectIdMissing = $state(false);

	function getProjectId(): string {
		if (typeof window === 'undefined') return '';
		return (window as any).__currentProjectId || localStorage.getItem('currentProjectId') || '';
	}

	async function waitForProjectId(maxAttempts = 20, delayMs = 50): Promise<string> {
		for (let i = 0; i < maxAttempts; i++) {
			const id = getProjectId();
			if (id) return id;
			await new Promise((r) => setTimeout(r, delayMs));
		}
		return '';
	}

	async function loadData() {
		loading = true;
		const projectId = await waitForProjectId();
		console.log('[cross-reference] resolved projectId:', projectId);

		if (!projectId) {
			console.warn('[cross-reference] no project ID available after waiting');
			projectIdMissing = true;
			loading = false;
			return;
		}
		projectIdMissing = false;

		// Load distinct databases for dropdown (only once, on first load)
		if (availableDatabases.length === 0) {
			try {
				const jres = await fetch(`/api/journals?projectId=${projectId}`);
				if (jres.ok) {
					const journals = await jres.json();
					const publishers = [...new Set(journals.map((j: any) => j.publisher).filter(Boolean))].sort() as string[];
					availableDatabases = publishers;
				}
			} catch {
				// non-fatal
			}
		}

		const params = new URLSearchParams({
			page: String(currentPage),
			limit: String(limit),
			sort: sortBy,
			order: sortOrder
		});
		if (searchQuery) params.set('search', searchQuery);
		if (yearMin) params.set('yearMin', yearMin);
		if (yearMax) params.set('yearMax', yearMax);
		if (regionFilter) params.set('region', regionFilter);
		if (platformFilter) params.set('platform', platformFilter);
		if (databaseFilter) params.set('database', databaseFilter);
		if (keywordFilter) params.set('keyword', keywordFilter);

		const url = `/api/projects/${projectId}/cross-reference?${params.toString()}`;
		console.log('[cross-reference] fetching:', url);

		const res = await fetch(url);
		const data = await res.json();
		console.log('[cross-reference] response: total=', data.total, 'papers=', data.papers?.length);

		papers = data.papers || [];
		total = data.total || 0;
		loading = false;
	}

	onMount(loadData);

	function applyFilters() {
		currentPage = 1;
		loadData();
	}

	function toggleSort(column: string) {
		if (sortBy === column) {
			sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
		} else {
			sortBy = column;
			sortOrder = 'desc';
		}
		loadData();
	}

	function exportData(format: string) {
		const projectId = getProjectId();
		if (!projectId) return;
		const params = new URLSearchParams({ format });
		if (searchQuery) params.set('search', searchQuery);
		if (yearMin) params.set('yearMin', yearMin);
		if (yearMax) params.set('yearMax', yearMax);
		if (regionFilter) params.set('region', regionFilter);
		if (platformFilter) params.set('platform', platformFilter);
		if (databaseFilter) params.set('database', databaseFilter);
		if (keywordFilter) params.set('keyword', keywordFilter);
		window.open(`/api/projects/${projectId}/export?${params.toString()}`);
	}

	const totalPages = $derived(Math.ceil(total / limit));
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-zinc-900">Cross-Reference Matrix</h1>
			<p class="mt-1 text-sm text-zinc-500">
				Comprehensive paper comparison table with sorting, filtering, and export
			</p>
		</div>
		<div class="flex items-center gap-2">
			<Button variant="outline" onclick={() => exportData('csv')}>
				<Download class="mr-2 h-4 w-4" />
				CSV
			</Button>
			<Button variant="outline" onclick={() => exportData('bibtex')}>
				<Download class="mr-2 h-4 w-4" />
				BibTeX
			</Button>
			<Button variant="outline" onclick={() => exportData('json')}>
				<Download class="mr-2 h-4 w-4" />
				JSON
			</Button>
		</div>
	</div>

	<!-- Filters -->
	<Card class="p-4">
		<div class="flex flex-wrap items-end gap-3">
			<div class="flex-1 min-w-[200px]">
				<label class="text-xs font-medium text-zinc-500 mb-1 block">Search</label>
				<Input bind:value={searchQuery} placeholder="Search titles..." />
			</div>
			<div class="w-24">
				<label class="text-xs font-medium text-zinc-500 mb-1 block">Year from</label>
				<Input bind:value={yearMin} placeholder="2016" type="number" />
			</div>
			<div class="w-24">
				<label class="text-xs font-medium text-zinc-500 mb-1 block">Year to</label>
				<Input bind:value={yearMax} placeholder="2026" type="number" />
			</div>
			<div class="w-36">
				<label class="text-xs font-medium text-zinc-500 mb-1 block">Region</label>
				<Input bind:value={regionFilter} placeholder="e.g., United States" />
			</div>
			<div class="w-36">
				<label class="text-xs font-medium text-zinc-500 mb-1 block">Platform</label>
				<Input bind:value={platformFilter} placeholder="e.g., Healthcare" />
			</div>
			<div class="w-44">
				<label for="databaseFilter" class="text-xs font-medium text-zinc-500 mb-1 block">Database</label>
				<select
					id="databaseFilter"
					bind:value={databaseFilter}
					class="w-full h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
				>
					<option value="">All databases</option>
					{#each availableDatabases as db}
						<option value={db}>{db}</option>
					{/each}
				</select>
			</div>
			<div class="w-40">
				<label class="text-xs font-medium text-zinc-500 mb-1 block">Keyword</label>
				<Input bind:value={keywordFilter} placeholder="e.g., fairness" />
			</div>
			<Button onclick={applyFilters}>
				<Filter class="mr-2 h-4 w-4" />
				Apply
			</Button>
		</div>
	</Card>

	<!-- Table -->
	{#if loading}
		<p class="text-sm text-zinc-500 py-8 text-center">Loading...</p>
	{:else if projectIdMissing}
		<p class="text-sm text-zinc-500 py-8 text-center">
			No project selected. Pick a project from the sidebar dropdown.
		</p>
	{:else if papers.length === 0 && total === 0 && !searchQuery && !yearMin && !yearMax && !regionFilter && !platformFilter && !databaseFilter && !keywordFilter}
		<p class="text-sm text-zinc-500 py-8 text-center">
			This project has no papers yet. <a href="/search" class="text-zinc-900 font-medium hover:underline">Run a search</a> to get started.
		</p>
	{:else if papers.length === 0}
		<p class="text-sm text-zinc-500 py-8 text-center">No papers match your filters.</p>
	{:else}
		<div class="overflow-x-auto rounded-lg border border-zinc-200">
			<table class="text-sm" style="min-width: 1800px;">
				<thead>
					<tr class="bg-zinc-50 border-b border-zinc-200">
						<th class="px-4 py-2 text-left font-medium text-zinc-600 min-w-[380px]">
							<button class="flex items-center gap-1" onclick={() => toggleSort('title')}>
								Title
								{#if sortBy === 'title'}
									{#if sortOrder === 'desc'}<ChevronDown class="h-3 w-3" />{:else}<ChevronUp class="h-3 w-3" />{/if}
								{/if}
							</button>
						</th>
						<th class="px-4 py-2 text-left font-medium text-zinc-600 min-w-[70px]">
							<button class="flex items-center gap-1" onclick={() => toggleSort('year')}>
								Year
								{#if sortBy === 'year'}
									{#if sortOrder === 'desc'}<ChevronDown class="h-3 w-3" />{:else}<ChevronUp class="h-3 w-3" />{/if}
								{/if}
							</button>
						</th>
						<th class="px-4 py-2 text-left font-medium text-zinc-600 min-w-[220px]">Authors</th>
						<th class="px-4 py-2 text-left font-medium text-zinc-600 min-w-[200px]">Venue</th>
						<th class="px-4 py-2 text-left font-medium text-zinc-600 min-w-[180px]">Database</th>
						<th class="px-4 py-2 text-left font-medium text-zinc-600 min-w-[250px]">Methodology</th>
						<th class="px-4 py-2 text-left font-medium text-zinc-600 min-w-[150px]">Region</th>
						<th class="px-4 py-2 text-left font-medium text-zinc-600 min-w-[160px]">Platform</th>
						<th class="px-4 py-2 text-left font-medium text-zinc-600 min-w-[160px]">Population</th>
					</tr>
				</thead>
				<tbody>
					{#each papers as paper}
						<tr
							class="border-b border-zinc-100 hover:bg-zinc-50 cursor-pointer transition-colors"
							onclick={() => (expandedRow = expandedRow === paper.id ? null : paper.id)}
						>
							<td class="px-3 py-2">
								<div class="flex items-start gap-2">
									<span class="line-clamp-2 text-zinc-900 font-medium">{paper.title}</span>
									{#if paper.paperUrl}
										<a href={paper.paperUrl} target="_blank" rel="noopener" onclick={(e: MouseEvent) => e.stopPropagation()} class="shrink-0">
											<ExternalLink class="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-700" />
										</a>
									{/if}
								</div>
							</td>
							<td class="px-3 py-2 text-zinc-600">{paper.publicationYear || '—'}</td>
							<td class="px-3 py-2 text-zinc-600">
								<span class="line-clamp-2">{paper.authors.slice(0, 3).join(', ')}{paper.authors.length > 3 ? ` +${paper.authors.length - 3}` : ''}</span>
							</td>
							<td class="px-3 py-2 text-zinc-600">
								<span class="line-clamp-1">{paper.journalName || '—'}</span>
							</td>
							<td class="px-3 py-2">
								{#if paper.publisher}
									<Badge variant="outline" class="text-xs line-clamp-2">{paper.publisher}</Badge>
								{:else}
									<span class="text-zinc-400">—</span>
								{/if}
							</td>
							<td class="px-3 py-2 text-zinc-600">
								<span class="line-clamp-2 text-xs">{paper.methodologySummary || '—'}</span>
							</td>
							<td class="px-3 py-2">
								{#if paper.focusedRegion}
									<Badge variant="outline" class="text-xs">{paper.focusedRegion}</Badge>
								{:else}
									<span class="text-zinc-400">—</span>
								{/if}
							</td>
							<td class="px-3 py-2">
								{#if paper.platformDomain}
									<Badge variant="secondary" class="text-xs">{paper.platformDomain}</Badge>
								{:else}
									<span class="text-zinc-400">—</span>
								{/if}
							</td>
							<td class="px-3 py-2 text-xs text-zinc-600">{paper.targetPopulation || '—'}</td>
						</tr>

						<!-- Expanded row -->
						{#if expandedRow === paper.id}
							<tr class="bg-zinc-50">
								<td colspan="9" class="px-4 py-4">
									<div class="grid gap-4 sm:grid-cols-2">
										<div>
											<h4 class="text-xs font-semibold text-zinc-500 uppercase mb-1">Summary</h4>
											<p class="text-sm text-zinc-700">{paper.summary || 'No summary available'}</p>
										</div>
										<div>
											<h4 class="text-xs font-semibold text-zinc-500 uppercase mb-1">Keywords</h4>
											<div class="flex flex-wrap gap-1">
												{#each paper.keywords as kw}
													<Badge variant="outline" class="text-xs">{kw}</Badge>
												{/each}
											</div>
										</div>
										{#if Object.keys(paper.tags).length > 0}
											<div class="sm:col-span-2">
												<h4 class="text-xs font-semibold text-zinc-500 uppercase mb-1">Analysis Tags</h4>
												<div class="flex flex-wrap gap-2">
													{#each Object.entries(paper.tags) as [dim, value]}
														<span class="text-xs">
															<span class="font-medium text-zinc-500">{dim}:</span>
															<Badge variant="secondary" class="ml-1">{value}</Badge>
														</span>
													{/each}
												</div>
											</div>
										{/if}
										<div>
											<a href="/papers/{paper.id}" class="text-sm font-medium text-zinc-900 hover:underline">
												View full details →
											</a>
										</div>
									</div>
								</td>
							</tr>
						{/if}
					{/each}
				</tbody>
			</table>
		</div>

		<!-- Pagination -->
		<div class="flex items-center justify-between">
			<p class="text-sm text-zinc-500">
				Showing {(currentPage - 1) * limit + 1}–{Math.min(currentPage * limit, total)} of {total} papers
			</p>
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					disabled={currentPage <= 1}
					onclick={() => { currentPage--; loadData(); }}
				>
					<ChevronLeft class="h-4 w-4" />
				</Button>
				<span class="text-sm text-zinc-600">Page {currentPage} of {totalPages}</span>
				<Button
					variant="outline"
					size="sm"
					disabled={currentPage >= totalPages}
					onclick={() => { currentPage++; loadData(); }}
				>
					<ChevronRight class="h-4 w-4" />
				</Button>
			</div>
		</div>
	{/if}
</div>
