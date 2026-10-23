const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { createFileIdentity } = require('./main-helpers');

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.flv', '.m4v', '.ts', '.mts', '.mpg', '.mpeg',
  '.asf', '.m2ts', '.divx', '.ogv', '.3gp', '.3g2', '.mxf', '.dv',
]);
const SCAN_PROGRESS_BATCH_SIZE = 25;
const SCAN_FILE_STAT_BATCH_SIZE = 8;

function isVideoFile(filename) {
  return VIDEO_EXTENSIONS.has(path.extname(filename).toLowerCase());
}

// TypeScript shares extensions with transport-stream video. Read only a small prefix;
// reject clear text, but keep binary/unknown inputs for the normal media probe.
async function isSourceText(filePath) {
  let handle;
  try {
    handle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(8192);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const head = buffer.subarray(0, bytesRead);
    if (!head.length) return false;
    for (const stride of [188, 192, 204]) {
      for (let i = 0; i + stride * 2 < head.length; i++) {
        if (head[i] === 0x47 && head[i + stride] === 0x47 && head[i + stride * 2] === 0x47) return false;
      }
    }
    const text = head.toString('utf8');
    return !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffd]/.test(text);
  } catch {
    return false; // Preserve unreadable files for the existing error/reporting path.
  } finally {
    await handle?.close();
  }
}

function makeVideoId(filePath, sizeBytes) {
  return crypto.createHash('md5').update(`${filePath}:${sizeBytes}`).digest('hex').slice(0, 16);
}

function makeDuplicateHash(sizeBytes, durationSecs) {
  // Coarse duplicate detection: same file size implies likely duplicate
  return crypto.createHash('md5').update(`${sizeBytes}`).digest('hex').slice(0, 12);
}

function createProgressReporter(onProgress) {
  let lastReportedFound = 0;
  let pendingProgress = null;

  return {
    report(found, currentFile) {
      if (!onProgress) return;
      pendingProgress = { found, currentFile };
      if (found === 1 || found - lastReportedFound >= SCAN_PROGRESS_BATCH_SIZE) {
        onProgress(pendingProgress);
        lastReportedFound = found;
        pendingProgress = null;
      }
    },
    flush() {
      if (!onProgress || !pendingProgress) return;
      if (pendingProgress.found === lastReportedFound) return;
      onProgress(pendingProgress);
      lastReportedFound = pendingProgress.found;
      pendingProgress = null;
    },
  };
}

async function statVideoEntries(entries, statPath = fs.stat) {
  const results = new Array(entries.length).fill(null);

  for (let start = 0; start < entries.length; start += SCAN_FILE_STAT_BATCH_SIZE) {
    const batch = entries.slice(start, start + SCAN_FILE_STAT_BATCH_SIZE);
    const batchResults = await Promise.all(batch.map(async ({ entryName, fullPath }) => {
      try {
        const stat = await statPath(fullPath);
        return {
          id: makeVideoId(fullPath, stat.size),
          filename: entryName,
          path: fullPath,
          sizeBytes: stat.size,
          date: stat.mtimeMs,
          fileIdentity: createFileIdentity(stat),
          durationSecs: null,
          duplicateHash: makeDuplicateHash(stat.size, null),
          status: 'pending',
          thumbnails: [],
          rating: 0,
          favorite: false,
          compatible: true,
          videoCodec: null,
          audioCodec: null,
          containerFormat: null,
          width: null,
          height: null,
          fps: null,
        };
      } catch {
        return null;
      }
    }));

    for (let i = 0; i < batchResults.length; i += 1) {
      results[start + i] = batchResults[i];
    }
  }

  return results;
}

/**
 * Recursively walk a directory and collect video file info.
 * @param {string} dirPath - Root directory to scan.
 * @param {boolean} includeSubfolders - Whether to recurse into subdirectories.
 * @param {function} onProgress - Callback with { found, current, currentFile }.
 * @returns {Promise<Array>|Promise<{ videos: Array, visitedDirs: Array<string>, incompleteDirs: Array<string> }>} - Scan results.
 */
