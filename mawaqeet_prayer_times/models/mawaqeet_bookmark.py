from odoo import api, fields, models


class MawaqeetBookmark(models.Model):
    _name = "mawaqeet.bookmark"
    _description = "Quran / Hadith Bookmark"
    _order = "create_date desc, id desc"

    name = fields.Char(string="Title", required=True)
    user_id = fields.Many2one("res.users", string="User", required=True, index=True,
                              default=lambda self: self.env.user, ondelete="cascade")
    kind = fields.Selection([("ayah", "Quran Verse"), ("hadith", "Hadith")], required=True, default="ayah")
    sura = fields.Integer(string="Surah")
    ayah = fields.Integer(string="Verse")
    book = fields.Char(string="Hadith Book")
    number = fields.Integer(string="Hadith No.")
    excerpt = fields.Text(string="Text")
    note = fields.Text(string="My Note")

    @api.model
    def mawaqeet_toggle(self, vals):
        """Add or remove a bookmark for the current user. Returns True when bookmarked."""
        domain = [("user_id", "=", self.env.uid), ("kind", "=", vals.get("kind"))]
        if vals.get("kind") == "ayah":
            domain += [("sura", "=", vals.get("sura")), ("ayah", "=", vals.get("ayah"))]
        else:
            domain += [("book", "=", vals.get("book")), ("number", "=", vals.get("number"))]
        existing = self.search(domain, limit=1)
        if existing:
            existing.unlink()
            return False
        allowed = {"name", "kind", "sura", "ayah", "book", "number", "excerpt"}
        self.create({k: v for k, v in vals.items() if k in allowed})
        return True

    @api.model
    def mawaqeet_keys(self):
        """Compact list of the user's bookmarks for the reader UI."""
        recs = self.search([("user_id", "=", self.env.uid)])
        return [{"id": r.id, "name": r.name, "kind": r.kind, "sura": r.sura, "ayah": r.ayah,
                 "book": r.book, "number": r.number, "excerpt": (r.excerpt or "")[:220], "note": r.note or ""}
                for r in recs]
