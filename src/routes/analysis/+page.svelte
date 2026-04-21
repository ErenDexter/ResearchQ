<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { BarChart3, Globe, Clock, Target, Users, Lightbulb, Wrench, Monitor, Hash } from 'lucide-svelte';

	let analysis = $state<any>(null);
	let loading = $state(true);

	function getProjectId(): string {
		if (typeof window === 'undefined') return '';
		return (window as any).__currentProjectId || localStorage.getItem('currentProjectId') || '';
	}

	async function loadAnalysis() {
		loading = true;
		const projectId = getProjectId();
		const url = projectId ? `/api/analysis?projectId=${projectId}` : '/api/analysis';
		const res = await fetch(url);
		if (res.ok) {
			analysis = await res.json();
		}
		loading = false;
	}

	$effect(() => {
		loadAnalysis();
	});

	function getTagsByDimension(dimension: string): { value: string; count: number }[] {
		if (!analysis?.tagDistribution) return [];
		return analysis.tagDistribution
			.filter((t: any) => t.dimension === dimension)
			.slice(0, 10);
	}

	let maxYear = $derived(analysis?.byYear?.length ? Math.max(...analysis.byYear.map((y: any) => y.count)) : 1);
	let maxRegion = $derived(analysis?.byRegion?.length ? Math.max(...analysis.byRegion.map((r: any) => r.count)) : 1);
	let maxPlatform = $derived(analysis?.byPlatform?.length ? Math.max(...analysis.byPlatform.map((p: any) => p.count)) : 1);

	// Fallback icon mapping for dynamic dimensions
	const iconMap: Record<string, any> = {
		when: Clock, where: Globe, who: Users, what: Target,
		why: Lightbulb, how: Wrench, platform: Monitor
	};

	// Dynamic dimensions from project, falling back to hardcoded for backward compat
	let dimensionConfig = $derived(
		analysis?.dimensions?.length > 0
			? analysis.dimensions.map((d: any) => ({
					key: d.name,
					label: d.label,
					description: d.description || '',
					icon: iconMap[d.name] || Hash
				}))
			: [
					{ key: 'when', label: 'Timeline', icon: Clock, description: 'Publication timeline' },
					{ key: 'where', label: 'Geography', icon: Globe, description: 'Geographic focus' },
					{ key: 'who', label: 'Population', icon: Users, description: 'Target populations' },
					{ key: 'what', label: 'Challenges', icon: Target, description: 'Key challenges and themes' },
					{ key: 'why', label: 'Motivation', icon: Lightbulb, description: 'Research goals' },
					{ key: 'how', label: 'Methods', icon: Wrench, description: 'Technologies and methods' },
					{ key: 'platform', label: 'Platform/Domain', icon: Monitor, description: 'Platform or domain context' }
				]
	);
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-2xl font-bold text-zinc-900">Analysis</h1>
		<p class="mt-1 text-sm text-zinc-500">
			Systematic review analysis based on the project's analysis framework
		</p>
	</div>

	{#if loading}
		<p class="py-12 text-center text-sm text-zinc-500">Loading analysis...</p>
	{:else if !analysis}
		<Card class="py-12 text-center">
			<BarChart3 class="mx-auto mb-3 h-10 w-10 text-zinc-300" />
			<p class="text-sm text-zinc-500">No analysis data available yet.</p>
		</Card>
	{:else}
		<!-- Overview Stats -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
			<Card class="p-5 text-center">
				<p class="text-3xl font-bold text-zinc-900">{analysis.totalPapers}</p>
				<p class="text-sm text-zinc-500">Total Papers</p>
			</Card>
			<Card class="p-5 text-center">
				<p class="text-3xl font-bold text-emerald-700">{analysis.relevantPapers}</p>
				<p class="text-sm text-zinc-500">Relevant Papers</p>
			</Card>
			<Card class="p-5 text-center">
				<p class="text-3xl font-bold text-zinc-700">
					{analysis.totalPapers > 0
						? Math.round((analysis.relevantPapers / analysis.totalPapers) * 100)
						: 0}%
				</p>
				<p class="text-sm text-zinc-500">Relevance Rate</p>
			</Card>
		</div>

		<!-- Year Distribution -->
		{#if analysis.byYear.length > 0}
			<Card class="p-6">
				<h2 class="mb-4 text-lg font-semibold text-zinc-900">Papers by Year</h2>
				<div class="space-y-2">
					{#each analysis.byYear as yearData}
						<div class="flex items-center gap-3">
							<span class="w-12 text-right text-sm font-medium text-zinc-600">{yearData.year}</span>
							<div class="flex-1">
								<div class="h-7 rounded bg-zinc-100">
									<div
										class="flex h-7 items-center rounded bg-zinc-800 px-2 text-xs font-medium text-white transition-all"
										style="width: {Math.max((yearData.count / maxYear) * 100, 5)}%"
									>
										{yearData.count}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{/if}

		<!-- Region & Platform Distribution -->
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			{#if analysis.byRegion.length > 0}
				<Card class="p-6">
					<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900">
						<Globe class="h-5 w-5" />
						Geographic Distribution
					</h2>
					<div class="space-y-2">
						{#each analysis.byRegion as region}
							<div class="flex items-center justify-between gap-3">
								<span class="text-sm text-zinc-700 truncate flex-1">{region.region}</span>
								<div class="flex items-center gap-2">
									<div class="h-5 w-32 rounded bg-zinc-100">
										<div
											class="h-5 rounded bg-blue-600 transition-all"
											style="width: {(region.count / maxRegion) * 100}%"
										></div>
									</div>
									<span class="w-8 text-right text-xs font-medium text-zinc-600">{region.count}</span>
								</div>
							</div>
						{/each}
					</div>
				</Card>
			{/if}

			{#if analysis.byPlatform.length > 0}
				<Card class="p-6">
					<h2 class="mb-4 flex items-center gap-2 text-lg font-semibold text-zinc-900">
						<Monitor class="h-5 w-5" />
						Platform/Domain Distribution
					</h2>
					<div class="space-y-2">
						{#each analysis.byPlatform as platform}
							<div class="flex items-center justify-between gap-3">
								<span class="text-sm text-zinc-700 truncate flex-1">{platform.platform}</span>
								<div class="flex items-center gap-2">
									<div class="h-5 w-32 rounded bg-zinc-100">
										<div
											class="h-5 rounded bg-purple-600 transition-all"
											style="width: {(platform.count / maxPlatform) * 100}%"
										></div>
									</div>
									<span class="w-8 text-right text-xs font-medium text-zinc-600">{platform.count}</span>
								</div>
							</div>
						{/each}
					</div>
				</Card>
			{/if}
		</div>

		<!-- Dynamic Analysis Framework Dimensions -->
		<h2 class="text-lg font-semibold text-zinc-900">Analysis Framework Breakdown</h2>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			{#each dimensionConfig as dim}
				{@const tags = getTagsByDimension(dim.key)}
				{#if tags.length > 0}
					<Card class="p-5">
						<h3 class="mb-1 flex items-center gap-2 text-sm font-semibold text-zinc-900">
							<dim.icon class="h-4 w-4" />
							{dim.label}
						</h3>
						<p class="mb-3 text-xs text-zinc-500">{dim.description}</p>
						<div class="flex flex-wrap gap-1.5">
							{#each tags as tag}
								<Badge variant="secondary" class="text-xs">
									{tag.value}
									<span class="ml-1 opacity-60">({tag.count})</span>
								</Badge>
							{/each}
						</div>
					</Card>
				{/if}
			{/each}
		</div>
	{/if}
</div>
