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
function convertWikiLinks(text) {
  return text.replace(/\[\[([^\]]+)\]\]/g, (match, linkText) => {
    const decodedLinkText = linkText
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&');
    const [target, display] = decodedLinkText.split('|').map(value => value.trim());
    const noteId = target.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const label = display || target;
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

const NOTE_CSS = String.raw`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        :root {
            --bg-primary: #f8f9fa;
            --bg-secondary: #e9ecef;
            --bg-panel: rgba(255, 255, 255, 0.9);
            --bg-nav: rgba(255, 255, 255, 0.95);
            --text-primary: #1a1a1a;
            --text-secondary: #2d3748;
            --text-muted: #6b7280;
            --accent-primary: #ff6b35;
            --accent-secondary: #f7931e;
            --border-color: rgba(15, 23, 42, 0.08);
            --panel-gap: 0px;
            --panel-radius: 8px;
            --panel-current-width: clamp(26rem, 44vw, 38rem);
            --panel-previous-width: clamp(20rem, 35vw, 32rem);
            --panel-context-width: 48px;
            --panel-collapsed-width: 48px;
            --panel-overlap: 0px;
            --panel-shadow: 0 24px 48px rgba(15, 23, 42, 0.12);
        }

        [data-theme="dark"] {
            --bg-primary: #0d1117;
            --bg-secondary: #111827;
            --bg-panel: rgba(30, 35, 42, 0.92);
            --bg-nav: rgba(24, 29, 39, 0.92);
            --text-primary: #f0f6fc;
            --text-secondary: #c9d1d9;
            --text-muted: #8b949e;
            --accent-primary: #ff6b35;
            --accent-secondary: #f7931e;
            --border-color: rgba(240, 246, 252, 0.08);
            --panel-shadow: 0 24px 54px rgba(8, 9, 12, 0.55);
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        .stack-badge {
            display: none;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: var(--text-primary);
            background: radial-gradient(circle at top left, rgba(255, 255, 255, 0.95), var(--bg-secondary));
            height: 100vh;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            transition: background 0.3s ease, color 0.3s ease;
        }

        .top-nav {
            background: rgba(255, 255, 255, 0.5);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid rgba(15, 23, 42, 0.05);
            padding: 5px clamp(12px, 3vw, 24px);
            flex-shrink: 0;
            z-index: 200;
            position: relative;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .nav-left,
        .nav-right {
            display: flex;
            align-items: center;
            gap: 14px;
        }

        .search-container {
            position: relative;
            display: flex;
            align-items: center;
        }

        .search-input {
            background: rgba(255, 255, 255, 0.62);
            border: 1px solid rgba(15, 23, 42, 0.08);
            border-radius: 16px;
            padding: 5px 10px 5px 32px;
            font-size: 12px;
            color: var(--text-primary);
            width: 160px;
            transition: all 0.3s ease;
        }

        .search-input:focus {
            outline: none;
            border-color: var(--accent-primary);
            width: 250px;
            box-shadow: 0 0 0 2px rgba(255, 107, 53, 0.1);
        }

        .search-icon {
            position: absolute;
            left: 12px;
            color: var(--text-muted);
            font-size: 12px;
        }

        .search-results {
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            width: min(420px, calc(100vw - 32px));
            max-height: 70vh;
            overflow: auto;
            background: rgba(255, 255, 255, 0.98);
            border: 1px solid var(--border-color);
            box-shadow: 0 24px 48px rgba(15, 23, 42, 0.14);
            z-index: 500;
            display: none;
        }

        .search-results.active {
            display: block;
        }

        .search-result {
            display: block;
            padding: 14px 16px;
            color: var(--text-primary);
            text-decoration: none;
            border-bottom: 1px solid rgba(15, 23, 42, 0.07);
        }

        .search-result:hover {
            background: rgba(255, 107, 53, 0.08);
        }

        .search-result-title {
            font-size: 14px;
            font-weight: 800;
            text-transform: uppercase;
        }

        .search-result-meta,
        .search-result-excerpt {
            margin-top: 4px;
            font-size: 12px;
            color: var(--text-muted);
            line-height: 1.4;
        }

        .site-title {
            color: var(--text-primary);
            font-size: 12px;
            font-weight: 600;
            text-transform: none;
            letter-spacing: 0;
            opacity: 0.58;
            text-decoration: none;
        }

        .site-title:hover {
            opacity: 1;
        }

        #stack-root {
            flex: 1 1 auto;
            min-height: 0;
        }

        .stack-shell {
            height: 100%;
            min-height: 0;
            display: flex;
            flex-direction: column;
        }

        .trail-bar {
            min-height: 38px;
            padding: 6px 10px;
            border-bottom: 1px solid var(--border-color);
            background: rgba(255, 255, 255, 0.7);
            display: flex;
            flex-direction: row;
            align-items: center;
            justify-content: space-between;
            gap: 5px;
            flex-shrink: 0;
            position: relative;
        }

        .trail-main {
            display: flex;
            align-items: center;
            gap: 7px;
            overflow-x: auto;
        }

        .trail-chip {
            border: 1px solid rgba(15, 23, 42, 0.08);
            background: rgba(255, 255, 255, 0.64);
            color: var(--text-primary);
            font: inherit;
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            padding: 5px 8px;
            white-space: nowrap;
            cursor: pointer;
        }

        .trail-label,
        .trail-status {
            color: var(--text-muted);
            font-size: 10px;
            font-weight: 800;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            white-space: nowrap;
        }

        .trail-status {
            margin-left: auto;
            padding-left: 16px;
        }

        .trail-chip.branch {
            background: transparent;
            border-color: transparent;
            color: var(--text-muted);
            padding-left: 0;
            padding-right: 4px;
        }

        .link-preview {
            position: fixed;
            width: min(340px, calc(100vw - 28px));
            max-height: 240px;
            overflow: hidden;
            padding: 14px 15px 15px;
            background: rgba(255, 255, 255, 0.98);
            border: 1px solid rgba(15, 23, 42, 0.12);
            box-shadow: 0 18px 48px rgba(15, 23, 42, 0.16);
            z-index: 5000;
            pointer-events: none;
        }

        .link-preview-title {
            color: var(--text-primary);
            font-size: 16px;
            line-height: 1.15;
            font-weight: 900;
            text-transform: uppercase;
        }

        .link-preview-excerpt {
            margin-top: 10px;
            color: var(--text-secondary);
            font-size: 13px;
            line-height: 1.45;
        }

        .link-preview.loading .link-preview-title,
        .link-preview.loading .link-preview-excerpt {
            color: var(--text-muted);
        }

        .trail-chip:hover,
        .trail-chip.active {
            border-color: var(--accent-primary);
            color: var(--accent-primary);
        }

        .trail-separator {
            color: var(--text-muted);
            font-size: 12px;
        }

        .container,
        .pane-container {
            display: flex;
            align-items: stretch;
            flex: 1 1 auto;
            height: 100%;
            min-height: 0;
            width: 100%;
            overflow-x: auto;
            overflow-y: hidden;
            gap: var(--panel-gap);
            padding: 0;
            scroll-behavior: smooth;
            position: relative;
            scroll-padding-inline: 0;
        }

        .container::after,
        .pane-container::after {
            content: '';
            position: absolute;
            right: 0;
            top: 0;
            bottom: 0;
            width: 80px;
            pointer-events: none;
            background: linear-gradient(90deg, rgba(248, 249, 250, 0) 0%, var(--bg-primary) 80%);
        }

        .note-panel {
            box-sizing: border-box;
            background: var(--bg-panel);
            border: 1px solid var(--border-color);
            border-radius: var(--panel-radius);
            overflow-y: auto;
            position: relative;
            flex: 0 0 auto;
            width: var(--panel-previous-width);
            height: 100%;
            min-height: 100%;
            box-shadow: var(--panel-shadow);
            border-top: none;
            border-bottom: none;
            border-radius: 0;
            transition:
                width 0.35s cubic-bezier(0.19, 1, 0.22, 1),
                margin-left 0.35s cubic-bezier(0.19, 1, 0.22, 1),
                transform 0.35s cubic-bezier(0.19, 1, 0.22, 1),
                opacity 0.2s ease,
                box-shadow 0.35s ease;
            backdrop-filter: blur(24px);
        }

        .note-panel + .note-panel {
            margin-left: calc(var(--panel-overlap) * -1);
        }

        .note-panel.panel-current,
        .note-panel.panel-current-split {
            width: var(--panel-current-width);
            cursor: default;
            transform: translateX(0) scale(1);
        }

        .note-panel.panel-previous-split {
            width: var(--panel-previous-width);
            cursor: pointer;
            opacity: 0.9;
            transform: translateX(0) scale(0.985);
        }

        .note-panel.panel-previous {
            width: var(--panel-previous-width);
            min-width: var(--panel-previous-width);
            cursor: pointer;
            opacity: 0.96;
            overflow-y: auto;
            background: rgba(255, 255, 255, 0.94);
            transform: translateX(0) scale(1);
        }

        .note-panel.panel-previous:hover,
        .note-panel.panel-previous-split:hover {
            opacity: 1;
            box-shadow: 0 28px 54px rgba(15, 23, 42, 0.18);
        }

        .note-panel.panel-collapsed,
        .note-panel.collapsed {
            flex: 0 0 var(--panel-collapsed-width);
            width: var(--panel-collapsed-width);
            min-width: var(--panel-collapsed-width);
            background: rgba(255, 255, 255, 0.96);
            border-radius: calc(var(--panel-radius) - 6px);
            border: 1px solid rgba(148, 163, 184, 0.45);
            border-left: 3px solid var(--accent-primary);
            cursor: pointer;
            box-shadow: 0 12px 30px rgba(15, 23, 42, 0.1);
            transform: translateX(0) scale(0.98);
            overflow: hidden;
        }

        .note-panel.panel-collapsed .note-content,
        .note-panel.collapsed .note-content {
            display: none;
        }

        .note-panel.panel-collapsed:hover,
        .note-panel.collapsed:hover {
            background: var(--accent-primary);
            border-color: var(--accent-primary);
        }

        .collapsed-content {
            height: 100vh;
            min-height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            position: relative;
        }

        .collapsed-title {
            position: absolute;
            left: 50%;
            top: 50%;
            width: max-content;
            max-width: calc(100vh - 180px);
            transform: translate(-50%, -50%) rotate(-90deg);
            transform-origin: center;
            font-size: 13px;
            font-weight: 800;
            color: var(--text-primary);
            text-align: center;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            line-height: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .note-panel.panel-collapsed:hover .collapsed-title,
        .note-panel.collapsed:hover .collapsed-title {
            color: #fff;
        }

        .closed-pane-content {
            height: 100%;
            padding: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            background:
                linear-gradient(90deg, rgba(255, 107, 53, 0.18), rgba(255, 255, 255, 0) 26%),
                var(--bg-panel);
        }

        .closed-pane-title {
            position: absolute;
            left: 50%;
            top: 50%;
            width: max-content;
            max-width: calc(100vh - 180px);
            transform: translate(-50%, -50%) rotate(-90deg);
            transform-origin: center;
            color: var(--text-primary);
            font-size: 15px;
            font-weight: 800;
            line-height: 1;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .note-content {
            padding: 56px clamp(34px, 4vw, 72px) 48px clamp(34px, 4vw, 56px);
            max-width: 100%;
            position: relative;
            min-height: 100%;
        }

        .note-content a {
            color: var(--accent-primary);
            text-decoration: underline;
            cursor: pointer;
        }

        .note-content a:hover {
            color: var(--accent-secondary);
            text-decoration: none;
        }

        .note-title {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 28px;
            color: var(--text-primary);
            line-height: 1.2;
            position: relative;
            letter-spacing: 0;
            padding-right: 60px;
            text-transform: uppercase;
        }

        .note-title::after {
            content: '';
            position: absolute;
            bottom: -10px;
            left: 0;
            width: 64px;
            height: 3px;
            background: linear-gradient(90deg, var(--accent-primary), var(--accent-secondary));
        }

        .note-kicker {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 18px;
        }

        .note-kicker-bottom {
            margin-top: 36px;
            margin-bottom: 0;
            padding-top: 22px;
            border-top: 1px solid rgba(15, 23, 42, 0.08);
        }

        .note-chip {
            border: 1px solid rgba(15, 23, 42, 0.1);
            background: rgba(255, 107, 53, 0.08);
            color: var(--text-secondary);
            padding: 4px 7px;
            font-size: 11px;
            font-weight: 800;
            line-height: 1;
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }

        .note-body {
            font-size: 16px;
            line-height: 1.72;
            max-width: 48rem;
        }

        .note-body img,
        .note-body video {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 16px 0;
            border-radius: 8px;
        }

        .note-body video {
            width: 100%;
        }

        .note-body p {
            margin-bottom: 16px;
        }

        .note-body h2 {
            font-size: 20px;
            font-weight: 600;
            margin: 36px 0 16px;
            color: var(--text-primary);
        }

        .note-body h3 {
            font-size: 18px;
            font-weight: 600;
            margin: 28px 0 12px;
            color: var(--text-primary);
        }

        .note-body ul,
        .note-body ol {
            margin-bottom: 18px;
            padding-left: 26px;
        }

        .note-body li {
            margin-bottom: 8px;
        }

        .note-link {
            color: var(--accent-primary);
            text-decoration: none;
            cursor: pointer;
            border-bottom: 1px solid transparent;
            transition: border-color 0.2s;
        }

        .note-link:hover {
            border-bottom-color: var(--accent-primary);
        }

        .note-link.active-note-link,
        .note-content a.active-note-link {
            background: rgba(255, 107, 53, 0.12);
            border-bottom-color: var(--accent-primary);
            border-radius: 4px;
            box-decoration-break: clone;
            -webkit-box-decoration-break: clone;
        }

        .note-meta {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-top: 36px;
            padding-top: 28px;
            border-top: 1px solid rgba(15, 23, 42, 0.08);
            font-size: 12px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.6px;
        }

        .last-modified {
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .intersection-tags {
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
        }

        .intersection-tag {
            background: linear-gradient(45deg, var(--accent-primary), var(--accent-secondary));
            color: #fff;
            padding: 3px 8px;
            border-radius: 10px;
            font-size: 10px;
            font-weight: 600;
            letter-spacing: 0.4px;
        }

        @media (max-width: 900px) {
            .top-nav {
                padding: 12px 18px;
                flex-direction: column;
                gap: 10px;
                height: auto;
            }

            .nav-left,
            .nav-right {
                width: 100%;
                justify-content: space-between;
            }

            .search-input {
                width: 150px;
            }

            .search-input:focus {
                width: 180px;
            }

            .container,
            .pane-container {
                height: auto;
                padding: 0;
                flex-direction: column;
                overflow-x: hidden;
                overflow-y: auto;
                gap: 20px;
            }

            .container::after,
            .pane-container::after {
                display: none;
            }

            .note-panel,
            .note-panel.panel-current,
            .note-panel.panel-previous,
            .note-panel.panel-current-split,
            .note-panel.panel-previous-split {
                width: 100%;
                min-width: auto;
                flex: 1 1 auto;
            }

            .note-panel.panel-collapsed,
            .note-panel.collapsed {
                display: none;
            }

            .note-panel + .note-panel {
                margin-left: 0;
            }

            .note-content {
                padding: 32px 24px 28px 24px;
            }

            .note-title {
                font-size: 24px;
                padding-right: 42px;
            }
        }
`;

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
  const staticFiles = ['index.html', 'admin.html', 'serve.py'];
  staticFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, path.join(outputDir, file));
      console.log(`📄 Copied ${file}`);
    }
  });
  
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
    
    noteFiles.forEach(file => {
      const filePath = path.join(notesDirPath, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const { attributes, body } = frontMatter(content);
      
      // Convert images and wiki links, then to HTML
      const withImages = convertImages(body);
      let htmlContent = marked(withImages);
      htmlContent = convertWikiLinks(htmlContent);
      
      // Create note ID from filename
      const noteId = file.replace('.md', '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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
    <link rel="stylesheet" href="/assets/css/style.css">
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
                <input type="text" class="search-input" placeholder="Search notes..." id="searchInput">
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
                    '<a class="search-result" href="' + note.url + '">' +
                    '<div class="search-result-title">' + note.title + '</div>' +
                    '<div class="search-result-meta">' + [note.type, note.status, note.rabbitHole].filter(Boolean).join(' / ') + '</div>' +
                    '<div class="search-result-excerpt">' + (note.excerpt || '') + '</div>' +
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
