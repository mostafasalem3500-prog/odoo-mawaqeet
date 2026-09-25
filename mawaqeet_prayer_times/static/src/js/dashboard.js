/** @odoo-module **/
import { Component, onMounted, onWillStart, onWillUnmount, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { distanceToKaaba, PRAYERS, qiblaBearing } from "./lib/prayer_times";
import {
    addDays,
    arNum,
    formatGregorian,
    formatHijri,
    GREG_MONTHS,
    HIJRI_MONTHS,
    toHijri,
    upcomingOccasions,
    WEEKDAYS,
} from "./lib/hijri";
import { dayIndex, fmtCountdown, fmtTime } from "./mawaqeet_service";

export class MawaqeetDashboard extends Component {
    static template = "mawaqeet_prayer_times.Dashboard";
    static props = ["*"];

    setup() {
        this.mw = useService("mawaqeet");
        this.action = useService("action");
        this.notification = useService("notification");
        this.state = useState(this.mw.state);
        this.ui = useState({
            ayah: null,
            hadith: null,
            showTafsir: false,
            heading: null,
            compassOn: false,
            month: null,
            monthOffset: 0,
            occasions: [],
        });
        this.prayers = PRAYERS;
        this.arNum = arNum;
        onWillStart(async () => {
            await this.mw.ready();
            this.buildMonth();
            this.loadDaily();
            this.ui.occasions = upcomingOccasions(this.state.today, this.cfg.hijri_adjust, 4).map((o) => ({
                key: `${o.year}-${o.m}-${o.d}`,
                name: o.name,
                fast: o.fast,
                days: o.days,
                hijri: `${arNum(o.d)} ${HIJRI_MONTHS[o.m - 1]} ${arNum(o.year)}هـ`,
                greg: formatGregorian(o.greg.y, o.greg.m, o.greg.d),
            }));
        });
        this._orient = (ev) => {
            let h = null;
            if (typeof ev.webkitCompassHeading === "number") {
                h = ev.webkitCompassHeading;
            } else if (ev.absolute && typeof ev.alpha === "number") {
                h = 360 - ev.alpha;
            }
            if (h !== null) {
                this.ui.heading = h;
            }
        };
        onMounted(() => {});
        onWillUnmount(() => {
            window.removeEventListener("deviceorientationabsolute", this._orient);
            window.removeEventListener("deviceorientation", this._orient);
        });
    }

    // ---------- header ----------
    get cfg() {
        return this.state.config;
    }
    get weekday() {
        return WEEKDAYS[this.state.today.wd];
    }
    get gregorian() {
        const t = this.state.today;
        return formatGregorian(t.y, t.m, t.d);
    }
    get hijri() {
        return formatHijri(this.state.hijri);
    }
    get countdown() {
        return fmtCountdown(this.state.next.ts - this.state.now);
    }
    get progress() {
        const cur = this.state.current && this.state.current.ts;
        const nxt = this.state.next.ts;
        if (!cur || cur >= nxt) {
            return 0;
        }
        return Math.min(1, Math.max(0, (this.state.now - cur) / (nxt - cur)));
    }
    get ringDash() {
        const c = 2 * Math.PI * 88;
        return `${(c * this.progress).toFixed(1)} ${c.toFixed(1)}`;
    }
    get isRamadan() {
        return this.state.hijri && this.state.hijri.month === 9;
    }
    get isFriday() {
        return this.state.today.wd === 5;
    }
    time(key) {
        return fmtTime(this.state.times.ts[key], this.cfg.tz);
    }
    iqama(key) {
        const ts = this.mw.iqamaTs(key);
        return ts ? fmtTime(ts, this.cfg.tz) : "";
    }
    /** Suggest morning adhkar between Fajr and Dhuhr, evening adhkar between Asr and Isha. */
    get adhkarPrompt() {
        const t = this.state.times.ts;
        const now = this.state.now;
        if (now >= t.fajr && now < t.dhuhr) {
            return { tab: "morning", label: "حان وقت أذكار الصباح" };
        }
        if (now >= t.asr && now < t.isha) {
            return { tab: "evening", label: "حان وقت أذكار المساء" };
        }
        return null;
    }
    /** Sunnah fasting reminder for tomorrow (Monday/Thursday or the White Days). */
    get fastingHint() {
        const tm = addDays(this.state.today, 1);
        const h = toHijri(tm.y, tm.m, tm.d, this.cfg.hijri_adjust);
        if (!h || h.month === 9 || (h.month === 10 && h.day === 1) || (h.month === 12 && h.day >= 10 && h.day <= 13)) {
            return null;
        }
        if (h.month === 12 && h.day === 9) {
            return "غدًا يوم عرفة — يُستحب صيامه لغير الحاج";
        }
        if (h.month === 1 && (h.day === 9 || h.day === 10)) {
            return h.day === 10 ? "غدًا يوم عاشوراء — يُستحب صيامه" : "غدًا تاسوعاء — يُستحب صيامه مع عاشوراء";
        }
        if (h.day >= 13 && h.day <= 15) {
            return "غدًا من الأيام البيض (١٣، ١٤، ١٥) — يُستحب صيامها";
        }
        if (tm.wd === 1) {
            return "غدًا الإثنين — يُستحب صيامه";
        }
        if (tm.wd === 4) {
            return "غدًا الخميس — يُستحب صيامه";
        }
        return null;
    }
    openAdhkar(tab) {
        this.action.doAction({ type: "ir.actions.client", tag: "mawaqeet.adhkar", params: { tab } });
    }
    openKahf() {
        this.action.doAction({ type: "ir.actions.client", tag: "mawaqeet.quran", params: { sura: 18 } });
    }
    cardClass(p) {
        const n = this.state.next;
        const passed = this.state.times.ts[p.key] <= this.state.now;
        return [
            "o_mw_prayer",
            n && n.key === p.key && !n.tomorrow ? "o_mw_prayer_next" : "",
            passed ? "o_mw_prayer_passed" : "",
            p.notPrayer ? "o_mw_prayer_aux" : "",
        ].join(" ");
    }
    get methodLabel() {
        return {
            umm_al_qura: "تقويم أم القرى — مكة المكرمة",
            mwl: "رابطة العالم الإسلامي",
            egyptian: "الهيئة المصرية العامة للمساحة",
            karachi: "جامعة العلوم الإسلامية بكراتشي",
            isna: "الجمعية الإسلامية لأمريكا الشمالية",
            dubai: "دبي",
            kuwait: "الكويت",
            qatar: "قطر",
            singapore: "سنغافورة / ماليزيا / إندونيسيا",
            turkey: "رئاسة الشؤون الدينية التركية",
        }[this.cfg.method];
    }

    // ---------- qibla ----------
    get qibla() {
        return qiblaBearing(this.cfg.lat, this.cfg.lng);
    }
    get qiblaText() {
        return `${arNum(Math.round(this.qibla))}°`;
    }
    get distance() {
        const km = distanceToKaaba(this.cfg.lat, this.cfg.lng);
        return km < 1 ? "أنت في رحاب المسجد الحرام" : `${arNum(Math.round(km).toLocaleString("en"))} كم إلى الكعبة المشرفة`;
    }
    get dialRotation() {
        return this.ui.heading === null ? 0 : -this.ui.heading;
    }
    get facingQibla() {
        if (this.ui.heading === null) {
            return false;
        }
        const diff = Math.abs(((this.ui.heading - this.qibla + 540) % 360) - 180);
        return diff < 5;
    }
    async enableCompass() {
        try {
            if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission) {
                const res = await DeviceOrientationEvent.requestPermission();
                if (res !== "granted") {
                    throw new Error("denied");
                }
            }
            if (typeof DeviceOrientationEvent === "undefined") {
                throw new Error("unsupported");
            }
            window.addEventListener("deviceorientationabsolute", this._orient);
            window.addEventListener("deviceorientation", this._orient);
            this.ui.compassOn = true;
            setTimeout(() => {
                if (this.ui.heading === null) {
                    this.notification.add("لم يُرصد حساس بوصلة في هذا الجهاز. استخدم الجوال لتحديد القبلة مباشرة.", {
                        type: "warning",
                    });
                }
            }, 2500);
        } catch {
            this.notification.add("تعذّر تشغيل البوصلة على هذا الجهاز.", { type: "warning" });
        }
    }

    // ---------- verse & hadith of the day ----------
    async loadDaily() {
        const today = this.state.today;
        try {
            const idx = await this.mw.quranSearchIndex();
            let i = dayIndex(today, idx.length, 1);
            for (let guard = 0; guard < 200; guard++) {
                const len = idx[i][2].length;
                if (len >= 40 && len <= 230) {
                    break;
                }
                i = (i + 97) % idx.length;
            }
            const [s, a] = idx[i];
            const sura = await this.mw.sura(s);
            const ay = sura.ayat[a - 1];
            this.ui.ayah = { sura: s, ayah: a, name: sura.ar, text: ay.t, tafsir: ay.m };
        } catch {
            this.ui.ayah = null;
        }
        try {
            const useNawawi = dayIndex(today, 2, 3) === 0;
            const book = await this.mw.hadithBook(useNawawi ? "nawawi40" : "riyad");
            const pool = book.hadiths.filter((h) => h.t.length <= (useNawawi ? 2000 : 520));
            const h = pool[dayIndex(today, pool.length, 2)];
            this.ui.hadith = { book: book.key, title: book.title, number: h.i, text: h.t };
        } catch {
            this.ui.hadith = null;
        }
    }
    openAyah() {
        this.action.doAction({
            type: "ir.actions.client",
            tag: "mawaqeet.quran",
            params: { sura: this.ui.ayah.sura, ayah: this.ui.ayah.ayah },
        });
    }
    openHadith() {
        this.action.doAction({
            type: "ir.actions.client",
            tag: "mawaqeet.hadith",
            params: { book: this.ui.hadith.book, number: this.ui.hadith.number },
        });
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

    // ---------- monthly timetable ----------
    buildMonth() {
        const t = this.state.today;
        const base = new Date(Date.UTC(t.y, t.m - 1 + this.ui.monthOffset, 1));
        const y = base.getUTCFullYear();
        const m = base.getUTCMonth() + 1;
        const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
        const rows = [];
        for (let d = 1; d <= days; d++) {
            const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
            const date = { y, m, d, wd };
            const s = this.mw.daySchedule(date);
            const h = toHijri(y, m, d, this.cfg.hijri_adjust);
            rows.push({
                key: `${y}-${m}-${d}`,
                today: y === t.y && m === t.m && d === t.d,
                friday: wd === 5,
                day: WEEKDAYS[wd],
                greg: arNum(d),
                hijri: h ? `${arNum(h.day)} ${HIJRI_MONTHS[h.month - 1]}` : "",
                times: PRAYERS.map((p) => ({ key: p.key, v: fmtTime(s.ts[p.key], this.cfg.tz) })),
            });
        }
        const h1 = toHijri(y, m, 1, this.cfg.hijri_adjust);
        const h2 = toHijri(y, m, days, this.cfg.hijri_adjust);
        const hLabel =
            h1 && h2
                ? h1.month === h2.month
                    ? `${HIJRI_MONTHS[h1.month - 1]} ${arNum(h1.year)}هـ`
                    : `${HIJRI_MONTHS[h1.month - 1]} – ${HIJRI_MONTHS[h2.month - 1]} ${arNum(h2.year)}هـ`
                : "";
        this.ui.month = { title: `${GREG_MONTHS[m - 1]} ${arNum(y)}م`, hijri: hLabel, rows };
    }
    shiftMonth(n) {
        this.ui.monthOffset += n;
        this.buildMonth();
    }
    printMonth() {
        window.print();
    }
    openSettings() {
        this.action.doAction("mawaqeet_prayer_times.action_mawaqeet_settings");
    }
    go(tag) {
        this.action.doAction(tag);
    }
}

registry.category("actions").add("mawaqeet.dashboard", MawaqeetDashboard);
