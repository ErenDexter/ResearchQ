<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { ArrowLeft, Save, Sparkles, Plus, Trash2, GripVertical, Loader2 } from 'lucide-svelte';

	const projectId = $page.params.id;

	let project = $state<any>(null);
	let dimensions = $state<any[]>([]);
	let projectKeywords = $state<any[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let regenerating = $state(false);
	let message = $state('');

	// Editable fields
	let editName = $state('');
	let editDescription = $state('');
	let editRelevanceDefinition = $state('');
	let newDimName = $state('');
	let newDimLabel = $state('');
	let newDimDescription = $state('');

	onMount(async () => {
		const res = await fetch(`/api/projects/${projectId}`);
		const data = await res.json();
		project = data.project;
		dimensions = data.dimensions || [];
		projectKeywords = data.keywords || [];
		editName = project.name;
		editDescription = project.description;
		editRelevanceDefinition = project.relevanceDefinition || '';
		loading = false;
	});

	async function saveProject() {
		saving = true;
		await fetch(`/api/projects/${projectId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: editName,
				description: editDescription,
				relevanceDefinition: editRelevanceDefinition
			})
		});
		saving = false;
		message = 'Saved!';
		setTimeout(() => (message = ''), 2000);
	}

	async function regenerateSetup() {
		regenerating = true;
		const res = await fetch(`/api/projects/${projectId}/setup`, { method: 'POST' });
		const data = await res.json();
		if (data.setup) {
			dimensions = data.setup.dimensions;
			editRelevanceDefinition = data.setup.relevanceDefinition;
			// Reload keywords
			const kwRes = await fetch(`/api/projects/${projectId}`);
			const kwData = await kwRes.json();
			projectKeywords = kwData.keywords || [];
		}
		regenerating = false;
	}

	async function addDimension() {
		if (!newDimName.trim() || !newDimLabel.trim()) return;
		await fetch(`/api/projects/${projectId}/dimensions`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: newDimName.trim(),
				label: newDimLabel.trim(),
				description: newDimDescription.trim(),
				position: dimensions.length
			})
		});
		// Reload
		const res = await fetch(`/api/projects/${projectId}/dimensions`);
		const data = await res.json();
		dimensions = data.dimensions;
		newDimName = '';
		newDimLabel = '';
		newDimDescription = '';
	}

	async function removeDimension(dimId: string) {
		await fetch(`/api/projects/${projectId}/dimensions?dimensionId=${dimId}`, { method: 'DELETE' });
		dimensions = dimensions.filter((d: any) => d.id !== dimId);
	}
</script>

<div class="max-w-3xl mx-auto">
	<a href="/projects" class="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6">
		<ArrowLeft class="h-4 w-4" />
		Back to Projects
	</a>

	{#if loading}
		<p class="text-sm text-zinc-500">Loading...</p>
	{:else if project}
		<h1 class="text-2xl font-bold text-zinc-900">Project Settings</h1>
		<p class="mt-1 text-sm text-zinc-500">Configure the research domain, keywords, and analysis framework.</p>

		<!-- Basic Info -->
		<Card class="mt-6 p-5">
			<h2 class="font-semibold text-zinc-900 mb-4">Basic Information</h2>
			<div class="space-y-4">
				<div>
					<label for="name" class="block text-sm font-medium text-zinc-700 mb-1">Project Name</label>
					<Input id="name" bind:value={editName} />
				</div>
				<div>
					<label for="desc" class="block text-sm font-medium text-zinc-700 mb-1">Description</label>
					<Textarea id="desc" bind:value={editDescription} rows={4} />
				</div>
				<div>
					<label for="rel" class="block text-sm font-medium text-zinc-700 mb-1">Relevance Definition</label>
					<Textarea id="rel" bind:value={editRelevanceDefinition} rows={3} />
					<p class="mt-1 text-xs text-zinc-400">This is injected into AI prompts to define what counts as a relevant paper.</p>
				</div>
				<div class="flex items-center gap-3">
					<Button onclick={saveProject} disabled={saving}>
						<Save class="mr-2 h-4 w-4" />
						{saving ? 'Saving...' : 'Save Changes'}
					</Button>
					{#if message}
						<span class="text-sm text-green-600">{message}</span>
					{/if}
				</div>
			</div>
		</Card>

		<!-- Analysis Dimensions -->
		<Card class="mt-6 p-5">
			<div class="flex items-center justify-between mb-4">
				<h2 class="font-semibold text-zinc-900">Analysis Dimensions ({dimensions.length})</h2>
				<Button variant="outline" onclick={regenerateSetup} disabled={regenerating}>
					{#if regenerating}
						<Loader2 class="mr-2 h-4 w-4 animate-spin" />
						Regenerating...
					{:else}
						<Sparkles class="mr-2 h-4 w-4" />
						Re-generate with AI
					{/if}
				</Button>
			</div>

			<div class="space-y-2">
				{#each dimensions as dim}
					<div class="flex items-center gap-3 rounded-lg border border-zinc-100 p-3">
						<GripVertical class="h-4 w-4 text-zinc-300 shrink-0" />
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<Badge variant="outline">{dim.name}</Badge>
								<span class="text-sm font-medium text-zinc-700">{dim.label}</span>
							</div>
							{#if dim.description}
								<p class="mt-0.5 text-xs text-zinc-500 truncate">{dim.description}</p>
							{/if}
						</div>
						<button
							onclick={() => removeDimension(dim.id)}
							class="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</div>
				{/each}
			</div>

			<!-- Add new dimension -->
			<div class="mt-4 rounded-lg border border-dashed border-zinc-300 p-4">
				<h4 class="text-sm font-medium text-zinc-700 mb-3">Add Dimension</h4>
				<div class="grid gap-3 sm:grid-cols-3">
					<Input bind:value={newDimName} placeholder="name (snake_case)" />
					<Input bind:value={newDimLabel} placeholder="Label" />
					<Input bind:value={newDimDescription} placeholder="Description (optional)" />
				</div>
				<Button variant="outline" class="mt-3" onclick={addDimension} disabled={!newDimName || !newDimLabel}>
					<Plus class="mr-2 h-4 w-4" />
					Add Dimension
				</Button>
			</div>
		</Card>

		<!-- Keywords -->
		<Card class="mt-6 p-5">
			<h2 class="font-semibold text-zinc-900 mb-4">Keywords ({projectKeywords.length})</h2>
			<div class="flex flex-wrap gap-2">
				{#each projectKeywords as kw}
					<Badge variant={kw.isBaseKeyword ? 'default' : 'secondary'}>
						{kw.term}
						{#if kw.relevanceScore != null}
							<span class="ml-1 opacity-60">({Math.round(kw.relevanceScore * 100)}%)</span>
						{/if}
					</Badge>
				{/each}
			</div>
			<p class="mt-3 text-xs text-zinc-400">
				Manage keywords on the <a href="/keywords" class="underline">Keywords page</a>. Base keywords are shown in dark.
			</p>
		</Card>
	{/if}
</div>
