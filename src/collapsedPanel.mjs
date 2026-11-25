// Collapsed strips (earlier notes squeezed to a vertical title) are the only
// way back besides the trail, so make them a real keyboard button.
// Full panels stay plain: their links are already the tab stops.
export function collapsedPanelProps({ collapsed, title, onActivate }) {
  if (!collapsed) return {};
  return {
    role: 'button',
    tabIndex: 0,
    'aria-label': `Back to ${title || 'Note'}`,
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onActivate();
      }
    },
  };
}
