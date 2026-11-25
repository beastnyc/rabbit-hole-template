// Only the note being read (the rightmost panel) is the page's h1;
// the notes stacked to its left are h2s so the page keeps one main heading.
export function panelHeadingTag(index, totalPanels) {
  return index === totalPanels - 1 ? 'h1' : 'h2';
}
