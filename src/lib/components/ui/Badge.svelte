<script lang="ts">
	import { cn } from '$lib/utils';
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	type Variant = 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning';

	interface Props extends HTMLAttributes<HTMLSpanElement> {
		variant?: Variant;
		class?: string;
		children?: Snippet;
	}

	let { variant = 'default', class: className, children, ...restProps }: Props = $props();

	const variantClasses: Record<Variant, string> = {
		default: 'border-transparent bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900',
		secondary: 'border-transparent bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
		destructive: 'border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
		outline: 'text-zinc-900 dark:text-zinc-100',
		success: 'border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100',
		warning: 'border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100'
	};
</script>

<span
	class={cn(
		'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
		variantClasses[variant],
		className
	)}
	{...restProps}
>
	{@render children?.()}
</span>
