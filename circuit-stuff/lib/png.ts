// A small PNG decoder, so the script can look at the ink in an image the way the app does. Bun has no image
// decoder of its own. It reads 8-bit, non-interlaced PNGs of any colour type, which covers what the OpenCV
// dev page and canvas.toBlob produce.

import { inflateSync } from "node:zlib";

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

export function isPng(bytes: Uint8Array): boolean {
    return SIGNATURE.every((value, n) => bytes[n] === value);
}

// The PNG's pixels as RGBA, row by row. Throws if it is not a PNG this decoder reads.
export function decodePng(bytes: Uint8Array): { width: number; height: number; rgba: Uint8Array } {
    if (!isPng(bytes)) throw new Error("not a PNG");
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let width = 0;
    let height = 0;
    let colorType = -1;
    const compressed: Uint8Array[] = [];
    let palette: Uint8Array = new Uint8Array(0);
    for (let at = 8; at + 8 <= bytes.length; ) {
        const length = view.getUint32(at);
        const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
        const data = bytes.subarray(at + 8, at + 8 + length);
        if (type === "IHDR") {
            width = view.getUint32(at + 8);
            height = view.getUint32(at + 12);
            colorType = data[9];
            if (data[8] !== 8) throw new Error(`${data[8]}-bit PNGs are not supported (8-bit only)`);
            if (data[12] !== 0) throw new Error("interlaced PNGs are not supported");
        } else if (type === "PLTE") palette = data;
        else if (type === "IDAT") compressed.push(data);
        else if (type === "IEND") break;
        at += 12 + length;
    }
    const channels = CHANNELS[colorType];
    if (channels === undefined || width === 0 || height === 0) throw new Error("the PNG header is not one this decoder reads");

    const raw = inflateSync(Buffer.concat(compressed));
    const stride = width * channels;
    const pixels = new Uint8Array(height * stride);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const source = y * (stride + 1) + 1;
        const row = y * stride;
        for (let x = 0; x < stride; x++) {
            const left = x >= channels ? pixels[row + x - channels] : 0;
            const up = y > 0 ? pixels[row - stride + x] : 0;
            const upLeft = y > 0 && x >= channels ? pixels[row - stride + x - channels] : 0;
            let predicted = 0;
            if (filter === 1) predicted = left;
            else if (filter === 2) predicted = up;
            else if (filter === 3) predicted = (left + up) >> 1;
            else if (filter === 4) {
                const p = left + up - upLeft;
                const dLeft = Math.abs(p - left);
                const dUp = Math.abs(p - up);
                const dUpLeft = Math.abs(p - upLeft);
                predicted = dLeft <= dUp && dLeft <= dUpLeft ? left : dUp <= dUpLeft ? up : upLeft;
            }
            pixels[row + x] = (raw[source + x] + predicted) & 0xff;
        }
    }

    const rgba = new Uint8Array(width * height * 4);
    for (let n = 0; n < width * height; n++) {
        const at = n * channels;
        let r: number, g: number, b: number, a = 255;
        if (colorType === 6) [r, g, b, a] = [pixels[at], pixels[at + 1], pixels[at + 2], pixels[at + 3]];
        else if (colorType === 2) [r, g, b] = [pixels[at], pixels[at + 1], pixels[at + 2]];
        else if (colorType === 0) r = g = b = pixels[at];
        else if (colorType === 4) {
            r = g = b = pixels[at];
            a = pixels[at + 1];
        } else [r, g, b] = [palette[pixels[at] * 3], palette[pixels[at] * 3 + 1], palette[pixels[at] * 3 + 2]];
        rgba.set([r, g, b, a], n * 4);
    }
    return { width, height, rgba };
}
