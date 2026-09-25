/** @odoo-module **/
import { Component, markRaw, onWillStart, useRef, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { arNum } from "./lib/hijri";
import { normalizeArabic } from "./mawaqeet_service";

const BOOKS = [
    { key: "nawawi40", title: "الأربعون النووية", desc: "٤٢ حديثًا جامعًا لأصول الدين" },
    { key: "riyad", title: "رياض الصالحين", desc: "١٨٩٦ حديثًا — الترقيم المعتمد في sunnah.com" },
];
const PAGE = 40;

export class MawaqeetHadith extends Component {
    static template = "mawaqeet_prayer_times.Hadith";
    static props = ["*"];

    setup() {
        this.mw = useService("mawaqeet");
        this.notification = useService("notification");
        this.arNum = arNum;
        this.books = BOOKS;
        this.listRef = useRef("list");
        this.ui = useState({
            book: null,
            chapter: null,
            query: "",
            limit: PAGE,
            focus: null,
            bookmarks: [],
            loading: true,
            sidebar: false,
        });
        onWillStart(async () => {
            const params = (this.props.action && this.props.action.params) || {};
            await this.openBook(params.book || "nawawi40", params.number);
            this.loadBookmarks();
        });
    }

    async openBook(key, number = null) {
        this.ui.loading = true;
        const data = await this.mw.hadithBook(key);
        this._norm = null;
        this.ui.book = markRaw(data);
        this.ui.query = "";
        this.ui.limit = PAGE;
        this.ui.chapter = null;
        this.ui.focus = number || null;
        if (number) {
            const h = data.hadiths.find((x) => x.i === number);
            if (h) {
                this.ui.chapter = data.chapters.length > 1 ? h.c : null;
                const inChapter = data.hadiths.filter((x) => this.ui.chapter === null || x.c === this.ui.chapter);
                const pos = inChapter.indexOf(h);
                this.ui.limit = Math.max(PAGE, pos + 10);
            }
        }
        this.ui.loading = false;
        this.ui.sidebar = false;
        this.scrollToFocus();
    }
    scrollToFocus() {
        setTimeout(() => {
            const el = this.listRef.el;
            if (!el) {
                return;
            }
            if (this.ui.focus) {
                const t = el.querySelector(`[data-hadith="${this.ui.focus}"]`);
                if (t) {
                    t.scrollIntoView({ block: "center", behavior: "smooth" });
                }
            } else {
                el.scrollTop = 0;
            }
        }, 80);
    }
    selectChapter(id) {
        this.ui.chapter = id;
        this.ui.limit = PAGE;
        this.ui.focus = null;
        this.ui.sidebar = false;
        this.scrollToFocus();
    }
    chapterCount(id) {
        return this.ui.book.hadiths.filter((h) => h.c === id).length;
    }
    get filtered() {
        const b = this.ui.book;
        if (!b) {
            return [];
        }
        const q = normalizeArabic(this.ui.query);
        if (q.length >= 2) {
            if (!this._norm) {
                this._norm = b.hadiths.map((h) => normalizeArabic(h.t));
            }
            return b.hadiths.filter((h, i) => this._norm[i].includes(q));
        }
        if (this.ui.chapter !== null && b.chapters.length > 1) {
            return b.hadiths.filter((h) => h.c === this.ui.chapter);
        }
        return b.hadiths;
    }
    get visible() {
        return this.filtered.slice(0, this.ui.limit);
    }
    get chapterTitle() {
        const b = this.ui.book;
        if (normalizeArabic(this.ui.query).length >= 2) {
            return `نتائج البحث: ${arNum(this.filtered.length)} حديث`;
        }
        if (this.ui.chapter === null || b.chapters.length <= 1) {
            return b.title;
        }
        return b.chapters.find((c) => c.id === this.ui.chapter).title;
    }
    more() {
        this.ui.limit += PAGE;
    }
    onSearch() {
        this.ui.limit = PAGE;
        this.ui.focus = null;
    }

    async copy(h) {
        const txt = `${h.t}\n[${this.ui.book.title} — رقم ${arNum(h.i)}]`;
        try {
            await navigator.clipboard.writeText(txt);
            this.notification.add("تم نسخ الحديث مع مصدره", { type: "success" });
        } catch {
            this.notification.add("تعذّر النسخ في هذا المتصفح", { type: "warning" });
        }
    }
    dorarLink(text) {
        const words = text
            .replace(/[^ء-ي\s]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length > 2)
            .slice(6, 12)
            .join(" ");
        return `https://dorar.net/hadith/search?q=${encodeURIComponent(words)}`;
    }
    async loadBookmarks() {
        try {
            this.ui.bookmarks = await this.mw.bookmarks();
        } catch {
            this.ui.bookmarks = [];
        }
    }
    isBookmarked(h) {
        return this.ui.bookmarks.some((b) => b.kind === "hadith" && b.book === this.ui.book.key && b.number === h.i);
    }
    async toggleBookmark(h) {
        const on = await this.mw.toggleBookmark({
            kind: "hadith",
            name: `${this.ui.book.title} — حديث ${arNum(h.i)}`,
            book: this.ui.book.key,
            number: h.i,
            excerpt: h.t,
        });
        this.notification.add(on ? "أُضيف الحديث إلى مفضلتك" : "أُزيل الحديث من مفضلتك", { type: "info" });
        this.loadBookmarks();
    }
    get hadithBookmarks() {
        return this.ui.bookmarks.filter((b) => b.kind === "hadith");
    }
    openBookmark(b) {
        this.openBook(b.book, b.number);
    }
}

registry.category("actions").add("mawaqeet.hadith", MawaqeetHadith);
