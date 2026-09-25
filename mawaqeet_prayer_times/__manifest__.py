{
    "name": "Mawaqeet | Prayer Times, Holy Quran & Hadith (Umm Al-Qura)",
    "summary": "مواقيت الصلاة بتقويم أم القرى، المصحف الشريف من مجمع الملك فهد مع التفسير الميسر، "
               "الأربعون النووية ورياض الصالحين، اتجاه القبلة والتاريخ الهجري — يعمل دون إنترنت",
    "description": """
Mawaqeet brings the daily essentials of a Muslim workplace into Odoo, from trusted Saudi sources:
prayer times (official Umm Al-Qura method), Umm Al-Qura Hijri calendar, Qibla direction,
the Holy Quran (King Fahd Glorious Quran Printing Complex text & font) with Tafsir Al-Muyassar,
and the Forty Hadith of An-Nawawi and Riyad As-Salihin. All data ships inside the module.
    """,
    "version": "19.0.2.1.1",
    "category": "Productivity",
    "author": "Mostafa Ibrahim Salem",
    "website": "",
    "license": "LGPL-3",
    "depends": ["base", "web"],
    "data": [
        "security/ir.model.access.csv",
        "security/mawaqeet_security.xml",
        "views/res_config_settings_views.xml",
        "views/mawaqeet_bookmark_views.xml",
        "views/mawaqeet_menus.xml",
    ],
    "assets": {
        "web.assets_backend": [
            "mawaqeet_prayer_times/static/src/scss/mawaqeet.scss",
            "mawaqeet_prayer_times/static/src/js/lib/*.js",
            "mawaqeet_prayer_times/static/src/js/*.js",
            "mawaqeet_prayer_times/static/src/xml/*.xml",
        ],
    },
    "images": ["static/description/banner.png"],
    "application": True,
    "installable": True,
}
