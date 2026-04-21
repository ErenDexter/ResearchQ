<script lang="ts">
	import { goto } from '$app/navigation';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Input from '$lib/components/ui/Input.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import { ArrowLeft, Plus, Trash2, GripVertical, Sparkles, Loader2, Save } from 'lucide-svelte';

	let name = $state('');
	let description = $state('');
	let type = $state('systematic');
	let domain = $state('general');
	let phases = $state<{ name: string; description: string; expectedOutputs: string[] }[]>([]);
	let saving = $state(false);
	let generatingPhases = $state(false);

	// New phase form
	let newPhaseName = $state('');
	let newPhaseDesc = $state('');

	const types = [
		{ value: 'systematic', label: 'Systematic Review' },
		{ value: 'scoping', label: 'Scoping Review' },
		{ value: 'meta_analysis', label: 'Meta-Analysis' },
		{ value: 'qualitative', label: 'Qualitative Synthesis' },
		{ value: 'mixed', label: 'Mixed Methods' },
		{ value: 'mapping', label: 'Mapping Study' },
		{ value: 'rapid', label: 'Rapid Review' },
		{ value: 'custom', label: 'Custom' }
	];

	const domains = [
		{ value: 'general', label: 'General' },
		{ value: 'health', label: 'Health Sciences' },
		{ value: 'software_engineering', label: 'Software Engineering' },
		{ value: 'social_sciences', label: 'Social Sciences' }
	];

	const outputTypes = [
		'protocol_document', 'search_strategy_log', 'prisma_flow_diagram',
		'inclusion_exclusion_table', 'quality_appraisal_table', 'risk_of_bias_table',
		'data_extraction_matrix', 'systematic_map_table', 'study_characteristics_table',
		'narrative_summary', 'thematic_synthesis', 'conceptual_framework',
		'coding_framework', 'gap_map', 'bibliometric_analysis',
		'annotated_bibliography', 'summary_of_findings', 'grade_evidence_table',
		'forest_plot_data', 'funnel_plot_data'
	];

	function addPhase() {
		if (!newPhaseName.trim()) return;
		phases = [...phases, { name: newPhaseName.trim(), description: newPhaseDesc.trim(), expectedOutputs: [] }];
		newPhaseName = '';
		newPhaseDesc = '';
	}

	function removePhase(index: number) {
		phases = phases.filter((_, i) => i !== index);
	}

	function toggleOutput(phaseIndex: number, outputType: string) {
		const phase = phases[phaseIndex];
		if (phase.expectedOutputs.includes(outputType)) {
			phase.expectedOutputs = phase.expectedOutputs.filter((o) => o !== outputType);
		} else {
			phase.expectedOutputs = [...phase.expectedOutputs, outputType];
		}
		phases = [...phases];
	}

	async function generatePhasesWithAI() {
		if (!name.trim() || !description.trim()) {
			alert('Fill in name and description first');
			return;
		}
		generatingPhases = true;

		try {
			// Use the project setup pattern — ask the gateway to generate phases
			const res = await fetch('/api/literature-review/methods', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: `__draft_${Date.now()}`,
					description: description.trim(),
					type,
					domain,
					phases: [] // empty — we'll fetch phases from LLM separately
				})
			});

			// For now, generate some sensible defaults based on type
			const defaultPhases: Record<string, { name: string; description: string; expectedOutputs: string[] }[]> = {
				systematic: [
					{ name: 'Protocol Development', description: 'Define research questions and review protocol', expectedOutputs: ['protocol_document'] },
					{ name: 'Search', description: 'Search databases and sources', expectedOutputs: ['search_strategy_log'] },
					{ name: 'Screening', description: 'Screen and select studies', expectedOutputs: ['inclusion_exclusion_table', 'prisma_flow_diagram'] },
					{ name: 'Quality Assessment', description: 'Assess study quality', expectedOutputs: ['quality_appraisal_table'] },
					{ name: 'Data Extraction', description: 'Extract data from included studies', expectedOutputs: ['data_extraction_matrix'] },
					{ name: 'Synthesis', description: 'Synthesize findings', expectedOutputs: ['narrative_summary', 'thematic_synthesis'] },
					{ name: 'Reporting', description: 'Compile final report', expectedOutputs: ['summary_of_findings', 'annotated_bibliography'] }
				],
				scoping: [
					{ name: 'Define Question', description: 'Define the scoping review question', expectedOutputs: ['protocol_document'] },
					{ name: 'Search', description: 'Identify relevant sources', expectedOutputs: ['search_strategy_log'] },
					{ name: 'Selection', description: 'Select sources', expectedOutputs: ['inclusion_exclusion_table'] },
					{ name: 'Charting', description: 'Chart the data', expectedOutputs: ['data_extraction_matrix', 'systematic_map_table'] },
					{ name: 'Summarizing', description: 'Collate and summarize', expectedOutputs: ['narrative_summary', 'gap_map'] }
				]
			};

			phases = defaultPhases[type] || defaultPhases['systematic']!;

			// Clean up the draft
			if (res.ok) {
				const data = await res.json();
				await fetch(`/api/literature-review/methods/${data.method.id}`, { method: 'DELETE' });
			}
		} catch {
			alert('Failed to generate phases');
		}
		generatingPhases = false;
	}

	async function save() {
		if (!name.trim() || !description.trim() || phases.length === 0) {
			alert('Please fill in all fields and add at least one phase');
			return;
		}
		saving = true;

		const res = await fetch('/api/literature-review/methods', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, description, type, domain, phases })
		});

		if (res.ok) {
			await goto('/literature-review');
		} else {
			alert('Failed to save methodology');
		}
		saving = false;
	}
