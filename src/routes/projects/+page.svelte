<script lang="ts">
	import { onMount } from 'svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import { FolderOpen, Plus, Archive, Trash2 } from 'lucide-svelte';

	interface Project {
		id: string;
		name: string;
		description: string;
		status: string;
		paperCount: number;
		keywordCount: number;
		createdAt: string;
	}

	let projects: Project[] = $state([]);
	let loading = $state(true);

	onMount(async () => {
		const res = await fetch('/api/projects');
		const data = await res.json();
		projects = data.projects || [];
		loading = false;
	});

	async function deleteProject(id: string) {
		if (!confirm('Delete this project and all its data?')) return;
		await fetch(`/api/projects/${id}`, { method: 'DELETE' });
		projects = projects.filter((p) => p.id !== id);
	}

	async function archiveProject(id: string) {
		await fetch(`/api/projects/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status: 'archived' })
		});
		projects = projects.map((p) => (p.id === id ? { ...p, status: 'archived' } : p));
	}
</script>

<div>
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-zinc-900">Projects</h1>
			<p class="mt-1 text-sm text-zinc-500">
				Each project defines a research domain with its own keywords, analysis framework, and paper collection.
			</p>
		</div>
		<a href="/projects/new">
			<Button>
				<Plus class="mr-2 h-4 w-4" />
				New Project
			</Button>
		</a>
	</div>

	{#if loading}
		<p class="mt-8 text-sm text-zinc-500">Loading projects...</p>
	{:else if projects.length === 0}
		<div class="mt-8 rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center">
			<FolderOpen class="mx-auto h-12 w-12 text-zinc-400" />
			<h3 class="mt-4 text-lg font-medium text-zinc-900">No projects yet</h3>
			<p class="mt-2 text-sm text-zinc-500">Create your first research project to get started.</p>
			<a href="/projects/new" class="mt-4 inline-block">
				<Button>Create Project</Button>
			</a>
		</div>
	{:else}
		<div class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each projects as project}
				<Card class="flex flex-col p-5">
					<div class="flex items-start justify-between">
						<div class="flex-1 min-w-0">
							<h3 class="font-semibold text-zinc-900 truncate">{project.name}</h3>
							<p class="mt-1 text-sm text-zinc-500 line-clamp-2">{project.description}</p>
						</div>
						<Badge variant={project.status === 'active' ? 'success' : 'secondary'}>
							{project.status}
						</Badge>
					</div>

					<div class="mt-4 flex items-center gap-4 text-sm text-zinc-500">
						<span>{project.paperCount} papers</span>
						<span>{project.keywordCount} keywords</span>
					</div>

					<div class="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-4">
						<a href="/projects/{project.id}/settings" class="flex-1">
							<Button variant="outline" class="w-full text-sm">Settings</Button>
						</a>
						<button
							onclick={() => archiveProject(project.id)}
							class="rounded-lg p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
							title="Archive"
						>
							<Archive class="h-4 w-4" />
						</button>
						<button
							onclick={() => deleteProject(project.id)}
							class="rounded-lg p-2 text-zinc-400 hover:bg-red-50 hover:text-red-600"
							title="Delete"
						>
							<Trash2 class="h-4 w-4" />
						</button>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>
