/** @odoo-module **/
import { Component, markRaw, onWillStart, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { arNum } from "./lib/hijri";

/**
 * Morning & evening adhkar (Hisn Al-Muslim) with a tap counter per dhikr.
 * type 0 = both, 1 = morning only, 2 = evening only.
 */
export class MawaqeetAdhkar extends Component {
    static template = "mawaqeet_prayer_times.Adhkar";
    static props = ["*"];

    setup() {
        this.mw = useService("mawaqeet");
        this.notification = useService("notification");
        this.arNum = arNum;
        this.state = useState(this.mw.state);
        this.ui = useState({ book: null, tab: null, done: {}, open: {} });
        onWillStart(async () => {
            await this.mw.ready();
            this.ui.book = markRaw(await this.mw.adhkar());
            const params = (this.props.action && this.props.action.params) || {};
            this.ui.tab = params.tab || this.defaultTab;
        });
    }

    /** Morning from Fajr until Dhuhr, evening from Asr until the next Fajr. */
    get defaultTab() {
        const t = this.state.times && this.state.times.ts;
        if (!t) {
            return "morning";
        }
        const now = this.state.now;
        return now >= t.fajr && now < t.asr ? "morning" : "evening";
    }
    get items() {
        const wanted = this.ui.tab === "morning" ? 1 : 2;
        return this.ui.book ? this.ui.book.items.filter((x) => x.k === 0 || x.k === wanted) : [];
    }
    remaining(x) {
        return Math.max(0, x.n - (this.ui.done[x.i] || 0));
    }
    isDone(x) {
        return this.remaining(x) === 0;
    }
    tap(x) {
        if (this.isDone(x)) {
            return;
        }
        this.ui.done[x.i] = (this.ui.done[x.i] || 0) + 1;
        if (navigator.vibrate) {
            try {
                navigator.vibrate(15);
            } catch {
                // ignore
            }
        }
        if (this.progress === 1) {
            this.notification.add(
                this.ui.tab === "morning"
                    ? "أتممت أذكار الصباح، تقبّل الله منك"
                    : "أتممت أذكار المساء، تقبّل الله منك",
                { type: "success" }
            );
        }
    }
    toggle(x) {
        this.ui.open[x.i] = !this.ui.open[x.i];
    }
    get progress() {
        // Each dhikr weighs the same, whatever its repetition count.
        const items = this.items;
        const done = items.reduce((s, x) => s + Math.min(1, (this.ui.done[x.i] || 0) / x.n), 0);
        return items.length ? done / items.length : 0;
    }
    get ringDash() {
        const c = 2 * Math.PI * 52;
        return `${(c * this.progress).toFixed(1)} ${c.toFixed(1)}`;
    }
    get progressPct() {
        return Math.round(this.progress * 100);
    }
    setTab(tab) {
        this.ui.tab = tab;
        this.ui.done = {};
        this.ui.open = {};
    }
    reset() {
        this.ui.done = {};
    }
    async copy(x) {
        try {
            await navigator.clipboard.writeText(`${x.t}\n[حصن المسلم]`);
            this.notification.add("تم نسخ الذكر", { type: "success" });
        } catch {
            this.notification.add("تعذّر النسخ في هذا المتصفح", { type: "warning" });
        }
    }
}

registry.category("actions").add("mawaqeet.adhkar", MawaqeetAdhkar);
