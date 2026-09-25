/** @odoo-module **/
/**
 * Mawaqeet — astronomical prayer-time engine (no network, no dependencies).
 * Solar position after Jean Meeus / U.S. Naval Observatory approximations,
 * as used by the PrayTimes.org reference algorithm.
 *
 * Umm Al-Qura (official method of the Kingdom of Saudi Arabia):
 *   Fajr: sun 18.5° below horizon — Isha: 90 min after Maghrib (120 min in Ramadan).
 */

export const METHODS = {
    umm_al_qura: { fajr: 18.5, ishaMin: 90, ramadanIshaMin: 120 },
    mwl: { fajr: 18, isha: 17 },
    egyptian: { fajr: 19.5, isha: 17.5 },
    karachi: { fajr: 18, isha: 18 },
    isna: { fajr: 15, isha: 15 },
    dubai: { fajr: 18.2, isha: 18.2 },
    kuwait: { fajr: 18, isha: 17.5 },
    qatar: { fajr: 18, ishaMin: 90 },
    singapore: { fajr: 20, isha: 18 },
    turkey: { fajr: 18, isha: 17 },
};

export const PRAYERS = [
    { key: "fajr", name: "الفجر", icon: "fa-moon-o" },
    { key: "sunrise", name: "الشروق", icon: "fa-sun-o", notPrayer: true },
    { key: "dhuhr", name: "الظهر", icon: "fa-sun-o" },
    { key: "asr", name: "العصر", icon: "fa-cloud" },
    { key: "maghrib", name: "المغرب", icon: "fa-adjust" },
    { key: "isha", name: "العشاء", icon: "fa-star" },
];

const DEG = Math.PI / 180;
const sin = (d) => Math.sin(d * DEG);
const cos = (d) => Math.cos(d * DEG);
const tan = (d) => Math.tan(d * DEG);
const arcsin = (x) => Math.asin(x) / DEG;
const arccos = (x) => Math.acos(x) / DEG;
const arctan2 = (y, x) => Math.atan2(y, x) / DEG;
const arccot = (x) => Math.atan(1 / x) / DEG;
const fixAngle = (a) => a - 360 * Math.floor(a / 360);
const fixHour = (a) => a - 24 * Math.floor(a / 24);

function julian(year, month, day) {
    if (month <= 2) {
        year -= 1;
        month += 12;
    }
    const A = Math.floor(year / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + B - 1524.5;
}

function sunPosition(jd) {
    const D = jd - 2451545.0;
    const g = fixAngle(357.529 + 0.98560028 * D);
    const q = fixAngle(280.459 + 0.98564736 * D);
    const L = fixAngle(q + 1.915 * sin(g) + 0.02 * sin(2 * g));
    const e = 23.439 - 0.00000036 * D;
    const RA = arctan2(cos(e) * sin(L), cos(L)) / 15;
    const eqt = q / 15 - fixHour(RA);
    const decl = arcsin(sin(e) * sin(L));
    return { declination: decl, equation: eqt };
}

/** UTC offset (hours) of an IANA zone on a given calendar date (noon local). */
export function tzOffsetHours(tz, y, m, d) {
    try {
        const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }).formatToParts(probe);
        const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
        const asUTC = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour % 24, +v.minute, +v.second);
        return (asUTC - probe.getTime()) / 3600000;
    } catch {
        return 3; // Asia/Riyadh
    }
}

/**
 * Compute prayer times for a local calendar date.
 * @param {{y:number,m:number,d:number}} date local calendar date at the location
 * @param {object} cfg {lat, lng, tz, method, asr, adjust:{fajr..isha}}
 * @param {boolean} isRamadan  Umm Al-Qura Isha = 120 minutes in Ramadan
 * @returns {object} times as fractional local hours + `ts` epoch ms per prayer
 */
