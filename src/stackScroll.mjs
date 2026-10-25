// Where the note stack should scroll after its panels change.
// Desktop lays panels out side by side (row), so it keeps the left reset.
// Phones stack panels in a column, so the newest note sits below the fold;
// scroll down to it so a tapped link visibly opens.
export function stackScrollTarget({ flexDirection, panelCount, lastPanelOffsetTop }) {
  if (flexDirection === 'column') {
    return { top: panelCount > 1 ? Math.max(0, lastPanelOffsetTop || 0) : 0, behavior: 'smooth' };
  }
  return { left: 0, behavior: 'smooth' };
}
