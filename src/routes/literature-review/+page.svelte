<script lang="ts">
	import { onMount } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { BookMarked, Plus, ArrowRight, Filter, Loader2, CheckCircle2 } from 'lucide-svelte';

	interface Methodology {
		id: string;
		name: string;
		description: string;
		type: string;
		domain: string;
		isBuiltIn: boolean;
		phaseCount: number;
	}

	interface ActiveReview {
		id: string;
		methodologyName: string;
		methodologyType: string;
		status: string;
		createdAt: string;
	}

	let methods: Methodology[] = $state([]);
	let activeReviews: ActiveReview[] = $state([]);
	let loading = $state(true);
	let filterType = $state('');
	let filterDomain = $state('');
	let applying = $state('');

	function getProjectId(): string {
		if (typeof window === 'undefined') return '';
		return (window as any).__currentProjectId || localStorage.getItem('currentProjectId') || '';
	}

	onMount(async () => {
		const [methodsRes, reviewsRes] = await Promise.all([
			fetch('/api/literature-review/methods'),
			fetch(`/api/projects/${getProjectId()}/reviews`)
		]);
		methods = (await methodsRes.json()).methods || [];
		activeReviews = (await reviewsRes.json()).reviews || [];
		loading = false;
	});

	const types = ['systematic', 'scoping', 'meta_analysis', 'qualitative', 'mixed', 'mapping', 'rapid'];
	const domains = ['general', 'health', 'software_engineering', 'social_sciences'];

	let filtered = $derived(
		methods.filter((m) => {
			if (filterType && m.type !== filterType) return false;
			if (filterDomain && m.domain !== filterDomain) return false;
			return true;
		})
	);

	function typeLabel(type: string) {
		return type.replace(/_/g, '-').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	function typeColor(type: string) {
		const map: Record<string, string> = {
			systematic: 'default', scoping: 'secondary', meta_analysis: 'outline',
			qualitative: 'warning', mixed: 'success', mapping: 'outline', rapid: 'secondary'
		};
		return (map[type] || 'secondary') as any;
	}

	async function applyToProject(methodologyId: string) {
		const projectId = getProjectId();
		if (!projectId) { alert('Select a project first'); return; }
		applying = methodologyId;

		const res = await fetch(`/api/projects/${projectId}/reviews`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ methodologyId })
		});

		if (res.ok) {
			const data = await res.json();
			window.location.href = `/literature-review/active?reviewId=${data.review.id}`;
		} else {
			const err = await res.json();
			alert(err.error || 'Failed to apply methodology');
		}
		applying = '';
	}
</script>

<div class="space-y-8">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-zinc-900">Literature Review</h1>
			<p class="mt-1 text-sm text-zinc-500">
				Select a recognized review methodology to guide your systematic review process
			</p>
		</div>
		<a href="/literature-review/methods/new">
			<Button variant="outline">
				<Plus class="mr-2 h-4 w-4" />
				Custom Methodology
			</Button>
		</a>
	</div>

	<!-- Active Reviews -->
	{#if activeReviews.length > 0}
		<Card class="p-5">
			<h2 class="text-sm font-semibold text-zinc-700 mb-3">Active Reviews</h2>
			<div class="space-y-2">
				{#each activeReviews as review}
					<a
						href="/literature-review/active?reviewId={review.id}"
						class="flex items-center justify-between rounded-lg border border-zinc-100 p-3 hover:bg-zinc-50 transition-colors"
					>
						<div class="flex items-center gap-3">
							{#if review.status === 'completed'}
								<CheckCircle2 class="h-5 w-5 text-emerald-500" />
							{:else}
								<BookMarked class="h-5 w-5 text-zinc-400" />
							{/if}
							<div>
								<p class="text-sm font-medium text-zinc-900">{review.methodologyName}</p>
								<p class="text-xs text-zinc-500">{typeLabel(review.methodologyType)} · Started {new Date(review.createdAt).toLocaleDateString()}</p>
							</div>
						</div>
						<div class="flex items-center gap-2">
							<Badge variant={review.status === 'completed' ? 'success' : review.status === 'in_progress' ? 'warning' : 'secondary'}>
								{review.status}
							</Badge>
							<ArrowRight class="h-4 w-4 text-zinc-400" />
						</div>
					</a>
				{/each}
			</div>
		</Card>
	{/if}

	<!-- Filters -->
	<div class="flex flex-wrap items-center gap-2">
		<Filter class="h-4 w-4 text-zinc-400" />
		<button
			class="rounded-full border px-3 py-1 text-xs font-medium transition-colors {filterType === '' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'}"
			onclick={() => (filterType = '')}
		>All types</button>
		{#each types as t}
			<button
				class="rounded-full border px-3 py-1 text-xs font-medium transition-colors {filterType === t ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'}"
				onclick={() => (filterType = filterType === t ? '' : t)}
			>{typeLabel(t)}</button>
		{/each}
	</div>

	<div class="flex flex-wrap items-center gap-2">
		<span class="text-xs text-zinc-400 w-4"></span>
		<button
			class="rounded-full border px-3 py-1 text-xs font-medium transition-colors {filterDomain === '' ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'}"
			onclick={() => (filterDomain = '')}
		>All domains</button>
		{#each domains as d}
			<button
				class="rounded-full border px-3 py-1 text-xs font-medium transition-colors {filterDomain === d ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-300 text-zinc-600 hover:bg-zinc-100'}"
				onclick={() => (filterDomain = filterDomain === d ? '' : d)}
			>{typeLabel(d)}</button>
		{/each}
	</div>

	<!-- Methodology Library -->
	{#if loading}
		<p class="py-12 text-center text-sm text-zinc-500">Loading methodologies...</p>
	{:else}
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
			{#each filtered as method}
				<Card class="flex flex-col p-5">
					<div class="flex items-start justify-between gap-2 mb-2">
						<h3 class="font-semibold text-zinc-900">{method.name}</h3>
						<Badge variant={typeColor(method.type)} class="shrink-0 text-xs">{typeLabel(method.type)}</Badge>
					</div>

					<p class="text-sm text-zinc-500 line-clamp-3 flex-1">{method.description}</p>

					<div class="mt-3 flex items-center gap-2 text-xs text-zinc-400">
						<Badge variant="outline" class="text-xs">{method.domain}</Badge>
						<span>{method.phaseCount} phases</span>
						{#if !method.isBuiltIn}
							<Badge variant="secondary" class="text-xs">Custom</Badge>
						{/if}
					</div>

					<div class="mt-4 flex items-center gap-2 border-t border-zinc-100 pt-3">
						<a href="/literature-review/methods/{method.id}" class="flex-1">
							<Button variant="ghost" class="w-full text-sm">View Details</Button>
						</a>
						<Button
							onclick={() => applyToProject(method.id)}
							disabled={applying === method.id}
							class="text-sm"
						>
							{#if applying === method.id}
								<Loader2 class="mr-1 h-3 w-3 animate-spin" />
							{/if}
							Apply
						</Button>
					</div>
				</Card>
			{/each}
		</div>
	{/if}
</div>
