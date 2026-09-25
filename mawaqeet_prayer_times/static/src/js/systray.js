/** @odoo-module **/
import { Component, useState } from "@odoo/owl";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { PRAYERS } from "./lib/prayer_times";
import { formatHijri } from "./lib/hijri";
import { fmtCountdown, fmtTime } from "./mawaqeet_service";

export class MawaqeetSystray extends Component {
    static template = "mawaqeet_prayer_times.Systray";
    static components = { Dropdown };
    static props = {};

    setup() {
        this.mw = useService("mawaqeet");
        this.action = useService("action");
        this.state = useState(this.mw.state);
        this.prayers = PRAYERS;
    }
    get visible() {
        return this.state.ready && this.state.config && this.state.config.systray && this.state.next;
    }
    get countdown() {
        return fmtCountdown(this.state.next.ts - this.state.now);
    }
    get hijri() {
        return formatHijri(this.state.hijri);
    }
    time(key) {
        return fmtTime(this.state.times.ts[key], this.state.config.tz);
    }
    isNext(key) {
        return this.state.next && this.state.next.key === key && !this.state.next.tomorrow;
    }
    open(tag) {
        this.action.doAction(tag);
    }
}

registry.category("systray").add("mawaqeet.systray", { Component: MawaqeetSystray }, { sequence: 30 });
