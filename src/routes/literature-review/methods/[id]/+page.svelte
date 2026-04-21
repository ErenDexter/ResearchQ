<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { ArrowLeft, Loader2, CheckSquare } from 'lucide-svelte';

	const methodId = $page.params.id;

	let method = $state<any>(null);
	let phases = $state<any[]>([]);
	let loading = $state(true);
	let applying = $state(false);

	function getProjectId(): string {
		if (typeof window === 'undefined') return '';
		return (window as any).__currentProjectId || localStorage.getItem('currentProjectId') || '';
	}

	onMount(async () => {
		const res = await fetch(`/api/literature-review/methods/${methodId}`);
		const data = await res.json();
		method = data.method;
		phases = data.phases || [];
		loading = false;
	});

	async function applyToProject() {
		const projectId = getProjectId();
		if (!projectId) { alert('Select a project first'); return; }
		applying = true;
		const res = await fetch(`/api/projects/${projectId}/reviews`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ methodologyId: methodId })
		});
		if (res.ok) {
			const data = await res.json();
			window.location.href = `/literature-review/active?reviewId=${data.review.id}`;
		} else {
			alert('Failed to apply methodology');
		}
		applying = false;
	}
</script>

<div class="max-w-3xl mx-auto">
	<a href="/literature-review" class="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6">
		<ArrowLeft class="h-4 w-4" />
		Back to Library
	</a>

	{#if loading}
		<p class="text-sm text-zinc-500">Loading...</p>
	{:else if method}
		<div class="flex items-start justify-between gap-4 mb-6">
			<div>
				<h1 class="text-2xl font-bold text-zinc-900">{method.name}</h1>
				<div class="mt-2 flex items-center gap-2">
					<Badge>{method.type.replace(/_/g, ' ')}</Badge>
					<Badge variant="outline">{method.domain}</Badge>
					{#if !method.isBuiltIn}
						<Badge variant="secondary">Custom</Badge>
					{/if}
				</div>
			</div>
			<Button onclick={applyToProject} disabled={applying}>
				{#if applying}
					<Loader2 class="mr-2 h-4 w-4 animate-spin" />
				{/if}
				Apply to Current Project
			</Button>
		</div>

		<Card class="p-5 mb-6">
			<p class="text-sm text-zinc-600 leading-relaxed">{method.description}</p>
		</Card>

		<h2 class="text-lg font-semibold text-zinc-900 mb-4">Phases ({phases.length})</h2>

		<div class="space-y-3">
			{#each phases as phase, i}
				<Card class="p-4">
					<div class="flex items-start gap-3">
						<div class="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 text-xs font-bold text-zinc-600 shrink-0">
							{i + 1}
						</div>
						<div class="flex-1">
							<h3 class="font-medium text-zinc-900">{phase.name}</h3>
							{#if phase.description}
								<p class="mt-1 text-sm text-zinc-500">{phase.description}</p>
							{/if}
							{#if phase.expectedOutputs?.length > 0}
								<div class="mt-2 flex flex-wrap gap-1.5">
									{#each phase.expectedOutputs as output}
										<Badge variant="outline" class="text-xs">
											<CheckSquare class="mr-1 h-3 w-3" />
											{output.replace(/_/g, ' ')}
										</Badge>
									{/each}
								</div>
							{/if}
						</div>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>
