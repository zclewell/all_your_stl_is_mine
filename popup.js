// popup.js

const fileList = document.getElementById('fileList');
const searchInput = document.getElementById('searchInput');
const totalCount = document.getElementById('totalCount');
const clearBtn = document.getElementById('clearBtn');
const monitoringToggle = document.getElementById('monitoringToggle');

let allFiles = [];

function renderFiles(files) {
    fileList.innerHTML = '';

    if (files.length === 0) {
        fileList.innerHTML = '<li class="empty-state">No 3D files detected yet.</li>';
        return;
    }

    // Sort by timestamp descending
    files.sort((a, b) => b.timestamp - a.timestamp);

    files.forEach(file => {
        const li = document.createElement('li');
        li.className = 'file-item';

        // Icon
        const iconDiv = document.createElement('div');
        iconDiv.className = 'file-icon';
        iconDiv.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
            </svg>
        `;

        // Details
        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'file-details';

        const name = file.url.split('/').pop().split('?')[0] || 'Unknown File';
        const nameSpan = document.createElement('div');
        nameSpan.className = 'file-name';
        nameSpan.textContent = name;
        nameSpan.title = file.url;

        const metaDiv = document.createElement('div');
        metaDiv.className = 'file-meta';
        const origin = file.origin ? new URL(file.origin).hostname : 'Unknown';
        metaDiv.textContent = origin;

        detailsDiv.appendChild(nameSpan);
        detailsDiv.appendChild(metaDiv);

        // Size
        const sizeSpan = document.createElement('div');
        sizeSpan.className = 'file-size';
        sizeSpan.textContent = file.size || 'Unknown';

        // Type Badge
        const typeBadge = document.createElement('div');
        typeBadge.className = 'file-type-badge';
        typeBadge.textContent = file.type.replace('.', '').toUpperCase();

        // Download Action
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'download-action';
        downloadBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span class="save-text">Save</span>
        `;
        downloadBtn.onclick = () => downloadFile(file.url);

        li.appendChild(iconDiv);
        li.appendChild(detailsDiv);
        li.appendChild(sizeSpan);
        li.appendChild(typeBadge);
        li.appendChild(downloadBtn);

        fileList.appendChild(li);
    });

    updateFooter(files.length);
}

function updateFooter(count) {
    totalCount.textContent = `Total intercepted: ${count} files`;
}

function downloadFile(url) {
    chrome.downloads.download({
        url: url,
        conflictAction: 'uniquify'
    });
}

function loadFiles() {
    chrome.runtime.sendMessage({ type: 'GET_FILES' }, (files) => {
        if (files) {
            allFiles = files;
            filterAndRender();
        }
    });
}

function filterAndRender() {
    const query = searchInput.value.toLowerCase();
    const filtered = allFiles.filter(file => {
        const name = file.url.split('/').pop().split('?')[0] || '';
        return name.toLowerCase().includes(query);
    });
    renderFiles(filtered);
}

searchInput.addEventListener('input', filterAndRender);

clearBtn.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLEAR_FILES' }, () => {
        loadFiles();
    });
});

// Monitoring toggle (Visual only for now, or could link to background)
monitoringToggle.addEventListener('change', () => {
    // In a real app, send message to background to stop/start listeners
    // For now, just a visual toggle as requested in UI
});

// Listen for updates from background
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'NEW_FILE') {
        loadFiles();
    }
});

// Initial load
loadFiles();
