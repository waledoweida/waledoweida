#!/usr/bin/env python3
"""Rebuild every generated page from content/: home pages first (the other pages copy
their header and footer), then the country pages, the blog, the sitemap and the review page.
Never touches wedding/ or فرح/.

Usage:  python3 tools/build_all.py
"""
import build_blog
import build_countries
import build_home
import build_review

if __name__ == "__main__":
    build_home.build()
    build_countries.build()
    build_countries.sync_vercel()
    build_countries.prune()
    build_blog.update_sitemap(build_blog.build())
    build_blog.prune()
    build_review.build()
    print("all pages rebuilt")
