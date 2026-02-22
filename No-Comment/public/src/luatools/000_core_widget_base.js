    
    
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
            launcher.innerHTML = '<i class="fa-brands fa-steam" aria-hidden="true"></i>';
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
