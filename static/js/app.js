/**
 * BigQuery Release Pulse - Client Side Application
 * Managing: State, UI rendering, filtering, preset drafting, & X integration
 */

// Core Application State
const state = {
    allNotes: [],
    filteredNotes: [],
    selectedNote: null,
    currentCategory: 'all',
    searchQuery: '',
    sortOrder: 'newest',
    tweetPresetStyle: 'promo', // promo, casual, technical, minimal
    isFetching: false,
    lastFetchedTimestamp: null
};

// Radial Progress Constants
const PROGRESS_RADIUS = 12;
const PROGRESS_CIRCUMFERENCE = 2 * Math.PI * PROGRESS_RADIUS;

// DOM Element Selectors
const elements = {
    refreshBtn: document.getElementById('refresh-btn'),
    refreshIcon: document.querySelector('.refresh-icon'),
    lastUpdatedText: document.getElementById('last-updated-text'),
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search'),
    categoryBadges: document.getElementById('category-badges'),
    sortSelect: document.getElementById('sort-select'),
    feedStatsText: document.getElementById('feed-stats-text'),
    feedContainer: document.getElementById('feed-container'),
    emptyDetailState: document.getElementById('empty-detail-state'),
    activeWorkspace: document.getElementById('active-workspace'),
    exportCsvBtn: document.getElementById('export-csv-btn'),
    
    // Detail Workspace Selectors
    detailTypeBadge: document.getElementById('detail-type-badge'),
    detailDate: document.getElementById('detail-date'),
    detailTitle: document.getElementById('detail-title'),
    detailHtmlContent: document.getElementById('detail-html-content'),
    detailDocLink: document.getElementById('detail-doc-link'),
    
    // Tweet Composer Selectors
    tweetTextarea: document.getElementById('tweet-textarea'),
    charProgress: document.getElementById('char-progress'),
    charCounter: document.getElementById('char-counter'),
    copyTweetBtn: document.getElementById('copy-tweet-btn'),
    tweetBtn: document.getElementById('tweet-btn'),
    suggestRewriteBtn: document.getElementById('suggest-rewrite-btn'),
    presetsDrawer: document.getElementById('presets-drawer'),
    presetButtons: document.querySelectorAll('.preset-btn'),
    
    // Mobile Drawer Selectors
    mobileDetailDrawer: document.getElementById('mobile-detail-drawer'),
    drawerOverlay: document.getElementById('drawer-overlay'),
    closeDrawerBtn: document.getElementById('close-drawer-btn'),
    mobileDrawerBody: document.getElementById('mobile-drawer-body'),
    
    // Global Elements
    themeToggle: document.getElementById('theme-toggle'),
    toastContainer: document.getElementById('toast-container')
};

