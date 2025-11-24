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

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.type === 'xmlhttprequest' || details.type === 'main_frame' || details.type === 'sub_frame' || details.type === 'other') {
      if (is3DFile(details.url)) {
        let size = 'Unknown';
        if (details.responseHeaders) {
          const contentLength = details.responseHeaders.find(h => h.name.toLowerCase() === 'content-length');
          if (contentLength) {
            size = formatBytes(parseInt(contentLength.value));
          }
        }

        const fileData = {
          url: details.url,
          type: 'unknown', // Could try to infer from extension or Content-Type
          origin: details.initiator || 'Unknown Origin',
          timestamp: Date.now(),
          size: size
        };

        // Infer type from extension
        const lowerUrl = details.url.toLowerCase();
        for (const ext of EXTENSIONS) {
          if (lowerUrl.includes(ext)) {
            fileData.type = ext;
            break;
          }
        }

        if (!foundFiles.has(details.url)) {
          foundFiles.set(details.url, fileData);
          saveFiles();

          // Notify popup if open
          chrome.runtime.sendMessage({ type: 'NEW_FILE', file: fileData }).catch(() => {
            // Popup might be closed, ignore error
          });

          // Check if notifications are enabled
          chrome.storage.local.get(['notificationsEnabled'], (result) => {
            if (result.notificationsEnabled) {
              chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon.png', // We need an icon, but for now it might default or fail gracefully if missing. 
                // Actually, let's use a placeholder or just rely on the browser default if possible, 
                // but Chrome usually requires an iconUrl. 
                // Since we don't have an icon yet, let's skip iconUrl or use a data URI if needed.
                // For this step, I'll assume we might need to add a dummy icon or it won't show.
                // Let's try to use a standard one or just omit if it allows (it usually doesn't).
                // I will add a TODO to add an icon.
                title: '3D File Detected!',
                message: `Found a ${fileData.type} file.`
              });
            }
          });
        }
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders"]
);

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
