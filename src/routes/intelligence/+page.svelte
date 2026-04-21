<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { Brain, Users, TrendingUp, AlertTriangle, Copy, Loader2, RefreshCw } from 'lucide-svelte';

	let authorData = $state<any>(null);
	let trendData = $state<any>(null);
	let gapData = $state<any>(null);
	let duplicateData = $state<any>(null);
	let loading = $state(true);
	let loadingGaps = $state(false);
	let maxYearCount = $derived(
		trendData?.yearlyPaperCounts?.length
			? Math.max(...trendData.yearlyPaperCounts.map((y: any) => y.count), 1)
			: 1
	);

	function getProjectId(): string {
		if (typeof window === 'undefined') return '';
		return (window as any).__currentProjectId || localStorage.getItem('currentProjectId') || '';
	}

	onMount(async () => {
		const projectId = getProjectId();
		if (!projectId) { loading = false; return; }

		// Load non-LLM sections first (fast)
		const [authRes, trendRes, dupRes] = await Promise.all([
			fetch(`/api/projects/${projectId}/intelligence?section=authors`),
			fetch(`/api/projects/${projectId}/intelligence?section=trends`),
			fetch(`/api/projects/${projectId}/intelligence?section=duplicates`)
		]);

		authorData = await authRes.json();
		trendData = await trendRes.json();
		duplicateData = await dupRes.json();
		loading = false;
	});

	async function loadGapAnalysis() {
		const projectId = getProjectId();
		if (!projectId) return;
		loadingGaps = true;
		const res = await fetch(`/api/projects/${projectId}/intelligence?section=gaps`);
		gapData = await res.json();
		loadingGaps = false;
	}
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-2xl font-bold text-zinc-900">Research Intelligence</h1>
		<p class="mt-1 text-sm text-zinc-500">
			Author networks, trends, gap analysis, and duplicate detection
		</p>
	</div>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-zinc-400" />
		</div>
	{:else}
		<!-- Author Network -->
		{#if authorData}
			<Card class="p-6">
				<div class="flex items-center gap-2 mb-4">
					<Users class="h-5 w-5 text-zinc-500" />
					<h2 class="text-lg font-semibold text-zinc-900">Prolific Authors</h2>
				</div>

				{#if authorData.authors?.length > 0}
					<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{#each authorData.authors.slice(0, 12) as author}
							<div class="rounded-lg border border-zinc-100 p-3">
								<p class="font-medium text-zinc-900 text-sm">{author.name}</p>
								{#if author.affiliation}
									<p class="text-xs text-zinc-500 mt-0.5">{author.affiliation}</p>
								{/if}
								<div class="mt-2 flex items-center gap-2">
									<Badge variant="outline">{author.paperCount} papers</Badge>
								</div>
								{#if author.topKeywords?.length > 0}
									<div class="mt-2 flex flex-wrap gap-1">
										{#each author.topKeywords.slice(0, 3) as kw}
											<Badge variant="secondary" class="text-xs">{kw}</Badge>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-zinc-500">No author data available yet.</p>
				{/if}

				{#if authorData.coAuthorPairs?.length > 0}
					<div class="mt-6">
						<h3 class="text-sm font-semibold text-zinc-700 mb-3">Top Co-Author Pairs</h3>
						<div class="space-y-2">
							{#each authorData.coAuthorPairs.slice(0, 10) as pair}
								<div class="flex items-center gap-2 text-sm">
									<span class="text-zinc-700">{pair.author1}</span>
									<span class="text-zinc-400">&</span>
									<span class="text-zinc-700">{pair.author2}</span>
									<Badge variant="outline" class="ml-auto">{pair.sharedPapers} papers</Badge>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</Card>
		{/if}

		<!-- Trends -->
		{#if trendData}
			<Card class="p-6">
				<div class="flex items-center gap-2 mb-4">
					<TrendingUp class="h-5 w-5 text-zinc-500" />
					<h2 class="text-lg font-semibold text-zinc-900">Research Trends</h2>
				</div>

				{#if trendData.yearlyPaperCounts?.length > 0}
					<div class="mb-6">
						<h3 class="text-sm font-semibold text-zinc-700 mb-3">Papers per Year</h3>
						<div class="space-y-1.5">
							{#each trendData.yearlyPaperCounts as yearData}
								<div class="flex items-center gap-3">
									<span class="w-12 text-right text-xs font-medium text-zinc-600">{yearData.year}</span>
									<div class="flex-1 h-5 rounded bg-zinc-100">
										<div
											class="h-5 rounded bg-zinc-700 flex items-center px-2 text-xs text-white font-medium"
											style="width: {(yearData.count / maxYearCount) * 100}%"
										>
											{yearData.count}
										</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if trendData.keywordTrends?.length > 0}
					<h3 class="text-sm font-semibold text-zinc-700 mb-3">Top Keyword Trends</h3>
					<div class="space-y-2">
						{#each trendData.keywordTrends.slice(0, 8) as trend}
							<div class="flex items-center gap-3">
								<span class="text-sm text-zinc-700 w-40 truncate font-medium">{trend.keyword}</span>
								<div class="flex gap-1 flex-1">
									{#each trend.years as yearEntry}
										<Badge variant="outline" class="text-xs">
											{yearEntry.year}: {yearEntry.count}
										</Badge>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-zinc-500">No trend data available yet.</p>
				{/if}
			</Card>
		{/if}

		<!-- Gap Analysis (LLM-powered, loaded on demand) -->
		<Card class="p-6">
			<div class="flex items-center justify-between mb-4">
				<div class="flex items-center gap-2">
					<AlertTriangle class="h-5 w-5 text-zinc-500" />
					<h2 class="text-lg font-semibold text-zinc-900">Gap Analysis</h2>
				</div>
				{#if !gapData}
					<Button variant="outline" onclick={loadGapAnalysis} disabled={loadingGaps}>
						{#if loadingGaps}
							<Loader2 class="mr-2 h-4 w-4 animate-spin" />
							Analyzing...
						{:else}
							<Brain class="mr-2 h-4 w-4" />
							Run AI Analysis
						{/if}
					</Button>
				{:else}
					<Button variant="ghost" onclick={loadGapAnalysis} disabled={loadingGaps}>
						<RefreshCw class="mr-2 h-4 w-4" />
						Refresh
					</Button>
				{/if}
			</div>

			{#if gapData}
				{#if gapData.gaps?.length > 0}
					<div class="mb-4">
						<h3 class="text-sm font-semibold text-zinc-700 mb-2">Identified Gaps</h3>
						<ul class="space-y-2">
							{#each gapData.gaps as gap}
								<li class="flex items-start gap-2 text-sm text-zinc-600">
									<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
									{gap}
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				{#if gapData.suggestions?.length > 0}
					<div>
						<h3 class="text-sm font-semibold text-zinc-700 mb-2">Suggestions</h3>
						<ul class="space-y-2">
							{#each gapData.suggestions as suggestion}
								<li class="flex items-start gap-2 text-sm text-zinc-600">
									<Brain class="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
									{suggestion}
								</li>
							{/each}
						</ul>
					</div>
				{/if}
			{:else if !loadingGaps}
				<p class="text-sm text-zinc-500">Click "Run AI Analysis" to identify research gaps and get suggestions for expanding your review.</p>
			{/if}
		</Card>

		<!-- Duplicates -->
		{#if duplicateData}
			<Card class="p-6">
				<div class="flex items-center gap-2 mb-4">
					<Copy class="h-5 w-5 text-zinc-500" />
					<h2 class="text-lg font-semibold text-zinc-900">Potential Duplicates</h2>
				</div>

				{#if duplicateData.duplicates?.length > 0}
					<div class="space-y-3">
						{#each duplicateData.duplicates as dup}
							<div class="rounded-lg border border-amber-200 bg-amber-50 p-3">
								<div class="flex items-center justify-between mb-1">
									<Badge variant="warning">{Math.round(dup.similarity * 100)}% similar</Badge>
								</div>
								<p class="text-sm text-zinc-700">
									<a href="/papers/{dup.paper1.id}" class="hover:underline">{dup.paper1.title}</a>
								</p>
								<p class="text-sm text-zinc-500 mt-1">vs.</p>
								<p class="text-sm text-zinc-700">
									<a href="/papers/{dup.paper2.id}" class="hover:underline">{dup.paper2.title}</a>
								</p>
							</div>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-zinc-500">No duplicate papers detected.</p>
				{/if}
			</Card>
		{/if}
	{/if}
</div>
