<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Progress from '$lib/components/ui/Progress.svelte';
	import {
		Search, BookOpen, Users, Loader2, CheckCircle2, XCircle, AlertCircle,
		Compass, GitFork, Link2, Zap, Database, RefreshCw
	} from 'lucide-svelte';

	type SearchType = 'journal' | 'author' | 'topic' | 'citation_forward' | 'citation_backward' | 'related' | 'database';

	let searchType = $state<SearchType>('journal');
	let query = $state('');
	let maxResults = $state('200');
	let dateFrom = $state('');
	let dateTo = $state('');
	let skipRelevanceFilter = $state(false);
	let isLoading = $state(false);
	let activeJob = $state<any>(null);
	let pollInterval = $state<ReturnType<typeof setInterval> | null>(null);
	let recentJobs = $state<any[]>([]);

	function getProjectId(): string {
		if (typeof window === 'undefined') return '';
		return (window as any).__currentProjectId || localStorage.getItem('currentProjectId') || '';
	}

	const searchStrategies = [
		{ type: 'journal' as const, label: 'Journal', icon: BookOpen, description: 'Search papers from a specific journal or venue' },
		{ type: 'author' as const, label: 'Author', icon: Users, description: 'Get all papers by an author (AI filters for relevance)' },
		{ type: 'topic' as const, label: 'Topic', icon: Compass, description: 'Search by keywords across all venues and authors' },
		{ type: 'citation_forward' as const, label: 'Cited By', icon: GitFork, description: 'Find papers that cite a specific paper (OpenAlex ID)' },
		{ type: 'citation_backward' as const, label: 'References', icon: Link2, description: 'Find papers cited by a specific paper (OpenAlex ID)' },
		// { type: 'related' as const, label: 'Related', icon: Zap, description: 'Find related works for a paper (OpenAlex ID)' },
		{ type: 'database' as const, label: 'Database', icon: Database, description: 'Search papers from a publisher/database (IEEE, ACM, Springer, etc.)' },
	];

	const queryLabels: Record<SearchType, string> = {
		journal: 'Journal Name',
		author: 'Author Name',
		topic: 'Search Query',
		citation_forward: 'OpenAlex Work ID',
		citation_backward: 'OpenAlex Work ID',
		related: 'OpenAlex Work ID',
		database: 'Publisher / Database Name'
	};

	const queryPlaceholders: Record<SearchType, string> = {
		journal: 'e.g., Nature Machine Intelligence',
		author: 'e.g., Timnit Gebru',
		topic: 'e.g., algorithmic fairness in hiring',
		citation_forward: 'e.g., W2741809807',
		citation_backward: 'e.g., W2741809807',
		related: 'e.g., W2741809807',
		database: 'e.g., IEEE, ACM, Springer Nature, Elsevier'
	};

	async function loadRecentJobs() {
		const projectId = getProjectId();
		const url = projectId ? `/api/jobs?projectId=${projectId}` : '/api/jobs';
		const res = await fetch(url);
		if (res.ok) {
			recentJobs = await res.json();
		}
	}

	$effect(() => {
		loadRecentJobs();
	});

	async function startSearch() {
		if (!query.trim()) return;
		isLoading = true;

		try {
			const res = await fetch('/api/jobs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: searchType,
					query: query.trim(),
					projectId: getProjectId(),
					...(searchType === 'database' ? { maxResults: Number(maxResults) } : {}),
					...(dateFrom ? { dateFrom } : {}),
					...(dateTo ? { dateTo } : {}),
					skipRelevanceFilter
				})
			});

			if (!res.ok) {
				const err = await res.json();
				alert(err.error || 'Failed to start search');
				return;
			}

			activeJob = await res.json();
			startPolling(activeJob.id);
		} catch (err) {
			alert('Network error. Please try again.');
		} finally {
			isLoading = false;
		}
	}

	function startPolling(jobId: string) {
		if (pollInterval) clearInterval(pollInterval);

		pollInterval = setInterval(async () => {
			try {
				const res = await fetch(`/api/jobs/${jobId}`);
				if (res.ok) {
					activeJob = await res.json();
					if (activeJob.status === 'completed' || activeJob.status === 'failed') {
						if (pollInterval) clearInterval(pollInterval);
						pollInterval = null;
						loadRecentJobs();
					}
				}
			} catch {
				// ignore polling errors
			}
		}, 2000);
	}

	const statusMessages: Record<string, string> = {
		pending: 'Waiting to start...',
		queued: 'Queued, waiting for other jobs to finish...',
		searching: 'Searching OpenAlex for papers...',
		filtering: 'AI is filtering for relevance...',
		extracting: 'AI is extracting metadata from relevant papers...',
		keyword_filtering: 'AI is evaluating extracted keywords for relevance...',
		completed: 'Search completed successfully!',
		failed: 'Search failed.'
	};

	const typeIcons: Record<string, any> = {
		journal: BookOpen,
		author: Users,
		topic: Compass,
		citation_forward: GitFork,
		citation_backward: Link2,
		related: Zap,
		database: Database
	};
