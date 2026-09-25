from odoo import api, fields, models

from .umq_cities import UMQ_CITIES


class ResConfigSettings(models.TransientModel):
    _inherit = "res.config.settings"

    mawaqeet_preset = fields.Selection(
        [(key, label) for key, label, _n, _a, _b in UMQ_CITIES], string="Saudi City Preset")
    mawaqeet_city = fields.Char(related="company_id.mawaqeet_city", readonly=False)
    mawaqeet_latitude = fields.Float(related="company_id.mawaqeet_latitude", readonly=False)
    mawaqeet_longitude = fields.Float(related="company_id.mawaqeet_longitude", readonly=False)
    mawaqeet_timezone = fields.Char(related="company_id.mawaqeet_timezone", readonly=False)
    mawaqeet_method = fields.Selection(related="company_id.mawaqeet_method", readonly=False)
    mawaqeet_asr = fields.Selection(related="company_id.mawaqeet_asr", readonly=False)
    mawaqeet_hijri_adjust = fields.Integer(related="company_id.mawaqeet_hijri_adjust", readonly=False)
    mawaqeet_adj_fajr = fields.Integer(related="company_id.mawaqeet_adj_fajr", readonly=False)
    mawaqeet_adj_dhuhr = fields.Integer(related="company_id.mawaqeet_adj_dhuhr", readonly=False)
    mawaqeet_adj_asr = fields.Integer(related="company_id.mawaqeet_adj_asr", readonly=False)
    mawaqeet_adj_maghrib = fields.Integer(related="company_id.mawaqeet_adj_maghrib", readonly=False)
    mawaqeet_adj_isha = fields.Integer(related="company_id.mawaqeet_adj_isha", readonly=False)
    mawaqeet_show_iqama = fields.Boolean(related="company_id.mawaqeet_show_iqama", readonly=False)
    mawaqeet_iqama_fajr = fields.Integer(related="company_id.mawaqeet_iqama_fajr", readonly=False)
    mawaqeet_iqama_dhuhr = fields.Integer(related="company_id.mawaqeet_iqama_dhuhr", readonly=False)
    mawaqeet_iqama_asr = fields.Integer(related="company_id.mawaqeet_iqama_asr", readonly=False)
    mawaqeet_iqama_maghrib = fields.Integer(related="company_id.mawaqeet_iqama_maghrib", readonly=False)
    mawaqeet_iqama_isha = fields.Integer(related="company_id.mawaqeet_iqama_isha", readonly=False)
    mawaqeet_show_systray = fields.Boolean(related="company_id.mawaqeet_show_systray", readonly=False)
    mawaqeet_notify = fields.Boolean(related="company_id.mawaqeet_notify", readonly=False)

    @api.onchange("mawaqeet_preset")
    def _onchange_mawaqeet_preset(self):
        self._mawaqeet_apply_preset()

    def _mawaqeet_apply_preset(self):
        for rec in self:
            for key, _label, name, lat, lng in UMQ_CITIES:
                if key == rec.mawaqeet_preset:
                    rec.mawaqeet_city = name
                    rec.mawaqeet_latitude = lat
                    rec.mawaqeet_longitude = lng
                    rec.mawaqeet_timezone = "Asia/Riyadh"
                    rec.mawaqeet_method = "umm_al_qura"
                    rec.mawaqeet_asr = "standard"

    def set_values(self):
        self._mawaqeet_apply_preset()
        return super().set_values()
