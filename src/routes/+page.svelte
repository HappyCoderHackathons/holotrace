<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';

    let a = $state<number>(0);
    let b = $state<number>(0);
    let sum = $state<number|undefined>(undefined);
    async function MyOperation() {
        const res = await invoke<number>('sum', {a, b});
        sum = res;
    }
</script>

<svelte:head>
	<title>Tauri + Svelte — Experimentation</title>
</svelte:head>

<main>
	<h1>Tauri + Svelte</h1>
	<p>This is some text ok?</p>

    {#if sum}
        <h3>I got your sum twin!</h3>
        <span>{a} + {b} = {sum}</span>
    {/if}

    <form onsubmit={MyOperation}>
        <label for="num1">Number (A)</label>
        <input id="num1" name="num1" type="number" bind:value={a} required><br>

        <label for="num2">Number (B)</label>
        <input id="num2" name="num2" type="number" bind:value={b} required><br>
        <button type="submit">Get Sum!</button>
    </form>
</main>

<style>
</style>