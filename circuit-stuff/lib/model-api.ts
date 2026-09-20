// Talking to the model API: POST /v0/recognize, as the app does through src-tauri/src/lib.rs.

import { basename, extname } from "node:path";
import type { RecognitionResult } from "../../src/lib/recognition";
import type { LoadedPair } from "./load-pair";
import { IMAGE_TYPES } from "./pairs";

export type ApiConfig = { url: string; key: string };

// The address of the classifier service the way the service itself is configured (classifier/README.md:
// HOLOTRACE_ML_HOST and HOLOTRACE_ML_PORT), for when no other address is given. A machine on this computer or
// on Tailscale is reached directly, over http on the service's port. A public name is reached through its
// web front, over https on the usual port, so the service's own port is not part of the address.
function serviceAddressFromEnv(): string {
    const host = process.env.HOLOTRACE_ML_HOST ?? "";
    if (host === "") return "";
    const name = host === "0.0.0.0" ? "localhost" : host;
    return isTrustedHost(name) ? `http://${name}:${process.env.HOLOTRACE_ML_PORT ?? "8000"}` : `https://${name}`;
}

// Whether traffic to this host stays on this machine or on the Tailscale network, which is encrypted, so
// the bearer key is safe to send over plain http.
function isTrustedHost(hostname: string): boolean {
    if (["localhost", "[::1]"].includes(hostname) || hostname.startsWith("127.")) return true;
    if (hostname.endsWith(".ts.net")) return true;
    const octets = hostname.split(".").map(Number);
    return octets.length === 4 && octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127; // Tailscale's 100.64.0.0/10
}

// The API address (the --url option, HOLOTRACE_MODEL_API_URL, or the service's own HOLOTRACE_ML_HOST and
// HOLOTRACE_ML_PORT from the .env) and bearer key (HOLOTRACE_ML_API_KEY, never a command line option, so it
// stays out of the shell history), or what is wrong with the setup.
export function readApiConfig(urlOption: string | null): ApiConfig | { error: string } {
    const url = (urlOption ?? process.env.HOLOTRACE_MODEL_API_URL ?? serviceAddressFromEnv()).replace(/\/+$/, "");
    const key = process.env.HOLOTRACE_ML_API_KEY ?? "";
    if (url === "") return { error: "set HOLOTRACE_ML_HOST and HOLOTRACE_ML_PORT (or HOLOTRACE_MODEL_API_URL, or pass --url)" };
    if (key === "") return { error: "set HOLOTRACE_ML_API_KEY in the environment (it is not accepted on the command line)" };
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return { error: `${url} is not a web address` };
    }
    if (parsed.protocol !== "https:" && !isTrustedHost(parsed.hostname)) {
        return { error: "refusing to send the bearer key over plain http to a host that is not this machine or on Tailscale; use https" };
    }
    return { url, key };
}

export type Outcome = { ok: true; result: RecognitionResult; seconds: number } | { ok: false; error: string };

// Sends one pair (`image` and `request` as multipart fields) and returns the raw recognition result.
export async function recognize(api: ApiConfig, { pair, image, requestText }: LoadedPair, timeoutSeconds: number): Promise<Outcome> {
    const form = new FormData();
    form.set("image", new Blob([image], { type: IMAGE_TYPES[extname(pair.imagePath).toLowerCase()] }), basename(pair.imagePath));
    form.set("request", requestText);
    const started = performance.now();
    let response: Response;
    try {
        response = await fetch(`${api.url}/v0/recognize`, {
            method: "POST",
            headers: { Authorization: `Bearer ${api.key}` },
            body: form,
            signal: AbortSignal.timeout(timeoutSeconds * 1000),
        });
    } catch (cause) {
        const timedOut = cause instanceof Error && cause.name === "TimeoutError";
        return { ok: false, error: timedOut ? `no answer within ${timeoutSeconds} s` : `could not reach ${api.url}: ${cause instanceof Error ? cause.message : String(cause)}` };
    }
    const seconds = (performance.now() - started) / 1000;
    const text = await response.text();
    if (!response.ok) return { ok: false, error: `HTTP ${response.status}: ${text.slice(0, 500)}` };
    try {
        return { ok: true, result: JSON.parse(text) as RecognitionResult, seconds };
    } catch {
        return { ok: false, error: `the answer was not JSON: ${text.slice(0, 200)}` };
    }
}