</script>

<div class="space-y-8">
	<!-- Header -->
	<div>
		<h1 class="text-2xl font-bold text-zinc-900">Search</h1>
		<p class="mt-1 text-sm text-zinc-500">
			Discover research papers using multiple search strategies
		</p>
	</div>

	<!-- Search Form -->
	<Card class="p-6">
		<div class="space-y-5">
			<!-- Search strategy selector -->
			<div>
				<label class="mb-2 block text-sm font-medium text-zinc-700">Search Strategy</label>
				<div class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
					{#each searchStrategies as strategy}
						<button
							class="flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-center transition-colors {searchType === strategy.type
								? 'border-zinc-900 bg-zinc-900 text-white'
								: 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'}"
							onclick={() => { searchType = strategy.type; query = ''; }}
							title={strategy.description}
						>
							<strategy.icon class="h-4 w-4" />
							<span class="text-xs font-medium">{strategy.label}</span>
						</button>
					{/each}
				</div>
				<p class="mt-2 text-xs text-zinc-400">
					{searchStrategies.find((s) => s.type === searchType)?.description}
				</p>
			</div>

			<!-- Query input -->
			<div>
				<label for="query" class="mb-2 block text-sm font-medium text-zinc-700">
					{queryLabels[searchType]}
				</label>
				<div class="flex gap-3">
					<Input
						id="query"
						type="text"
						placeholder={queryPlaceholders[searchType]}
						bind:value={query}
						class="flex-1"
						onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && startSearch()}
					/>
					<Button onclick={startSearch} disabled={isLoading || !query.trim()}>
						{#if isLoading}
							<Loader2 class="h-4 w-4 animate-spin" />
						{:else}
							<Search class="h-4 w-4" />
						{/if}
						Search
					</Button>
				</div>
				<p class="mt-2 text-xs text-zinc-400">
					{#if searchType === 'author'}
						Fetches ALL papers by this author, then uses AI to filter for relevance to your project.
					{:else if searchType === 'topic'}
						Searches OpenAlex using your project's keywords. No journal or author constraint.
					{:else if searchType === 'citation_forward' || searchType === 'citation_backward' || searchType === 'related'}
						Enter an OpenAlex Work ID (e.g., W2741809807) or full URL.
					{:else if searchType === 'database'}
						Searches papers published by this database/publisher using your project's keywords.
						Automatically resumes from where you left off on subsequent searches.
					{:else}
						Searches papers in the specified journal using your project's keywords.
					{/if}
				</p>
			</div>

			<!-- Date range filter -->
			<div>
				<label class="mb-2 block text-sm font-medium text-zinc-700">
					Publication Date Range <span class="font-normal text-zinc-400">(optional)</span>
				</label>
				<div class="flex items-center gap-3">
					<Input
						id="dateFrom"
						type="date"
						bind:value={dateFrom}
						class="w-44"
					/>
					<span class="text-sm text-zinc-400">to</span>
					<Input
						id="dateTo"
						type="date"
						bind:value={dateTo}
						class="w-44"
					/>
					{#if dateFrom || dateTo}
						<button
							class="text-xs text-zinc-400 hover:text-zinc-600"
							onclick={() => { dateFrom = ''; dateTo = ''; }}
						>
							Clear
						</button>
					{/if}
				</div>
				<p class="mt-1 text-xs text-zinc-400">
					Only fetch papers published within this date range. Leave empty to search all dates.
				</p>
			</div>

			<!-- Relevance filter toggle -->
			<div>
				<label class="flex items-start gap-2 cursor-pointer">
					<input
						type="checkbox"
						bind:checked={skipRelevanceFilter}
						class="mt-0.5 h-4 w-4 rounded border-zinc-300"
					/>
					<div>
						<span class="block text-sm font-medium text-zinc-700">
							Skip AI relevance filtering
						</span>
						<span class="block text-xs text-zinc-400">
							When checked, all fetched papers are kept (no LLM screening). Use this when you want to review every paper yourself, or when the AI is too aggressive at filtering.
						</span>
					</div>
				</label>
			</div>

			<!-- Max results (database strategy) -->
			{#if searchType === 'database'}
				<div>
					<label for="maxResults" class="mb-2 block text-sm font-medium text-zinc-700">
						Maximum Papers
					</label>
					<Input
						id="maxResults"
						type="number"
						min="50"
						max="10000"
						step="50"
						bind:value={maxResults}
						class="w-40"
					/>
					<p class="mt-1 text-xs text-zinc-400">
						Publishers can have millions of papers. Set a cap per search batch (50–10,000).
						Search again to fetch the next batch — it automatically picks up where you left off.
					</p>
				</div>
			{/if}
		</div>
	</Card>

	<!-- Active Job Status -->
	{#if activeJob}
		<Card class="p-6">
			<h2 class="mb-4 text-lg font-semibold text-zinc-900">
				{activeJob.status === 'completed' || activeJob.status === 'failed'
					? 'Search Result'
					: 'Search in Progress'}
			</h2>

			<div class="space-y-4">
				<div class="flex items-center gap-3">
					{#if activeJob.status === 'completed'}
						<CheckCircle2 class="h-5 w-5 text-emerald-600" />
					{:else if activeJob.status === 'failed'}
						<XCircle class="h-5 w-5 text-red-600" />
					{:else}
						<Loader2 class="h-5 w-5 animate-spin text-amber-600" />
					{/if}
					<div class="flex-1 min-w-0">
						<p class="text-sm font-medium text-zinc-900">
							{activeJob.statusMessage || statusMessages[activeJob.status] || activeJob.status}
						</p>
						<p class="text-xs text-zinc-500">
							<Badge variant="outline" class="mr-1">{activeJob.type}</Badge>
							{activeJob.query}
						</p>
					</div>
				</div>

				<Progress value={activeJob.progressPct || 0} />

				<div class="flex gap-6 text-sm text-zinc-600">
					<span>Papers found: <strong>{activeJob.totalFound || 0}</strong></span>
					<span>Relevant: <strong>{activeJob.relevantCount || 0}</strong></span>
					<span>Progress: <strong>{Math.round(activeJob.progressPct || 0)}%</strong></span>
				</div>

				{#if activeJob.error}
					<div class="flex items-start gap-2 rounded-lg bg-red-50 p-3">
						<AlertCircle class="mt-0.5 h-4 w-4 text-red-600" />
						<p class="text-sm text-red-700">{activeJob.error}</p>
					</div>
				{/if}

				{#if activeJob.status === 'completed'}
					<div class="flex gap-3">
						<a href="/papers?jobId={activeJob.id}&relevant=true">
							<Button variant="outline">View Relevant Papers</Button>
						</a>
						<a href="/papers?jobId={activeJob.id}">
							<Button variant="ghost">View All Results</Button>
						</a>
					</div>
				{:else if activeJob.status === 'failed'}
					<Button variant="outline" onclick={async () => {
						const res = await fetch(`/api/jobs/${activeJob.id}`, { method: 'POST' });
						if (res.ok) {
							activeJob = await res.json();
							startPolling(activeJob.id);
						}
					}}>
						<RefreshCw class="mr-2 h-4 w-4" />
						Retry (resumes from checkpoint)
					</Button>
				{/if}
			</div>
		</Card>
	{/if}

	<!-- Recent Searches -->
	{#if recentJobs.length > 0}
		<Card class="p-6">
			<h2 class="mb-4 text-lg font-semibold text-zinc-900">Previous Searches</h2>
			<div class="divide-y divide-zinc-100">
				{#each recentJobs as job}
					{@const TypeIcon = typeIcons[job.type] || Search}
					<div class="flex items-center justify-between py-3">
						<div class="flex items-center gap-3">
							<TypeIcon class="h-4 w-4 text-zinc-400" />
							<div>
								<p class="text-sm font-medium text-zinc-900">{job.query}</p>
								<p class="text-xs text-zinc-500">
									<Badge variant="outline" class="mr-1">{job.type}</Badge>
									{job.totalFound} found · {job.relevantCount} relevant · {new Date(job.createdAt).toLocaleDateString()}
								</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<Badge
								variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'destructive' : 'warning'}
							>
								{job.status}
							</Badge>
							{#if job.status === 'completed'}
								<a href="/papers?jobId={job.id}&relevant=true">
									<Button variant="ghost" size="sm">View</Button>
								</a>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</Card>
	{/if}
</div>
