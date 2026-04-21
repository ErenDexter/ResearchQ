<script lang="ts">
	import { Tooltip as T } from 'bits-ui';
	import type { Snippet } from 'svelte';

	interface Props {
		text: string;
		side?: 'top' | 'right' | 'bottom' | 'left';
		children: Snippet;
	}

	let { text, side = 'top', children }: Props = $props();
</script>

<T.Provider delayDuration={150}>
	<T.Root>
		<T.Trigger
			type="button"
			class="inline-flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
			aria-label="More info"
		>
			{@render children()}
		</T.Trigger>
		<T.Portal>
			<T.Content
				{side}
				sideOffset={6}
				class="z-50 max-w-xs rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs leading-relaxed text-zinc-700 shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
			>
				{text}
				<T.Arrow class="text-zinc-200 dark:text-zinc-700" />
			</T.Content>
		</T.Portal>
	</T.Root>
</T.Provider>
