# Icon library (content/icons.json): the admin panel offers these by key; the build turns a key into its SVG paths.
from content import load

ICONS = load("icons")


def key_for(svg):
    """Key of an icon given its SVG paths (used when importing existing markup)."""
    return next(k for k, v in ICONS.items() if v == svg)
