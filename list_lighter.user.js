// ==UserScript==
// @name         List Lighter
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Highlight keywords with rainbow effects across all pages
// @author       Ken-Nall
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// @downloadURL  https://axzile.corp.amazon.com/-/carthamus/download_script/list-lighter.user.js
// @updateURL    https://axzile.corp.amazon.com/-/carthamus/download_script/list-lighter.user.js
// ==/UserScript==

(function() {
    'use strict';

    console.log('[List Lighter] Script initializing...');

    // State management
    let keywords = [];
    let settings = {
        theme: 'traditional',
        muted: false,
        sortMode: 'newest'
    };
    let isModalOpen = false;
    let observer = null;

    // Rainbow themes
    const rainbowThemes = {
        traditional: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3', '#4B0082', '#0000FF', '#00FF00', '#FFFF00', '#FF7F00'],
        blue: ['#E3F2FD', '#90CAF9', '#42A5F5', '#1E88E5', '#1565C0', '#0D47A1', '#1565C0', '#1E88E5', '#42A5F5', '#90CAF9'],
        red: ['#FFEBEE', '#EF5350', '#F44336', '#E53935', '#C62828', '#B71C1C', '#C62828', '#E53935', '#F44336', '#EF5350'],
        green: ['#E8F5E9', '#66BB6A', '#4CAF50', '#43A047', '#2E7D32', '#1B5E20', '#2E7D32', '#43A047', '#4CAF50', '#66BB6A'],
        yellow: ['#FFFDE7', '#FFEE58', '#FFEB3B', '#FDD835', '#F9A825', '#F57F17', '#F9A825', '#FDD835', '#FFEB3B', '#FFEE58'],
        orange: ['#FFF3E0', '#FFB74D', '#FF9800', '#F57C00', '#E65100', '#F57C00', '#FF9800', '#FFB74D'],
        purple: ['#F3E5F5', '#BA68C8', '#9C27B0', '#7B1FA2', '#4A148C', '#7B1FA2', '#9C27B0', '#BA68C8'],
        pink: ['#FCE4EC', '#F06292', '#E91E63', '#C2185B', '#880E4F', '#C2185B', '#E91E63', '#F06292'],
        grey: ['#FAFAFA', '#E0E0E0', '#9E9E9E', '#616161', '#424242', '#212121', '#424242', '#616161', '#9E9E9E', '#E0E0E0'],
        fire: ['#FFEB3B', '#FF9800', '#FF5722', '#F44336', '#E91E63', '#9C27B0', '#E91E63', '#F44336', '#FF5722', '#FF9800'],
        earthy: ['#D7CCC8', '#A1887F', '#8D6E63', '#6D4C41', '#5D4037', '#4E342E', '#5D4037', '#6D4C41', '#8D6E63', '#A1887F'],
        cool: ['#E0F7FA', '#80DEEA', '#26C6DA', '#00ACC1', '#0097A7', '#00838F', '#0097A7', '#00ACC1', '#26C6DA', '#80DEEA'],
        'white-black': ['#FFFFFF', '#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575', '#616161', '#424242', '#212121', '#000000', '#212121', '#424242', '#616161', '#757575', '#9E9E9E', '#BDBDBD', '#E0E0E0']
    };

    // Load settings
    function loadSettings() {
        console.log('[List Lighter] Loading settings...');
        const saved = GM_getValue('keywords', '[]');
        keywords = JSON.parse(saved);
        settings.theme = GM_getValue('theme', 'traditional');
        settings.muted = GM_getValue('muted_' + window.location.href, false);
        settings.sortMode = GM_getValue('sortMode', 'newest');
        console.log('[List Lighter] Settings loaded:', { keywords: keywords.length, theme: settings.theme, muted: settings.muted, sortMode: settings.sortMode });
    }

    // Save settings
    function saveSettings() {
        console.log('[List Lighter] Saving settings...');
        GM_setValue('keywords', JSON.stringify(keywords));
        GM_setValue('theme', settings.theme);
        GM_setValue('sortMode', settings.sortMode);
        console.log('[List Lighter] Settings saved');
    }

    // Add keywords
    function addKeywords(text) {
        console.log('[List Lighter] Adding keywords:', text);
        const lines = text.split(/[\n,]+/).map(k => k.trim()).filter(k => k);
        const timestamp = Date.now();
        let addedCount = 0;
        lines.forEach(keyword => {
            if (!keywords.find(k => k.text === keyword)) {
                keywords.push({
                    text: keyword,
                    locked: false,
                    added: timestamp
                });
                addedCount++;
            }
        });
        console.log('[List Lighter] Added ' + addedCount + ' new keywords');
        saveSettings();
    }

    // Clear keywords
    function clearKeywords() {
        console.log('[List Lighter] Clearing unlocked keywords...');
        const beforeCount = keywords.length;
        keywords = keywords.filter(k => k.locked);
        console.log('[List Lighter] Cleared ' + (beforeCount - keywords.length) + ' keywords');
        saveSettings();
    }

    // Remove keyword
    function removeKeyword(keyword) {
        console.log('[List Lighter] Removing keyword:', keyword);
        keywords = keywords.filter(k => k.text !== keyword);
        saveSettings();
    }

    // Toggle lock
    function toggleLock(keyword) {
        console.log('[List Lighter] Toggling lock for:', keyword);
        const kw = keywords.find(k => k.text === keyword);
        if (kw) {
            kw.locked = !kw.locked;
            console.log('[List Lighter] Lock toggled to:', kw.locked);
            saveSettings();
        }
    }

    // Sort keywords
    function sortKeywords() {
        console.log('[List Lighter] Sorting keywords by:', settings.sortMode);
        switch(settings.sortMode) {
            case 'locked':
                keywords.sort((a, b) => (b.locked ? 1 : 0) - (a.locked ? 1 : 0));
                break;
            case 'alpha':
                keywords.sort((a, b) => a.text.localeCompare(b.text));
                break;
            case 'oldest':
                keywords.sort((a, b) => a.added - b.added);
                break;
            case 'newest':
            default:
                keywords.sort((a, b) => b.added - a.added);
                break;
        }
    }

    // Create modal
    function createModal() {
        console.log('[List Lighter] Creating modal...');
        const modal = document.createElement('div');
        modal.id = 'list-lighter-modal';
        modal.innerHTML = `
            <style>
                #list-lighter-modal {
                    display: none;
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    background: white;
                    border: 2px solid #333;
                    border-radius: 8px;
                    padding: 20px;
                    z-index: 999999;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    width: 500px;
                    max-height: 80vh;
                    overflow-y: auto;
                    font-family: Arial, sans-serif;
                }
                .ll-header { font-size: 20px; font-weight: bold; margin-bottom: 15px; }
                .ll-textarea { width: 100%; height: 100px; margin: 10px 0; padding: 8px; }
                .ll-button { padding: 8px 15px; margin: 5px; cursor: pointer; border: 1px solid #333; border-radius: 4px; background: #f0f0f0; }
                .ll-button:hover { background: #e0e0e0; }
                .ll-select { padding: 5px; margin: 10px 0; }
                .ll-keyword { 
                    display: inline-block; 
                    padding: 5px 10px; 
                    margin: 3px; 
                    background: #e0e0e0; 
                    border-radius: 4px; 
                    cursor: pointer;
                    user-select: none;
                }
                .ll-keyword.locked { background: gold; }
                .ll-keyword.hover-remove { background: red; animation: throb 0.5s infinite; }
                .ll-keyword.hover-lock { background: gold; animation: throb 0.5s infinite; }
                .ll-keyword.hover-unlock { background: #CD7F32; animation: throb 0.5s infinite; }
                .ll-keyword::after { content: ''; margin-left: 5px; }
                .ll-keyword.hover-remove::after { content: '✖'; }
                .ll-keyword.hover-lock::after { content: '🔒'; }
                .ll-keyword.hover-unlock::after { content: '🔓'; }
                @keyframes throb { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
                .ll-highlight { animation: rainbow 3s linear infinite; }
                @keyframes rainbow {
                    0%, 100% { background-color: var(--c0); }
                    14% { background-color: var(--c1); }
                    28% { background-color: var(--c2); }
                    42% { background-color: var(--c3); }
                    57% { background-color: var(--c4); }
                    71% { background-color: var(--c5); }
                    85% { background-color: var(--c6); }
                }
            </style>
            <div class="ll-header">List Lighter</div>
            <textarea class="ll-textarea" id="ll-input" placeholder="Paste keywords here (comma or newline separated)"></textarea>
            <div>
                <button class="ll-button" id="ll-add">Add</button>
                <button class="ll-button" id="ll-clear">Clear</button>
                <button class="ll-button" id="ll-display">Display</button>
            </div>
            <div style="margin: 10px 0;">
                <label>Theme: </label>
                <select class="ll-select" id="ll-theme">
                    ${Object.keys(rainbowThemes).map(t => `<option value="${t}">${t}</option>`).join('')}
                </select>
            </div>
            <div style="margin: 10px 0;">
                <label>Sort: </label>
                <select class="ll-select" id="ll-sort">
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="alpha">Alphabetical</option>
                    <option value="locked">Locked First</option>
                </select>
            </div>
            <div id="ll-list" style="margin-top: 15px;"></div>
        `;
        document.body.appendChild(modal);
        console.log('[List Lighter] Modal created');

        // Event listeners
        document.getElementById('ll-add').addEventListener('click', () => {
            const text = document.getElementById('ll-input').value;
            addKeywords(text);
            document.getElementById('ll-input').value = '';
            displayKeywords();
        });

        document.getElementById('ll-clear').addEventListener('click', () => {
            clearKeywords();
            displayKeywords();
        });

        document.getElementById('ll-display').addEventListener('click', displayKeywords);

        document.getElementById('ll-theme').addEventListener('change', (e) => {
            console.log('[List Lighter] Theme changed to:', e.target.value);
            settings.theme = e.target.value;
            saveSettings();
            applyHighlights();
        });

        document.getElementById('ll-sort').addEventListener('change', (e) => {
            console.log('[List Lighter] Sort mode changed to:', e.target.value);
            settings.sortMode = e.target.value;
            saveSettings();
            displayKeywords();
        });

        document.getElementById('ll-theme').value = settings.theme;
        document.getElementById('ll-sort').value = settings.sortMode;
    }

    // Display keywords
    function displayKeywords() {
        console.log('[List Lighter] Displaying keywords...');
        sortKeywords();
        const list = document.getElementById('ll-list');
        list.innerHTML = '';
        keywords.forEach(kw => {
            const span = document.createElement('span');
            span.className = 'll-keyword' + (kw.locked ? ' locked' : '');
            span.textContent = kw.text;
            
            span.addEventListener('mouseenter', function(e) {
                if (e.shiftKey) {
                    this.classList.add(kw.locked ? 'hover-unlock' : 'hover-lock');
                } else {
                    this.classList.add('hover-remove');
                }
            });

            span.addEventListener('mouseleave', function() {
                this.classList.remove('hover-remove', 'hover-lock', 'hover-unlock');
            });

            span.addEventListener('click', function(e) {
                if (e.shiftKey) {
                    toggleLock(kw.text);
                } else {
                    removeKeyword(kw.text);
                }
                displayKeywords();
            });

            list.appendChild(span);
        });
        console.log('[List Lighter] Displayed ' + keywords.length + ' keywords');
    }

    // Toggle modal
    function toggleModal() {
        console.log('[List Lighter] Toggling modal...');
        const modal = document.getElementById('list-lighter-modal');
        isModalOpen = !isModalOpen;
        modal.style.display = isModalOpen ? 'block' : 'none';
        console.log('[List Lighter] Modal is now:', isModalOpen ? 'open' : 'closed');
        if (!isModalOpen) {
            applyHighlights();
        }
    }

    // Apply highlights
    function applyHighlights() {
        console.log('[List Lighter] Applying highlights... (muted:', settings.muted + ')');
        if (settings.muted) {
            console.log('[List Lighter] Highlights are muted, skipping');
            return;
        }

        // Remove existing highlights
        const existingHighlights = document.querySelectorAll('.ll-highlight');
        console.log('[List Lighter] Removing ' + existingHighlights.length + ' existing highlights');
        existingHighlights.forEach(el => {
            const parent = el.parentNode;
            parent.replaceChild(document.createTextNode(el.textContent), el);
            parent.normalize();
        });

        if (keywords.length === 0) {
            console.log('[List Lighter] No keywords to highlight');
            return;
        }

        const colors = rainbowThemes[settings.theme];
        const style = document.getElementById('ll-rainbow-style') || document.createElement('style');
        style.id = 'll-rainbow-style';
        style.textContent = `.ll-highlight { ${colors.map((c, i) => `--c${i}: ${c};`).join(' ')} }`;
        if (!style.parentNode) document.head.appendChild(style);

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (node.parentNode.closest('#list-lighter-modal, script, style, noscript, .ll-highlight')) {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        const nodesToProcess = [];
        while (walker.nextNode()) {
            nodesToProcess.push(walker.currentNode);
        }
        console.log('[List Lighter] Found ' + nodesToProcess.length + ' text nodes to process');

        let highlightCount = 0;
        nodesToProcess.forEach(node => {
            // Skip if parent already has highlights to prevent nesting
            if (node.parentNode.classList && node.parentNode.classList.contains('ll-highlight')) {
                return;
            }
            
            const text = node.textContent;
            let html = text;
            let hasMatch = false;

            keywords.forEach(kw => {
                const regex = new RegExp(`(${kw.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
                if (regex.test(html)) {
                    hasMatch = true;
                    html = html.replace(regex, '<span class="ll-highlight">$1</span>');
                }
            });

            if (hasMatch) {
                const span = document.createElement('span');
                span.innerHTML = html;
                node.parentNode.replaceChild(span, node);
                highlightCount++;
            }
        });
        console.log('[List Lighter] Applied highlights to ' + highlightCount + ' nodes');
    }

    // Throttle mechanism for applyHighlights
    let lastHighlightTime = 0;
    let highlightTimeout = null;
    const throttledApplyHighlights = function() {
        const now = Date.now();
        const timeSinceLastHighlight = now - lastHighlightTime;
        
        if (timeSinceLastHighlight >= 3000) {
            lastHighlightTime = now;
            applyHighlights();
        } else {
            if (highlightTimeout) clearTimeout(highlightTimeout);
            highlightTimeout = setTimeout(() => {
                lastHighlightTime = Date.now();
                applyHighlights();
            }, 3000 - timeSinceLastHighlight);
        }
    };

    // Keyboard handlers
    let shiftPressed = false;
    let ctrlPressed = false;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') {
            shiftPressed = true;
            console.log('[List Lighter] Shift pressed');
        }
        if (e.key === 'Control') {
            ctrlPressed = true;
            console.log('[List Lighter] Ctrl pressed');
        }
        
        if (e.key === 'CapsLock') {
            console.log('[List Lighter] CapsLock pressed (Shift:', shiftPressed + ', Ctrl:', ctrlPressed + ')');
            if (shiftPressed && !ctrlPressed) {
            e.preventDefault();
            console.log('[List Lighter] Shift+CapsLock: Toggling modal');
            toggleModal();
            } else if (ctrlPressed && !shiftPressed) {
            e.preventDefault();
            settings.muted = !settings.muted;
            console.log('[List Lighter] Ctrl+CapsLock: Muted set to', settings.muted);
            GM_setValue('muted_' + window.location.href, settings.muted);
            applyHighlights();
            } else if (!shiftPressed && !ctrlPressed) {
            console.log('[List Lighter] CapsLock alone: Reapplying highlights');
            setTimeout(applyHighlights, 50);
            }
        }
        
        // Update hover states when Shift is pressed
        if (e.key === 'Shift') {
            document.querySelectorAll('.ll-keyword:hover').forEach(el => {
            el.classList.remove('hover-remove');
            const keyword = keywords.find(k => k.text === el.textContent);
            if (keyword) {
                el.classList.add(keyword.locked ? 'hover-unlock' : 'hover-lock');
            }
            });
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') {
            shiftPressed = false;
            console.log('[List Lighter] Shift released');
        }
        if (e.key === 'Control') {
            ctrlPressed = false;
            console.log('[List Lighter] Ctrl released');
        }
    });

    // Monitor DOM changes
    function setupObserver() {
        console.log('[List Lighter] Setting up mutation observer...');
        if (observer) observer.disconnect();
        
        observer = new MutationObserver(() => {
            console.log('[List Lighter] DOM mutation detected, scheduling throttled highlight');
            throttledApplyHighlights();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        console.log('[List Lighter] Observer active');
    }

    // Initialize
    loadSettings();
    createModal();
    
    // Run highlights at intervals
    console.log('[List Lighter] Scheduling initial highlight applications...');
    setTimeout(() => { console.log('[List Lighter] Running highlights (100ms)'); applyHighlights(); }, 100);
    setTimeout(() => { console.log('[List Lighter] Running highlights (500ms)'); applyHighlights(); }, 500);
    setTimeout(() => { console.log('[List Lighter] Running highlights (1000ms)'); applyHighlights(); }, 1000);
    setTimeout(() => { console.log('[List Lighter] Running highlights (5000ms)'); applyHighlights(); }, 5000);
    setTimeout(() => setupObserver(), 5000);
    
    console.log('[List Lighter] Script initialization complete');
})();