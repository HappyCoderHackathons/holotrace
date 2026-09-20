// Deciding when the circuit has been held still long enough to take the screenshot. Shared by the live camera in the
// app and on the dev page.

import { iou, type Rect } from "./boxes";
import { HOLD_DRAIN, STABLE_IOU } from "./config";

// Watches the circuit box over time like a charge meter. Every frame the circuit is seen holding still it charges, and
// every frame it is missing or has moved it drains (at HOLD_DRAIN times the charging speed) instead of starting over.
// The screenshot is taken when the charge is full.
export class HoldMeter {
    box: Rect | null = null;
    charge = 0;
    last = 0;
    captured = false;

    reset() {
        this.box = null;
        this.charge = 0;
        this.captured = false;
    }

    // Feeds one frame's circuit box (or null if there is none). Returns true on the frame the screenshot should be
    // taken, once `holdMs` of holding still has been charged.
    track(box: Rect | null, now: number, holdMs: number): boolean {
        const dt = this.last === 0 ? 0 : now - this.last;
        this.last = now;
        const steady = box !== null && this.box !== null && iou(this.box, box) >= STABLE_IOU;
        this.charge = steady ? this.charge + dt : Math.max(0, this.charge - dt * HOLD_DRAIN);
        if (box !== null) this.box = box;
        if (this.charge === 0 && box === null) this.reset();
        const fire = !this.captured && this.charge >= holdMs;
        if (fire) this.captured = true;
        return fire;
    }

    // How full the charge is, 0 to 1, for a progress display.
    progress(holdMs: number): number {
        return Math.min(1, this.charge / holdMs);
    }
}
