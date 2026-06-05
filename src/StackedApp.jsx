import React from 'react';

function getIdFromHref(href) {
  const match = href && href.match(/\/notes\/([^/.]+)(?:\.html)?/);
  return match ? match[1] : null;
}

function normalizeNoteHref(href) {
  const id = getIdFromHref(href);
  return id ? `/notes/${id}.html` : href;
}

function markActiveLinkHtml(body, activeChildHref) {
  if (!body || !activeChildHref || typeof document === 'undefined') return body;

  try {
    const activeHref = normalizeNoteHref(activeChildHref);
    const wrapper = document.createElement('div');
    wrapper.innerHTML = body;

    wrapper.querySelectorAll('a[href]').forEach((link) => {
      if (normalizeNoteHref(link.getAttribute('href')) === activeHref) {
        link.classList.add('active-note-link');
        link.setAttribute('aria-current', 'page');
      }
    });

    return wrapper.innerHTML;
  } catch {
    return body;
  }
}

const Panel = React.forwardRef(function Panel(
  { title, body, meta, activeChildHref, index, totalPanels, onClick },
  ref
) {
  const positionFromEnd = totalPanels - 1 - index;
  const zIndex = 1000 + index;

  let panelType = 'collapsed';

  if (totalPanels === 1) {
    panelType = 'current';
  } else if (totalPanels === 2) {
    panelType = positionFromEnd === 0 ? 'current-split' : 'previous-split';
  } else if (totalPanels >= 3) {
    if (positionFromEnd === 0) {
      panelType = 'current';
    } else if (positionFromEnd === 1) {
      panelType = 'previous';
    }
  }

  const classNames = ['note-panel', `panel-${panelType}`];
  if (panelType === 'collapsed') classNames.push('collapsed');

  const shouldHandleClick = !['current', 'current-split'].includes(panelType);
  const markedBody = React.useMemo(
    () => markActiveLinkHtml(body, activeChildHref),
    [body, activeChildHref]
  );
  const metaChips = [meta?.type, meta?.status, meta?.rabbitHole, meta?.energy ? `${meta.energy} energy` : '']
    .filter(Boolean);

  return (
    <div
      className={classNames.join(' ')}
      ref={ref}
      style={{ zIndex }}
      onClick={shouldHandleClick ? onClick : undefined}
    >
      {panelType === 'collapsed' ? (
        <div className="collapsed-content">
          <div className="collapsed-title">{title || 'Note'}</div>
        </div>
      ) : (
        <div className="note-content">
          <h1 className="note-title">{title || 'Note'}</h1>
          <div className="note-body" dangerouslySetInnerHTML={{ __html: markedBody }} />
          {metaChips.length > 0 && (
            <div className="note-kicker note-kicker-bottom">
              {metaChips.map((item) => (
                <span className="note-chip" key={item}>{item}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default function StackedApp({ initial }) {
  const initialIdRef = React.useRef(initial.id || getIdFromHref(window.location.pathname));
  const [panels, setPanels] = React.useState(() => [
    {
      title: initial.title,
      body: initial.body,
      href: initial.href || window.location.pathname,
      id: initialIdRef.current,
      meta: initial.meta || {},
    },
  ]);
  const [preview, setPreview] = React.useState(null);
  const panelsRef = React.useRef(panels);
  const containerRef = React.useRef(null);
  const panelRefs = React.useRef([]);
  const previewCacheRef = React.useRef(new Map());
  const previewRequestRef = React.useRef(0);
  const previewCloseTimerRef = React.useRef(null);
  const currentPanel = panels[panels.length - 1] || panels[0];
  const originPanel = panels[0];
  const pathPanels = panels.slice(1);

  const updateHistoryWithPanels = React.useCallback((stack, { mode = 'replace' } = {}) => {
    try {
      const ids = stack.map((panel) => panel.id).filter(Boolean);
      const url = new URL(window.location.href);
      if (ids[0] === 'index') {
        url.pathname = '/notes/index.html';
      }
      url.searchParams.delete('stackedNotes');
      ids.forEach((value) => url.searchParams.append('stackedNotes', value));
      const state = { stackedNotes: ids };
      if (mode === 'push') {
        window.history.pushState(state, '', url);
      } else {
        window.history.replaceState(state, '', url);
      }
    } catch (error) {
      console.warn('Unable to sync stacked notes history', error);
    }
  }, []);

  React.useEffect(() => {
    const cont = document.getElementById('container');
    if (cont) cont.style.display = 'none';
    const root = document.getElementById('stack-root');
    if (root) root.style.display = 'block';
  }, []);

  React.useEffect(() => {
    panelsRef.current = panels;
  }, [panels]);

  React.useEffect(() => {
    panelRefs.current = panelRefs.current.slice(-panels.length);
  }, [panels.length]);

  React.useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.scrollTo({
        left: 0,
        behavior: 'smooth',
      });
    }
  }, [panels]);

  React.useEffect(() => {
    setPreview(null);
  }, [currentPanel?.href]);

  const openNote = React.useCallback(async (href, baseIndex, { historyMode = 'push' } = {}) => {
    try {
      let fetchUrl = href;
      if (!/\.html($|\?)/.test(fetchUrl)) {
        fetchUrl = href.replace(/(\/notes\/[^/?#]+)(.*)$/, '$1.html$2');
      }

      const res = await fetch(fetchUrl, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load ' + fetchUrl);

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const title =
        (doc.querySelector('.note-title') || {}).textContent || 'Note';
      const body =
        (doc.querySelector('.note-body') || {}).innerHTML ||
        '<p>Content unavailable.</p>';
      let meta = {};
      try {
        meta = JSON.parse(doc.getElementById('note-data')?.textContent || '{}');
      } catch {}
      const id = getIdFromHref(fetchUrl) || getIdFromHref(href);
      const normalizedHref = id ? `/notes/${id}.html` : fetchUrl;

      const currentPanels = panelsRef.current;
      const base =
        Number.isInteger(baseIndex) && baseIndex >= 0
          ? currentPanels.slice(0, baseIndex + 1)
          : currentPanels.slice();
      const withoutDuplicate = base.filter(
        (panel) => panel.href !== normalizedHref
      );
      const nextPanels = [
        ...withoutDuplicate,
        { title, body, href: normalizedHref, id, meta },
      ];

      panelsRef.current = nextPanels;
      setPanels(nextPanels);

      if (historyMode) {
        updateHistoryWithPanels(nextPanels, {
          mode: id && historyMode === 'push' ? 'push' : 'replace',
        });
      }
    } catch (err) {
      console.error(err);
      window.location.href = href;
    }
  }, [updateHistoryWithPanels]);

  const loadPreview = React.useCallback(async (href, anchorRect) => {
    const normalizedHref = normalizeNoteHref(href);
    if (!normalizedHref || !normalizedHref.startsWith('/notes/')) return;

    if (previewCloseTimerRef.current) {
      window.clearTimeout(previewCloseTimerRef.current);
      previewCloseTimerRef.current = null;
    }

    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;

    const viewportPadding = 14;
    const preferredLeft = anchorRect.left;
    const preferredTop = anchorRect.bottom + 10;
    const left = Math.min(
      Math.max(viewportPadding, preferredLeft),
      Math.max(viewportPadding, window.innerWidth - 360 - viewportPadding)
    );
    const top = Math.min(
      Math.max(viewportPadding, preferredTop),
      Math.max(viewportPadding, window.innerHeight - 240 - viewportPadding)
    );

    const cached = previewCacheRef.current.get(normalizedHref);
    if (cached) {
      setPreview({ ...cached, href: normalizedHref, left, top, loading: false });
      return;
    }

    setPreview({
      href: normalizedHref,
      left,
      top,
      title: 'Loading preview',
      excerpt: '',
      meta: {},
      loading: true,
    });

    try {
      const res = await fetch(normalizedHref, { credentials: 'same-origin' });
      if (!res.ok) throw new Error('Failed to load preview ' + normalizedHref);

      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const title = (doc.querySelector('.note-title') || {}).textContent || 'Note';
      const bodyText = (doc.querySelector('.note-body') || {}).textContent || '';
      let meta = {};
      try {
        meta = JSON.parse(doc.getElementById('note-data')?.textContent || '{}');
      } catch {}

      const previewData = {
        title,
        excerpt: meta.excerpt || bodyText.replace(/\s+/g, ' ').trim().slice(0, 260),
        meta,
      };

      previewCacheRef.current.set(normalizedHref, previewData);
      if (previewRequestRef.current === requestId) {
        setPreview({ ...previewData, href: normalizedHref, left, top, loading: false });
      }
    } catch {
      if (previewRequestRef.current === requestId) {
        setPreview({
          href: normalizedHref,
          left,
          top,
          title: 'Preview unavailable',
          excerpt: 'Open the note to read it.',
          meta: {},
          loading: false,
        });
      }
    }
  }, []);

  const clearPreview = React.useCallback(() => {
    if (previewCloseTimerRef.current) {
      window.clearTimeout(previewCloseTimerRef.current);
    }

    previewCloseTimerRef.current = window.setTimeout(() => {
      previewRequestRef.current += 1;
      setPreview(null);
      previewCloseTimerRef.current = null;
    }, 120);
  }, []);

  const returnToPanel = React.useCallback((panelIndex) => {
    const currentPanels = panelsRef.current;
    if (panelIndex < 0 || panelIndex >= currentPanels.length) return;

    const nextPanels = currentPanels.slice(0, panelIndex + 1);
    panelsRef.current = nextPanels;
    setPanels(nextPanels);
    updateHistoryWithPanels(nextPanels, { mode: 'replace' });
  }, [updateHistoryWithPanels]);

  const handleClick = React.useCallback(
    (e) => {
      const link =
        e.target.closest &&
        e.target.closest('a[data-note], a.note-link, a[href^="/notes/"]');
      if (!link) return;

      const href = link.getAttribute('href');
      if (!href || !href.startsWith('/notes/')) return;

      e.preventDefault();
      const panelEl = e.target.closest('.note-panel');
      const container = containerRef.current;
      const allPanels = container
        ? Array.from(container.querySelectorAll('.note-panel'))
        : [];
      const idx = allPanels.indexOf(panelEl);

      try {
        console.info('[Stack] openNote (react):', href);
      } catch {}
      openNote(href, idx, { historyMode: 'push' });
    },
    [openNote]
  );

  const handlePreviewOver = React.useCallback((e) => {
    const link =
      e.target.closest &&
      e.target.closest('.note-body a[data-note], .note-body a.note-link, .note-body a[href^="/notes/"]');
    if (!link) return;
    if (e.relatedTarget && link.contains(e.relatedTarget)) return;

    const href = link.getAttribute('href');
    if (!href || !href.startsWith('/notes/')) return;

    loadPreview(href, link.getBoundingClientRect());
  }, [loadPreview]);

  const handlePreviewOut = React.useCallback((e) => {
    const link =
      e.target.closest &&
      e.target.closest('.note-body a[data-note], .note-body a.note-link, .note-body a[href^="/notes/"]');
    if (!link) return;
    if (e.relatedTarget && link.contains(e.relatedTarget)) return;
    clearPreview();
  }, [clearPreview]);

  const handlePreviewFocus = React.useCallback((e) => {
    const link =
      e.target.closest &&
      e.target.closest('.note-body a[data-note], .note-body a.note-link, .note-body a[href^="/notes/"]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || !href.startsWith('/notes/')) return;

    loadPreview(href, link.getBoundingClientRect());
  }, [loadPreview]);

  React.useEffect(() => {
    let cancelled = false;

    async function restoreStack() {
      try {
        const params = new URL(window.location.href).searchParams;
        const stackedIds = params.getAll('stackedNotes');
        const ids = stackedIds.filter(
          (id, index) => !(index === 0 && id === initialIdRef.current)
        );

        async function loadPanel(id) {
          const fetchUrl = `/notes/${id}.html`;
          const res = await fetch(fetchUrl, { credentials: 'same-origin' });
          if (!res.ok) return null;

          const html = await res.text();
          const doc = new DOMParser().parseFromString(html, 'text/html');
          const title =
            (doc.querySelector('.note-title') || {}).textContent || 'Note';
          const body =
            (doc.querySelector('.note-body') || {}).innerHTML ||
            '<p>Content unavailable.</p>';
          let meta = {};
          try {
            meta = JSON.parse(doc.getElementById('note-data')?.textContent || '{}');
          } catch {}

          return {
            title,
            body,
            href: `/notes/${id}.html`,
            id,
            meta,
          };
        }

        if (!stackedIds.length && initialIdRef.current !== 'index') {
          const originPanel = await loadPanel('index');
          if (!cancelled && originPanel) {
            const next = [originPanel, panelsRef.current[0]];
            panelsRef.current = next;
            setPanels(next);
            updateHistoryWithPanels(next, { mode: 'replace' });
          }
          return;
        }

        const restoredPanels = [];

        for (const id of ids) {
          const panel = await loadPanel(id);
          if (panel) restoredPanels.push(panel);
        }

        if (!cancelled && restoredPanels.length) {
          const next = [panelsRef.current[0], ...restoredPanels];
          panelsRef.current = next;
          setPanels(next);
        }
      } catch (error) {
        console.warn('Restore stack failed', error);
      }
    }

    restoreStack();

    return () => {
      cancelled = true;
    };
  }, [updateHistoryWithPanels]);

  return (
    <div className="stack-shell">
      <div className="trail-bar" aria-label="Rabbit hole trail">
        <div className="trail-main">
          <button
            className="trail-chip"
            type="button"
            onClick={() => returnToPanel(0)}
            title="Back to start"
          >
            {originPanel?.title || 'Start'}
          </button>
          {pathPanels.length > 0 && (
            <>
              <span className="trail-separator">/</span>
              {pathPanels.map((panel, offset) => {
                const panelIndex = offset + 1;
                return (
                  <React.Fragment key={panel.href || `${panel.title || 'trail'}-${panelIndex}`}>
                    {offset > 0 && <span className="trail-separator">/</span>}
                    <button
                      className={`trail-chip ${panelIndex === panels.length - 1 ? 'active' : ''}`}
                      type="button"
                      onClick={() => returnToPanel(panelIndex)}
                      title={panel.meta?.status ? `${panel.meta.status} ${panel.meta.type || ''}` : panel.title}
                    >
                      {panel.title || 'Note'}
                    </button>
                  </React.Fragment>
                );
              })}
            </>
          )}
        </div>
      </div>
      <div
        id="stack"
        className={`pane-container panels-${panels.length}`}
        ref={containerRef}
        onClick={handleClick}
        onMouseOver={handlePreviewOver}
        onMouseMove={handlePreviewOver}
        onMouseOut={handlePreviewOut}
        onPointerOver={handlePreviewOver}
        onPointerOut={handlePreviewOut}
        onFocus={handlePreviewFocus}
        onBlur={clearPreview}
      >
        {panels.map((panel, index) => (
          <Panel
            key={panel.href || `${panel.title || 'panel'}-${index}`}
            title={panel.title}
            body={panel.body}
            meta={panel.meta || {}}
            activeChildHref={panels[index + 1]?.href}
            index={index}
            totalPanels={panels.length}
            onClick={() => returnToPanel(index)}
            ref={(el) => {
              panelRefs.current[index] = el || null;
            }}
          />
        ))}
      </div>
      {preview && (
        <div
          className={`link-preview ${preview.loading ? 'loading' : ''}`}
          style={{ left: preview.left, top: preview.top }}
          role="status"
        >
          <div className="link-preview-title">{preview.title}</div>
          {preview.excerpt && <div className="link-preview-excerpt">{preview.excerpt}</div>}
        </div>
      )}
    </div>
  );
}
