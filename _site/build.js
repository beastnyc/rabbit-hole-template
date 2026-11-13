#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const frontMatter = require('front-matter');

// Configure marked for better rendering
marked.setOptions({
  gfm: true,
  breaks: true,
  headerIds: true
});

// Convert Obsidian embeds for images/videos and normalize asset paths
function convertImages(text) {
  // Handle Obsidian embeds: ![[file.ext]] or ![[file.ext|Alt]]
  text = text.replace(/!\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, file, alt) => {
    const raw = file.trim();
    const filename = raw.replace(/^\.?\/?(?:Attachments|attachments)\//, '');
    const altText = (alt || filename).trim();
    const ext = filename.split('.').pop().toLowerCase();
    const videoExts = new Set(['mp4','webm','ogg','mov']);
    if (videoExts.has(ext)) {
      return `<video controls preload="metadata" src="/attachments/${filename}"></video>`;
    }
    return `<img src="/attachments/${filename}" alt="${altText}">`;
  });

  // Standard Markdown images: rewrite Attachments path to /attachments
  text = text.replace(/(!\[[^\]]*\]\()\.?(?:\.\/)?Attachments\//g, '$1/attachments/');

  // Standard Markdown media using image syntax but with video files => convert to <video>
  text = text.replace(/!\[[^\]]*\]\(([^)]+)\)/g, (m, p1) => {
    const url = p1.trim();
    const clean = url.replace(/^\.?\/?(?:Attachments|attachments)\//, '/attachments/');
    const ext = clean.split('.').pop().toLowerCase();
    if (['mp4','webm','ogg','mov'].includes(ext)) {
      return `<video controls preload="metadata" src="${clean}"></video>`;
    }
    return m; // leave normal images alone
  });

  return text;
}

// Turn a note title or filename into a URL-safe id
function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(s, d);
    } else if (entry.isFile()) {
      fs.copyFileSync(s, d);
    }
  }
}

// Convert Obsidian wiki-links to HTML links
// knownNoteIds (optional Set): ids of notes that publish. Links to anything
// else (not written yet, or publish: false) render as plain text, not a 404.
function convertWikiLinks(text, knownNoteIds) {
  return text.replace(/\[\[([^\]]+)\]\]/g, (match, linkText) => {
    const decodedLinkText = linkText
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');
    const [target, display] = decodedLinkText.split('|').map(value => value.trim());
    const noteId = slugify(target);
    const label = display || target;
    if (knownNoteIds && !knownNoteIds.has(noteId)) {
      return `<span class="note-link-missing">${label}</span>`;
    }
    return `<a href="/notes/${noteId}.html" class="note-link" data-note="${noteId}">${label}</a>`;
  });
}

