// Where the note stack should scroll after its panels change.
// Desktop lays panels out side by side (row), so it keeps the left reset.
// Phones stack panels in a column, so the newest note sits below the fold;
// scroll down to it so a tapped link visibly opens.
// With prefers-reduced-motion the jump is instant instead of a glide.
export function stackScrollTarget({ flexDirection, panelCount, lastPanelOffsetTop, reducedMotion = false }) {
  const behavior = reducedMotion ? 'auto' : 'smooth';
  if (flexDirection === 'column') {
    return { top: panelCount > 1 ? Math.max(0, lastPanelOffsetTop || 0) : 0, behavior };
  }
  return { left: 0, behavior };
}
