(function() {
    'use strict';

    if (window.__NoCommentAppLoaded) {
        return;
    }
    window.__NoCommentAppLoaded = true;

    
    
    function backendLog(message) {
        try {
            if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                Millennium.callServerMethod('No-Comment', 'Logger.log', { message: String(message) });
            }
        } catch (err) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[NoComment] backendLog failed', err);
            }
        }
    }
    
    backendLog('NoComment script loaded');
    
    const logState = { missingOnce: false, existsOnce: false };
    
    const runState = { inProgress: false, appid: null };
    
    const TRANSLATION_PLACEHOLDER = 'translation missing';
    const TOOLS_WIDGET_STORAGE_KEY = 'NoComment.toolsWidgetPos.v1';
    const TOOLS_WIDGET_MARGIN = 12;
    const TOOLS_WIDGET_DRAG_THRESHOLD = 4;
    const TOOLS_PANEL_GAP = 10;
    const TOOLS_CLICK_SUPPRESS_MS = 220;
    const TOOLS_WIDGET_BACKEND_SAVE_DEBOUNCE_MS = 160;
    const toolsWidgetPersistState = {
        loadRequested: false,
        saveTimer: 0,
        pending: null
    };

    function applyTranslationBundle(bundle) {
        if (!bundle || typeof bundle !== 'object') return;
        const stored = window.__NoCommentI18n || {};
        if (bundle.language) {
            stored.language = String(bundle.language);
        } else if (!stored.language) {
            stored.language = 'en';
        }
        if (bundle.strings && typeof bundle.strings === 'object') {
            stored.strings = bundle.strings;
        } else if (!stored.strings) {
            stored.strings = {};
        }
        if (Array.isArray(bundle.locales)) {
            stored.locales = bundle.locales;
        } else if (!Array.isArray(stored.locales)) {
            stored.locales = [];
        }
        stored.ready = true;
        stored.lastFetched = Date.now();
        window.__NoCommentI18n = stored;
    }

    function ensureNoCommentStyles() {
        if (document.getElementById('NoComment-styles')) return;
        try {
            const style = document.createElement('style');
            style.id = 'NoComment-styles';
            style.textContent = `
                .NoComment-btn {
                    padding: 12px 24px;
                    background: rgba(102,192,244,0.15);
                    border: 2px solid rgba(102,192,244,0.4);
                    border-radius: 12px;
                    color: #66c0f4;
                    font-size: 15px;
                    font-weight: 600;
                    text-decoration: none;
                    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                    letter-spacing: 0.3px;
                }
                .NoComment-btn:hover:not([data-disabled="1"]) {
                    background: rgba(102,192,244,0.25);
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(102,192,244,0.3);
                    border-color: #66c0f4;
                }
                .NoComment-btn.primary {
                    background: linear-gradient(135deg, #66c0f4 0%, #4a9ece 100%);
                    border-color: #66c0f4;
                    color: #0f1923;
                    font-weight: 700;
                    box-shadow: 0 4px 15px rgba(102,192,244,0.4), inset 0 1px 0 rgba(255,255,255,0.3);
                    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                }
                .NoComment-btn.primary:hover:not([data-disabled="1"]) {
                    background: linear-gradient(135deg, #7dd4ff 0%, #5ab3e8 100%);
                    transform: translateY(-3px) scale(1.03);
                    box-shadow: 0 8px 25px rgba(102,192,244,0.6), inset 0 1px 0 rgba(255,255,255,0.4);
                }
                .NoComment-search-input {
                    width: 100%;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(102,192,244,0.35);
                    background: rgba(10,20,30,0.6);
                    color: #dbe6f3;
                    font-size: 13px;
                    outline: none;
                    box-shadow: inset 0 1px 2px rgba(0,0,0,0.35);
                }
                .NoComment-search-row { display:flex; gap:8px; }
                .NoComment-search-btn {
                    flex: 1;
                    padding: 10px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(102,192,244,0.35);
                    background: rgba(102,192,244,0.12);
                    color: #cfe9ff;
                    font-size: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    text-align: center;
                    transition: all 0.2s ease;
                }
                .NoComment-search-btn.primary {
                    background: linear-gradient(135deg, #66c0f4 0%, #4a9ece 100%);
                    color: #0f1923;
                    border-color: #66c0f4;
                }
                .NoComment-search-btn:hover { background: rgba(102,192,244,0.2); }
                .NoComment-search-btn.primary:hover { background: linear-gradient(135deg, #7dd4ff 0%, #5ab3e8 100%); }
                .NoComment-search-results { display:flex; flex-direction:column; gap:8px; max-height:200px; overflow:auto; }
                .NoComment-search-item {
                    display:flex; align-items:center; justify-content:space-between; gap:8px;
                    background: rgba(12,20,30,0.5);
                    border: 1px solid rgba(102,192,244,0.2);
                    padding: 8px 10px; border-radius: 10px;
                }
                .NoComment-search-title { font-size:12px; font-weight:600; color:#e7f4ff; }
                .NoComment-search-meta { font-size:11px; color:#9bb7c9; }
                .NoComment-search-actions { display:flex; gap:6px; }
                .NoComment-search-link { font-size:11px; color:#9bd0ff; cursor:pointer; text-decoration:none; }
                .NoComment-search-empty { font-size:12px; color:#9bb7c9; text-align:center; padding:6px; }
                .NoComment-tools-widget {
                    position: fixed;
                    right: 18px;
                    bottom: 18px;
                    z-index: 100002;
                    width: 52px;
                    height: 52px;
                }
                .NoComment-tools-widget.is-dragging {
                    user-select: none;
                }
                .NoComment-tools-widget.is-dragging .NoComment-tools-launcher {
                    cursor: grabbing;
                    transition: none;
                }
                .NoComment-tools-launcher {
                    width: 52px;
                    height: 52px;
                    border-radius: 50%;
                    border: 1px solid rgba(160,160,160,0.55);
                    background: radial-gradient(circle at 30% 25%, #3a3a3a 0%, #262626 60%, #1f1f1f 100%);
                    color: #e2e2e2;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 10px 26px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08);
                    cursor: pointer;
                    touch-action: none;
                    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
                    filter: grayscale(1);
                }
                .NoComment-tools-launcher:hover {
                    border-color: rgba(200,200,200,0.7);
                    box-shadow: 0 14px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12);
                }
                .NoComment-tools-launcher.is-open {
                    transform: rotate(12deg) scale(1.05);
                }
                .NoComment-tools-launcher.NoComment-tools-bounce {
                    animation: NoCommentToolsPop 0.22s ease-out;
                }
                .NoComment-tools-launcher-icon {
                    width: 22px;
                    height: 22px;
                    display: block;
                }
                .NoComment-tools-launcher i {
                    font-size: 22px;
                }
                .NoComment-launcher-logo {
                    display: inline-flex;
                    width: 22px;
                    height: 22px;
                    align-items: center;
                    justify-content: center;
                }
                .NoComment-launcher-logo svg {
                    width: 100%;
                    height: 100%;
                    display: block;
                }
                .NoComment-launcher-logo .NoComment-launcher-hex-outer {
                    fill: none;
                    stroke: currentColor;
                    stroke-width: 1.85;
                    opacity: 0.94;
                    transform-origin: 12px 12px;
                    animation: NoCommentHexSpin 3.2s linear infinite;
                }
                .NoComment-launcher-logo .NoComment-launcher-hex-inner {
                    fill: none;
                    stroke: currentColor;
                    stroke-width: 1.55;
                    opacity: 0.56;
                    transform-origin: 12px 12px;
                    animation: NoCommentHexSpinReverse 2.2s linear infinite;
                }
                .NoComment-launcher-logo .NoComment-launcher-core {
                    fill: currentColor;
                    opacity: 0.92;
                }
                .NoComment-tools-launcher:hover .NoComment-launcher-logo .NoComment-launcher-hex-outer {
                    animation-duration: 2.4s;
                }
                .NoComment-tools-launcher:hover .NoComment-launcher-logo .NoComment-launcher-hex-inner {
                    animation-duration: 1.7s;
                }
                .NoComment-inline-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 14px;
                    width: 14px;
                    height: 14px;
                    line-height: 1;
                    color: currentColor;
                    flex-shrink: 0;
                }
                .NoComment-inline-icon svg {
                    width: 100%;
                    height: 100%;
                    display: block;
                    stroke: currentColor;
                    fill: none;
                }
                .NoComment-inline-icon i {
                    font-size: 14px;
                    line-height: 1;
                }
                .NoComment-tools-launcher .NoComment-inline-icon {
                    width: 20px;
                    height: 20px;
                    min-width: 20px;
                }
                .NoComment-tools-launcher .NoComment-inline-icon i {
                    font-size: 18px;
                }
                .NoComment-tools-icon-btn .NoComment-inline-icon {
                    width: 16px;
                    height: 16px;
                    min-width: 16px;
                }
                .NoComment-tools-panel {
                    position: fixed;
                    left: 24px;
                    top: 24px;
                    z-index: 100003;
                    width: 340px;
                    max-width: calc(100vw - 36px);
                    max-height: calc(100vh - 24px);
                    background: linear-gradient(160deg, #2b2b2b 0%, #1e1e1e 100%);
                    color: #e6e6e6;
                    border: 1px solid rgba(160,160,160,0.35);
                    border-radius: 14px;
                    box-shadow: 0 18px 40px rgba(0,0,0,0.6);
                    overflow: hidden;
                    opacity: 0;
                    transform: translateY(8px) scale(0.98);
                    pointer-events: none;
                    transition: opacity 0.18s ease, transform 0.18s ease;
                    filter: grayscale(1);
                }
                .NoComment-tools-panel.is-open {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                    pointer-events: auto;
                }
                .NoComment-tools-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 16px 10px;
                    border-bottom: 1px solid rgba(160,160,160,0.2);
                }
                .NoComment-tools-title {
                    font-size: 14px;
                    font-weight: 700;
                    letter-spacing: 1.4px;
                    text-transform: uppercase;
                    color: #f2f2f2;
                }
                .NoComment-tools-actions { display: flex; gap: 8px; }
                .NoComment-tools-icon-btn {
                    width: 32px;
                    height: 32px;
                    border-radius: 10px;
                    border: 1px solid rgba(150,150,150,0.45);
                    background: rgba(48,48,48,0.85);
                    color: #d0d0d0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
                }
                .NoComment-tools-icon-btn:hover {
                    transform: translateY(-1px);
                    border-color: rgba(210,210,210,0.6);
                    box-shadow: 0 6px 14px rgba(0,0,0,0.45);
                }
                .NoComment-tools-body {
                    padding: 14px 16px 18px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                    overflow: auto;
                    max-height: calc(100vh - 120px);
                }
                .NoComment-tools-section {
                    font-size: 11px;
                    letter-spacing: 1.6px;
                    text-transform: uppercase;
                    color: #bdbdbd;
                    text-align: left;
                    margin-top: 6px;
                }
                .NoComment-tools-section-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    margin-top: 6px;
                }
                .NoComment-tools-usage {
                    font-size: 10px;
                    letter-spacing: 0.8px;
                    text-transform: uppercase;
                    color: #d6d6d6;
                    border: 1px solid rgba(160,160,160,0.45);
                    border-radius: 999px;
                    padding: 2px 8px;
                    background: rgba(30,30,30,0.65);
                    white-space: nowrap;
                    line-height: 1.4;
                }
                .NoComment-tools-action {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px 16px;
                    border-radius: 12px;
                    border: 1px solid rgba(150,150,150,0.35);
                    background: linear-gradient(145deg, rgba(70,70,70,0.35), rgba(35,35,35,0.85));
                    color: #ededed;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
                }
                .NoComment-tools-action:hover {
                    transform: translateY(-1px);
                    border-color: rgba(220,220,220,0.6);
                    box-shadow: 0 8px 18px rgba(0,0,0,0.45);
                }
                .NoComment-tools-panel .NoComment-search-input {
                    box-sizing: border-box;
                    width: 100%;
                    border-radius: 10px;
                    border: 1px solid rgba(150,150,150,0.35);
                    background: rgba(18,18,18,0.8);
                    color: #e0e0e0;
                    padding: 10px 12px;
                }
                .NoComment-tools-panel .NoComment-search-row { gap: 8px; }
                .NoComment-tools-panel .NoComment-search-btn {
                    border-radius: 10px;
                    border: 1px solid rgba(150,150,150,0.35);
                    background: rgba(50,50,50,0.6);
                    color: #e6e6e6;
                    font-size: 12px;
                    padding: 10px 12px;
                }
                .NoComment-tools-panel .NoComment-search-btn.primary {
                    background: linear-gradient(135deg, rgba(120,120,120,0.7), rgba(70,70,70,0.9));
                    border-color: rgba(200,200,200,0.55);
                    color: #f5f5f5;
                }
                .NoComment-tools-panel .NoComment-search-btn:hover {
                    background: rgba(80,80,80,0.75);
                }
                .NoComment-tools-panel .NoComment-search-btn.primary:hover {
                    background: linear-gradient(135deg, rgba(160,160,160,0.8), rgba(90,90,90,0.95));
                }
                .NoComment-tools-panel .NoComment-search-item {
                    background: rgba(30,30,30,0.7);
                    border: 1px solid rgba(140,140,140,0.3);
                }
                .NoComment-tools-panel .NoComment-search-title { color: #f0f0f0; }
                .NoComment-tools-panel .NoComment-search-meta { color: #b8b8b8; }
                .NoComment-tools-panel .NoComment-search-link { color: #d0d0d0; }
                .NoComment-settings-manager-modal {
                    background: linear-gradient(160deg, #2b2b2b 0%, #1e1e1e 100%) !important;
                    border: 1px solid rgba(160,160,160,0.35) !important;
                    color: #e6e6e6 !important;
                    box-shadow: 0 20px 60px rgba(0,0,0,.7) !important;
                }
                .NoComment-settings-manager-header {
                    border-bottom: 1px solid rgba(160,160,160,0.3) !important;
                }
                .NoComment-settings-manager-title {
                    color: #e6e6e6 !important;
                    text-shadow: none !important;
                    background: none !important;
                    -webkit-text-fill-color: #e6e6e6 !important;
                }
                .NoComment-settings-manager-content {
                    border: 1px solid rgba(160,160,160,0.25) !important;
                    background: rgba(22,22,22,0.7) !important;
                }
                .NoComment-settings-tabs {
                    display: flex;
                    gap: 8px;
                    padding: 0 24px 12px;
                }
                .NoComment-settings-tab {
                    flex: 1;
                    padding: 8px 12px;
                    border-radius: 10px;
                    border: 1px solid rgba(150,150,150,0.35);
                    background: rgba(40,40,40,0.8);
                    color: #cfcfcf;
                    font-size: 11px;
                    text-transform: uppercase;
                    letter-spacing: 1.2px;
                    text-align: center;
                    cursor: pointer;
                    transition: all 0.2s ease;
                }
                .NoComment-settings-tab.active {
                    border-color: rgba(200,200,200,0.6);
                    background: rgba(70,70,70,0.9);
                    color: #ffffff;
                }
                .NoComment-settings-manager-overlay .NoComment-btn {
                    background: rgba(60,60,60,0.8) !important;
                    border-color: rgba(150,150,150,0.35) !important;
                    color: #e6e6e6 !important;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.35) !important;
                }
                .NoComment-settings-manager-overlay .NoComment-btn.primary {
                    background: linear-gradient(135deg, rgba(140,140,140,0.85), rgba(90,90,90,0.95)) !important;
                    border-color: rgba(200,200,200,0.6) !important;
                    color: #1a1a1a !important;
                }
                .NoComment-settings-manager-overlay .btnv6_blue_hoverfade {
                    background: rgba(60,60,60,0.8) !important;
                    border: 1px solid rgba(150,150,150,0.35) !important;
                    color: #e6e6e6 !important;
                }
                .NoComment-toast-stack {
                    position: fixed;
                    left: 24px;
                    bottom: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    z-index: 100002;
                    pointer-events: none;
                }
                .NoComment-toast {
                    width: 260px;
                    max-width: calc(100vw - 72px);
                    background: linear-gradient(135deg, #1b2838 0%, #2a475e 100%);
                    color: #dbe6f3;
                    border: 1px solid rgba(190,190,190,0.35);
                    border-radius: 6px;
                    padding: 8px 10px;
                    box-shadow: 0 10px 22px rgba(0,0,0,0.45), 0 0 0 1px rgba(190,190,190,0.18);
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    opacity: 0;
                    transform: translateX(16px);
                    animation: NoCommentToastIn 0.18s ease-out forwards;
                    pointer-events: auto;
                    filter: grayscale(1);
                }
                .NoComment-toast-title {
                    font-size: 13px;
                    font-weight: 700;
                    color: #e0e0e0;
                    text-shadow: none;
                    letter-spacing: 0.2px;
                }
                .NoComment-toast-message {
                    font-size: 11px;
                    line-height: 1.5;
                    color: #c9c9c9;
                }
                .NoComment-toast-out {
                    animation: NoCommentToastOut 0.18s ease-in forwards;
                }
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: scale(0.9);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1);
                    }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
                @keyframes NoCommentToolsPop {
                    0% { transform: scale(1); }
                    60% { transform: scale(1.12); }
                    100% { transform: scale(1); }
                }
                @keyframes NoCommentHexSpin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes NoCommentHexSpinReverse {
                    from { transform: rotate(360deg); }
                    to { transform: rotate(0deg); }
                }
                @keyframes NoCommentToastIn {
                    from { opacity: 0; transform: translateX(20px) scale(0.98); }
                    to { opacity: 1; transform: translateX(0) scale(1); }
                }
                @keyframes NoCommentToastOut {
                    from { opacity: 1; transform: translateX(0) scale(1); }
                    to { opacity: 0; transform: translateX(20px) scale(0.98); }
                }
            `;
            document.head.appendChild(style);
        } catch(err) { backendLog('NoComment: Styles injection failed: ' + err); }
    }

    function ensureFontAwesome() {
        if (document.getElementById('NoComment-fontawesome')) return;
        try {
            const link = document.createElement('link');
            link.id = 'NoComment-fontawesome';
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
            link.integrity = 'sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==';
            link.crossOrigin = 'anonymous';
            link.referrerPolicy = 'no-referrer';
            document.head.appendChild(link);
        } catch(err) { backendLog('NoComment: Font Awesome injection failed: ' + err); }
    }

    function _setNoCommentSvgAttrs(node, attrs) {
        if (!node || !attrs || typeof attrs !== 'object') return;
        const keys = Object.keys(attrs);
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            node.setAttribute(key, String(attrs[key]));
        }
    }

    function _appendNoCommentSvgNode(svg, tag, attrs) {
        const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
        _setNoCommentSvgAttrs(node, attrs || {});
        svg.appendChild(node);
        return node;
    }

    function createNoCommentIconSvg(iconClass) {
        const raw = String(iconClass || '').toLowerCase();
        if (!raw) return null;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        _setNoCommentSvgAttrs(svg, {
            viewBox: '0 0 24 24',
            'aria-hidden': 'true',
            focusable: 'false',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '2',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round',
        });

        if (raw.includes('fa-xmark')) {
            _appendNoCommentSvgNode(svg, 'line', { x1: '6', y1: '6', x2: '18', y2: '18' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '18', y1: '6', x2: '6', y2: '18' });
            return svg;
        }
        if (raw.includes('fa-plus')) {
            _appendNoCommentSvgNode(svg, 'line', { x1: '12', y1: '6', x2: '12', y2: '18' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '6', y1: '12', x2: '18', y2: '12' });
            return svg;
        }
        if (raw.includes('fa-trash')) {
            _appendNoCommentSvgNode(svg, 'path', { d: 'M5 8h14' });
            _appendNoCommentSvgNode(svg, 'path', { d: 'M9 8V6.4C9 5.6 9.6 5 10.4 5h3.2C14.4 5 15 5.6 15 6.4V8' });
            _appendNoCommentSvgNode(svg, 'rect', { x: '7', y: '8', width: '10', height: '11', rx: '1.6' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '10', y1: '11', x2: '10', y2: '16' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '14', y1: '11', x2: '14', y2: '16' });
            return svg;
        }
        if (raw.includes('fa-wrench')) {
            _appendNoCommentSvgNode(svg, 'path', {
                d: 'M13.2 6.2a2.8 2.8 0 0 0 3.9 3.9l-6.7 6.7a2.2 2.2 0 1 1-3.1-3.1l6.7-6.7z'
            });
            _appendNoCommentSvgNode(svg, 'circle', {
                cx: '7.3',
                cy: '16.7',
                r: '0.9',
                fill: 'currentColor',
                stroke: 'none'
            });
            return svg;
        }
        if (raw.includes('fa-power-off')) {
            _appendNoCommentSvgNode(svg, 'path', { d: 'M12 4v7' });
            _appendNoCommentSvgNode(svg, 'path', { d: 'M7.3 6.8a6.8 6.8 0 1 0 9.4 0' });
            return svg;
        }
        if (raw.includes('fa-server')) {
            _appendNoCommentSvgNode(svg, 'rect', { x: '4.5', y: '4', width: '15', height: '6', rx: '1.5' });
            _appendNoCommentSvgNode(svg, 'rect', { x: '4.5', y: '14', width: '15', height: '6', rx: '1.5' });
            _appendNoCommentSvgNode(svg, 'circle', { cx: '8', cy: '7', r: '0.9', fill: 'currentColor', stroke: 'none' });
            _appendNoCommentSvgNode(svg, 'circle', { cx: '8', cy: '17', r: '0.9', fill: 'currentColor', stroke: 'none' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '11', y1: '7', x2: '17', y2: '7' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '11', y1: '17', x2: '17', y2: '17' });
            return svg;
        }
        if (raw.includes('fa-arrows-rotate') || raw.includes('fa-arrow-rotate-right')) {
            _appendNoCommentSvgNode(svg, 'path', { d: 'M20 11a8 8 0 0 0-13.7-5.3' });
            _appendNoCommentSvgNode(svg, 'path', { d: 'M6.3 2.8H2.8v3.5' });
            _appendNoCommentSvgNode(svg, 'path', { d: 'M4 13a8 8 0 0 0 13.7 5.3' });
            _appendNoCommentSvgNode(svg, 'path', { d: 'M17.7 21.2h3.5v-3.5' });
            return svg;
        }
        if (raw.includes('fa-gear') || raw.includes('fa-cog')) {
            _appendNoCommentSvgNode(svg, 'circle', { cx: '12', cy: '12', r: '3.2' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '12', y1: '2.8', x2: '12', y2: '5' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '12', y1: '19', x2: '12', y2: '21.2' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '2.8', y1: '12', x2: '5', y2: '12' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '19', y1: '12', x2: '21.2', y2: '12' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '5.1', y1: '5.1', x2: '6.8', y2: '6.8' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '17.2', y1: '17.2', x2: '18.9', y2: '18.9' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '18.9', y1: '5.1', x2: '17.2', y2: '6.8' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '6.8', y1: '17.2', x2: '5.1', y2: '18.9' });
            return svg;
        }
        if (raw.includes('fa-steam')) {
            _setNoCommentSvgAttrs(svg, { 'stroke-width': '1.9' });
            _appendNoCommentSvgNode(svg, 'circle', { cx: '16.2', cy: '7.8', r: '3.3' });
            _appendNoCommentSvgNode(svg, 'circle', { cx: '16.2', cy: '7.8', r: '1.35', fill: 'currentColor', stroke: 'none' });
            _appendNoCommentSvgNode(svg, 'circle', { cx: '7.3', cy: '16.3', r: '2.35' });
            _appendNoCommentSvgNode(svg, 'path', { d: 'M9.1 15.2 13.9 10.5' });
            _appendNoCommentSvgNode(svg, 'path', { d: 'M13.9 10.5a3.35 3.35 0 0 1 2.3-1.05' });
            return svg;
        }
        if (raw.includes('fa-arrow-left')) {
            _appendNoCommentSvgNode(svg, 'line', { x1: '18', y1: '12', x2: '6', y2: '12' });
            _appendNoCommentSvgNode(svg, 'path', { d: 'M10.5 7.5 6 12l4.5 4.5' });
            return svg;
        }
        if (raw.includes('fa-magnifying-glass')) {
            _appendNoCommentSvgNode(svg, 'circle', { cx: '10.5', cy: '10.5', r: '4.8' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '14', y1: '14', x2: '18.5', y2: '18.5' });
            return svg;
        }
        if (raw.includes('fa-circle-info')) {
            _appendNoCommentSvgNode(svg, 'circle', { cx: '12', cy: '12', r: '8.8' });
            _appendNoCommentSvgNode(svg, 'line', { x1: '12', y1: '10', x2: '12', y2: '15.5' });
            _appendNoCommentSvgNode(svg, 'circle', { cx: '12', cy: '7.3', r: '0.9', fill: 'currentColor', stroke: 'none' });
            return svg;
        }

        return null;
    }

    function resolveNoCommentIconFallback(iconClass) {
        const raw = String(iconClass || '').toLowerCase();
        if (!raw) return 'o';
        if (raw.includes('fa-store')) return '[]';
        if (raw.includes('fa-database')) return '0';
        if (raw.includes('fa-folder')) return '#';
        if (raw.includes('fa-discord')) return '*';
        if (raw.includes('fa-floppy-disk')) return '=';
        return 'o';
    }

    function createNoCommentIcon(iconClass, extraClassName) {
        const el = document.createElement('span');
        el.className = 'NoComment-inline-icon' + (extraClassName ? (' ' + extraClassName) : '');
        el.setAttribute('aria-hidden', 'true');
        const svgIcon = createNoCommentIconSvg(iconClass);
        if (svgIcon) {
            el.appendChild(svgIcon);
        } else {
            el.textContent = resolveNoCommentIconFallback(iconClass);
        }
        return el;
    }

    function createNoCommentLauncherLogo() {
        const wrap = document.createElement('span');
        wrap.className = 'NoComment-launcher-logo';
        wrap.setAttribute('aria-hidden', 'true');

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        _setNoCommentSvgAttrs(svg, {
            viewBox: '0 0 24 24',
            focusable: 'false',
            'aria-hidden': 'true',
        });

        _appendNoCommentSvgNode(svg, 'polygon', {
            class: 'NoComment-launcher-hex-outer',
            points: '12,2.6 19.6,7 19.6,17 12,21.4 4.4,17 4.4,7'
        });
        _appendNoCommentSvgNode(svg, 'polygon', {
            class: 'NoComment-launcher-hex-inner',
            points: '12,5.6 17.1,8.5 17.1,15.5 12,18.4 6.9,15.5 6.9,8.5'
        });
        _appendNoCommentSvgNode(svg, 'circle', {
            class: 'NoComment-launcher-core',
            cx: '12',
            cy: '12',
            r: '1.55'
        });

        wrap.appendChild(svg);
        return wrap;
    }

    function clampValue(value, min, max) {
        if (typeof value !== 'number' || !isFinite(value)) return min;
        if (max < min) return min;
        return Math.min(max, Math.max(min, value));
    }

    function getToolsWidgetSize(widget) {
        if (!widget) return { width: 52, height: 52 };
        const rect = widget.getBoundingClientRect();
        const width = rect.width || widget.offsetWidth || 52;
        const height = rect.height || widget.offsetHeight || 52;
        return { width: width, height: height };
    }

    function clampToolsWidgetPosition(widget, left, top) {
        const size = getToolsWidgetSize(widget);
        const maxLeft = Math.max(TOOLS_WIDGET_MARGIN, window.innerWidth - size.width - TOOLS_WIDGET_MARGIN);
        const maxTop = Math.max(TOOLS_WIDGET_MARGIN, window.innerHeight - size.height - TOOLS_WIDGET_MARGIN);
        return {
            left: clampValue(left, TOOLS_WIDGET_MARGIN, maxLeft),
            top: clampValue(top, TOOLS_WIDGET_MARGIN, maxTop)
        };
    }

    function normalizeToolsWidgetPosition(value) {
        if (!value || typeof value !== 'object') return null;
        const x = Number(value.x);
        const y = Number(value.y);
        if (!isFinite(x) || !isFinite(y)) return null;
        return { x: Math.round(x), y: Math.round(y) };
    }

    function queueToolsWidgetBackendSave(left, top) {
        if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') return;
        toolsWidgetPersistState.pending = { x: Math.round(left), y: Math.round(top) };
        if (toolsWidgetPersistState.saveTimer) {
            clearTimeout(toolsWidgetPersistState.saveTimer);
        }
        toolsWidgetPersistState.saveTimer = setTimeout(function() {
            toolsWidgetPersistState.saveTimer = 0;
            const pending = toolsWidgetPersistState.pending;
            toolsWidgetPersistState.pending = null;
            if (!pending) return;
            Millennium.callServerMethod('No-Comment', 'SetToolsWidgetPosition', {
                x: pending.x,
                y: pending.y,
                contentScriptQuery: ''
            }).catch(function(){});
        }, TOOLS_WIDGET_BACKEND_SAVE_DEBOUNCE_MS);
    }

    function requestToolsWidgetBackendPosition(widget, panel, launcher) {
        if (!widget || toolsWidgetPersistState.loadRequested) return;
        toolsWidgetPersistState.loadRequested = true;
        if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') return;
        Millennium.callServerMethod('No-Comment', 'GetToolsWidgetPosition', {
            contentScriptQuery: ''
        }).then(function(res) {
            let payload = null;
            try {
                payload = (typeof res === 'string') ? JSON.parse(res) : res;
            } catch(_) {
                return;
            }
            if (!payload || payload.success !== true) return;
            const backendPos = normalizeToolsWidgetPosition(payload.position);
            if (!backendPos) return;
            if (widget.getAttribute('data-position-user-set') === '1') return;
            setToolsWidgetPosition(widget, backendPos.x, backendPos.y, false);
            try {
                localStorage.setItem(TOOLS_WIDGET_STORAGE_KEY, JSON.stringify({
                    x: backendPos.x,
                    y: backendPos.y
                }));
            } catch(_) {}
            if (panel && panel.classList.contains('is-open')) {
                positionToolsPanel(panel, launcher);
            }
        }).catch(function(){});
    }

    function saveToolsWidgetPosition(left, top) {
        const normalised = normalizeToolsWidgetPosition({ x: left, y: top });
        if (!normalised) return;
        try {
            localStorage.setItem(TOOLS_WIDGET_STORAGE_KEY, JSON.stringify({
                x: normalised.x,
                y: normalised.y
            }));
        } catch(_) {}
        queueToolsWidgetBackendSave(normalised.x, normalised.y);
    }

    function readToolsWidgetPosition() {
        try {
            const raw = localStorage.getItem(TOOLS_WIDGET_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return normalizeToolsWidgetPosition(parsed);
        } catch(_) {
            return null;
        }
    }

    function setToolsWidgetPosition(widget, left, top, persist) {
        if (!widget) return;
        const clamped = clampToolsWidgetPosition(widget, left, top);
        widget.style.left = Math.round(clamped.left) + 'px';
        widget.style.top = Math.round(clamped.top) + 'px';
        widget.style.right = 'auto';
        widget.style.bottom = 'auto';
        if (persist) {
            saveToolsWidgetPosition(clamped.left, clamped.top);
        }
    }

    function initializeToolsWidgetPosition(widget) {
        if (!widget || widget.getAttribute('data-position-initialized') === '1') return;
        const saved = readToolsWidgetPosition();
        if (saved) {
            setToolsWidgetPosition(widget, saved.x, saved.y, false);
        } else {
            const size = getToolsWidgetSize(widget);
            const left = Math.max(TOOLS_WIDGET_MARGIN, window.innerWidth - size.width - TOOLS_WIDGET_MARGIN);
            const top = Math.max(TOOLS_WIDGET_MARGIN, window.innerHeight - size.height - TOOLS_WIDGET_MARGIN);
            setToolsWidgetPosition(widget, left, top, false);
        }
        widget.setAttribute('data-position-initialized', '1');
    }

    function clampToolsWidgetIntoViewport(widget, persist) {
        if (!widget) return;
        const rect = widget.getBoundingClientRect();
        setToolsWidgetPosition(widget, rect.left, rect.top, !!persist);
    }

    function shouldSuppressToolsClick(launcher) {
        if (!launcher) return false;
        const until = Number(launcher.getAttribute('data-suppress-click-until') || '0');
        return isFinite(until) && until > Date.now();
    }

    function markToolsClickSuppressed(launcher) {
        if (!launcher) return;
        launcher.setAttribute('data-suppress-click-until', String(Date.now() + TOOLS_CLICK_SUPPRESS_MS));
    }

    function positionToolsPanel(panel, launcher) {
        if (!panel || !launcher) return;
        const launcherRect = launcher.getBoundingClientRect();
        const panelRect = panel.getBoundingClientRect();
        const panelWidth = panelRect.width || panel.offsetWidth || 340;
        const panelHeight = panelRect.height || panel.offsetHeight || 420;
        let left = launcherRect.left + (launcherRect.width / 2) - (panelWidth / 2);
        let top = launcherRect.top - TOOLS_PANEL_GAP - panelHeight;
        const belowTop = launcherRect.bottom + TOOLS_PANEL_GAP;

        if (top < TOOLS_WIDGET_MARGIN && (belowTop + panelHeight) <= (window.innerHeight - TOOLS_WIDGET_MARGIN)) {
            top = belowTop;
        }

        const maxLeft = Math.max(TOOLS_WIDGET_MARGIN, window.innerWidth - panelWidth - TOOLS_WIDGET_MARGIN);
        const maxTop = Math.max(TOOLS_WIDGET_MARGIN, window.innerHeight - panelHeight - TOOLS_WIDGET_MARGIN);

        left = clampValue(left, TOOLS_WIDGET_MARGIN, maxLeft);
        top = clampValue(top, TOOLS_WIDGET_MARGIN, maxTop);

        panel.style.left = Math.round(left) + 'px';
        panel.style.top = Math.round(top) + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    }

    function animateToolsLauncher(launcher) {
        if (!launcher) return;
        launcher.classList.remove('NoComment-tools-bounce');
        void launcher.offsetWidth;
        launcher.classList.add('NoComment-tools-bounce');
    }

    function closeToolsMenu() {
        try {
            const panel = document.querySelector('.NoComment-tools-panel');
            if (panel) {
                panel.classList.remove('is-open');
                panel.setAttribute('aria-hidden', 'true');
            }
        } catch(_) {}
        try {
            const launcher = document.querySelector('.NoComment-tools-launcher');
            if (launcher) {
                launcher.classList.remove('is-open');
                launcher.setAttribute('aria-expanded', 'false');
            }
        } catch(_) {}
    }

    function ensureToolsWidget() {
        ensureNoCommentStyles();
        ensureFontAwesome();
        let widget = document.querySelector('.NoComment-tools-widget');
        let launcher = widget ? widget.querySelector('.NoComment-tools-launcher') : null;
        let panel = widget ? widget.querySelector('.NoComment-tools-panel') : null;

        if (!widget) {
            widget = document.createElement('div');
            widget.className = 'NoComment-tools-widget';
        }

        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'NoComment-settings-overlay NoComment-tools-panel';
            panel.setAttribute('role', 'menu');
            panel.setAttribute('aria-hidden', 'true');
            widget.appendChild(panel);
        }

        if (!launcher) {
            launcher = document.createElement('button');
            launcher.type = 'button';
            launcher.className = 'NoComment-tools-launcher';
            launcher.setAttribute('aria-label', 'Tools');
            launcher.setAttribute('aria-expanded', 'false');
            launcher.innerHTML = '';
            launcher.appendChild(createNoCommentLauncherLogo());
            widget.appendChild(launcher);
        }

        if (!widget.parentElement) {
            document.body.appendChild(widget);
        }

        initializeToolsWidgetPosition(widget);
        requestToolsWidgetBackendPosition(widget, panel, launcher);
        if (panel.classList.contains('is-open')) {
            positionToolsPanel(panel, launcher);
        }

        if (!widget.getAttribute('data-bound')) {
            widget.setAttribute('data-bound', '1');
            launcher.addEventListener('pointerdown', function(e){
                if (e.button !== 0) return;

                const startRect = widget.getBoundingClientRect();
                const startX = e.clientX;
                const startY = e.clientY;
                const pointerId = e.pointerId;
                let dragging = false;

                function onPointerMove(moveEvent) {
                    const dx = moveEvent.clientX - startX;
                    const dy = moveEvent.clientY - startY;
                    if (!dragging) {
                        if (Math.abs(dx) < TOOLS_WIDGET_DRAG_THRESHOLD && Math.abs(dy) < TOOLS_WIDGET_DRAG_THRESHOLD) {
                            return;
                        }
                        dragging = true;
                        widget.classList.add('is-dragging');
                    }
                    moveEvent.preventDefault();
                    setToolsWidgetPosition(widget, startRect.left + dx, startRect.top + dy, false);
                    if (panel.classList.contains('is-open')) {
                        positionToolsPanel(panel, launcher);
                    }
                }

                function onPointerDone(doneEvent) {
                    window.removeEventListener('pointermove', onPointerMove);
                    window.removeEventListener('pointerup', onPointerDone);
                    window.removeEventListener('pointercancel', onPointerDone);
                    widget.classList.remove('is-dragging');
                    if (launcher && launcher.releasePointerCapture) {
                        try { launcher.releasePointerCapture(pointerId); } catch(_) {}
                    }
                    if (dragging) {
                        widget.setAttribute('data-position-user-set', '1');
                        const rect = widget.getBoundingClientRect();
                        saveToolsWidgetPosition(rect.left, rect.top);
                        markToolsClickSuppressed(launcher);
                        if (doneEvent) {
                            doneEvent.preventDefault();
                            doneEvent.stopPropagation();
                        }
                    }
                }

                if (launcher && launcher.setPointerCapture) {
                    try { launcher.setPointerCapture(pointerId); } catch(_) {}
                }

                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerDone);
                window.addEventListener('pointercancel', onPointerDone);
            });
            launcher.addEventListener('click', function(e){
                if (shouldSuppressToolsClick(launcher)) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                animateToolsLauncher(launcher);
                showSettingsPopup();
            });
            panel.addEventListener('click', function(e){
                e.stopPropagation();
            });
            document.addEventListener('click', function(){
                if (panel.classList.contains('is-open')) {
                    closeToolsMenu();
                }
            });
            window.addEventListener('resize', function(){
                clampToolsWidgetIntoViewport(widget, true);
                if (panel.classList.contains('is-open')) {
                    positionToolsPanel(panel, launcher);
                }
            });
        }

        return { widget, launcher, panel };
    }

    function showSettingsPopup() {
        if (settingsMenuPending) return;
        settingsMenuPending = true;
        ensureTranslationsLoaded(false).catch(function(){ return null; }).finally(function(){
            settingsMenuPending = false;
            try { const d = document.querySelector('.NoComment-overlay'); if (d) d.remove(); } catch(_) {}
            ensureNoCommentStyles();
            ensureFontAwesome();
            const tools = ensureToolsWidget();
            if (!tools || !tools.panel) return;
            const panel = tools.panel;
            const launcher = tools.launcher;

            if (panel.classList.contains('is-open')) {
                closeToolsMenu();
                return;
            }

            panel.innerHTML = '';

            const header = document.createElement('div');
            header.className = 'NoComment-tools-header';

            const title = document.createElement('div');
            title.className = 'NoComment-tools-title';
            title.textContent = t('menu.toolsTitle', 'Tools');

            const iconButtons = document.createElement('div');
            iconButtons.className = 'NoComment-tools-actions';

            function createIconButton(id, iconClass, titleKey, titleFallback) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.id = id;
                btn.className = 'NoComment-tools-icon-btn';
                const label = t(titleKey, titleFallback);
                btn.title = label;
                btn.setAttribute('aria-label', label);
                if (typeof createNoCommentIcon === 'function') {
                    btn.appendChild(createNoCommentIcon('fa-solid ' + iconClass));
                } else {
                    btn.textContent = '*';
                }
                iconButtons.appendChild(btn);
                return btn;
            }

            const body = document.createElement('div');
            body.className = 'NoComment-tools-body';

            const container = document.createElement('div');
            container.className = 'NoComment-tools-content';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '10px';

            function createSectionLabel(key, fallback, marginTop) {
                const label = document.createElement('div');
                const topValue = typeof marginTop === 'number' ? marginTop : 8;
                label.className = 'NoComment-tools-section';
                label.style.marginTop = topValue + 'px';
                label.textContent = t(key, fallback);
                container.appendChild(label);
                return label;
            }

            function setDailyUsageDisplay(target, count, limit, remaining, resetText) {
                if (!target) return;
                const safeLimit = (typeof limit === 'number' && limit > 0) ? limit : 25;
                const safeCount = (typeof count === 'number' && count >= 0) ? count : 0;
                const safeRemaining = (typeof remaining === 'number' && remaining >= 0) ? remaining : Math.max(0, safeLimit - safeCount);
                target.textContent = safeCount + '/' + safeLimit + ' (24h)';
                const title = safeRemaining + ' left in current 24h window' + (resetText ? ('\nResets: ' + resetText) : '');
                target.title = title;
                target.setAttribute('aria-label', title);
            }

            function createMenuButton(id, key, fallback, iconClass, isPrimary) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.id = id;
                btn.className = 'NoComment-tools-action';
                if (iconClass) {
                    if (typeof createNoCommentIcon === 'function') {
                        btn.appendChild(createNoCommentIcon('fa-solid ' + iconClass));
                    } else {
                        const fallbackIcon = document.createElement('span');
                        fallbackIcon.className = 'NoComment-inline-icon';
                        fallbackIcon.textContent = '*';
                        btn.appendChild(fallbackIcon);
                    }
                }
                const textSpan = document.createElement('span');
                textSpan.textContent = t(key, fallback);
                btn.appendChild(textSpan);
                container.appendChild(btn);
                return btn;
            }

            const settingsManagerBtn = createIconButton('lt-settings-open-manager', 'fa-gear', 'menu.settings', 'Settings');
            const closeBtn = createIconButton('lt-settings-close', 'fa-xmark', 'settings.close', 'Close');

            const manageSectionRow = document.createElement('div');
            manageSectionRow.className = 'NoComment-tools-section-row';
            const manageSectionLabel = document.createElement('div');
            manageSectionLabel.className = 'NoComment-tools-section';
            manageSectionLabel.style.marginTop = '0';
            manageSectionLabel.textContent = t('menu.manageGameLabel', 'Manage Game');
            const manageUsageBadge = document.createElement('div');
            manageUsageBadge.className = 'NoComment-tools-usage';
            manageSectionRow.appendChild(manageSectionLabel);
            manageSectionRow.appendChild(manageUsageBadge);
            container.appendChild(manageSectionRow);
            setDailyUsageDisplay(manageUsageBadge, 0, 25, 25, '');

            function refreshDailyAddUsage() {
                try {
                    if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                        setDailyUsageDisplay(manageUsageBadge, 0, 25, 25, '');
                        return;
                    }
                    Millennium.callServerMethod('No-Comment', 'GetDailyAddUsage', { contentScriptQuery: '' }).then(function(res){
                        try {
                            const payload = typeof res === 'string' ? JSON.parse(res) : res;
                            if (!payload || payload.success !== true) {
                                return;
                            }
                            const count = Number(payload.count);
                            const limit = Number(payload.limit);
                            const remaining = Number(payload.remaining);
                            const resetText = payload.reset ? String(payload.reset) : '';
                            setDailyUsageDisplay(manageUsageBadge, count, limit, remaining, resetText);
                        } catch(_) {}
                    }).catch(function(){});
                } catch(_) {}
            }
            refreshDailyAddUsage();

            const addGameBtn = createMenuButton('lt-settings-add-game', 'Add via NoComment', 'Add via NoComment', 'fa-plus');
            const removeBtn = createMenuButton('lt-settings-remove-lua', 'menu.removeNoComment', 'Remove via NoComment', 'fa-trash-can');
            const refreshCacheBtn = createMenuButton(
                'lt-settings-refresh-cache',
                'menu.refreshGameCache',
                'Refresh game cache',
                'fa-arrows-rotate'
            );
            removeBtn.style.display = 'none';
            refreshCacheBtn.style.display = 'none';

            function getSettingsMenuAppId() {
                const current = getCurrentAppId();
                if (typeof current === 'number' && !isNaN(current)) return current;
                const cached = parseInt(window.__NoCommentCurrentAppId, 10);
                if (!isNaN(cached)) return cached;
                return NaN;
            }

            const fixesMenuBtn = createMenuButton('lt-settings-fixes-menu', 'menu.fixesMenu', 'Fixes Menu', 'fa-wrench');

            createSectionLabel('menu.steamdbSearchLabel', 'SteamDB Search', 10);
            const searchWrap = document.createElement('div');
            searchWrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
            const searchInput = document.createElement('input');
            searchInput.className = 'NoComment-search-input';
            searchInput.type = 'text';
            searchInput.placeholder = t('menu.steamdbSearchPlaceholder', 'Game name or AppID...');
            const searchRow = document.createElement('div');
            searchRow.className = 'NoComment-search-row';
            const searchBtn = document.createElement('button');
            searchBtn.type = 'button';
            searchBtn.className = 'NoComment-search-btn primary';
            searchBtn.textContent = t('menu.search', 'Search');
            const steamdbBtn = document.createElement('button');
            steamdbBtn.type = 'button';
            steamdbBtn.className = 'NoComment-search-btn';
            steamdbBtn.textContent = t('menu.openSteamDB', 'Open SteamDB');
            searchRow.appendChild(searchBtn);
            searchRow.appendChild(steamdbBtn);
            const results = document.createElement('div');
            results.className = 'NoComment-search-results';
            const empty = document.createElement('div');
            empty.className = 'NoComment-search-empty';
            empty.style.marginTop = '4px';
            empty.textContent = t('menu.searchHint', 'Type a name or AppID to search.');
            results.appendChild(empty);
            searchWrap.appendChild(searchInput);
            searchWrap.appendChild(searchRow);
            searchWrap.appendChild(results);
            container.appendChild(searchWrap);

            createSectionLabel('menu.advancedLabel', 'Advanced');
            const restartBtn = createMenuButton('lt-settings-restart-steam', 'menu.restartSteam', 'Restart Steam', 'fa-power-off');
            const fetchApisBtn = createMenuButton('lt-settings-fetch-apis', 'menu.fetchFreeApis', 'Fetch Free APIs', 'fa-server');
            const checkUpdatesBtn = createMenuButton('lt-settings-check-updates', 'menu.checkUpdates', 'Check for updates', 'fa-arrows-rotate');

            body.appendChild(container);

            header.appendChild(title);
            header.appendChild(iconButtons);
            panel.appendChild(header);
            panel.appendChild(body);

            panel.classList.add('is-open');
            panel.setAttribute('aria-hidden', 'false');
            if (typeof positionToolsPanel === 'function') {
                positionToolsPanel(panel, launcher);
                setTimeout(function() {
                    positionToolsPanel(panel, launcher);
                }, 30);
            }
            if (launcher) {
                launcher.classList.add('is-open');
                launcher.setAttribute('aria-expanded', 'true');
                animateToolsLauncher(launcher);
            }

            if (restartBtn) {
                restartBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    try { Millennium.callServerMethod('No-Comment', 'RestartSteam', { contentScriptQuery: '' }); } catch(_) {}
                });
            }

            function renderSearchResults(items) {
                results.innerHTML = '';
                if (!items || !items.length) {
                    const no = document.createElement('div');
                    no.className = 'NoComment-search-empty';
                    no.textContent = t('menu.searchNoResults', 'No results found.');
                    results.appendChild(no);
                    return;
                }
                items.forEach(function(it) {
                    const row = document.createElement('div');
                    row.className = 'NoComment-search-item';
                    const left = document.createElement('div');
                    const title = document.createElement('div');
                    title.className = 'NoComment-search-title';
                    title.textContent = it.name;
                    const meta = document.createElement('div');
                    meta.className = 'NoComment-search-meta';
                    meta.textContent = 'AppID ' + it.appid;
                    left.appendChild(title);
                    left.appendChild(meta);
                    const actions = document.createElement('div');
                    actions.className = 'NoComment-search-actions';
                    const openBtn = document.createElement('button');
                    openBtn.type = 'button';
                    openBtn.className = 'NoComment-search-btn primary';
                    openBtn.style.flex = '0 0 auto';
                    openBtn.style.padding = '6px 10px';
                    openBtn.textContent = t('menu.openStore', 'Open');
                    openBtn.onclick = function(){ openSteamStore(it.appid); };
                    const dbBtn = document.createElement('button');
                    dbBtn.type = 'button';
                    dbBtn.className = 'NoComment-search-btn';
                    dbBtn.style.flex = '0 0 auto';
                    dbBtn.style.padding = '6px 10px';
                    dbBtn.textContent = 'SteamDB';
                    dbBtn.onclick = function(){ openSteamDbApp(it.appid); };
                    actions.appendChild(openBtn);
                    actions.appendChild(dbBtn);
                    row.appendChild(left);
                    row.appendChild(actions);
                    results.appendChild(row);
                });
            }

            async function runSearch() {
                const rawTerm = (searchInput.value || '').trim();
                if (!rawTerm) return;
                const appidFromInput = extractSteamAppId(rawTerm);
                if (appidFromInput) {
                    if (appidFromInput !== rawTerm) {
                        searchInput.value = appidFromInput;
                    }
                    results.innerHTML = '';
                    const loading = document.createElement('div');
                    loading.className = 'NoComment-search-empty';
                    loading.textContent = t('menu.searchLoading', 'Searching…');
                    results.appendChild(loading);
                    const appid = appidFromInput;
                    let name = 'App ' + appid;
                    try {
                        const fetched = await fetchAppNameById(appid);
                        if (fetched) name = fetched;
                    } catch(_) {}
                    renderSearchResults([{ appid: appid, name: name }]);
                    return;
                }
                const term = rawTerm;
                results.innerHTML = '';
                const loading = document.createElement('div');
                loading.className = 'NoComment-search-empty';
                loading.textContent = t('menu.searchLoading', 'Searching…');
                results.appendChild(loading);
                try {
                    const items = await fetchSteamSearch(term);
                    renderSearchResults(items);
                } catch (_) {
                    const msg = document.createElement('div');
                    msg.className = 'NoComment-search-empty';
                    msg.textContent = t('menu.searchFailed', 'Search failed. Try SteamDB search.');
                    results.innerHTML = '';
                    results.appendChild(msg);
                }
            }

            searchBtn.addEventListener('click', function(e){
                e.preventDefault();
                runSearch();
            });
            steamdbBtn.addEventListener('click', function(e){
                e.preventDefault();
                const rawTerm = (searchInput.value || '').trim();
                if (!rawTerm) return;
                const appidFromInput = extractSteamAppId(rawTerm);
                if (appidFromInput) {
                    if (appidFromInput !== rawTerm) {
                        searchInput.value = appidFromInput;
                    }
                    openSteamDbApp(appidFromInput);
                    return;
                }
                openSteamDbSearch(rawTerm);
            });
            searchInput.addEventListener('keydown', function(e){
                if (e.key === 'Enter') {
                    e.preventDefault();
                    runSearch();
                }
            });

            if (fetchApisBtn) {
                fetchApisBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    try {
                        Millennium.callServerMethod('No-Comment', 'FetchFreeApisNow', { contentScriptQuery: '' }).then(function(res){
                            try {
                                const payload = typeof res === 'string' ? JSON.parse(res) : res;
                                const ok = payload && payload.success;
                                const count = payload && payload.count;
                                const successText = lt('Loaded free APIs: {count}').replace('{count}', (count != null ? count : '?'));
                                const failText = (payload && payload.error) ? String(payload.error) : lt('Failed to load free APIs.');
                                const text = ok ? successText : failText;
                                ShowNoCommentAlert('No-Comment', text);
                            } catch(_) {}
                        });
                    } catch(_) {}
                });
            }

            if (checkUpdatesBtn) {
                checkUpdatesBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    try {
                        Millennium.callServerMethod('No-Comment', 'CheckForUpdatesNow', { contentScriptQuery: '' }).then(function(res){
                            try {
                                const payload = typeof res === 'string' ? JSON.parse(res) : res;
                                if (payload && payload.success) {
                                    const message = payload.message || '';
                                    if (message) {
                                        ShowNoCommentAlert('No-Comment', message);
                                    } else {
                                        ShowNoCommentAlert('No-Comment', t('menu.updatesNone', 'No updates available.'));
                                    }
                                } else {
                                    const errText = (payload && payload.error) ? String(payload.error) : t('menu.updatesCheckFailed', 'Update check failed.');
                                    ShowNoCommentAlert('No-Comment', errText);
                                }
                            } catch(err) {
                                const msg = (err && err.message) ? err.message : t('menu.updatesCheckFailed', 'Update check failed.');
                                ShowNoCommentAlert('No-Comment', msg);
                            }
                        }).catch(function(err){
                            const msg = (err && err.message) ? err.message : t('menu.updatesCheckFailed', 'Update check failed.');
                            ShowNoCommentAlert('No-Comment', msg);
                        });
                    } catch(err) {
                        backendLog('NoComment: Check updates error: ' + err);
                    }
                });
            }

            if (closeBtn) {
                closeBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    closeToolsMenu();
                });
            }

            if (settingsManagerBtn) { 
                settingsManagerBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    showSettingsManagerPopup(false, showSettingsPopup);
                });
            }

            if (fixesMenuBtn) {
                fixesMenuBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    try {
                        const appid = getSettingsMenuAppId();
                        if (isNaN(appid)) {
                            const errText = t('menu.error.noAppId', 'Could not determine game AppID');
                            ShowNoCommentAlert('No-Comment', errText);
                            return;
                        }

                        Millennium.callServerMethod('No-Comment', 'GetGameInstallPath', { appid, contentScriptQuery: '' }).then(function(pathRes){
                            try {
                                let isGameInstalled = false;
                                const pathPayload = typeof pathRes === 'string' ? JSON.parse(pathRes) : pathRes;
                                if (pathPayload && pathPayload.success && pathPayload.installPath) {
                                    isGameInstalled = true;
                                    window.__NoCommentGameInstallPath = pathPayload.installPath;
                                }
                                window.__NoCommentGameIsInstalled = isGameInstalled;
                                showFixesLoadingPopupAndCheck(appid);
                            } catch(err) {
                                backendLog('NoComment: GetGameInstallPath error: ' + err);
                            }
                        }).catch(function() {
                            const errorText = t('menu.error.getPath', 'Error getting game path');
                            ShowNoCommentAlert('No-Comment', errorText);
                        });
                    } catch(err) {
                        backendLog('NoComment: Fixes Menu button error: ' + err);
                    }
                });
            }

            if (addGameBtn) {
                addGameBtn.addEventListener('click', async function(e){
                    e.preventDefault();
                    if (runState.inProgress) return;
                    try {
                        const appid = getSettingsMenuAppId();
                        if (isNaN(appid)) {
                            const errText = t('menu.error.noAppId', 'Could not determine game AppID');
                            ShowNoCommentAlert('No-Comment', errText);
                            return;
                        }
                        const started = await startAddViaNoCommentFlow(appid, { showOverlay: true });
                        if (started) {
                            setTimeout(refreshDailyAddUsage, 600);
                        }
                    } catch(err) {
                        backendLog('NoComment: Add Game button error: ' + err);
                    }
                });
            }

            if (refreshCacheBtn) {
                refreshCacheBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    if (refreshCacheBtn.getAttribute('data-busy') === '1') return;
                    try {
                        const appid = getSettingsMenuAppId();
                        if (isNaN(appid)) {
                            const errText = t('menu.error.noAppId', 'Could not determine game AppID');
                            ShowNoCommentAlert('No-Comment', errText);
                            return;
                        }

                        const labelNode = refreshCacheBtn.querySelector('span');
                        const defaultLabel = labelNode
                            ? labelNode.textContent
                            : t('menu.refreshGameCache', 'Refresh game cache');
                        refreshCacheBtn.setAttribute('data-busy', '1');
                        refreshCacheBtn.style.opacity = '0.7';
                        refreshCacheBtn.style.cursor = 'wait';
                        if (labelNode) {
                            labelNode.textContent = t('menu.refreshingCache', 'Refreshing cache...');
                        }

                        Millennium.callServerMethod(
                            'No-Comment',
                            'ClearGameCacheAndRefetch',
                            { appid, contentScriptQuery: '' }
                        ).then(function(res){
                            try {
                                const payload = typeof res === 'string' ? JSON.parse(res) : res;
                                if (payload && payload.success) {
                                    const okText = payload.message || t('menu.refreshCacheSuccess', 'Game cache refreshed.');
                                    ShowNoCommentAlert('No-Comment', okText);
                                } else {
                                    const failText = (payload && payload.error)
                                        ? String(payload.error)
                                        : t('menu.refreshCacheFailure', 'Failed to refresh game cache.');
                                    ShowNoCommentAlert('No-Comment', failText);
                                }
                            } catch(err) {
                                const failText = (err && err.message)
                                    ? err.message
                                    : t('menu.refreshCacheFailure', 'Failed to refresh game cache.');
                                ShowNoCommentAlert('No-Comment', failText);
                            }
                        }).catch(function(err){
                            const failText = (err && err.message)
                                ? err.message
                                : t('menu.refreshCacheFailure', 'Failed to refresh game cache.');
                            ShowNoCommentAlert('No-Comment', failText);
                        }).finally(function(){
                            refreshCacheBtn.setAttribute('data-busy', '0');
                            refreshCacheBtn.style.opacity = '';
                            refreshCacheBtn.style.cursor = '';
                            if (labelNode) {
                                labelNode.textContent = defaultLabel;
                            }
                        });
                    } catch(err) {
                        backendLog('NoComment: Refresh cache button error: ' + err);
                    }
                });
            }

            try {
                const appid = getSettingsMenuAppId();
                if (isNaN(appid)) {
                    if (addGameBtn) addGameBtn.style.display = 'none';
                    removeBtn.style.display = 'none';
                    refreshCacheBtn.style.display = 'none';
                } else if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                    if (addGameBtn) addGameBtn.style.display = 'flex';
                    removeBtn.style.display = 'none';
                    refreshCacheBtn.style.display = 'flex';
                    Millennium.callServerMethod('No-Comment', 'HasNoCommentForApp', { appid, contentScriptQuery: '' }).then(function(res){
                        try {
                            const payload = typeof res === 'string' ? JSON.parse(res) : res;
                            const exists = !!(payload && payload.success && payload.exists === true);
                            if (exists) {
                                const doDelete = function() {
                                    try {
                                        Millennium.callServerMethod('No-Comment', 'DeleteNoCommentForApp', { appid, contentScriptQuery: '' }).then(function(){
                                            try {
                                                if (typeof invalidateInstalledLuaScriptsCache === 'function') {
                                                    invalidateInstalledLuaScriptsCache();
                                                }
                                                window.__NoCommentButtonInserted = false;
                                                window.__NoCommentPresenceCheckInFlight = false;
                                                window.__NoCommentPresenceCheckAppId = undefined;
                                                addNoCommentButton();
                                                const successText = t('menu.remove.success', 'NoComment removed for this app.');
                                                ShowNoCommentAlert('No-Comment', successText);
                                                if (typeof scheduleRestartSteam === 'function') {
                                                    scheduleRestartSteam(3);
                                                }
                                            } catch(err) {
                                                backendLog('NoComment: post-delete cleanup failed: ' + err);
                                            }
                                        }).catch(function(err){
                                            const failureText = t('menu.remove.failure', 'Failed to remove NoComment.');
                                            const errMsg = (err && err.message) ? err.message : failureText;
                                            ShowNoCommentAlert('No-Comment', errMsg);
                                        });
                                    } catch(err) {
                                        backendLog('NoComment: doDelete failed: ' + err);
                                    }
                                };

                                if (addGameBtn) addGameBtn.style.display = 'none';
                                removeBtn.style.display = 'flex';
                                refreshCacheBtn.style.display = 'flex';
                                removeBtn.onclick = function(e){
                                    e.preventDefault();
                                    doDelete();
                                };
                            } else {
                                removeBtn.style.display = 'none';
                                if (addGameBtn) addGameBtn.style.display = 'flex';
                                refreshCacheBtn.style.display = 'flex';
                            }
                        } catch(_) {}
                    });
                } else {
                    if (addGameBtn) addGameBtn.style.display = 'flex';
                    removeBtn.style.display = 'none';
                    refreshCacheBtn.style.display = 'flex';
                }
            } catch(_) {
                if (addGameBtn) addGameBtn.style.display = 'none';
                removeBtn.style.display = 'none';
                refreshCacheBtn.style.display = 'none';
            }
        });
    }

    function ensureTranslationsLoaded(forceRefresh, preferredLanguage) {
        try {
            if (!forceRefresh && window.__NoCommentI18n && window.__NoCommentI18n.ready) {
                return Promise.resolve(window.__NoCommentI18n);
            }
            if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                window.__NoCommentI18n = window.__NoCommentI18n || { language: 'en', locales: [], strings: {}, ready: false };
                return Promise.resolve(window.__NoCommentI18n);
            }
            const targetLanguage = (typeof preferredLanguage === 'string' && preferredLanguage) ? preferredLanguage :
                ((window.__NoCommentI18n && window.__NoCommentI18n.language) || '');
            return Millennium.callServerMethod('No-Comment', 'GetTranslations', { language: targetLanguage, contentScriptQuery: '' }).then(function(res){
                const payload = typeof res === 'string' ? JSON.parse(res) : res;
                if (!payload || payload.success !== true || !payload.strings) {
                    throw new Error('Invalid translation payload');
                }
                applyTranslationBundle(payload);
                try { refreshStoreButtonTranslations(); } catch(_) {}
                updateButtonTranslations();
                return window.__NoCommentI18n;
            }).catch(function(err){
                backendLog('NoComment: translation load failed: ' + err);
                window.__NoCommentI18n = window.__NoCommentI18n || { language: 'en', locales: [], strings: {}, ready: false };
                return window.__NoCommentI18n;
            });
        } catch(err) {
            backendLog('NoComment: ensureTranslationsLoaded error: ' + err);
            window.__NoCommentI18n = window.__NoCommentI18n || { language: 'en', locales: [], strings: {}, ready: false };
            return Promise.resolve(window.__NoCommentI18n);
        }
    }

    function translateText(key, fallback) {
        if (!key) {
            return typeof fallback !== 'undefined' ? fallback : '';
        }
        try {
            const store = window.__NoCommentI18n;
            if (store && store.strings && Object.prototype.hasOwnProperty.call(store.strings, key)) {
                const value = store.strings[key];
                if (typeof value === 'string') {
                    const trimmed = value.trim();
                    if (trimmed && trimmed.toLowerCase() !== TRANSLATION_PLACEHOLDER) {
                        return value;
                    }
                }
            }
        } catch(_) {}
        return typeof fallback !== 'undefined' ? fallback : key;
    }

    function t(key, fallback) {
        return translateText(key, fallback);
    }

    function lt(text) {
        return t(text, text);
    }

    function openExternalUrl(url) {
        try {
            if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                Millennium.callServerMethod('No-Comment', 'OpenExternalUrl', { url, contentScriptQuery: '' });
                return;
            }
        } catch(_) {}
        try { window.open(url, '_blank'); } catch(_) {}
    }

    function openSteamStore(appid) {
        const uri = 'steam://store/' + String(appid);
        try {
            if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                Millennium.callServerMethod('No-Comment', 'OpenSteamUri', { uri, contentScriptQuery: '' });
                return;
            }
        } catch(_) {}
        try { window.location.href = uri; } catch(_) {}
    }

    function openSteamDbSearch(query) {
        openExternalUrl('https://steamdb.info/search/?a=app&q=' + encodeURIComponent(query));
    }

    function openSteamDbApp(appid) {
        openExternalUrl('https://steamdb.info/app/' + String(appid) + '/');
    }

    function extractSteamAppId(value) {
        const input = String(value || '').trim();
        if (!input) return '';
        if (/^\d+$/.test(input)) return input;

        const patterns = [
            /(?:https?:\/\/)?store\.steampowered\.com\/app\/(\d+)(?:[/?#]|$)/i,
            /(?:https?:\/\/)?steamcommunity\.com\/app\/(\d+)(?:[/?#]|$)/i,
            /(?:https?:\/\/)?steamdb\.info\/app\/(\d+)(?:[/?#]|$)/i,
            /(?:https?:\/\/)?s\.team\/a\/(\d+)(?:[/?#]|$)/i,
            /steam:\/\/(?:store|run|install)\/(\d+)(?:[/?#]|$)/i,
            /[?&]appid=(\d+)(?:[&#]|$)/i
        ];

        for (const pattern of patterns) {
            const match = input.match(pattern);
            if (match && match[1]) return match[1];
        }
        return '';
    }

    function parseSuggestResults(htmlText) {
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');
        const anchors = Array.from(doc.querySelectorAll('a.match'));
        const results = [];
        const seen = new Set();
        for (const a of anchors) {
            let appid = a.getAttribute('data-ds-appid') || (a.dataset ? a.dataset.dsAppid : '') || '';
            appid = (appid.split(',')[0] || '').trim();
            if (!appid) {
                const href = a.getAttribute('href') || '';
                const m = href.match(/\/app\/(\d+)/);
                if (m) appid = m[1];
            }
            if (!appid || seen.has(appid)) continue;
            const nameEl = a.querySelector('.match_name');
            const name = (nameEl?.textContent || a.textContent || ('App ' + appid)).trim();
            results.push({ appid, name });
            seen.add(appid);
        }
        return results;
    }

    async function fetchSteamSearch(term) {
        const url = 'https://store.steampowered.com/search/suggest?term=' + encodeURIComponent(term) + '&f=games&cc=US&l=english&v=1';
        const res = await fetch(url, { credentials: 'omit' });
        if (!res.ok) throw new Error('Search failed: ' + res.status);
        const html = await res.text();
        return parseSuggestResults(html);
    }

    function getAppDetailsCache() {
        if (!window.__NoCommentAppDetailsCache) {
            window.__NoCommentAppDetailsCache = {};
        }
        return window.__NoCommentAppDetailsCache;
    }

    function getBundleLookupCache() {
        if (!window.__NoCommentBundleLookupCache) {
            window.__NoCommentBundleLookupCache = {};
        }
        return window.__NoCommentBundleLookupCache;
    }

    function normalizeAppIdList(values) {
        return Array.from(new Set((Array.isArray(values) ? values : []).map(function(v){ return String(v).trim(); }).filter(function(v){ return /^\d+$/.test(v); })));
    }

    async function primeAppDetailsCache(appids) {
        const ids = Array.from(new Set((appids || []).map(function(v){ return String(v).trim(); }))).filter(function(id){ return /^\d+$/.test(id); });
        if (!ids.length) return;
        const cache = getAppDetailsCache();
        const missing = ids.filter(function(id){ return !cache[id]; });
        if (!missing.length) return;

        const chunkSize = 40;
        for (let i = 0; i < missing.length; i += chunkSize) {
            const chunk = missing.slice(i, i + chunkSize);
            try {
                const url = 'https://store.steampowered.com/api/appdetails?appids=' + encodeURIComponent(chunk.join(',')) + '&l=english';
                const res = await fetch(url, { credentials: 'omit' });
                if (!res.ok) throw new Error('App batch lookup failed: ' + res.status);
                const data = await res.json();
                for (let j = 0; j < chunk.length; j++) {
                    const id = chunk[j];
                    const entry = data && data[id];
                    const fullgame = (entry && entry.success && entry.data && entry.data.fullgame) ? entry.data.fullgame : null;
                    const dlcAppids = normalizeAppIdList(entry && entry.success && entry.data && Array.isArray(entry.data.dlc) ? entry.data.dlc : []);
                    cache[id] = (entry && entry.success && entry.data) ? {
                        name: entry.data.name || '',
                        type: entry.data.type || '',
                        fullgameAppid: fullgame && fullgame.appid ? String(fullgame.appid) : '',
                        fullgameName: fullgame && fullgame.name ? String(fullgame.name) : '',
                        dlcAppids: dlcAppids,
                        success: true
                    } : { name: '', type: '', fullgameAppid: '', fullgameName: '', dlcAppids: [], success: false };
                }
            } catch(_) {
                for (let j = 0; j < chunk.length; j++) {
                    try { await fetchAppDetailsById(chunk[j]); } catch(_) {}
                }
            }
        }
    }

    async function fetchAppDetailsById(appid) {
        const cache = getAppDetailsCache();
        const key = String(appid);
        if (cache[key]) return cache[key];
        const url = 'https://store.steampowered.com/api/appdetails?appids=' + encodeURIComponent(appid) + '&l=english';
        const res = await fetch(url, { credentials: 'omit' });
        if (!res.ok) throw new Error('App lookup failed: ' + res.status);
        const data = await res.json();
        const entry = data && data[key];
        const fullgame = (entry && entry.success && entry.data && entry.data.fullgame) ? entry.data.fullgame : null;
        const dlcAppids = normalizeAppIdList(entry && entry.success && entry.data && Array.isArray(entry.data.dlc) ? entry.data.dlc : []);
        const details = (entry && entry.success && entry.data) ? {
            name: entry.data.name || '',
            type: entry.data.type || '',
            fullgameAppid: fullgame && fullgame.appid ? String(fullgame.appid) : '',
            fullgameName: fullgame && fullgame.name ? String(fullgame.name) : '',
            dlcAppids: dlcAppids,
            success: true
        } : { name: '', type: '', fullgameAppid: '', fullgameName: '', dlcAppids: [], success: false };
        cache[key] = details;
        return details;
    }

    async function fetchAppNameById(appid) {
        const details = await fetchAppDetailsById(appid);
        if (details && details.name) return details.name;
        return null;
    }

    async function fetchSteamGameName(appid) {
        if (!appid) return null;
        try {
            return await fetchAppNameById(appid);
        } catch(err) {
            backendLog('NoComment: fetchSteamGameName error for ' + appid + ': ' + err);
            return null;
        }
    }

    async function getDlcBaseGameInfo(appid) {
        try {
            const details = await fetchAppDetailsById(appid);
            const type = details && details.type ? String(details.type).toLowerCase() : '';
            if (type !== 'dlc') return null;
            const fullgameAppid = details && details.fullgameAppid ? String(details.fullgameAppid).trim() : '';
            if (!/^\d+$/.test(fullgameAppid)) return null;
            let fullgameName = details && details.fullgameName ? String(details.fullgameName) : '';
            if (!fullgameName) {
                fullgameName = await fetchSteamGameName(fullgameAppid) || '';
            }
            return {
                fullgameAppid: fullgameAppid,
                fullgameName: fullgameName
            };
        } catch(_) {
            return null;
        }
    }

    async function startAddViaNoCommentFlow(appid, options) {
        const parsedAppId = parseInt(appid, 10);
        if (isNaN(parsedAppId)) return false;
        if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
            return false;
        }

        const opts = (options && typeof options === 'object') ? options : {};
        const shouldShowOverlay = opts.showOverlay !== false;

        try {
            const dlcInfo = await getDlcBaseGameInfo(parsedAppId);
            if (dlcInfo && dlcInfo.fullgameAppid) {
                if (typeof showDlcWarning === 'function') {
                    showDlcWarning(parsedAppId, dlcInfo.fullgameAppid, dlcInfo.fullgameName);
                } else {
                    ShowNoCommentAlert('No-Comment', lt('DLCs are added together with the base game. To add fixes for this DLC, please go to the base game page: <br><br><b>{gameName}</b>').replace('{gameName}', dlcInfo.fullgameName || lt('Base Game')));
                }
                return false;
            }
        } catch(_) {}

        if (runState.inProgress && runState.appid === parsedAppId) {
            backendLog('NoComment: operation already in progress for this appid');
            return false;
        }

        if (shouldShowOverlay && !document.querySelector('.NoComment-overlay')) {
            showTestPopup();
        }

        runState.inProgress = true;
        runState.appid = parsedAppId;
        window.__NoCommentCurrentAppId = parsedAppId;

        try {
            Millennium.callServerMethod('No-Comment', 'StartAddViaNoComment', { appid: parsedAppId, contentScriptQuery: '' });
            startPolling(parsedAppId);
            return true;
        } catch(err) {
            backendLog('NoComment: start add flow error: ' + err);
            runState.inProgress = false;
            runState.appid = null;
            return false;
        }
    }

    function isSteamStoreHost() {
        const host = String(window.location.hostname || '').toLowerCase();
        return host === 'store.steampowered.com';
    }

    function getStoreAppIdFromPath() {
        if (!isSteamStoreHost()) return null;
        const pathname = String(window.location.pathname || '');
        const direct = pathname.match(/\/app\/(\d+)/i);
        if (direct) return parseInt(direct[1], 10);
        const agecheck = pathname.match(/\/agecheck\/app\/(\d+)/i);
        if (agecheck) return parseInt(agecheck[1], 10);
        return null;
    }

    function isStoreGamePage() {
        return getStoreAppIdFromPath() !== null;
    }

    function getCurrentAppId() {
        const appIdFromPath = getStoreAppIdFromPath();
        if (typeof appIdFromPath === 'number' && !isNaN(appIdFromPath)) {
            return appIdFromPath;
        }
        if (!isSteamStoreHost()) return null;
        const pathname = String(window.location.pathname || '');
        if (!/\/app\//i.test(pathname) && !/\/agecheck\/app\//i.test(pathname)) return null;
        const d = document.querySelector('[data-appid]');
        if (d) {
            const parsed = parseInt(d.getAttribute('data-appid'), 10);
            if (!isNaN(parsed)) return parsed;
        }
        return null;
    }

    function getBundlePageId() {
        if (!isSteamStoreHost()) return null;
        const pathname = String(window.location.pathname || '');
        const direct = pathname.match(/\/bundle\/(\d+)/i);
        if (direct) return direct[1];
        const agecheck = pathname.match(/\/agecheck\/bundle\/(\d+)/i);
        if (agecheck) return agecheck[1];
        return null;
    }

    function isBundlePage() {
        return !!getBundlePageId();
    }

    async function fetchBundlePayloadById(bundleId) {
        const key = String(bundleId || '').trim();
        if (!/^\d+$/.test(key)) return null;
        const cache = getBundleLookupCache();
        if (cache[key] && cache[key].payload) return cache[key].payload;

        const url = 'https://store.steampowered.com/actions/ajaxresolvebundles?bundleids=' + encodeURIComponent(key) + '&cc=us&l=english';
        const res = await fetch(url, { credentials: 'omit' });
        if (!res.ok) throw new Error('Bundle lookup failed: ' + res.status);
        const data = await res.json();
        const payload = Array.isArray(data) && data.length ? data[0] : null;
        cache[key] = { payload: payload || null, fetchedAt: Date.now() };
        return payload || null;
    }

    async function fetchBundleAppIdsById(bundleId) {
        try {
            const payload = await fetchBundlePayloadById(bundleId);
            const values = payload && Array.isArray(payload.appids) ? payload.appids : [];
            return Array.from(new Set(values.map(function(v){ return String(v).trim(); }).filter(function(v){ return /^\d+$/.test(v); })));
        } catch(_) {
            return [];
        }
    }

    function getBundleRoot() {
        return document.querySelector('.bundle_page') ||
            document.querySelector('.bundle_page_wrapper') ||
            document.querySelector('.bundle_page_inner') ||
            document.querySelector('.bundle_purchase_area') ||
            document.querySelector('.bundle_items') ||
            document.querySelector('.bundle_package_list') ||
            document.querySelector('.bundle_purchase_section') ||
            document.body;
    }

    function extractAppIdFromHref(href) {
        if (!href) return null;
        const m = String(href).match(/\/app\/(\d+)/);
        if (m) return m[1];
        return null;
    }

    function getBundleAppIds() {
        if (!isBundlePage()) return [];
        const root = getBundleRoot();
        const ids = new Set();

        const bundleNodes = root ? root.querySelectorAll('[data-ds-bundle-data]') : [];
        for (let i = 0; i < bundleNodes.length; i++) {
            const raw = bundleNodes[i].getAttribute('data-ds-bundle-data');
            if (!raw) continue;
            let payload = null;
            try {
                payload = JSON.parse(raw);
            } catch(_) {
                try {
                    payload = JSON.parse(raw.replace(/&quot;/g, '"'));
                } catch(_) {
                    payload = null;
                }
            }
            const items = payload && Array.isArray(payload.m_rgItems) ? payload.m_rgItems : [];
            for (let j = 0; j < items.length; j++) {
                const included = items[j] && Array.isArray(items[j].m_rgIncludedAppIDs) ? items[j].m_rgIncludedAppIDs : [];
                for (let k = 0; k < included.length; k++) {
                    const id = String(included[k]).trim();
                    if (/^\d+$/.test(id)) ids.add(id);
                }
            }
        }

        const nodes = root ? root.querySelectorAll('.bundle_package_item [data-ds-appid], .bundle_package_item [data-appid], .bundle_package_item [data-ds-itemkey], [data-ds-bundleid] [data-ds-appid], [data-ds-bundleid] [data-appid], [data-ds-bundleid] [data-ds-itemkey]') : [];
        for (let i = 0; i < nodes.length; i++) {
            const el = nodes[i];
            const raw = (el.getAttribute('data-ds-appid') || el.getAttribute('data-appid') || '').split(',')[0].trim();
            if (/^\d+$/.test(raw)) ids.add(raw);
            const itemKey = (el.getAttribute('data-ds-itemkey') || '').trim();
            const keyMatch = itemKey.match(/^App_(\d+)$/i);
            if (keyMatch) ids.add(keyMatch[1]);
        }

        const links = root ? root.querySelectorAll('.bundle_package_item a[href*="/app/"], [data-ds-bundleid] a[href*="/app/"]') : [];
        for (let i = 0; i < links.length; i++) {
            const id = extractAppIdFromHref(links[i].getAttribute('href'));
            if (id && /^\d+$/.test(id)) ids.add(id);
        }
        return Array.from(ids);
    }

    async function getBundleCandidateAppIds() {
        if (!isBundlePage()) return [];
        const bundleId = getBundlePageId();
        let ids = [];
        if (bundleId) {
            ids = await fetchBundleAppIdsById(bundleId);
        }
        if (!ids.length) {
            ids = getBundleAppIds();
        }
        return Array.from(new Set(ids.map(function(v){ return String(v).trim(); }).filter(function(v){ return /^\d+$/.test(v); })));
    }

    async function getBundleBaseGameApps(rawIds) {
        const uniqueIds = Array.from(new Set(rawIds || [])).filter(function(id){ return /^\d+$/.test(String(id)); }).map(function(id){ return String(id); });
        if (!uniqueIds.length) return [];
        await primeAppDetailsCache(uniqueIds);
        const games = [];
        for (let i = 0; i < uniqueIds.length; i++) {
            const appid = uniqueIds[i];
            try {
                const details = await fetchAppDetailsById(appid);
                const type = details && details.type ? String(details.type).toLowerCase() : '';
                if (type !== 'game') {
                    continue;
                }
                const name = (details && details.name) ? details.name : ('App ' + appid);
                games.push({ appid: appid, name: name });
            } catch(_) {}
        }
        return games;
    }

    async function hasNoCommentForApp(appid) {
        try {
            if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                return false;
            }
            const res = await Millennium.callServerMethod('No-Comment', 'HasNoCommentForApp', { appid, contentScriptQuery: '' });
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            return !!(payload && payload.success && payload.exists === true);
        } catch(_) {
            return false;
        }
    }

    function collectOwnedSteamAppIds() {
        const owned = new Set();

        function addId(value) {
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed) && parsed > 0) owned.add(String(parsed));
        }

        function addFromMaybeArrayOrMap(raw) {
            if (!raw) return;
            if (Array.isArray(raw)) {
                for (let i = 0; i < raw.length; i++) addId(raw[i]);
                return;
            }
            if (typeof raw === 'object') {
                Object.keys(raw).forEach(function(key) {
                    const val = raw[key];
                    if (val === true || val === 1 || val === '1') addId(key);
                    if (typeof val === 'number' || /^\d+$/.test(String(val))) addId(val);
                });
            }
        }

        try {
            if (typeof window !== 'undefined') {
                addFromMaybeArrayOrMap(window.g_rgOwnedApps);
                addFromMaybeArrayOrMap(window.g_rgOwnedAppsByAccount);
                if (window.GDynamicStore) {
                    addFromMaybeArrayOrMap(window.GDynamicStore.s_rgOwnedApps);
                    addFromMaybeArrayOrMap(window.GDynamicStore.rgOwnedApps);
                    if (typeof window.GDynamicStore.GetOwnedApps === 'function') {
                        addFromMaybeArrayOrMap(window.GDynamicStore.GetOwnedApps());
                    }
                }
            }
        } catch(_) {}

        try {
            const currentApp = getCurrentAppId();
            const ownBanner = document.querySelector('#game_area_already_owned, .game_area_already_owned');
            if (ownBanner && currentApp) {
                owned.add(String(currentApp));
            }
        } catch(_) {}

        try {
            const rows = document.querySelectorAll('.game_area_dlc_row, [data-ds-appid], [data-appid]');
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                let appid = (row.getAttribute('data-ds-appid') || row.getAttribute('data-appid') || '').split(',')[0].trim();
                if (!appid) {
                    const hrefNode = row.matches('a[href*="/app/"]') ? row : row.querySelector('a[href*="/app/"]');
                    const href = hrefNode ? hrefNode.getAttribute('href') : '';
                    const match = href ? String(href).match(/\/app\/(\d+)/i) : null;
                    appid = match ? match[1] : '';
                }
                if (!/^\d+$/.test(appid)) continue;
                const cls = String(row.className || '').toLowerCase();
                const hasOwnedClass = (cls.includes('owned') || cls.includes('in_library') || cls.includes('inlibrary')) && row.getAttribute('data-NoComment-ds-owned') !== '1';
                const hasOwnedNode = !!row.querySelector('.ds_owned_flag:not([data-NoComment-search-owned="1"]), .in_library_flag, .game_area_dlc_owned, .owned');
                if (hasOwnedClass || hasOwnedNode) owned.add(appid);
            }
        } catch(_) {}

        return owned;
    }

    function isAppOwnedOnSteam(appid) {
        const parsed = parseInt(appid, 10);
        if (isNaN(parsed)) return false;
        const owned = collectOwnedSteamAppIds();
        return owned.has(String(parsed));
    }

    function classifyRelatedContent(details, name) {
        const type = details && details.type ? String(details.type).toLowerCase() : '';
        if (type && type !== 'dlc') {
            return 'special';
        }

        const txt = String(name || '').toLowerCase();
        const specialMarkers = [
            'soundtrack',
            'ost',
            'artbook',
            'wallpaper',
            'digital',
            'cosmetic',
            'skin',
            'avatar',
            'emote',
            'booster',
            'profile',
            'twitch',
            'twitch drop',
            'twitch pack',
            'drop'
        ];
        for (let i = 0; i < specialMarkers.length; i++) {
            if (txt.includes(specialMarkers[i])) return 'special';
        }
        return 'dlc';
    }

    function getInstalledLuaScriptsCache() {
        if (!window.__NoCommentInstalledLuaScriptsCache) {
            window.__NoCommentInstalledLuaScriptsCache = { fetchedAt: 0, entries: [] };
        }
        return window.__NoCommentInstalledLuaScriptsCache;
    }

    const INSTALLED_LUA_IDS_SNAPSHOT_KEY = 'NoComment.installedLuaIdsSnapshot.v1';
    const INSTALLED_LUA_IDS_SNAPSHOT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

    function buildInstalledLuaIdSet(entries) {
        const ids = new Set();
        const source = Array.isArray(entries) ? entries : [];
        for (let i = 0; i < source.length; i++) {
            const entry = source[i] || {};
            const appid = String(entry.appid || '').trim();
            if (/^\d+$/.test(appid)) ids.add(appid);
            const added = normalizeAppIdList(Array.isArray(entry.addedAppIds) ? entry.addedAppIds : []);
            for (let j = 0; j < added.length; j++) {
                ids.add(String(added[j]));
            }
        }
        return ids;
    }

    function readInstalledLuaIdSnapshotSet() {
        try {
            const raw = localStorage.getItem(INSTALLED_LUA_IDS_SNAPSHOT_KEY);
            if (!raw) return new Set();
            const payload = JSON.parse(raw);
            const ts = Number(payload && payload.ts ? payload.ts : 0);
            if (!ts || (Date.now() - ts) > INSTALLED_LUA_IDS_SNAPSHOT_MAX_AGE_MS) {
                return new Set();
            }
            const ids = normalizeAppIdList(Array.isArray(payload && payload.ids) ? payload.ids : []);
            return new Set(ids.map(function(v){ return String(v); }));
        } catch(_) {
            return new Set();
        }
    }

    function writeInstalledLuaIdSnapshotSet(idsSet) {
        try {
            const ids = Array.from(idsSet || [])
                .map(function(v){ return String(v).trim(); })
                .filter(function(v){ return /^\d+$/.test(v); })
                .slice(0, 5000);
            localStorage.setItem(INSTALLED_LUA_IDS_SNAPSHOT_KEY, JSON.stringify({
                ts: Date.now(),
                ids: ids
            }));
        } catch(_) {}
    }

    function writeInstalledLuaIdSnapshotEntries(entries) {
        writeInstalledLuaIdSnapshotSet(buildInstalledLuaIdSet(entries));
    }

    function cloneInstalledLuaEntries(entries) {
        const source = Array.isArray(entries) ? entries : [];
        return source.map(function(entry) {
            const e = entry || {};
            return {
                appid: String(e.appid || '').trim(),
                name: String(e.name || '').trim(),
                addedAppIds: normalizeAppIdList(Array.isArray(e.addedAppIds) ? e.addedAppIds : [])
            };
        });
    }

    function invalidateInstalledLuaScriptsCache() {
        const cache = getInstalledLuaScriptsCache();
        cache.fetchedAt = 0;
    }

    async function getInstalledLuaScriptEntries(forceRefresh) {
        try {
            const cache = getInstalledLuaScriptsCache();
            const now = Date.now();
            const cacheTtlMs = 5 * 60 * 1000;
            if (!forceRefresh && Array.isArray(cache.entries) && (now - Number(cache.fetchedAt || 0) < cacheTtlMs)) {
                writeInstalledLuaIdSnapshotEntries(cache.entries);
                return cloneInstalledLuaEntries(cache.entries);
            }
            if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                return [];
            }
            const res = await Millennium.callServerMethod('No-Comment', 'GetInstalledLuaScripts', { contentScriptQuery: '' });
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            const scripts = payload && payload.success && Array.isArray(payload.scripts) ? payload.scripts : [];
            const map = {};
            for (let i = 0; i < scripts.length; i++) {
                const script = scripts[i] || {};
                const id = String(script.appid || '').trim();
                if (!/^\d+$/.test(id)) continue;
                if (!map[id]) {
                    map[id] = {
                        appid: id,
                        name: String(script.gameName || script.filename || ('App ' + id)).trim(),
                        addedAppIds: []
                    };
                }
                const parsedAdded = normalizeAppIdList(Array.isArray(script.addedAppIds) ? script.addedAppIds : []);
                if (parsedAdded.length) {
                    map[id].addedAppIds = normalizeAppIdList(map[id].addedAppIds.concat(parsedAdded));
                }
            }
            const entries = Object.keys(map).map(function(id){ return map[id]; });
            cache.entries = cloneInstalledLuaEntries(entries);
            cache.fetchedAt = now;
            writeInstalledLuaIdSnapshotEntries(cache.entries);
            return cloneInstalledLuaEntries(entries);
        } catch(_) {
            return [];
        }
    }

    async function getInstalledLuaAppIds() {
        const entries = await getInstalledLuaScriptEntries();
        return normalizeAppIdList(entries.map(function(entry){ return entry && entry.appid; }));
    }

    async function fetchExtraInstalledRelatedEntries(baseAppid, baseName, knownIdsSet, installedEntries) {
        const base = String(parseInt(baseAppid, 10));
        if (!/^\d+$/.test(base)) return [];

        const availableEntries = Array.isArray(installedEntries) ? installedEntries : await getInstalledLuaScriptEntries();
        if (!availableEntries.length) return [];

        const candidates = availableEntries.filter(function(entry) {
            const id = String(entry && entry.appid ? entry.appid : '');
            return /^\d+$/.test(id) && id !== base && !(knownIdsSet && knownIdsSet.has(id));
        });
        if (!candidates.length) return [];

        const baseNameNorm = String(baseName || '').trim().toLowerCase();
        const basePrefix = baseNameNorm ? (baseNameNorm + ' - ') : '';
        const pairs = [];
        const unresolved = [];
        for (let i = 0; i < candidates.length; i++) {
            const entry = candidates[i];
            const id = String(entry.appid);
            const hintedName = String(entry.name || '').trim();
            const hintedNorm = hintedName.toLowerCase();
            const inferredByName = !!(basePrefix && hintedNorm.startsWith(basePrefix));
            if (inferredByName) {
                pairs.push({ appid: id, details: null, installedLua: true, nameHint: hintedName });
            } else {
                unresolved.push({ appid: id, nameHint: hintedName });
            }
        }

        if (!unresolved.length) return pairs;

        try {
            const unresolvedIds = unresolved.map(function(entry){ return String(entry.appid); });
            await primeAppDetailsCache(unresolvedIds);
            const detailsCache = getAppDetailsCache();
            for (let i = 0; i < unresolved.length; i++) {
                const entry = unresolved[i];
                const id = String(entry.appid);
                const details = detailsCache[id] || null;
                const parent = details && details.fullgameAppid ? String(details.fullgameAppid).trim() : '';
                if (parent === base) {
                    pairs.push({ appid: id, details: details, installedLua: true, nameHint: entry.nameHint || '' });
                }
            }
        } catch(_) {}

        return pairs;
    }

    function getStoreRelatedContentCache() {
        if (!window.__NoCommentStoreRelatedContentCache) {
            window.__NoCommentStoreRelatedContentCache = {};
        }
        return window.__NoCommentStoreRelatedContentCache;
    }

    function getSteamDbRelatedContentCache() {
        if (!window.__NoCommentSteamDbRelatedContentCache) {
            window.__NoCommentSteamDbRelatedContentCache = {};
        }
        return window.__NoCommentSteamDbRelatedContentCache;
    }

    function getApiRelatedContentCache() {
        if (!window.__NoCommentApiRelatedContentCache) {
            window.__NoCommentApiRelatedContentCache = {};
        }
        return window.__NoCommentApiRelatedContentCache;
    }

    async function fetchStoreRelatedEntries(baseAppid) {
        const base = String(parseInt(baseAppid, 10));
        if (!/^\d+$/.test(base)) return [];
        const cache = getStoreRelatedContentCache();
        if (Array.isArray(cache[base])) return cache[base];

        try {
            const url = 'https://store.steampowered.com/dlc/' + encodeURIComponent(base) + '/?l=english';
            const res = await fetch(url, { credentials: 'omit' });
            if (!res.ok) throw new Error('Store related lookup failed: ' + res.status);
            const html = await res.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');

            const byId = {};
            const rows = doc.querySelectorAll('.game_area_dlc_row, .tab_item, [data-ds-appid], [data-appid]');
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                let appid = (row.getAttribute('data-ds-appid') || row.getAttribute('data-appid') || '').split(',')[0].trim();
                if (!/^\d+$/.test(appid)) {
                    const hrefNode = row.matches('a[href*="/app/"]') ? row : row.querySelector('a[href*="/app/"]');
                    const href = hrefNode ? hrefNode.getAttribute('href') : '';
                    const match = href ? String(href).match(/\/app\/(\d+)/i) : null;
                    appid = match ? match[1] : '';
                }
                if (!/^\d+$/.test(appid) || appid === base) continue;

                const nameNode = row.querySelector('.tab_item_name, .game_area_dlc_name, .name, h4, .title') || row;
                const name = String((nameNode && nameNode.textContent) || '').replace(/\s+/g, ' ').trim();
                byId[appid] = byId[appid] || { appid: appid, name: name || ('App ' + appid) };
            }

            const values = Object.keys(byId).map(function(id){ return byId[id]; });
            cache[base] = values;
            return values;
        } catch(_) {
            cache[base] = [];
            return [];
        }
    }

    async function fetchSteamDbRelatedEntries(baseAppid) {
        const base = String(parseInt(baseAppid, 10));
        if (!/^\d+$/.test(base)) return [];
        const cache = getSteamDbRelatedContentCache();
        const cached = cache[base];
        const now = Date.now();
        const ttlMs = 10 * 60 * 1000;
        if (cached && Array.isArray(cached.entries) && (now - Number(cached.fetchedAt || 0) < ttlMs)) {
            return cached.entries;
        }

        try {
            if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                cache[base] = { fetchedAt: now, entries: [] };
                return [];
            }

            const res = await Millennium.callServerMethod('No-Comment', 'GetSteamDbRelatedEntries', {
                appid: parseInt(base, 10),
                contentScriptQuery: ''
            });
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            const rawEntries = (payload && Array.isArray(payload.entries)) ? payload.entries : [];
            const byId = {};
            for (let i = 0; i < rawEntries.length; i++) {
                const entry = rawEntries[i] || {};
                const id = String(entry.appid || '').trim();
                if (!/^\d+$/.test(id) || id === base) continue;
                const name = String(entry.name || ('App ' + id)).replace(/\s+/g, ' ').trim();
                byId[id] = byId[id] || { appid: id, name: name || ('App ' + id) };
            }
            const values = Object.keys(byId).map(function(id){ return byId[id]; });
            if (values.length > 0) {
                cache[base] = { fetchedAt: now, entries: values };
            } else {
                delete cache[base];
            }
            return values;
        } catch(_) {
            delete cache[base];
            return [];
        }
    }

    async function fetchApiRelatedEntries(baseAppid) {
        const base = String(parseInt(baseAppid, 10));
        if (!/^\d+$/.test(base)) return [];
        const cache = getApiRelatedContentCache();
        const cached = cache[base];
        const now = Date.now();
        const ttlMs = 10 * 60 * 1000;
        if (cached && Array.isArray(cached.entries) && (now - Number(cached.fetchedAt || 0) < ttlMs)) {
            return cached.entries;
        }

        try {
            if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                cache[base] = { fetchedAt: now, entries: [] };
                return [];
            }
            const res = await Millennium.callServerMethod('No-Comment', 'GetApiRelatedEntries', {
                appid: parseInt(base, 10),
                contentScriptQuery: ''
            });
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            const rawEntries = (payload && Array.isArray(payload.entries)) ? payload.entries : [];
            const byId = {};
            for (let i = 0; i < rawEntries.length; i++) {
                const entry = rawEntries[i] || {};
                const id = String(entry.appid || '').trim();
                if (!/^\d+$/.test(id) || id === base) continue;
                const name = String(entry.name || ('App ' + id)).replace(/\s+/g, ' ').trim();
                byId[id] = byId[id] || { appid: id, name: name || ('App ' + id) };
            }
            const values = Object.keys(byId).map(function(id){ return byId[id]; });
            if (values.length > 0) {
                cache[base] = { fetchedAt: now, entries: values };
            } else {
                delete cache[base];
            }
            return values;
        } catch(_) {
            delete cache[base];
            return [];
        }
    }

    function getDlcAppIdsFromDetails(details) {
        return normalizeAppIdList(details && Array.isArray(details.dlcAppids) ? details.dlcAppids : []);
    }

    async function fetchGameDlcEntries(appid) {
        const parsed = parseInt(appid, 10);
        if (isNaN(parsed)) {
            return { appType: '', baseName: '', baseHasLua: false, items: [] };
        }

        const details = await fetchAppDetailsById(parsed);
        const appType = details && details.type ? String(details.type).toLowerCase() : '';
        const baseName = (details && details.name) ? String(details.name) : ('App ' + parsed);
        const dlcIds = getDlcAppIdsFromDetails(details);
        const dlcIdSet = new Set(dlcIds);
        const lookups = await Promise.all([
            fetchStoreRelatedEntries(parsed),
            getInstalledLuaScriptEntries(false),
            fetchSteamDbRelatedEntries(parsed),
            fetchApiRelatedEntries(parsed)
        ]);
        const storeEntries = Array.isArray(lookups[0]) ? lookups[0] : [];
        const storeIds = normalizeAppIdList(storeEntries.map(function(entry){ return entry && entry.appid; }));
        const installedEntries = Array.isArray(lookups[1]) ? lookups[1] : [];
        const steamDbEntries = Array.isArray(lookups[2]) ? lookups[2] : [];
        const steamDbIds = normalizeAppIdList(steamDbEntries.map(function(entry){ return entry && entry.appid; }));
        const apiEntries = Array.isArray(lookups[3]) ? lookups[3] : [];
        const apiIds = normalizeAppIdList(apiEntries.map(function(entry){ return entry && entry.appid; }));
        const apiIdSet = new Set(apiIds);
        const steamDbIdSet = new Set(steamDbIds);
        const installedScriptMap = {};
        for (let e = 0; e < installedEntries.length; e++) {
            const entry = installedEntries[e] || {};
            const id = String(entry.appid || '').trim();
            if (!/^\d+$/.test(id)) continue;
            if (!installedScriptMap[id]) {
                installedScriptMap[id] = {
                    appid: id,
                    name: String(entry.name || ('App ' + id)).trim(),
                    addedAppIds: []
                };
            }
            const parsedAdded = normalizeAppIdList(Array.isArray(entry.addedAppIds) ? entry.addedAppIds : []);
            if (parsedAdded.length) {
                installedScriptMap[id].addedAppIds = normalizeAppIdList(installedScriptMap[id].addedAppIds.concat(parsedAdded));
            }
        }

        const baseKey = String(parsed);
        const baseScriptEntry = installedScriptMap[baseKey] || null;
        const baseHasLua = !!baseScriptEntry;
        const baseScriptAddedIds = normalizeAppIdList(
            (baseScriptEntry && Array.isArray(baseScriptEntry.addedAppIds)) ? baseScriptEntry.addedAppIds : []
        ).filter(function(id){ return id !== baseKey; });
        const baseScriptAddedSet = new Set(baseScriptAddedIds);

        const relatedIds = normalizeAppIdList(dlcIds.concat(storeIds).concat(steamDbIds).concat(apiIds).concat(baseScriptAddedIds));
        if (appType !== 'game' || !relatedIds.length) {
            return { appType: appType, baseName: baseName, baseHasLua: baseHasLua, items: [] };
        }

        await primeAppDetailsCache(relatedIds);
        const installedLuaMap = {};
        Object.keys(installedScriptMap).forEach(function(id) {
            installedLuaMap[id] = true;
        });

        const detailsCache = getAppDetailsCache();
        const detailPairs = relatedIds.map(function(id) {
            return { appid: id, details: detailsCache[id] || null };
        });
        const knownSet = new Set(relatedIds);
        const extraPairs = baseHasLua
            ? []
            : await fetchExtraInstalledRelatedEntries(parsed, baseName, knownSet, installedEntries);
        const allPairs = detailPairs.concat(extraPairs);

        const pairById = {};
        for (let p = 0; p < allPairs.length; p++) {
            const pair = allPairs[p] || {};
            const id = String(pair.appid || '').trim();
            if (!/^\d+$/.test(id)) continue;
            if (!pairById[id]) {
                pairById[id] = { appid: id, details: null, installedLua: false, nameHint: '' };
            }
            if (!pairById[id].details && pair.details) {
                pairById[id].details = pair.details;
            }
            if (pair.installedLua) {
                pairById[id].installedLua = true;
            }
            if (!pairById[id].nameHint && pair.nameHint) {
                pairById[id].nameHint = String(pair.nameHint).trim();
            }
        }
        for (let r = 0; r < relatedIds.length; r++) {
            const id = String(relatedIds[r] || '').trim();
            if (!/^\d+$/.test(id)) continue;
            if (!pairById[id]) {
                pairById[id] = { appid: id, details: null, installedLua: false, nameHint: '' };
            }
        }

        const ownedSet = collectOwnedSteamAppIds();
        const storeNameById = {};
        for (let s = 0; s < storeEntries.length; s++) {
            const entry = storeEntries[s];
            if (entry && /^\d+$/.test(String(entry.appid || ''))) {
                storeNameById[String(entry.appid)] = String(entry.name || '').trim();
            }
        }
        for (let s = 0; s < steamDbEntries.length; s++) {
            const entry = steamDbEntries[s];
            if (entry && /^\d+$/.test(String(entry.appid || ''))) {
                const id = String(entry.appid);
                const name = String(entry.name || '').trim();
                if (!storeNameById[id] || storeNameById[id].startsWith('App ')) {
                    storeNameById[id] = name || storeNameById[id] || ('App ' + id);
                }
            }
        }
        for (let s = 0; s < apiEntries.length; s++) {
            const entry = apiEntries[s];
            if (entry && /^\d+$/.test(String(entry.appid || ''))) {
                const id = String(entry.appid);
                const name = String(entry.name || '').trim();
                if (!storeNameById[id] || storeNameById[id].startsWith('App ')) {
                    storeNameById[id] = name || storeNameById[id] || ('App ' + id);
                }
            }
        }

        const items = Object.keys(pairById).map(function(id) {
            const pair = pairById[id];
            const appDetails = pair.details;
            const fallbackName = storeNameById[String(pair.appid)] || '';
            const hintedName = String(pair && pair.nameHint ? pair.nameHint : '').trim();
            const name = (appDetails && appDetails.name) ? String(appDetails.name) : (hintedName || fallbackName || ('App ' + pair.appid));
            const installedLua = !!(pair.installedLua || installedLuaMap[pair.appid]);
            const inheritedByBase = !!(baseHasLua && baseScriptAddedSet.has(String(pair.appid)) && !installedLua);
            const ownedOnSteam = ownedSet.has(String(pair.appid));
            const contentType = appDetails && appDetails.type ? String(appDetails.type) : '';
            let category = classifyRelatedContent(appDetails, name);
            if (category === 'dlc' && baseScriptAddedSet.has(String(pair.appid)) && !dlcIdSet.has(String(pair.appid))) {
                const contentTypeNorm = String(contentType || '').toLowerCase();
                if (!appDetails || contentTypeNorm !== 'dlc') {
                    category = 'special';
                }
            }
            if (category === 'dlc' && (apiIdSet.has(String(pair.appid)) || steamDbIdSet.has(String(pair.appid))) && !dlcIdSet.has(String(pair.appid))) {
                const contentTypeNorm = String(contentType || '').toLowerCase();
                if (!appDetails || contentTypeNorm !== 'dlc') {
                    category = 'special';
                }
            }
            return {
                appid: pair.appid,
                name: name,
                installedLua: installedLua,
                inheritedByBase: inheritedByBase,
                baseScriptIncluded: baseScriptAddedSet.has(String(pair.appid)),
                ownedOnSteam: ownedOnSteam,
                category: category,
                contentType: contentType
            };
        }).sort(function(a, b) {
            return String(a.name || '').localeCompare(String(b.name || ''));
        });

        return { appType: appType, baseName: baseName, baseHasLua: baseHasLua, items: items };
    }

    async function addNoCommentForAppAndWait(appid, options) {
        const parsed = parseInt(appid, 10);
        if (isNaN(parsed)) {
            return { success: false, error: lt('Invalid app id.') };
        }
        if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
            return { success: false, error: lt('NoComment backend is unavailable.') };
        }

        const opts = (options && typeof options === 'object') ? options : {};
        const parsedBase = parseInt(opts.baseAppid, 10);
        const baseAppid = isNaN(parsedBase) ? 0 : parsedBase;
        const baseOwnedOnSteam = !!opts.baseOwnedOnSteam;

        try {
            await Millennium.callServerMethod('No-Comment', 'StartAddViaNoComment', {
                appid: parsed,
                baseAppid: baseAppid,
                baseOwnedOnSteam: baseOwnedOnSteam,
                contentScriptQuery: ''
            });
            const result = await waitForAddCompletion(parsed, null);
            if (result && result.status === 'done') {
                invalidateInstalledLuaScriptsCache();
                return { success: true };
            }
            const err = (result && result.error) ? String(result.error) : lt('Failed');
            return { success: false, error: err };
        } catch(err) {
            return { success: false, error: (err && err.message) ? err.message : lt('Failed') };
        }
    }

    async function removeNoCommentForAppById(appid) {
        const parsed = parseInt(appid, 10);
        if (isNaN(parsed)) {
            return { success: false, error: lt('Invalid app id.') };
        }
        if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
            return { success: false, error: lt('NoComment backend is unavailable.') };
        }

        try {
            const res = await Millennium.callServerMethod('No-Comment', 'DeleteNoCommentForApp', { appid: parsed, contentScriptQuery: '' });
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            if (payload && payload.success) {
                invalidateInstalledLuaScriptsCache();
                return { success: true };
            }
            return { success: false, error: (payload && payload.error) ? String(payload.error) : lt('Failed to remove NoComment.') };
        } catch(err) {
            return { success: false, error: (err && err.message) ? err.message : lt('Failed to remove NoComment.') };
        }
    }

    function setPseudoDisabled(el, disabled) {
        if (!el) return;
        if (disabled) {
            el.dataset.disabled = '1';
            el.style.pointerEvents = 'none';
            el.style.opacity = '0.55';
        } else {
            delete el.dataset.disabled;
            el.style.pointerEvents = '';
            el.style.opacity = '';
        }
    }

    function removeStoreDlcManageButton() {
        document.querySelectorAll('.NoComment-store-dlc-button-container').forEach(function(btn) {
            try { btn.remove(); } catch(_) {}
        });
    }

    function showStoreDlcManager(appId) {
        closeSettingsOverlay();
        if (document.querySelector('.NoComment-dlc-manager-overlay')) return;

        const parsedAppId = parseInt(appId, 10);
        if (isNaN(parsedAppId)) return;

        ensureNoCommentStyles();
        ensureFontAwesome();

        const overlay = document.createElement('div');
        overlay.className = 'NoComment-dlc-manager-overlay NoComment-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.78);backdrop-filter:blur(8px);z-index:100001;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(160deg, #2b2f36 0%, #1f2329 100%);color:#e9edf2;border:1px solid rgba(170,170,170,0.35);border-radius:12px;width:760px;max-width:calc(100vw - 32px);padding:20px 22px;box-shadow:0 22px 60px rgba(0,0,0,.75), inset 0 1px 0 rgba(255,255,255,0.04);';

        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size:24px;font-weight:800;text-align:center;color:#f0f3f6;letter-spacing:0.2px;';
        titleEl.textContent = lt('NoComment · DLC Manager');

        const subTitleEl = document.createElement('div');
        subTitleEl.style.cssText = 'font-size:13px;color:#c6d0dc;text-align:center;margin-top:6px;margin-bottom:12px;';
        subTitleEl.textContent = '';

        const statusEl = document.createElement('div');
        statusEl.style.cssText = 'font-size:13px;color:#b9c4d1;text-align:center;margin-bottom:12px;min-height:18px;';

        const tabsRow = document.createElement('div');
        tabsRow.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;';

        const dlcTabBtn = document.createElement('a');
        dlcTabBtn.href = '#';
        dlcTabBtn.style.cssText = 'min-width:140px;text-align:center;padding:8px 12px;border-radius:10px;border:1px solid rgba(175,175,175,0.45);background:rgba(68,68,68,0.85);color:#e4e4e4;text-decoration:none;font-size:12px;font-weight:700;';
        dlcTabBtn.textContent = lt('DLCs');

        const specialTabBtn = document.createElement('a');
        specialTabBtn.href = '#';
        specialTabBtn.style.cssText = 'min-width:170px;text-align:center;padding:8px 12px;border-radius:10px;border:1px solid rgba(175,175,175,0.45);background:rgba(68,68,68,0.85);color:#e4e4e4;text-decoration:none;font-size:12px;font-weight:700;';
        specialTabBtn.textContent = lt('Special Content');

        tabsRow.appendChild(dlcTabBtn);
        tabsRow.appendChild(specialTabBtn);

        const controlsRow = document.createElement('div');
        controlsRow.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:12px;';

        const addAllBtn = document.createElement('a');
        addAllBtn.href = '#';
        addAllBtn.className = '';
        addAllBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;min-width:220px;text-align:center;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;background:linear-gradient(135deg, rgba(150,150,150,0.78), rgba(95,95,95,0.98));border:1px solid rgba(210,210,210,0.55);color:#f4f4f4;';
        addAllBtn.innerHTML = `<span>${lt('Add All Missing DLCs')}</span>`;

        const addSelectedBtn = document.createElement('a');
        addSelectedBtn.href = '#';
        addSelectedBtn.className = '';
        addSelectedBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;min-width:180px;text-align:center;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;background:linear-gradient(135deg, rgba(136,136,136,0.72), rgba(90,90,90,0.92));border:1px solid rgba(200,200,200,0.5);color:#f0f0f0;';
        addSelectedBtn.innerHTML = `<span>${lt('Add Selected')}</span>`;

        const clearSelectedBtn = document.createElement('a');
        clearSelectedBtn.href = '#';
        clearSelectedBtn.className = '';
        clearSelectedBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;min-width:130px;text-align:center;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;background:rgba(74,74,74,0.82);border:1px solid rgba(170,170,170,0.45);color:#e3e3e3;';
        clearSelectedBtn.innerHTML = `<span>${lt('Clear Selected')}</span>`;

        const refreshBtn = document.createElement('a');
        refreshBtn.href = '#';
        refreshBtn.className = '';
        refreshBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;min-width:120px;text-align:center;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;background:rgba(78,78,78,0.82);border:1px solid rgba(175,175,175,0.45);color:#e6e6e6;';
        refreshBtn.innerHTML = `<span>${lt('Refresh')}</span>`;

        const closeBtn = document.createElement('a');
        closeBtn.href = '#';
        closeBtn.className = '';
        closeBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;min-width:110px;text-align:center;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;background:rgba(68,68,68,0.85);border:1px solid rgba(170,170,170,0.45);color:#e4e4e4;';
        closeBtn.innerHTML = `<span>${lt('Close')}</span>`;

        controlsRow.appendChild(addAllBtn);
        controlsRow.appendChild(addSelectedBtn);
        controlsRow.appendChild(clearSelectedBtn);
        controlsRow.appendChild(refreshBtn);
        controlsRow.appendChild(closeBtn);

        const listWrap = document.createElement('div');
        listWrap.style.cssText = 'max-height:52vh;overflow:auto;border:1px solid rgba(170,170,170,0.25);border-radius:12px;background:rgba(12,14,18,0.45);padding:10px;';

        modal.appendChild(titleEl);
        modal.appendChild(subTitleEl);
        modal.appendChild(statusEl);
        modal.appendChild(tabsRow);
        modal.appendChild(controlsRow);
        modal.appendChild(listWrap);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const state = {
            appid: parsedAppId,
            baseName: '',
            appType: '',
            baseHasLua: false,
            baseOwnedOnSteam: false,
            baseEligible: false,
            activeTab: 'dlc',
            items: [],
            busy: false,
            activeAppid: '',
            changed: false,
            selected: {}
        };

        function promptRestartAfterAdd(successCount) {
            const count = parseInt(successCount, 10);
            if (isNaN(count) || count <= 0) return;

            const message = (count === 1)
                ? lt('A new item was added. Restart Steam now to apply changes?')
                : lt('{count} new items were added. Restart Steam now to apply changes?').replace('{count}', String(count));

            const doRestart = function() {
                if (typeof scheduleRestartSteam === 'function') {
                    scheduleRestartSteam(3);
                }
            };

            if (typeof showNoCommentConfirm === 'function') {
                showNoCommentConfirm(
                    'No-Comment',
                    message,
                    function() { doRestart(); },
                    function() {},
                    { keepOverlay: true, theme: 'grey' }
                );
                return;
            }

            try {
                if (window.confirm(message)) {
                    doRestart();
                }
            } catch(_) {}
        }

        function setStatus(text, isError) {
            statusEl.textContent = String(text || '');
            statusEl.style.color = isError ? '#ff9a9a' : '#b9c4d1';
        }

        function getVisibleItems() {
            return state.items.filter(function(item) {
                const cat = String(item && item.category ? item.category : 'dlc').toLowerCase();
                return cat === state.activeTab;
            });
        }

        function getTabCount(tabName) {
            const target = String(tabName || '').toLowerCase();
            return state.items.filter(function(item) {
                const cat = String(item && item.category ? item.category : 'dlc').toLowerCase();
                return cat === target;
            }).length;
        }

        function isInstallCandidate(item) {
            const target = item || {};
            const inheritedByBase = !!target.inheritedByBase;
            return !target.installedLua && !target.ownedOnSteam && !inheritedByBase;
        }

        function getSelectedVisibleItems() {
            const selected = state.selected || {};
            return getVisibleItems().filter(function(item) {
                return isInstallCandidate(item) && !!selected[String(item.appid)];
            });
        }

        function getSelectedTotalCount() {
            const selected = state.selected || {};
            return state.items.filter(function(item) {
                return isInstallCandidate(item) && !!selected[String(item.appid)];
            }).length;
        }

        function pruneSelection() {
            const selected = state.selected || {};
            const next = {};
            for (let i = 0; i < state.items.length; i++) {
                const item = state.items[i] || {};
                const key = String(item.appid || '');
                if (!key || !selected[key]) continue;
                if (isInstallCandidate(item)) {
                    next[key] = true;
                }
            }
            state.selected = next;
        }

        function updateTabButtons() {
            const dlcCount = getTabCount('dlc');
            const specialCount = getTabCount('special');
            dlcTabBtn.textContent = lt('DLCs') + ' (' + dlcCount + ')';
            specialTabBtn.textContent = lt('Special Content') + ' (' + specialCount + ')';

            const dlcActive = state.activeTab === 'dlc';
            const specialActive = state.activeTab === 'special';

            dlcTabBtn.style.background = dlcActive ? 'rgba(126,126,126,0.92)' : 'rgba(68,68,68,0.85)';
            dlcTabBtn.style.borderColor = dlcActive ? 'rgba(220,220,220,0.65)' : 'rgba(175,175,175,0.45)';
            dlcTabBtn.style.color = dlcActive ? '#ffffff' : '#e4e4e4';

            specialTabBtn.style.background = specialActive ? 'rgba(126,126,126,0.92)' : 'rgba(68,68,68,0.85)';
            specialTabBtn.style.borderColor = specialActive ? 'rgba(220,220,220,0.65)' : 'rgba(175,175,175,0.45)';
            specialTabBtn.style.color = specialActive ? '#ffffff' : '#e4e4e4';

            setPseudoDisabled(dlcTabBtn, state.busy);
            setPseudoDisabled(specialTabBtn, state.busy);
        }

        function updateAddAllButtonLabel() {
            const visible = getVisibleItems();
            const missing = visible.filter(isInstallCandidate).length;
            const selectedVisibleCount = getSelectedVisibleItems().length;
            const selectedTotalCount = getSelectedTotalCount();
            const addAllText = state.activeTab === 'special'
                ? lt('Add All Missing Special Content')
                : lt('Add All Missing DLCs');
            addAllBtn.innerHTML = `<span>${addAllText} (${missing})</span>`;
            addSelectedBtn.innerHTML = `<span>${lt('Add Selected')} (${selectedVisibleCount})</span>`;
            clearSelectedBtn.innerHTML = `<span>${lt('Clear Selected')} (${selectedTotalCount})</span>`;
            setPseudoDisabled(addAllBtn, state.busy || missing === 0 || !state.baseEligible);
            setPseudoDisabled(addSelectedBtn, state.busy || selectedVisibleCount === 0 || !state.baseEligible);
            setPseudoDisabled(clearSelectedBtn, state.busy || selectedTotalCount === 0);
        }

        async function withRunStateLock(task) {
            if (runState.inProgress) {
                setStatus(lt('Another NoComment operation is already running.'), true);
                return;
            }
            runState.inProgress = true;
            runState.appid = null;
            try {
                await task();
            } finally {
                runState.inProgress = false;
                runState.appid = null;
            }
        }

        function renderList() {
            listWrap.innerHTML = '';
            setPseudoDisabled(closeBtn, state.busy);
            updateTabButtons();
            pruneSelection();
            const visibleItems = getVisibleItems();

            if (!visibleItems.length) {
                const empty = document.createElement('div');
                empty.style.cssText = 'padding:18px 12px;text-align:center;color:#b5beca;font-size:13px;';
                if (state.appType && state.appType !== 'game') {
                    empty.textContent = lt('DLC manager is only available on base game store pages.');
                } else if (state.activeTab === 'special') {
                    empty.textContent = lt('No special content found for this game.');
                } else {
                    empty.textContent = lt('No DLCs found for this game.');
                }
                listWrap.appendChild(empty);
                updateAddAllButtonLabel();
                return;
            }

            for (let i = 0; i < visibleItems.length; i++) {
                const item = visibleItems[i];

                const row = document.createElement('div');
                row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 12px;border:1px solid rgba(170,170,170,0.2);border-radius:10px;background:rgba(30,34,40,0.55);margin-bottom:8px;';

                const left = document.createElement('div');
                left.style.cssText = 'display:flex;align-items:center;gap:10px;min-width:0;';

                const installedLua = !!item.installedLua;
                const ownedOnSteam = !!item.ownedOnSteam;
                const inheritedByBase = !!item.inheritedByBase;
                const isOwnedOnly = ownedOnSteam && !installedLua;
                const canSelect = isInstallCandidate(item);

                const selector = document.createElement('input');
                selector.type = 'checkbox';
                selector.style.cssText = 'width:16px;height:16px;accent-color:#8f8f8f;cursor:pointer;flex-shrink:0;';
                selector.checked = !!(state.selected && state.selected[String(item.appid)] && canSelect);
                selector.disabled = !canSelect || state.busy || !state.baseEligible;
                selector.onchange = function() {
                    const key = String(item.appid);
                    if (!state.selected) state.selected = {};
                    if (selector.checked && canSelect) {
                        state.selected[key] = true;
                    } else {
                        delete state.selected[key];
                    }
                    updateAddAllButtonLabel();
                };

                const textWrap = document.createElement('div');
                textWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:0;';

                const nameEl = document.createElement('div');
                nameEl.style.cssText = 'font-size:14px;font-weight:700;color:#e7ebf1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
                nameEl.textContent = item.name || ('App ' + item.appid);

                const metaEl = document.createElement('div');
                metaEl.style.cssText = 'font-size:11px;color:#9eaab8;';
                metaEl.textContent = 'AppID ' + item.appid;

                textWrap.appendChild(nameEl);
                textWrap.appendChild(metaEl);
                left.appendChild(selector);
                left.appendChild(textWrap);

                const right = document.createElement('div');
                right.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;';

                const links = document.createElement('div');
                links.style.cssText = 'display:flex;align-items:center;gap:6px;';

                const steamDbBtn = document.createElement('a');
                steamDbBtn.href = '#';
                steamDbBtn.style.cssText = 'padding:5px 8px;border-radius:8px;border:1px solid rgba(170,170,170,0.45);background:rgba(70,70,70,0.62);color:#e4e4e4;text-decoration:none;font-size:11px;font-weight:700;';
                steamDbBtn.textContent = lt('SteamDB');
                steamDbBtn.onclick = function(e) {
                    e.preventDefault();
                    openSteamDbApp(item.appid);
                };

                const storeBtn = document.createElement('a');
                storeBtn.href = '#';
                storeBtn.style.cssText = 'padding:5px 8px;border-radius:8px;border:1px solid rgba(170,170,170,0.45);background:rgba(70,70,70,0.62);color:#e4e4e4;text-decoration:none;font-size:11px;font-weight:700;';
                storeBtn.textContent = lt('Store');
                storeBtn.onclick = function(e) {
                    e.preventDefault();
                    openSteamStore(item.appid);
                };

                links.appendChild(steamDbBtn);
                links.appendChild(storeBtn);

                const badge = document.createElement('div');
                badge.style.cssText = installedLua
                    ? 'padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#c9f0d0;background:rgba(56,145,74,0.24);border:1px solid rgba(94,190,115,0.35);'
                    : (inheritedByBase
                        ? 'padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#d6e8ff;background:rgba(94,120,155,0.26);border:1px solid rgba(132,164,206,0.4);'
                    : (isOwnedOnly
                        ? 'padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#d3d8e0;background:rgba(106,115,128,0.28);border:1px solid rgba(158,171,188,0.35);'
                        : 'padding:4px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#d7dde7;background:rgba(132,145,166,0.2);border:1px solid rgba(164,178,201,0.28);'));
                badge.textContent = installedLua
                    ? lt('Added')
                    : (inheritedByBase ? lt('Added via Base') : (isOwnedOnly ? lt('Owned') : lt('Not Added')));

                const actionBtn = document.createElement('a');
                actionBtn.href = '#';
                actionBtn.style.cssText = 'padding:8px 12px;border-radius:10px;border:1px solid rgba(205,205,205,0.45);background:linear-gradient(135deg, rgba(122,122,122,0.75), rgba(86,86,86,0.95));color:#f1f1f1;text-decoration:none;font-size:12px;font-weight:700;';

                if (state.busy && state.activeAppid === item.appid) {
                    actionBtn.textContent = lt('Working…');
                } else {
                    actionBtn.textContent = installedLua ? lt('Remove') : (inheritedByBase ? lt('Base') : (isOwnedOnly ? lt('Owned') : lt('Add')));
                }

                const canMutate = state.baseEligible && !state.busy && !isOwnedOnly && !inheritedByBase;
                setPseudoDisabled(actionBtn, !canMutate);
                actionBtn.onclick = async function(e) {
                    e.preventDefault();
                    if (state.busy || !state.baseEligible || isOwnedOnly || inheritedByBase) return;

                    await withRunStateLock(async function() {
                        state.busy = true;
                        state.activeAppid = item.appid;
                        renderList();
                        setPseudoDisabled(refreshBtn, true);

                        runState.appid = parseInt(item.appid, 10);
                        window.__NoCommentCurrentAppId = runState.appid;
                        setStatus((item.installedLua ? lt('Removing…') : lt('Adding…')) + ' ' + (item.name || ('App ' + item.appid)));

                        let result = null;
                        if (item.installedLua) {
                            result = await removeNoCommentForAppById(item.appid);
                        } else {
                            result = await addNoCommentForAppAndWait(item.appid, {
                                baseAppid: state.appid,
                                baseOwnedOnSteam: state.baseOwnedOnSteam
                            });
                        }

                        if (result && result.success) {
                            item.installedLua = !item.installedLua;
                            const wasAdded = !!item.installedLua;
                            if (item.installedLua) {
                                item.inheritedByBase = false;
                                if (state.selected) {
                                    delete state.selected[String(item.appid)];
                                }
                            } else {
                                item.inheritedByBase = !!(state.baseHasLua && item.baseScriptIncluded);
                            }
                            state.changed = true;
                            setStatus((item.installedLua ? lt('Added') : lt('Removed')) + ': ' + (item.name || ('App ' + item.appid)));
                            if (wasAdded) {
                                promptRestartAfterAdd(1);
                            }
                        } else {
                            const errText = (result && result.error) ? String(result.error) : lt('Failed');
                            setStatus(errText, true);
                        }

                        state.busy = false;
                        state.activeAppid = '';
                        setPseudoDisabled(refreshBtn, false);
                        renderList();
                    });
                };

                right.appendChild(links);
                right.appendChild(badge);
                right.appendChild(actionBtn);
                row.appendChild(left);
                row.appendChild(right);
                listWrap.appendChild(row);
            }

            updateAddAllButtonLabel();
        }

        async function refreshList(showRefreshedMessage) {
            if (state.busy) return;
            setPseudoDisabled(refreshBtn, true);
            setStatus(lt('Loading DLC list…'));
            try {
                const payload = await fetchGameDlcEntries(state.appid);
                state.baseName = payload.baseName || ('App ' + state.appid);
                state.appType = payload.appType || '';
                state.items = Array.isArray(payload.items) ? payload.items : [];
                if (typeof payload.baseHasLua === 'boolean') {
                    state.baseHasLua = payload.baseHasLua;
                } else {
                    state.baseHasLua = await hasNoCommentForApp(state.appid);
                }
                state.baseOwnedOnSteam = isAppOwnedOnSteam(state.appid);
                state.baseEligible = state.baseHasLua || state.baseOwnedOnSteam;
                pruneSelection();

                const dlcCountNow = state.items.filter(function(item){
                    return String(item && item.category ? item.category : 'dlc').toLowerCase() === 'dlc';
                }).length;
                const specialCountNow = state.items.filter(function(item){
                    return String(item && item.category ? item.category : 'dlc').toLowerCase() === 'special';
                }).length;
                if (state.activeTab === 'dlc' && dlcCountNow === 0 && specialCountNow > 0) {
                    state.activeTab = 'special';
                } else if (state.activeTab === 'special' && specialCountNow === 0 && dlcCountNow > 0) {
                    state.activeTab = 'dlc';
                }

                const count = state.items.length;
                subTitleEl.textContent = state.baseName + ' · ' + String(count) + ' ' + lt('Items');
                renderList();

                if (state.appType && state.appType !== 'game') {
                    setStatus(lt('DLC manager is only available on base game store pages.'), true);
                } else if (!state.baseEligible) {
                    setStatus(lt('Add the base game via NoComment or own it on Steam to manage DLCs.'), true);
                } else if (!state.items.length) {
                    setStatus(lt('No DLCs found for this game.'));
                } else if (showRefreshedMessage) {
                    setStatus(lt('DLC list refreshed.'));
                } else {
                    setStatus('');
                }
            } catch(err) {
                state.items = [];
                renderList();
                setStatus(lt('Failed to load DLC list.') + ' ' + ((err && err.message) ? err.message : ''), true);
            } finally {
                setPseudoDisabled(refreshBtn, false);
            }
        }

        async function runBatchAdd(targets, successTemplate, emptyErrorText) {
            const list = Array.isArray(targets) ? targets.slice() : [];
            if (!list.length) {
                setStatus(emptyErrorText || lt('No DLCs were added.'), true);
                return;
            }

            await withRunStateLock(async function() {
                state.busy = true;
                let successCount = 0;
                let failedCount = 0;

                setPseudoDisabled(refreshBtn, true);
                renderList();

                for (let i = 0; i < list.length; i++) {
                    const item = list[i];
                    state.activeAppid = item.appid;
                    renderList();

                    runState.appid = parseInt(item.appid, 10);
                    window.__NoCommentCurrentAppId = runState.appid;
                    setStatus(lt('Adding…') + ' ' + (item.name || ('App ' + item.appid)) + ' (' + (i + 1) + '/' + list.length + ')');

                    const result = await addNoCommentForAppAndWait(item.appid, {
                        baseAppid: state.appid,
                        baseOwnedOnSteam: state.baseOwnedOnSteam
                    });
                    if (result && result.success) {
                        item.installedLua = true;
                        item.inheritedByBase = false;
                        if (state.selected) {
                            delete state.selected[String(item.appid)];
                        }
                        successCount += 1;
                    } else {
                        failedCount += 1;
                        backendLog('NoComment: DLC add failed for appid=' + item.appid + ' err=' + ((result && result.error) ? result.error : 'unknown'));
                    }
                }

                state.busy = false;
                state.activeAppid = '';
                state.changed = state.changed || successCount > 0;
                setPseudoDisabled(refreshBtn, false);
                renderList();

                if (successCount > 0) {
                    let summary = String(successTemplate || lt('Added {count} items.')).replace('{count}', String(successCount));
                    if (failedCount > 0) {
                        summary += ' ' + lt('{count} failed.').replace('{count}', String(failedCount));
                    }
                    setStatus(summary, false);
                    promptRestartAfterAdd(successCount);
                } else {
                    setStatus(emptyErrorText || lt('No DLCs were added.'), true);
                }
            });
        }

        addAllBtn.onclick = async function(e) {
            e.preventDefault();
            if (state.busy) return;

            if (!state.baseEligible) {
                setStatus(lt('Add the base game via NoComment or own it on Steam to manage DLCs.'), true);
                return;
            }

            const targets = getVisibleItems().filter(isInstallCandidate);
            if (!targets.length) {
                setStatus(state.activeTab === 'special' ? lt('All special content is already added.') : lt('All DLCs are already added.'));
                return;
            }

            await runBatchAdd(
                targets,
                (state.activeTab === 'special' ? lt('Added {count} special items.') : lt('Added {count} DLCs.')),
                lt('No DLCs were added.')
            );
        };

        addSelectedBtn.onclick = async function(e) {
            e.preventDefault();
            if (state.busy) return;

            if (!state.baseEligible) {
                setStatus(lt('Add the base game via NoComment or own it on Steam to manage DLCs.'), true);
                return;
            }

            const selectedTargets = getSelectedVisibleItems();
            if (!selectedTargets.length) {
                setStatus(lt('No selected items to add.'), true);
                return;
            }

            await runBatchAdd(
                selectedTargets,
                lt('Added {count} selected items.'),
                lt('No selected items were added.')
            );
        };

        clearSelectedBtn.onclick = function(e) {
            e.preventDefault();
            if (state.busy) return;
            state.selected = {};
            renderList();
            setStatus(lt('Selection cleared.'));
        };

        refreshBtn.onclick = function(e) {
            e.preventDefault();
            refreshList(true);
        };

        dlcTabBtn.onclick = function(e) {
            e.preventDefault();
            if (state.busy) return;
            state.activeTab = 'dlc';
            renderList();
            if (!state.baseEligible) {
                setStatus(lt('Add the base game via NoComment or own it on Steam to manage DLCs.'), true);
            } else {
                setStatus('');
            }
        };

        specialTabBtn.onclick = function(e) {
            e.preventDefault();
            if (state.busy) return;
            state.activeTab = 'special';
            renderList();
            if (!state.baseEligible) {
                setStatus(lt('Add the base game via NoComment or own it on Steam to manage DLCs.'), true);
            } else {
                setStatus('');
            }
        };

        closeBtn.onclick = function(e) {
            e.preventDefault();
            if (state.busy) return;
            overlay.remove();
            if (state.changed) {
                ensureStoreDlcManageButton(state.appid);
            }
        };

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                if (state.busy) return;
                overlay.remove();
                if (state.changed) {
                    ensureStoreDlcManageButton(state.appid);
                }
            }
        });

        refreshList(false);
    }

    function upsertStoreDlcManageButton(appId, dlcCount) {
        if (!isStoreGamePage()) return;
        const container = getPurchaseContainer();
        if (!container) {
            removeStoreDlcManageButton();
            return;
        }

        const label = lt('Manage DLCs via NoComment') + ' (' + String(dlcCount) + ')';

        let btnContainer = document.querySelector('.NoComment-store-dlc-button-container');
        if (btnContainer && btnContainer.classList && btnContainer.classList.contains('btn_packageinfo')) {
            try { btnContainer.remove(); } catch(_) {}
            btnContainer = null;
        }
        if (!btnContainer) {
            btnContainer = document.createElement('div');
            btnContainer.className = 'btn_addtocart NoComment-store-dlc-button-container';

            const button = document.createElement('a');
            button.setAttribute('data-panel', '{"focusable":true,"clickOnActivate":true}');
            button.setAttribute('role', 'button');
            button.href = '#';
            button.className = 'btn_blue_steamui btn_medium';
            button.style.marginLeft = '2px';
            button.dataset.NoCommentDlcButton = '1';

            const buttonSpan = document.createElement('span');
            buttonSpan.dataset.NoCommentDlcButtonLabel = '1';
            buttonSpan.textContent = label;
            button.appendChild(buttonSpan);
            btnContainer.appendChild(button);

            container.appendChild(btnContainer);
        }

        const button = btnContainer.querySelector('a[role="button"], a.btn_blue_steamui, span.btn_blue_steamui');
        let buttonSpan = button ? button.querySelector('span') : null;
        if (button && !buttonSpan) {
            buttonSpan = document.createElement('span');
            button.appendChild(buttonSpan);
        }
        if (buttonSpan) buttonSpan.textContent = label;
        if (button) {
            setSteamTooltip(button, label);
            button.onclick = function(evt) {
                try { evt.preventDefault(); } catch(_) {}
                showStoreDlcManager(appId);
            };
        }
        pruneBlankStoreButtons();
    }

    let dlcStoreCheckInFlight = false;
    let dlcStoreCheckAppId = null;
    async function ensureStoreDlcManageButton(appId) {
        const parsed = parseInt(appId, 10);
        if (isNaN(parsed) || !isStoreGamePage()) {
            removeStoreDlcManageButton();
            return;
        }

        if (dlcStoreCheckInFlight && dlcStoreCheckAppId === parsed) return;
        dlcStoreCheckInFlight = true;
        dlcStoreCheckAppId = parsed;
        try {
            const details = await fetchAppDetailsById(parsed);
            const appType = details && details.type ? String(details.type).toLowerCase() : '';
            if (appType !== 'game') {
                removeStoreDlcManageButton();
                return;
            }
            const dlcIds = getDlcAppIdsFromDetails(details);
            if (!dlcIds.length) {
                removeStoreDlcManageButton();
                return;
            }
            upsertStoreDlcManageButton(parsed, dlcIds.length);
        } catch(_) {
            removeStoreDlcManageButton();
        } finally {
            dlcStoreCheckInFlight = false;
        }
    }

    function getGameName() {
        const el = document.querySelector('.apphub_AppName') ||
            document.querySelector('.pageheader .breadcrumbs h1') ||
            document.querySelector('h1') || document.querySelector('title');
        if (!el) return 'This game';
        let name = el.textContent || el.innerText || '';
        return (name.replace(/\s+on\s+Steam$/i, '').trim()) || 'This game';
    }

    function setSteamTooltip(el, text) {
        try {
            el.setAttribute('data-tooltip-text', text);
            el.title = text;
            el.setAttribute('data-panel-tooltip', text);
        } catch(_) {}
    }

    const STORE_PRESENCE_CACHE_TTL_MS = 20000;
    let storePresenceCache = { appid: 0, exists: null, checkedAt: 0 };

    function setStorePresenceCache(appId, exists) {
        const parsed = parseInt(appId, 10);
        if (isNaN(parsed)) return;
        storePresenceCache = {
            appid: parsed,
            exists: exists === true,
            checkedAt: Date.now()
        };
    }

    function getStorePresenceCache(appId) {
        const parsed = parseInt(appId, 10);
        if (isNaN(parsed)) return null;
        if (storePresenceCache.appid !== parsed) return null;
        if ((Date.now() - Number(storePresenceCache.checkedAt || 0)) > STORE_PRESENCE_CACHE_TTL_MS) {
            return null;
        }
        if (typeof storePresenceCache.exists !== 'boolean') return null;
        return storePresenceCache.exists;
    }

    function refreshStoreButtonTranslations() {
        function updateContainerButton(containerSelector, textBuilder) {
            try {
                const container = document.querySelector(containerSelector);
                if (!container) return;
                const button = container.querySelector('a[role="button"], a.btn_blue_steamui, span.btn_blue_steamui');
                if (!button) return;
                let label = '';
                try { label = String(textBuilder() || '').trim(); } catch(_) { label = ''; }
                if (!label) return;
                let span = button.querySelector('span');
                if (!span) {
                    span = document.createElement('span');
                    button.appendChild(span);
                }
                span.textContent = label;
                setSteamTooltip(button, label);
            } catch(_) {}
        }

        try {
            updateContainerButton('.NoComment-store-button-container.NoComment-store-add', function() {
                return lt('Add via NoComment');
            });
        } catch(_) {}

        try {
            updateContainerButton('.NoComment-store-button-container.NoComment-store-bundle', function() {
                return lt('Add bundle games via NoComment');
            });
        } catch(_) {}

        try {
            updateContainerButton('.NoComment-store-button-container.NoComment-store-remove', function() {
                return t('menu.removeNoComment', 'Remove via NoComment');
            });
        } catch(_) {}
    }

    function pruneBlankStoreButtons() {
        const containers = document.querySelectorAll('.NoComment-store-button-container, .NoComment-store-dlc-button-container');
        containers.forEach(function(container) {
            try {
                const button = container.querySelector('a[role="button"], a.btn_blue_steamui, span.btn_blue_steamui');
                if (!button) {
                    container.remove();
                    return;
                }
                const text = String(button.textContent || '').replace(/\s+/g, ' ').trim();
                if (!text) {
                    container.remove();
                }
            } catch(_) {}
        });
    }

    function getPurchaseContainer() {
        const container =
            document.querySelector('.bundle_purchase_action_bg') ||
            document.querySelector('.bundle_purchase_action') ||
            document.querySelector('.bundle_purchase_action_bg .btn_addtocart')?.parentElement ||
            document.querySelector('.bundle_purchase_action .btn_addtocart')?.parentElement ||
            document.querySelector('.game_area_purchase_game_wrapper .game_purchase_action_bg') ||
            document.querySelector('.game_area_purchase_game:not(.demo_above_purchase) .game_purchase_action_bg') ||
            document.querySelector('.game_area_purchase_game:not(.demo_above_purchase) .game_purchase_action') ||
            document.querySelector('.game_area_purchase_game:not(.demo_above_purchase) .btn_addtocart')?.parentElement ||
            document.querySelector('.game_area_purchase_game_wrapper') ||
            document.querySelector('.game_purchase_action_bg') ||
            document.querySelector('.game_purchase_action') ||
            document.querySelector('.btn_addtocart')?.parentElement ||
            document.querySelector('[class*="purchase"]');
        if (container) return container;
        return null;
    }

    function createInLibraryBanner(gameName) {
        const banner = document.createElement('div');
        banner.className = 'game_area_already_owned page_content';
        banner.id = 'NoComment-in-library-banner';
        const ctn = document.createElement('div');
        ctn.className = 'game_area_already_owned_ctn';
        const flag = document.createElement('div');
        flag.className = 'ds_owned_flag ds_flag';
        flag.innerHTML = 'IN LIBRARY&nbsp;&nbsp;';
        const msg = document.createElement('div');
        msg.className = 'already_in_library';
        msg.textContent = gameName + ' is already in your Steam library';
        ctn.appendChild(flag);
        ctn.appendChild(msg);
        banner.appendChild(ctn);
        return banner;
    }

    function addInLibraryFlag(section) {
        if (section && !section.querySelector('.package_in_library_flag')) {
            const flag = document.createElement('div');
            flag.className = 'package_in_library_flag in_own_library';
            flag.setAttribute('data-NoComment', '1');
            flag.innerHTML = '<span class="icon">☰</span> <span>In library</span>';
            section.insertBefore(flag, section.firstChild);
        }
    }

    function removeNoCommentLibraryBanners() {
        const banner = document.querySelector('#NoComment-in-library-banner');
        if (banner && banner.parentElement) {
            banner.parentElement.removeChild(banner);
        }
        document.querySelectorAll('.package_in_library_flag[data-NoComment="1"]').forEach(function(flag) {
            try { flag.remove(); } catch(_) {}
        });
    }

    let storeSearchFlagSyncTimer = null;
    let storeSearchFlagSyncInFlight = false;
    let storeSearchFlagSyncQueued = false;

    function isStoreSearchListingPage() {
        if (!isSteamStoreHost()) return false;
        const path = String(window.location && window.location.pathname ? window.location.pathname : '');
        if (/^\/search(\/|$)/i.test(path)) return true;
        if (document.body && document.body.classList && document.body.classList.contains('search_page')) return true;
        return !!document.querySelector('#search_resultsRows .search_result_row, #search_resultsRows .tab_item');
    }

    function getStoreSearchRowAppId(row) {
        if (!row) return '';
        const raw = String(row.getAttribute('data-ds-appid') || row.getAttribute('data-appid') || '').split(',')[0].trim();
        if (/^\d+$/.test(raw)) return raw;
        const directHref = row.getAttribute('href');
        const nestedHref = directHref ? '' : ((row.querySelector && row.querySelector('a[href*="/app/"]')) ? row.querySelector('a[href*="/app/"]').getAttribute('href') : '');
        const extracted = extractAppIdFromHref(directHref || nestedHref || '');
        return /^\d+$/.test(extracted) ? extracted : '';
    }

    function removeStoreSearchNoCommentFlags() {
        document.querySelectorAll('.ds_flag.ds_owned_flag[data-NoComment-search-owned="1"]').forEach(function(flag) {
            try { flag.remove(); } catch(_) {}
        });

        document.querySelectorAll('[data-NoComment-ds-flagged="1"]').forEach(function(row) {
            try {
                const hasOtherFlags = !!row.querySelector('.ds_flag:not([data-NoComment-search-owned="1"])');
                if (!hasOtherFlags) {
                    row.classList.remove('ds_flagged');
                }
                row.removeAttribute('data-NoComment-ds-flagged');
            } catch(_) {}
        });

        document.querySelectorAll('[data-NoComment-ds-collapse-flag="1"]').forEach(function(row) {
            try {
                row.classList.remove('ds_collapse_flag');
                row.removeAttribute('data-NoComment-ds-collapse-flag');
            } catch(_) {}
        });

        document.querySelectorAll('[data-NoComment-ds-owned="1"]').forEach(function(row) {
            try {
                row.classList.remove('ds_owned');
                row.removeAttribute('data-NoComment-ds-owned');
            } catch(_) {}
        });
    }

    function applyNoCommentStoreSearchFlagToRow(row, NoCommentAppIds) {
        if (!row) return;
        const appid = getStoreSearchRowAppId(row);
        if (!/^\d+$/.test(appid)) return;

        const shouldFlag = !!(NoCommentAppIds && NoCommentAppIds.has(appid));
        const ownFlag = row.querySelector('.ds_flag.ds_owned_flag[data-NoComment-search-owned="1"]');
        const nativeOwnedFlag = row.querySelector('.ds_flag.ds_owned_flag:not([data-NoComment-search-owned="1"])');

        if (shouldFlag) {
            if (!row.classList.contains('ds_flagged')) {
                row.classList.add('ds_flagged');
                row.setAttribute('data-NoComment-ds-flagged', '1');
            }
            if (!row.classList.contains('ds_collapse_flag')) {
                row.classList.add('ds_collapse_flag');
                row.setAttribute('data-NoComment-ds-collapse-flag', '1');
            }
            if (nativeOwnedFlag) {
                if (ownFlag) {
                    try { ownFlag.remove(); } catch(_) {}
                }
                if (row.getAttribute('data-NoComment-ds-owned') === '1') {
                    row.classList.remove('ds_owned');
                    row.removeAttribute('data-NoComment-ds-owned');
                }
                return;
            }
            if (!row.classList.contains('ds_owned')) {
                row.classList.add('ds_owned');
                row.setAttribute('data-NoComment-ds-owned', '1');
            }
            if (!ownFlag) {
                const flag = document.createElement('div');
                flag.className = 'ds_flag ds_owned_flag';
                flag.setAttribute('data-NoComment-search-owned', '1');
                flag.innerHTML = 'IN LIBRARY&nbsp;&nbsp;';
                row.appendChild(flag);
            }
            return;
        }

        if (ownFlag) {
            try { ownFlag.remove(); } catch(_) {}
        }
        if (row.getAttribute('data-NoComment-ds-flagged') === '1') {
            const hasOtherFlags = !!row.querySelector('.ds_flag:not([data-NoComment-search-owned="1"])');
            if (!hasOtherFlags) {
                row.classList.remove('ds_flagged');
            }
            row.removeAttribute('data-NoComment-ds-flagged');
        }
        if (row.getAttribute('data-NoComment-ds-collapse-flag') === '1') {
            row.classList.remove('ds_collapse_flag');
            row.removeAttribute('data-NoComment-ds-collapse-flag');
        }
        if (row.getAttribute('data-NoComment-ds-owned') === '1') {
            row.classList.remove('ds_owned');
            row.removeAttribute('data-NoComment-ds-owned');
        }
    }

    function applyNoCommentStoreSearchFlagsToRows(rows, NoCommentAppIds) {
        const list = rows ? Array.from(rows) : [];
        for (let r = 0; r < list.length; r++) {
            applyNoCommentStoreSearchFlagToRow(list[r], NoCommentAppIds);
        }
    }

    function areStringSetsEqual(a, b) {
        const aSet = a instanceof Set ? a : new Set();
        const bSet = b instanceof Set ? b : new Set();
        if (aSet.size !== bSet.size) return false;
        for (const value of aSet) {
            if (!bSet.has(value)) return false;
        }
        return true;
    }

    async function syncNoCommentStoreSearchFlags() {
        if (!isStoreSearchListingPage()) {
            removeStoreSearchNoCommentFlags();
            return;
        }

        const rows = document.querySelectorAll('#search_resultsRows .search_result_row, #search_resultsRows .tab_item');
        if (!rows.length) {
            removeStoreSearchNoCommentFlags();
            return;
        }

        let quickIds = new Set();
        const cache = getInstalledLuaScriptsCache();
        if (Array.isArray(cache.entries) && cache.entries.length) {
            quickIds = buildInstalledLuaIdSet(cache.entries);
        } else {
            quickIds = readInstalledLuaIdSnapshotSet();
        }
        if (quickIds.size || document.querySelector('.ds_flag.ds_owned_flag[data-NoComment-search-owned="1"]')) {
            applyNoCommentStoreSearchFlagsToRows(rows, quickIds);
        }

        const entries = await getInstalledLuaScriptEntries(false);
        const ids = buildInstalledLuaIdSet(entries);
        writeInstalledLuaIdSnapshotSet(ids);

        if (!areStringSetsEqual(quickIds, ids)) {
            applyNoCommentStoreSearchFlagsToRows(rows, ids);
        }
    }

    function scheduleNoCommentStoreSearchFlagSync(delayMs) {
        const delay = typeof delayMs === 'number' ? Math.max(0, Math.floor(delayMs)) : 120;
        if (storeSearchFlagSyncTimer) {
            clearTimeout(storeSearchFlagSyncTimer);
        }
        storeSearchFlagSyncTimer = setTimeout(function() {
            storeSearchFlagSyncTimer = null;
            if (storeSearchFlagSyncInFlight) {
                storeSearchFlagSyncQueued = true;
                return;
            }
            storeSearchFlagSyncInFlight = true;
            syncNoCommentStoreSearchFlags()
                .catch(function(){})
                .finally(function() {
                    storeSearchFlagSyncInFlight = false;
                    if (storeSearchFlagSyncQueued) {
                        storeSearchFlagSyncQueued = false;
                        scheduleNoCommentStoreSearchFlagSync(0);
                    }
                });
        }, delay);
    }

    function clearStoreUiForNonStorePage() {
        document.querySelectorAll('.NoComment-store-button-container, .NoComment-store-dlc-button-container').forEach(function(btn) {
            try { btn.remove(); } catch(_) {}
        });
        removeNoCommentLibraryBanners();
    }

    function showLibraryBanners() {
        if (!isStoreGamePage()) return;
        if (document.querySelector('#NoComment-in-library-banner')) return;
        const gameName = getGameName();
        const queue = document.querySelector('#queueActionsCtn');
        if (queue) queue.insertAdjacentElement('afterend', createInLibraryBanner(gameName));
        const btn = document.querySelector('.NoComment-store-button-container');
        const sec = (btn ? btn.closest('.game_area_purchase_game') : null) || document.querySelector('.game_area_purchase_game');
        if (sec && !sec.classList.contains('demo_above_purchase')) addInLibraryFlag(sec);
    }

    function createStoreAddButton(appId) {
        if (!isStoreGamePage()) return;
        if (document.querySelector('.NoComment-store-button-container')) return;
        const container = getPurchaseContainer();
        if (!container) { return; }

        const btnContainer = document.createElement('div');
        btnContainer.className = 'btn_addtocart NoComment-store-button-container NoComment-store-add';

        const button = document.createElement('a');
        button.setAttribute('data-panel', '{"focusable":true,"clickOnActivate":true}');
        button.setAttribute('role', 'button');
        button.href = '#';
        button.className = 'btn_blue_steamui btn_medium';
        button.style.marginLeft = '2px';
        button.dataset.NoCommentStoreButton = '1';

        const buttonSpan = document.createElement('span');
        const addText = lt('Add via NoComment');
        buttonSpan.dataset.NoCommentStoreAddLabel = '1';
        buttonSpan.textContent = addText;
        button.appendChild(buttonSpan);
        btnContainer.appendChild(button);

        setSteamTooltip(button, addText);

        button.onclick = async function(evt) {
            try { evt.preventDefault(); } catch(_) {}
            if (runState.inProgress) return;
            button.style.pointerEvents = 'none';
            buttonSpan.textContent = lt('Working…');
            button.style.opacity = '0.7';
            const started = await startAddViaNoCommentFlow(appId, { showOverlay: true });
            if (!started) {
                button.style.pointerEvents = '';
                buttonSpan.textContent = addText;
                button.style.opacity = '';
            }
        };

        container.appendChild(btnContainer);
        refreshStoreButtonTranslations();
        pruneBlankStoreButtons();
    }

    async function collectBundleAppsForInstall() {
        const bundleIds = await getBundleCandidateAppIds();
        const baseGames = await getBundleBaseGameApps(bundleIds);
        if (baseGames.length < 2) {
            return [];
        }
        const apps = [];
        for (let i = 0; i < baseGames.length; i++) {
            const entry = baseGames[i];
            const appid = entry.appid;
            try {
                const exists = await hasNoCommentForApp(parseInt(appid, 10));
                if (exists) continue;
            } catch(_) {}
            apps.push({ appid: appid, name: entry.name || ('App ' + appid) });
        }
        return apps;
    }

    function updateBundleOverlay(overlay, titleText, statusText, percentValue) {
        if (!overlay) return;
        const title = overlay.querySelector('.NoComment-title');
        const status = overlay.querySelector('.NoComment-status');
        const wrap = overlay.querySelector('.NoComment-progress-wrap');
        const percent = overlay.querySelector('.NoComment-percent');
        const bar = overlay.querySelector('.NoComment-progress-bar');
        if (title && titleText) title.textContent = titleText;
        if (status && statusText) status.textContent = statusText;
        if (wrap) wrap.style.display = '';
        if (percent) percent.style.display = '';
        if (typeof percentValue === 'number') {
            const pct = Math.max(0, Math.min(100, Math.floor(percentValue)));
            if (bar) bar.style.width = pct + '%';
            if (percent) percent.textContent = pct + '%';
        }
    }

    function waitForAddCompletion(appid, overlay) {
        return new Promise(function(resolve) {
            let finished = false;
            const timer = setInterval(function(){
                if (finished) { clearInterval(timer); return; }
                try {
                    Millennium.callServerMethod('No-Comment', 'GetAddViaNoCommentStatus', { appid, contentScriptQuery: '' }).then(function(res){
                        try {
                            const payload = typeof res === 'string' ? JSON.parse(res) : res;
                            const st = payload && payload.state ? payload.state : {};
                            if (overlay) {
                                if (st.status === 'checking') updateBundleOverlay(overlay, null, lt('Checking availability…'));
                                if (st.status === 'downloading') {
                                    const total = st.totalBytes || 0; const read = st.bytesRead || 0;
                                    const pct = total > 0 ? (read / total) * 100 : (read ? 1 : 0);
                                    updateBundleOverlay(overlay, null, lt('Downloading…'), pct);
                                    const cancelBtn = overlay.querySelector('.NoComment-cancel-btn');
                                    if (cancelBtn) cancelBtn.style.display = '';
                                }
                                if (st.status === 'processing') updateBundleOverlay(overlay, null, lt('Processing package…'));
                                if (st.status === 'installing') updateBundleOverlay(overlay, null, lt('Installing…'));
                                if (st.status === 'done') updateBundleOverlay(overlay, null, lt('Finishing…'), 100);
                                if (st.status === 'failed') updateBundleOverlay(overlay, null, lt('Failed'));
                            }
                            if (st.status === 'done' || st.status === 'failed' || st.status === 'cancelled') {
                                finished = true;
                                clearInterval(timer);
                                resolve(st);
                            }
                        } catch(_) {
                            finished = true;
                            clearInterval(timer);
                            resolve({ status: 'failed', error: 'status_parse' });
                        }
                    });
                } catch(_) {
                    finished = true;
                    clearInterval(timer);
                    resolve({ status: 'failed', error: 'status_call' });
                }
            }, 400);
        });
    }

    async function addBundleGames(apps) {
        if (!apps || !apps.length) {
            ShowNoCommentAlert('No-Comment', lt('Bundle must include at least 2 base games (DLC not counted).'));
            return;
        }
        if (runState.inProgress) return;
        runState.inProgress = true;
        runState.appid = null;
        try {
            showTestPopup();
            const overlay = document.querySelector('.NoComment-overlay');
            const total = apps.length;
            let successCount = 0;
            const hideBtn = overlay ? overlay.querySelector('.NoComment-hide-btn') : null;
            for (let i = 0; i < apps.length; i++) {
                const app = apps[i];
                runState.appid = parseInt(app.appid, 10);
                window.__NoCommentCurrentAppId = runState.appid;
                const titleText = lt('NoComment · Bundle') + ' ' + (i + 1) + '/' + total;
                const statusText = lt('Adding {game}…').replace('{game}', app.name || ('App ' + app.appid));
                updateBundleOverlay(overlay, titleText, statusText, 0);
                try {
                    if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                        Millennium.callServerMethod('No-Comment', 'StartAddViaNoComment', { appid: runState.appid, contentScriptQuery: '' });
                    }
                } catch(_) {}
                const result = await waitForAddCompletion(runState.appid, overlay);
                if (result && result.status === 'done') {
                    successCount += 1;
                }
            }
            if (overlay) {
                updateBundleOverlay(overlay, lt('NoComment · Bundle'), lt('Bundle complete.'), 100);
                const cancelBtn = overlay.querySelector('.NoComment-cancel-btn');
                if (cancelBtn) cancelBtn.style.display = 'none';
                if (hideBtn) hideBtn.innerHTML = `<span>${lt('Close')}</span>`;
            }
            if (successCount > 0) {
                invalidateInstalledLuaScriptsCache();
                scheduleRestartSteam(3, overlay);
            }
        } finally {
            runState.inProgress = false;
            runState.appid = null;
        }
    }

    function createStoreBundleAddButton() {
        if (!isBundlePage()) return;
        if (document.querySelector('.NoComment-store-button-container')) return;
        const container = getPurchaseContainer();
        if (!container) { return; }

        const btnContainer = document.createElement('div');
        btnContainer.className = 'btn_addtocart NoComment-store-button-container NoComment-store-bundle';

        const button = document.createElement('a');
        button.setAttribute('data-panel', '{"focusable":true,"clickOnActivate":true}');
        button.setAttribute('role', 'button');
        button.href = '#';
        button.className = 'btn_blue_steamui btn_medium';
        button.style.marginLeft = '2px';
        button.dataset.NoCommentStoreButton = '1';

        const buttonSpan = document.createElement('span');
        const addText = lt('Add bundle games via NoComment');
        buttonSpan.dataset.NoCommentStoreBundleLabel = '1';
        buttonSpan.textContent = addText;
        button.appendChild(buttonSpan);
        btnContainer.appendChild(button);

        setSteamTooltip(button, addText);

        button.onclick = async function(evt) {
            try { evt.preventDefault(); } catch(_) {}
            if (runState.inProgress) return;
            button.style.pointerEvents = 'none';
            buttonSpan.textContent = lt('Scanning bundle…');
            button.style.opacity = '0.7';
            try {
                const apps = await collectBundleAppsForInstall();
                button.style.pointerEvents = '';
                button.style.opacity = '';
                buttonSpan.textContent = addText;
                await addBundleGames(apps);
            } catch(_) {
                button.style.pointerEvents = '';
                button.style.opacity = '';
                buttonSpan.textContent = addText;
                ShowNoCommentAlert('No-Comment', lt('Failed to read bundle contents.'));
            }
        };

        container.appendChild(btnContainer);
        refreshStoreButtonTranslations();
        pruneBlankStoreButtons();
    }

    function createStoreRemoveButton(appId) {
        if (!isStoreGamePage()) return;
        if (document.querySelector('.NoComment-store-button-container')) return;
        const container = getPurchaseContainer();
        if (!container) { return; }

        const btnContainer = document.createElement('div');
        btnContainer.className = 'btn_addtocart NoComment-store-button-container NoComment-store-remove';

        const button = document.createElement('a');
        button.setAttribute('data-panel', '{"focusable":true,"clickOnActivate":true}');
        button.setAttribute('role', 'button');
        button.href = '#';
        button.className = 'btn_blue_steamui btn_medium';
        button.style.marginLeft = '2px';
        button.dataset.NoCommentStoreButton = '1';

        const buttonSpan = document.createElement('span');
        const removeText = t('menu.removeNoComment', 'Remove via NoComment');
        buttonSpan.dataset.NoCommentStoreRemoveLabel = '1';
        buttonSpan.textContent = removeText;
        button.appendChild(buttonSpan);
        btnContainer.appendChild(button);

        setSteamTooltip(button, removeText);

        const doRemove = function() {
            if (runState.inProgress) return;
            runState.inProgress = true;
            runState.appid = appId;
            button.style.pointerEvents = 'none';
            buttonSpan.textContent = lt('Removing…');
            button.style.opacity = '0.7';
            try {
                Millennium.callServerMethod('No-Comment', 'DeleteNoCommentForApp', { appid: appId, contentScriptQuery: '' })
                    .then(function(res){
                        let payload = res;
                        if (typeof res === 'string') {
                            try { payload = JSON.parse(res); } catch(_) { payload = null; }
                        }
                        if (payload && payload.success) {
                            setStorePresenceCache(appId, false);
                            invalidateInstalledLuaScriptsCache();
                            removeNoCommentLibraryBanners();
                            const storeBtn = document.querySelector('.NoComment-store-button-container');
                            if (storeBtn && storeBtn.parentElement) storeBtn.parentElement.removeChild(storeBtn);
                            createStoreAddButton(appId);
                            const successText = t('menu.remove.success', 'NoComment removed for this app.');
                            if (typeof ShowNoCommentAlert === 'function') {
                                ShowNoCommentAlert('No-Comment', successText);
                            }
                            if (typeof scheduleRestartSteam === 'function') {
                                scheduleRestartSteam(3);
                            }
                        } else {
                            const failureText = t('menu.remove.failure', 'Failed to remove NoComment.');
                            const errMsg = (payload && payload.error) ? String(payload.error) : failureText;
                            if (typeof ShowNoCommentAlert === 'function') {
                                ShowNoCommentAlert('No-Comment', errMsg);
                            }
                        }
                    })
                    .catch(function(err){
                        const failureText = t('menu.remove.failure', 'Failed to remove NoComment.');
                        const errMsg = (err && err.message) ? err.message : failureText;
                        if (typeof ShowNoCommentAlert === 'function') {
                            ShowNoCommentAlert('No-Comment', errMsg);
                        }
                    })
                    .finally(function(){
                        runState.inProgress = false;
                        runState.appid = null;
                    });
            } catch(_) {
                runState.inProgress = false;
                runState.appid = null;
            }
        };

        button.onclick = function(evt) {
            try { evt.preventDefault(); } catch(_) {}
            doRemove();
        };

        container.appendChild(btnContainer);
        refreshStoreButtonTranslations();
        pruneBlankStoreButtons();
    }

    let storeCheckInFlight = false;
    let storeCheckAppId = null;
    let bundleStoreCheckInFlight = false;
    let bundleStoreCheckKey = '';
    async function ensureStoreAddButton() {
        scheduleNoCommentStoreSearchFlagSync(0);
        pruneBlankStoreButtons();
        if (!isBundlePage() && !isStoreGamePage()) {
            clearStoreUiForNonStorePage();
            storeCheckInFlight = false;
            storeCheckAppId = null;
            dlcStoreCheckInFlight = false;
            dlcStoreCheckAppId = null;
            return;
        }

        let existing = document.querySelector('.NoComment-store-button-container');
        if (existing && existing.classList && existing.classList.contains('btn_packageinfo')) {
            try { existing.remove(); } catch(_) {}
            existing = null;
        }
        if (isBundlePage()) {
            removeStoreDlcManageButton();
            dlcStoreCheckInFlight = false;
            dlcStoreCheckAppId = null;
            if (existing && !existing.classList.contains('NoComment-store-bundle')) {
                try { existing.parentElement.removeChild(existing); } catch(_) {}
            }

            const currentBundleBtn = document.querySelector('.NoComment-store-button-container');
            if (!currentBundleBtn || !currentBundleBtn.classList.contains('NoComment-store-bundle')) {
                createStoreBundleAddButton();
            }

            const bundlePageId = getBundlePageId() || '';
            if (bundleStoreCheckInFlight && bundleStoreCheckKey === bundlePageId) return;
            bundleStoreCheckInFlight = true;
            bundleStoreCheckKey = bundlePageId;
            try {
                const bundleIds = await getBundleCandidateAppIds();
                const baseGames = await getBundleBaseGameApps(bundleIds);
                const isValidBundle = baseGames.length > 1;
                const current = document.querySelector('.NoComment-store-button-container');
                if (isValidBundle) {
                    if (!current || !current.classList.contains('NoComment-store-bundle')) {
                        if (current && current.parentElement) current.parentElement.removeChild(current);
                        createStoreBundleAddButton();
                    }
                } else if (current && current.classList.contains('NoComment-store-bundle')) {
                    try { current.parentElement.removeChild(current); } catch(_) {}
                }
            } catch(_) {
                const current = document.querySelector('.NoComment-store-button-container');
                if (current && current.classList.contains('NoComment-store-bundle')) {
                    try { current.parentElement.removeChild(current); } catch(_) {}
                }
            } finally {
                bundleStoreCheckInFlight = false;
            }
            return;
        }

        if (existing && existing.classList.contains('NoComment-store-bundle')) {
            try { existing.parentElement.removeChild(existing); } catch(_) {}
        }

        const appId = getCurrentAppId();
        if (!appId) {
            removeStoreDlcManageButton();
            return;
        }
        ensureStoreDlcManageButton(appId);

        const cachedExists = getStorePresenceCache(appId);
        const currentBtn = document.querySelector('.NoComment-store-button-container');
        if (cachedExists === true) {
            if (!currentBtn || !currentBtn.classList.contains('NoComment-store-remove')) {
                if (currentBtn && currentBtn.parentElement) currentBtn.parentElement.removeChild(currentBtn);
                createStoreRemoveButton(appId);
            }
            showLibraryBanners();
        } else {
            if (!currentBtn || !currentBtn.classList.contains('NoComment-store-add')) {
                if (currentBtn && currentBtn.parentElement) currentBtn.parentElement.removeChild(currentBtn);
                createStoreAddButton(appId);
            }
            if (cachedExists === false) {
                removeNoCommentLibraryBanners();
            }
        }

        if (cachedExists !== null) return;
        if (storeCheckInFlight && storeCheckAppId === appId) return;
        storeCheckInFlight = true;
        storeCheckAppId = appId;
        try {
            Millennium.callServerMethod('No-Comment', 'HasNoCommentForApp', { appid: appId, contentScriptQuery: '' })
                .then(function(res) {
                    let payload = res;
                    if (typeof res === 'string') {
                        try { payload = JSON.parse(res); } catch(_) { payload = null; }
                    }
                    const exists = payload && payload.success && payload.exists === true;
                    setStorePresenceCache(appId, exists);
                    const existingBtn = document.querySelector('.NoComment-store-button-container');
                    if (exists) {
                        if (!existingBtn || !existingBtn.classList.contains('NoComment-store-remove')) {
                            if (existingBtn && existingBtn.parentElement) existingBtn.parentElement.removeChild(existingBtn);
                            createStoreRemoveButton(appId);
                        }
                        showLibraryBanners();
                    } else {
                        if (!existingBtn || !existingBtn.classList.contains('NoComment-store-add')) {
                            if (existingBtn && existingBtn.parentElement) existingBtn.parentElement.removeChild(existingBtn);
                            createStoreAddButton(appId);
                        }
                    }
                })
                .catch(function() {
                    setStorePresenceCache(appId, false);
                    createStoreAddButton(appId);
                })
                .finally(function() {
                    storeCheckInFlight = false;
                    if (storeCheckAppId === appId) storeCheckAppId = null;
                });
        } catch(_) {
            storeCheckInFlight = false;
            if (storeCheckAppId === appId) storeCheckAppId = null;
            setStorePresenceCache(appId, false);
            createStoreAddButton(appId);
        }
    }

    
    ensureTranslationsLoaded(false);
    if (isSteamStoreHost()) {
        getInstalledLuaScriptEntries(false)
            .then(function(entries) {
                writeInstalledLuaIdSnapshotEntries(entries);
                scheduleNoCommentStoreSearchFlagSync(0);
            })
            .catch(function(){});
    }

    let settingsMenuPending = false;

    function styleGreyscaleLoadingModal(modal) {
        if (!modal) return;
        modal.style.background = 'linear-gradient(160deg, #2b2b2b 0%, #1c1c1c 60%, #141414 100%)';
        modal.style.color = '#f2f2f2';
        modal.style.border = '1px solid rgba(220,220,220,0.35)';
        modal.style.borderRadius = '8px';
        modal.style.boxShadow = '0 20px 60px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)';
    }

    function styleGreyscaleLoadingTitle(title) {
        if (!title) return;
        title.style.color = '#f2f2f2';
        title.style.textShadow = '0 2px 8px rgba(0,0,0,0.6)';
        title.style.background = 'linear-gradient(135deg, #f2f2f2 0%, #bdbdbd 100%)';
        title.style.webkitBackgroundClip = 'text';
        title.style.webkitTextFillColor = 'transparent';
        title.style.backgroundClip = 'text';
    }

    function styleGreyscaleLoadingBody(body) {
        if (!body) return;
        body.style.color = '#cfcfcf';
    }

    function styleGreyscaleLoadingProgress(progressWrap, progressBar, percent) {
        if (progressWrap) {
            progressWrap.style.background = 'rgba(255,255,255,0.08)';
            progressWrap.style.border = '1px solid rgba(255,255,255,0.2)';
            progressWrap.style.borderRadius = '6px';
        }
        if (progressBar) {
            progressBar.style.background = 'linear-gradient(90deg, #f0f0f0 0%, #bdbdbd 100%)';
            progressBar.style.boxShadow = '0 0 12px rgba(255,255,255,0.35)';
        }
        if (percent) {
            percent.style.color = '#9a9a9a';
        }
    }

    function styleGreyscaleLoadingButton(btn, isPrimary) {
        if (!btn) return;
        const baseBg = isPrimary ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)';
        const baseBorder = isPrimary ? 'rgba(255,255,255,0.55)' : 'rgba(220,220,220,0.35)';
        const hoverBg = isPrimary ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.16)';
        const hoverBorder = isPrimary ? '#f0f0f0' : 'rgba(220,220,220,0.6)';
        btn.style.background = baseBg;
        btn.style.border = '1px solid ' + baseBorder;
        btn.style.borderRadius = '8px';
        btn.style.color = '#e6e6e6';
        btn.style.textDecoration = 'none';
        btn.style.fontSize = '13px';
        btn.style.fontWeight = '600';
        btn.style.transition = 'all 0.2s ease';
        btn.style.boxShadow = 'none';
        btn.onmouseover = function() {
            this.style.background = hoverBg;
            this.style.borderColor = hoverBorder;
            this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.45)';
        };
        btn.onmouseout = function() {
            this.style.background = baseBg;
            this.style.borderColor = baseBorder;
            this.style.boxShadow = 'none';
        };
    }
    
    

    function showTestPopup() {

        
        if (document.querySelector('.NoComment-overlay')) return;
        
        
        
        ensureNoCommentStyles();
        const overlay = document.createElement('div');
        overlay.className = 'NoComment-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:400px;max-width:560px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(102,192,244,0.3);animation:slideUp 0.1s ease-out;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:22px;color:#fff;margin-bottom:16px;font-weight:700;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        title.className = 'NoComment-title';
        title.textContent = 'No-Comment';

        const body = document.createElement('div');
        body.style.cssText = 'font-size:14px;line-height:1.4;margin-bottom:12px;';
        body.className = 'NoComment-status';
        body.textContent = lt('Working…');

        const progressWrap = document.createElement('div');
        progressWrap.style.cssText = 'background:rgba(42,71,94,0.5);height:12px;border-radius:4px;overflow:hidden;position:relative;display:none;border:1px solid rgba(102,192,244,0.3);';
        progressWrap.className = 'NoComment-progress-wrap';
        const progressBar = document.createElement('div');
        progressBar.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg, #66c0f4 0%, #a4d7f5 100%);transition:width 0.1s linear;box-shadow:0 0 10px rgba(102,192,244,0.5);';
        progressBar.className = 'NoComment-progress-bar';
        progressWrap.appendChild(progressBar);

        const percent = document.createElement('div');
        percent.style.cssText = 'text-align:right;color:#8f98a0;margin-top:8px;font-size:12px;display:none;';
        percent.className = 'NoComment-percent';
        percent.textContent = '0%';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-top:16px;display:flex;gap:8px;justify-content:flex-end;';
        const cancelBtn = document.createElement('a');
        cancelBtn.className = 'btnv6_blue_hoverfade btn_medium NoComment-cancel-btn';
        cancelBtn.innerHTML = `<span>${lt('Cancel')}</span>`;
        cancelBtn.href = '#';
        cancelBtn.style.display = 'none';
        cancelBtn.onclick = function(e){ e.preventDefault(); cancelOperation(); };
        const hideBtn = document.createElement('a');
        hideBtn.className = 'btnv6_blue_hoverfade btn_medium NoComment-hide-btn';
        hideBtn.innerHTML = `<span>${lt('Hide')}</span>`;
        hideBtn.href = '#';
        hideBtn.onclick = function(e){ e.preventDefault(); cleanup(); };
        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(hideBtn);

        styleGreyscaleLoadingModal(modal);
        styleGreyscaleLoadingTitle(title);
        styleGreyscaleLoadingBody(body);
        styleGreyscaleLoadingProgress(progressWrap, progressBar, percent);
        styleGreyscaleLoadingButton(cancelBtn, false);
        styleGreyscaleLoadingButton(hideBtn, false);

        modal.appendChild(title);
        modal.appendChild(body);
        modal.appendChild(progressWrap);
        modal.appendChild(percent);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        function cleanup(){
            overlay.remove();
        }
        
        function cancelOperation(){
            
            try {
                const match = window.location.href.match(/https:\/\/store\.steampowered\.com\/app\/(\d+)/) || window.location.href.match(/https:\/\/steamcommunity\.com\/app\/(\d+)/);
                const appid = match ? parseInt(match[1], 10) : (window.__NoCommentCurrentAppId || NaN);
                if (!isNaN(appid) && typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                    Millennium.callServerMethod('No-Comment', 'CancelAddViaNoComment', { appid, contentScriptQuery: '' });
                }
            } catch(_) {}
            
            const status = overlay.querySelector('.NoComment-status');
            if (status) status.textContent = lt('Cancelled');
            const cancelBtn = overlay.querySelector('.NoComment-cancel-btn');
            if (cancelBtn) cancelBtn.style.display = 'none';
            const hideBtn = overlay.querySelector('.NoComment-hide-btn');
            if (hideBtn) hideBtn.innerHTML = `<span>${lt('Close')}</span>`;
            
            const wrap = overlay.querySelector('.NoComment-progress-wrap');
            const percent = overlay.querySelector('.NoComment-percent');
            if (wrap) wrap.style.display = 'none';
            if (percent) percent.style.display = 'none';
            
            runState.inProgress = false;
            runState.appid = null;
        }
    }

    
    function showFixesResultsPopup(data, isGameInstalled) {
        if (document.querySelector('.NoComment-fixes-results-overlay')) return;
        
        try { const d = document.querySelector('.NoComment-overlay'); if (d) d.remove(); } catch(_) {}
        try { closeToolsMenu(); } catch(_) {}
        try { const f = document.querySelector('.NoComment-fixes-results-overlay'); if (f) f.remove(); } catch(_) {}
        try { const l = document.querySelector('.NoComment-loading-fixes-overlay'); if (l) l.remove(); } catch(_) {}

        ensureNoCommentStyles();
        const overlay = document.createElement('div');
        overlay.className = 'NoComment-fixes-results-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'position:relative;background:linear-gradient(135deg, #2b2b2b 0%, #1a1a1a 100%);color:#f2f2f2;border:2px solid #6f6f6f;border-radius:8px;min-width:580px;max-width:700px;max-height:80vh;display:flex;flex-direction:column;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.85), 0 0 0 1px rgba(200,200,200,0.2);animation:slideUp 0.1s ease-out;';

        const header = document.createElement('div');
        header.style.cssText = 'flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid rgba(200,200,200,0.25);';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:24px;color:#f2f2f2;font-weight:700;text-shadow:0 2px 8px rgba(0,0,0,0.6);background:linear-gradient(135deg, #f2f2f2 0%, #bdbdbd 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        title.textContent = lt('NoComment · Fixes Menu');

        const iconButtons = document.createElement('div');
        iconButtons.style.cssText = 'display:flex;gap:12px;';

        function createIconButton(id, iconClass, titleKey, titleFallback) {
            const btn = document.createElement('a');
            btn.id = id;
            btn.href = '#';
            btn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:40px;height:40px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.25);border-radius:10px;color:#dedede;font-size:18px;text-decoration:none;transition:all 0.3s ease;cursor:pointer;';
            btn.innerHTML = '<i class="fa-solid ' + iconClass + '"></i>';
            btn.title = t(titleKey, titleFallback);
            btn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.14)'; this.style.transform = 'translateY(-2px) scale(1.05)'; this.style.boxShadow = '0 8px 16px rgba(0,0,0,0.45)'; this.style.borderColor = '#d6d6d6'; this.style.color = '#f2f2f2'; };
            btn.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.06)'; this.style.transform = 'translateY(0) scale(1)'; this.style.boxShadow = 'none'; this.style.borderColor = 'rgba(255,255,255,0.25)'; this.style.color = '#dedede'; };
            iconButtons.appendChild(btn);
            return btn;
        }

        const discordBtn = createIconButton('lt-fixes-discord', 'fa-brands fa-discord', 'menu.discord', 'Discord');
        const settingsBtn = createIconButton('lt-fixes-settings', 'fa-gear', 'menu.settings', 'Settings');
        const closeIconBtn = createIconButton('lt-fixes-close', 'fa-xmark', 'settings.close', 'Close');

        const body = document.createElement('div');
        body.style.cssText = 'flex:1 1 auto;position:relative;overflow-y:auto;padding:20px;border:1px solid rgba(200,200,200,0.2);border-radius:12px;background:rgba(15,15,15,0.7);';

        try {
            const bannerImg = document.querySelector('.game_header_image_full');
            if (bannerImg && bannerImg.src) {
                body.style.background = `linear-gradient(to bottom, rgba(18, 18, 18, 0.92), rgba(16, 16, 16, 0.88) 55%, rgba(12, 12, 12, 0.95) 100%), url('${bannerImg.src}') no-repeat top center`;
                body.style.backgroundSize = 'cover';
                body.style.backgroundBlendMode = 'luminosity';
            }
        } catch(_) {}

        const gameHeader = document.createElement('div');
        gameHeader.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px;';

        const gameIcon = document.createElement('img');
        gameIcon.style.cssText = 'width:32px;height:32px;border-radius:4px;object-fit:cover;display:none;';
        try {
            const iconImg = document.querySelector('.apphub_AppIcon img');
            if (iconImg && iconImg.src) {
                gameIcon.src = iconImg.src;
                gameIcon.style.display = 'block';
            }
        } catch(_) {}

        const gameName = document.createElement('div');
        gameName.style.cssText = 'font-size:22px;color:#f0f0f0;font-weight:600;text-align:center;text-shadow:0 1px 3px rgba(0,0,0,0.6);';
        gameName.textContent = data.gameName || lt('Unknown Game');
        if (!data.gameName || String(data.gameName).startsWith('Unknown Game') || String(data.gameName) === lt('Unknown Game')) {
            fetchSteamGameName(data.appid).then(function(name) {
                if (!name) return;
                data.gameName = name;
                gameName.textContent = name;
            }).catch(function(){});
        }

        const contentContainer = document.createElement('div');
        contentContainer.style.position = 'relative';
        contentContainer.style.zIndex = '1';

        const columnsContainer = document.createElement('div');
        columnsContainer.style.cssText = 'display:flex;gap:16px;';

        const leftColumn = document.createElement('div');
        leftColumn.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:16px;';

        const rightColumn = document.createElement('div');
        rightColumn.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:16px;';

        function createFixButton(label, text, icon, isSuccess, onClick) {
            const section = document.createElement('div');
            section.style.cssText = 'width:100%;text-align:center;';

            const sectionLabel = document.createElement('div');
            sectionLabel.style.cssText = 'font-size:12px;color:#bdbdbd;margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:1px;';
            sectionLabel.textContent = label;

            const btn = document.createElement('a');
            btn.href = '#';
            btn.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:10px;width:100%;box-sizing:border-box;padding:14px 24px;background:linear-gradient(135deg, rgba(220,220,220,0.12) 0%, rgba(220,220,220,0.04) 100%);border:1px solid rgba(220,220,220,0.28);border-radius:12px;color:#f2f2f2;font-size:15px;font-weight:500;text-decoration:none;transition:all 0.3s ease;cursor:pointer;';
            btn.innerHTML = '<i class="fa-solid ' + icon + '" style="font-size:16px;"></i><span>' + text + '</span>';

            if (isSuccess) {
                btn.style.background = 'linear-gradient(135deg, rgba(240,240,240,0.3) 0%, rgba(200,200,200,0.18) 100%)';
                btn.style.borderColor = 'rgba(240,240,240,0.6)';
                btn.onmouseover = function() { this.style.background = 'linear-gradient(135deg, rgba(245,245,245,0.45) 0%, rgba(210,210,210,0.25) 100%)'; this.style.transform = 'translateY(-2px)'; this.style.boxShadow = '0 8px 20px rgba(0,0,0,0.5)'; this.style.borderColor = '#f0f0f0'; };
                btn.onmouseout = function() { this.style.background = 'linear-gradient(135deg, rgba(240,240,240,0.3) 0%, rgba(200,200,200,0.18) 100%)'; this.style.transform = 'translateY(0)'; this.style.boxShadow = 'none'; this.style.borderColor = 'rgba(240,240,240,0.6)'; };
            } else if (isSuccess === false) {
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            } else {
                btn.onmouseover = function() { this.style.background = 'linear-gradient(135deg, rgba(230,230,230,0.22) 0%, rgba(230,230,230,0.1) 100%)'; this.style.transform = 'translateY(-2px)'; this.style.boxShadow = '0 8px 20px rgba(0,0,0,0.45)'; this.style.borderColor = '#e0e0e0'; };
                btn.onmouseout = function() { this.style.background = 'linear-gradient(135deg, rgba(220,220,220,0.12) 0%, rgba(220,220,220,0.04) 100%)'; this.style.transform = 'translateY(0)'; this.style.boxShadow = 'none'; this.style.borderColor = 'rgba(220,220,220,0.28)'; };
            }

            btn.onclick = onClick;

            section.appendChild(sectionLabel);
            section.appendChild(btn);
            return section;
        }

        
        const genericStatus = data.genericFix.status;
        const genericSection = createFixButton(
            lt('Generic Fix'),
            genericStatus === 200 ? lt('Apply') : lt('No generic fix'),
            genericStatus === 200 ? 'fa-check' : 'fa-circle-xmark',
            genericStatus === 200 ? true : false,
            function(e) {
                e.preventDefault();
                if (genericStatus === 200 && isGameInstalled) {
                    const genericUrl = 'https://files.NoComment.work/GameBypasses/' + data.appid + '.zip';
                    applyFix(data.appid, genericUrl, lt('Generic Fix'), data.gameName, overlay);
                }
            }
        );
        leftColumn.appendChild(genericSection);

        if (!isGameInstalled) {
            genericSection.querySelector('a').style.opacity = '0.5';
            genericSection.querySelector('a').style.cursor = 'not-allowed';
        }

        const onlineStatus = data.onlineFix.status;
        const onlineSection = createFixButton(
            lt('Online Fix'),
            onlineStatus === 200 ? lt('Apply') : lt('No online-fix'),
            onlineStatus === 200 ? 'fa-check' : 'fa-circle-xmark',
            onlineStatus === 200 ? true : false,
            function(e) {
                e.preventDefault();
                if (onlineStatus === 200 && isGameInstalled) {
                    const onlineUrl = data.onlineFix.url || ('https://files.NoComment.work/OnlineFix1/' + data.appid + '.zip');
                    applyFix(data.appid, onlineUrl, lt('Online Fix'), data.gameName, overlay);
                }
            }
        );
        leftColumn.appendChild(onlineSection);

        if (!isGameInstalled) {
            onlineSection.querySelector('a').style.opacity = '0.5';
            onlineSection.querySelector('a').style.cursor = 'not-allowed';
        }

        
        const aioSection = createFixButton(
            lt('All-In-One Fixes'),
            lt('Online Fix (Unsteam)'),
            'fa-globe',
            null, 
            function(e) {
                e.preventDefault();
                if (isGameInstalled) {
                    const downloadUrl = 'https://github.com/madoiscool/lt_api_links/releases/download/unsteam/Win64.zip';
                    applyFix(data.appid, downloadUrl, lt('Online Fix (Unsteam)'), data.gameName, overlay);
                }
            }
        );
        rightColumn.appendChild(aioSection);
        if (!isGameInstalled) {
            aioSection.querySelector('a').style.opacity = '0.5';
            aioSection.querySelector('a').style.cursor = 'not-allowed';
        }

        const unfixSection = createFixButton(
            lt('Manage Game'),
            lt('Un-Fix (verify game)'),
            'fa-trash',
            null, 
            function(e) {
                e.preventDefault();
                if (isGameInstalled) {
                    try { overlay.remove(); } catch(_) {}
                    showNoCommentConfirm('No-Comment', lt('Are you sure you want to un-fix? This will remove fix files and verify game files.'),
                        function() { startUnfix(data.appid); },
                        function() { showFixesResultsPopup(data, isGameInstalled); }
                    );
                }
            }
        );
        rightColumn.appendChild(unfixSection);
        if (!isGameInstalled) {
            unfixSection.querySelector('a').style.opacity = '0.5';
            unfixSection.querySelector('a').style.cursor = 'not-allowed';
        }

        
        const creditMsg = document.createElement('div');
        creditMsg.style.cssText = 'margin-top:16px;text-align:center;font-size:13px;color:#a0a0a0;';
        const creditTemplate = lt('Only possible thanks to {name} 💜');
        creditMsg.innerHTML = creditTemplate.replace('{name}', '<a href="#" id="lt-shayenvi-link" style="color:#d0d0d0;text-decoration:none;font-weight:600;">ShayneVi</a>');
        
        
        setTimeout(function(){
            const shayenviLink = overlay.querySelector('#lt-shayenvi-link');
            if (shayenviLink) {
                shayenviLink.addEventListener('click', function(e){
                    e.preventDefault();
                    try {
                        Millennium.callServerMethod('No-Comment', 'OpenExternalUrl', { url: 'https://github.com/ShayneVi/', contentScriptQuery: '' });
                    } catch(_) {}
                });
            }
        }, 0);

        
        gameHeader.appendChild(gameIcon);
        gameHeader.appendChild(gameName);
        contentContainer.appendChild(gameHeader);

        if (!isGameInstalled) {
            const notInstalledWarning = document.createElement('div');
            notInstalledWarning.style.cssText = 'margin-bottom: 16px; padding: 12px; background: rgba(200, 200, 200, 0.08); border: 1px solid rgba(200, 200, 200, 0.25); border-radius: 6px; color: #d0d0d0; font-size: 13px; text-align: center;';
            notInstalledWarning.innerHTML = '<i class="fa-solid fa-circle-info" style="margin-right: 8px;"></i>' + t('menu.error.notInstalled', 'Game is not installed');
            contentContainer.appendChild(notInstalledWarning);
        }

        columnsContainer.appendChild(leftColumn);
        columnsContainer.appendChild(rightColumn);
        contentContainer.appendChild(columnsContainer);
        contentContainer.appendChild(creditMsg);
        body.appendChild(contentContainer);

        
        header.appendChild(title);
        header.appendChild(iconButtons);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'flex:0 0 auto;margin-top:16px;display:flex;gap:8px;justify-content:space-between;align-items:center;';

        const rightButtons = document.createElement('div');
        rightButtons.style.cssText = 'display:flex;gap:8px;';
        const gameFolderBtn = document.createElement('a');
        gameFolderBtn.className = '';
        gameFolderBtn.innerHTML = `<span><i class="fa-solid fa-folder" style="margin-right: 8px;"></i>${lt('Game folder')}</span>`;
        gameFolderBtn.href = '#';
        gameFolderBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;padding:8px 14px;border-radius:8px;border:1px solid rgba(220,220,220,0.35);background:rgba(255,255,255,0.08);color:#e6e6e6;text-decoration:none;font-size:13px;font-weight:600;transition:all 0.2s ease;';
        gameFolderBtn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.16)'; this.style.borderColor = '#e0e0e0'; this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.45)'; };
        gameFolderBtn.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.08)'; this.style.borderColor = 'rgba(220,220,220,0.35)'; this.style.boxShadow = 'none'; };
        gameFolderBtn.onclick = function(e){ 
            e.preventDefault(); 
            if (window.__NoCommentGameInstallPath) {
                try {
                    Millennium.callServerMethod('No-Comment', 'OpenGameFolder', { path: window.__NoCommentGameInstallPath, contentScriptQuery: '' });
                } catch(err) { backendLog('NoComment: Failed to open game folder: ' + err); }
            }
        };
        rightButtons.appendChild(gameFolderBtn);

        const backBtn = document.createElement('a');
        backBtn.className = '';
        backBtn.innerHTML = '<span><i class="fa-solid fa-arrow-left"></i></span>';
        backBtn.href = '#';
        backBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:40px;height:34px;border-radius:8px;border:1px solid rgba(220,220,220,0.35);background:rgba(255,255,255,0.08);color:#e6e6e6;text-decoration:none;transition:all 0.2s ease;';
        backBtn.onmouseover = function() { this.style.background = 'rgba(255,255,255,0.16)'; this.style.borderColor = '#e0e0e0'; this.style.boxShadow = '0 6px 16px rgba(0,0,0,0.45)'; };
        backBtn.onmouseout = function() { this.style.background = 'rgba(255,255,255,0.08)'; this.style.borderColor = 'rgba(220,220,220,0.35)'; this.style.boxShadow = 'none'; };
        backBtn.onclick = function(e){
            e.preventDefault();
            try { overlay.remove(); } catch(_) {}
            showSettingsPopup();
        };
        btnRow.appendChild(backBtn);
        btnRow.appendChild(rightButtons);

        
        modal.appendChild(header);
        modal.appendChild(body);
        modal.appendChild(btnRow);  
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        closeIconBtn.onclick = function(e) { e.preventDefault(); overlay.remove(); };
        discordBtn.onclick = function(e) {
            e.preventDefault();
            try { overlay.remove(); } catch(_) {}
            const url = 'https://discord.gg/NoComment';
            try { Millennium.callServerMethod('No-Comment', 'OpenExternalUrl', { url, contentScriptQuery: '' }); } catch(_) {}
        };
        settingsBtn.onclick = function(e) {
            e.preventDefault();
            try { overlay.remove(); } catch(_) {}
            showSettingsManagerPopup(false, function() { showFixesResultsPopup(data, isGameInstalled); });
        };

        function startUnfix(appid) {
            try {
                Millennium.callServerMethod('No-Comment', 'UnFixGame', { appid: appid, installPath: window.__NoCommentGameInstallPath, contentScriptQuery: '' }).then(function(res){
                    const payload = typeof res === 'string' ? JSON.parse(res) : res;
                    if (payload && payload.success) {
                        showUnfixProgress(appid);
                    } else {
                        const errorKey = (payload && payload.error) ? String(payload.error) : '';
                        const errorMsg = (errorKey && (errorKey.startsWith('menu.error.') || errorKey.startsWith('common.'))) ? t(errorKey) : (errorKey || lt('Failed to start un-fix'));
                        ShowNoCommentAlert('No-Comment', errorMsg);
                    }
                }).catch(function(){
                    const msg = lt('Error starting un-fix');
                    ShowNoCommentAlert('No-Comment', msg);
                });
            } catch(err) { backendLog('NoComment: Un-Fix start error: ' + err); }
        }
    }

    function showFixesLoadingPopupAndCheck(appid) {
        if (document.querySelector('.NoComment-loading-fixes-overlay')) return;
        try { const d = document.querySelector('.NoComment-overlay'); if (d) d.remove(); } catch(_) {}
        try { closeToolsMenu(); } catch(_) {}
        try { const f = document.querySelector('.NoComment-fixes-overlay'); if (f) f.remove(); } catch(_) {}

        ensureNoCommentStyles();
        const overlay = document.createElement('div');
        overlay.className = 'NoComment-loading-fixes-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:400px;max-width:560px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(102,192,244,0.3);animation:slideUp 0.1s ease-out;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:22px;color:#fff;margin-bottom:16px;font-weight:700;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        title.textContent = lt('Loading fixes...');

        const body = document.createElement('div');
        body.style.cssText = 'font-size:14px;line-height:1.6;margin-bottom:16px;color:#c7d5e0;';
        body.textContent = lt('Checking availability…');

        const progressWrap = document.createElement('div');
        progressWrap.style.cssText = 'background:rgba(42,71,94,0.5);height:12px;border-radius:4px;overflow:hidden;position:relative;border:1px solid rgba(102,192,244,0.3);';
        const progressBar = document.createElement('div');
        progressBar.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg, #66c0f4 0%, #a4d7f5 100%);transition:width 0.2s linear;box-shadow:0 0 10px rgba(102,192,244,0.5);';
        progressWrap.appendChild(progressBar);

        styleGreyscaleLoadingModal(modal);
        styleGreyscaleLoadingTitle(title);
        styleGreyscaleLoadingBody(body);
        styleGreyscaleLoadingProgress(progressWrap, progressBar, null);

        modal.appendChild(title);
        modal.appendChild(body);
        modal.appendChild(progressWrap);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        let progress = 0;
        const progressInterval = setInterval(function() {
            if (progress < 95) {
                progress += Math.random() * 5;
                progressBar.style.width = Math.min(progress, 95) + '%';
            }
        }, 200);

        Millennium.callServerMethod('No-Comment', 'CheckForFixes', { appid, contentScriptQuery: '' }).then(function(res){
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            if (payload && payload.success) {
                const isGameInstalled = window.__NoCommentGameIsInstalled === true;
                showFixesResultsPopup(payload, isGameInstalled);
            } else {
                const errText = (payload && payload.error) ? String(payload.error) : lt('Failed to check for fixes.');
                ShowNoCommentAlert('No-Comment', errText);
            }
        }).catch(function() {
            const msg = lt('Error checking for fixes');
            ShowNoCommentAlert('No-Comment', msg);
        }).finally(function() {
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            setTimeout(function() {
                try {
                    const l = document.querySelector('.NoComment-loading-fixes-overlay');
                    if (l) l.remove();
                } catch(_) {}
            }, 300);
        });
    }

    
    function applyFix(appid, downloadUrl, fixType, gameName, resultsOverlay) {
        try {
            
            if (resultsOverlay) {
                resultsOverlay.remove();
            }
            
            
            if (!window.__NoCommentGameInstallPath) {
                const msg = lt('Game install path not found');
                ShowNoCommentAlert('No-Comment', msg);
                return;
            }
            
            backendLog('NoComment: Applying fix ' + fixType + ' for appid ' + appid);
            
            
            Millennium.callServerMethod('No-Comment', 'ApplyGameFix', { 
                appid: appid, 
                downloadUrl: downloadUrl, 
                installPath: window.__NoCommentGameInstallPath,
                fixType: fixType,
                gameName: gameName || '',
                contentScriptQuery: '' 
            }).then(function(res){
                try {
                    const payload = typeof res === 'string' ? JSON.parse(res) : res;
                    if (payload && payload.success) {
                        
                        showFixDownloadProgress(appid, fixType);
                    } else {
                        const errorKey = (payload && payload.error) ? String(payload.error) : '';
                        const errorMsg = (errorKey && (errorKey.startsWith('menu.error.') || errorKey.startsWith('common.'))) ? t(errorKey) : (errorKey || lt('Failed to start fix download'));
                        ShowNoCommentAlert('No-Comment', errorMsg);
                    }
                } catch(err) {
                    backendLog('NoComment: ApplyGameFix response error: ' + err);
                    const msg = lt('Error applying fix');
                    ShowNoCommentAlert('No-Comment', msg);
                }
            }).catch(function(err){
                backendLog('NoComment: ApplyGameFix error: ' + err);
                const msg = lt('Error applying fix');
                ShowNoCommentAlert('No-Comment', msg);
            });
        } catch(err) {
            backendLog('NoComment: applyFix error: ' + err);
        }
    }

    
    function showFixDownloadProgress(appid, fixType) {
        
        if (document.querySelector('.NoComment-overlay')) return;

        ensureNoCommentStyles();
        const overlay = document.createElement('div');
        overlay.className = 'NoComment-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:400px;max-width:560px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(102,192,244,0.3);animation:slideUp 0.1s ease-out;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:22px;color:#fff;margin-bottom:16px;font-weight:700;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        title.textContent = lt('Applying {fix}').replace('{fix}', fixType);

        const body = document.createElement('div');
        body.style.cssText = 'font-size:15px;line-height:1.6;margin-bottom:20px;color:#c7d5e0;';
        body.innerHTML = '<div id="lt-fix-progress-msg">' + lt('Downloading...') + '</div>';

        const btnRow = document.createElement('div');
        btnRow.className = 'lt-fix-btn-row';
        btnRow.style.cssText = 'margin-top:16px;display:flex;gap:12px;justify-content:center;';

        const hideBtn = document.createElement('a');
        hideBtn.href = '#';
        hideBtn.className = 'NoComment-btn';
        hideBtn.style.flex = '1';
        hideBtn.innerHTML = `<span>${lt('Hide')}</span>`;
        hideBtn.onclick = function(e){ e.preventDefault(); overlay.remove(); };
        btnRow.appendChild(hideBtn);

        const cancelBtn = document.createElement('a');
        cancelBtn.href = '#';
        cancelBtn.className = 'NoComment-btn primary';
        cancelBtn.style.flex = '1';
        cancelBtn.innerHTML = `<span>${lt('Cancel')}</span>`;
        cancelBtn.onclick = function(e){
            e.preventDefault();
            if (cancelBtn.dataset.pending === '1') return;
            cancelBtn.dataset.pending = '1';
            const span = cancelBtn.querySelector('span');
            if (span) span.textContent = lt('Cancelling...');
            const msgEl = document.getElementById('lt-fix-progress-msg');
            if (msgEl) msgEl.textContent = lt('Cancelling...');
            Millennium.callServerMethod('No-Comment', 'CancelApplyFix', { appid: appid, contentScriptQuery: '' }).then(function(res){
                try {
                    const payload = typeof res === 'string' ? JSON.parse(res) : res;
                    if (!payload || payload.success !== true) {
                        throw new Error((payload && payload.error) || lt('Cancellation failed'));
                    }
                } catch(err) {
                    cancelBtn.dataset.pending = '0';
                    if (span) span.textContent = lt('Cancel');
                    const msgEl2 = document.getElementById('lt-fix-progress-msg');
                    if (msgEl2 && msgEl2.dataset.last) msgEl2.textContent = msgEl2.dataset.last;
                    backendLog('NoComment: CancelApplyFix response error: ' + err);
                    const msg = lt('Failed to cancel fix download');
                    ShowNoCommentAlert('No-Comment', msg);
                }
            }).catch(function(err){
                cancelBtn.dataset.pending = '0';
                const span2 = cancelBtn.querySelector('span');
                if (span2) span2.textContent = lt('Cancel');
                const msgEl2 = document.getElementById('lt-fix-progress-msg');
                if (msgEl2 && msgEl2.dataset.last) msgEl2.textContent = msgEl2.dataset.last;
                backendLog('NoComment: CancelApplyFix error: ' + err);
                const msg = lt('Failed to cancel fix download');
                ShowNoCommentAlert('No-Comment', msg);
            });
        };
        btnRow.appendChild(cancelBtn);

        styleGreyscaleLoadingModal(modal);
        styleGreyscaleLoadingTitle(title);
        styleGreyscaleLoadingBody(body);
        styleGreyscaleLoadingButton(hideBtn, false);
        styleGreyscaleLoadingButton(cancelBtn, true);

        modal.appendChild(title);
        modal.appendChild(body);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        
        pollFixProgress(appid, fixType);
    }

    function replaceFixButtonsWithClose(overlayEl) {
        if (!overlayEl) return;
        const btnRow = overlayEl.querySelector('.lt-fix-btn-row');
        if (!btnRow) return;
        btnRow.innerHTML = '';
        btnRow.style.cssText = 'margin-top:16px;display:flex;justify-content:flex-end;';
        const closeBtn = document.createElement('a');
        closeBtn.href = '#';
        closeBtn.className = 'NoComment-btn primary';
        closeBtn.style.minWidth = '140px';
        closeBtn.innerHTML = `<span>${lt('Close')}</span>`;
        closeBtn.onclick = function(e){ e.preventDefault(); overlayEl.remove(); };
        styleGreyscaleLoadingButton(closeBtn, true);
        btnRow.appendChild(closeBtn);
    }

    
    function pollFixProgress(appid, fixType) {
        const poll = function() {
            try {
                const overlayEl = document.querySelector('.NoComment-overlay');
                if (!overlayEl) return; 
                
                Millennium.callServerMethod('No-Comment', 'GetApplyFixStatus', { appid: appid, contentScriptQuery: '' }).then(function(res){
                    try {
                        const payload = typeof res === 'string' ? JSON.parse(res) : res;
                        if (payload && payload.success && payload.state) {
                            const state = payload.state;
                            const msgEl = document.getElementById('lt-fix-progress-msg');
                            
                            if (state.status === 'downloading') {
                                const pct = state.totalBytes > 0 ? Math.floor((state.bytesRead / state.totalBytes) * 100) : 0;
                                if (msgEl) { msgEl.textContent = lt('Downloading: {percent}%').replace('{percent}', pct); msgEl.dataset.last = msgEl.textContent; }
                                setTimeout(poll, 500);
                            } else if (state.status === 'extracting') {
                                if (msgEl) { msgEl.textContent = lt('Extracting to game folder...'); msgEl.dataset.last = msgEl.textContent; }
                                setTimeout(poll, 500);
                            } else if (state.status === 'cancelled') {
                                if (msgEl) msgEl.textContent = lt('Cancelled: {reason}').replace('{reason}', state.error || lt('Cancelled by user'));
                                replaceFixButtonsWithClose(overlayEl);
                                return;
                            } else if (state.status === 'done') {
                                if (msgEl) msgEl.textContent = lt('{fix} applied successfully!').replace('{fix}', fixType);
                                replaceFixButtonsWithClose(overlayEl);
                                return; 
                            } else if (state.status === 'failed') {
                                if (msgEl) msgEl.textContent = lt('Failed: {error}').replace('{error}', state.error || lt('Unknown error'));
                                replaceFixButtonsWithClose(overlayEl);
                                return; 
                            } else {
                                
                                setTimeout(poll, 500);
                            }
                        }
                    } catch(err) {
                        backendLog('NoComment: GetApplyFixStatus error: ' + err);
                    }
                });
            } catch(err) {
                backendLog('NoComment: pollFixProgress error: ' + err);
            }
        };
        setTimeout(poll, 500);
    }

    
    function showUnfixProgress(appid) {
        
        try { const old = document.querySelector('.NoComment-unfix-overlay'); if (old) old.remove(); } catch(_) {}

        ensureNoCommentStyles();
        const overlay = document.createElement('div');
        overlay.className = 'NoComment-unfix-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:400px;max-width:560px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(102,192,244,0.3);animation:slideUp 0.1s ease-out;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:22px;color:#fff;margin-bottom:16px;font-weight:700;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        title.textContent = lt('Un-Fixing game');

        const body = document.createElement('div');
        body.style.cssText = 'font-size:15px;line-height:1.6;margin-bottom:20px;color:#c7d5e0;';
        body.innerHTML = '<div id="lt-unfix-progress-msg">' + lt('Removing fix files...') + '</div>';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-top:16px;display:flex;justify-content:center;';
        const hideBtn = document.createElement('a');
        hideBtn.href = '#';
        hideBtn.className = 'NoComment-btn';
        hideBtn.style.minWidth = '140px';
        hideBtn.innerHTML = `<span>${lt('Hide')}</span>`;
        hideBtn.onclick = function(e){ e.preventDefault(); overlay.remove(); };
        btnRow.appendChild(hideBtn);

        styleGreyscaleLoadingModal(modal);
        styleGreyscaleLoadingTitle(title);
        styleGreyscaleLoadingBody(body);
        styleGreyscaleLoadingButton(hideBtn, false);

        modal.appendChild(title);
        modal.appendChild(body);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        
        pollUnfixProgress(appid);
    }

    
    function pollUnfixProgress(appid) {
        const poll = function() {
            try {
                const overlayEl = document.querySelector('.NoComment-unfix-overlay');
                if (!overlayEl) return; 
                
                Millennium.callServerMethod('No-Comment', 'GetUnfixStatus', { appid: appid, contentScriptQuery: '' }).then(function(res){
                    try {
                        const payload = typeof res === 'string' ? JSON.parse(res) : res;
                        if (payload && payload.success && payload.state) {
                            const state = payload.state;
                            const msgEl = document.getElementById('lt-unfix-progress-msg');
                            
                            if (state.status === 'removing') {
                                if (msgEl) msgEl.textContent = state.progress || lt('Removing fix files...');
                                
                                setTimeout(poll, 500);
                            } else if (state.status === 'done') {
                                const filesRemoved = state.filesRemoved || 0;
                                if (msgEl) msgEl.textContent = lt('Removed {count} files. Running Steam verification...').replace('{count}', filesRemoved);
                                
                                try {
                                    const btnRow = overlayEl.querySelector('div[style*="justify-content:flex-end"]');
                                    if (btnRow) {
                                        btnRow.innerHTML = '';
                                        const closeBtn = document.createElement('a');
                                        closeBtn.href = '#';
                                        closeBtn.className = 'NoComment-btn primary';
                                        closeBtn.style.minWidth = '140px';
                                        closeBtn.innerHTML = `<span>${lt('Close')}</span>`;
                                        closeBtn.onclick = function(e){ e.preventDefault(); overlayEl.remove(); };
                                        styleGreyscaleLoadingButton(closeBtn, true);
                                        btnRow.appendChild(closeBtn);
                                    }
                                } catch(_) {}
                                
                                
                                setTimeout(function(){
                                    try {
                                        const verifyUrl = 'steam://validate/' + appid;
                                        window.location.href = verifyUrl;
                                        backendLog('NoComment: Running verify for appid ' + appid);
                                    } catch(_) {}
                                }, 1000);
                                
                                return; 
                            } else if (state.status === 'failed') {
                                if (msgEl) msgEl.textContent = lt('Failed: {error}').replace('{error}', state.error || lt('Unknown error'));
                                
                                try {
                                    const btnRow = overlayEl.querySelector('div[style*="justify-content:flex-end"]');
                                    if (btnRow) {
                                        btnRow.innerHTML = '';
                                        const closeBtn = document.createElement('a');
                                        closeBtn.href = '#';
                                        closeBtn.className = 'NoComment-btn primary';
                                        closeBtn.style.minWidth = '140px';
                                        closeBtn.innerHTML = `<span>${lt('Close')}</span>`;
                                        closeBtn.onclick = function(e){ e.preventDefault(); overlayEl.remove(); };
                                        styleGreyscaleLoadingButton(closeBtn, true);
                                        btnRow.appendChild(closeBtn);
                                    }
                                } catch(_) {}
                                return; 
                            } else {
                                
                                setTimeout(poll, 500);
                            }
                        }
                    } catch(err) {
                        backendLog('NoComment: GetUnfixStatus error: ' + err);
                    }
                });
            } catch(err) {
                backendLog('NoComment: pollUnfixProgress error: ' + err);
            }
        };
        setTimeout(poll, 500);
    }

    function fetchSettingsConfig(forceRefresh) {
        try {
            if (!forceRefresh && window.__NoCommentSettings && Array.isArray(window.__NoCommentSettings.schema)) {
                return Promise.resolve(window.__NoCommentSettings);
            }
        } catch(_) {}

        if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
            return Promise.reject(new Error(lt('NoComment backend unavailable')));
        }

        return Millennium.callServerMethod('No-Comment', 'GetSettingsConfig', { contentScriptQuery: '' }).then(function(res){
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            if (!payload || payload.success !== true) {
                const errorMsg = (payload && payload.error) ? String(payload.error) : t('settings.error', 'Failed to load settings.');
                throw new Error(errorMsg);
            }
            const config = {
                schemaVersion: payload.schemaVersion || 0,
                schema: Array.isArray(payload.schema) ? payload.schema : [],
                values: (payload && payload.values && typeof payload.values === 'object') ? payload.values : {},
                language: payload && payload.language ? String(payload.language) : 'en',
                locales: Array.isArray(payload && payload.locales) ? payload.locales : [],
                translations: (payload && payload.translations && typeof payload.translations === 'object') ? payload.translations : {},
                lastFetched: Date.now()
            };
            applyTranslationBundle({
                language: config.language,
                locales: config.locales,
                strings: config.translations
            });
            window.__NoCommentSettings = config;
            return config;
        });
    }

    function initialiseSettingsDraft(config) {
        const values = JSON.parse(JSON.stringify((config && config.values) || {}));
        if (!config || !Array.isArray(config.schema)) {
            return values;
        }
        for (let i = 0; i < config.schema.length; i++) {
            const group = config.schema[i];
            if (!group || !group.key) continue;
            if (typeof values[group.key] !== 'object' || values[group.key] === null || Array.isArray(values[group.key])) {
                values[group.key] = {};
            }
            const options = Array.isArray(group.options) ? group.options : [];
            for (let j = 0; j < options.length; j++) {
                const option = options[j];
                if (!option || !option.key) continue;
                if (typeof values[group.key][option.key] === 'undefined') {
                    values[group.key][option.key] = option.default;
                }
            }
        }
        return values;
    }

    function showSettingsManagerPopup(forceRefresh, onBack) {
        if (document.querySelector('.NoComment-settings-manager-overlay')) return;

        try { closeToolsMenu(); } catch(_) {}

        ensureNoCommentStyles();
        ensureFontAwesome();

        const overlay = document.createElement('div');
        overlay.className = 'NoComment-settings-manager-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:100000;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.className = 'NoComment-settings-manager-modal';
        modal.style.cssText = 'position:relative;border-radius:8px;min-width:650px;max-width:750px;max-height:85vh;display:flex;flex-direction:column;animation:slideUp 0.1s ease-out;overflow:hidden;';

        const header = document.createElement('div');
        header.className = 'NoComment-settings-manager-header';
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:22px 24px 14px;';

        const title = document.createElement('div');
        title.className = 'NoComment-settings-manager-title';
        title.style.cssText = 'font-size:22px;font-weight:700;';
        title.textContent = t('settings.title', 'NoComment · Settings');

        const iconButtons = document.createElement('div');
        iconButtons.style.cssText = 'display:flex;gap:12px;';

        const closeIconBtn = document.createElement('a');
        closeIconBtn.href = '#';
        closeIconBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:rgba(48,48,48,0.8);border:1px solid rgba(150,150,150,0.35);border-radius:10px;color:#d0d0d0;font-size:18px;text-decoration:none;transition:all 0.3s ease;cursor:pointer;';
        closeIconBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeIconBtn.title = t('settings.close', 'Close');
        closeIconBtn.onmouseover = function() { this.style.background = 'rgba(70,70,70,0.9)'; this.style.transform = 'translateY(-2px) scale(1.05)'; this.style.boxShadow = '0 8px 16px rgba(0,0,0,0.45)'; this.style.borderColor = 'rgba(200,200,200,0.6)'; };
        closeIconBtn.onmouseout = function() { this.style.background = 'rgba(48,48,48,0.8)'; this.style.transform = 'translateY(0) scale(1)'; this.style.boxShadow = 'none'; this.style.borderColor = 'rgba(150,150,150,0.35)'; };
        iconButtons.appendChild(closeIconBtn);

        const contentWrap = document.createElement('div');
        contentWrap.className = 'NoComment-settings-manager-content';
        contentWrap.style.cssText = 'flex:1 1 auto;overflow-y:auto;overflow-x:hidden;padding:18px;margin:0 24px;border-radius:12px;';

        const tabsBar = document.createElement('div');
        tabsBar.className = 'NoComment-settings-tabs';

        const statusRow = document.createElement('div');
        statusRow.style.cssText = 'padding:6px 24px 0;min-height:20px;display:flex;align-items:center;justify-content:center;';
        const statusLine = document.createElement('div');
        statusLine.className = 'NoComment-settings-status';
        statusLine.style.cssText = 'font-size:12px;line-height:18px;color:#cfcfcf;min-height:18px;text-align:center;max-width:100%;';
        statusRow.appendChild(statusLine);

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'padding:18px 24px 22px;display:flex;gap:12px;justify-content:space-between;align-items:center;';

        const backBtn = createSettingsButton('back', '<i class="fa-solid fa-arrow-left"></i>');
        const rightButtons = document.createElement('div');
        rightButtons.style.cssText = 'display:flex;gap:8px;';
        const refreshBtn = createSettingsButton('refresh', '<i class="fa-solid fa-arrow-rotate-right"></i>');
        const saveBtn = createSettingsButton('save', '<i class="fa-solid fa-floppy-disk"></i>', true);

        modal.appendChild(header);
        modal.appendChild(tabsBar);
        modal.appendChild(statusRow);
        modal.appendChild(contentWrap);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const state = {
            config: null,
            draft: {},
        };

        let refreshDefaultLabel = '';
        let saveDefaultLabel = '';
        let closeDefaultLabel = '';
        let backDefaultLabel = '';
        let activeTab = 'settings';
        const tabButtons = {};

        function createSettingsButton(id, text, isPrimary) {
            const btn = document.createElement('a');
            btn.id = 'lt-settings-' + id;
            btn.href = '#';
            btn.innerHTML = '<span>' + text + '</span>';

            btn.className = 'NoComment-btn';
            if (isPrimary) {
                btn.classList.add('primary');
            }

            btn.onmouseover = function() {
                if (this.dataset.disabled === '1') {
                    this.style.opacity = '0.6';
                    this.style.cursor = 'not-allowed';
                    return;
                }
            };

            btn.onmouseout = function() {
                if (this.dataset.disabled === '1') {
                    this.style.opacity = '0.5';
                    return;
                }
            };

            if (isPrimary) {
                btn.dataset.disabled = '1';
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }

            return btn;
        }

        header.appendChild(title);
        header.appendChild(iconButtons);
        function applyStaticTranslations() {
            title.textContent = t('settings.title', 'NoComment · Settings');
            refreshBtn.title = t('settings.refresh', 'Refresh');
            saveBtn.title = t('settings.save', 'Save Settings');
            backBtn.title = t('Back', 'Back');
            closeIconBtn.title = t('settings.close', 'Close');
            if (typeof updateTabLabels === 'function') {
                updateTabLabels();
            }
        }
        applyStaticTranslations();

        const tabs = [
            { id: 'settings', label: t('settings.tab.settings', 'Settings') },
            { id: 'games', label: t('settings.tab.games', 'Games') },
            { id: 'fixes', label: t('settings.tab.fixes', 'Online Fix') },
        ];
        tabs.forEach(function(tab) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'NoComment-settings-tab';
            btn.textContent = tab.label;
            btn.dataset.tab = tab.id;
            tabsBar.appendChild(btn);
            tabButtons[tab.id] = btn;
        });

        Object.keys(tabButtons).forEach(function(key) {
            const btn = tabButtons[key];
            if (!btn) return;
            btn.addEventListener('click', function(e){
                e.preventDefault();
                if (key === activeTab) return;
                setActiveTab(key);
            });
        });

        function updateTabLabels() {
            if (tabButtons.settings) tabButtons.settings.textContent = t('settings.tab.settings', 'Settings');
            if (tabButtons.games) tabButtons.games.textContent = t('settings.tab.games', 'Games');
            if (tabButtons.fixes) tabButtons.fixes.textContent = t('settings.tab.fixes', 'Online Fix');
        }
        updateTabLabels();

        function setStatus(text, color) {
            statusLine.textContent = text || '';
            statusLine.style.color = color || '#cfcfcf';
        }

        function clearStatus() {
            statusLine.textContent = '';
            statusLine.style.color = '#cfcfcf';
        }

        function ensureDraftGroup(groupKey) {
            if (!state.draft[groupKey] || typeof state.draft[groupKey] !== 'object') {
                state.draft[groupKey] = {};
            }
            return state.draft[groupKey];
        }

        function collectChanges() {
            if (!state.config || !Array.isArray(state.config.schema)) {
                return {};
            }
            const changes = {};
            for (let i = 0; i < state.config.schema.length; i++) {
                const group = state.config.schema[i];
                if (!group || !group.key) continue;
                const options = Array.isArray(group.options) ? group.options : [];
                const draftGroup = state.draft[group.key] || {};
                const originalGroup = (state.config.values && state.config.values[group.key]) || {};
                const groupChanges = {};
                for (let j = 0; j < options.length; j++) {
                    const option = options[j];
                    if (!option || !option.key) continue;
                    const newValue = draftGroup.hasOwnProperty(option.key) ? draftGroup[option.key] : option.default;
                    const oldValue = originalGroup.hasOwnProperty(option.key) ? originalGroup[option.key] : option.default;
                    if (newValue !== oldValue) {
                        groupChanges[option.key] = newValue;
                    }
                }
                if (Object.keys(groupChanges).length > 0) {
                    changes[group.key] = groupChanges;
                }
            }
            return changes;
        }

        function updateSaveState() {
            const hasChanges = Object.keys(collectChanges()).length > 0;
            const isBusy = saveBtn.dataset.busy === '1';
            if (hasChanges && !isBusy) {
                saveBtn.dataset.disabled = '0';
                saveBtn.style.opacity = '';
                saveBtn.style.cursor = 'pointer';
            } else {
                saveBtn.dataset.disabled = '1';
                saveBtn.style.opacity = '0.6';
                saveBtn.style.cursor = 'not-allowed';
            }
        }

        function optionLabelKey(groupKey, optionKey) {
            if (groupKey === 'general') {
                if (optionKey === 'language') return 'settings.language.label';
            }
            return null;
        }

        function optionDescriptionKey(groupKey, optionKey) {
            if (groupKey === 'general') {
                if (optionKey === 'language') return 'settings.language.description';
            }
            return null;
        }

        function renderSettings() {
            contentWrap.innerHTML = '';
            if (!state.config || !Array.isArray(state.config.schema) || state.config.schema.length === 0) {
                const emptyState = document.createElement('div');
                emptyState.style.cssText = 'padding:14px;background:#1a1a1a;border:1px solid #3a3a3a;border-radius:4px;color:#cfcfcf;';
                emptyState.textContent = t('settings.empty', 'No settings available yet.');
                contentWrap.appendChild(emptyState);
                updateSaveState();
                return;
            }

            for (let i = 0; i < state.config.schema.length; i++) {
                const group = state.config.schema[i];
                if (!group || !group.key) continue;

                const groupEl = document.createElement('div');
                groupEl.style.cssText = 'margin-bottom:18px;';

                const groupTitle = document.createElement('div');
                groupTitle.textContent = t('settings.' + group.key, group.label || group.key);
                if (group.key === 'general') {
                    groupTitle.style.cssText = 'font-size:20px;color:#e6e6e6;margin-bottom:16px;margin-top:0;font-weight:600;text-align:center;';
                } else {
                    groupTitle.style.cssText = 'font-size:14px;font-weight:600;color:#bdbdbd;text-align:center;';
                }
                groupEl.appendChild(groupTitle);

                if (group.description && group.key !== 'general') {
                    const groupDesc = document.createElement('div');
                    groupDesc.style.cssText = 'margin-top:4px;font-size:12px;color:#b0b0b0;';
                    groupDesc.textContent = t('settings.' + group.key + 'Description', group.description);
                    groupEl.appendChild(groupDesc);
                }

                const options = Array.isArray(group.options) ? group.options : [];
                for (let j = 0; j < options.length; j++) {
                    const option = options[j];
                    if (!option || !option.key) continue;
                    if (group.key === 'general' && option.key === 'donateKeys') {
                        continue;
                    }

                    ensureDraftGroup(group.key);
                    if (!state.draft[group.key].hasOwnProperty(option.key)) {
                        const sourceGroup = (state.config.values && state.config.values[group.key]) || {};
                        const initialValue = sourceGroup.hasOwnProperty(option.key) ? sourceGroup[option.key] : option.default;
                        state.draft[group.key][option.key] = initialValue;
                    }

                    const optionEl = document.createElement('div');
                    if (j === 0) {
                        optionEl.style.cssText = 'margin-top:12px;padding-top:0;';
                    } else {
                        optionEl.style.cssText = 'margin-top:12px;padding-top:12px;border-top:1px solid rgba(120,120,120,0.15);';
                    }

                    const optionLabel = document.createElement('div');
                    optionLabel.style.cssText = 'font-size:13px;font-weight:500;color:#e0e0e0;';
                    const labelKey = optionLabelKey(group.key, option.key);
                    optionLabel.textContent = t(labelKey || ('settings.' + group.key + '.' + option.key + '.label'), option.label || option.key);
                    optionEl.appendChild(optionLabel);

                    if (option.description) {
                        const optionDesc = document.createElement('div');
                        optionDesc.style.cssText = 'margin-top:2px;font-size:11px;color:#b0b0b0;';
                        const descKey = optionDescriptionKey(group.key, option.key);
                        optionDesc.textContent = t(descKey || ('settings.' + group.key + '.' + option.key + '.description'), option.description);
                        optionEl.appendChild(optionDesc);
                    }

                    const controlWrap = document.createElement('div');
                    controlWrap.style.cssText = 'margin-top:8px;';

                    if (option.type === 'select') {
                        const selectEl = document.createElement('select');
                        selectEl.style.cssText = 'width:100%;padding:6px 8px;background:#1c1c1c;color:#e0e0e0;border:1px solid #3a3a3a;border-radius:4px;';

                        const choices = Array.isArray(option.choices) ? option.choices : [];
                        for (let c = 0; c < choices.length; c++) {
                            const choice = choices[c];
                            if (!choice) continue;
                            const choiceOption = document.createElement('option');
                            choiceOption.value = String(choice.value);
                            choiceOption.textContent = choice.label || choice.value;
                            selectEl.appendChild(choiceOption);
                        }

                        const currentValue = state.draft[group.key][option.key];
                        if (typeof currentValue !== 'undefined') {
                            selectEl.value = String(currentValue);
                        }

                        selectEl.addEventListener('change', function(){
                            state.draft[group.key][option.key] = selectEl.value;
                            try { backendLog('NoComment: language select changed to ' + selectEl.value); } catch(_) {}
                            updateSaveState();
                            setStatus(t('settings.unsaved', 'Unsaved changes'), '#c7d5e0');
                        });

                        controlWrap.appendChild(selectEl);
                    } else if (option.type === 'toggle') {
                        const toggleWrap = document.createElement('div');
                        toggleWrap.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;';

                        let yesLabel = option.metadata && option.metadata.yesLabel ? String(option.metadata.yesLabel) : 'Yes';
                        let noLabel = option.metadata && option.metadata.noLabel ? String(option.metadata.noLabel) : 'No';

                        const yesBtn = document.createElement('a');
                        yesBtn.href = '#';
                        yesBtn.innerHTML = '<span>' + yesLabel + '</span>';
                        yesBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:130px;padding:7px 14px;border-radius:10px;border:1px solid rgba(150,150,150,0.35);background:linear-gradient(180deg, rgba(56,56,56,0.75), rgba(34,34,34,0.92));color:#d6d6d6;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.2px;transition:all 0.18s ease;box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);';

                        const noBtn = document.createElement('a');
                        noBtn.href = '#';
                        noBtn.innerHTML = '<span>' + noLabel + '</span>';
                        noBtn.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;min-width:160px;padding:7px 14px;border-radius:10px;border:1px solid rgba(150,150,150,0.35);background:linear-gradient(180deg, rgba(56,56,56,0.75), rgba(34,34,34,0.92));color:#d6d6d6;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:0.2px;transition:all 0.18s ease;box-shadow:inset 0 1px 0 rgba(255,255,255,0.05);';

                        const yesSpan = yesBtn.querySelector('span');
                        const noSpan = noBtn.querySelector('span');

                        function applyToggleButtonState(btn, isActive) {
                            btn.dataset.active = isActive ? '1' : '0';
                            if (isActive) {
                                btn.style.background = 'linear-gradient(180deg, rgba(175,175,175,0.9), rgba(122,122,122,0.95))';
                                btn.style.borderColor = 'rgba(230,230,230,0.68)';
                                btn.style.color = '#ffffff';
                                btn.style.boxShadow = '0 6px 16px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.18)';
                                btn.style.transform = 'translateY(-1px)';
                            } else {
                                btn.style.background = 'linear-gradient(180deg, rgba(56,56,56,0.75), rgba(34,34,34,0.92))';
                                btn.style.borderColor = 'rgba(150,150,150,0.35)';
                                btn.style.color = '#d6d6d6';
                                btn.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.05)';
                                btn.style.transform = 'translateY(0)';
                            }
                        }

                        function wireToggleHover(btn) {
                            btn.addEventListener('mouseenter', function() {
                                if (btn.dataset.active === '1') return;
                                btn.style.borderColor = 'rgba(205,205,205,0.5)';
                                btn.style.color = '#f1f1f1';
                                btn.style.transform = 'translateY(-1px)';
                            });
                            btn.addEventListener('mouseleave', function() {
                                if (btn.dataset.active === '1') return;
                                btn.style.borderColor = 'rgba(150,150,150,0.35)';
                                btn.style.color = '#d6d6d6';
                                btn.style.transform = 'translateY(0)';
                            });
                        }

                        wireToggleHover(yesBtn);
                        wireToggleHover(noBtn);

                        function refreshToggleButtons() {
                            const currentValue = state.draft[group.key][option.key] === true;
                            applyToggleButtonState(yesBtn, currentValue);
                            applyToggleButtonState(noBtn, !currentValue);
                            if (yesSpan) yesSpan.style.color = yesBtn.style.color;
                            if (noSpan) noSpan.style.color = noBtn.style.color;
                        }

                        yesBtn.addEventListener('click', function(e){
                            e.preventDefault();
                            state.draft[group.key][option.key] = true;
                            refreshToggleButtons();
                            updateSaveState();
                            setStatus(t('settings.unsaved', 'Unsaved changes'), '#c7d5e0');
                        });

                        noBtn.addEventListener('click', function(e){
                            e.preventDefault();
                            state.draft[group.key][option.key] = false;
                            refreshToggleButtons();
                            updateSaveState();
                            setStatus(t('settings.unsaved', 'Unsaved changes'), '#c7d5e0');
                        });

                        toggleWrap.appendChild(yesBtn);
                        toggleWrap.appendChild(noBtn);
                        controlWrap.appendChild(toggleWrap);
                        refreshToggleButtons();
                    } else {
                        const unsupported = document.createElement('div');
                        unsupported.style.cssText = 'font-size:12px;color:#ffb347;';
                        unsupported.textContent = lt('common.error.unsupportedOption').replace('{type}', option.type);
                        controlWrap.appendChild(unsupported);
                    }

                    optionEl.appendChild(controlWrap);
                    groupEl.appendChild(optionEl);
                }

                contentWrap.appendChild(groupEl);
            }

            updateSaveState();
        }

        function renderInstalledFixesSection(target, titleOverride, filterFn) {
            const host = target || contentWrap;
            const sectionEl = document.createElement('div');
            sectionEl.id = 'NoComment-installed-fixes-section';
            sectionEl.style.cssText = 'margin-top:8px;padding:18px;background:linear-gradient(135deg, rgba(70,70,70,0.2) 0%, rgba(30,30,30,0.6) 100%);border:1px solid rgba(150,150,150,0.35);border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03);position:relative;overflow:hidden;';

            const sectionGlow = document.createElement('div');
            sectionGlow.style.cssText = 'position:absolute;top:-100%;left:-100%;width:300%;height:300%;background:radial-gradient(circle, rgba(180,180,180,0.08) 0%, transparent 70%);pointer-events:none;';
            sectionEl.appendChild(sectionGlow);

            const sectionTitle = document.createElement('div');
            sectionTitle.style.cssText = 'font-size:18px;color:#e6e6e6;margin-bottom:16px;font-weight:700;text-align:center;text-shadow:none;position:relative;z-index:1;letter-spacing:0.5px;';
            sectionTitle.innerHTML = '<i class="fa-solid fa-wrench" style="margin-right:10px;"></i>' + (titleOverride || t('settings.installedFixes.title', 'Installed Fixes'));
            sectionEl.appendChild(sectionTitle);

            const listContainer = document.createElement('div');
            listContainer.id = 'NoComment-fixes-list';
            listContainer.style.cssText = 'min-height:50px;';
            sectionEl.appendChild(listContainer);

            host.appendChild(sectionEl);

            loadInstalledFixes(listContainer, filterFn);
        }

        function loadInstalledFixes(container, filterFn) {
            container.innerHTML = '<div style="padding:14px;text-align:center;color:#cfcfcf;">' + t('settings.installedFixes.loading', 'Scanning for installed fixes...') + '</div>';

            Millennium.callServerMethod('No-Comment', 'GetInstalledFixes', { contentScriptQuery: '' })
                .then(function(res) {
                    const response = typeof res === 'string' ? JSON.parse(res) : res;
                    if (!response || !response.success) {
                        container.innerHTML = '<div style="padding:14px;background:#2a1a1a;border:1px solid #ff5c5c;border-radius:4px;color:#ffb3b3;">' + t('settings.installedFixes.error', 'Failed to load installed fixes.') + '</div>';
                        return;
                    }

                    let fixes = Array.isArray(response.fixes) ? response.fixes : [];
                    if (typeof filterFn === 'function') {
                        fixes = fixes.filter(function(item){ return filterFn(item); });
                    }
                    if (fixes.length === 0) {
                        container.innerHTML = '<div style="padding:14px;background:#1a1a1a;border:1px solid #3a3a3a;border-radius:4px;color:#cfcfcf;text-align:center;">' + t('settings.installedFixes.empty', 'No fixes installed yet.') + '</div>';
                        return;
                    }

                    container.innerHTML = '';
                    for (let i = 0; i < fixes.length; i++) {
                        const fix = fixes[i];
                        const fixEl = createFixListItem(fix, container);
                        container.appendChild(fixEl);
                    }
                })
                .catch(function(err) {
                    container.innerHTML = '<div style="padding:14px;background:#2a1a1a;border:1px solid #ff5c5c;border-radius:4px;color:#ffb3b3;">' + t('settings.installedFixes.error', 'Failed to load installed fixes.') + '</div>';
                });
        }

        function createFixListItem(fix, container) {
            const itemEl = document.createElement('div');
            itemEl.style.cssText = 'margin-bottom:12px;padding:12px;background:rgba(20,20,20,0.85);border:1px solid rgba(140,140,140,0.3);border-radius:6px;display:flex;justify-content:space-between;align-items:center;transition:all 0.2s ease;';
            itemEl.onmouseover = function() { this.style.borderColor = '#bdbdbd'; this.style.background = 'rgba(28,28,28,0.95)'; };
            itemEl.onmouseout = function() { this.style.borderColor = 'rgba(140,140,140,0.3)'; this.style.background = 'rgba(20,20,20,0.85)'; };

            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = 'flex:1;';

            const gameName = document.createElement('div');
            gameName.style.cssText = 'font-size:14px;font-weight:600;color:#f0f0f0;margin-bottom:6px;';
            const fixNameText = fix.gameName ? String(fix.gameName) : '';
            gameName.textContent = fixNameText || ('Unknown Game (' + fix.appid + ')');
            if (!fixNameText || fixNameText.startsWith('Unknown Game') || fixNameText === lt('Unknown Game')) {
                fetchSteamGameName(fix.appid).then(function(name) {
                    if (!name) return;
                    fix.gameName = name;
                    gameName.textContent = name;
                }).catch(function(){});
            }
            infoDiv.appendChild(gameName);

            const detailsDiv = document.createElement('div');
            detailsDiv.style.cssText = 'font-size:11px;color:#b0b0b0;line-height:1.6;';

            if (fix.fixType) {
                const typeSpan = document.createElement('div');
                typeSpan.innerHTML = '<strong style="color:#d0d0d0;">' + t('settings.installedFixes.type', 'Type:') + '</strong> ' + fix.fixType;
                detailsDiv.appendChild(typeSpan);
            }

            if (fix.date) {
                const dateSpan = document.createElement('div');
                dateSpan.innerHTML = '<strong style="color:#d0d0d0;">' + t('settings.installedFixes.date', 'Installed:') + '</strong> ' + fix.date;
                detailsDiv.appendChild(dateSpan);
            }

            if (fix.filesCount > 0) {
                const filesSpan = document.createElement('div');
                filesSpan.innerHTML = '<strong style="color:#d0d0d0;">' + t('settings.installedFixes.files', '{count} files').replace('{count}', fix.filesCount) + '</strong>';
                detailsDiv.appendChild(filesSpan);
            }

            infoDiv.appendChild(detailsDiv);
            itemEl.appendChild(infoDiv);

            const deleteBtn = document.createElement('a');
            deleteBtn.href = '#';
            deleteBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:44px;height:44px;background:rgba(255,80,80,0.12);border:2px solid rgba(255,80,80,0.35);border-radius:12px;color:#ff5050;font-size:18px;text-decoration:none;transition:all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);cursor:pointer;flex-shrink:0;';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteBtn.title = t('settings.installedFixes.delete', 'Delete');
            deleteBtn.onmouseover = function() {
                this.style.background = 'rgba(255,80,80,0.25)';
                this.style.borderColor = 'rgba(255,80,80,0.6)';
                this.style.color = '#ff6b6b';
                this.style.transform = 'translateY(-2px) scale(1.05)';
                this.style.boxShadow = '0 6px 20px rgba(255,80,80,0.4), 0 0 0 4px rgba(255,80,80,0.1)';
            };
            deleteBtn.onmouseout = function() {
                this.style.background = 'rgba(255,80,80,0.12)';
                this.style.borderColor = 'rgba(255,80,80,0.35)';
                this.style.color = '#ff5050';
                this.style.transform = 'translateY(0) scale(1)';
                this.style.boxShadow = 'none';
            };

            deleteBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (deleteBtn.dataset.busy === '1') return;

                showNoCommentConfirm(
                    fix.gameName || 'No-Comment',
                    t('settings.installedFixes.deleteConfirm', 'Are you sure you want to remove this fix? This will delete fix files and run Steam verification.'),
                    function() {
                        
                        deleteBtn.dataset.busy = '1';
                        deleteBtn.style.opacity = '0.6';
                        deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

                        Millennium.callServerMethod('No-Comment', 'UnFixGame', {
                            appid: fix.appid,
                            installPath: fix.installPath || '',
                            fixDate: fix.date || '',
                            contentScriptQuery: ''
                        })
                        .then(function(res) {
                            const response = typeof res === 'string' ? JSON.parse(res) : res;
                            if (!response || !response.success) {
                                alert(t('settings.installedFixes.deleteError', 'Failed to remove fix.'));
                                deleteBtn.dataset.busy = '0';
                                deleteBtn.style.opacity = '1';
                                deleteBtn.innerHTML = '<span><i class="fa-solid fa-trash"></i> ' + t('settings.installedFixes.delete', 'Delete') + '</span>';
                                return;
                            }

                            
                            pollUnfixStatus(fix.appid, itemEl, deleteBtn, container);
                        })
                        .catch(function(err) {
                            alert(t('settings.installedFixes.deleteError', 'Failed to remove fix.') + ' ' + (err && err.message ? err.message : ''));
                            deleteBtn.dataset.busy = '0';
                            deleteBtn.style.opacity = '1';
                            deleteBtn.innerHTML = '<span><i class="fa-solid fa-trash"></i> ' + t('settings.installedFixes.delete', 'Delete') + '</span>';
                        });
                    },
                    function() {
                        
                    }
                );
            });

            itemEl.appendChild(deleteBtn);
            return itemEl;
        }

        function pollUnfixStatus(appid, itemEl, deleteBtn, container) {
            let pollCount = 0;
            const maxPolls = 60;

            function checkStatus() {
                if (pollCount >= maxPolls) {
                    alert(t('settings.installedFixes.deleteError', 'Failed to remove fix.') + ' (Timeout)');
                    deleteBtn.dataset.busy = '0';
                    deleteBtn.style.opacity = '1';
                    deleteBtn.innerHTML = '<span><i class="fa-solid fa-trash"></i> ' + t('settings.installedFixes.delete', 'Delete') + '</span>';
                    return;
                }

                pollCount++;

                Millennium.callServerMethod('No-Comment', 'GetUnfixStatus', { appid: appid, contentScriptQuery: '' })
                    .then(function(res) {
                        const response = typeof res === 'string' ? JSON.parse(res) : res;
                        if (!response || !response.success) {
                            setTimeout(checkStatus, 500);
                            return;
                        }

                        const state = response.state || {};
                        const status = state.status;

                        if (status === 'done' && state.success) {
                            
                            itemEl.style.transition = 'all 0.3s ease';
                            itemEl.style.opacity = '0';
                            itemEl.style.transform = 'translateX(-20px)';
                            setTimeout(function() {
                                itemEl.remove();
                                
                                if (container.children.length === 0) {
                                    container.innerHTML = '<div style="padding:14px;background:#102039;border:1px solid #2a475e;border-radius:4px;color:#c7d5e0;text-align:center;">' + t('settings.installedFixes.empty', 'No fixes installed yet.') + '</div>';
                                }
                            }, 300);
                            
                            
                            setTimeout(function(){
                                try {
                                    const verifyUrl = 'steam://validate/' + appid;
                                    window.location.href = verifyUrl;
                                    backendLog('NoComment: Running verify for appid ' + appid);
                                } catch(_) {}
                            }, 1000);
                            
                            return;
                        } else if (status === 'failed' || (status === 'done' && !state.success)) {
                            alert(t('settings.installedFixes.deleteError', 'Failed to remove fix.') + ' ' + (state.error || ''));
                            deleteBtn.dataset.busy = '0';
                            deleteBtn.style.opacity = '1';
                            deleteBtn.innerHTML = '<span><i class="fa-solid fa-trash"></i> ' + t('settings.installedFixes.delete', 'Delete') + '</span>';
                            return;
                        } else {
                            
                            setTimeout(checkStatus, 500);
                        }
                    })
                    .catch(function(err) {
                        setTimeout(checkStatus, 500);
                    });
            }

            checkStatus();
        }

        function renderInstalledLuaSection(target, titleOverride) {
            const host = target || contentWrap;
            const sectionEl = document.createElement('div');
            sectionEl.id = 'NoComment-installed-lua-section';
            sectionEl.style.cssText = 'margin-top:8px;padding:18px;background:linear-gradient(135deg, rgba(70,70,70,0.2) 0%, rgba(30,30,30,0.6) 100%);border:1px solid rgba(150,150,150,0.35);border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03);position:relative;overflow:hidden;';

            const sectionGlow = document.createElement('div');
            sectionGlow.style.cssText = 'position:absolute;top:-100%;left:-100%;width:300%;height:300%;background:radial-gradient(circle, rgba(180,180,180,0.08) 0%, transparent 70%);pointer-events:none;';
            sectionEl.appendChild(sectionGlow);

            const sectionTitle = document.createElement('div');
            sectionTitle.style.cssText = 'font-size:18px;color:#e6e6e6;margin-bottom:16px;font-weight:700;text-align:center;text-shadow:none;position:relative;z-index:1;letter-spacing:0.5px;';
            sectionTitle.innerHTML = '<i class="fa-solid fa-code" style="margin-right:10px;"></i>' + (titleOverride || t('settings.installedLua.title', 'Installed Lua Scripts'));
            sectionEl.appendChild(sectionTitle);

            const searchRow = document.createElement('div');
            searchRow.style.cssText = 'display:flex;gap:10px;align-items:center;margin-bottom:14px;position:relative;z-index:1;';
            const searchBox = document.createElement('div');
            searchBox.style.cssText = 'position:relative;flex:1;min-width:0;width:100%;';
            const searchIcon = document.createElement('i');
            searchIcon.className = 'fa-solid fa-magnifying-glass';
            searchIcon.style.cssText = 'position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#a8a8a8;font-size:12px;pointer-events:none;';
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = t('settings.installedLua.searchPlaceholder', 'Search games or AppID...');
            searchInput.style.cssText = 'display:block;width:100%;max-width:100%;box-sizing:border-box;margin:0;padding:10px 32px 10px 32px;border-radius:10px;border:1px solid rgba(150,150,150,0.35);background:rgba(15,15,15,0.65);color:#e0e0e0;font-size:13px;outline:none;box-shadow:inset 0 1px 2px rgba(0,0,0,0.35);';
            const clearBtn = document.createElement('button');
            clearBtn.type = 'button';
            clearBtn.style.cssText = 'position:absolute;right:6px;top:50%;transform:translateY(-50%);width:26px;height:26px;border-radius:8px;border:1px solid rgba(160,160,160,0.35);background:rgba(80,80,80,0.25);color:#d0d0d0;cursor:pointer;display:none;align-items:center;justify-content:center;padding:0;';
            clearBtn.innerHTML = '<i class="fa-solid fa-xmark" style="font-size:12px;"></i>';
            clearBtn.onmouseover = function() { this.style.background = 'rgba(120,120,120,0.35)'; this.style.borderColor = 'rgba(200,200,200,0.6)'; };
            clearBtn.onmouseout = function() { this.style.background = 'rgba(80,80,80,0.25)'; this.style.borderColor = 'rgba(160,160,160,0.35)'; };
            searchBox.appendChild(searchIcon);
            searchBox.appendChild(searchInput);
            searchBox.appendChild(clearBtn);
            searchRow.appendChild(searchBox);
            sectionEl.appendChild(searchRow);

            const listContainer = document.createElement('div');
            listContainer.id = 'NoComment-lua-list';
            listContainer.style.cssText = 'min-height:50px;';
            sectionEl.appendChild(listContainer);

            host.appendChild(sectionEl);

            loadInstalledLuaScripts(listContainer, searchInput, clearBtn);
        }

        function loadInstalledLuaScripts(container, searchInput, clearBtn) {
            if (searchInput) {
                searchInput.value = '';
                if (clearBtn) clearBtn.style.display = 'none';
            }
            container.innerHTML = '<div style="padding:14px;text-align:center;color:#cfcfcf;">' + t('settings.installedLua.loading', 'Scanning for installed Lua scripts...') + '</div>';

            Millennium.callServerMethod('No-Comment', 'GetInstalledLuaScripts', { contentScriptQuery: '' })
                .then(function(res) {
                    const response = typeof res === 'string' ? JSON.parse(res) : res;
                    if (!response || !response.success) {
                        container.innerHTML = '<div style="padding:14px;background:#2a1a1a;border:1px solid #ff5c5c;border-radius:4px;color:#ffb3b3;">' + t('settings.installedLua.error', 'Failed to load installed Lua scripts.') + '</div>';
                        return;
                    }

                    const scripts = Array.isArray(response.scripts) ? response.scripts : [];
                    if (scripts.length === 0) {
                        container.innerHTML = '<div style="padding:14px;background:#1a1a1a;border:1px solid #3a3a3a;border-radius:4px;color:#cfcfcf;text-align:center;">' + t('settings.installedLua.empty', 'No Lua scripts installed yet.') + '</div>';
                        return;
                    }

                    function renderLuaList(filtered, query) {
                        container.innerHTML = '';

                        if (filtered.length === 0) {
                            const empty = document.createElement('div');
                            empty.style.cssText = 'padding:14px;background:#1a1a1a;border:1px solid #3a3a3a;border-radius:4px;color:#cfcfcf;text-align:center;';
                            empty.textContent = query ? t('settings.installedLua.searchEmpty', 'No games match your search.') : t('settings.installedLua.empty', 'No Lua scripts installed yet.');
                            container.appendChild(empty);
                            return;
                        }

                        
                        for (let i = 0; i < filtered.length; i++) {
                            const script = filtered[i];
                            const scriptEl = createLuaListItem(script, container);
                            container.appendChild(scriptEl);
                        }
                    }

                    function applyFilter() {
                        const term = searchInput ? (searchInput.value || '').trim().toLowerCase() : '';
                        if (clearBtn) clearBtn.style.display = term ? 'flex' : 'none';
                        if (!term) {
                            renderLuaList(scripts, '');
                            return;
                        }

                        const filtered = scripts.filter(function(s) {
                            const name = (s.gameName || '').toLowerCase();
                            const appid = s.appid ? String(s.appid) : '';
                            return name.includes(term) || appid.includes(term);
                        });
                        renderLuaList(filtered, term);
                    }

                    if (searchInput) {
                        searchInput.addEventListener('input', applyFilter);
                        if (clearBtn) {
                            clearBtn.addEventListener('click', function() {
                                searchInput.value = '';
                                searchInput.focus();
                                applyFilter();
                            });
                        }
                    }

                    applyFilter();
                })
                .catch(function(err) {
                    container.innerHTML = '<div style="padding:14px;background:#2a1a1a;border:1px solid #ff5c5c;border-radius:4px;color:#ffb3b3;">' + t('settings.installedLua.error', 'Failed to load installed Lua scripts.') + '</div>';
                });
        }

        function createLuaListItem(script, container) {
            const itemEl = document.createElement('div');
            itemEl.style.cssText = 'margin-bottom:12px;padding:12px;background:rgba(20,20,20,0.85);border:1px solid rgba(140,140,140,0.3);border-radius:6px;display:flex;justify-content:space-between;align-items:center;transition:all 0.2s ease;';
            itemEl.onmouseover = function() { this.style.borderColor = '#bdbdbd'; this.style.background = 'rgba(28,28,28,0.95)'; };
            itemEl.onmouseout = function() { this.style.borderColor = 'rgba(140,140,140,0.3)'; this.style.background = 'rgba(20,20,20,0.85)'; };

            const infoDiv = document.createElement('div');
            infoDiv.style.cssText = 'flex:1;';

            const gameName = document.createElement('div');
            gameName.style.cssText = 'font-size:14px;font-weight:600;color:#f0f0f0;margin-bottom:6px;';
            const scriptNameText = script.gameName ? String(script.gameName) : '';
            gameName.textContent = scriptNameText || ('Unknown Game (' + script.appid + ')');
            if (!scriptNameText || scriptNameText.startsWith('Unknown Game') || scriptNameText === lt('Unknown Game')) {
                fetchSteamGameName(script.appid).then(function(name) {
                    if (!name) return;
                    script.gameName = name;
                    gameName.textContent = name;
                }).catch(function(){});
            }

            if (script.isDisabled) {
                const disabledBadge = document.createElement('span');
                disabledBadge.style.cssText = 'margin-left:8px;padding:2px 8px;background:rgba(140,140,140,0.2);border:1px solid rgba(200,200,200,0.5);border-radius:4px;font-size:10px;color:#e0e0e0;font-weight:500;';
                disabledBadge.textContent = t('settings.installedLua.disabled', 'Disabled');
                gameName.appendChild(disabledBadge);
            }

            infoDiv.appendChild(gameName);

            const detailsDiv = document.createElement('div');
            detailsDiv.style.cssText = 'font-size:11px;color:#b0b0b0;line-height:1.6;';

            if (script.modifiedDate) {
                const dateSpan = document.createElement('div');
                dateSpan.innerHTML = '<strong style="color:#d0d0d0;">' + t('settings.installedLua.modified', 'Modified:') + '</strong> ' + script.modifiedDate;
                detailsDiv.appendChild(dateSpan);
            }

            infoDiv.appendChild(detailsDiv);
            itemEl.appendChild(infoDiv);

            const actionsWrap = document.createElement('div');
            actionsWrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex-shrink:0;margin-left:12px;';

            function createActionButton(titleText, iconClass) {
                const btn = document.createElement('a');
                btn.href = '#';
                btn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:38px;height:38px;background:rgba(100,100,100,0.14);border:1px solid rgba(170,170,170,0.35);border-radius:10px;color:#e0e0e0;font-size:14px;text-decoration:none;transition:all 0.2s ease;cursor:pointer;';
                btn.innerHTML = '<i class="' + iconClass + '"></i>';
                btn.title = titleText;
                btn.onmouseover = function() {
                    this.style.background = 'rgba(140,140,140,0.24)';
                    this.style.borderColor = 'rgba(220,220,220,0.55)';
                    this.style.transform = 'translateY(-1px)';
                };
                btn.onmouseout = function() {
                    this.style.background = 'rgba(100,100,100,0.14)';
                    this.style.borderColor = 'rgba(170,170,170,0.35)';
                    this.style.transform = 'translateY(0)';
                };
                return btn;
            }

            const storeBtn = createActionButton(t('settings.installedLua.openStore', 'Open Store Page'), 'fa-solid fa-store');
            storeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                try {
                    if (typeof openSteamStore === 'function') {
                        openSteamStore(script.appid);
                    } else if (typeof openExternalUrl === 'function') {
                        openExternalUrl('https://store.steampowered.com/app/' + String(script.appid) + '/');
                    }
                } catch(_) {}
            });
            actionsWrap.appendChild(storeBtn);

            const steamDbBtn = createActionButton(t('settings.installedLua.openSteamDB', 'Open SteamDB Page'), 'fa-solid fa-database');
            steamDbBtn.addEventListener('click', function(e) {
                e.preventDefault();
                try {
                    if (typeof openSteamDbApp === 'function') {
                        openSteamDbApp(script.appid);
                    } else if (typeof openExternalUrl === 'function') {
                        openExternalUrl('https://steamdb.info/app/' + String(script.appid) + '/');
                    }
                } catch(_) {}
            });
            actionsWrap.appendChild(steamDbBtn);

            const deleteBtn = document.createElement('a');
            deleteBtn.href = '#';
            deleteBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;width:44px;height:44px;background:rgba(255,80,80,0.12);border:2px solid rgba(255,80,80,0.35);border-radius:12px;color:#ff5050;font-size:18px;text-decoration:none;transition:all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);cursor:pointer;flex-shrink:0;';
            deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteBtn.title = t('settings.installedLua.delete', 'Remove');
            deleteBtn.onmouseover = function() {
                this.style.background = 'rgba(255,80,80,0.25)';
                this.style.borderColor = 'rgba(255,80,80,0.6)';
                this.style.color = '#ff6b6b';
                this.style.transform = 'translateY(-2px) scale(1.05)';
                this.style.boxShadow = '0 6px 20px rgba(255,80,80,0.4), 0 0 0 4px rgba(255,80,80,0.1)';
            };
            deleteBtn.onmouseout = function() {
                this.style.background = 'rgba(255,80,80,0.12)';
                this.style.borderColor = 'rgba(255,80,80,0.35)';
                this.style.color = '#ff5050';
                this.style.transform = 'translateY(0) scale(1)';
                this.style.boxShadow = 'none';
            };

            deleteBtn.addEventListener('click', function(e) {
                e.preventDefault();
                if (deleteBtn.dataset.busy === '1') return;

                deleteBtn.dataset.busy = '1';
                deleteBtn.style.opacity = '0.6';
                deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

                Millennium.callServerMethod('No-Comment', 'DeleteNoCommentForApp', {
                    appid: script.appid,
                    contentScriptQuery: ''
                })
                .then(function(res) {
                    const response = typeof res === 'string' ? JSON.parse(res) : res;
                    if (!response || !response.success) {
                        alert(t('settings.installedLua.deleteError', 'Failed to remove Lua script.'));
                        deleteBtn.dataset.busy = '0';
                        deleteBtn.style.opacity = '1';
                        deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                        return;
                    }

                    try {
                        if (typeof invalidateInstalledLuaScriptsCache === 'function') {
                            invalidateInstalledLuaScriptsCache();
                        }
                    } catch(_) {}

                    itemEl.style.transition = 'all 0.3s ease';
                    itemEl.style.opacity = '0';
                    itemEl.style.transform = 'translateX(-20px)';
                    setTimeout(function() {
                        itemEl.remove();

                        if (container.children.length === 0) {
                            container.innerHTML = '<div style="padding:14px;background:#1a1a1a;border:1px solid #3a3a3a;border-radius:4px;color:#cfcfcf;text-align:center;">' + t('settings.installedLua.empty', 'No Lua scripts installed yet.') + '</div>';
                        }
                        scheduleRestartSteam(3);
                    }, 300);
                })
                .catch(function(err) {
                    alert(t('settings.installedLua.deleteError', 'Failed to remove Lua script.') + ' ' + (err && err.message ? err.message : ''));
                    deleteBtn.dataset.busy = '0';
                    deleteBtn.style.opacity = '1';
                    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                });
            });

            actionsWrap.appendChild(deleteBtn);
            itemEl.appendChild(actionsWrap);
            return itemEl;
        }

        function renderGamesTab() {
            contentWrap.innerHTML = '';
            clearStatus();
            renderInstalledLuaSection(contentWrap, t('settings.tab.gamesTitle', 'Games via NoComment'));
        }

        function renderFixesTab() {
            contentWrap.innerHTML = '';
            clearStatus();
            renderInstalledFixesSection(contentWrap, t('settings.tab.fixesTitle', 'Online Fix Installs'), function(item){
                const type = (item && item.fixType) ? String(item.fixType) : '';
                return type.toLowerCase().includes('online fix');
            });
        }

        function renderActiveTab() {
            if (activeTab === 'settings') {
                renderSettings();
                saveBtn.style.display = '';
            } else if (activeTab === 'games') {
                renderGamesTab();
                saveBtn.style.display = 'none';
            } else if (activeTab === 'fixes') {
                renderFixesTab();
                saveBtn.style.display = 'none';
            }
        }

        function setActiveTab(tabId) {
            activeTab = tabId;
            Object.keys(tabButtons).forEach(function(key) {
                if (tabButtons[key]) {
                    tabButtons[key].classList.toggle('active', key === tabId);
                }
            });
            renderActiveTab();
        }

        function handleLoad(force) {
            if (activeTab === 'settings') {
                setStatus(t('settings.loading', 'Loading settings...'), '#c7d5e0');
                saveBtn.dataset.disabled = '1';
                saveBtn.style.opacity = '0.6';
                contentWrap.innerHTML = '<div style="padding:20px;color:#c7d5e0;">' + t('common.status.loading', 'Loading...') + '</div>';
            }

            return fetchSettingsConfig(force).then(function(config){
                state.config = {
                    schemaVersion: config.schemaVersion,
                    schema: Array.isArray(config.schema) ? config.schema : [],
                    values: initialiseSettingsDraft(config),
                    language: config.language,
                    locales: config.locales,
                };
                state.draft = initialiseSettingsDraft(config);
                applyStaticTranslations();
                renderActiveTab();
                if (activeTab === 'settings') {
                    setStatus('', '#c7d5e0');
                }
            }).catch(function(err){
                const message = err && err.message ? err.message : t('settings.error', 'Failed to load settings.');
                if (activeTab === 'settings') {
                    contentWrap.innerHTML = '<div style="padding:20px;color:#ff5c5c;">' + message + '</div>';
                    setStatus(t('common.status.error', 'Error') + ': ' + message, '#ff5c5c');
                } else {
                    ShowNoCommentAlert('No-Comment', message);
                }
            });
        }

        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (typeof onBack === 'function') {
                overlay.remove();
                onBack();
            }
        });

        rightButtons.appendChild(refreshBtn);
        rightButtons.appendChild(saveBtn);
        btnRow.appendChild(backBtn);
        btnRow.appendChild(rightButtons);

        refreshBtn.addEventListener('click', function(e){
            e.preventDefault();
            if (refreshBtn.dataset.busy === '1') return;
            refreshBtn.dataset.busy = '1';
            handleLoad(true).finally(function(){
                refreshBtn.dataset.busy = '0';
                refreshBtn.style.opacity = '1';
                applyStaticTranslations();
            });
        });

        saveBtn.addEventListener('click', function(e){
            e.preventDefault();
            if (saveBtn.dataset.disabled === '1' || saveBtn.dataset.busy === '1') return;

            const changes = collectChanges();
            try { backendLog('NoComment: collectChanges payload ' + JSON.stringify(changes)); } catch(_) {}
            if (!changes || Object.keys(changes).length === 0) {
                setStatus(t('settings.noChanges', 'No changes to save.'), '#c7d5e0');
                updateSaveState();
                return;
            }

            saveBtn.dataset.busy = '1';
            saveBtn.style.opacity = '0.6';
            setStatus(t('settings.saving', 'Saving...'), '#c7d5e0');
            saveBtn.style.opacity = '0.6';

            const payloadToSend = JSON.parse(JSON.stringify(changes));
            try { backendLog('NoComment: sending settings payload ' + JSON.stringify(payloadToSend)); } catch(_) {}
            
            Millennium.callServerMethod('No-Comment', 'ApplySettingsChanges', {
                contentScriptQuery: '',
                changesJson: JSON.stringify(payloadToSend)
            }).then(function(res){
                const response = typeof res === 'string' ? JSON.parse(res) : res;
                if (!response || response.success !== true) {
                    if (response && response.errors) {
                        const errorParts = [];
                        for (const groupKey in response.errors) {
                            if (!Object.prototype.hasOwnProperty.call(response.errors, groupKey)) continue;
                            const optionErrors = response.errors[groupKey];
                            for (const optionKey in optionErrors) {
                                if (!Object.prototype.hasOwnProperty.call(optionErrors, optionKey)) continue;
                                const errorMsg = optionErrors[optionKey];
                                errorParts.push(groupKey + '.' + optionKey + ': ' + errorMsg);
                            }
                        }
                        const errText = errorParts.length ? errorParts.join('\n') : 'Validation failed.';
                        setStatus(errText, '#ff5c5c');
                    } else {
                        const message = (response && response.error) ? response.error : t('settings.saveError', 'Failed to save settings.');
                        setStatus(message, '#ff5c5c');
                    }
                    return;
                }

                const newValues = (response && response.values && typeof response.values === 'object') ? response.values : state.draft;
                state.config.values = initialiseSettingsDraft({ schema: state.config.schema, values: newValues });
                state.draft = initialiseSettingsDraft({ schema: state.config.schema, values: newValues });

                try {
                    if (window.__NoCommentSettings) {
                        window.__NoCommentSettings.values = JSON.parse(JSON.stringify(state.config.values));
                        window.__NoCommentSettings.schemaVersion = state.config.schemaVersion;
                        window.__NoCommentSettings.lastFetched = Date.now();
                        if (response && response.translations && typeof response.translations === 'object') {
                            window.__NoCommentSettings.translations = response.translations;
                        }
                        if (response && response.language) {
                            window.__NoCommentSettings.language = response.language;
                        }
                    }
                } catch(_) {}

                if (response && response.translations && typeof response.translations === 'object') {
                    applyTranslationBundle({
                        language: response.language || (window.__NoCommentI18n && window.__NoCommentI18n.language) || 'en',
                        locales: (window.__NoCommentI18n && window.__NoCommentI18n.locales) || (state.config && state.config.locales) || [],
                        strings: response.translations
                    });
                    applyStaticTranslations();
                    updateButtonTranslations();
                }

                renderSettings();
                setStatus(t('settings.saveSuccess', 'Settings saved successfully.'), '#8bc34a');
            }).catch(function(err){
                const message = err && err.message ? err.message : t('settings.saveError', 'Failed to save settings.');
                setStatus(message, '#ff5c5c');
            }).finally(function(){
                saveBtn.dataset.busy = '0';
                applyStaticTranslations();
                updateSaveState();
            });
        });

        closeIconBtn.addEventListener('click', function(e){
            e.preventDefault();
            overlay.remove();
        });

        overlay.addEventListener('click', function(e){
            if (e.target === overlay) {
            overlay.remove();
        }
        });

        setActiveTab(activeTab);
        handleLoad(!!forceRefresh);
    }

    

    function closeSettingsOverlay() {
        try {
            
            closeToolsMenu();
            
            var list = document.querySelectorAll('.NoComment-settings-overlay');
            for (var i = 0; i < list.length; i++) {
                if (list[i].classList && list[i].classList.contains('NoComment-tools-panel')) continue;
                try { list[i].remove(); } catch(_) {}
            }
            
            var list2 = document.getElementsByClassName('NoComment-overlay');
            while (list2 && list2.length > 0) {
                try { list2[0].remove(); } catch(_) { break; }
            }
        } catch(_) {}
    }

    
    function showNoCommentNotification(title, message, options) {
        ensureNoCommentStyles();
        var opts = (options && typeof options === 'object') ? options : {};
        var timeoutMs = (typeof opts.timeoutMs === 'number') ? opts.timeoutMs : 3000;

        var stack = document.querySelector('.NoComment-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'NoComment-toast-stack';
            document.body.appendChild(stack);
        }

        var toast = document.createElement('div');
        toast.className = 'NoComment-toast';

        var titleEl = document.createElement('div');
        titleEl.className = 'NoComment-toast-title';
        titleEl.textContent = String(title || 'No-Comment');

        var messageEl = document.createElement('div');
        messageEl.className = 'NoComment-toast-message';
        messageEl.textContent = String(message || '');

        function dismiss(reason) {
            if (toast.getAttribute('data-closing') === '1') return;
            toast.setAttribute('data-closing', '1');
            toast.classList.add('NoComment-toast-out');
            setTimeout(function() {
                try { if (toast.parentNode) toast.parentNode.removeChild(toast); } catch(_) {}
                try { if (stack && stack.children.length === 0) stack.remove(); } catch(_) {}
                try { if (opts.onClose) opts.onClose(reason); } catch(_) {}
            }, 200);
        }

        toast.appendChild(titleEl);
        toast.appendChild(messageEl);
        stack.appendChild(toast);
        toast.__messageEl = messageEl;

        if (timeoutMs > 0) {
            setTimeout(function() { dismiss('timeout'); }, timeoutMs);
        }
        return toast;
    }

    function scheduleRestartSteam(countdownSeconds, overlay) {
        const secs = (typeof countdownSeconds === 'number' && countdownSeconds > 0) ? Math.floor(countdownSeconds) : 3;
        if (window.__NoCommentRestartCountdownInFlight) return;
        window.__NoCommentRestartCountdownInFlight = true;

        let remaining = secs;
        let toast = null;
        let useOverlay = overlay && document.body && document.body.contains(overlay);

        function updateMessage() {
            const msg = lt('Restarting Steam in {count}…').replace('{count}', remaining);
            if (useOverlay) {
                const status = overlay.querySelector('.NoComment-status');
                if (status) status.textContent = msg;
            } else if (toast && toast.__messageEl) {
                toast.__messageEl.textContent = msg;
            }
        }

        if (!useOverlay) {
            toast = showNoCommentNotification('No-Comment', lt('Restarting Steam in {count}…').replace('{count}', remaining), { timeoutMs: secs * 1000 });
        }
        updateMessage();

        const timer = setInterval(function() {
            remaining -= 1;
            if (remaining <= 0) {
                clearInterval(timer);
                try {
                    if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                        Millennium.callServerMethod('No-Comment', 'RestartSteam', { contentScriptQuery: '' });
                    }
                } catch(_) {}
                window.__NoCommentRestartCountdownInFlight = false;
                return;
            }
            updateMessage();
        }, 1000);
    }

    
    function showNoCommentAlert(title, message, onClose) {
        if (document.querySelector('.NoComment-alert-overlay')) return;

        ensureNoCommentStyles();
        const overlay = document.createElement('div');
        overlay.className = 'NoComment-alert-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);z-index:100001;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);z-index:100001;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:400px;max-width:520px;padding:32px 36px;box-shadow:0 20px 60px rgba(0,0,0,.9), 0 0 0 1px rgba(102,192,244,0.4);animation:slideUp 0.1s ease-out;';

        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size:22px;color:#fff;margin-bottom:20px;font-weight:700;text-align:left;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        titleEl.textContent = String(title || 'No-Comment');

        const messageEl = document.createElement('div');
        messageEl.style.cssText = 'font-size:15px;line-height:1.6;margin-bottom:28px;color:#c7d5e0;text-align:left;padding:0 8px;';
        messageEl.textContent = String(message || '');

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;justify-content:flex-end;';

        const okBtn = document.createElement('a');
        okBtn.href = '#';
        okBtn.className = 'NoComment-btn primary';
        okBtn.style.minWidth = '140px';
        okBtn.innerHTML = `<span>${lt('Close')}</span>`;
        okBtn.onclick = function(e) {
            e.preventDefault();
            overlay.remove();
            try { onClose && onClose(); } catch(_) {}
        };

        btnRow.appendChild(okBtn);

        modal.appendChild(titleEl);
        modal.appendChild(messageEl);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.remove();
                try { onClose && onClose(); } catch(_) {}
            }
        });

        document.body.appendChild(overlay);
    }

    
    function ShowNoCommentAlert(title, message) {
        try {
            showNoCommentNotification(title, message, { timeoutMs: 3000 });
        } catch(err) {
            backendLog('NoComment: Alert error, falling back: ' + err);
            try { showNoCommentAlert(title, message); } catch(_) {}
            try { alert(String(title) + '\n\n' + String(message)); } catch(_) {}
        }
    }

    
    function showNoCommentConfirm(title, message, onConfirm, onCancel, options) {
        var opts = (options && typeof options === 'object') ? options : {};
        var isGreyTheme = !!(opts.greyscale || opts.grayTheme || opts.greyTheme || opts.theme === 'grey' || opts.theme === 'gray');
        if (!opts.keepOverlay) {
            closeSettingsOverlay();
        }

        
        if (document.querySelector('.NoComment-confirm-overlay')) return;

        ensureNoCommentStyles();
        const overlay = document.createElement('div');
        overlay.className = 'NoComment-confirm-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);z-index:100001;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);z-index:100001;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = isGreyTheme
            ? 'background:linear-gradient(160deg, #2b2b2b 0%, #1e1e1e 100%);color:#efefef;border:1px solid rgba(160,160,160,0.35);border-radius:12px;min-width:420px;max-width:540px;padding:32px 36px;box-shadow:0 20px 60px rgba(0,0,0,.9), 0 0 0 1px rgba(255,255,255,0.06);animation:slideUp 0.1s ease-out;'
            : 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:420px;max-width:540px;padding:32px 36px;box-shadow:0 20px 60px rgba(0,0,0,.9), 0 0 0 1px rgba(102,192,244,0.4);animation:slideUp 0.1s ease-out;';

        const titleEl = document.createElement('div');
        titleEl.style.cssText = isGreyTheme
            ? 'font-size:22px;color:#efefef;margin-bottom:20px;font-weight:700;text-align:center;text-shadow:none;background:none;-webkit-text-fill-color:#efefef;'
            : 'font-size:22px;color:#fff;margin-bottom:20px;font-weight:700;text-align:center;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        titleEl.textContent = String(title || 'No-Comment');

        const messageEl = document.createElement('div');
        messageEl.style.cssText = isGreyTheme
            ? 'font-size:15px;line-height:1.6;margin-bottom:28px;color:#d0d0d0;text-align:center;'
            : 'font-size:15px;line-height:1.6;margin-bottom:28px;color:#c7d5e0;text-align:center;';
        messageEl.textContent = String(message || lt('Are you sure?'));

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;';

        const cancelBtn = document.createElement('a');
        cancelBtn.href = '#';
        cancelBtn.className = 'NoComment-btn';
        cancelBtn.style.cssText = isGreyTheme
            ? 'flex:1;display:flex;align-items:center;justify-content:center;padding:12px 16px;border-radius:12px;border:1px solid rgba(150,150,150,0.35);background:linear-gradient(145deg, rgba(68,68,68,0.82), rgba(42,42,42,0.95));color:#e7e7e7;text-decoration:none;font-weight:700;'
            : 'flex:1';
        cancelBtn.innerHTML = `<span>${lt('Cancel')}</span>`;
        cancelBtn.onclick = function(e) {
            e.preventDefault();
            overlay.remove();
            try { onCancel && onCancel(); } catch(_) {}
        };
        const confirmBtn = document.createElement('a');
        confirmBtn.href = '#';
        confirmBtn.className = 'NoComment-btn primary';
        confirmBtn.style.cssText = isGreyTheme
            ? 'flex:1;display:flex;align-items:center;justify-content:center;padding:12px 16px;border-radius:12px;border:1px solid rgba(190,190,190,0.55);background:linear-gradient(145deg, rgba(145,145,145,0.9), rgba(102,102,102,0.95));color:#151515;text-decoration:none;font-weight:700;box-shadow:0 6px 16px rgba(0,0,0,0.35);'
            : 'flex:1';
        confirmBtn.innerHTML = `<span>${lt('Confirm')}</span>`;
        confirmBtn.onclick = function(e) {
            e.preventDefault();
            overlay.remove();
            try { onConfirm && onConfirm(); } catch(_) {}
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(confirmBtn);

        modal.appendChild(titleEl);
        modal.appendChild(messageEl);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.remove();
                try { onCancel && onCancel(); } catch(_) {}
            }
        });

        document.body.appendChild(overlay);
    }

    function showDlcWarning(appid, fullgameAppid, fullgameName) {
        closeSettingsOverlay();
        if (document.querySelector('.NoComment-dlc-warning-overlay')) return;

        ensureNoCommentStyles();
        ensureFontAwesome();

        const overlay = document.createElement('div');
        overlay.className = 'NoComment-dlc-warning-overlay NoComment-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.72);backdrop-filter:blur(8px);z-index:100001;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(160deg, #252a31 0%, #1d2127 100%);color:#e8edf2;border:1px solid #4e5967;border-radius:12px;width:520px;max-width:calc(100vw - 32px);padding:32px;box-shadow:0 25px 70px rgba(0,0,0,.75), 0 0 0 1px rgba(255,255,255,0.04) inset;';

        const iconWrap = document.createElement('div');
        iconWrap.style.cssText = 'text-align:center;margin-bottom:18px;';
        const icon = document.createElement('i');
        icon.className = 'fa-solid fa-circle-info';
        icon.style.cssText = 'color:#98a5b7;font-size:44px;';
        iconWrap.appendChild(icon);

        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size:24px;font-weight:800;text-align:center;margin-bottom:14px;color:#d7dee8;letter-spacing:0.2px;';
        titleEl.textContent = lt('DLC Detected');

        const messageEl = document.createElement('div');
        messageEl.style.cssText = 'font-size:15px;line-height:1.6;margin-bottom:26px;color:#bec8d5;text-align:center;';
        messageEl.innerHTML = lt('DLCs are added together with the base game. To add fixes for this DLC, please go to the base game page: <br><br><b>{gameName}</b>')
            .replace('{gameName}', fullgameName || lt('Base Game'));

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;';

        const cancelBtn = document.createElement('a');
        cancelBtn.href = '#';
        cancelBtn.className = 'NoComment-btn';
        cancelBtn.style.flex = '1';
        cancelBtn.innerHTML = `<span>${lt('Cancel')}</span>`;
        cancelBtn.onclick = function(e) {
            e.preventDefault();
            overlay.remove();
        };

        const goBtn = document.createElement('a');
        goBtn.href = '#';
        goBtn.className = 'NoComment-btn primary';
        goBtn.style.flex = '1.3';
        goBtn.innerHTML = `<span>${lt('Go to Base Game')}</span>`;
        goBtn.onclick = function(e) {
            e.preventDefault();
            try {
                if (typeof openSteamStore === 'function') {
                    openSteamStore(fullgameAppid);
                }
            } catch(_) {}
            overlay.remove();
        };

        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(goBtn);
        modal.appendChild(iconWrap);
        modal.appendChild(titleEl);
        modal.appendChild(messageEl);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);

        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

        document.body.appendChild(overlay);
    }

    function ensureStyles() {
        if (!document.getElementById('NoComment-spacing-styles')) {
            const style = document.createElement('style');
            style.id = 'NoComment-spacing-styles';
            style.textContent = '.NoComment-button{ margin-left:6px !important; } .NoComment-copy-steamid-button{ margin-left:6px !important; }';
            document.head.appendChild(style);
        }
    }

    function updateButtonTranslations() {
        try {
            const button = document.querySelector('.NoComment-button');
            if (button) {
                const addViaText = lt('Add via NoComment');
                button.title = addViaText;
                button.setAttribute('data-tooltip-text', addViaText);
                const span = button.querySelector('span');
                if (span) {
                    span.textContent = addViaText;
                }
            }
            const copyBtn = document.querySelector('.NoComment-copy-steamid-button');
            if (copyBtn) {
                const copySteamIdText = t('profile.copySteamId', 'Copy SteamID');
                copyBtn.title = copySteamIdText;
                copyBtn.setAttribute('data-tooltip-text', copySteamIdText);
                const copySpan = copyBtn.querySelector('span');
                if (copySpan) {
                    copySpan.textContent = copySteamIdText;
                } else {
                    copyBtn.textContent = copySteamIdText;
                }
            }
            if (typeof refreshStoreButtonTranslations === 'function') {
                refreshStoreButtonTranslations();
            }
        } catch (err) {
            backendLog('NoComment: updateButtonTranslations error: ' + err);
        }
    }

    function isSteamCommunityProfilePage() {
        try {
            const host = String(window.location.hostname || '').toLowerCase();
            if (host !== 'steamcommunity.com') return false;
            const pathname = String(window.location.pathname || '');
            return /^\/(id|profiles)\/[^\/?#]+/i.test(pathname);
        } catch(_) {
            return false;
        }
    }

    function normalizeSteamId64(raw) {
        const value = String(raw || '').trim();
        if (/^\d{17}$/.test(value)) return value;
        return '';
    }

    function extractSteamId64FromUrl(rawUrl) {
        try {
            const value = String(rawUrl || '');
            const match = value.match(/(?:https?:\/\/)?steamcommunity\.com\/profiles\/(\d{17})(?:[/?#]|$)/i) ||
                value.match(/\/profiles\/(\d{17})(?:[/?#]|$)/i);
            return match ? normalizeSteamId64(match[1]) : '';
        } catch(_) {
            return '';
        }
    }

    function accountIdToSteamId64(rawAccountId) {
        try {
            const value = String(rawAccountId || '').trim();
            if (!/^\d+$/.test(value)) return '';
            if (/^\d{17}$/.test(value)) return value;
            if (typeof BigInt === 'undefined') return '';
            const accountId = BigInt(value);
            if (accountId <= 0n) return '';
            const base = BigInt('76561197960265728');
            return String(base + accountId);
        } catch(_) {
            return '';
        }
    }

    function parseSteamId64FromXmlText(xmlText) {
        try {
            const text = String(xmlText || '');
            const match = text.match(/<steamID64>\s*(\d{17})\s*<\/steamID64>/i);
            return match ? normalizeSteamId64(match[1]) : '';
        } catch(_) {
            return '';
        }
    }

    function fetchCurrentProfileSteamId64FromXml() {
        try {
            if (typeof fetch !== 'function') {
                return Promise.resolve('');
            }
            const url = new URL(window.location.href);
            url.searchParams.set('xml', '1');
            return fetch(url.toString(), {
                method: 'GET',
                credentials: 'same-origin',
                cache: 'no-store'
            }).then(function(resp) {
                if (!resp || !resp.ok) return '';
                return resp.text().then(function(text) {
                    return parseSteamId64FromXmlText(text);
                }).catch(function() {
                    return '';
                });
            }).catch(function() {
                return '';
            });
        } catch(_) {
            return Promise.resolve('');
        }
    }

    function resolveCurrentProfileSteamId64() {
        try {
            const pathMatch = String(window.location.pathname || '').match(/\/profiles\/(\d{17})(?:[/?#]|$)/i);
            if (pathMatch && pathMatch[1]) {
                const fromPath = normalizeSteamId64(pathMatch[1]);
                if (fromPath) return fromPath;
            }
        } catch(_) {}

        try {
            const fromProfileData = normalizeSteamId64(window.g_rgProfileData && window.g_rgProfileData.steamid);
            if (fromProfileData) return fromProfileData;
        } catch(_) {}

        try {
            const scripts = document.querySelectorAll('script');
            for (let i = 0; i < scripts.length; i++) {
                const content = String((scripts[i] && scripts[i].textContent) || '');
                if (!content || content.indexOf('g_rgProfileData') < 0) continue;
                const match = content.match(/g_rgProfileData\s*=\s*\{[\s\S]*?"steamid"\s*:\s*"(\d{17})"/i);
                if (match && match[1]) {
                    const parsed = normalizeSteamId64(match[1]);
                    if (parsed) return parsed;
                }
            }
        } catch(_) {}

        try {
            const profileRoot =
                document.querySelector('.profile_page') ||
                document.querySelector('.profile_content') ||
                document.querySelector('.profile_header');
            if (profileRoot) {
                const scopedAnchors = profileRoot.querySelectorAll('a[href*="/profiles/"]');
                for (let i = 0; i < scopedAnchors.length; i++) {
                    const href = scopedAnchors[i] ? scopedAnchors[i].getAttribute('href') : '';
                    const fromHref = extractSteamId64FromUrl(href);
                    if (fromHref) return fromHref;
                }

                const scopedMiniNodes = profileRoot.querySelectorAll('[data-miniprofile]');
                for (let i = 0; i < scopedMiniNodes.length; i++) {
                    const miniValue = String(scopedMiniNodes[i].getAttribute('data-miniprofile') || '').trim();
                    const fromMini = accountIdToSteamId64(miniValue);
                    if (fromMini) return fromMini;
                }
            }
        } catch(_) {}

        try {
            const canonical = document.querySelector('link[rel="canonical"]');
            const fromCanonical = extractSteamId64FromUrl(canonical ? canonical.getAttribute('href') : '');
            if (fromCanonical) return fromCanonical;
        } catch(_) {}

        try {
            const ogUrl = document.querySelector('meta[property="og:url"]');
            const fromOg = extractSteamId64FromUrl(ogUrl ? ogUrl.getAttribute('content') : '');
            if (fromOg) return fromOg;
        } catch(_) {}

        return '';
    }

    function resolveCurrentProfileSteamId64Async() {
        const fromPage = resolveCurrentProfileSteamId64();
        if (fromPage) return Promise.resolve(fromPage);
        return fetchCurrentProfileSteamId64FromXml().then(function(fromXml) {
            return fromXml || '';
        }).catch(function() {
            return '';
        });
    }

    function copyTextLegacy(text) {
        try {
            const area = document.createElement('textarea');
            area.value = String(text || '');
            area.setAttribute('readonly', 'readonly');
            area.style.position = 'fixed';
            area.style.left = '-9999px';
            area.style.top = '0';
            document.body.appendChild(area);
            area.focus();
            area.select();
            const copied = !!document.execCommand('copy');
            document.body.removeChild(area);
            return copied;
        } catch(_) {
            return false;
        }
    }

    function copyTextToClipboard(text) {
        const value = String(text || '');
        if (!value) return Promise.resolve(false);
        try {
            if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
                return navigator.clipboard.writeText(value).then(function() {
                    return true;
                }).catch(function() {
                    return copyTextLegacy(value);
                });
            }
        } catch(_) {}
        return Promise.resolve(copyTextLegacy(value));
    }

    function addProfileSteamIdCopyButton() {
        if (!isSteamCommunityProfilePage()) return;

        const actionsContainer =
            document.querySelector('.profile_header_actions') ||
            document.querySelector('.profile_header .profile_header_actions') ||
            document.querySelector('.profile_header_actions_logged_in');
        if (!actionsContainer) return;

        const existing = actionsContainer.querySelector('.NoComment-copy-steamid-button');
        if (existing) {
            updateButtonTranslations();
            return;
        }

        ensureStyles();

        const referenceBtn = actionsContainer.querySelector('a.btn_profile_action');
        const button = document.createElement('a');
        button.href = '#';
        if (referenceBtn && referenceBtn.className) {
            button.className = referenceBtn.className + ' NoComment-copy-steamid-button';
        } else {
            button.className = 'btn_profile_action btn_medium NoComment-copy-steamid-button';
        }

        const span = document.createElement('span');
        const label = t('profile.copySteamId', 'Copy SteamID');
        span.textContent = label;
        button.appendChild(span);
        button.title = label;
        button.setAttribute('data-tooltip-text', label);

        button.addEventListener('click', function(e) {
            e.preventDefault();
            resolveCurrentProfileSteamId64Async().then(function(steamId64) {
                if (!steamId64) {
                    if (typeof ShowNoCommentAlert === 'function') {
                        ShowNoCommentAlert('No-Comment', t('profile.copySteamIdNotFound', 'Could not resolve this profile SteamID.'));
                    }
                    return;
                }

                copyTextToClipboard(steamId64).then(function(copied) {
                    if (typeof ShowNoCommentAlert !== 'function') return;
                    if (!copied) {
                        ShowNoCommentAlert('No-Comment', t('profile.copySteamIdCopyFailed', 'Unable to copy SteamID to clipboard.'));
                        return;
                    }
                    const template = t('profile.copySteamIdSuccess', 'Copied SteamID: {steamid}');
                    const msg = template.indexOf('{steamid}') >= 0
                        ? template.replace('{steamid}', steamId64)
                        : (template + ' ' + steamId64);
                    ShowNoCommentAlert('No-Comment', msg);
                }).catch(function() {
                    if (typeof ShowNoCommentAlert === 'function') {
                        ShowNoCommentAlert('No-Comment', t('profile.copySteamIdCopyFailed', 'Unable to copy SteamID to clipboard.'));
                    }
                });
            }).catch(function() {
                if (typeof ShowNoCommentAlert === 'function') {
                    ShowNoCommentAlert('No-Comment', t('profile.copySteamIdNotFound', 'Could not resolve this profile SteamID.'));
                }
            });
        });

        actionsContainer.appendChild(button);
    }

    function addNoCommentButton() {
        // Store pages are handled by the dedicated store button flow in 020_store_bundle_core.js.
        try {
            if (typeof isStoreGamePage === 'function' && isStoreGamePage()) {
                return;
            }
        } catch(_) {}

        const currentUrl = window.location.href;
        if (window.__NoCommentLastUrl !== currentUrl) {
            window.__NoCommentLastUrl = currentUrl;
            window.__NoCommentButtonInserted = false;
            window.__NoCommentPresenceCheckInFlight = false;
            window.__NoCommentPresenceCheckAppId = undefined;
            ensureTranslationsLoaded(false).then(function() {
                updateButtonTranslations();
            });
        }

        if (isSteamCommunityProfilePage()) {
            addProfileSteamIdCopyButton();
            return;
        }

        const steamdbContainer =
            document.querySelector('.steamdb-buttons') ||
            document.querySelector('[data-steamdb-buttons]') ||
            document.querySelector('.apphub_OtherSiteInfo');

        if (!steamdbContainer) {
            if (!logState.missingOnce) {
                backendLog('NoComment: steamdbContainer not found on this page');
                logState.missingOnce = true;
            }
            return;
        }

        const existingBtn =
            steamdbContainer.querySelector('.NoComment-button') ||
            document.querySelector('.NoComment-button');
        if (existingBtn || window.__NoCommentButtonInserted) {
            if (existingBtn) {
                ensureTranslationsLoaded(false).then(function() {
                    updateButtonTranslations();
                });
            }
            if (!logState.existsOnce) {
                backendLog('NoComment button already exists, skipping');
                logState.existsOnce = true;
            }
            return;
        }

        ensureStyles();
        const referenceBtn = steamdbContainer.querySelector('a');
        const button = document.createElement('a');
        button.href = '#';
        if (referenceBtn && referenceBtn.className) {
            button.className = referenceBtn.className + ' NoComment-button';
        } else {
            button.className = 'btnv6_blue_hoverfade btn_medium NoComment-button';
        }
        const span = document.createElement('span');
        const addViaText = lt('Add via NoComment');
        span.textContent = addViaText;
        button.appendChild(span);
        button.title = addViaText;
        button.setAttribute('data-tooltip-text', addViaText);
        button.addEventListener('click', function(e) {
            e.preventDefault();
            backendLog('NoComment button clicked (delegated handler will process)');
        });

        const placeButton = function() {
            if (document.querySelector('.NoComment-button') || window.__NoCommentButtonInserted) return;
            if (referenceBtn && referenceBtn.after) {
                referenceBtn.after(button);
            } else {
                steamdbContainer.appendChild(button);
            }
            window.__NoCommentButtonInserted = true;
            backendLog('NoComment button inserted');
        };

        try {
            const match =
                window.location.href.match(/https:\/\/store\.steampowered\.com\/app\/(\d+)/) ||
                window.location.href.match(/https:\/\/steamcommunity\.com\/app\/(\d+)/);
            const appid = match ? parseInt(match[1], 10) : NaN;
            if (isNaN(appid) || typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                placeButton();
                return;
            }

            if (window.__NoCommentPresenceCheckInFlight && window.__NoCommentPresenceCheckAppId === appid) {
                return;
            }
            window.__NoCommentPresenceCheckInFlight = true;
            window.__NoCommentPresenceCheckAppId = appid;
            window.__NoCommentCurrentAppId = appid;

            Millennium.callServerMethod('No-Comment', 'HasNoCommentForApp', { appid, contentScriptQuery: '' })
                .then(function(res) {
                    try {
                        const payload = typeof res === 'string' ? JSON.parse(res) : res;
                        const exists = payload && payload.success && payload.exists === true;
                        if (exists) {
                            backendLog('NoComment already present for this app; not inserting button');
                            return;
                        }
                    } catch(_) {}
                    placeButton();
                })
                .catch(function() {
                    placeButton();
                })
                .finally(function() {
                    window.__NoCommentPresenceCheckInFlight = false;
                });
        } catch(_) {
            window.__NoCommentPresenceCheckInFlight = false;
            placeButton();
        }
    }
    
    

    function onFrontendReady() {
        addNoCommentButton();
        ensureStoreAddButton();
        ensureToolsWidget();
        
        try {
            if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                Millennium.callServerMethod('No-Comment', 'GetInitApisMessage', { contentScriptQuery: '' }).then(function(res){
                    try {
                        const payload = typeof res === 'string' ? JSON.parse(res) : res;
                        if (payload && payload.message) {
                            const msg = String(payload.message);
                            let isDuplicateMessage = false;
                            try {
                                const key = 'NoComment.lastInitMessage';
                                const previous = sessionStorage.getItem(key) || '';
                                if (previous === msg) {
                                    isDuplicateMessage = true;
                                } else {
                                    sessionStorage.setItem(key, msg);
                                }
                            } catch(_) {}
                            if (isDuplicateMessage) {
                                return;
                            }
                            
                            const isUpdateMsg = msg.toLowerCase().includes('update') || msg.toLowerCase().includes('restart');
                            
                            if (isUpdateMsg) {
                                
                                showNoCommentConfirm('No-Comment', msg, function() {
                                    
                                    try { Millennium.callServerMethod('No-Comment', 'RestartSteam', { contentScriptQuery: '' }); } catch(_) {}
                                }, function() {
                                    
                                }, { theme: 'grey' });
                            } else {
                                
                                showNoCommentNotification('No-Comment', msg, { timeoutMs: 3000 });
                            }
                        }
                    } catch(_){ }
                });
                
            }
        } catch(_) { }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onFrontendReady);
    } else {
        onFrontendReady();
    }
    
    
    document.addEventListener('click', async function(evt) {
        const anchor = evt.target && (evt.target.closest ? evt.target.closest('.NoComment-button') : null);
        if (anchor) {
            evt.preventDefault();
            backendLog('NoComment delegated click');
            try {
                const match = window.location.href.match(/https:\/\/store\.steampowered\.com\/app\/(\d+)/) || window.location.href.match(/https:\/\/steamcommunity\.com\/app\/(\d+)/);
                const appid = match ? parseInt(match[1], 10) : NaN;
                if (!isNaN(appid) && typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                    await startAddViaNoCommentFlow(appid, { showOverlay: true });
                }
            } catch(_) {}
        }
    }, true);

    
    function startPolling(appid){
        let done = false;
        const timer = setInterval(() => {
            if (done) { clearInterval(timer); return; }
            try {
                Millennium.callServerMethod('No-Comment', 'GetAddViaNoCommentStatus', { appid, contentScriptQuery: '' }).then(function(res){
                    try {
                        const payload = typeof res === 'string' ? JSON.parse(res) : res;
                        const st = payload && payload.state ? payload.state : {};
                        
                        
                        const overlay = document.querySelector('.NoComment-overlay');
                        const title = overlay ? overlay.querySelector('.NoComment-title') : null;
                        const status = overlay ? overlay.querySelector('.NoComment-status') : null;
                        const wrap = overlay ? overlay.querySelector('.NoComment-progress-wrap') : null;
                        const percent = overlay ? overlay.querySelector('.NoComment-percent') : null;
                        const bar = overlay ? overlay.querySelector('.NoComment-progress-bar') : null;
                        
                        
                        if (st.currentApi && title) title.textContent = lt('NoComment · {api}').replace('{api}', st.currentApi);
                        if (status) {
                            if (st.status === 'checking') status.textContent = lt('Checking availability…');
                            if (st.status === 'downloading') status.textContent = lt('Downloading…');
                            if (st.status === 'processing') status.textContent = lt('Processing package…');
                            if (st.status === 'installing') status.textContent = lt('Installing…');
                            if (st.status === 'done') status.textContent = lt('Finishing…');
                            if (st.status === 'failed') status.textContent = lt('Failed');
                        }
                        if (st.status === 'downloading'){
                            
                            if (wrap && wrap.style.display === 'none') wrap.style.display = 'block';
                            if (percent && percent.style.display === 'none') percent.style.display = 'block';
                            const total = st.totalBytes || 0; const read = st.bytesRead || 0;
                            let pct = total > 0 ? Math.floor((read/total)*100) : (read ? 1 : 0);
                            if (pct > 100) pct = 100; if (pct < 0) pct = 0;
                            if (bar) bar.style.width = pct + '%';
                            if (percent) percent.textContent = pct + '%';
                            
                            const cancelBtn = overlay ? overlay.querySelector('.NoComment-cancel-btn') : null;
                            if (cancelBtn) cancelBtn.style.display = '';
                        }
                        if (st.status === 'done'){
                            try {
                                if (typeof setStorePresenceCache === 'function') {
                                    setStorePresenceCache(appid, true);
                                }
                            } catch(_) {}
                            
                            if (bar) bar.style.width = '100%';
                            if (percent) percent.textContent = '100%';
                            if (status) status.textContent = lt('Game added!');
                            
                            const cancelBtn = overlay ? overlay.querySelector('.NoComment-cancel-btn') : null;
                            if (cancelBtn) cancelBtn.style.display = 'none';
                            const hideBtn = overlay ? overlay.querySelector('.NoComment-hide-btn') : null;
                            if (hideBtn) hideBtn.innerHTML = '<span>' + lt('Close') + '</span>';
                            
                            if (wrap || percent) {
                            setTimeout(function(){ if (wrap) wrap.style.display = 'none'; if (percent) percent.style.display = 'none'; }, 300);
                            }
                            done = true; clearInterval(timer);
                            runState.inProgress = false; runState.appid = null;
                            
                            const btnEl = document.querySelector('.NoComment-button');
                            if (btnEl && btnEl.parentElement) {
                                btnEl.parentElement.removeChild(btnEl);
                            }
                            const storeBtn = document.querySelector('.NoComment-store-button-container');
                            if (storeBtn && storeBtn.parentElement) {
                                storeBtn.parentElement.removeChild(storeBtn);
                            }
                            showLibraryBanners();
                            ensureStoreAddButton();
                            scheduleRestartSteam(3, overlay);
                        }
                        if (st.status === 'failed'){
                            
                            if (status) status.textContent = lt('Failed: {error}').replace('{error}', st.error || lt('Unknown error'));
                            
                            const cancelBtn = overlay ? overlay.querySelector('.NoComment-cancel-btn') : null;
                            if (cancelBtn) cancelBtn.style.display = 'none';
                            const hideBtn = overlay ? overlay.querySelector('.NoComment-hide-btn') : null;
                            if (hideBtn) hideBtn.innerHTML = '<span>' + lt('Close') + '</span>';
                            if (wrap) wrap.style.display = 'none';
                            if (percent) percent.style.display = 'none';
                            done = true; clearInterval(timer);
                            runState.inProgress = false; runState.appid = null;
                        }
                    } catch(_){ }
                });
            } catch(_){ clearInterval(timer); }
        }, 300);
    }
    
    let uiRefreshTimer = 0;
    function scheduleUiRefresh(delayMs) {
        const delay = (typeof delayMs === 'number' && delayMs >= 0) ? delayMs : 120;
        if (uiRefreshTimer) return;
        uiRefreshTimer = setTimeout(function() {
            uiRefreshTimer = 0;
            try { updateButtonTranslations(); } catch(_) {}
            try { addNoCommentButton(); } catch(_) {}
            try { ensureStoreAddButton(); } catch(_) {}
        }, delay);
    }

    setTimeout(function(){ scheduleUiRefresh(0); }, 1000);
    setTimeout(function(){ scheduleUiRefresh(0); }, 3000);
    
    
    let lastUrl = window.location.href;
    function checkUrlChange() {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            
            window.__NoCommentButtonInserted = false;
            window.__NoCommentRestartInserted = false;
            window.__NoCommentIconInserted = false;
            window.__NoCommentPresenceCheckInFlight = false;
            window.__NoCommentPresenceCheckAppId = undefined;
            
            ensureTranslationsLoaded(false).then(function() {
                scheduleUiRefresh(0);
            });
        }
    }
    
    setInterval(checkUrlChange, 1200);
    window.addEventListener('popstate', checkUrlChange);
    
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function() {
        originalPushState.apply(history, arguments);
        setTimeout(checkUrlChange, 100);
    };
    history.replaceState = function() {
        originalReplaceState.apply(history, arguments);
        setTimeout(checkUrlChange, 100);
    };
    
    
    if (typeof MutationObserver !== 'undefined') {
        const observer = new MutationObserver(function(mutations) {
            for (let i = 0; i < mutations.length; i++) {
                const mutation = mutations[i];
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    scheduleUiRefresh(120);
                    break;
                }
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function showLoadedAppsPopup(apps) {
        
        if (document.querySelector('.NoComment-loadedapps-overlay')) return;
        ensureNoCommentStyles();
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.className = 'NoComment-loadedapps-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.className = 'NoComment-loadedapps-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';
        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:420px;max-width:640px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(102,192,244,0.3);animation:slideUp 0.1s ease-out;';
        const title = document.createElement('div');
        title.style.cssText = 'font-size:24px;color:#fff;margin-bottom:20px;font-weight:700;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-align:center;';
        title.textContent = lt('NoComment · Added Games');
        const body = document.createElement('div');
        body.style.cssText = 'font-size:14px;line-height:1.8;margin-bottom:16px;max-height:320px;overflow:auto;padding:16px;border:1px solid rgba(102,192,244,0.3);border-radius:12px;background:rgba(11,20,30,0.6);';
        if (apps && apps.length) {
            const list = document.createElement('div');
            apps.forEach(function(item){
                const a = document.createElement('a');
                a.href = 'steam://install/' + String(item.appid);
                a.textContent = String(item.name || item.appid);
                a.style.cssText = 'display:block;color:#c7d5e0;text-decoration:none;padding:10px 16px;margin-bottom:8px;background:rgba(102,192,244,0.08);border:1px solid rgba(102,192,244,0.2);border-radius:4px;transition:all 0.3s ease;';
                a.onmouseover = function() { this.style.background = 'rgba(102,192,244,0.2)'; this.style.borderColor = '#66c0f4'; this.style.transform = 'translateX(4px)'; this.style.color = '#fff'; };
                a.onmouseout = function() { this.style.background = 'rgba(102,192,244,0.08)'; this.style.borderColor = 'rgba(102,192,244,0.2)'; this.style.transform = 'translateX(0)'; this.style.color = '#c7d5e0'; };
                a.onclick = function(e){ e.preventDefault(); try { window.location.href = a.href; } catch(_) {} };
                a.oncontextmenu = function(e){ e.preventDefault(); const url = 'https://steamdb.info/app/' + String(item.appid) + '/';
                    try { Millennium.callServerMethod('No-Comment', 'OpenExternalUrl', { url, contentScriptQuery: '' }); } catch(_) {}
                };
                list.appendChild(a);
            });
            body.appendChild(list);
        } else {
            body.style.textAlign = 'center';
            body.textContent = lt('No games found.');
        }
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-top:16px;display:flex;gap:8px;justify-content:space-between;align-items:center;';
        const instructionText = document.createElement('div');
        instructionText.style.cssText = 'font-size:12px;color:#8f98a0;';
        instructionText.textContent = lt('Left click to install, Right click for SteamDB');
        const dismissBtn = document.createElement('a');
        dismissBtn.className = 'btnv6_blue_hoverfade btn_medium';
        dismissBtn.innerHTML = '<span>' + lt('Dismiss') + '</span>';
        dismissBtn.href = '#';
        dismissBtn.onclick = function(e){ e.preventDefault(); try { Millennium.callServerMethod('No-Comment', 'DismissLoadedApps', { contentScriptQuery: '' }); } catch(_) {} try { sessionStorage.setItem('NoCommentLoadedAppsShown', '1'); } catch(_) {} overlay.remove(); };
        btnRow.appendChild(instructionText);
        btnRow.appendChild(dismissBtn);
        modal.appendChild(title);
        modal.appendChild(body);
        modal.appendChild(btnRow);
        overlay.appendChild(modal);
        overlay.addEventListener('click', function(e){ if (e.target === overlay) overlay.remove(); });
        document.body.appendChild(overlay);
    }

})();
