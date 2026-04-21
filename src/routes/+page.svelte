<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { FileText, BookOpen, Users, Tag, TrendingUp, ArrowRight, Search } from 'lucide-svelte';

	let { data } = $props();

	const statCards = $derived([
		{ label: 'Total Papers', value: data.stats.totalPapers, icon: FileText, color: 'bg-blue-50 text-blue-700' },
		{ label: 'Relevant Papers', value: data.stats.relevantPapers, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-700' },
		{ label: 'Journals', value: data.stats.totalJournals, icon: BookOpen, color: 'bg-purple-50 text-purple-700' },
		{ label: 'Authors', value: data.stats.totalAuthors, icon: Users, color: 'bg-amber-50 text-amber-700' },
		{ label: 'Keywords', value: data.stats.totalKeywords, icon: Tag, color: 'bg-rose-50 text-rose-700' }
	]);

	const maxYearCount = $derived(Math.max(...(data.byYear || []).map((y: { count: number }) => y.count), 1));
</script>

<div class="space-y-8">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-zinc-900">Dashboard</h1>
			<p class="mt-1 text-sm text-zinc-500">
				Overview of your research literature review
			</p>
		</div>
		<a href="/search">
			<Button>
				<Search class="h-4 w-4" />
				New Search
			</Button>
		</a>
	</div>

	<!-- Stats Grid -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
		{#each statCards as stat}
			<Card class="p-5">
				<div class="flex items-center justify-between">
					<div>
						<p class="text-sm font-medium text-zinc-500">{stat.label}</p>
						<p class="mt-1 text-2xl font-bold text-zinc-900">{stat.value}</p>
					</div>
					<div class="rounded-lg p-2.5 {stat.color}">
						<stat.icon class="h-5 w-5" />
					</div>
				</div>
			</Card>
		{/each}
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<!-- Recent Jobs -->
		<Card class="p-6">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold text-zinc-900">Recent Jobs</h2>
				<a href="/jobs" class="text-sm text-zinc-500 hover:text-zinc-900">View all <ArrowRight class="inline h-3 w-3" /></a>
			</div>
			{#if data.recentJobs.length === 0}
				<div class="flex flex-col items-center justify-center py-8 text-center">
					<Search class="mb-3 h-10 w-10 text-zinc-300" />
					<p class="text-sm text-zinc-500">No search jobs yet.</p>
					<a href="/search" class="mt-2 text-sm font-medium text-zinc-900 hover:underline">Start your first search</a>
				</div>
			{:else}
				<div class="space-y-3">
					{#each data.recentJobs as job}
						<div class="flex items-center justify-between rounded-lg border border-zinc-100 px-4 py-3">
							<div>
								<p class="text-sm font-medium text-zinc-900">{job.query}</p>
								<p class="text-xs text-zinc-500">
									<Badge variant={job.type === 'journal' ? 'secondary' : 'outline'} class="mr-1">{job.type}</Badge>
									{job.totalFound} found · {job.relevantCount} relevant
								</p>
							</div>
							<Badge
								variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'destructive' : 'warning'}
							>
								{job.status}
							</Badge>
						</div>
					{/each}
				</div>
			{/if}
		</Card>

		<!-- Year Distribution -->
		<Card class="p-6">
			<h2 class="mb-4 text-lg font-semibold text-zinc-900">Papers by Year</h2>
			{#if data.byYear.length === 0}
				<div class="flex flex-col items-center justify-center py-8 text-center">
					<TrendingUp class="mb-3 h-10 w-10 text-zinc-300" />
					<p class="text-sm text-zinc-500">No paper data yet.</p>
				</div>
			{:else}
				<div class="space-y-2">
					{#each data.byYear as yearData}
						<div class="flex items-center gap-3">
							<span class="w-12 text-right text-sm font-medium text-zinc-600">{yearData.year}</span>
							<div class="flex-1">
								<div class="h-6 rounded bg-zinc-100">
									<div
										class="flex h-6 items-center rounded bg-zinc-800 px-2 text-xs font-medium text-white transition-all"
										style="width: {(yearData.count / maxYearCount) * 100}%"
									>
										{yearData.count}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</Card>
	</div>

	<!-- Recent Relevant Papers -->
	<Card class="p-6">
		<div class="mb-4 flex items-center justify-between">
			<h2 class="text-lg font-semibold text-zinc-900">Recent Relevant Papers</h2>
			<a href="/papers?relevant=true" class="text-sm text-zinc-500 hover:text-zinc-900">View all <ArrowRight class="inline h-3 w-3" /></a>
		</div>
		{#if data.recentPapers.length === 0}
			<p class="py-4 text-center text-sm text-zinc-500">No relevant papers discovered yet.</p>
		{:else}
			<div class="divide-y divide-zinc-100">
				{#each data.recentPapers as paper}
					<a href="/papers/{paper.id}" class="block py-3 transition-colors hover:bg-zinc-50 -mx-2 px-2 rounded">
						<p class="text-sm font-medium text-zinc-900 line-clamp-1">{paper.title}</p>
						<div class="mt-1 flex items-center gap-2">
							{#if paper.publicationYear}
								<Badge variant="outline">{paper.publicationYear}</Badge>
							{/if}
							{#if paper.focusedRegion}
								<Badge variant="secondary">{paper.focusedRegion}</Badge>
							{/if}
							{#if paper.platformDomain}
								<Badge variant="secondary">{paper.platformDomain}</Badge>
							{/if}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</Card>
</div>