/* ==========================================
   Initialization & State Fetching
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Check saved theme or system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    if (savedTheme === 'light' || (!savedTheme && prefersLight)) {
        document.body.classList.add('light-theme');
    }

    // Set up radial progress ring init
    if (elements.charProgress) {
        elements.charProgress.style.strokeDasharray = `${PROGRESS_CIRCUMFERENCE} ${PROGRESS_CIRCUMFERENCE}`;
        elements.charProgress.style.strokeDashoffset = PROGRESS_CIRCUMFERENCE;
    }

    // Attach Event Listeners
    setupEventListeners();
    
    // Set interval to update relative sync timestamp every 30 seconds
    setInterval(updateRelativeTimestamp, 30000);
    
    // Fetch initial data
    fetchReleaseNotes();
});

function setupEventListeners() {
    // Refresh button
    elements.refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Theme Toggle
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', () => {
            const isLight = document.body.classList.toggle('light-theme');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            showToast(`Swapped to ${isLight ? 'Light' : 'Dark'} Mode! 🎨`, "success");
        });
    }

    // Search bar
    elements.searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.toLowerCase().trim();
        elements.clearSearchBtn.style.display = state.searchQuery ? 'flex' : 'none';
        applyFilters();
    });

    // Clear search
    elements.clearSearchBtn.addEventListener('click', () => {
        elements.searchInput.value = '';
        state.searchQuery = '';
        elements.clearSearchBtn.style.display = 'none';
        applyFilters();
        elements.searchInput.focus();
    });

    // Category Badges
    elements.categoryBadges.addEventListener('click', (e) => {
        const badge = e.target.closest('.badge-btn');
        if (!badge) return;
        
        // Remove active class from siblings, add to clicked
        document.querySelectorAll('.badge-btn').forEach(btn => btn.classList.remove('active'));
        badge.classList.add('active');
        
        state.currentCategory = badge.dataset.category;
        applyFilters();
    });

    // Sort Order
    elements.sortSelect.addEventListener('change', (e) => {
        state.sortOrder = e.target.value;
        sortFilteredNotes();
        renderNotesFeed();
    });

    // Export CSV
    if (elements.exportCsvBtn) {
        elements.exportCsvBtn.addEventListener('click', () => {
            exportFilteredNotesToCSV();
        });
    }

    // Tweet text change listener for character meter
    elements.tweetTextarea.addEventListener('input', () => {
        updateCharMeter();
    });

    // Tweet composer: Style Preset Toggle Panel
    elements.suggestRewriteBtn.addEventListener('click', () => {
        const isOpen = elements.presetsDrawer.style.display === 'block';
        elements.presetsDrawer.style.display = isOpen ? 'none' : 'block';
    });

    // Choose preset style
    elements.presetsDrawer.addEventListener('click', (e) => {
        const btn = e.target.closest('.preset-btn');
        if (!btn) return;
        
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        state.tweetPresetStyle = btn.dataset.preset;
        generateTweetDraft();
    });

    // Share action: Copy to Clipboard
    elements.copyTweetBtn.addEventListener('click', () => {
        const text = elements.tweetTextarea.value;
        if (!text) return;
        
        navigator.clipboard.writeText(text)
            .then(() => {
                showToast("Tweet draft copied to clipboard! 📋", "success");
                triggerCopySuccessFeedback(elements.copyTweetBtn);
            })
            .catch(err => {
                showToast("Could not copy draft automatically.", "error");
                console.error("Clipboard error:", err);
            });
    });

    // Smart Trim Button Action
    const smartTrimBtn = document.getElementById('smart-trim-btn');
    if (smartTrimBtn) {
        smartTrimBtn.addEventListener('click', () => {
            performSmartTrim(elements.tweetTextarea);
        });
    }

    // Share action: Open X Intent URL
    elements.tweetBtn.addEventListener('click', () => {
        const text = elements.tweetTextarea.value;
        if (!text) return;
        
        if (text.length > 280) {
            showToast("Draft exceeds 280 character limit! Trim it before posting.", "error");
            return;
        }
        
        const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(tweetUrl, '_blank', 'width=550,height=420,menubar=no,toolbar=no,scrollbars=yes');
    });

    // Mobile Drawer Close triggers
    elements.closeDrawerBtn.addEventListener('click', closeMobileDrawer);
    elements.drawerOverlay.addEventListener('click', closeMobileDrawer);
}

/* ==========================================
   Data Fetching API Functions
   ========================================== */

