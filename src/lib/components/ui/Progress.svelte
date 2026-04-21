<script lang="ts">
	import { cn } from '$lib/utils';

	interface Props {
		value: number;
		max?: number;
		class?: string;
	}

	let { value, max = 100, class: className }: Props = $props();

	const percentage = $derived(Math.min((value / max) * 100, 100));
</script>

<div class={cn('relative h-3 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800', className)}>
	<div
		class="h-full rounded-full bg-zinc-900 transition-all duration-500 ease-out dark:bg-zinc-50"
		style="width: {percentage}%"
	></div>
</div>
