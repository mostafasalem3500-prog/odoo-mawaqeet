/** @odoo-module **/
import { Component, markRaw, onMounted, onWillStart, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { arNum } from "./lib/hijri";
import { normalizeArabic } from "./mawaqeet_service";

const LS_KEY = "mawaqeet.quran.last";
const lsGet = (k, d) => {
    try {
        const v = window.localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
    } catch {
        return d;
    }
};
const lsSet = (k, v) => {
    try {
        window.localStorage.setItem(k, JSON.stringify(v));
    } catch {
        // storage unavailable: ignore
    }
};

export class MawaqeetQuran extends Component {
    static template = "mawaqeet_prayer_times.Quran";
    static props = ["*"];

    setup() {
        this.mw = useService("mawaqeet");
        this.notification = useService("notification");
        this.arNum = arNum;
        this.readerRef = useRef("reader");
        const prefs = lsGet("mawaqeet.quran.prefs", {});
        this.ui = useState({
            index: [],
            juz: [],
            tab: "suras",
            filter: "",
            sura: null,
            loading: true,
            mode: prefs.mode || "mushaf",
            fontSize: prefs.fontSize || 30,
            openTafsir: {},
            activeAyah: null,
            query: "",
            results: null,
            searching: false,
            bookmarks: [],
            sidebar: false,
            page: "",
        });
        onWillStart(async () => {
            const [index, juz] = await Promise.all([this.mw.quranIndex(), this.mw.juzIndex()]);
            this.ui.index = markRaw(index);
            this.ui.juz = markRaw(juz);
            this.basmala = null;
            const params = (this.props.action && this.props.action.params) || {};
            const last = lsGet(LS_KEY, { sura: 1, ayah: 1 });
            const target = params.sura ? { sura: params.sura, ayah: params.ayah || 1 } : last;
            await this.openSura(target.sura, target.ayah, !!params.sura || target.ayah > 1);
            this.loadBookmarks();
        });
        onMounted(() => this.scrollPending());
    }

    savePrefs() {
        lsSet("mawaqeet.quran.prefs", { mode: this.ui.mode, fontSize: this.ui.fontSize });
    }

    get filteredSuras() {
        const f = normalizeArabic(this.ui.filter);
        if (!f) {
            return this.ui.index;
        }
        return this.ui.index.filter(
            (s) => normalizeArabic(s.ar).includes(f) || String(s.n) === f || s.en.toLowerCase().includes(f.toLowerCase())
        );
    }
    get suraMeta() {
        return this.ui.sura && this.ui.index[this.ui.sura.n - 1];
    }
    get showBasmala() {
        return this.ui.sura && this.ui.sura.n !== 1 && this.ui.sura.n !== 9;
    }

    async openSura(n, ayah = 1, scroll = false) {
        n = Math.max(1, Math.min(114, n));
        this.ui.loading = true;
        if (!this.basmala) {
            const f = await this.mw.sura(1);
            this.basmala = f.ayat[0].t.replace(/[\s ][٠-٩]+$/, "");
        }
        this.ui.sura = markRaw(await this.mw.sura(n));
        this.ui.openTafsir = {};
        this.ui.activeAyah = scroll ? ayah : null;
        this.ui.loading = false;
        this.ui.sidebar = false;
        lsSet(LS_KEY, { sura: n, ayah });
        this._pendingScroll = scroll ? ayah : 0;
        this.scrollPending();
    }
    scrollPending() {
        const el = this.readerRef.el;
        if (!el) {
            return;
        }
        setTimeout(() => {
            if (this._pendingScroll) {
                const target = el.querySelector(`[data-ayah="${this._pendingScroll}"]`);
                if (target) {
                    target.scrollIntoView({ block: "center", behavior: "smooth" });
                }
                this._pendingScroll = 0;
            } else {
                el.scrollTop = 0;
            }
        }, 60);
    }
    async goPage(ev) {
        if (ev && ev.key && ev.key !== "Enter") {
            return;
        }
        const n = parseInt(String(this.ui.page).replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d)), 10);
        if (!n || n < 1 || n > 604) {
            this.notification.add("أدخل رقم صفحة من ١ إلى ٦٠٤", { type: "warning" });
            return;
        }
        const pages = await this.mw.fetchJson("quran/pages.json");
        const [s, a] = pages[n - 1];
        this.ui.results = null;
        this.openSura(s, a, a > 1);
    }
    openJuz(j) {
        const [s, a] = this.ui.juz[j - 1];
        this.openSura(s, a, a > 1);
    }

    // ---- ayah interactions ----
    selectAyah(a) {
        this.ui.activeAyah = this.ui.activeAyah === a.a ? null : a.a;
        lsSet(LS_KEY, { sura: this.ui.sura.n, ayah: a.a });
    }
    toggleTafsir(a) {
        this.ui.openTafsir[a.a] = !this.ui.openTafsir[a.a];
    }
    get activeAyahObj() {
        return this.ui.sura && this.ui.activeAyah ? this.ui.sura.ayat[this.ui.activeAyah - 1] : null;
    }
    plain(t) {
        return t.replace(/[\s ][٠-٩]+$/, "");
    }
    async copyAyah(a) {
        const txt = `﴿${this.plain(a.t)}﴾ [${this.ui.sura.ar}: ${arNum(a.a)}]`;
        try {
            await navigator.clipboard.writeText(txt);
            this.notification.add("تم نسخ الآية مع مرجعها", { type: "success" });
        } catch {
            this.notification.add("تعذّر النسخ في هذا المتصفح", { type: "warning" });
        }
    }
    isBookmarked(a) {
        return this.ui.bookmarks.some((b) => b.kind === "ayah" && b.sura === this.ui.sura.n && b.ayah === a.a);
    }
    async loadBookmarks() {
        try {
            this.ui.bookmarks = await this.mw.bookmarks();
        } catch {
            this.ui.bookmarks = [];
        }
    }
    async toggleBookmark(a) {
        const on = await this.mw.toggleBookmark({
            kind: "ayah",
            name: `سورة ${this.ui.sura.ar} — الآية ${arNum(a.a)}`,
            sura: this.ui.sura.n,
            ayah: a.a,
            excerpt: this.plain(a.t),
        });
        this.notification.add(on ? "أُضيفت الآية إلى مفضلتك" : "أُزيلت الآية من مفضلتك", { type: "info" });
        this.loadBookmarks();
    }
    get ayahBookmarks() {
        return this.ui.bookmarks.filter((b) => b.kind === "ayah");
    }

    // ---- search ----
    async search(ev) {
        if (ev && ev.key && ev.key !== "Enter") {
            return;
        }
        const q = normalizeArabic(this.ui.query);
        if (q.length < 2) {
            this.ui.results = null;
            return;
        }
        this.ui.searching = true;
        const idx = await this.mw.quranSearchIndex();
        if (!this._norm) {
            this._norm = idx.map((r) => normalizeArabic(r[2]));
        }
        const res = [];
        let total = 0;
        for (let i = 0; i < idx.length; i++) {
            const pos = this._norm[i].indexOf(q);
            if (pos >= 0) {
                total++;
                if (res.length < 150) {
                    const [s, a, text] = idx[i];
                    res.push({ key: `${s}:${a}`, s, a, name: this.ui.index[s - 1].ar, text });
                }
            }
        }
        this.ui.results = { q: this.ui.query, total, items: res };
        this.ui.searching = false;
    }
    clearSearch() {
        this.ui.query = "";
        this.ui.results = null;
    }
    openResult(r) {
        this.ui.results = null;
        this.openSura(r.s, r.a, true);
    }
    font(delta) {
        this.ui.fontSize = Math.max(18, Math.min(56, this.ui.fontSize + delta));
        this.savePrefs();
    }
    setMode(m) {
        this.ui.mode = m;
        this.savePrefs();
    }
}

registry.category("actions").add("mawaqeet.quran", MawaqeetQuran);
