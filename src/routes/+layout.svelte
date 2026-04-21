<script lang="ts">
	import './layout.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import {
		LayoutDashboard,
		Search,
		FileText,
		BookOpen,
		Users,
		BarChart3,
		Clock,
		Sparkles,
		Tag,
		FolderOpen,
		Table,
		Brain,
		ChevronDown,
		BookMarked
	} from 'lucide-svelte';

	let { children } = $props();

	interface Project {
		id: string;
		name: string;
		paperCount: number;
	}

	let projects: Project[] = $state([]);
	let currentProjectId = $state('');
	let currentProjectName = $derived(
		projects.find((p) => p.id === currentProjectId)?.name || 'Select Project'
	);
	let showProjectDropdown = $state(false);

	const navItems = [
		{ href: '/', label: 'Dashboard', icon: LayoutDashboard },
		{ href: '/search', label: 'Search', icon: Search },
		{ href: '/papers', label: 'Papers', icon: FileText },
		{ href: '/cross-reference', label: 'Cross-Reference', icon: Table },
		{ href: '/journals', label: 'Venues', icon: BookOpen },
		{ href: '/authors', label: 'Authors', icon: Users },
		{ href: '/keywords', label: 'Keywords', icon: Tag },
		{ href: '/analysis', label: 'Analysis', icon: BarChart3 },
		{ href: '/intelligence', label: 'Intelligence', icon: Brain },
		{ href: '/literature-review', label: 'Literature Review', icon: BookMarked },
		{ href: '/jobs', label: 'Jobs', icon: Clock },
		{ href: '/projects', label: 'Projects', icon: FolderOpen }
	];

	onMount(async () => {
		// Load saved project from localStorage
		const saved = localStorage.getItem('currentProjectId');

		const res = await fetch('/api/projects');
		const data = await res.json();
		projects = data.projects || [];

		if (saved && projects.some((p: Project) => p.id === saved)) {
			currentProjectId = saved;
		} else if (projects.length > 0) {
			currentProjectId = projects[0].id;
		}
	});

	function selectProject(id: string) {
		currentProjectId = id;
		localStorage.setItem('currentProjectId', id);
		showProjectDropdown = false;
		// Reload current page data with new project context
		window.location.reload();
	}

	// Make projectId globally accessible
	$effect(() => {
		if (typeof window !== 'undefined' && currentProjectId) {
			(window as any).__currentProjectId = currentProjectId;
		}
	});
</script>

<svelte:head>
	<title>{currentProjectName} - ResearchQ</title>
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
</svelte:head>

<div class="flex h-screen overflow-hidden">
	<!-- Sidebar -->
	<aside class="flex w-64 flex-col border-r border-zinc-200 bg-zinc-50">
		<!-- Logo + Project Selector -->
		<div class="border-b border-zinc-200 px-5 py-4">
			<div class="flex items-center gap-2">
				<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900">
					<Sparkles class="h-4 w-4 text-white" />
				</div>
				<div class="flex-1 min-w-0">
					<h1 class="text-sm font-semibold text-zinc-900">ResearchQ</h1>
				</div>
			</div>

			<!-- Project Selector Dropdown -->
			{#if projects.length > 0}
				<div class="relative mt-3">
					<button
						onclick={() => (showProjectDropdown = !showProjectDropdown)}
						class="flex w-full items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
					>
						<span class="truncate">{currentProjectName}</span>
						<ChevronDown class="h-4 w-4 text-zinc-400 shrink-0" />
					</button>

					{#if showProjectDropdown}
						<div class="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
							{#each projects as project}
								<button
									onclick={() => selectProject(project.id)}
									class="flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-zinc-50 transition-colors {project.id === currentProjectId ? 'bg-zinc-100 font-medium' : ''}"
								>
									<span class="truncate">{project.name}</span>
									<span class="text-xs text-zinc-400">{project.paperCount} papers</span>
								</button>
							{/each}
							<a
								href="/projects/new"
								class="flex w-full items-center gap-2 border-t border-zinc-100 px-3 py-2 text-sm text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition-colors"
							>
								+ New Project
							</a>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Navigation -->
		<nav class="flex-1 space-y-1 overflow-y-auto px-3 py-4">
			{#each navItems as item}
				{@const isActive = $page.url.pathname === item.href || ($page.url.pathname.startsWith(item.href) && item.href !== '/')}
				<a
					href={item.href}
					class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors {isActive
						? 'bg-zinc-900 text-white'
						: 'text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'}"
				>
					<item.icon class="h-4 w-4" />
					{item.label}
				</a>
			{/each}
		</nav>

		<!-- Footer -->
		<div class="border-t border-zinc-200 px-5 py-3">
			<p class="text-xs text-zinc-400">Powered by OpenAlex + Gemini</p>
		</div>
	</aside>

	<!-- Main content -->
	<main class="flex-1 overflow-y-auto">
		<div class="mx-auto max-w-7xl px-6 py-6">
			{@render children()}
		</div>
	</main>
</div>

<!-- Close dropdown when clicking outside -->
{#if showProjectDropdown}
	<button
		class="fixed inset-0 z-40"
		onclick={() => (showProjectDropdown = false)}
		aria-label="Close dropdown"
	></button>
{/if}
