<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Tooltip from '$lib/components/ui/Tooltip.svelte';
	import { Sparkles, Loader2, Check, X, ArrowLeft, Info, ChevronDown } from 'lucide-svelte';

	let step = $state(1); // 1: basic info, 2: generating, 3: review, 4: saving
	let name = $state('');
	let description = $state('');
	let error = $state('');
	let showHint = $state(false);

	// Whether this is the user's very first project — used to show the
	// welcome banner. Set by the root layout load.
	const isFirstProject = $derived(($page.data as { projectCount?: number }).projectCount === 0);

	// Setup results from LLM
	let setupResult = $state<{
		relevanceDefinition: string;
		relevanceCriteria: { relevant: string[]; notRelevant: string[] };
		dimensions: { id: string; name: string; label: string; description: string }[];
		keywords: string[];
	} | null>(null);

	let projectId = $state('');

	const descriptionPlaceholder = `Example: This review examines algorithmic auditing research — methods and frameworks for evaluating AI systems for fairness, transparency, bias, and accountability. Relevant studies include audits of hiring algorithms, credit scoring, recidivism prediction, content moderation, and recommendation systems. Out of scope: general machine learning papers with no auditing angle, or financial audits unrelated to algorithms.`;

	async function createAndSetup() {
		if (!name.trim() || !description.trim()) {
			error = 'Please fill in both fields.';
			return;
		}
		error = '';
		step = 2;

		try {
			// Step 1: Create the project
			const createRes = await fetch('/api/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: name.trim(), description: description.trim() })
			});
			const createData = await createRes.json();

			if (!createRes.ok) {
				throw new Error(createData.error || 'Failed to create project');
			}

			projectId = createData.project.id;

			// Step 2: Run LLM setup wizard
			const setupRes = await fetch(`/api/projects/${projectId}/setup`, {
				method: 'POST'
			});
			const setupData = await setupRes.json();

			if (!setupRes.ok) {
				throw new Error(setupData.error || 'Setup wizard failed');
			}

			setupResult = setupData.setup;
			step = 3;
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong';
			step = 1;
		}
	}

	async function finalize() {
		step = 4;
		// Save to localStorage and navigate
		localStorage.setItem('currentProjectId', projectId);
		await goto('/');
		window.location.reload();
	}
</script>

