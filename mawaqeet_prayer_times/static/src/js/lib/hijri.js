/** @odoo-module **/
import { HIJRI_OFFSET, MONTH_STARTS } from "./ummalqura_data";

export const HIJRI_MONTHS = [
    "محرم",
    "صفر",
    "ربيع الأول",
    "ربيع الآخر",
    "جمادى الأولى",
    "جمادى الآخرة",
    "رجب",
    "شعبان",
    "رمضان",
    "شوال",
    "ذو القعدة",
    "ذو الحجة",
];
export const GREG_MONTHS = [
    "يناير",
    "فبراير",
    "مارس",
    "أبريل",
    "مايو",
    "يونيو",
    "يوليو",
    "أغسطس",
    "سبتمبر",
    "أكتوبر",
    "نوفمبر",
    "ديسمبر",
];
export const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
export const arNum = (n) => String(n).replace(/[0-9]/g, (c) => AR_DIGITS[c]);

function bisectRight(arr, x) {
    let lo = 0;
    let hi = arr.length;
    while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (x < arr[mid]) {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    return lo;
}

/** Julian Day Number of a Gregorian calendar date. */
export function gregorianToJdn(y, m, d) {
    return Math.floor(Date.UTC(y, m - 1, d) / 86400000) + 2440588;
}

/** Official Umm Al-Qura conversion (1343–1500 AH). Returns null outside range. */
export function toHijri(y, m, d, adjust = 0) {
    const rjd = gregorianToJdn(y, m, d) + (adjust || 0) - 2400000;
    const index = bisectRight(MONTH_STARTS, rjd) - 1;
    if (index < 0 || index >= MONTH_STARTS.length - 1) {
        return null;
    }
    const months = index + HIJRI_OFFSET;
    const years = Math.floor(months / 12);
    return {
        year: years + 1,
        month: months - years * 12 + 1,
        day: rjd - MONTH_STARTS[index] + 1,
        monthLength: MONTH_STARTS[index + 1] - MONTH_STARTS[index],
    };
}

export function formatHijri(h) {
    if (!h) {
        return "";
    }
    return `${arNum(h.day)} ${HIJRI_MONTHS[h.month - 1]} ${arNum(h.year)}هـ`;
}

export function formatGregorian(y, m, d) {
    return `${arNum(d)} ${GREG_MONTHS[m - 1]} ${arNum(y)}م`;
}

/** Local calendar date (y, m, d, weekday) of an instant in an IANA zone. */
export function localDate(tz, when = new Date()) {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            year: "numeric",
            month: "numeric",
            day: "numeric",
            weekday: "short",
        }).formatToParts(when);
        const v = Object.fromEntries(parts.map((p) => [p.type, p.value]));
        const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(v.weekday);
        return { y: +v.year, m: +v.month, d: +v.day, wd };
    } catch {
        return { y: when.getFullYear(), m: when.getMonth() + 1, d: when.getDate(), wd: when.getDay() };
    }
}

export function addDays({ y, m, d }, n) {
    const t = new Date(Date.UTC(y, m - 1, d + n));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() };
}

/** Umm Al-Qura Hijri → Gregorian {y, m, d} (null outside the table). */
export function fromHijri(hy, hm, hd) {
    const index = (hy - 1) * 12 + (hm - 1) - HIJRI_OFFSET;
    if (index < 0 || index >= MONTH_STARTS.length - 1) {
        return null;
    }
    const rjd = MONTH_STARTS[index] + hd - 1;
    const t = new Date((rjd + 2400000 - 2440588) * 86400000);
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), wd: t.getUTCDay() };
}

/** Days between two {y,m,d} dates (b - a). */
export function daysBetween(a, b) {
    return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
}

export const OCCASIONS = [
    { m: 1, d: 1, name: "رأس السنة الهجرية" },
    { m: 1, d: 10, name: "يوم عاشوراء", fast: true },
    { m: 9, d: 1, name: "بداية شهر رمضان المبارك" },
    { m: 10, d: 1, name: "عيد الفطر المبارك" },
    { m: 12, d: 9, name: "يوم عرفة", fast: true },
    { m: 12, d: 10, name: "عيد الأضحى المبارك" },
];

/** Upcoming occasions from a Gregorian date, per the Umm Al-Qura calendar. */
export function upcomingOccasions(today, adjust = 0, count = 4) {
    const h = toHijri(today.y, today.m, today.d, adjust);
    if (!h) {
        return [];
    }
    const list = [];
    for (const year of [h.year, h.year + 1]) {
        for (const o of OCCASIONS) {
            const g = fromHijri(year, o.m, o.d);
            if (!g) {
                continue;
            }
            const shifted = addDays(g, -(adjust || 0));
            const days = daysBetween(today, shifted);
            if (days >= 0) {
                list.push({ ...o, year, days, greg: shifted });
            }
        }
    }
    return list.sort((a, b) => a.days - b.days).slice(0, count);
}