async function fetchReleaseNotes(force = false) {
    if (state.isFetching) return;
    
    setLoadingState(true);
    try {
        const url = `/api/release-notes${force ? '?force=true' : ''}`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            state.allNotes = data.notes;
            state.lastFetchedTimestamp = data.last_fetched;
            
            // Format feed metadata time relatively
            updateRelativeTimestamp();
            
            // Calculate and show category counts
            updateCategoryCounts();
            
            // Render
            applyFilters();
            
            if (force) {
                showToast(`Feed sync complete! Fetched ${data.count} updates.`, "success");
            }
        } else {
            throw new Error(data.error || "Unknown API Error");
        }
    } catch (err) {
        showToast("Failed to fetch Google Cloud release notes feed.", "error");
        console.error("Fetch release notes error:", err);
        elements.lastUpdatedText.textContent = "Sync offline";
        
        // Show Offline / Sync Failed UI in feed panel
        elements.feedContainer.innerHTML = `
            <div class="no-selection" style="padding: 3rem 1rem; margin: auto; text-align: center;">
                <div class="empty-illustration" style="width: 4rem; height: 4rem; color: var(--color-breaking); margin: 0 auto 1rem auto; display: flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 3rem; height: 3rem;">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                        <line x1="12" y1="9" x2="12" y2="13"/>
                        <line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                </div>
                <h3 style="color: var(--text-title); font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">Sync Failed / Offline</h3>
                <p style="font-size: 0.8rem; max-width: 280px; margin: 0 auto 1.25rem auto; color: var(--text-secondary); line-height: 1.4;">
                    Unable to load the BigQuery release notes. Check your network connection or the server and try again.
                </p>
                <button id="retry-sync-btn" class="btn btn-secondary" style="padding: 0.45rem 1rem; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.5rem; margin: 0 auto; height: auto; cursor: pointer;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 14px; height: 14px;">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                    </svg>
                    Try Re-syncing
                </button>
            </div>
        `;
        
        const retryBtn = elements.feedContainer.querySelector('#retry-sync-btn');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => {
                fetchReleaseNotes(true);
            });
        }
    } finally {
        setLoadingState(false);
    }
}

function setLoadingState(loading) {
    state.isFetching = loading;
    if (loading) {
        elements.refreshIcon.classList.add('spinning');
        elements.refreshBtn.disabled = true;
        // Keep skeleton screen in feed container
        elements.feedContainer.innerHTML = `
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        `;
    } else {
        elements.refreshIcon.classList.remove('spinning');
        elements.refreshBtn.disabled = false;
    }
}

/* ==========================================
   Search, Filter and Sort Computations
   ========================================== */

function updateCategoryCounts() {
    const counts = { all: state.allNotes.length };
    
    // Count matches for categories
    state.allNotes.forEach(note => {
        counts[note.type] = (counts[note.type] || 0) + 1;
    });

    // Set badges
    document.getElementById('count-all').textContent = counts.all || 0;
    document.getElementById('count-feature').textContent = counts.Feature || 0;
    document.getElementById('count-announcement').textContent = counts.Announcement || 0;
    document.getElementById('count-change').textContent = counts.Change || 0;
    document.getElementById('count-issue').textContent = counts.Issue || 0;
    document.getElementById('count-breaking').textContent = counts.Breaking || 0;
}

function applyFilters() {
    state.filteredNotes = state.allNotes.filter(note => {
        // 1. Category Filter
        const matchesCategory = state.currentCategory === 'all' || note.type === state.currentCategory;
        
        // 2. Keyword Search Filter
        const query = state.searchQuery;
        const matchesKeyword = !query || 
            note.text.toLowerCase().includes(query) || 
            note.type.toLowerCase().includes(query) || 
            note.date.toLowerCase().includes(query);
            
        return matchesCategory && matchesKeyword;
    });
    
    // Apply sorting
    sortFilteredNotes();
    
    // Update count stats
    elements.feedStatsText.textContent = `Showing ${state.filteredNotes.length} of ${state.allNotes.length} updates`;
    
    // Render the feed cards
    renderNotesFeed();
}

function sortFilteredNotes() {
    state.filteredNotes.sort((a, b) => {
        const timeA = new Date(a.date_iso).getTime();
        const timeB = new Date(b.date_iso).getTime();
        return state.sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });
}

/* ==========================================
   UI Render Utilities
   ========================================== */