async function scanDirectory(dirPath, includeSubfolders, onProgress, options = {}) {
  const videos = [];
  const visitedDirs = options.includeVisitedDirs ? [] : null;
  const readDir = typeof options.readdir === 'function' ? options.readdir : fs.readdir;
  const summary = {
    skippedDirectoryCount: 0,
    skippedDirectorySamples: [],
    skippedFileCount: 0,
    skippedFileSamples: [],
  };
  // Folders where a file could not be read: their cache rows must not be pruned as missing.
  const incompleteDirs = new Set();
  const assertNotCancelled = typeof options.assertNotCancelled === 'function'
    ? options.assertNotCancelled
    : () => {};
  let found = 0;
  const progressReporter = createProgressReporter(onProgress);

  async function walk(currentDir) {
    assertNotCancelled();
    let entries;
    try {
      entries = await readDir(currentDir, { withFileTypes: true });
    } catch (err) {
      summary.skippedDirectoryCount += 1;
      if (summary.skippedDirectorySamples.length < 5) {
        summary.skippedDirectorySamples.push({
          path: currentDir,
          reason: err?.code || err?.message || 'unknown',
        });
      }
      return; // Skip inaccessible directories
    }
    assertNotCancelled();
    // Explicit opt-out also excludes this project's packaged copies and test assets.
    if (entries.some((entry) => entry.name === '.videocull-ignore' && entry.isFile())) {
      incompleteDirs.add(currentDir); // Do not prune saved decisions in excluded folders.
      return;
    }
    visitedDirs?.push(currentDir);

    let pendingVideoEntries = [];
    const flushPendingVideoEntries = async () => {
      assertNotCancelled();
      if (pendingVideoEntries.length === 0) return;
      const batch = pendingVideoEntries;
      pendingVideoEntries = [];
      const scannedVideos = await statVideoEntries(batch, options.statPath);
      assertNotCancelled();
      for (let i = 0; i < scannedVideos.length; i += 1) {
        const video = scannedVideos[i];
        if (!video) {
          incompleteDirs.add(currentDir);
          summary.skippedFileCount += 1;
          if (summary.skippedFileSamples.length < 5) summary.skippedFileSamples.push({ path: batch[i].fullPath });
          continue;
        }
        found += 1;
        videos.push(video);
        progressReporter.report(found, batch[i].entryName);
      }
    };

    for (const entry of entries) {
      assertNotCancelled();
      const fullPath = path.join(currentDir, entry.name);

      // Skip our own cache/thumb directories
      if (entry.isDirectory() && (['.video-cull-thumbs', '.videocull', '.video-cull-cache.json', '.git', 'node_modules'].includes(entry.name) || entry.name.endsWith('.app'))) {
        incompleteDirs.add(fullPath);
        continue;
      }

      if (entry.isDirectory() && includeSubfolders) {
        await flushPendingVideoEntries();
        assertNotCancelled();
        await walk(fullPath);
      } else if (entry.isFile() && isVideoFile(entry.name)) {
        if (/\.(?:ts|mts)$/i.test(entry.name) && await isSourceText(fullPath)) {
          incompleteDirs.add(currentDir);
          continue;
        }
        pendingVideoEntries.push({ entryName: entry.name, fullPath });
        if (pendingVideoEntries.length >= SCAN_FILE_STAT_BATCH_SIZE) {
          await flushPendingVideoEntries();
        }
      }
    }

    await flushPendingVideoEntries();
  }

  assertNotCancelled();
  await walk(dirPath);
  assertNotCancelled();
  progressReporter.flush();
  return visitedDirs ? { videos, visitedDirs, incompleteDirs: Array.from(incompleteDirs), summary } : videos;
}

module.exports = {
  scanDirectory,
  __test__: {
    createProgressReporter,
    statVideoEntries,
    SCAN_FILE_STAT_BATCH_SIZE,
  },
};
