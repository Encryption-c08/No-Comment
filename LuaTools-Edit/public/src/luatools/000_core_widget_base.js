    
    
    function backendLog(message) {
        try {
            if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                Millennium.callServerMethod('luatools', 'Logger.log', { message: String(message) });
            }
        } catch (err) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[LuaTools] backendLog failed', err);
            }
        }
    }
    
    backendLog('LuaTools script loaded');
    
    const logState = { missingOnce: false, existsOnce: false };
    
    const runState = { inProgress: false, appid: null };
    
    const TRANSLATION_PLACEHOLDER = 'translation missing';

    function applyTranslationBundle(bundle) {
        if (!bundle || typeof bundle !== 'object') return;
        const stored = window.__LuaToolsI18n || {};
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
        window.__LuaToolsI18n = stored;
    }

    function ensureLuaToolsStyles() {
        if (document.getElementById('luatools-styles')) return;
        try {
            const style = document.createElement('style');
            style.id = 'luatools-styles';
            style.textContent = `
                .luatools-btn {
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
                .luatools-btn:hover:not([data-disabled="1"]) {
                    background: rgba(102,192,244,0.25);
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(102,192,244,0.3);
                    border-color: #66c0f4;
                }
                .luatools-btn.primary {
                    background: linear-gradient(135deg, #66c0f4 0%, #4a9ece 100%);
                    border-color: #66c0f4;
                    color: #0f1923;
                    font-weight: 700;
                    box-shadow: 0 4px 15px rgba(102,192,244,0.4), inset 0 1px 0 rgba(255,255,255,0.3);
                    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                }
                .luatools-btn.primary:hover:not([data-disabled="1"]) {
                    background: linear-gradient(135deg, #7dd4ff 0%, #5ab3e8 100%);
                    transform: translateY(-3px) scale(1.03);
                    box-shadow: 0 8px 25px rgba(102,192,244,0.6), inset 0 1px 0 rgba(255,255,255,0.4);
                }
                .luatools-search-input {
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
                .luatools-search-row { display:flex; gap:8px; }
                .luatools-search-btn {
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
                .luatools-search-btn.primary {
                    background: linear-gradient(135deg, #66c0f4 0%, #4a9ece 100%);
                    color: #0f1923;
                    border-color: #66c0f4;
                }
                .luatools-search-btn:hover { background: rgba(102,192,244,0.2); }
                .luatools-search-btn.primary:hover { background: linear-gradient(135deg, #7dd4ff 0%, #5ab3e8 100%); }
                .luatools-search-results { display:flex; flex-direction:column; gap:8px; max-height:200px; overflow:auto; }
                .luatools-search-item {
                    display:flex; align-items:center; justify-content:space-between; gap:8px;
                    background: rgba(12,20,30,0.5);
                    border: 1px solid rgba(102,192,244,0.2);
                    padding: 8px 10px; border-radius: 10px;
                }
                .luatools-search-title { font-size:12px; font-weight:600; color:#e7f4ff; }
                .luatools-search-meta { font-size:11px; color:#9bb7c9; }
                .luatools-search-actions { display:flex; gap:6px; }
                .luatools-search-link { font-size:11px; color:#9bd0ff; cursor:pointer; text-decoration:none; }
                .luatools-search-empty { font-size:12px; color:#9bb7c9; text-align:center; padding:6px; }
                .luatools-tools-widget {
                    position: fixed;
                    right: 18px;
                    bottom: 18px;
                    z-index: 100002;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    gap: 10px;
                }
                .luatools-tools-launcher {
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
                    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
                    filter: grayscale(1);
                }
                .luatools-tools-launcher:hover {
                    border-color: rgba(200,200,200,0.7);
                    box-shadow: 0 14px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.12);
                }
                .luatools-tools-launcher.is-open {
                    transform: rotate(12deg) scale(1.05);
                }
                .luatools-tools-launcher.luatools-tools-bounce {
                    animation: luatoolsToolsPop 0.22s ease-out;
                }
                .luatools-tools-launcher-icon {
                    width: 22px;
                    height: 22px;
                    display: block;
                }
                .luatools-tools-launcher i {
                    font-size: 22px;
                }
                .luatools-tools-panel {
                    width: 340px;
                    max-width: calc(100vw - 36px);
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
                .luatools-tools-panel.is-open {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                    pointer-events: auto;
                }
                .luatools-tools-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 16px 10px;
                    border-bottom: 1px solid rgba(160,160,160,0.2);
                }
                .luatools-tools-title {
                    font-size: 14px;
                    font-weight: 700;
                    letter-spacing: 1.4px;
                    text-transform: uppercase;
                    color: #f2f2f2;
                }
                .luatools-tools-actions { display: flex; gap: 8px; }
                .luatools-tools-icon-btn {
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
                .luatools-tools-icon-btn:hover {
                    transform: translateY(-1px);
                    border-color: rgba(210,210,210,0.6);
                    box-shadow: 0 6px 14px rgba(0,0,0,0.45);
                }
                .luatools-tools-body {
                    padding: 14px 16px 18px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                .luatools-tools-section {
                    font-size: 11px;
                    letter-spacing: 1.6px;
                    text-transform: uppercase;
                    color: #bdbdbd;
                    text-align: left;
                    margin-top: 6px;
                }
                .luatools-tools-section-row {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 10px;
                    margin-top: 6px;
                }
                .luatools-tools-usage {
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
                .luatools-tools-action {
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
                .luatools-tools-action:hover {
                    transform: translateY(-1px);
                    border-color: rgba(220,220,220,0.6);
                    box-shadow: 0 8px 18px rgba(0,0,0,0.45);
                }
                .luatools-tools-panel .luatools-search-input {
                    box-sizing: border-box;
                    width: 100%;
                    border-radius: 10px;
                    border: 1px solid rgba(150,150,150,0.35);
                    background: rgba(18,18,18,0.8);
                    color: #e0e0e0;
                    padding: 10px 12px;
                }
                .luatools-tools-panel .luatools-search-row { gap: 8px; }
                .luatools-tools-panel .luatools-search-btn {
                    border-radius: 10px;
                    border: 1px solid rgba(150,150,150,0.35);
                    background: rgba(50,50,50,0.6);
                    color: #e6e6e6;
                    font-size: 12px;
                    padding: 10px 12px;
                }
                .luatools-tools-panel .luatools-search-btn.primary {
                    background: linear-gradient(135deg, rgba(120,120,120,0.7), rgba(70,70,70,0.9));
                    border-color: rgba(200,200,200,0.55);
                    color: #f5f5f5;
                }
                .luatools-tools-panel .luatools-search-btn:hover {
                    background: rgba(80,80,80,0.75);
                }
                .luatools-tools-panel .luatools-search-btn.primary:hover {
                    background: linear-gradient(135deg, rgba(160,160,160,0.8), rgba(90,90,90,0.95));
                }
                .luatools-tools-panel .luatools-search-item {
                    background: rgba(30,30,30,0.7);
                    border: 1px solid rgba(140,140,140,0.3);
                }
                .luatools-tools-panel .luatools-search-title { color: #f0f0f0; }
                .luatools-tools-panel .luatools-search-meta { color: #b8b8b8; }
                .luatools-tools-panel .luatools-search-link { color: #d0d0d0; }
                .luatools-settings-manager-modal {
                    background: linear-gradient(160deg, #2b2b2b 0%, #1e1e1e 100%) !important;
                    border: 1px solid rgba(160,160,160,0.35) !important;
                    color: #e6e6e6 !important;
                    box-shadow: 0 20px 60px rgba(0,0,0,.7) !important;
                }
                .luatools-settings-manager-header {
                    border-bottom: 1px solid rgba(160,160,160,0.3) !important;
                }
                .luatools-settings-manager-title {
                    color: #e6e6e6 !important;
                    text-shadow: none !important;
                    background: none !important;
                    -webkit-text-fill-color: #e6e6e6 !important;
                }
                .luatools-settings-manager-content {
                    border: 1px solid rgba(160,160,160,0.25) !important;
                    background: rgba(22,22,22,0.7) !important;
                }
                .luatools-settings-tabs {
                    display: flex;
                    gap: 8px;
                    padding: 0 24px 12px;
                }
                .luatools-settings-tab {
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
                .luatools-settings-tab.active {
                    border-color: rgba(200,200,200,0.6);
                    background: rgba(70,70,70,0.9);
                    color: #ffffff;
                }
                .luatools-settings-manager-overlay .luatools-btn {
                    background: rgba(60,60,60,0.8) !important;
                    border-color: rgba(150,150,150,0.35) !important;
                    color: #e6e6e6 !important;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.35) !important;
                }
                .luatools-settings-manager-overlay .luatools-btn.primary {
                    background: linear-gradient(135deg, rgba(140,140,140,0.85), rgba(90,90,90,0.95)) !important;
                    border-color: rgba(200,200,200,0.6) !important;
                    color: #1a1a1a !important;
                }
                .luatools-settings-manager-overlay .btnv6_blue_hoverfade {
                    background: rgba(60,60,60,0.8) !important;
                    border: 1px solid rgba(150,150,150,0.35) !important;
                    color: #e6e6e6 !important;
                }
                .luatools-toast-stack {
                    position: fixed;
                    left: 24px;
                    bottom: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    z-index: 100002;
                    pointer-events: none;
                }
                .luatools-toast {
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
                    animation: luatoolsToastIn 0.18s ease-out forwards;
                    pointer-events: auto;
                    filter: grayscale(1);
                }
                .luatools-toast-title {
                    font-size: 13px;
                    font-weight: 700;
                    color: #e0e0e0;
                    text-shadow: none;
                    letter-spacing: 0.2px;
                }
                .luatools-toast-message {
                    font-size: 11px;
                    line-height: 1.5;
                    color: #c9c9c9;
                }
                .luatools-toast-out {
                    animation: luatoolsToastOut 0.18s ease-in forwards;
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
                @keyframes luatoolsToolsPop {
                    0% { transform: scale(1); }
                    60% { transform: scale(1.12); }
                    100% { transform: scale(1); }
                }
                @keyframes luatoolsToastIn {
                    from { opacity: 0; transform: translateX(20px) scale(0.98); }
                    to { opacity: 1; transform: translateX(0) scale(1); }
                }
                @keyframes luatoolsToastOut {
                    from { opacity: 1; transform: translateX(0) scale(1); }
                    to { opacity: 0; transform: translateX(20px) scale(0.98); }
                }
            `;
            document.head.appendChild(style);
        } catch(err) { backendLog('LuaTools: Styles injection failed: ' + err); }
    }

    function ensureFontAwesome() {
        if (document.getElementById('luatools-fontawesome')) return;
        try {
            const link = document.createElement('link');
            link.id = 'luatools-fontawesome';
            link.rel = 'stylesheet';
            link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css';
            link.integrity = 'sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==';
            link.crossOrigin = 'anonymous';
            link.referrerPolicy = 'no-referrer';
            document.head.appendChild(link);
        } catch(err) { backendLog('LuaTools: Font Awesome injection failed: ' + err); }
    }

    function animateToolsLauncher(launcher) {
        if (!launcher) return;
        launcher.classList.remove('luatools-tools-bounce');
        void launcher.offsetWidth;
        launcher.classList.add('luatools-tools-bounce');
    }

    function closeToolsMenu() {
        try {
            const panel = document.querySelector('.luatools-tools-panel');
            if (panel) {
                panel.classList.remove('is-open');
                panel.setAttribute('aria-hidden', 'true');
            }
        } catch(_) {}
        try {
            const launcher = document.querySelector('.luatools-tools-launcher');
            if (launcher) {
                launcher.classList.remove('is-open');
                launcher.setAttribute('aria-expanded', 'false');
            }
        } catch(_) {}
    }

    function ensureToolsWidget() {
        ensureLuaToolsStyles();
        ensureFontAwesome();
        let widget = document.querySelector('.luatools-tools-widget');
        let launcher = widget ? widget.querySelector('.luatools-tools-launcher') : null;
        let panel = widget ? widget.querySelector('.luatools-tools-panel') : null;

        if (!widget) {
            widget = document.createElement('div');
            widget.className = 'luatools-tools-widget';
        }

        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'luatools-settings-overlay luatools-tools-panel';
            panel.setAttribute('role', 'menu');
            panel.setAttribute('aria-hidden', 'true');
            widget.appendChild(panel);
        }

        if (!launcher) {
            launcher = document.createElement('button');
            launcher.type = 'button';
            launcher.className = 'luatools-tools-launcher';
            launcher.setAttribute('aria-label', 'Tools');
            launcher.setAttribute('aria-expanded', 'false');
            launcher.innerHTML = '<i class="fa-brands fa-steam" aria-hidden="true"></i>';
            widget.appendChild(launcher);
        }

        if (!widget.parentElement) {
            document.body.appendChild(widget);
        }

        if (!widget.getAttribute('data-bound')) {
            widget.setAttribute('data-bound', '1');
            launcher.addEventListener('click', function(e){
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
        }

        return { widget, launcher, panel };
    }