</script>

<div class="max-w-3xl mx-auto">
	<a href="/literature-review" class="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-6">
		<ArrowLeft class="h-4 w-4" />
		Back to Library
	</a>

	<h1 class="text-2xl font-bold text-zinc-900">Create Custom Methodology</h1>
	<p class="mt-1 text-sm text-zinc-500">Define your own review methodology with custom phases and expected outputs.</p>

	<div class="mt-8 space-y-6">
		<!-- Basic Info -->
		<Card class="p-5 space-y-4">
			<div>
				<label for="name" class="block text-sm font-medium text-zinc-700 mb-1">Methodology Name</label>
				<Input id="name" bind:value={name} placeholder="e.g., Modified Rapid Review for Policy Analysis" />
			</div>
			<div>
				<label for="desc" class="block text-sm font-medium text-zinc-700 mb-1">Description</label>
				<Textarea id="desc" bind:value={description} placeholder="Describe what this methodology is and when to use it..." rows={3} />
			</div>
			<div class="grid grid-cols-2 gap-4">
				<div>
					<label for="type" class="block text-sm font-medium text-zinc-700 mb-1">Type</label>
					<select id="type" bind:value={type} class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
						{#each types as t}
							<option value={t.value}>{t.label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label for="domain" class="block text-sm font-medium text-zinc-700 mb-1">Domain</label>
					<select id="domain" bind:value={domain} class="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm">
						{#each domains as d}
							<option value={d.value}>{d.label}</option>
						{/each}
					</select>
				</div>
			</div>
		</Card>

		<!-- Phases -->
		<Card class="p-5">
			<div class="flex items-center justify-between mb-4">
				<h2 class="font-semibold text-zinc-900">Phases ({phases.length})</h2>
				<Button variant="outline" size="sm" onclick={generatePhasesWithAI} disabled={generatingPhases}>
					{#if generatingPhases}
						<Loader2 class="mr-1 h-3 w-3 animate-spin" />
					{:else}
						<Sparkles class="mr-1 h-3 w-3" />
					{/if}
					Generate with AI
				</Button>
			</div>

			{#if phases.length > 0}
				<div class="space-y-3 mb-4">
					{#each phases as phase, i}
						<div class="rounded-lg border border-zinc-200 p-3">
							<div class="flex items-start gap-2">
								<GripVertical class="h-4 w-4 text-zinc-300 mt-0.5 shrink-0" />
								<div class="flex-1">
									<div class="flex items-center justify-between">
										<span class="text-sm font-medium text-zinc-900">
											<span class="text-zinc-400 mr-1">{i + 1}.</span> {phase.name}
										</span>
										<button onclick={() => removePhase(i)} class="text-zinc-400 hover:text-red-600">
											<Trash2 class="h-4 w-4" />
										</button>
									</div>
									{#if phase.description}
										<p class="text-xs text-zinc-500 mt-0.5">{phase.description}</p>
									{/if}
									<!-- Output type selector -->
									<div class="mt-2 flex flex-wrap gap-1">
										{#each outputTypes as ot}
											{@const selected = phase.expectedOutputs.includes(ot)}
											<button
												class="rounded-full border px-2 py-0.5 text-xs transition-colors {selected
													? 'border-zinc-900 bg-zinc-900 text-white'
													: 'border-zinc-200 text-zinc-400 hover:border-zinc-400 hover:text-zinc-600'}"
												onclick={() => toggleOutput(i, ot)}
											>
												{ot.replace(/_/g, ' ')}
											</button>
										{/each}
									</div>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- Add phase form -->
			<div class="rounded-lg border border-dashed border-zinc-300 p-4">
				<div class="grid gap-3 sm:grid-cols-2">
					<Input bind:value={newPhaseName} placeholder="Phase name" />
					<Input bind:value={newPhaseDesc} placeholder="Description (optional)" />
				</div>
				<Button variant="outline" class="mt-3" onclick={addPhase} disabled={!newPhaseName.trim()}>
					<Plus class="mr-2 h-4 w-4" />
					Add Phase
				</Button>
			</div>
		</Card>

		<!-- Save -->
		<Button onclick={save} disabled={saving || !name.trim() || phases.length === 0}>
			{#if saving}
				<Loader2 class="mr-2 h-4 w-4 animate-spin" />
			{:else}
				<Save class="mr-2 h-4 w-4" />
			{/if}
			Save Methodology
		</Button>
	</div>
</div>
