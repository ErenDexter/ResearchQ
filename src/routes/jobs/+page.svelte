<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Progress from '$lib/components/ui/Progress.svelte';
	import { Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-svelte';

	let jobs = $state<any[]>([]);
	let loading = $state(true);

	async function loadJobs() {
		loading = true;
		const res = await fetch('/api/jobs');
		if (res.ok) {
			jobs = await res.json();
		}
		loading = false;
	}

	$effect(() => {
		loadJobs();
	});

	function getStatusVariant(status: string): 'success' | 'destructive' | 'warning' | 'secondary' {
		switch (status) {
			case 'completed': return 'success';
			case 'failed': return 'destructive';
			case 'pending': return 'secondary';
			default: return 'warning';
		}
	}
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-zinc-900">Job History</h1>
		<p class="mt-1 text-sm text-zinc-500">All search jobs and their status</p>
	</div>

	{#if loading}
		<p class="py-12 text-center text-sm text-zinc-500">Loading...</p>
	{:else if jobs.length === 0}
		<Card class="py-12 text-center">
			<Clock class="mx-auto mb-3 h-10 w-10 text-zinc-300" />
			<p class="text-sm text-zinc-500">No search jobs yet.</p>
			<a href="/search" class="mt-2 inline-block text-sm font-medium text-zinc-900 hover:underline">Start a search</a>
		</Card>
	{:else}
		<div class="space-y-3">
			{#each jobs as job}
				<Card class="p-5">
					<div class="flex items-start justify-between">
						<div class="flex-1 space-y-2">
							<div class="flex items-center gap-2">
								<h3 class="text-sm font-semibold text-zinc-900">{job.query}</h3>
								<Badge variant="outline">{job.type}</Badge>
								<Badge variant={getStatusVariant(job.status)}>{job.status}</Badge>
							</div>

							<div class="flex gap-6 text-xs text-zinc-500">
								<span>Found: <strong class="text-zinc-700">{job.totalFound || 0}</strong></span>
								<span>Relevant: <strong class="text-zinc-700">{job.relevantCount || 0}</strong></span>
								<span>Started: {new Date(job.createdAt).toLocaleString()}</span>
								{#if job.completedAt}
									<span>Completed: {new Date(job.completedAt).toLocaleString()}</span>
								{/if}
							</div>

							{#if job.status !== 'completed' && job.status !== 'failed'}
								<Progress value={job.progressPct || 0} />
							{/if}

							{#if job.error}
								<p class="text-xs text-red-600">{job.error}</p>
							{/if}
						</div>

						{#if job.status === 'completed'}
							<a
								href="/papers?jobId={job.id}&relevant=true"
								class="ml-4 text-sm font-medium text-zinc-600 hover:text-zinc-900"
							>
								View papers →
							</a>
						{/if}
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>