function renderNotesFeed() {
    elements.feedContainer.innerHTML = '';
    
    if (state.filteredNotes.length === 0) {
        elements.feedContainer.innerHTML = `
            <div class="no-selection" style="padding: 3rem 1rem; margin: auto; text-align: center;">
                <div class="empty-illustration" style="width: 4rem; height: 4rem; margin: 0 auto 1rem auto; display: flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 2.5rem; height: 2.5rem;">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                </div>
                <h3 style="color: var(--text-title); font-size: 1.1rem; font-weight: 600; margin-bottom: 0.5rem;">No Matching Results</h3>
                <p style="font-size: 0.8rem; max-width: 250px; margin: 0 auto 1.25rem auto; color: var(--text-secondary); line-height: 1.4;">
                    Try checking other categories or rephrasing your search keywords.
                </p>
                <button id="reset-empty-filters-btn" class="btn-secondary-sm" style="margin: 0 auto; display: inline-flex; cursor: pointer;">
                    Reset Search & Filters
                </button>
            </div>
        `;
        
        const resetBtn = elements.feedContainer.querySelector('#reset-empty-filters-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                state.searchQuery = '';
                state.currentCategory = 'all';
                elements.searchInput.value = '';
                elements.clearSearchBtn.style.display = 'none';
                
                document.querySelectorAll('.badge-btn').forEach(btn => {
                    if (btn.dataset.category === 'all') {
                        btn.classList.add('active');
                    } else {
                        btn.classList.remove('active');
                    }
                });
                
                applyFilters();
            });
        }
        return;
    }
    
    state.filteredNotes.forEach(note => {
        const card = document.createElement('article');
        card.className = `note-card ${state.selectedNote && state.selectedNote.id === note.id ? 'selected' : ''}`;
        card.dataset.id = note.id;
        card.dataset.type = note.type;
        card.setAttribute('tabindex', '0'); // Keyboard focusability
        
        // Render small HTML clean excerpt
        let excerpt = note.text;
        if (excerpt.length > 150) {
            excerpt = excerpt.substring(0, 150).trim() + "...";
        }
        
        const badgeClass = note.type.toLowerCase();
        
        card.innerHTML = `
            <div class="note-card-header">
                <div class="note-card-meta">
                    <span class="update-badge ${badgeClass}">${note.type}</span>
                    <span class="note-card-date">${note.date}</span>
                </div>
                <div class="note-card-actions">
                    <button class="card-copy-btn" title="Copy update text to clipboard" aria-label="Copy update text">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                        </svg>
                    </button>
                    <div class="share-action-indicator">
                        <svg viewBox="0 0 24 24" fill="currentColor" style="width: 14px; height: 14px;">
                            <path d="M18.244 2.25h3.308l-7.227 7.69 8.502 11.24H16.17l-5.214-6.817L4.99 21.142H1.68l7.73-8.235L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                    </div>
                </div>
            </div>
            <div class="note-card-snippet">${excerpt}</div>
        `;
        
        // Card copy button event listener
        const copyBtn = card.querySelector('.card-copy-btn');
        if (copyBtn) {
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent clicking copy from selecting note
                navigator.clipboard.writeText(note.text)
                    .then(() => {
                        showToast("Copied update to clipboard! 📋", "success");
                        triggerCopySuccessFeedback(copyBtn);
                    })
                    .catch(err => {
                        showToast("Could not copy update text.", "error");
                        console.error("Clipboard error:", err);
                    });
            });
        }
        
        // Selection handlers (Click & Keyboard)
        card.addEventListener('click', () => {
            selectNote(note);
        });
        
        card.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectNote(note);
            }
        });
        
        elements.feedContainer.appendChild(card);
    });
}

function selectNote(note) {
    state.selectedNote = note;
    
    // Highlight active card
    document.querySelectorAll('.note-card').forEach(card => {
        card.classList.remove('selected');
        if (card.dataset.id === note.id) {
            card.classList.add('selected');
        }
    });
    
    // Populate Detail Panel
    elements.detailTypeBadge.className = `update-badge ${note.type.toLowerCase()}`;
    elements.detailTypeBadge.textContent = note.type;
    elements.detailDate.textContent = note.date;
    elements.detailTitle.textContent = `BigQuery ${note.type} Update`;
    elements.detailHtmlContent.innerHTML = note.html;
    elements.detailDocLink.href = note.link;
    
    // Hide empty detail placeholder, show workspace
    elements.emptyDetailState.style.display = 'none';
    elements.activeWorkspace.style.display = 'flex';
    
    // Scroll detail panel to top
    document.getElementById('detail-panel').scrollTop = 0;
    
    // Initialize default Draft Preset Selection & content
    generateTweetDraft();
    
    // Handle responsiveness adaptation (Drawer opens on Mobile)
    if (window.innerWidth <= 768) {
        openMobileDrawer();
    }
}

