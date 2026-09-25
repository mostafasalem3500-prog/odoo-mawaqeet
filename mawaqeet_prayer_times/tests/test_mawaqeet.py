from odoo.tests import TransactionCase, tagged


@tagged("post_install", "-at_install")
class TestMawaqeet(TransactionCase):

    def test_config_defaults(self):
        cfg = self.env["res.company"].mawaqeet_get_config()
        self.assertEqual(cfg["method"], "umm_al_qura")
        self.assertEqual(cfg["asr"], "standard")
        self.assertIn("fajr", cfg["adjust"])
        self.assertEqual(cfg["iqama"]["fajr"], 25)

    def test_city_preset(self):
        settings = self.env["res.config.settings"].create({"mawaqeet_preset": "umq_1001"})
        settings.execute()
        company = self.env.company
        self.assertAlmostEqual(company.mawaqeet_latitude, 24.67, places=4)
        self.assertEqual(company.mawaqeet_city, "الرياض")
        self.assertEqual(company.mawaqeet_timezone, "Asia/Riyadh")

    def test_bookmark_toggle(self):
        Bookmark = self.env["mawaqeet.bookmark"]
        vals = {"kind": "ayah", "name": "الفاتحة ١", "sura": 1, "ayah": 1, "excerpt": "بسم الله"}
        self.assertTrue(Bookmark.mawaqeet_toggle(vals))
        self.assertEqual(len(Bookmark.mawaqeet_keys()), 1)
        self.assertFalse(Bookmark.mawaqeet_toggle(vals))
        self.assertEqual(len(Bookmark.mawaqeet_keys()), 0)

    def test_bookmarks_are_private(self):
        other = self.env["res.users"].create({"name": "Other", "login": "mw_other_user"})
        self.env["mawaqeet.bookmark"].with_user(other).mawaqeet_toggle(
            {"kind": "hadith", "name": "حديث", "book": "nawawi40", "number": 1})
        self.assertEqual(len(self.env["mawaqeet.bookmark"].mawaqeet_keys()), 0)
