<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		open?: boolean;
		title: string;
		/** Cap as a fraction of the viewport so the canvas stays partly visible. */
		maxHeight?: string;
		onClose?: () => void;
		children: Snippet;
		/** Optional controls rendered inline with the title. */
		actions?: Snippet;
	}

	let {
		open = false,
		title,
		maxHeight = '62vh',
		onClose = () => {},
		children,
		actions
	}: Props = $props();

	let panel = $state<HTMLDivElement | undefined>();
	/** Live drag offset in px. Positive values pull the sheet downwards. */
	let dragY = $state(0);
	/** Reactive because the drag transition is disabled while a drag is live. */
	let dragFrom = $state<number | null>(null);

	const DISMISS_PX = 90;

	// Move focus into the sheet when it opens so keyboard and screen reader
	// users land on the content rather than behind the backdrop. Focus lands on
	// the panel itself unless a child opts in, because focusing the first
	// control would raise the on-screen keyboard every time a sheet with a
	// search field opens.
	$effect(() => {
		if (open && panel) {
			const target = panel.querySelector<HTMLElement>('[data-autofocus]') ?? panel;
			target.focus({ preventScroll: true });
		}
		if (!open) dragY = 0;
	});

	function trapTab(e: KeyboardEvent) {
		if (e.key !== 'Tab' || !panel) return;
		const focusable = panel.querySelectorAll<HTMLElement>(
			'button:not([disabled]), input:not([disabled]), select, a[href], [tabindex]:not([tabindex="-1"])'
		);
		if (focusable.length === 0) return;
		const first = focusable[0];
		const last = focusable[focusable.length - 1];
		if (e.shiftKey && document.activeElement === first) {
			e.preventDefault();
			last.focus();
		} else if (!e.shiftKey && document.activeElement === last) {
			e.preventDefault();
			first.focus();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') {
			e.stopPropagation();
			onClose();
		}
		trapTab(e);
	}

	function grabDown(e: PointerEvent) {
		dragFrom = e.clientY;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}

	function grabMove(e: PointerEvent) {
		if (dragFrom === null) return;
		dragY = Math.max(0, e.clientY - dragFrom);
	}

	function grabUp() {
		if (dragFrom === null) return;
		dragFrom = null;
		if (dragY > DISMISS_PX) onClose();
		dragY = 0;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!--
		The backdrop is deliberately light: on a phone the canvas underneath is
		still the subject, and a heavy scrim makes the sheet feel like a page
		change rather than a drawer.
	-->
	<div
		class="fixed inset-0 z-sheet bg-ink-900/25 backdrop-blur-[1px]"
		role="presentation"
		onclick={onClose}
	></div>

	<div
		bind:this={panel}
		class="fixed inset-x-0 bottom-0 z-sheet flex flex-col rounded-t-2xl border-t border-chrome-600 bg-chrome-800 shadow-sheet"
		style={`max-height:${maxHeight}; transform: translateY(${dragY}px); transition: transform ${
			dragFrom === null ? '180ms' : '0ms'
		} cubic-bezier(0.32, 0.72, 0, 1);`}
		role="dialog"
		aria-modal="true"
		aria-label={title}
		tabindex="-1"
	>
		<div
			class="flex cursor-grab touch-none justify-center py-2.5 active:cursor-grabbing"
			role="presentation"
			onpointerdown={grabDown}
			onpointermove={grabMove}
			onpointerup={grabUp}
			onpointercancel={grabUp}
		>
			<span class="h-1 w-9 rounded-full bg-chrome-500"></span>
		</div>

		<div class="flex items-center justify-between px-4 pb-2">
			<h2 class="panel-label">{title}</h2>
			{#if actions}
				<div class="flex items-center gap-1">{@render actions()}</div>
			{/if}
		</div>

		<div class="thin-scroll flex-1 overflow-y-auto overscroll-contain px-4 pb-safe">
			{@render children()}
		</div>
	</div>
{/if}
