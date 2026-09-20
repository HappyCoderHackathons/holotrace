import { get, writable } from 'svelte/store';
import { exportDiagram, loadDiagram } from './stores/circuit';

/** What the last import or export did, for the shell to show. Null when there is nothing to say. */
export const fileNotice = writable<{ kind: 'info' | 'error'; text: string } | null>(null);

/** Saves the circuit as `circuit.diagram.json`. */
export function downloadDiagram() {
	const blob = new Blob([JSON.stringify(exportDiagram(), null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = 'circuit.diagram.json';
	link.click();
	// Not at once: some webviews start the download after the click returns, and would find the link gone.
	setTimeout(() => URL.revokeObjectURL(url), 10_000);
	fileNotice.set({ kind: 'info', text: 'Saved circuit.diagram.json' });
}

/** Reads a diagram file into the editor, replacing the circuit. */
export async function importDiagramFile(file: File): Promise<boolean> {
	let input: unknown;
	try {
		input = JSON.parse(await file.text());
	} catch {
		fileNotice.set({ kind: 'error', text: `${file.name} is not a JSON file.` });
		return false;
	}
	const result = loadDiagram(input);
	if ('error' in result) {
		fileNotice.set({ kind: 'error', text: `${file.name}: ${result.error}` });
		return false;
	}
	const extra = result.warnings.length ? ` (${result.warnings.length} problems: ${result.warnings.slice(0, 3).join('; ')})` : '';
	fileNotice.set({ kind: result.warnings.length ? 'error' : 'info', text: `Imported ${file.name}${extra}` });
	return true;
}

export function clearFileNotice() {
	if (get(fileNotice)) fileNotice.set(null);
}
