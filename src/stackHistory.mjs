// Browser Back/Forward changes the ?stackedNotes= trail in the URL; work out
// how much of the open stack that trail still describes.
// Returns how many leading panels to keep, or -1 when the trail names notes
// that are not open (Forward into a closed note, or another branch): the
// caller reloads, and the page rebuilds the stack from the URL.
// No trail at all is the bare start page: keep just the first panel.
export function panelsToKeep(openIds, urlIds) {
  const wanted = urlIds.length ? urlIds : openIds.slice(0, 1);
  if (wanted.length > openIds.length) return -1;
  for (let k = 0; k < wanted.length; k += 1) {
    if (wanted[k] !== openIds[k]) return -1;
  }
  return wanted.length;
}