/* ==========================================
   X / Twitter Tweet Composer Core Logic
   ========================================== */

function generateTweetDraft() {
    if (!state.selectedNote) return;
    
    const note = state.selectedNote;
    const link = note.link;
    const date = note.date;
    const desc = note.text;
    
    // Pre-calculate fixed strings lengths to smartly truncate description
    let header = "";
    let tags = "";
    
    switch (state.tweetPresetStyle) {
        case 'promo':
            header = `🚀 New #BigQuery Update (${date}): `;
            tags = `\n\nRead documentation:\n${link}\n#GoogleCloud #GCP #DataEngineering`;
            break;
        case 'casual':
            header = `💡 Just saw this neat BigQuery release note! `;
            tags = `\n\nDocs link: ${link}\n#BigQuery #Dataform`;
            break;
        case 'technical':
            header = `🛠️ BigQuery (${note.type}) release detail: `;
            tags = `\n\nOfficial specs: ${link}\n#SQL #CloudEngine`;
            break;
        case 'minimal':
            header = `BQ Release (${note.type}): `;
            tags = `\n\nLink: ${link}`;
            break;
    }
    
    // Math logic: 280 - headers length - tags length
    const totalExtraLength = header.length + tags.length;
    const maxDescLength = 280 - totalExtraLength - 5; // leave buffer room and space for ellipsis
    
    let trimmedDesc = desc;
    if (desc.length > maxDescLength) {
        trimmedDesc = desc.substring(0, maxDescLength).trim();
        // Cut at word boundary if possible
        const lastSpace = trimmedDesc.lastIndexOf(' ');
        if (lastSpace > maxDescLength * 0.75) {
            trimmedDesc = trimmedDesc.substring(0, lastSpace);
        }
        trimmedDesc += "...";
    }
    
    const finalTweet = `${header}${trimmedDesc}${tags}`;
    elements.tweetTextarea.value = finalTweet;
    
    updateCharMeter();
}

function updateCharMeter() {
    const text = elements.tweetTextarea.value;
    const length = text.length;
    const limit = 280;
    
    elements.charCounter.textContent = limit - length;
    
    // Highlight counter states
    elements.charCounter.className = 'char-count-text';
    if (length >= 240 && length < limit) {
        elements.charCounter.classList.add('warning');
    } else if (length >= limit) {
        elements.charCounter.classList.add('exceeded');
    }
    
    // Draw Progress Ring
    if (elements.charProgress) {
        const percentage = Math.min(length / limit, 1);
        const offset = PROGRESS_CIRCUMFERENCE - (percentage * PROGRESS_CIRCUMFERENCE);
        elements.charProgress.style.strokeDashoffset = offset;
        
        // Color Ring depending on characters threshold
        if (length < 240) {
            elements.charProgress.style.stroke = '#3b82f6'; // Blue
        } else if (length >= 240 && length < limit) {
            elements.charProgress.style.stroke = '#f59e0b'; // Amber
        } else {
            elements.charProgress.style.stroke = '#ef4444'; // Red
        }
    }
    
    // Show/hide Smart Trim Button
    const smartTrimBtn = document.getElementById('smart-trim-btn');
    if (smartTrimBtn) {
        if (length > limit) {
            smartTrimBtn.style.display = 'inline-flex';
        } else {
            smartTrimBtn.style.display = 'none';
        }
    }
    
    // Validate Tweet Share Action
    elements.tweetBtn.disabled = length > limit || length === 0;
}

/* ==========================================
   Mobile Bottom Sheet Drawer Handlers
   ========================================== */

