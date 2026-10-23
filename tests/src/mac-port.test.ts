import { describe, expect, test } from 'vitest';
import { kb, keybindFromEvent, matchesKeybind } from '../../src/keybinds';
import { folderInsideTest, normalizeFolder } from '../../src/utils';

const event = (key: string, modifiers: Partial<KeyboardEvent> = {}) => ({
  key, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...modifiers,
}) as KeyboardEvent;

describe('Mac shortcuts do not change decisions through Command combinations', () => {
  test('Command K/D/S/Z cannot trigger plain review actions', () => {
    for (const key of ['k', 'd', 's', 'z']) {
      expect(matchesKeybind(event(key, { metaKey: true }), kb(key), true)).toBe(false);
      expect(matchesKeybind(event(key), kb(key), true)).toBe(true);
    }
  });
  test('existing primary-modifier settings map to Command, not Control', () => {
    expect(matchesKeybind(event('f', { metaKey: true }), kb('f', { ctrl: true }), true)).toBe(true);
    expect(matchesKeybind(event('f', { ctrlKey: true }), kb('f', { ctrl: true }), true)).toBe(false);
    expect(keybindFromEvent(event('f', { metaKey: true }), true)).toEqual(kb('f', { ctrl: true }));
    expect(matchesKeybind(event('f', { ctrlKey: true }), kb('f', { ctrl: true }), false)).toBe(true);
  });
});

describe('Mac folder filters preserve real filesystem distinctions', () => {
  test('case-sensitive folders and literal backslashes are not merged', () => {
    expect(normalizeFolder('/Volumes/Media/Clips')).not.toBe(normalizeFolder('/Volumes/Media/clips'));
    expect(normalizeFolder('/Volumes/Media/a\\b')).not.toBe(normalizeFolder('/Volumes/Media/a/b'));
  });
  test('descendants require a complete path segment and root works', () => {
    const inside = folderInsideTest('/Volumes/Media');
    expect(inside('/Volumes/Media/中文 clips')).toBe(true);
    expect(inside('/Volumes/Media2/clip')).toBe(false);
    expect(inside('/Volumes/media/clip')).toBe(false);
    expect(folderInsideTest('/')('/Users/test')).toBe(true);
  });
});
