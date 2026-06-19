# BigQuery Release Pulse & Tweet Hub 🚀

A high-performance, visually stunning web application built with **Python Flask** and **plain vanilla HTML, CSS, and JavaScript**. This tool tracks real-time Google Cloud BigQuery Release Notes, parses multi-part updates into structured, granular elements, and integrates a custom Twitter/X Composer with smart character limit formatting.

---

## 🌟 Key Features

- **Granular Update Parsing**: Splits multi-topic daily entries (e.g., separating *Features* from *Issues* or *Announcements*) so you can review and share individual items.
- **Rich Tagging & Categorization**: Updates are automatically parsed and tagged into categories (**Feature** 🚀, **Announcement** 📢, **Change** ⚙️, **Issue** ⚠️, **Breaking** 🛑) with custom, glowing color codes.
- **Smart Caching & Cache-Busting**: Implements in-memory server-side caching (10-minute expiry) to make the app load instantly, backed by a **Refresh** button with a smooth SVG spinner to fetch fresh feed items on demand.
- **Premium Dark Aesthetics**: Styled with a gorgeous glassmorphic dark interface, custom scrollbars, animated loading skeleton cards, and smooth micro-animations.
- **X / Twitter Composer Panel**: 
  - Real-time character counter showing remaining characters.
  - A dynamic **radial progress meter** that transitions from Blue (safe) to Amber (warning) and Red (exceeded).
  - Four **Draft Presets** (**Tech Promo**, **Casual News**, **Tech Deep Dive**, **Minimalist**) that dynamically auto-format.
  - **Smart Truncation**: Automatically calculates template, link, and hashtag length to truncate the description *perfectly* under the 280-character limit on initial load.
  - Custom text area to customize drafts before posting.
  - One-click **Web Intent sharing** to open X with your draft prefilled.
  - One-click **Copy to Clipboard** with an animated success toast notification.
- **Responsive Split Screen**: 
  - **Desktop**: Interactive side-by-side dashboard layout (Left Feed, Right Workspace).
  - **Mobile**: Stacks cleanly. Selecting any feed card slides up an elegant **Bottom-Sheet Drawer** with full composer capabilities.

---

## 📂 Project Architecture

```
bq-releases-notes/
├── .venv/                  # Python Virtual Environment
├── app.py                  # Core Flask Application & RSS Feed Parser
├── requirements.txt        # Frozen Pip Dependencies (Flask, feedparser, etc.)
├── static/
│   ├── css/
│   │   └── styles.css      # Custom UI CSS System (Glassmorphic, Dark Theme, Responsive)
│   └── js/
│       └── app.js          # Core State & Interaction Logic (Filtering, X Composer, Drawer)
├── templates/
│   └── index.html          # Dashboard HTML with Inline SVG Icons
└── README.md               # App Documentation & Usage Guide
```

---

## 🛠️ Installation & Setup

1. **Activate the Virtual Environment**:
   ```bash
   source .venv/bin/activate
   ```

2. **Install Dependencies** (already done in this workspace):
   ```bash
   pip install -r requirements.txt
   ```

3. **Start the Flask Application**:
   ```bash
   python app.py
   ```

4. **Access the Application**:
   Open your browser and navigate to:
   👉 **`http://127.0.0.1:5001`**

---

## 🧑‍💻 Technical Highlights

### Smart Truncation Algorithm (JS)
To prevent Twitter drafts from exceeding the 280-character limit when swapping presets, the JavaScript codebase uses a precise length budget calculation:
$$\text{Max Allowed Summary} = 280 - \text{Template Header Length} - \text{Tags/Link Length} - 5 \text{ (buffer buffer)}$$
If the description text exceeds this, it truncates safely on a word boundary and appends `...` so that the draft is guaranteed to be within limits.

### Multi-Section Parsing (Python)
BigQuery feeds often pack several releases into a single feed item. The parser in `app.py` uses `BeautifulSoup` to scan the entry HTML and segment elements on sibling `<h3>` headings. This maps each section to its respective category badge dynamically!
