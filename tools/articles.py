# Blog articles. The source is content/articles.json (edited from /admin/ or by hand);
# bodies use the simple text format described in tools/content.py.
from content import article_html, load

ARTICLES = load("articles")
for _a in ARTICLES:
    for _l in ("ar", "en"):
        _a[_l]["body"] = article_html(_a[_l]["body"])