<div class="max-w-3xl mx-auto">
	{#if !isFirstProject}
		<a href="/projects" class="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6">
			<ArrowLeft class="h-4 w-4" />
			Back to Projects
		</a>
	{/if}

	{#if isFirstProject && step === 1}
		<div class="mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-4 dark:border-emerald-900 dark:bg-emerald-950/30">
			<div class="flex items-start gap-3">
				<Sparkles class="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
				<div>
					<h2 class="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Welcome to ResearchQ</h2>
					<p class="mt-1 text-sm text-emerald-800 dark:text-emerald-200">
						Let's set up your first review project. This takes about 30 seconds — the AI will generate your keywords, analysis dimensions, and relevance criteria from your domain description.
					</p>
				</div>
			</div>
		</div>
	{/if}

	<h1 class="text-2xl font-bold text-zinc-900">Create New Research Project</h1>
	<p class="mt-1 text-sm text-zinc-500">
		Describe your research domain and our AI will generate keywords, analysis dimensions, and relevance criteria.
	</p>

	{#if step === 1}
		<!-- Step 1: Basic Info -->
		<div class="mt-8 space-y-6">
			<div>
				<div class="flex items-center gap-1.5 mb-1">
					<label for="name" class="block text-sm font-medium text-zinc-700">Project Name</label>
					<Tooltip text="A short, human-readable title. Shown in the sidebar and on exports. You can rename it later in project settings.">
						<Info class="h-3.5 w-3.5" />
					</Tooltip>
				</div>
				<Input
					id="name"
					bind:value={name}
					placeholder="Algorithmic Bias in Criminal Justice"
				/>
				<p class="mt-1 text-xs text-zinc-400">
					Keep it short and specific — this is how you'll recognize the project in your list.
				</p>
			</div>

			<div>
				<div class="flex items-center gap-1.5 mb-1">
					<label for="description" class="block text-sm font-medium text-zinc-700">Research Domain</label>
					<Tooltip text="Describe what you're studying in 3–5 sentences. Include the topic, the populations or settings that matter, and what you'd consider in-scope vs. out-of-scope. This exact text is fed to the AI to generate your keywords, analysis dimensions, and relevance criteria — specificity here directly improves screening quality.">
						<Info class="h-3.5 w-3.5" />
					</Tooltip>
				</div>
				<Textarea
					id="description"
					bind:value={description}
					placeholder={descriptionPlaceholder}
					rows={8}
				/>
				<p class="mt-1 text-xs text-zinc-400">
					More detail = better AI-generated keywords and criteria.
				</p>

				<button
					type="button"
					onclick={() => (showHint = !showHint)}
					class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700"
				>
					<ChevronDown class="h-3.5 w-3.5 transition-transform {showHint ? 'rotate-180' : ''}" />
					Not sure what to write?
				</button>
				{#if showHint}
					<div class="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40">
						<p class="font-medium text-zinc-700 dark:text-zinc-200 mb-1.5">Try covering these three things:</p>
						<ol class="list-decimal list-inside space-y-1">
							<li>What phenomenon, technology, or intervention are you studying?</li>
							<li>Which populations, regions, or settings matter for your review?</li>
							<li>What types of studies count as in-scope vs. out-of-scope?</li>
						</ol>
					</div>
				{/if}
			</div>

			{#if error}
				<p class="text-sm text-red-600">{error}</p>
			{/if}

			<Button onclick={createAndSetup} disabled={!name.trim() || !description.trim()}>
				<Sparkles class="mr-2 h-4 w-4" />
				Generate Project Setup with AI
			</Button>
		</div>

	{:else if step === 2}
		<!-- Step 2: Generating -->
		<div class="mt-12 flex flex-col items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-zinc-400" />
			<p class="mt-4 text-sm text-zinc-500">AI is analyzing your research domain...</p>
			<p class="mt-1 text-xs text-zinc-400">Generating keywords, analysis dimensions, and relevance criteria</p>
		</div>

	{:else if step === 3 && setupResult}
		<!-- Step 3: Review -->
		<div class="mt-8 space-y-6">
			<Card class="p-5">
				<div class="flex items-center gap-1.5">
					<h3 class="font-semibold text-zinc-900">Relevance Definition</h3>
					<Tooltip text="Used in every AI screening prompt. You can edit this later in Settings if screening results drift from what you want.">
						<Info class="h-3.5 w-3.5" />
					</Tooltip>
				</div>
				<p class="mt-2 text-sm text-zinc-600">{setupResult.relevanceDefinition}</p>
			</Card>

			<Card class="p-5">
				<div class="flex items-center gap-1.5">
					<h3 class="font-semibold text-zinc-900">Generated Keywords ({setupResult.keywords.length})</h3>
					<Tooltip text="These seed your OpenAlex searches and will be extended as new papers are discovered. You can add, remove, or edit keywords any time from the Keywords page.">
						<Info class="h-3.5 w-3.5" />
					</Tooltip>
				</div>
				<div class="mt-3 flex flex-wrap gap-2">
					{#each setupResult.keywords as keyword}
						<Badge variant="secondary">{keyword}</Badge>
					{/each}
				</div>
			</Card>

			<Card class="p-5">
				<div class="flex items-center gap-1.5">
					<h3 class="font-semibold text-zinc-900">Analysis Dimensions ({setupResult.dimensions.length})</h3>
					<Tooltip text="The columns of your cross-reference matrix. These also drive the Analysis dashboard — the AI will tag each paper against these dimensions during metadata extraction.">
						<Info class="h-3.5 w-3.5" />
					</Tooltip>
				</div>
				<div class="mt-3 space-y-3">
					{#each setupResult.dimensions as dim}
						<div class="rounded-lg border border-zinc-100 p-3">
							<div class="flex items-center gap-2">
								<Badge variant="outline">{dim.name}</Badge>
								<span class="text-sm font-medium text-zinc-700">{dim.label}</span>
							</div>
							{#if dim.description}
								<p class="mt-1 text-xs text-zinc-500">{dim.description}</p>
							{/if}
						</div>
					{/each}
				</div>
			</Card>

			<Card class="p-5">
				<div class="flex items-center gap-1.5">
					<h3 class="font-semibold text-zinc-900">Relevance Criteria</h3>
					<Tooltip text="Explicit include/exclude rules the AI follows while screening papers. The more specific these are, the more consistent your screening decisions will be.">
						<Info class="h-3.5 w-3.5" />
					</Tooltip>
				</div>
				<div class="mt-3 grid gap-4 sm:grid-cols-2">
					<div>
						<h4 class="text-sm font-medium text-green-700 mb-2">Relevant if:</h4>
						<ul class="space-y-1">
							{#each setupResult.relevanceCriteria.relevant as c}
								<li class="flex items-start gap-2 text-sm text-zinc-600">
									<Check class="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
									{c}
								</li>
							{/each}
						</ul>
					</div>
					<div>
						<h4 class="text-sm font-medium text-red-700 mb-2">NOT relevant if:</h4>
						<ul class="space-y-1">
							{#each setupResult.relevanceCriteria.notRelevant as c}
								<li class="flex items-start gap-2 text-sm text-zinc-600">
									<X class="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
									{c}
								</li>
							{/each}
						</ul>
					</div>
				</div>
			</Card>

			<div class="flex items-center gap-3">
				<Button onclick={finalize}>
					<Check class="mr-2 h-4 w-4" />
					Looks Good — Start Using Project
				</Button>
				<Button variant="outline" onclick={createAndSetup}>
					<Sparkles class="mr-2 h-4 w-4" />
					Re-generate
				</Button>
			</div>
		</div>

	{:else if step === 4}
		<div class="mt-12 flex flex-col items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-zinc-400" />
			<p class="mt-4 text-sm text-zinc-500">Setting up your project...</p>
		</div>
	{/if}
</div>
