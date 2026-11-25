// Cmd/Ctrl/Shift/Alt and middle clicks mean "new tab", "new window" or
// "download": leave those to the browser. Only a plain click opens in the stack.
export function isPlainClick(e) {
  return e.button === 0 && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
