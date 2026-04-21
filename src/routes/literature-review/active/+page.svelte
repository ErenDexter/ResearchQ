<script lang="ts">
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import Badge from '$lib/components/ui/Badge.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import Textarea from '$lib/components/ui/Textarea.svelte';
	import {
		ArrowLeft, CheckCircle2, Circle, Loader2, Play, SkipForward,
		Download, RefreshCw, ChevronDown, ChevronRight, FileText, BookMarked, Eye, EyeOff
	} from 'lucide-svelte';

	const reviewId = $page.url.searchParams.get('reviewId') || '';

	let review = $state<any>(null);
	let methodology = $state<any>(null);
	let phases = $state<any[]>([]);
	let outputs = $state<any[]>([]);
	let loading = $state(true);
	let expandedPhase = $state<string | null>(null);
	let expandedOutputs = $state<Set<string>>(new Set());
	let generating = $state<string | null>(null);

	function getProjectId(): string {
		if (typeof window === 'undefined') return '';
		return (window as any).__currentProjectId || localStorage.getItem('currentProjectId') || '';
	}

	async function loadReview() {
		if (!reviewId) return;
		const projectId = getProjectId();
		const res = await fetch(`/api/projects/${projectId}/reviews/${reviewId}`);
		if (!res.ok) { loading = false; return; }
		const data = await res.json();
		review = data.review;
		methodology = data.methodology;
		phases = data.phases || [];
		outputs = data.outputs || [];
		loading = false;
	}

	onMount(loadReview);

	let completedPhases = $derived(phases.filter((p) => p.progress.status === 'completed').length);
	let progressPct = $derived(phases.length > 0 ? Math.round((completedPhases / phases.length) * 100) : 0);

	function phaseStatusIcon(status: string) {
		if (status === 'completed') return CheckCircle2;
		if (status === 'in_progress') return Loader2;
		if (status === 'skipped') return SkipForward;
		return Circle;
	}

	function phaseStatusColor(status: string) {
		if (status === 'completed') return 'text-emerald-500';
		if (status === 'in_progress') return 'text-amber-500';
		if (status === 'skipped') return 'text-zinc-400';
		return 'text-zinc-300';
	}

	async function updatePhaseStatus(phaseId: string, status: string) {
		const projectId = getProjectId();
		await fetch(`/api/projects/${projectId}/reviews/${reviewId}/phases/${phaseId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status })
		});
		await loadReview();
	}

	async function savePhaseNotes(phaseId: string, notes: string) {
		const projectId = getProjectId();
		await fetch(`/api/projects/${projectId}/reviews/${reviewId}/phases/${phaseId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ notes })
		});
	}

	async function generateOutput(outputType: string, phaseId?: string) {
		generating = outputType;
		const projectId = getProjectId();
		try {
			await fetch(`/api/projects/${projectId}/reviews/${reviewId}/outputs/generate`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ outputType, phaseId })
			});
			await loadReview();
		} catch (e) {
			alert('Failed to generate output');
		}
		generating = null;
	}

	function getOutputForType(outputType: string) {
		return outputs.find((o) => o.outputType === outputType);
	}

	function toggleOutputExpand(key: string) {
		const next = new Set(expandedOutputs);
		if (next.has(key)) next.delete(key); else next.add(key);
		expandedOutputs = next;
	}

	// ─── Per-output downloads ──────────────────────────────────────

	function jsonTableToMarkdown(data: { columns: string[]; rows: any[] }): string {
		let md = '| ' + data.columns.join(' | ') + ' |\n';
		md += '| ' + data.columns.map(() => '---').join(' | ') + ' |\n';
		for (const row of data.rows) {
			const vals = data.columns.map((col) => {
				const key = Object.keys(row).find((k) => k.toLowerCase() === col.toLowerCase().replace(/[^a-z]/g, ''));
				return String(row[key || col] ?? Object.values(row)[data.columns.indexOf(col)] ?? '—').replace(/\|/g, '\\|');
			});
			md += '| ' + vals.join(' | ') + ' |\n';
		}
		return md;
	}

	function downloadMd(output: any) {
		let content = output.contentMarkdown || '';
		if (!content && output.contentJson) {
			try {
				const data = JSON.parse(output.contentJson);
				if (data.columns && data.rows) {
					content = `# ${output.title}\n\n` + jsonTableToMarkdown(data);
				} else {
					content = `# ${output.title}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``;
				}
			} catch { content = output.contentJson; }
		}
		const blob = new Blob([content], { type: 'text/markdown' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `${(output.title || output.outputType).replace(/\s+/g, '-').toLowerCase()}.md`;
		a.click();
		URL.revokeObjectURL(url);
	}

	function downloadDocx(output: any) {
		const projectId = getProjectId();
		window.open(`/api/projects/${projectId}/reviews/${reviewId}/outputs/${output.id}/docx`);
	}

	async function exportReview(format: string) {
		const projectId = getProjectId();
		window.open(`/api/projects/${projectId}/reviews/${reviewId}/export?format=${format}`);
	}

	async function updateReviewStatus(status: string) {
		const projectId = getProjectId();
		await fetch(`/api/projects/${projectId}/reviews/${reviewId}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ status })
		});
		await loadReview();
	}
