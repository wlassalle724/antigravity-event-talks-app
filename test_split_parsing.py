import feedparser
from bs4 import BeautifulSoup
import json

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def parse_updates():
    feed = feedparser.parse(FEED_URL)
    all_updates = []
    
    for entry in feed.entries:
        date_str = entry.get('title') # e.g. "June 15, 2026"
        link = entry.get('link')
        updated_iso = entry.get('updated')
        
        content = entry.get('content')
        if not content:
            continue
            
        html_val = content[0].value if isinstance(content, list) else content
        soup = BeautifulSoup(html_val, 'html.parser')
        
        current_type = "General"
        current_elements = []
        update_index = 0
        
        def save_current_update():
            nonlocal current_elements, current_type, update_index
            if current_elements:
                # build html
                update_html = "".join(str(el) for el in current_elements)
                # build plain text
                sub_soup = BeautifulSoup(update_html, 'html.parser')
                update_text = sub_soup.get_text().strip()
                
                # We can construct a nice tweet draft from this
                # A good tweet: "BigQuery Update [Date] (Type): Short description... #BigQuery [Link]"
                
                all_updates.append({
                    "id": f"{date_str.replace(' ', '_').replace(',', '')}_{update_index}",
                    "date": date_str,
                    "date_iso": updated_iso,
                    "type": current_type,
                    "html": update_html,
                    "text": update_text,
                    "link": link
                })
                update_index += 1
                current_elements = []

        # Iterate through the top-level tags of the parsed content
        # Note: sometimes BeautifulSoup wraps everything or parses them as sibling tags
        for child in soup.contents:
            if child == '\n' or isinstance(child, str) and not child.strip():
                continue
                
            if child.name == 'h3':
                # Save previous update before starting a new one
                save_current_update()
                current_type = child.get_text().strip()
            else:
                # If there's content before any h3, it goes to "General"
                current_elements.append(child)
                
        # Save the last update
        save_current_update()
        
    print(f"Successfully parsed {len(all_updates)} individual updates from {len(feed.entries)} feed entries!")
    if all_updates:
        print("\n--- SAMPLE INDIVIDUAL UPDATE ---")
        print(json.dumps(all_updates[0], indent=2))
        
        # Let's count types
        types = {}
        for up in all_updates:
            t = up['type']
            types[t] = types.get(t, 0) + 1
        print("\nUpdate Types breakdown:")
        for t, count in types.items():
            print(f"  - {t}: {count}")

if __name__ == "__main__":
    parse_updates()