export function computeTimes(date, cfg, isRamadan = false) {
    const { y, m, d } = date;
    const lat = Number(cfg.lat) || 0;
    const lng = Number(cfg.lng) || 0;
    const tz = tzOffsetHours(cfg.tz || "Asia/Riyadh", y, m, d);
    const method = METHODS[cfg.method] || METHODS.umm_al_qura;
    const asrFactor = cfg.asr === "hanafi" ? 2 : 1;
    const jDate = julian(y, m, d) - lng / (15 * 24);

    const midDay = (t) => {
        const eqt = sunPosition(jDate + t).equation;
        return fixHour(12 - eqt);
    };
    const sunAngleTime = (angle, t, ccw) => {
        const decl = sunPosition(jDate + t).declination;
        const noon = midDay(t);
        const x = (-sin(angle) - sin(decl) * sin(lat)) / (cos(decl) * cos(lat));
        if (x < -1 || x > 1) {
            return NaN;
        }
        const T = arccos(x) / 15;
        return noon + (ccw ? -T : T);
    };
    const asrTime = (factor, t) => {
        const decl = sunPosition(jDate + t).declination;
        const angle = -arccot(factor + tan(Math.abs(lat - decl)));
        return sunAngleTime(angle, t);
    };

    // two passes for accuracy
    let t = { fajr: 5, sunrise: 6, dhuhr: 12, asr: 13, sunset: 18, isha: 18 };
    for (let i = 0; i < 2; i++) {
        const p = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v / 24]));
        t = {
            fajr: sunAngleTime(method.fajr, p.fajr, true),
            sunrise: sunAngleTime(0.833, p.sunrise, true),
            dhuhr: midDay(p.dhuhr),
            asr: asrTime(asrFactor, p.asr),
            sunset: sunAngleTime(0.833, p.sunset),
            isha: method.isha ? sunAngleTime(method.isha, p.isha) : NaN,
        };
    }
    // convert from solar (UTC at longitude) to local zone
    for (const k in t) {
        t[k] = t[k] + tz - lng / 15;
    }
    const maghrib = t.sunset;
    let isha = t.isha;
    if (method.ishaMin) {
        isha = maghrib + (isRamadan && method.ramadanIshaMin ? method.ramadanIshaMin : method.ishaMin) / 60;
    }
    // high-latitude fallback (angle-based night portion)
    const night = 24 - (t.sunset - t.sunrise);
    let fajr = t.fajr;
    if (isNaN(fajr) || t.sunrise - fajr > (method.fajr / 60) * night) {
        fajr = t.sunrise - (method.fajr / 60) * night;
    }
    if (!method.ishaMin && (isNaN(isha) || isha - maghrib > (method.isha / 60) * night)) {
        isha = maghrib + (method.isha / 60) * night;
    }
    const adj = cfg.adjust || {};
    const out = {
        fajr: fajr + (adj.fajr || 0) / 60,
        sunrise: t.sunrise,
        dhuhr: t.dhuhr + (adj.dhuhr || 0) / 60,
        asr: t.asr + (adj.asr || 0) / 60,
        maghrib: maghrib + (adj.maghrib || 0) / 60,
        isha: isha + (adj.isha || 0) / 60,
    };
    // Epoch timestamps. Rounding follows the official Umm Al-Qura tables
    // (ummulqura.org.sa): prayer times are rounded UP to the next minute and
    // sunrise is rounded DOWN, so no prayer is ever shown before its time.
    const base = Date.UTC(y, m - 1, d, 0, 0, 0) - tz * 3600000;
    const ts = {};
    for (const k in out) {
        const minutes = out[k] * 60;
        const r = k === "sunrise" ? Math.floor(minutes + 1e-9) : Math.ceil(minutes - 1e-9);
        ts[k] = base + r * 60000;
    }
    if (method.ishaMin) {
        // Isha is an exact interval after the (rounded) Maghrib, as in the official calendar.
        const interval = isRamadan && method.ramadanIshaMin ? method.ramadanIshaMin : method.ishaMin;
        ts.isha = ts.maghrib + (interval + (adj.isha || 0) - (adj.maghrib || 0)) * 60000;
    }
    return { hours: out, ts, tz };
}

/** Qibla bearing (degrees from true north) toward the Holy Kaaba. */
export function qiblaBearing(lat, lng) {
    const kLat = 21.4224779;
    const kLng = 39.8251832;
    const dLng = (kLng - lng) * DEG;
    const y = Math.sin(dLng);
    const x = Math.cos(lat * DEG) * Math.tan(kLat * DEG) - Math.sin(lat * DEG) * Math.cos(dLng);
    return fixAngle(Math.atan2(y, x) / DEG);
}

/** Great-circle distance in km to the Holy Kaaba. */
export function distanceToKaaba(lat, lng) {
    const R = 6371;
    const dLat = (21.4224779 - lat) * DEG;
    const dLng = (39.8251832 - lng) * DEG;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * DEG) * Math.cos(21.4224779 * DEG) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
