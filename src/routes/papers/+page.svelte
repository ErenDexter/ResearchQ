<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Select from '$lib/components/ui/Select.svelte';
	import {
		Search,
		ChevronLeft,
		ChevronRight,
		ExternalLink,
		Filter,
		Download,
		Trash2
	} from 'lucide-svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let searchQuery = $state($page.url.searchParams.get('search') || '');
	let yearFilter = $state($page.url.searchParams.get('year') || '');
	let relevantOnly = $state($page.url.searchParams.get('relevant') === 'true');
	let jobIdFilter = $state($page.url.searchParams.get('jobId') || '');
	let currentPage = $state(parseInt($page.url.searchParams.get('page') || '1'));

	let paperData = $state<any>({ papers: [], total: 0, page: 1, limit: 50 });
	let loading = $state(true);

	async function loadPapers() {
		loading = true;
		const params = new URLSearchParams();
		if (searchQuery) params.set('search', searchQuery);
		if (yearFilter) params.set('year', yearFilter);
		if (relevantOnly) params.set('relevant', 'true');
		if (jobIdFilter) params.set('jobId', jobIdFilter);
		params.set('page', String(currentPage));
		params.set('limit', '50');

		const res = await fetch(`/api/papers?${params.toString()}`);
		if (res.ok) {
			paperData = await res.json();
		}
		loading = false;
	}

	$effect(() => {
		loadPapers();
	});

	async function deletePaper(id: string) {
		if (!confirm('Delete this paper?')) return;
		await fetch(`/api/papers/${id}`, { method: 'DELETE' });
		loadPapers();
	}

	function exportCSV() {
		const headers = [
			'Title',
			'DOI',
			'Year',
			'Authors',
			'Region',
			'Platform',
			'Summary',
			'Methodology',
			'Target Population',
			'Keywords'
		];

		const rows = paperData.papers.map((p: any) => [
			`"${(p.title || '').replace(/"/g, '""')}"`,
			p.doi || '',
			p.publicationYear || '',
			`"${(p.authors || []).map((a: any) => a.name).join('; ')}"`,
			p.focusedRegion || '',
			p.platformDomain || '',
			`"${(p.summary || '').replace(/"/g, '""')}"`,
			`"${(p.methodologySummary || '').replace(/"/g, '""')}"`,
			p.targetPopulation || '',
			`"${(p.keywords || []).join('; ')}"`
		]);

		const csv = [headers.join(','), ...rows.map((r: string[]) => r.join(','))].join('\n');
		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'algorithm-auditing-papers.csv';
		a.click();
		URL.revokeObjectURL(url);
	}

	const totalPages = $derived(Math.ceil(paperData.total / paperData.limit) || 1);
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-zinc-900">Papers</h1>
			<p class="mt-1 text-sm text-zinc-500">
				{paperData.total} papers found
			</p>
		</div>
		<Button variant="outline" onclick={exportCSV}>
			<Download class="h-4 w-4" />
			Export CSV
		</Button>
	</div>

	<!-- Filters -->
	<Card class="p-4">
		<div class="flex flex-wrap items-center gap-3">
			<div class="flex-1">
				<Input
					placeholder="Search papers..."
					bind:value={searchQuery}
					onkeydown={(e: KeyboardEvent) => {
						if (e.key === 'Enter') {
							currentPage = 1;
							loadPapers();
						}
					}}
				/>
			</div>
			<Input
				type="number"
				placeholder="Year"
				class="w-24"
				bind:value={yearFilter}
				onchange={() => { currentPage = 1; loadPapers(); }}
			/>
			<label class="flex items-center gap-2 text-sm text-zinc-600">
				<input
					type="checkbox"
					bind:checked={relevantOnly}
					class="rounded"
					onchange={() => { currentPage = 1; loadPapers(); }}
				/>
				Relevant only
			</label>
			<Button variant="outline" size="sm" onclick={() => { searchQuery = ''; yearFilter = ''; relevantOnly = false; jobIdFilter = ''; currentPage = 1; loadPapers(); }}>
				Clear filters
			</Button>
		</div>
	</Card>

	<!-- Papers List -->
	{#if loading}
		<div class="py-12 text-center text-sm text-zinc-500">Loading papers...</div>
	{:else if paperData.papers.length === 0}
		<Card class="py-12 text-center">
			<Search class="mx-auto mb-3 h-10 w-10 text-zinc-300" />
			<p class="text-sm text-zinc-500">No papers match your filters.</p>
		</Card>
	{:else}
		<div class="space-y-3">
			{#each paperData.papers as paper (paper.id)}
				<Card class="p-5 transition-shadow hover:shadow-md">
					<div class="flex items-start justify-between gap-4">
						<div class="flex-1 space-y-2">
							<a href="/papers/{paper.id}" class="text-sm font-semibold text-zinc-900 hover:underline line-clamp-2">
								{paper.title}
							</a>

							{#if paper.authors?.length}
								<p class="text-xs text-zinc-500 line-clamp-1">
									{paper.authors.map((a: any) => a.name).join(', ')}
								</p>
							{/if}

							{#if paper.summary}
								<p class="text-xs text-zinc-600 line-clamp-2">{paper.summary}</p>
							{/if}

							<div class="flex flex-wrap items-center gap-1.5">
								{#if paper.publicationYear}
									<Badge variant="outline">{paper.publicationYear}</Badge>
								{/if}
								{#if paper.isRelevant}
									<Badge variant="success">Relevant</Badge>
								{:else if paper.isRelevant === false}
									<Badge variant="destructive">Not relevant</Badge>
								{/if}
								{#if paper.focusedRegion && paper.focusedRegion !== 'Not specified'}
									<Badge variant="secondary">{paper.focusedRegion}</Badge>
								{/if}
								{#if paper.platformDomain && paper.platformDomain !== 'General AI/ML'}
									<Badge variant="secondary">{paper.platformDomain}</Badge>
								{/if}
								{#each (paper.keywords || []).slice(0, 3) as kw}
									<Badge variant="outline" class="text-xs">{kw}</Badge>
								{/each}
							</div>
						</div>

						<div class="flex flex-shrink-0 items-center gap-1">
							{#if paper.paperUrl || paper.doi}
								<a
									href={paper.paperUrl || `https://doi.org/${paper.doi}`}
									target="_blank"
									rel="noopener"
									class="rounded p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
								>
									<ExternalLink class="h-4 w-4" />
								</a>
							{/if}
							<button
								class="rounded p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"
								onclick={() => deletePaper(paper.id)}
							>
								<Trash2 class="h-4 w-4" />
							</button>
						</div>
					</div>
				</Card>
			{/each}
		</div>

		<!-- Pagination -->
		{#if totalPages > 1}
			<div class="flex items-center justify-between">
				<p class="text-sm text-zinc-500">
					Page {currentPage} of {totalPages}
				</p>
				<div class="flex gap-2">
					<Button
						variant="outline"
						size="sm"
						disabled={currentPage <= 1}
						onclick={() => { currentPage--; loadPapers(); }}
					>
						<ChevronLeft class="h-4 w-4" />
						Previous
					</Button>
					<Button
						variant="outline"
						size="sm"
						disabled={currentPage >= totalPages}
						onclick={() => { currentPage++; loadPapers(); }}
					>
						Next
						<ChevronRight class="h-4 w-4" />
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</div>
