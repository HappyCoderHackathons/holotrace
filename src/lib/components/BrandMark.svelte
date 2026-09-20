<script lang="ts">
	// The Holotrace "H" mark, matching the marketing site's brand-mark geometry
	// (22x22 grid, 6-unit stems, 6-unit crossbar, 2-unit corner radius).
	let { size = 22, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="currentColor"
	class={className}
	role="img"
	aria-label="Holotrace"
>
	<rect x="1" y="1" width="6" height="22" rx="2" />
	<rect x="17" y="1" width="6" height="22" rx="2" />
	<rect x="6" y="9" width="12" height="6" rx="2" />
</svg>
