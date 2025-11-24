// background.js

const EXTENSIONS = [
  '.glb', '.gltf',
  '.stl',
  '.obj',
  '.fbx',
  '.ply',
  '.usdz'
];

// Keep track of found files in memory (and sync to storage)
// We use a Map to avoid duplicates easily: URL -> { url, type, timestamp }
let foundFiles = new Map();

// Load existing files from storage on startup
chrome.storage.local.get(['foundFiles'], (result) => {
  if (result.foundFiles) {
    result.foundFiles.forEach(file => foundFiles.set(file.url, file));
  }
});

function is3DFile(url) {
  const lowerUrl = url.toLowerCase();
  // Simple check: does the URL end with one of the extensions?
  // We might need a more robust check later (e.g. query params)
  return EXTENSIONS.some(ext => {
    // Check if url ends with extension or extension + query params
    // e.g. model.glb or model.glb?v=123
    return lowerUrl.includes(ext);
  });
}

function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// Magic Byte Signatures
const MAGIC_SIGNATURES = [
  { type: '.glb', bytes: [0x67, 0x6C, 0x54, 0x46] }, // glTF
  { type: '.fbx', bytes: [0x4B, 0x61, 0x79, 0x64, 0x61, 0x72, 0x61, 0x20, 0x46, 0x42, 0x58, 0x20, 0x42, 0x69, 0x6E, 0x61, 0x72, 0x79, 0x20, 0x20, 0x00, 0x1a, 0x00] }, // Kaydara FBX Binary
  { type: '.ply', bytes: [0x70, 0x6C, 0x79] }, // ply
  { type: '.stl', bytes: [0x73, 0x6F, 0x6C, 0x69, 0x64] }, // solid (ASCII STL)
  { type: '.usdz', bytes: [0x50, 0x4B, 0x03, 0x04] } // PK.. (Zip/USDZ - weak check but useful)
];

const GENERIC_TYPES = [
  'application/octet-stream',
  'application/binary',
  'application/x-unknown-content-type'
];

// 100 MB limit for deep scan candidates to avoid issues
const MAX_DEEP_SCAN_SIZE = 100 * 1024 * 1024;

async function checkMagicBytes(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Range': 'bytes=0-511' } // Fetch first 512 bytes
    });

    if (!response.ok && response.status !== 206) return null;

    const buffer = await response.arrayBuffer();
    const uint8 = new Uint8Array(buffer);

    for (const sig of MAGIC_SIGNATURES) {
      if (uint8.length >= sig.bytes.length) {
        let match = true;
        for (let i = 0; i < sig.bytes.length; i++) {
          if (uint8[i] !== sig.bytes[i]) {
            match = false;
            break;
          }
        }
        if (match) return sig.type;
      }
    }
  } catch (err) {
    console.error('Deep scan failed for:', url, err);
  }
  return null;
}

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.type === 'xmlhttprequest' || details.type === 'main_frame' || details.type === 'sub_frame' || details.type === 'other') {

      let detectedType = null;
      let size = 'Unknown';
      let sizeBytes = 0;

      // 1. Check Extension
      if (is3DFile(details.url)) {
        // Infer type from extension
        const lowerUrl = details.url.toLowerCase();
        for (const ext of EXTENSIONS) {
          if (lowerUrl.includes(ext)) {
            detectedType = ext;
            break;
          }
        }
      }

      // Get Size
      if (details.responseHeaders) {
        const contentLength = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-length');
        if (contentLength) {
          sizeBytes = parseInt(contentLength.value);
          size = formatBytes(sizeBytes);
        }
      }

      // 2. Deep Scan (if not already detected and generic type)
      if (!detectedType) {
        chrome.storage.local.get(['deepScanEnabled'], (result) => {
          if (result.deepScanEnabled) {
            let contentType = 'unknown';
            if (details.responseHeaders) {
              const ctHeader = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-type');
              if (ctHeader) contentType = ctHeader.value.toLowerCase();
            }

            if (GENERIC_TYPES.some(t => contentType.includes(t)) && sizeBytes > 0 && sizeBytes < MAX_DEEP_SCAN_SIZE) {
              // Perform Deep Scan
              checkMagicBytes(details.url).then(magicType => {
                if (magicType) {
                  processFoundFile(details, magicType, size);
                }
              });
            }
          }
        });
      } else {
        processFoundFile(details, detectedType, size);
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

function processFoundFile(details, type, size) {
  const fileData = {
    url: details.url,
    type: type,
    origin: details.initiator || 'Unknown Origin',
    timestamp: Date.now(),
    size: size
  };

  if (!foundFiles.has(details.url)) {
    foundFiles.set(details.url, fileData);
    saveFiles();

    // Notify popup if open
    chrome.runtime.sendMessage({ type: 'NEW_FILE', file: fileData }).catch(() => { });

    // Check if notifications are enabled
    chrome.storage.local.get(['notificationsEnabled'], (result) => {
      if (result.notificationsEnabled) {
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icon.png',
          title: '3D File Detected!',
          message: `Found a ${fileData.type} file.`
        });
      }
    });
  }
}

function saveFiles() {
  chrome.storage.local.set({ foundFiles: Array.from(foundFiles.values()) });
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'GET_FILES') {
    sendResponse(Array.from(foundFiles.values()));
  } else if (request.type === 'CLEAR_FILES') {
    foundFiles.clear();
    saveFiles();
    sendResponse({ success: true });
  }
});
