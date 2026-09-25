/** @odoo-module **/
import { reactive } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { computeTimes, PRAYERS } from "./lib/prayer_times";
import { addDays, localDate, toHijri } from "./lib/hijri";

const DATA_URL = "/mawaqeet_prayer_times/static/data";

/** Arabic normalisation used for Quran / Hadith search. */
export function normalizeArabic(s) {
    return (s || "")
        .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, "")
        .replace(/[إأآٱ]/g, "ا")
        .replace(/ى/g, "ي")
        .replace(/ة/g, "ه")
        .replace(/ؤ/g, "و")
        .replace(/ئ/g, "ي")
        .replace(/\s+/g, " ")
        .trim();
}

export const mawaqeetService = {
    dependencies: ["orm", "notification"],
    start(env, { orm, notification }) {
        const cache = {};
        const fetchJson = (path) => {
            if (!cache[path]) {
                cache[path] = fetch(`${DATA_URL}/${path}`).then((r) => {
                    if (!r.ok) {
                        delete cache[path];
                        throw new Error(`Mawaqeet: cannot load ${path}`);
                    }
                    return r.json();
                });
            }
            return cache[path];
        };

        const state = reactive({
            ready: false,
            config: null,
            now: Date.now(),
            today: null,
            hijri: null,
            times: null,
            tomorrowFajr: null,
            next: null,
            current: null,
        });

        const isRamadan = (date, cfg) => {
            const h = toHijri(date.y, date.m, date.d, cfg.hijri_adjust);
            return !!h && h.month === 9;
        };

        const daySchedule = (date, cfg = state.config) => computeTimes(date, cfg, isRamadan(date, cfg));

        function recompute() {
            const cfg = state.config;
            if (!cfg) {
                return;
            }
            const now = Date.now();
            const today = localDate(cfg.tz, new Date(now));
            const sched = daySchedule(today, cfg);
            const tomorrow = daySchedule(addDays(today, 1), cfg);
            state.today = today;
            state.hijri = toHijri(today.y, today.m, today.d, cfg.hijri_adjust);
            state.times = sched;
            state.tomorrowFajr = tomorrow.ts.fajr;
            let next = null;
            let current = null;
            for (const p of PRAYERS) {
                const ts = sched.ts[p.key];
                if (ts > now && !next) {
                    next = { ...p, ts };
                }
                if (ts <= now && !p.notPrayer) {
                    current = { ...p, ts };
                }
            }
            if (!next) {
                next = { ...PRAYERS[0], ts: tomorrow.ts.fajr, tomorrow: true };
            }
            if (!current) {
                current = { ...PRAYERS[5], ts: null };
            }
            state.next = next;
            state.current = current;
        }

        let lastNotified = null;
        function tick() {
            const prev = state.next;
            state.now = Date.now();
            if (!state.config) {
                return;
            }
            const today = localDate(state.config.tz, new Date(state.now));
            if (!state.today || today.d !== state.today.d || (prev && state.now >= prev.ts)) {
                recompute();
                if (
                    prev &&
                    !prev.notPrayer &&
                    state.config.notify &&
                    state.now - prev.ts < 90000 &&
                    lastNotified !== prev.ts
                ) {
                    lastNotified = prev.ts;
                    notification.add(`حان الآن وقت صلاة ${prev.name} حسب توقيت ${state.config.city}`, {
                        title: "مواقيت",
                        type: "success",
                        sticky: false,
                    });
                }
            }
        }

        async function loadConfig() {
            try {
                state.config = await orm.call("res.company", "mawaqeet_get_config", []);
            } catch {
                state.config = {
                    city: "مكة المكرمة",
                    lat: 21.422487,
                    lng: 39.826206,
                    tz: "Asia/Riyadh",
                    method: "umm_al_qura",
                    asr: "standard",
                    hijri_adjust: 0,
                    adjust: {},
                    systray: true,
                    notify: false,
                };
            }
            recompute();
            state.ready = true;
        }

        const readyPromise = loadConfig();
        setInterval(tick, 1000);

        return {
            state,
            ready: () => readyPromise,
            reload: loadConfig,
            daySchedule,
            fetchJson,
            quranIndex: () => fetchJson("quran/index.json"),
            juzIndex: () => fetchJson("quran/juz.json"),
            sura: (n) => fetchJson(`quran/s${String(n).padStart(3, "0")}.json`),
            quranSearchIndex: () => fetchJson("quran/search.json"),
            hadithBook: (key) => fetchJson(`hadith/${key}.json`),
            adhkar: () => fetchJson("adhkar/morning_evening.json"),
            iqamaTs: (key) => {
                const min = state.config && state.config.iqama && state.config.iqama[key];
                return min && state.times ? state.times.ts[key] + min * 60000 : null;
            },
            bookmarks: () => orm.call("mawaqeet.bookmark", "mawaqeet_keys", []),
            toggleBookmark: (vals) => orm.call("mawaqeet.bookmark", "mawaqeet_toggle", [vals]),
        };
    },
};

registry.category("services").add("mawaqeet", mawaqeetService);

/** Helpers shared by components */
export function fmtTime(ts, tz) {
    if (!ts) {
        return "--:--";
    }
    return new Intl.DateTimeFormat("ar-SA-u-nu-arab", {
        timeZone: tz,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    }).format(new Date(ts));
}

export function fmtCountdown(ms) {
    if (ms < 0) {
        ms = 0;
    }
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}

/** Deterministic "of the day" index (same for everyone on a given date). */
export function dayIndex(date, modulo, salt = 0) {
    const n = Math.floor(Date.UTC(date.y, date.m - 1, date.d) / 86400000) + salt * 7919;
    return ((n * 2654435761) >>> 0) % modulo;
}
