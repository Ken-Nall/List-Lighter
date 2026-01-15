// ==UserScript==
// @name         List Lighter
// @namespace    http://tampermonkey.net/
// @version      1.3
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

    //console.log('[List Lighter] Script initializing...');

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
        //console.log('[List Lighter] Loading settings...');
        keywords = JSON.parse(GM_getValue('keywords', '[]'));
        settings.theme = GM_getValue('theme', 'traditional');
        settings.muted = GM_getValue('muted_' + window.location.href, false);
        settings.sortMode = GM_getValue('sortMode', 'newest');
        //console.log('[List Lighter] Loaded:', keywords.length, 'keywords, theme:', settings.theme, 'muted:', settings.muted, 'sort:', settings.sortMode);
    }

    function saveSettings() {
        //console.log('[List Lighter] Saving settings...');
        GM_setValue('keywords', JSON.stringify(keywords));
        GM_setValue('theme', settings.theme);
        GM_setValue('sortMode', settings.sortMode);
        //console.log('[List Lighter] Settings saved');
    }

    // Add keywords
    function addKeywords(text) {
        //console.log('[List Lighter] Adding keywords from text:', text);
        const lines = text.split(/[\n,]+/).map(k => k.trim()).filter(k => k);
        //console.log('[List Lighter] Parsed lines:', lines);
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
                //console.log('[List Lighter] Added keyword:', keyword);
            }
        });
        //console.log('[List Lighter] Added ' + addedCount + ' new keywords');
        saveSettings();
    }

    // Clear keywords
    function clearKeywords() {
        //console.log('[List Lighter] Clearing unlocked keywords...');
        const beforeCount = keywords.length;
        keywords = keywords.filter(k => k.locked);
        //console.log('[List Lighter] Cleared ' + (beforeCount - keywords.length) + ' keywords, ' + keywords.length + ' locked keywords remain');
        saveSettings();
    }

    // Remove keyword
    function removeKeyword(keyword) {
        //console.log('[List Lighter] Removing keyword:', keyword);
        keywords = keywords.filter(k => k.text !== keyword);
        //console.log('[List Lighter] Keyword removed, remaining:', keywords.length);
        saveSettings();
    }

    // Toggle lock
    function toggleLock(keyword) {
        //console.log('[List Lighter] Toggling lock for:', keyword);
        const kw = keywords.find(k => k.text === keyword);
        if (kw) {
            kw.locked = !kw.locked;
            //console.log('[List Lighter] Lock toggled to:', kw.locked);
            saveSettings();
        }
    }

    // Sort keywords
    function sortKeywords() {
        //console.log('[List Lighter] Sorting keywords by:', settings.sortMode);
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
        //console.log('[List Lighter] Creating modal...');
        
        // Check if modal already exists
        if (document.getElementById('list-lighter-modal')) {
            //console.log('[List Lighter] Modal already exists, skipping creation');
            return;
        }

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
        //console.log('[List Lighter] Modal DOM element created and appended');

        // Event listeners
        document.getElementById('ll-add').addEventListener('click', () => {
            //console.log('[List Lighter] Add button clicked');
            const text = document.getElementById('ll-input').value;
            addKeywords(text);
            document.getElementById('ll-input').value = '';
            displayKeywords();
        });

        document.getElementById('ll-clear').addEventListener('click', () => {
            //console.log('[List Lighter] Clear button clicked');
            clearKeywords();
            displayKeywords();
        });

        document.getElementById('ll-display').addEventListener('click', () => {
            //console.log('[List Lighter] Display button clicked');
            displayKeywords();
        });

        document.getElementById('ll-theme').addEventListener('change', (e) => {
            //console.log('[List Lighter] Theme changed to:', e.target.value);
            settings.theme = e.target.value;
            saveSettings();
            applyHighlights();
        });

        document.getElementById('ll-sort').addEventListener('change', (e) => {
            //console.log('[List Lighter] Sort mode changed to:', e.target.value);
            settings.sortMode = e.target.value;
            saveSettings();
            displayKeywords();
        });

        document.getElementById('ll-theme').value = settings.theme;
        document.getElementById('ll-sort').value = settings.sortMode;
        //console.log('[List Lighter] Modal event listeners attached');
    }

    // Display keywords
    function displayKeywords() {
        //console.log('[List Lighter] Displaying keywords...');
        sortKeywords();
        const list = document.getElementById('ll-list');
        if (!list) {
            console.error('[List Lighter] Cannot display keywords: ll-list element not found');
            return;
        }
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
                //console.log('[List Lighter] Keyword clicked:', kw.text, 'Shift:', e.shiftKey);
                if (e.shiftKey) {
                    toggleLock(kw.text);
                } else {
                    removeKeyword(kw.text);
                }
                displayKeywords();
            });

            list.appendChild(span);
        });
        //console.log('[List Lighter] Displayed ' + keywords.length + ' keywords');
    }

    // Toggle modal
    function toggleModal() {
        let modal = document.getElementById('list-lighter-modal');
        if (!modal) {
            createModal();
            modal = document.getElementById('list-lighter-modal');
        }

        isModalOpen = !isModalOpen;
        modal.style.display = isModalOpen ? 'block' : 'none';
        
        if (isModalOpen) {
            //console.log('[List Lighter] Modal opened');
            displayKeywords();
            document.getElementById('ll-input').focus(); // Auto-focus input for speed
        } else {
            //console.log('[List Lighter] Modal closed, applying highlights');
            applyHighlights();
        }
    }

    function getHighlightCSS() {
        const colors = rainbowThemes[settings.theme] || rainbowThemes.traditional;
        const varDefs = colors.map((c, i) => `--c${i}: ${c};`).join(' ');
        return `
            .ll-highlight { 
                ${varDefs} 
                animation: ll-rainbow 3s linear infinite !important; 
                border-radius: 3px !important;
                padding: 0 2px !important;
                display: inline !important;
                visibility: visible !important;
            }
            @keyframes ll-rainbow {
                0%, 100% { background-color: var(--c0); }
                20% { background-color: var(--c1); }
                40% { background-color: var(--c2); }
                60% { background-color: var(--c3); }
                80% { background-color: var(--c4); }
            }
        `;
    }
    function updateStyles() {
        let styleEl = document.getElementById('ll-dynamic-style');
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = 'll-dynamic-style';
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = getHighlightCSS();
    }

    function applyHighlights() {
        if (settings.muted || keywords.length === 0) {
            removeOldHighlights();
            return;
        }

        updateStyles();
        const cssContent = getHighlightCSS();
        
        const pattern = keywords.map(k => k.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
        const regex = new RegExp(`(${pattern})`, 'gi');

        function getTextNodes(root) {
            const nodes = [];
            
            // --- INJECT CSS INTO SHADOW ROOT ---
            if (root instanceof ShadowRoot) {
                if (!root.getElementById('ll-shadow-style')) {
                    const style = document.createElement('style');
                    style.id = 'll-shadow-style';
                    style.textContent = cssContent;
                    root.appendChild(style);
                }
            }

            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_TEXT,
                {
                    acceptNode: (node) => {
                        const parent = node.parentElement;
                        if (!parent) return NodeFilter.FILTER_ACCEPT;
                        if (parent.closest('#list-lighter-modal, .ll-highlight, script, style, textarea, input')) {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                }
            );

            while (walker.nextNode()) nodes.push(walker.currentNode);

            const allElements = root.querySelectorAll ? root.querySelectorAll('*') : [];
            allElements.forEach(el => {
                if (el.shadowRoot) {
                    nodes.push(...getTextNodes(el.shadowRoot));
                }
            });

            return nodes;
        }

        const allTextNodes = getTextNodes(document.body);
        // ... (rest of your node processing logic remains the same)
        allTextNodes.forEach(node => {
            const matches = [...node.textContent.matchAll(regex)];
            if (matches.length === 0) return;

            for (let i = matches.length - 1; i >= 0; i--) {
                const match = matches[i];
                try {
                    const highlightSpn = document.createElement('span');
                    highlightSpn.className = 'll-highlight';
                    const matchNode = node.splitText(match.index);
                    matchNode.splitText(match[0].length);
                    highlightSpn.textContent = matchNode.textContent;
                    matchNode.parentNode.replaceChild(highlightSpn, matchNode);
                } catch (e) {}
            }
        });
    }

    function removeOldHighlights(root = document.body) {
        // 1. Remove highlights in the current scope
        root.querySelectorAll('.ll-highlight').forEach(el => {
            const parent = el.parentNode;
            if (parent) {
                parent.replaceChild(document.createTextNode(el.textContent), el);
                parent.normalize();
            }
        });

        // 2. Recursively find and clean up Shadow Roots
        const allElements = root.querySelectorAll ? root.querySelectorAll('*') : [];
        allElements.forEach(el => {
            if (el.shadowRoot) {
                removeOldHighlights(el.shadowRoot);
            }
        });
    }

    // Throttle mechanism for applyHighlights
    let highlightTimeout = null;
    const throttledApplyHighlights = function() {
        //console.log('[List Lighter] Throttled highlight requested');
        if (highlightTimeout) {
            cancelIdleCallback(highlightTimeout);
            //console.log('[List Lighter] Cancelled previous idle callback');
        }
        highlightTimeout = requestIdleCallback(() => {
            //console.log('[List Lighter] Executing throttled highlight');
            applyHighlights();
        }, { timeout: 2000 });
    };

    // Keyboard handlers
    let shiftPressed = false;
    let ctrlPressed = false;

    document.addEventListener('keydown', (e) => {
        // Track modifier keys for the UI (locking/removing keywords)
        if (e.key === 'Shift') shiftPressed = true;
        if (e.key === 'Control') ctrlPressed = true;

        // The "Light Switch": Alt + L
        if (e.altKey && e.key.toLowerCase() === 'l') {
            e.preventDefault(); // Prevent browser from focusing the address bar or menus

            if (e.shiftKey) {
                // Alt + Shift + L: Toggle Mute
                settings.muted = !settings.muted;
                //console.log('[List Lighter] Mute toggled via shortcut:', settings.muted);
                GM_setValue('muted_' + window.location.href, settings.muted);
                
                // Visual feedback: briefly show the modal or just re-apply
                applyHighlights();
            } else {
                // Alt + L: Toggle Modal
                //console.log('[List Lighter] Alt+L: Toggling modal');
                toggleModal();
            }
        }

        // Update UI hover states when Shift is tapped
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
        if (e.key === 'Shift') shiftPressed = false;
        if (e.key === 'Control') ctrlPressed = false;
        
        // Remove hover effects when Shift is released
        if (e.key === 'Shift') {
            document.querySelectorAll('.ll-keyword:hover').forEach(el => {
                el.classList.remove('hover-lock', 'hover-unlock');
                el.classList.add('hover-remove');
            });
        }
    });

    function setupObserver() {
        //console.log('[List Lighter] Setting up mutation observer...');
        if (observer) {
            observer.disconnect();
            //console.log('[List Lighter] Disconnected existing observer');
        }
        observer = new MutationObserver((mutations) => {
            const isInternal = mutations.every(m => 
                (m.target.classList && m.target.classList.contains('ll-highlight')) ||
                (m.target.id === 'list-lighter-modal') ||
                (m.target.closest && m.target.closest('#list-lighter-modal'))
            );
            if (!isInternal) {
                //console.log('[List Lighter] External DOM mutation detected, triggering highlight');
                throttledApplyHighlights();
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
        //console.log('[List Lighter] Mutation observer active');
    }

    // Initialize
    //console.log('[List Lighter] Beginning initialization sequence...');
    loadSettings();
    updateStyles();
    createModal(); // *** FIXED: Actually call createModal ***
    
    // Initial runs
    //console.log('[List Lighter] Scheduling initial highlight application...');
    // Run highlights every 0.5s for the first 4 seconds
    for (let i = 0; i < 8; i++) {
        setTimeout(() => {
            //console.log(`[List Lighter] Initial highlight application ${i + 1}/8 starting...`);
            applyHighlights();
        }, i * 500);
    }
    
    //console.log('[List Lighter] Scheduling observer setup...');
    setTimeout(() => {
        //console.log('[List Lighter] Setting up observer...');
        setupObserver();
    }, 2000);

    //console.log('[List Lighter] Script initialization complete');

})();