<script lang="ts">
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import {
		ArrowLeft,
		ExternalLink,
		Calendar,
		MapPin,
		Users,
		Tag,
		Microscope,
		Target,
		Globe,
		Save
	} from 'lucide-svelte';
	import { page } from '$app/stores';

	let paper = $state<any>(null);
	let loading = $state(true);
	let editing = $state(false);
	let editForm = $state<any>({});

	async function loadPaper() {
		loading = true;
		const res = await fetch(`/api/papers/${$page.params.id}`);
		if (res.ok) {
			paper = await res.json();
			editForm = {
				summary: paper.summary || '',
				methodologySummary: paper.methodologySummary || '',
				targetPopulation: paper.targetPopulation || '',
				focusedRegion: paper.focusedRegion || '',
				platformDomain: paper.platformDomain || ''
			};
		}
		loading = false;
	}

	$effect(() => {
		loadPaper();
	});

	async function savePaper() {
		const res = await fetch(`/api/papers/${paper.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(editForm)
		});
		if (res.ok) {
			paper = { ...paper, ...editForm };
			editing = false;
		}
	}
</script>

<div class="space-y-6">
	<!-- Back button -->
	<a
		href="/papers"
		class="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-900"
	>
		<ArrowLeft class="h-4 w-4" />
		Back to papers
	</a>

	{#if loading}
		<p class="py-12 text-center text-sm text-zinc-500">Loading...</p>
	{:else if !paper}
		<p class="py-12 text-center text-sm text-zinc-500">Paper not found.</p>
	{:else}
		<!-- Title -->
		<div>
			<h1 class="text-xl font-bold text-zinc-900 leading-tight">{paper.title}</h1>
			<div class="mt-3 flex flex-wrap items-center gap-2">
				{#if paper.publicationYear}
					<Badge variant="outline">
						<Calendar class="mr-1 h-3 w-3" />
						{paper.publicationYear}
					</Badge>
				{/if}
				{#if paper.isRelevant}
					<Badge variant="success">Relevant</Badge>
				{:else if paper.isRelevant === false}
					<Badge variant="destructive">Not relevant</Badge>
				{/if}
				{#if paper.doi}
					<a
						href="https://doi.org/{paper.doi}"
						target="_blank"
						rel="noopener"
						class="text-xs text-blue-600 hover:underline"
					>
						DOI: {paper.doi}
					</a>
				{/if}
				{#if paper.paperUrl}
					<a
						href={paper.paperUrl}
						target="_blank"
						rel="noopener"
						class="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
					>
						<ExternalLink class="h-3 w-3" />
						Open paper
					</a>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			<!-- Main content -->
			<div class="space-y-6 lg:col-span-2">
				<!-- Authors -->
				{#if paper.authors?.length}
					<Card class="p-5">
						<h2 class="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
							<Users class="h-4 w-4" />
							Authors
						</h2>
						<div class="space-y-2">
							{#each paper.authors as author}
								<div class="flex items-center justify-between">
									<div>
										<p class="text-sm font-medium text-zinc-900">{author.name}</p>
										{#if author.affiliation}
											<p class="text-xs text-zinc-500">{author.affiliation}</p>
										{/if}
									</div>
									{#if author.orcid}
										<a
											href={author.orcid}
											target="_blank"
											rel="noopener"
											class="text-xs text-blue-600 hover:underline"
										>ORCID</a>
									{/if}
								</div>
							{/each}
						</div>
					</Card>
				{/if}

				<!-- Abstract -->
				{#if paper.abstract}
					<Card class="p-5">
						<h2 class="mb-3 text-sm font-semibold text-zinc-900">Abstract</h2>
						<p class="text-sm leading-relaxed text-zinc-700">{paper.abstract}</p>
					</Card>
				{/if}

				<!-- AI Summary & Methodology -->
				<Card class="p-5">
					<div class="flex items-center justify-between mb-4">
						<h2 class="flex items-center gap-2 text-sm font-semibold text-zinc-900">
							<Microscope class="h-4 w-4" />
							AI-Extracted Metadata
						</h2>
						<Button variant="ghost" size="sm" onclick={() => (editing = !editing)}>
							{editing ? 'Cancel' : 'Edit'}
						</Button>
					</div>

					{#if editing}
						<div class="space-y-4">
							<div>
								<label class="mb-1 block text-xs font-medium text-zinc-500">Summary</label>
								<textarea
									class="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
									rows="2"
									bind:value={editForm.summary}
								></textarea>
							</div>
							<div>
								<label class="mb-1 block text-xs font-medium text-zinc-500">Methodology Summary</label>
								<textarea
									class="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
									rows="2"
									bind:value={editForm.methodologySummary}
								></textarea>
							</div>
							<div>
								<label class="mb-1 block text-xs font-medium text-zinc-500">Target Population</label>
								<input
									type="text"
									class="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
									bind:value={editForm.targetPopulation}
								/>
							</div>
							<div>
								<label class="mb-1 block text-xs font-medium text-zinc-500">Focused Region</label>
								<input
									type="text"
									class="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
									bind:value={editForm.focusedRegion}
								/>
							</div>
							<div>
								<label class="mb-1 block text-xs font-medium text-zinc-500">Platform/Domain</label>
								<input
									type="text"
									class="w-full rounded border border-zinc-300 px-3 py-2 text-sm"
									bind:value={editForm.platformDomain}
								/>
							</div>
							<Button onclick={savePaper}>
								<Save class="h-4 w-4" />
								Save Changes
							</Button>
						</div>
					{:else}
						<div class="space-y-3">
							<div>
								<p class="text-xs font-medium text-zinc-500">Summary</p>
								<p class="text-sm text-zinc-800">{paper.summary || 'Not yet extracted'}</p>
							</div>
							<div>
								<p class="text-xs font-medium text-zinc-500">Methodology</p>
								<p class="text-sm text-zinc-800">{paper.methodologySummary || 'Not yet extracted'}</p>
							</div>
							<div class="grid grid-cols-2 gap-4">
								<div>
									<p class="text-xs font-medium text-zinc-500">Target Population</p>
									<p class="text-sm text-zinc-800">{paper.targetPopulation || 'Not specified'}</p>
								</div>
								<div>
									<p class="text-xs font-medium text-zinc-500">Focused Region</p>
									<p class="text-sm text-zinc-800">{paper.focusedRegion || 'Not specified'}</p>
								</div>
							</div>
							<div>
								<p class="text-xs font-medium text-zinc-500">Platform/Domain</p>
								<p class="text-sm text-zinc-800">{paper.platformDomain || 'Not specified'}</p>
							</div>
						</div>
					{/if}
				</Card>
			</div>

			<!-- Sidebar -->
			<div class="space-y-6">
				<!-- Keywords -->
				{#if paper.keywords?.length}
					<Card class="p-5">
						<h2 class="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
							<Tag class="h-4 w-4" />
							Keywords
						</h2>
						<div class="flex flex-wrap gap-1.5">
							{#each paper.keywords as kw}
								<Badge variant={kw.isBase ? 'default' : 'secondary'}>
									{kw.term}
								</Badge>
							{/each}
						</div>
					</Card>
				{/if}

				<!-- Analysis Tags -->
				{#if paper.analysisTags?.length}
					<Card class="p-5">
						<h2 class="mb-3 flex items-center gap-2 text-sm font-semibold text-zinc-900">
							<Target class="h-4 w-4" />
							Analysis Framework
						</h2>
						<div class="space-y-2">
							{#each paper.analysisTags as tag}
								<div>
									<p class="text-xs font-medium uppercase tracking-wide text-zinc-400">{tag.dimension}</p>
									<p class="text-sm text-zinc-800">{tag.value}</p>
								</div>
							{/each}
						</div>
					</Card>
				{/if}

				<!-- Paper Info -->
				<Card class="p-5">
					<h2 class="mb-3 text-sm font-semibold text-zinc-900">Paper Info</h2>
					<dl class="space-y-2 text-sm">
						{#if paper.journalName}
							<div>
								<dt class="text-xs text-zinc-500">Journal</dt>
								<dd class="text-zinc-800">{paper.journalName}</dd>
							</div>
						{/if}
						{#if paper.openalexId}
							<div>
								<dt class="text-xs text-zinc-500">OpenAlex ID</dt>
								<dd>
									<a href={paper.openalexId} target="_blank" rel="noopener" class="text-blue-600 hover:underline text-xs">{paper.openalexId}</a>
								</dd>
							</div>
						{/if}
						<div>
							<dt class="text-xs text-zinc-500">Source</dt>
							<dd class="text-zinc-800">{paper.sourceType?.replace('_', ' ') || 'Unknown'}</dd>
						</div>
					</dl>
				</Card>
			</div>
		</div>
	{/if}
</div>
