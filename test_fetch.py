import feedparser
from bs4 import BeautifulSoup
import json

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def test_fetch():
    print(f"Fetching {FEED_URL}...")
    feed = feedparser.parse(FEED_URL)
    
    print("\n--- Feed Metadata ---")
    print(f"Title: {feed.feed.get('title')}")
    print(f"Link: {feed.feed.get('link')}")
    print(f"Updated: {feed.feed.get('updated')}")
    print(f"Number of entries: {len(feed.entries)}")
    
    if len(feed.entries) > 0:
        print("\n--- First Entry Details ---")
        entry = feed.entries[0]
        for key in ['id', 'title', 'link', 'updated', 'published']:
            print(f"{key}: {entry.get(key)}")
        
        print("\n--- Content (first 300 chars) ---")
        content = entry.get('content')
        if content:
            # content is usually a list of dicts or a string depending on RSS/Atom
            val = content[0].value if isinstance(content, list) else content
            print(val[:300] + "...")
            
            # Use BeautifulSoup to clean the HTML
            soup = BeautifulSoup(val, 'html.parser')
            print("\n--- Text Content (first 150 chars) ---")
            print(soup.get_text()[:150] + "...")
        else:
            print("No content found.")

if __name__ == "__main__":
    test_fetch()
