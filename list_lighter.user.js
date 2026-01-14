// ==UserScript==
// @name         List Lighter
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Highlight keywords with rainbow effects across all pages
// @author       Ken-Nall
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

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
        traditional: ['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'],
        blue: ['#E3F2FD', '#90CAF9', '#42A5F5', '#1E88E5', '#1565C0', '#0D47A1'],
        red: ['#FFEBEE', '#EF5350', '#F44336', '#E53935', '#C62828', '#B71C1C'],
        green: ['#E8F5E9', '#66BB6A', '#4CAF50', '#43A047', '#2E7D32', '#1B5E20'],
        yellow: ['#FFFDE7', '#FFEE58', '#FFEB3B', '#FDD835', '#F9A825', '#F57F17'],
        orange: ['#FFF3E0', '#FFB74D', '#FF9800', '#F57C00', '#E65100'],
        purple: ['#F3E5F5', '#BA68C8', '#9C27B0', '#7B1FA2', '#4A148C'],
        pink: ['#FCE4EC', '#F06292', '#E91E63', '#C2185B', '#880E4F'],
        grey: ['#FAFAFA', '#E0E0E0', '#9E9E9E', '#616161', '#424242', '#212121'],
        fire: ['#FFEB3B', '#FF9800', '#FF5722', '#F44336', '#E91E63', '#9C27B0'],
        earthy: ['#D7CCC8', '#A1887F', '#8D6E63', '#6D4C41', '#5D4037', '#4E342E'],
        cool: ['#E0F7FA', '#80DEEA', '#26C6DA', '#00ACC1', '#0097A7', '#00838F'],
        'white-black': ['#FFFFFF', '#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575', '#424242', '#212121', '#000000']
    };

    // Load settings
    function loadSettings() {
        const saved = GM_getValue('keywords', '[]');
        keywords = JSON.parse(saved);
        settings.theme = GM_getValue('theme', 'traditional');
        settings.muted = GM_getValue('muted_' + window.location.href, false);
        settings.sortMode = GM_getValue('sortMode', 'newest');
    }

    // Save settings
    function saveSettings() {
        GM_setValue('keywords', JSON.stringify(keywords));
        GM_setValue('theme', settings.theme);
        GM_setValue('sortMode', settings.sortMode);
    }

    // Add keywords
    function addKeywords(text) {
        const lines = text.split(/[\n,]+/).map(k => k.trim()).filter(k => k);
        const timestamp = Date.now();
        lines.forEach(keyword => {
            if (!keywords.find(k => k.text === keyword)) {
                keywords.push({
                    text: keyword,
                    locked: false,
                    added: timestamp
                });
            }
        });
        saveSettings();
    }

    // Clear keywords
    function clearKeywords() {
        keywords = keywords.filter(k => k.locked);
        saveSettings();
    }

    // Remove keyword
    function removeKeyword(keyword) {
        keywords = keywords.filter(k => k.text !== keyword);
        saveSettings();
    }

    // Toggle lock
    function toggleLock(keyword) {
        const kw = keywords.find(k => k.text === keyword);
        if (kw) {
            kw.locked = !kw.locked;
            saveSettings();
        }
    }

    // Sort keywords
    function sortKeywords() {
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
            settings.theme = e.target.value;
            saveSettings();
            applyHighlights();
        });

        document.getElementById('ll-sort').addEventListener('change', (e) => {
            settings.sortMode = e.target.value;
            saveSettings();
            displayKeywords();
        });

        document.getElementById('ll-theme').value = settings.theme;
        document.getElementById('ll-sort').value = settings.sortMode;
    }

    // Display keywords
    function displayKeywords() {
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
    }

    // Toggle modal
    function toggleModal() {
        const modal = document.getElementById('list-lighter-modal');
        isModalOpen = !isModalOpen;
        modal.style.display = isModalOpen ? 'block' : 'none';
        if (!isModalOpen) {
            applyHighlights();
        }
    }

    // Apply highlights
    function applyHighlights() {
        if (settings.muted) return;

        // Remove existing highlights
        document.querySelectorAll('.ll-highlight').forEach(el => {
            const parent = el.parentNode;
            parent.replaceChild(document.createTextNode(el.textContent), el);
            parent.normalize();
        });

        if (keywords.length === 0) return;

        const colors = rainbowThemes[settings.theme];
        const style = document.getElementById('ll-rainbow-style') || document.createElement('style');
        style.id = 'll-rainbow-style';
        style.textContent = colors.map((c, i) => `--c${i}: ${c};`).join(' ');
        if (!style.parentNode) document.head.appendChild(style);

        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    if (node.parentNode.closest('#list-lighter-modal, script, style, noscript')) {
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

        nodesToProcess.forEach(node => {
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
            }
        });
    }

    // Keyboard handlers
    let shiftPressed = false;
    let capsPressed = false;
    let ctrlPressed = false;

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Shift') shiftPressed = true;
        if (e.key === 'Control') ctrlPressed = true;
        
        if (e.key === 'CapsLock') {
            if (shiftPressed && !ctrlPressed) {
                e.preventDefault();
                toggleModal();
            } else if (ctrlPressed && !shiftPressed) {
                e.preventDefault();
                settings.muted = !settings.muted;
                GM_setValue('muted_' + window.location.href, settings.muted);
                applyHighlights();
            } else if (!shiftPressed && !ctrlPressed) {
                setTimeout(applyHighlights, 50);
            }
        }
    });

    document.addEventListener('keyup', (e) => {
        if (e.key === 'Shift') shiftPressed = false;
        if (e.key === 'Control') ctrlPressed = false;
    });

    // Monitor DOM changes
    function setupObserver() {
        if (observer) observer.disconnect();
        
        observer = new MutationObserver(() => {
            applyHighlights();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Initialize
    loadSettings();
    createModal();
    
    // Run highlights at intervals
    setTimeout(() => applyHighlights(), 100);
    setTimeout(() => applyHighlights(), 500);
    setTimeout(() => applyHighlights(), 1000);
    setTimeout(() => applyHighlights(), 5000);
    setTimeout(() => setupObserver(), 5000);
})();