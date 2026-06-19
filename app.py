import os
import time
from flask import Flask, render_template, jsonify, request
import feedparser
from bs4 import BeautifulSoup

app = Flask(__name__)

# Simple in-memory cache
cache = {
    "data": None,
    "last_fetched": 0
}
CACHE_DURATION = 600  # 10 minutes cache

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"

def clean_html_for_tweet(html_content):
    """
    Cleans up HTML and converts it into a concise, tweet-friendly plain text summary.
    """
    if not html_content:
        return ""
    soup = BeautifulSoup(html_content, 'html.parser')
    text = soup.get_text()
    
    # Replace multiple spaces/newlines with single space
    text = " ".join(text.split())
    return text

def fetch_and_parse_notes(force=False):
    now = time.time()
    if not force and cache["data"] and (now - cache["last_fetched"]) < CACHE_DURATION:
        return cache["data"], "cached"
        
    try:
        feed = feedparser.parse(FEED_URL)
        if feed.bozo and not feed.entries:
            # If feedparser failed completely, raise exception
            raise Exception("Failed to parse feed XML")
            
        updates = []
        for entry in feed.entries:
            date_str = entry.get('title', 'Unknown Date')
            link = entry.get('link', 'https://cloud.google.com/bigquery/docs/release-notes')
            updated_iso = entry.get('updated', '')
            
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
                    # reconstruct the HTML for this update
                    update_html = "".join(str(el) for el in current_elements)
                    update_text = clean_html_for_tweet(update_html)
                    
                    # Generate a clean ID
                    clean_date = date_str.replace(' ', '_').replace(',', '')
                    update_id = f"{clean_date}_{update_index}"
                    
                    updates.append({
                        "id": update_id,
                        "date": date_str,
                        "date_iso": updated_iso,
                        "type": current_type,
                        "html": update_html,
                        "text": update_text,
                        "link": link
                    })
                    update_index += 1
                    current_elements = []

            # Split by h3 headers
            for child in soup.contents:
                if child == '\n' or (isinstance(child, str) and not child.strip()):
                    continue
                    
                if child.name == 'h3':
                    save_current_update()
                    current_type = child.get_text().strip()
                else:
                    current_elements.append(child)
                    
            # Save the final parsed update
            save_current_update()
            
        cache["data"] = updates
        cache["last_fetched"] = now
        return updates, "fetched"
        
    except Exception as e:
        print(f"Error fetching/parsing notes: {e}")
        # Return cache if it exists, otherwise raise error
        if cache["data"]:
            return cache["data"], "error-fallback"
        raise e

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/release-notes')
def get_release_notes():
    force = request.args.get('force', 'false').lower() == 'true'
    try:
        notes, status = fetch_and_parse_notes(force=force)
        return jsonify({
            "success": True,
            "status": status,
            "count": len(notes),
            "last_fetched": cache["last_fetched"],
            "notes": notes
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    # Run locally on port 5001 to avoid conflicts with 5000 if active
    app.run(debug=True, host='0.0.0.0', port=5001)
