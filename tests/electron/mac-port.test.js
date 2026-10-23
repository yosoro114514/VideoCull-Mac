const path = require('node:path');
const { afterPack } = require('../../scripts/electron-builder-hooks');
const { isSameFolderSync, isFolderInsideSync, filterLoadedDeletionPaths } = require('../../electron/main-helpers');

test('Mac packaging validates the actual app bundle and its SQLite runtime', async () => {
  const calls = [];
  await afterPack({ electronPlatformName: 'darwin', appOutDir: '/tmp/mac-arm64', packager: { appInfo: { productFilename: 'VideoCull' } } }, {
    writeNotices: (resources) => calls.push(['notices', resources]),
    checkLegalFiles: (resources) => calls.push(['legal', resources]),
    runSmoke: (executable, resources) => calls.push(['sqlite', executable, resources]),
  });
  const contents = '/tmp/mac-arm64/VideoCull.app/Contents';
  expect(calls).toEqual([
    ['notices', path.join(contents, 'Resources')],
    ['legal', path.join(contents, 'Resources')],
    ['sqlite', path.join(contents, 'MacOS/VideoCull'), path.join(contents, 'Resources')],
  ]);
});

test.skipIf(process.platform === 'win32')('Mac helpers never merge differently cased directories', () => {
  expect(isSameFolderSync('/Volumes/Media/Clips', '/Volumes/Media/clips')).toBe(false);
  expect(isFolderInsideSync('/Volumes/Media/a', '/Volumes/Media')).toBe(true);
  expect(isFolderInsideSync('/Volumes/Media2/a', '/Volumes/Media')).toBe(false);
  expect(isFolderInsideSync('/Volumes/media/a', '/Volumes/Media')).toBe(false);
});

test('batch deletion retains only individually authorised loaded files', async () => {
  const allowed = '/Volumes/Media/中文 #1.mp4';
  const rejected = [];
  const result = await filterLoadedDeletionPaths({
    filePaths: [allowed, '/Volumes/Media2/private.mp4'],
    isValidLoadedPath: async p => p === allowed,
    onReject: p => rejected.push(p),
  });
  expect(result).toEqual([allowed]);
  expect(rejected).toEqual(['/Volumes/Media2/private.mp4']);
});
