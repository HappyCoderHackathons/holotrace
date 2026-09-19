<script lang="ts">
	import { Download } from 'lucide-svelte';
	import { circuit } from '$lib/stores/circuit';
	import { COMPONENT_DISPLAY_NAME } from '$lib/componentLibrary';

	const rows = $derived.by(() => {
		const counts = new Map<string, { refIds: string[]; type: string; count: number }>();
		for (const c of $circuit.components) {
			const displayType = COMPONENT_DISPLAY_NAME[c.type];
			const groupKey = `${displayType}:${c.value ?? ''}`;
			if (!counts.has(groupKey)) counts.set(groupKey, { refIds: [], type: displayType, count: 0 });
			const entry = counts.get(groupKey)!;
			entry.refIds.push(c.refId);
			entry.count += 1;
		}
		return Array.from(counts.values()).map((entry) => ({
			name: entry.refIds.sort().join(', '),
			quantity: entry.count,
			type: entry.type
		}));
	});

	function downloadCsv() {
		const header = 'Name,Quantity,Component\n';
		const body = rows.map((r) => `"${r.name}",${r.quantity},"${r.type}"`).join('\n');
		const blob = new Blob([header + body], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'holotrace-components.csv';
		a.click();
		URL.revokeObjectURL(url);
	}
</script>

<div class="flex h-full flex-col overflow-y-auto bg-surface-50 p-8">
	<div class="mx-auto w-full max-w-3xl">
		<div class="flex items-center justify-between border-b border-surface-200 pb-4">
			<h1 class="text-lg font-semibold text-ink-300">Component List</h1>
			<button
				class="flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3.5 py-2 text-sm font-medium text-ink-700 hover:bg-surface-100"
				onclick={downloadCsv}
			>
				<Download size={15} />
				Download CSV
			</button>
		</div>

		<div class="mt-6 overflow-hidden rounded-lg border border-surface-200 bg-white shadow-panel">
			<table class="w-full text-sm">
				<thead>
					<tr class="bg-surface-200/70 text-left text-ink-700">
						<th class="px-6 py-3 font-semibold">Name</th>
						<th class="px-6 py-3 font-semibold">Quantity</th>
						<th class="px-6 py-3 font-semibold">Component</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as row (row.name)}
						<tr class="border-t border-surface-200">
							<td class="px-6 py-3 text-ink-900">{row.name}</td>
							<td class="px-6 py-3 text-ink-900">{row.quantity}</td>
							<td class="px-6 py-3 text-ink-900">{row.type}</td>
						</tr>
					{/each}
					{#if rows.length === 0}
						<tr>
							<td colspan="3" class="px-6 py-8 text-center text-ink-300">No components detected yet.</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