function openMobileDrawer() {
    // Clone selection workspace from Desktop into Mobile scroll drawer
    elements.mobileDrawerBody.innerHTML = '';
    
    // Deep clone the active elements
    const clone = elements.activeWorkspace.cloneNode(true);
    clone.style.display = 'flex';
    clone.style.maxWidth = '100%';
    clone.style.margin = '0';
    clone.id = 'mobile-cloned-workspace';
    
    elements.mobileDrawerBody.appendChild(clone);
    elements.mobileDetailDrawer.classList.add('open');
    document.body.style.overflow = 'hidden'; // Lock background scroll
    
    // Wire cloned events for Mobile copy/tweet actions since deep cloning drops listener links
    wireClonedDrawerEvents();
}

function closeMobileDrawer() {
    elements.mobileDetailDrawer.classList.remove('open');
    document.body.style.overflow = ''; // Unlock scroll
}

function wireClonedDrawerEvents() {
    const cloneRoot = document.getElementById('mobile-cloned-workspace');
    if (!cloneRoot) return;
    
    const text = cloneRoot.querySelector('#tweet-textarea');
    const progress = cloneRoot.querySelector('#char-progress');
    const counter = cloneRoot.querySelector('#char-counter');
    const copyBtn = cloneRoot.querySelector('#copy-tweet-btn');
    const postBtn = cloneRoot.querySelector('#tweet-btn');
    const rewriteBtn = cloneRoot.querySelector('#suggest-rewrite-btn');
    const presets = cloneRoot.querySelector('#presets-drawer');
    const presetBtns = cloneRoot.querySelectorAll('.preset-btn');
    const smartTrimBtnMobile = cloneRoot.querySelector('#smart-trim-btn');
    
    // Initialize mobile character progress circle stroke dash properties
    progress.style.strokeDasharray = `${PROGRESS_CIRCUMFERENCE} ${PROGRESS_CIRCUMFERENCE}`;
    
    // Direct link to state
    text.value = elements.tweetTextarea.value;
    
    // Function to synchronize back from mobile to primary state
    function syncMobileToDesktop() {
        elements.tweetTextarea.value = text.value;
        updateCharMeter();
    }
    
    // Live update function inside mobile drawer
    function updateMobileCharMeter() {
        const len = text.value.length;
        counter.textContent = 280 - len;
        
        counter.className = 'char-count-text';
        if (len >= 240 && len < 280) {
            counter.classList.add('warning');
            progress.style.stroke = '#f59e0b';
        } else if (len >= 280) {
            counter.classList.add('exceeded');
            progress.style.stroke = '#ef4444';
        } else {
            progress.style.stroke = '#3b82f6';
        }
        
        const percentage = Math.min(len / 280, 1);
        progress.style.strokeDashoffset = PROGRESS_CIRCUMFERENCE - (percentage * PROGRESS_CIRCUMFERENCE);
        
        // Show/hide Smart Trim Button on Mobile
        if (smartTrimBtnMobile) {
            if (len > 280) {
                smartTrimBtnMobile.style.display = 'inline-flex';
            } else {
                smartTrimBtnMobile.style.display = 'none';
            }
        }
        
        postBtn.disabled = len > 280 || len === 0;
    }
    
    // Trigger mobile meter initially
    updateMobileCharMeter();
    
    // Input syncing
    text.addEventListener('input', () => {
        syncMobileToDesktop();
        updateMobileCharMeter();
    });
    
    // Presets Panel click
    rewriteBtn.addEventListener('click', () => {
        const isOpen = presets.style.display === 'block';
        presets.style.display = isOpen ? 'none' : 'block';
    });
    
    // Preset buttons clicks in mobile
    presets.addEventListener('click', (e) => {
        const btn = e.target.closest('.preset-btn');
        if (!btn) return;
        
        presetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Sync preset selection
        state.tweetPresetStyle = btn.dataset.preset;
        // Trigger generation
        generateTweetDraft();
        // Fetch generated value from main element and set it in mobile drawer
        text.value = elements.tweetTextarea.value;
        // Update both indicators
        updateMobileCharMeter();
    });
    
    // Copy Action inside mobile
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(text.value)
            .then(() => {
                showToast("Tweet draft copied to clipboard! 📋", "success");
                triggerCopySuccessFeedback(copyBtn);
            });
    });
    
    // Smart Trim Mobile Action
    if (smartTrimBtnMobile) {
        smartTrimBtnMobile.addEventListener('click', () => {
            performSmartTrim(text);
        });
    }
    
    // Post Action inside mobile
    postBtn.addEventListener('click', () => {
        if (text.value.length > 280) return;
        const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text.value)}`;
        window.open(tweetUrl, '_blank');
    });
}

/* ==========================================
   Global Toast Notification System
   ========================================== */

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Set icon depending on notification context
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
        `;
    } else if (type === 'error') {
        iconSvg = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
        `;
    } else {
        iconSvg = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
        `;
    }
    
    toast.innerHTML = `
        ${iconSvg}
        <span class="toast-message">${message}</span>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Automatically fade out after 3.5 seconds
    setTimeout(() => {
        toast.style.animation = 'toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse forwards';
        toast.addEventListener('animationend', () => {
            toast.remove();
        });
    }, 3500);
}

/* ==========================================
   Export to CSV Data Helper
   ========================================== */

function exportFilteredNotesToCSV() {
    if (state.filteredNotes.length === 0) {
        showToast("No release notes found to export.", "error");
        return;
    }
    
    // CSV Header Row
    const headers = ["ID", "Date", "Date_ISO", "Type", "Link", "Summary"];
    
    // Format cell value: wrap in quotes, escape existing quotes by doubling them
    const formatCell = (val) => {
        if (val === null || val === undefined) return '""';
        const str = String(val);
        return `"${str.replace(/"/g, '""')}"`;
    };
    
    // Build CSV Rows
    const csvRows = [];
    csvRows.push(headers.map(h => `"${h}"`).join(','));
    
    state.filteredNotes.forEach(note => {
        const row = [
            note.id,
            note.date,
            note.date_iso,
            note.type,
            note.link,
            note.text
        ];
        csvRows.push(row.map(formatCell).join(','));
    });
    
    const csvContent = "\uFEFF" + csvRows.join('\r\n'); // Add BOM for Excel support
    
    try {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `bigquery_release_notes_${state.currentCategory}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        showToast(`Exported ${state.filteredNotes.length} notes to CSV! 📊`, "success");
    } catch (err) {
        showToast("Failed to export CSV.", "error");
        console.error("Export to CSV error:", err);
    }
}

/* ==========================================
   UX Improvements Helper Utilities
   ========================================== */

function triggerCopySuccessFeedback(buttonElement) {
    if (!buttonElement) return;
    
    const originalHtml = buttonElement.innerHTML;
    buttonElement.classList.add('copy-success');
    
    const hasText = buttonElement.textContent.trim().length > 0;
    
    // Emerald green checkmark
    const checkmarkSvg = `
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-feature)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 1.1em; height: 1.1em; display: inline-block; vertical-align: middle; transition: var(--transition-fast);">
            <polyline points="20 6 9 17 4 12" />
        </svg>
    `;
    
    if (hasText) {
        buttonElement.innerHTML = `${checkmarkSvg} <span>Copied!</span>`;
    } else {
        buttonElement.innerHTML = checkmarkSvg;
    }
    
    setTimeout(() => {
        buttonElement.classList.remove('copy-success');
        buttonElement.innerHTML = originalHtml;
    }, 1500);
}

function performSmartTrim(textarea) {
    if (!textarea) return;
    let text = textarea.value;
    if (text.length <= 280) return;
    
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlRegex);
    
    if (urls && urls.length > 0 && state.selectedNote) {
        const overflow = text.length - 280;
        regenerateDraftWithTighterLimit(overflow + 10);
        showToast("Smart Trim applied! Preserved URLs and tags. ⚡", "success");
        return;
    }
    
    // Fallback: simple smart truncation at word boundary of the entire text to 277 + "..."
    let trimmed = text.substring(0, 277).trim();
    const lastSpace = trimmed.lastIndexOf(' ');
    if (lastSpace > 200) {
        trimmed = trimmed.substring(0, lastSpace);
    }
    textarea.value = trimmed + "...";
    updateCharMeter();
    showToast("Draft trimmed to fit X limit. ⚡", "success");
}

function regenerateDraftWithTighterLimit(extraTrim) {
    if (!state.selectedNote) return;
    
    const note = state.selectedNote;
    const link = note.link;
    const date = note.date;
    const desc = note.text;
    
    let header = "";
    let tags = "";
    
    switch (state.tweetPresetStyle) {
        case 'promo':
            header = `🚀 New #BigQuery Update (${date}): `;
            tags = `\n\nRead documentation:\n${link}\n#GoogleCloud #GCP #DataEngineering`;
            break;
        case 'casual':
            header = `💡 Just saw this neat BigQuery release note! `;
            tags = `\n\nDocs link: ${link}\n#BigQuery #Dataform`;
            break;
        case 'technical':
            header = `🛠️ BigQuery (${note.type}) release detail: `;
            tags = `\n\nOfficial specs: ${link}\n#SQL #CloudEngine`;
            break;
        case 'minimal':
            header = `BQ Release (${note.type}): `;
            tags = `\n\nLink: ${link}`;
            break;
    }
    
    const totalExtraLength = header.length + tags.length;
    // Squeeze the description
    const maxDescLength = Math.max(30, 280 - totalExtraLength - 5 - extraTrim);
    
    let trimmedDesc = desc;
    if (desc.length > maxDescLength) {
        trimmedDesc = desc.substring(0, maxDescLength).trim();
        const lastSpace = trimmedDesc.lastIndexOf(' ');
        if (lastSpace > maxDescLength * 0.75) {
            trimmedDesc = trimmedDesc.substring(0, lastSpace);
        }
        trimmedDesc += "...";
    }
    
    const finalTweet = `${header}${trimmedDesc}${tags}`;
    elements.tweetTextarea.value = finalTweet;
    updateCharMeter();
    
    // If mobile drawer is open, synchronize cloned textarea
    const mobileTextarea = document.querySelector('#mobile-cloned-workspace #tweet-textarea');
    if (mobileTextarea) {
        mobileTextarea.value = finalTweet;
        
        // Trigger mobile character meter update
        const progress = document.querySelector('#mobile-cloned-workspace #char-progress');
        const counter = document.querySelector('#mobile-cloned-workspace #char-counter');
        const postBtn = document.querySelector('#mobile-cloned-workspace #tweet-btn');
        if (progress && counter && postBtn) {
            const len = finalTweet.length;
            counter.textContent = 280 - len;
            counter.className = 'char-count-text';
            if (len >= 240 && len < 280) {
                counter.classList.add('warning');
                progress.style.stroke = '#f59e0b';
            } else if (len >= 280) {
                counter.classList.add('exceeded');
                progress.style.stroke = '#ef4444';
            } else {
                progress.style.stroke = '#3b82f6';
            }
            const percentage = Math.min(len / 280, 1);
            progress.style.strokeDashoffset = PROGRESS_CIRCUMFERENCE - (percentage * PROGRESS_CIRCUMFERENCE);
            postBtn.disabled = len > 280 || len === 0;
            const smartTrimMobile = document.querySelector('#mobile-cloned-workspace #smart-trim-btn');
            if (smartTrimMobile) {
                smartTrimMobile.style.display = len > 280 ? 'inline-flex' : 'none';
            }
        }
    }
}

function updateRelativeTimestamp() {
    if (!state.lastFetchedTimestamp) return;
    
    const now = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, now - state.lastFetchedTimestamp);
    
    let timeStr = "";
    if (diff < 5) {
        timeStr = "Sync: Just now";
    } else if (diff < 60) {
        timeStr = `Sync: ${diff}s ago`;
    } else if (diff < 3600) {
        const mins = Math.floor(diff / 60);
        timeStr = `Sync: ${mins}m ago`;
    } else {
        const hours = Math.floor(diff / 3600);
        timeStr = `Sync: ${hours}h ago`;
    }
    
    elements.lastUpdatedText.textContent = timeStr;
}
