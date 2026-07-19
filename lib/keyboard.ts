/**
 * Returns whether keyboard state came from an event with a physical key code.
 * IME replays and other synthetic input can omit `KeyboardEvent.code`.
 */
export function hasPhysicalKeyCode(code: string): boolean {
  return code.length > 0;
}
