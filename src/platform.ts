/** Platform supplied by preload; navigator is the fallback for isolated previews. */
export const IS_MAC = typeof window !== 'undefined' && window.electronAPI?.platform
  ? window.electronAPI.platform === 'darwin'
  : typeof window !== 'undefined' && typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);

export function primaryModifier(event: { ctrlKey: boolean; metaKey?: boolean }): boolean {
  return IS_MAC ? Boolean(event.metaKey) : event.ctrlKey;
}
