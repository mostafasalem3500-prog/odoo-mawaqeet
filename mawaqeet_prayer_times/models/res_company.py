from odoo import api, fields, models

CALC_METHODS = [
    ("umm_al_qura", "Umm Al-Qura, Makkah (Saudi Arabia)"),
    ("mwl", "Muslim World League"),
    ("egyptian", "Egyptian General Authority of Survey"),
    ("karachi", "University of Islamic Sciences, Karachi"),
    ("isna", "Islamic Society of North America"),
    ("dubai", "Dubai (UAE)"),
    ("kuwait", "Kuwait"),
    ("qatar", "Qatar"),
    ("singapore", "Singapore / Malaysia / Indonesia"),
    ("turkey", "Diyanet, Turkey"),
]


class ResCompany(models.Model):
    _inherit = "res.company"

    mawaqeet_city = fields.Char(string="Prayer City", default="مكة المكرمة")
    mawaqeet_latitude = fields.Float(string="Latitude", digits=(10, 6), default=21.426666)
    mawaqeet_longitude = fields.Float(string="Longitude", digits=(10, 6), default=39.831666)
    mawaqeet_timezone = fields.Char(string="Prayer Timezone", default="Asia/Riyadh")
    mawaqeet_method = fields.Selection(CALC_METHODS, string="Calculation Method", default="umm_al_qura")
    mawaqeet_asr = fields.Selection(
        [("standard", "Standard (Shafi'i, Maliki, Hanbali)"), ("hanafi", "Hanafi")],
        string="Asr Juristic Method", default="standard")
    mawaqeet_hijri_adjust = fields.Integer(string="Hijri Day Adjustment", default=0)
    mawaqeet_adj_fajr = fields.Integer(string="Fajr Adjustment (min)", default=0)
    mawaqeet_adj_dhuhr = fields.Integer(string="Dhuhr Adjustment (min)", default=0)
    mawaqeet_adj_asr = fields.Integer(string="Asr Adjustment (min)", default=0)
    mawaqeet_adj_maghrib = fields.Integer(string="Maghrib Adjustment (min)", default=0)
    mawaqeet_adj_isha = fields.Integer(string="Isha Adjustment (min)", default=0)
    mawaqeet_show_iqama = fields.Boolean(string="Show Iqama Times", default=True)
    mawaqeet_iqama_fajr = fields.Integer(string="Fajr Iqama (min after Adhan)", default=25)
    mawaqeet_iqama_dhuhr = fields.Integer(string="Dhuhr Iqama (min after Adhan)", default=20)
    mawaqeet_iqama_asr = fields.Integer(string="Asr Iqama (min after Adhan)", default=20)
    mawaqeet_iqama_maghrib = fields.Integer(string="Maghrib Iqama (min after Adhan)", default=10)
    mawaqeet_iqama_isha = fields.Integer(string="Isha Iqama (min after Adhan)", default=20)
    mawaqeet_show_systray = fields.Boolean(string="Show Next Prayer in Top Bar", default=True)
    mawaqeet_notify = fields.Boolean(string="Prayer Time Notifications", default=True)

    @api.model
    def mawaqeet_get_config(self):
        """Settings consumed by the Mawaqeet web client (current company)."""
        c = self.env.company
        return {
            "company": c.name,
            "city": c.mawaqeet_city or "",
            "lat": c.mawaqeet_latitude,
            "lng": c.mawaqeet_longitude,
            "tz": c.mawaqeet_timezone or self.env.user.tz or "Asia/Riyadh",
            "method": c.mawaqeet_method or "umm_al_qura",
            "asr": c.mawaqeet_asr or "standard",
            "hijri_adjust": c.mawaqeet_hijri_adjust,
            "adjust": {
                "fajr": c.mawaqeet_adj_fajr,
                "dhuhr": c.mawaqeet_adj_dhuhr,
                "asr": c.mawaqeet_adj_asr,
                "maghrib": c.mawaqeet_adj_maghrib,
                "isha": c.mawaqeet_adj_isha,
            },
            "iqama": {
                "fajr": c.mawaqeet_iqama_fajr,
                "dhuhr": c.mawaqeet_iqama_dhuhr,
                "asr": c.mawaqeet_iqama_asr,
                "maghrib": c.mawaqeet_iqama_maghrib,
                "isha": c.mawaqeet_iqama_isha,
            } if c.mawaqeet_show_iqama else {},
            "systray": c.mawaqeet_show_systray,
            "notify": c.mawaqeet_notify,
            "is_admin": self.env.user.has_group("base.group_system"),
        }
