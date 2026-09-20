<script lang="ts">
	import { ChevronLeft, ChevronRight } from 'lucide-svelte';
	import type { Snippet } from 'svelte';

	interface Props {
		title: string;
		side: 'left' | 'right';
		open?: boolean;
		width?: string;
		onToggle?: (open: boolean) => void;
		children: Snippet;
	}

	let { title, side, open = true, width = 'w-64', onToggle = () => {}, children }: Props = $props();

	// The chevron always points the way the panel will move.
	const CollapseIcon = $derived(side === 'left' ? ChevronLeft : ChevronRight);
	const ExpandIcon = $derived(side === 'left' ? ChevronRight : ChevronLeft);
</script>

{#if open}
	<aside
		class="flex flex-shrink-0 flex-col bg-chrome-800 {width}"
		class:border-r={side === 'left'}
		class:border-l={side === 'right'}
		class:border-chrome-600={true}
		aria-label={title}
	>
		<div
			class="flex h-11 flex-shrink-0 items-center justify-between border-b border-chrome-600 px-4"
			class:flex-row-reverse={side === 'right'}
		>
			<h2 class="panel-label">{title}</h2>
			<button
				class="rounded-md p-1 text-chrome-300 transition-colors hover:bg-chrome-700 hover:text-chrome-100"
				aria-label={`Collapse ${title.toLowerCase()} panel`}
				onclick={() => onToggle(false)}
			>
				<CollapseIcon size={16} />
			</button>
		</div>

		<div class="thin-scroll min-h-0 flex-1 overflow-y-auto px-4 py-3">
			{@render children()}
		</div>
	</aside>
{:else}
	<button
		class="group flex w-9 flex-shrink-0 flex-col items-center gap-3 bg-chrome-800 py-3 transition-colors hover:bg-chrome-700"
		class:border-r={side === 'left'}
		class:border-l={side === 'right'}
		class:border-chrome-600={true}
		aria-label={`Expand ${title.toLowerCase()} panel`}
		aria-expanded="false"
		onclick={() => onToggle(true)}
	>
		<ExpandIcon size={16} class="text-chrome-300 group-hover:text-chrome-100" />
		<span
			class="panel-label whitespace-nowrap group-hover:text-chrome-200"
			style="writing-mode: vertical-rl; {side === 'left' ? '' : 'transform: rotate(180deg);'}"
		>
			{title}
		</span>
	</button>
{/if}