</script>

<div class="space-y-6">
	<a href="/literature-review" class="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700">
		<ArrowLeft class="h-4 w-4" />
		Back to Library
	</a>

	{#if loading}
		<div class="flex items-center justify-center py-12">
			<Loader2 class="h-8 w-8 animate-spin text-zinc-400" />
		</div>
	{:else if !review}
		<Card class="py-12 text-center">
			<BookMarked class="mx-auto mb-3 h-10 w-10 text-zinc-300" />
			<p class="text-sm text-zinc-500">Review not found. Select a review from the Literature Review page.</p>
		</Card>
	{:else}
		<!-- Header -->
		<div class="flex items-start justify-between gap-4">
			<div>
				<h1 class="text-2xl font-bold text-zinc-900">{methodology?.name || 'Review'}</h1>
				<div class="mt-2 flex items-center gap-2">
					<Badge>{methodology?.type?.replace(/_/g, ' ')}</Badge>
					<Badge variant={review.status === 'completed' ? 'success' : review.status === 'in_progress' ? 'warning' : 'secondary'}>
						{review.status}
					</Badge>
					<span class="text-sm text-zinc-500">{completedPhases}/{phases.length} phases completed</span>
				</div>
			</div>
			<div class="flex items-center gap-2">
				{#if review.status === 'setup'}
					<Button onclick={() => updateReviewStatus('in_progress')}>
						<Play class="mr-2 h-4 w-4" />
						Start Review
					</Button>
				{:else if review.status === 'in_progress'}
					<Button variant="outline" onclick={() => updateReviewStatus('completed')}>
						<CheckCircle2 class="mr-2 h-4 w-4" />
						Mark Complete
					</Button>
				{:else if review.status === 'completed'}
					<Button variant="outline" onclick={() => updateReviewStatus('in_progress')}>
						<Play class="mr-2 h-4 w-4" />
						Resume
					</Button>
				{/if}
				<Button variant="outline" onclick={() => exportReview('markdown')}>
					<Download class="mr-2 h-4 w-4" />
					MD
				</Button>
				<Button variant="outline" onclick={() => exportReview('docx')}>
					<Download class="mr-2 h-4 w-4" />
					DOCX
				</Button>
			</div>
		</div>

		<!-- Progress bar -->
		<div class="h-2 rounded-full bg-zinc-100">
			<div class="h-2 rounded-full bg-zinc-800 transition-all" style="width: {progressPct}%"></div>
		</div>

		<!-- Phase Stepper -->
		<div class="space-y-3">
			{#each phases as phase, i}
				{@const StatusIcon = phaseStatusIcon(phase.progress.status)}
				{@const isExpanded = expandedPhase === phase.id}
				{@const expectedOutputs = phase.expectedOutputs || []}

				<Card class="overflow-hidden">
					<!-- Phase header -->
					<button
						class="flex w-full items-center gap-3 p-4 text-left hover:bg-zinc-50 transition-colors"
						onclick={() => (expandedPhase = isExpanded ? null : phase.id)}
					>
						<StatusIcon class="h-5 w-5 shrink-0 {phaseStatusColor(phase.progress.status)} {phase.progress.status === 'in_progress' ? 'animate-spin' : ''}" />
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<span class="text-xs font-medium text-zinc-400">Phase {i + 1}</span>
								<h3 class="text-sm font-semibold text-zinc-900">{phase.name}</h3>
							</div>
							{#if phase.description}
								<p class="mt-0.5 text-xs text-zinc-500 line-clamp-1">{phase.description}</p>
							{/if}
						</div>
						<div class="flex items-center gap-2">
							{#if expectedOutputs.length > 0}
								<span class="text-xs text-zinc-400">{expectedOutputs.length} outputs</span>
							{/if}
							{#if isExpanded}
								<ChevronDown class="h-4 w-4 text-zinc-400" />
							{:else}
								<ChevronRight class="h-4 w-4 text-zinc-400" />
							{/if}
						</div>
					</button>

					<!-- Phase detail (expanded) -->
					{#if isExpanded}
						<div class="border-t border-zinc-100 p-4 bg-zinc-50/50">
							{#if phase.description}
								<p class="text-sm text-zinc-600 mb-4">{phase.description}</p>
							{/if}

							<!-- Phase actions -->
							<div class="flex items-center gap-2 mb-4">
								{#if phase.progress.status === 'pending'}
									<Button size="sm" onclick={() => updatePhaseStatus(phase.id, 'in_progress')}>
										<Play class="mr-1 h-3 w-3" /> Start
									</Button>
									<Button size="sm" variant="ghost" onclick={() => updatePhaseStatus(phase.id, 'skipped')}>
										<SkipForward class="mr-1 h-3 w-3" /> Skip
									</Button>
								{:else if phase.progress.status === 'in_progress'}
									<Button size="sm" onclick={() => updatePhaseStatus(phase.id, 'completed')}>
										<CheckCircle2 class="mr-1 h-3 w-3" /> Complete
									</Button>
								{:else if phase.progress.status === 'completed'}
									<Badge variant="success">Completed</Badge>
								{:else if phase.progress.status === 'skipped'}
									<Badge variant="secondary">Skipped</Badge>
								{/if}
							</div>

							<!-- Notes -->
							<div class="mb-4">
								<label class="text-xs font-medium text-zinc-500 mb-1 block">Notes</label>
								<Textarea
									value={phase.progress.notes || ''}
									placeholder="Add notes for this phase..."
									rows={2}
									onblur={(e: Event) => savePhaseNotes(phase.id, (e.target as HTMLTextAreaElement).value)}
								/>
							</div>

							<!-- Expected outputs -->
							{#if expectedOutputs.length > 0}
								<h4 class="text-xs font-semibold text-zinc-500 uppercase mb-2">Expected Outputs</h4>
								<div class="space-y-2">
									{#each expectedOutputs as outputType}
										{@const existing = getOutputForType(outputType)}
										{@const isOutputExpanded = expandedOutputs.has(outputType)}

										<!-- Output row: title + badges + action buttons -->
										<div class="rounded-lg border border-zinc-200 bg-white p-3">
											<div class="flex items-center justify-between">
												<button
													class="flex items-center gap-2 text-left"
													onclick={() => existing && toggleOutputExpand(outputType)}
												>
													<FileText class="h-4 w-4 text-zinc-400" />
													<span class="text-sm font-medium text-zinc-700">
														{outputType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
													</span>
													{#if existing}
														<Badge variant="success" class="text-xs">Generated</Badge>
														{#if isOutputExpanded}
															<EyeOff class="h-3 w-3 text-zinc-400" />
														{:else}
															<Eye class="h-3 w-3 text-zinc-400" />
														{/if}
													{/if}
												</button>

												<div class="flex items-center gap-1">
													{#if existing}
														<Button size="sm" variant="ghost" onclick={() => downloadMd(existing)} title="Download Markdown">
															<Download class="mr-1 h-3 w-3" /> MD
														</Button>
														<Button size="sm" variant="ghost" onclick={() => downloadDocx(existing)} title="Download DOCX">
															<Download class="mr-1 h-3 w-3" /> DOCX
														</Button>
														<Button size="sm" variant="ghost" onclick={() => generateOutput(outputType, phase.id)} title="Regenerate">
															<RefreshCw class="h-3 w-3" />
														</Button>
													{:else}
														<Button size="sm" onclick={() => generateOutput(outputType, phase.id)} disabled={generating === outputType}>
															{#if generating === outputType}
																<Loader2 class="mr-1 h-3 w-3 animate-spin" />
																Generating...
															{:else}
																Generate
															{/if}
														</Button>
													{/if}
												</div>
											</div>

											<!-- Collapsible content (only shown when expanded) -->
											{#if existing && isOutputExpanded}
												<div class="mt-3 border-t border-zinc-100 pt-3 text-sm">
													{#if existing.contentMarkdown}
														<div class="prose prose-sm max-w-none text-zinc-700 whitespace-pre-wrap">
															{existing.contentMarkdown}
														</div>
													{:else if existing.contentJson}
														{@const data = (() => { try { return JSON.parse(existing.contentJson); } catch { return null; } })()}
														{#if data?.columns && data?.rows}
															<!-- Structured table data -->
															<div class="overflow-x-auto">
																<table class="w-full text-xs">
																	<thead>
																		<tr class="border-b">
																			{#each data.columns as col}
																				<th class="px-2 py-1 text-left font-medium text-zinc-500">{col}</th>
																			{/each}
																		</tr>
																	</thead>
																	<tbody>
																		{#each data.rows.slice(0, 30) as row}
																			<tr class="border-b border-zinc-50">
																				{#each data.columns as col}
																					<td class="px-2 py-1 text-zinc-600 max-w-xs truncate">
																						{row[col] || row[col.toLowerCase()] || row[col.toLowerCase().replace(/[^a-z]/g, '')] || Object.values(row)[data.columns.indexOf(col)] || '—'}
																					</td>
																				{/each}
																			</tr>
																		{/each}
																	</tbody>
																</table>
																{#if data.rows.length > 30}
																	<p class="mt-2 text-xs text-zinc-400">Showing 30 of {data.rows.length} rows</p>
																{/if}
															</div>
														{:else if typeof data === 'object' && !Array.isArray(data)}
															<!-- Named arrays (e.g. bibliometric: { byYear: [...], byVenue: [...] }) -->
															{#each Object.entries(data) as [sectionName, sectionData]}
																<h5 class="text-xs font-semibold text-zinc-500 uppercase mt-3 mb-1">
																	{sectionName.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
																</h5>
																{#if Array.isArray(sectionData) && sectionData.length > 0}
																	{@const cols = Object.keys(sectionData[0])}
																	<div class="overflow-x-auto">
																		<table class="w-full text-xs mb-2">
																			<thead>
																				<tr class="border-b">
																					{#each cols as col}
																						<th class="px-2 py-1 text-left font-medium text-zinc-500">
																							{col.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase())}
																						</th>
																					{/each}
																				</tr>
																			</thead>
																			<tbody>
																				{#each sectionData as row}
																					<tr class="border-b border-zinc-50">
																						{#each cols as col}
																							<td class="px-2 py-1 text-zinc-600">{row[col] ?? '—'}</td>
																						{/each}
																					</tr>
																				{/each}
																			</tbody>
																		</table>
																	</div>
																{/if}
															{/each}
														{:else}
															<pre class="text-xs overflow-x-auto bg-zinc-50 p-2 rounded">{JSON.stringify(data, null, 2)}</pre>
														{/if}
													{/if}
												</div>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</Card>
			{/each}
		</div>

		<!-- All Outputs Summary -->
		{#if outputs.length > 0}
			<Card class="p-5">
				<div class="flex items-center justify-between mb-3">
					<h2 class="text-sm font-semibold text-zinc-700">All Generated Outputs ({outputs.length})</h2>
					<div class="flex gap-2">
						<Button variant="outline" size="sm" onclick={() => exportReview('markdown')}>
							<Download class="mr-1 h-3 w-3" /> Markdown
						</Button>
						<Button variant="outline" size="sm" onclick={() => exportReview('docx')}>
							<Download class="mr-1 h-3 w-3" /> DOCX
						</Button>
						<Button variant="outline" size="sm" onclick={() => exportReview('json')}>
							<Download class="mr-1 h-3 w-3" /> JSON
						</Button>
					</div>
				</div>
				<div class="space-y-1">
					{#each outputs as output}
						<div class="flex items-center justify-between py-2 text-sm">
							<span class="text-zinc-700">{output.title}</span>
							<div class="flex items-center gap-2">
								<Button size="sm" variant="ghost" onclick={() => downloadMd(output)}>MD</Button>
								<Button size="sm" variant="ghost" onclick={() => downloadDocx(output)}>DOCX</Button>
								<span class="text-xs text-zinc-400">{output.generatedAt?.slice(0, 10)}</span>
							</div>
						</div>
					{/each}
				</div>
			</Card>
		{/if}
	{/if}
</div>