// Format a date string like 2025-09-18 to "Sep 18, 2025"
function formatDate(s) {
  try {
    const d = new Date(s);
    if (isNaN(d.getTime())) return s;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return s; }
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function stripMarkdown(value) {
  return String(value || '')
    .replace(/!\[\[[^\]]+\]\]/g, '')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, target, display) => display || target)
    .replace(/[#*_>`-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeExcerpt(body, maxLength = 220) {
  const text = stripMarkdown(body);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}...`;
}

function noteMetadata(attributes, body, noteId) {
  const tags = asArray(attributes.tags);
  const patterns = asArray(attributes.patterns);
  const isPublished =
    attributes.publish === true ||
    attributes.publish === 'true' ||
    attributes.fieldnotes === true ||
    attributes.fieldnotes === 'true';

  return {
    id: noteId,
    title: attributes.title || 'Untitled',
    description: attributes.description || '',
    excerpt: makeExcerpt(body),
    lastModified: attributes.last_modified || '',
    tags,
    type: attributes.type || 'field-note',
    status: attributes.status || 'open',
    rabbitHole: attributes.rabbit_hole || '',
    energy: attributes.energy || '',
    patterns,
    publish: isPublished,
    fieldnotes: isPublished,
    url: `/notes/${noteId}.html`
  };
}

// Note-page styles: theme/note.css, inlined into every page (indented to sit
// inside the <style> tag). Edit that file to theme the site.
const NOTE_CSS = '\n' + fs.readFileSync(path.join(__dirname, '..', 'theme', 'note.css'), 'utf8')
  .replace(/^(?=.)/gm, '        ');

// Share image needs an absolute URL. SITE_URL (e.g. a custom domain) wins;
// otherwise Vercel's production domain is used. With neither, no og:image.
const SITE_URL = (process.env.SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '')
).replace(/\/+$/, '');
const SHARE_IMAGE_TAGS = SITE_URL
  ? `    <meta property="og:image" content="${SITE_URL}/og.png">
    <meta name="twitter:card" content="summary_large_image">`
  : '';

// Build the site
function buildSite() {
  console.log('🔨 Building Rabbit Hole site...');
  
  // Create output directories
  const outputDir = '_site';
  const notesDir = path.join(outputDir, 'notes');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }
  if (!fs.existsSync(notesDir)) {
    fs.mkdirSync(notesDir);
  }
  
  // Copy static files
  const staticFiles = ['index.html', '404.html', 'favicon.svg', 'og.png'];
  staticFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(outputDir, file));
      console.log(`📄 Copied ${file}`);
    }
  });

  // The root redirect page is the URL people share: give it the share image too
  const rootPage = path.join(outputDir, 'index.html');
  if (fs.existsSync(rootPage)) {
    const html = fs.readFileSync(rootPage, 'utf8');
    fs.writeFileSync(rootPage, html.replace(/^\s*<!-- share-image -->\n?/m, SHARE_IMAGE_TAGS ? SHARE_IMAGE_TAGS + '\n' : ''));
  }
  
  // Copy attachments if present
  if (fs.existsSync('attachments')) {
    copyDirRecursive('attachments', path.join(outputDir, 'attachments'));
    console.log('🖼️  Copied attachments to _site/attachments');
  }
  
  // Process notes
  const notesDirPath = '_notes';
  const notes = [];
  
  if (fs.existsSync(notesDirPath)) {
    const noteFiles = fs.readdirSync(notesDirPath).filter(file => file.endsWith('.md'));
    const publishedNoteIds = new Set();
    noteFiles.forEach(file => {
      const { attributes, body } = frontMatter(fs.readFileSync(path.join(notesDirPath, file), 'utf8'));
      const noteId = slugify(file.replace('.md', ''));
      if (noteMetadata(attributes, body, noteId).publish) publishedNoteIds.add(noteId);
    });
    
    noteFiles.forEach(file => {
      const filePath = path.join(notesDirPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const { attributes, body } = frontMatter(content);
      
      // Convert images and wiki links, then to HTML
      const withImages = convertImages(body);
      let htmlContent = marked(withImages);
      htmlContent = convertWikiLinks(htmlContent, publishedNoteIds);
      
      // Create note ID from filename
      const noteId = slugify(file.replace('.md', ''));
      const metadata = noteMetadata(attributes, body, noteId);
      if (!metadata.publish) {
        console.log(`⏭️  Skipped private note: ${attributes.title || file}`);
        return;
      }
      const metaChips = [
        metadata.type,
        metadata.status,
        metadata.rabbitHole,
        metadata.energy ? `${metadata.energy} energy` : ''
      ].filter(Boolean);
      
      // Create note HTML
      const noteHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${attributes.title || 'Note'} - Rabbit Hole</title>
    <meta name="description" content="${escapeHtml(metadata.description || metadata.excerpt)}">
    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(attributes.title || 'Note')} - Rabbit Hole">
    <meta property="og:description" content="${escapeHtml(metadata.description || metadata.excerpt)}">
${SHARE_IMAGE_TAGS}
    <link rel="icon" href="/favicon.svg" type="image/svg+xml">
    <style>
${NOTE_CSS}
    </style>
</head>
<body>
    <div class="top-nav">
        <div class="nav-left"><a href="/" class="site-title">Rabbit Hole</a></div>
        <div class="nav-right">
            <div class="search-container">
                <span class="search-icon">🔍</span>
                <input type="text" class="search-input" placeholder="Search notes..." id="searchInput" aria-label="Search notes">
                <div class="search-results" id="searchResults"></div>
            </div>
        </div>
    </div>
    <!-- Static fallback container (hidden once React mounts) -->
    <div class="container" id="container">
        <div class="note-panel panel-current">
            <div class="note-content">
                <h1 class="note-title">${attributes.title || 'Note'}</h1>
                <div class="note-body">${htmlContent}</div>
                ${metaChips.length ? `<div class="note-kicker note-kicker-bottom">${metaChips.map(item => `<span class="note-chip">${escapeHtml(item)}</span>`).join('')}</div>` : ''}
                ${attributes.last_modified ? `
                <div class="note-meta">
                    <div class="last-modified"><span>📅</span> Last updated: ${formatDate(attributes.last_modified)}</div>
                    ${metadata.tags.length ? `
                    <div class="intersection-tags">${metadata.tags.map(tag => `<span class=\"intersection-tag\">${escapeHtml(tag)}</span>`).join('')}</div>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        </div>
    </div>

    <!-- React root for note stacking -->
    <div id="stack-root" style="display:none"></div>
    <script type="application/json" id="note-data">${JSON.stringify(metadata).replace(/</g, '\\u003c')}</script>

    <script>
        (function() {
            const input = document.getElementById('searchInput');
            const results = document.getElementById('searchResults');
            let notes = [];

            function normalize(value) {
                return String(value || '').toLowerCase();
            }

            // Note text goes into innerHTML below; keep a "<" or "&" in a title as text.
            function esc(value) {
                return String(value || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
            }

            function noteHaystack(note) {
                return [
                    note.title,
                    note.description,
                    note.excerpt,
                    note.type,
                    note.status,
                    note.rabbitHole,
                    note.energy,
                    ...(note.tags || []),
                    ...(note.patterns || [])
                ].map(normalize).join(' ');
            }

            function renderResults(matches) {
                if (!matches.length) {
                    results.innerHTML = '<div class="search-result"><div class="search-result-title">No matches yet</div><div class="search-result-excerpt">Try a topic, pattern, status, note type, or rabbit hole.</div></div>';
                    results.classList.add('active');
                    return;
                }

                results.innerHTML = matches.slice(0, 8).map(note => (
                    '<a class="search-result" href="' + esc(note.url) + '">' +
                    '<div class="search-result-title">' + esc(note.title) + '</div>' +
                    '<div class="search-result-meta">' + esc([note.type, note.status, note.rabbitHole].filter(Boolean).join(' / ')) + '</div>' +
                    '<div class="search-result-excerpt">' + esc(note.excerpt) + '</div>' +
                    '</a>'
                )).join('');
                results.classList.add('active');
            }

            fetch('/notes.json')
                .then(res => res.json())
                .then(data => { notes = Array.isArray(data) ? data : (Array.isArray(data.notes) ? data.notes : []); })
                .catch(() => { notes = []; });

            input.addEventListener('input', function(e) {
                const query = normalize(e.target.value).trim();
                if (!query) {
                    results.classList.remove('active');
                    results.innerHTML = '';
                    return;
                }

                const terms = query.split(/\\s+/).filter(Boolean);
                const matches = notes.filter(note => {
                    const haystack = noteHaystack(note);
                    return terms.every(term => haystack.includes(term));
                });

                renderResults(matches);
            });

            document.addEventListener('click', function(e) {
                if (!results.contains(e.target) && e.target !== input) {
                    results.classList.remove('active');
                }
            });
        })();

        // Multi-panel navigation: open links to the right (max 3 panels)
        (function() {
            // Expose a tiny helper to show mode as a badge
            function setStackBadge(mode){
                try {
                    let el = document.getElementById('stack-badge');
                    if (!el){
                        el = document.createElement('div');
                        el.id = 'stack-badge';
                        el.className = 'stack-badge';
                        document.body.appendChild(el);
                    }
                    el.textContent = 'Stack: ' + mode;
                } catch {}
            }
            try { window.__setStackBadge = setStackBadge; } catch {}
            const MAX_PANELS = 3;
            const container = document.getElementById('container');
            try { if (!window.__STACKED_REACT__) { console.info('[Stack] Mode: Vanilla fallback'); setStackBadge('Vanilla'); } } catch {}

            function getIdFromHref(href) {
                try {
                    const u = new URL(href, window.location.origin);
                    const m = u.pathname.match(/\\/notes\\/([^/.]+)(?:\\.html)?$/);
                    return m ? m[1] : null;
                } catch { return null; }
            }

            function updateURLStack(newId, baseIndex) {
                const url = new URL(window.location.href);
                const params = url.searchParams;
                const existing = params.getAll('stackedNotes').filter(Boolean);
                const start = Number.isFinite(baseIndex) && baseIndex >= 0 ? baseIndex + 1 : existing.length;
                const trimmedBase = existing.slice(0, start);
                if (newId) trimmedBase.push(newId);
                // Limit to last 3 ids in URL
                const trimmed = trimmedBase.slice(-3);
                params.delete('stackedNotes');
                trimmed.forEach(id => params.append('stackedNotes', id));
                history.pushState({ stackedNotes: trimmed }, '', url);
            }

            async function openNote(url, { pushState = true, baseIndex = null } = {}) {
                try {
                    // Ensure .html for fetch
                    let fetchUrl = url;
                    if (!/\\.html($|\\?)/.test(fetchUrl)) fetchUrl = url.replace(/(\\/notes\\/[^/?#]+)(.*)$/, '$1.html$2');
                    const res = await fetch(fetchUrl, { credentials: 'same-origin' });
                    if (!res.ok) throw new Error('Failed to load note: ' + url);
                    const html = await res.text();
                    const doc = new DOMParser().parseFromString(html, 'text/html');
                    const titleEl = doc.querySelector('.note-title');
                    const bodyEl = doc.querySelector('.note-body');
                    const title = titleEl ? titleEl.textContent : 'Note';
                    const body = bodyEl ? bodyEl.innerHTML : '<p>Content unavailable.</p>';

                    const panel = document.createElement('div');
                    panel.className = 'note-panel';
                    panel.innerHTML = '<div class="note-content">'
                      + '<h1 class="note-title">' + title + '</h1>'
                      + '<div class="note-body">' + body + '</div>'
                      + '</div>';

                    // Manage collapsed left strip + up to 3 full panels
                    const panels = Array.from(container.querySelectorAll('.note-panel'));
                    const fullPanels = panels.filter(p => !p.classList.contains('collapsed'));
                    if (fullPanels.length >= MAX_PANELS) {
                        const first = panels[0];
                        if (first && !first.classList.contains('collapsed')) {
                            first.classList.add('collapsed');
                        } else if (first && first.classList.contains('collapsed')) {
                            // Already collapsed; drop it to keep only one collapsed strip
                            container.removeChild(first);
                        }
                    }
                    container.appendChild(panel);
                    relabelPanels();
                    // Scroll so two full panels are visible and third partially
                    const vw = container.clientWidth || window.innerWidth;
                    container.scrollLeft = Math.max(0, container.scrollWidth - vw * 0.8);

                    if (pushState) {
                        const id = getIdFromHref(url);
                        if (id) updateURLStack(id, baseIndex);
                    }
                } catch (err) {
                    console.error(err);
                    window.location.href = url; // fallback to navigation
                }
            }

            document.addEventListener('click', function(e) {
                // If React app is mounted, let it handle stacking
                if (window && window.__STACKED_REACT__) return;
                // Click-to-expand for collapsed left strip (first column)
                const collapsedPanel = e.target.closest && e.target.closest('.note-panel.collapsed');
                if (collapsedPanel) {
                    // Expand the collapsed panel and, if we now exceed MAX_PANELS full panels,
                    // collapse the next panel to the right to keep the history strip.
                    collapsedPanel.classList.remove('collapsed');
                    const panelsAll = Array.from(container.querySelectorAll('.note-panel'));
                    const fullAfter = panelsAll.filter(p => !p.classList.contains('collapsed'));
                    if (fullAfter.length > MAX_PANELS) {
                        // Collapse the next panel to the right (index 1), if present
                        const next = panelsAll[1];
                        if (next) next.classList.add('collapsed');
                    }
                    relabelPanels();
                    // Bring expanded panel into view on the left
                    container.scrollLeft = Math.max(0, container.scrollLeft - 200);
                    e.preventDefault();
                    return;
                }
                // Intercept internal note links broadly: data-note, .note-link, or href starts with /notes/
                const link = (e.target.closest && (e.target.closest('a[data-note], a.note-link, a[href^="/notes/"]')));
                if (!link) return;
                const panelEl = e.target.closest('.note-panel');
                if (!panelEl) return;
                e.preventDefault();
                const href = link.getAttribute('href');
                if (!(href && href.startsWith('/notes/'))) {
                    if (href) window.location.href = href;
                    return;
                }
                // Determine which panel the click came from and truncate to that point
                const panels = Array.from(container.querySelectorAll('.note-panel'));
                const fullPanels = panels.filter(p => !p.classList.contains('collapsed'));
                const clickedIndexAll = panels.indexOf(panelEl);
                const clickedIndexFull = fullPanels.indexOf(panelEl);
                // Remove panels to the right of the clicked one
                for (let i = panels.length - 1; i > clickedIndexAll; i--) {
                    container.removeChild(panels[i]);
                }
                // Open the next note as a new panel to the right
                try { console.info('[Stack] openNote (vanilla):', href); } catch {}
                openNote(href, { pushState: true, baseIndex: clickedIndexFull });
            });

            // Restore stacked notes from URL on load
            window.addEventListener('DOMContentLoaded', () => {
                if (window && window.__STACKED_REACT__) return; // React will restore
                try {
                    const params = new URL(window.location.href).searchParams;
                    const ids = params.getAll('stackedNotes');
                    ids.forEach(id => openNote('/notes/' + id + '.html', { pushState: false }));
                } catch (e) { console.warn('Restore stack failed', e); }
                // Ensure the initial pre-rendered panel gets labeled for widths
                try { relabelPanels(); } catch {}
            });
            function relabelPanels() {
                const panels = Array.from(container.querySelectorAll('.note-panel'));
                const states = ['panel-current','panel-current-split','panel-previous','panel-previous-split','panel-collapsed'];
                panels.forEach(panel => {
                    states.forEach(cls => panel.classList.remove(cls));
                    panel.classList.remove('collapsed');
                });
                const total = panels.length;
                panels.forEach((panel, index) => {
                    const positionFromEnd = total - 1 - index;
                    let type = 'collapsed';
                    if (total === 1) {
                        type = 'current';
                    } else if (total === 2) {
                        type = positionFromEnd === 0 ? 'current-split' : 'previous-split';
                    } else if (total >= 3) {
                        if (positionFromEnd === 0) {
                            type = 'current';
                        } else if (positionFromEnd === 1) {
                            type = 'previous';
                        }
                    }
                    panel.classList.add('panel-' + type);
                    if (type === 'collapsed') panel.classList.add('collapsed');
                });
            }
        })();
    </script>

    <!-- React app for enhanced note stacking -->
    <script type="module" src="/assets/main.js"></script>
</body>
</html>`;
      
      // Write note HTML file
      const noteFilePath = path.join(notesDir, `${noteId}.html`);
      fs.writeFileSync(noteFilePath, noteHtml);
      
      // Add to notes array for index
      notes.push({
        ...metadata
      });
      
      console.log(`📝 Built note: ${attributes.title || file}`);
    });
  }
  
  // Create notes index JSON
  const notesIndex = {
    notes: notes.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified))
  };
  
  fs.writeFileSync(path.join(outputDir, 'notes.json'), JSON.stringify(notesIndex, null, 2));
  
  console.log(`✅ Built ${notes.length} notes`);
  console.log(`🌐 Site built in ${outputDir}/`);
  console.log(`📊 Notes index: ${outputDir}/notes.json`);
}

// Run build
buildSite(); 
