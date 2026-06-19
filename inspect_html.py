import feedparser
from bs4 import BeautifulSoup

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def inspect():
    feed = feedparser.parse(FEED_URL)
    for idx, entry in enumerate(feed.entries[:3]):
        print(f"\n================ ENTRY {idx+1}: {entry.get('title')} ================")
        content = entry.get('content')
        if not content:
            print("No content")
            continue
        
        html = content[0].value if isinstance(content, list) else content
        print("Raw HTML Sample (first 1000 chars):")
        print(html[:1000])
        print("...")
        
        soup = BeautifulSoup(html, 'html.parser')
        print("\nParsed elements:")
        # Let's print out the children
        for child in soup.children:
            if child.name:
                print(f"<{child.name}>: {child.get_text()[:120].strip()}...")

if __name__ == "__main__":
    inspect()
