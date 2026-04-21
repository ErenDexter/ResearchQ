<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import { Users, ChevronLeft, ChevronRight } from 'lucide-svelte';

	let authorData = $state<any>({ authors: [], total: 0, page: 1, limit: 50 });
	let loading = $state(true);
	let currentPage = $state(1);
	let searchQuery = $state('');

	async function loadAuthors() {
		loading = true;
		const params = new URLSearchParams({
			page: String(currentPage),
			limit: '50'
		});
		if (searchQuery) params.set('search', searchQuery);

		const res = await fetch(`/api/authors?${params.toString()}`);
		if (res.ok) {
			authorData = await res.json();
		}
		loading = false;
	}

	$effect(() => {
		loadAuthors();
	});

	const totalPages = $derived(Math.ceil(authorData.total / authorData.limit) || 1);
</script>

<div class="space-y-6">
	<div>
		<h1 class="text-2xl font-bold text-zinc-900">Authors</h1>
		<p class="mt-1 text-sm text-zinc-500">{authorData.total} authors discovered</p>
	</div>

	{#if loading}
		<p class="py-12 text-center text-sm text-zinc-500">Loading...</p>
	{:else if authorData.authors.length === 0}
		<Card class="py-12 text-center">
			<Users class="mx-auto mb-3 h-10 w-10 text-zinc-300" />
			<p class="text-sm text-zinc-500">No authors discovered yet.</p>
		</Card>
	{:else}
		<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
			{#each authorData.authors as author}
				<Card class="p-4">
					<div class="space-y-1.5">
						<h3 class="text-sm font-semibold text-zinc-900">{author.name}</h3>
						{#if author.affiliation}
							<p class="text-xs text-zinc-500">{author.affiliation}</p>
						{/if}
						<div class="flex items-center gap-2">
							<Badge variant="secondary">{author.paperCount} papers</Badge>
							{#if author.orcid}
								<a
									href={author.orcid}
									target="_blank"
									rel="noopener"
									class="text-xs text-blue-600 hover:underline"
								>ORCID</a>
							{/if}
						</div>
					</div>
				</Card>
			{/each}
		</div>

		{#if totalPages > 1}
			<div class="flex items-center justify-between">
				<p class="text-sm text-zinc-500">Page {currentPage} of {totalPages}</p>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" disabled={currentPage <= 1} onclick={() => { currentPage--; loadAuthors(); }}>
						<ChevronLeft class="h-4 w-4" />
					</Button>
					<Button variant="outline" size="sm" disabled={currentPage >= totalPages} onclick={() => { currentPage++; loadAuthors(); }}>
						<ChevronRight class="h-4 w-4" />
					</Button>
				</div>
			</div>
		{/if}
	{/if}
</div>
