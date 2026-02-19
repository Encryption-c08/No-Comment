
(function() {
    'use strict';
    
    
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

    function showSettingsPopup() {
        if (settingsMenuPending) return;
        settingsMenuPending = true;
        ensureTranslationsLoaded(false).catch(function(){ return null; }).finally(function(){
            settingsMenuPending = false;
            try { const d = document.querySelector('.luatools-overlay'); if (d) d.remove(); } catch(_) {}
            ensureLuaToolsStyles();
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
            header.className = 'luatools-tools-header';

            const title = document.createElement('div');
            title.className = 'luatools-tools-title';
            title.textContent = t('menu.toolsTitle', 'Tools');

            const iconButtons = document.createElement('div');
            iconButtons.className = 'luatools-tools-actions';

            function createIconButton(id, iconClass, titleKey, titleFallback) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.id = id;
                btn.className = 'luatools-tools-icon-btn';
                const label = t(titleKey, titleFallback);
                btn.title = label;
                btn.setAttribute('aria-label', label);
                btn.innerHTML = '<i class="fa-solid ' + iconClass + '"></i>';
                iconButtons.appendChild(btn);
                return btn;
            }

            const body = document.createElement('div');
            body.className = 'luatools-tools-body';

            const container = document.createElement('div');
            container.className = 'luatools-tools-content';
            container.style.display = 'flex';
            container.style.flexDirection = 'column';
            container.style.gap = '10px';

            function createSectionLabel(key, fallback, marginTop) {
                const label = document.createElement('div');
                const topValue = typeof marginTop === 'number' ? marginTop : 8;
                label.className = 'luatools-tools-section';
                label.style.marginTop = topValue + 'px';
                label.textContent = t(key, fallback);
                container.appendChild(label);
                return label;
            }

            function createMenuButton(id, key, fallback, iconClass, isPrimary) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.id = id;
                btn.className = 'luatools-tools-action';
                const iconHtml = iconClass ? '<i class="fa-solid ' + iconClass + '"></i>' : '';
                btn.innerHTML = iconHtml + '<span>' + t(key, fallback) + '</span>';
                container.appendChild(btn);
                return btn;
            }

            const settingsManagerBtn = createIconButton('lt-settings-open-manager', 'fa-gear', 'menu.settings', 'Settings');
            const closeBtn = createIconButton('lt-settings-close', 'fa-xmark', 'settings.close', 'Close');

            createSectionLabel('menu.manageGameLabel', 'Manage Game');

            const addGameBtn = createMenuButton('lt-settings-add-game', 'Add via LuaTools', 'Add via LuaTools', 'fa-plus');
            const removeBtn = createMenuButton('lt-settings-remove-lua', 'menu.removeLuaTools', 'Remove via LuaTools', 'fa-trash-can');
            removeBtn.style.display = 'none';

            function getSettingsMenuAppId() {
                const current = getCurrentAppId();
                if (typeof current === 'number' && !isNaN(current)) return current;
                const cached = parseInt(window.__LuaToolsCurrentAppId, 10);
                if (!isNaN(cached)) return cached;
                return NaN;
            }

            const fixesMenuBtn = createMenuButton('lt-settings-fixes-menu', 'menu.fixesMenu', 'Fixes Menu', 'fa-wrench');

            createSectionLabel('menu.steamdbSearchLabel', 'SteamDB Search', 10);
            const searchWrap = document.createElement('div');
            searchWrap.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
            const searchInput = document.createElement('input');
            searchInput.className = 'luatools-search-input';
            searchInput.type = 'text';
            searchInput.placeholder = t('menu.steamdbSearchPlaceholder', 'Game name or AppID...');
            const searchRow = document.createElement('div');
            searchRow.className = 'luatools-search-row';
            const searchBtn = document.createElement('button');
            searchBtn.type = 'button';
            searchBtn.className = 'luatools-search-btn primary';
            searchBtn.textContent = t('menu.search', 'Search');
            const steamdbBtn = document.createElement('button');
            steamdbBtn.type = 'button';
            steamdbBtn.className = 'luatools-search-btn';
            steamdbBtn.textContent = t('menu.openSteamDB', 'Open SteamDB');
            searchRow.appendChild(searchBtn);
            searchRow.appendChild(steamdbBtn);
            const results = document.createElement('div');
            results.className = 'luatools-search-results';
            const empty = document.createElement('div');
            empty.className = 'luatools-search-empty';
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
            if (launcher) {
                launcher.classList.add('is-open');
                launcher.setAttribute('aria-expanded', 'true');
                animateToolsLauncher(launcher);
            }

            if (restartBtn) {
                restartBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    try { Millennium.callServerMethod('luatools', 'RestartSteam', { contentScriptQuery: '' }); } catch(_) {}
                });
            }

            function renderSearchResults(items) {
                results.innerHTML = '';
                if (!items || !items.length) {
                    const no = document.createElement('div');
                    no.className = 'luatools-search-empty';
                    no.textContent = t('menu.searchNoResults', 'No results found.');
                    results.appendChild(no);
                    return;
                }
                items.forEach(function(it) {
                    const row = document.createElement('div');
                    row.className = 'luatools-search-item';
                    const left = document.createElement('div');
                    const title = document.createElement('div');
                    title.className = 'luatools-search-title';
                    title.textContent = it.name;
                    const meta = document.createElement('div');
                    meta.className = 'luatools-search-meta';
                    meta.textContent = 'AppID ' + it.appid;
                    left.appendChild(title);
                    left.appendChild(meta);
                    const actions = document.createElement('div');
                    actions.className = 'luatools-search-actions';
                    const openBtn = document.createElement('button');
                    openBtn.type = 'button';
                    openBtn.className = 'luatools-search-btn primary';
                    openBtn.style.flex = '0 0 auto';
                    openBtn.style.padding = '6px 10px';
                    openBtn.textContent = t('menu.openStore', 'Open');
                    openBtn.onclick = function(){ openSteamStore(it.appid); };
                    const dbBtn = document.createElement('button');
                    dbBtn.type = 'button';
                    dbBtn.className = 'luatools-search-btn';
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
                const term = (searchInput.value || '').trim();
                if (!term) return;
                if (/^\d+$/.test(term)) {
                    results.innerHTML = '';
                    const loading = document.createElement('div');
                    loading.className = 'luatools-search-empty';
                    loading.textContent = t('menu.searchLoading', 'Searching…');
                    results.appendChild(loading);
                    const appid = term;
                    let name = 'App ' + appid;
                    try {
                        const fetched = await fetchAppNameById(appid);
                        if (fetched) name = fetched;
                    } catch(_) {}
                    renderSearchResults([{ appid: appid, name: name }]);
                    return;
                }
                results.innerHTML = '';
                const loading = document.createElement('div');
                loading.className = 'luatools-search-empty';
                loading.textContent = t('menu.searchLoading', 'Searching…');
                results.appendChild(loading);
                try {
                    const items = await fetchSteamSearch(term);
                    renderSearchResults(items);
                } catch (_) {
                    const msg = document.createElement('div');
                    msg.className = 'luatools-search-empty';
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
                const term = (searchInput.value || '').trim();
                if (!term) return;
                if (/^\d+$/.test(term)) openSteamDbApp(term);
                else openSteamDbSearch(term);
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
                        Millennium.callServerMethod('luatools', 'FetchFreeApisNow', { contentScriptQuery: '' }).then(function(res){
                            try {
                                const payload = typeof res === 'string' ? JSON.parse(res) : res;
                                const ok = payload && payload.success;
                                const count = payload && payload.count;
                                const successText = lt('Loaded free APIs: {count}').replace('{count}', (count != null ? count : '?'));
                                const failText = (payload && payload.error) ? String(payload.error) : lt('Failed to load free APIs.');
                                const text = ok ? successText : failText;
                                ShowLuaToolsAlert('LuaTools', text);
                            } catch(_) {}
                        });
                    } catch(_) {}
                });
            }

            if (checkUpdatesBtn) {
                checkUpdatesBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    try {
                        Millennium.callServerMethod('luatools', 'CheckForUpdatesNow', { contentScriptQuery: '' }).then(function(res){
                            try {
                                const payload = typeof res === 'string' ? JSON.parse(res) : res;
                                if (payload && payload.success) {
                                    const message = payload.message || '';
                                    if (message) {
                                        ShowLuaToolsAlert('LuaTools', message);
                                    } else {
                                        ShowLuaToolsAlert('LuaTools', t('menu.updatesNone', 'No updates available.'));
                                    }
                                } else {
                                    const errText = (payload && payload.error) ? String(payload.error) : t('menu.updatesCheckFailed', 'Update check failed.');
                                    ShowLuaToolsAlert('LuaTools', errText);
                                }
                            } catch(err) {
                                const msg = (err && err.message) ? err.message : t('menu.updatesCheckFailed', 'Update check failed.');
                                ShowLuaToolsAlert('LuaTools', msg);
                            }
                        }).catch(function(err){
                            const msg = (err && err.message) ? err.message : t('menu.updatesCheckFailed', 'Update check failed.');
                            ShowLuaToolsAlert('LuaTools', msg);
                        });
                    } catch(err) {
                        backendLog('LuaTools: Check updates error: ' + err);
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
                            ShowLuaToolsAlert('LuaTools', errText);
                            return;
                        }

                        Millennium.callServerMethod('luatools', 'GetGameInstallPath', { appid, contentScriptQuery: '' }).then(function(pathRes){
                            try {
                                let isGameInstalled = false;
                                const pathPayload = typeof pathRes === 'string' ? JSON.parse(pathRes) : pathRes;
                                if (pathPayload && pathPayload.success && pathPayload.installPath) {
                                    isGameInstalled = true;
                                    window.__LuaToolsGameInstallPath = pathPayload.installPath;
                                }
                                window.__LuaToolsGameIsInstalled = isGameInstalled;
                                showFixesLoadingPopupAndCheck(appid);
                            } catch(err) {
                                backendLog('LuaTools: GetGameInstallPath error: ' + err);
                            }
                        }).catch(function() {
                            const errorText = t('menu.error.getPath', 'Error getting game path');
                            ShowLuaToolsAlert('LuaTools', errorText);
                        });
                    } catch(err) {
                        backendLog('LuaTools: Fixes Menu button error: ' + err);
                    }
                });
            }

            if (addGameBtn) {
                addGameBtn.addEventListener('click', function(e){
                    e.preventDefault();
                    if (runState.inProgress) return;
                    try {
                        const appid = getSettingsMenuAppId();
                        if (isNaN(appid)) {
                            const errText = t('menu.error.noAppId', 'Could not determine game AppID');
                            ShowLuaToolsAlert('LuaTools', errText);
                            return;
                        }
                        runState.inProgress = true;
                        runState.appid = appid;
                        showTestPopup();
                        Millennium.callServerMethod('luatools', 'StartAddViaLuaTools', { appid: appid, contentScriptQuery: '' });
                        startPolling(appid);
                    } catch(err) {
                        backendLog('LuaTools: Add Game button error: ' + err);
                    }
                });
            }

            try {
                const appid = getSettingsMenuAppId();
                if (isNaN(appid)) {
                    if (addGameBtn) addGameBtn.style.display = 'none';
                    removeBtn.style.display = 'none';
                } else if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                    if (addGameBtn) addGameBtn.style.display = 'flex';
                    removeBtn.style.display = 'none';
                    Millennium.callServerMethod('luatools', 'HasLuaToolsForApp', { appid, contentScriptQuery: '' }).then(function(res){
                        try {
                            const payload = typeof res === 'string' ? JSON.parse(res) : res;
                            const exists = !!(payload && payload.success && payload.exists === true);
                            if (exists) {
                                const doDelete = function() {
                                    try {
                                        Millennium.callServerMethod('luatools', 'DeleteLuaToolsForApp', { appid, contentScriptQuery: '' }).then(function(){
                                            try {
                                                window.__LuaToolsButtonInserted = false;
                                                window.__LuaToolsPresenceCheckInFlight = false;
                                                window.__LuaToolsPresenceCheckAppId = undefined;
                                                addLuaToolsButton();
                                                const successText = t('menu.remove.success', 'LuaTools removed for this app.');
                                                ShowLuaToolsAlert('LuaTools', successText);
                                            } catch(err) {
                                                backendLog('LuaTools: post-delete cleanup failed: ' + err);
                                            }
                                        }).catch(function(err){
                                            const failureText = t('menu.remove.failure', 'Failed to remove LuaTools.');
                                            const errMsg = (err && err.message) ? err.message : failureText;
                                            ShowLuaToolsAlert('LuaTools', errMsg);
                                        });
                                    } catch(err) {
                                        backendLog('LuaTools: doDelete failed: ' + err);
                                    }
                                };

                                if (addGameBtn) addGameBtn.style.display = 'none';
                                removeBtn.style.display = 'flex';
                                removeBtn.onclick = function(e){
                                    e.preventDefault();
                                    const confirmMessage = t('menu.remove.confirm', 'Remove via LuaTools for this game?');
                                    showLuaToolsConfirm('LuaTools', confirmMessage, function(){
                                        doDelete();
                                    }, function(){
                                        try { showSettingsPopup(); } catch(_) {}
                                    });
                                };
                            } else {
                                removeBtn.style.display = 'none';
                                if (addGameBtn) addGameBtn.style.display = 'flex';
                            }
                        } catch(_) {}
                    });
                } else {
                    if (addGameBtn) addGameBtn.style.display = 'flex';
                    removeBtn.style.display = 'none';
                }
            } catch(_) {
                if (addGameBtn) addGameBtn.style.display = 'none';
                removeBtn.style.display = 'none';
            }
        });
    }

    function ensureTranslationsLoaded(forceRefresh, preferredLanguage) {
        try {
            if (!forceRefresh && window.__LuaToolsI18n && window.__LuaToolsI18n.ready) {
                return Promise.resolve(window.__LuaToolsI18n);
            }
            if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                window.__LuaToolsI18n = window.__LuaToolsI18n || { language: 'en', locales: [], strings: {}, ready: false };
                return Promise.resolve(window.__LuaToolsI18n);
            }
            const targetLanguage = (typeof preferredLanguage === 'string' && preferredLanguage) ? preferredLanguage :
                ((window.__LuaToolsI18n && window.__LuaToolsI18n.language) || '');
            return Millennium.callServerMethod('luatools', 'GetTranslations', { language: targetLanguage, contentScriptQuery: '' }).then(function(res){
                const payload = typeof res === 'string' ? JSON.parse(res) : res;
                if (!payload || payload.success !== true || !payload.strings) {
                    throw new Error('Invalid translation payload');
                }
                applyTranslationBundle(payload);
                
                updateButtonTranslations();
                return window.__LuaToolsI18n;
            }).catch(function(err){
                backendLog('LuaTools: translation load failed: ' + err);
                window.__LuaToolsI18n = window.__LuaToolsI18n || { language: 'en', locales: [], strings: {}, ready: false };
                return window.__LuaToolsI18n;
            });
        } catch(err) {
            backendLog('LuaTools: ensureTranslationsLoaded error: ' + err);
            window.__LuaToolsI18n = window.__LuaToolsI18n || { language: 'en', locales: [], strings: {}, ready: false };
            return Promise.resolve(window.__LuaToolsI18n);
        }
    }

    function translateText(key, fallback) {
        if (!key) {
            return typeof fallback !== 'undefined' ? fallback : '';
        }
        try {
            const store = window.__LuaToolsI18n;
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
                Millennium.callServerMethod('luatools', 'OpenExternalUrl', { url, contentScriptQuery: '' });
                return;
            }
        } catch(_) {}
        try { window.open(url, '_blank'); } catch(_) {}
    }

    function openSteamStore(appid) {
        const uri = 'steam://store/' + String(appid);
        try {
            if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                Millennium.callServerMethod('luatools', 'OpenSteamUri', { uri, contentScriptQuery: '' });
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
        if (!window.__LuaToolsAppDetailsCache) {
            window.__LuaToolsAppDetailsCache = {};
        }
        return window.__LuaToolsAppDetailsCache;
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
        const details = (entry && entry.success && entry.data) ? {
            name: entry.data.name || '',
            type: entry.data.type || '',
            success: true
        } : { name: '', type: '', success: false };
        cache[key] = details;
        return details;
    }

    async function fetchAppNameById(appid) {
        const details = await fetchAppDetailsById(appid);
        if (details && details.name) return details.name;
        return null;
    }

    async function fetchAppTypeById(appid) {
        const details = await fetchAppDetailsById(appid);
        if (details && details.type) return details.type;
        return null;
    }

    function getCurrentAppId() {
        const match = window.location.href.match(/\/app\/(\d+)/);
        if (match) return parseInt(match[1], 10);
        const d = document.querySelector('[data-appid]');
        if (d) return parseInt(d.getAttribute('data-appid'), 10);
        return null;
    }

    function isBundlePage() {
        if (/\/bundle\/\d+/.test(window.location.href)) return true;
        if (/\/agecheck\/bundle\/\d+/.test(window.location.href)) return true;
        if (document.querySelector('[data-ds-bundleid], .bundle_package_item, [id^="add_bundle_to_cart_title_"], [id^="bundle_label_"]')) {
            return true;
        }
        return false;
    }

    function getBundleRoot() {
        return document.querySelector('.bundle_page') ||
            document.querySelector('.bundle_page_wrapper') ||
            document.querySelector('.bundle_page_inner') ||
            document.querySelector('.bundle_items') ||
            document.querySelector('.bundle_package_list') ||
            document.querySelector('.bundle_purchase_section') ||
            document.querySelector('.leftcol.game_description_column') ||
            document.querySelector('.game_area_purchase_game[data-ds-bundleid]') ||
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

    async function hasLuaToolsForApp(appid) {
        try {
            if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
                return false;
            }
            const res = await Millennium.callServerMethod('luatools', 'HasLuaToolsForApp', { appid, contentScriptQuery: '' });
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            return !!(payload && payload.success && payload.exists === true);
        } catch(_) {
            return false;
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
        banner.id = 'luatools-in-library-banner';
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
            flag.innerHTML = '<span class="icon">☰</span> <span>In library</span>';
            section.insertBefore(flag, section.firstChild);
        }
    }

    function showLibraryBanners() {
        if (document.querySelector('#luatools-in-library-banner')) return;
        const gameName = getGameName();
        const queue = document.querySelector('#queueActionsCtn');
        if (queue) queue.insertAdjacentElement('afterend', createInLibraryBanner(gameName));
        const btn = document.querySelector('.luatools-store-button-container');
        const sec = (btn ? btn.closest('.game_area_purchase_game') : null) || document.querySelector('.game_area_purchase_game');
        if (sec && !sec.classList.contains('demo_above_purchase')) addInLibraryFlag(sec);
    }

    function createStoreAddButton(appId) {
        if (document.querySelector('.luatools-store-button-container')) return;
        const container = getPurchaseContainer();
        if (!container) { return; }

        const btnContainer = document.createElement('div');
        btnContainer.className = 'btn_addtocart btn_packageinfo luatools-store-button-container luatools-store-add';

        const button = document.createElement('span');
        button.setAttribute('data-panel', '{"focusable":true,"clickOnActivate":true}');
        button.setAttribute('role', 'button');
        button.className = 'btn_blue_steamui btn_medium';
        button.style.marginLeft = '2px';

        const buttonSpan = document.createElement('span');
        const addText = lt('Add via LuaTools');
        buttonSpan.textContent = addText;
        button.appendChild(buttonSpan);
        btnContainer.appendChild(button);

        setSteamTooltip(button, addText);

        button.onclick = function() {
            if (runState.inProgress) return;
            runState.inProgress = true;
            runState.appid = appId;
            button.style.pointerEvents = 'none';
            buttonSpan.textContent = lt('Working…');
            button.style.opacity = '0.7';
            showTestPopup();
            try {
                Millennium.callServerMethod('luatools', 'StartAddViaLuaTools', { appid: appId, contentScriptQuery: '' });
            } catch(_) {}
            startPolling(appId);
        };

        container.appendChild(btnContainer);
    }

    async function collectBundleAppsForInstall() {
        const rawIds = getBundleAppIds();
        const uniqueIds = Array.from(new Set(rawIds)).filter(function(id){ return /^\d+$/.test(id); });
        const apps = [];
        for (let i = 0; i < uniqueIds.length; i++) {
            const appid = uniqueIds[i];
            try {
                const type = await fetchAppTypeById(appid);
                if (type && String(type).toLowerCase() === 'dlc') {
                    continue;
                }
            } catch(_) {}
            try {
                const exists = await hasLuaToolsForApp(parseInt(appid, 10));
                if (exists) continue;
            } catch(_) {}
            let name = 'App ' + appid;
            try {
                const details = await fetchAppDetailsById(appid);
                if (details && details.name) name = details.name;
            } catch(_) {}
            apps.push({ appid: appid, name: name });
        }
        return apps;
    }

    function updateBundleOverlay(overlay, titleText, statusText, percentValue) {
        if (!overlay) return;
        const title = overlay.querySelector('.luatools-title');
        const status = overlay.querySelector('.luatools-status');
        const wrap = overlay.querySelector('.luatools-progress-wrap');
        const percent = overlay.querySelector('.luatools-percent');
        const bar = overlay.querySelector('.luatools-progress-bar');
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
                    Millennium.callServerMethod('luatools', 'GetAddViaLuaToolsStatus', { appid, contentScriptQuery: '' }).then(function(res){
                        try {
                            const payload = typeof res === 'string' ? JSON.parse(res) : res;
                            const st = payload && payload.state ? payload.state : {};
                            if (overlay) {
                                if (st.status === 'checking') updateBundleOverlay(overlay, null, lt('Checking availability…'));
                                if (st.status === 'downloading') {
                                    const total = st.totalBytes || 0; const read = st.bytesRead || 0;
                                    const pct = total > 0 ? (read / total) * 100 : (read ? 1 : 0);
                                    updateBundleOverlay(overlay, null, lt('Downloading…'), pct);
                                    const cancelBtn = overlay.querySelector('.luatools-cancel-btn');
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
            ShowLuaToolsAlert('LuaTools', lt('No non-DLC games found in this bundle.'));
            return;
        }
        if (runState.inProgress) return;
        runState.inProgress = true;
        runState.appid = null;
        try {
            showTestPopup();
            const overlay = document.querySelector('.luatools-overlay');
            const total = apps.length;
            let successCount = 0;
            const hideBtn = overlay ? overlay.querySelector('.luatools-hide-btn') : null;
            for (let i = 0; i < apps.length; i++) {
                const app = apps[i];
                runState.appid = parseInt(app.appid, 10);
                window.__LuaToolsCurrentAppId = runState.appid;
                const titleText = lt('LuaTools · Bundle') + ' ' + (i + 1) + '/' + total;
                const statusText = lt('Adding {game}…').replace('{game}', app.name || ('App ' + app.appid));
                updateBundleOverlay(overlay, titleText, statusText, 0);
                try {
                    if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                        Millennium.callServerMethod('luatools', 'StartAddViaLuaTools', { appid: runState.appid, contentScriptQuery: '' });
                    }
                } catch(_) {}
                const result = await waitForAddCompletion(runState.appid, overlay);
                if (result && result.status === 'done') {
                    successCount += 1;
                }
            }
            if (overlay) {
                updateBundleOverlay(overlay, lt('LuaTools · Bundle'), lt('Bundle complete.'), 100);
                const cancelBtn = overlay.querySelector('.luatools-cancel-btn');
                if (cancelBtn) cancelBtn.style.display = 'none';
                if (hideBtn) hideBtn.innerHTML = `<span>${lt('Close')}</span>`;
            }
            if (successCount > 0) {
                scheduleRestartSteam(3, overlay);
            }
        } finally {
            runState.inProgress = false;
            runState.appid = null;
        }
    }

    function createStoreBundleAddButton() {
        if (document.querySelector('.luatools-store-button-container')) return;
        const container = getPurchaseContainer();
        if (!container) { return; }

        const btnContainer = document.createElement('div');
        btnContainer.className = 'btn_addtocart btn_packageinfo luatools-store-button-container luatools-store-bundle';

        const button = document.createElement('span');
        button.setAttribute('data-panel', '{"focusable":true,"clickOnActivate":true}');
        button.setAttribute('role', 'button');
        button.className = 'btn_blue_steamui btn_medium';
        button.style.marginLeft = '2px';

        const buttonSpan = document.createElement('span');
        const addText = lt('Add bundle games via LuaTools');
        buttonSpan.textContent = addText;
        button.appendChild(buttonSpan);
        btnContainer.appendChild(button);

        setSteamTooltip(button, addText);

        button.onclick = async function() {
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
                ShowLuaToolsAlert('LuaTools', lt('Failed to read bundle contents.'));
            }
        };

        container.appendChild(btnContainer);
    }

    function createStoreRemoveButton(appId) {
        if (document.querySelector('.luatools-store-button-container')) return;
        const container = getPurchaseContainer();
        if (!container) { return; }

        const btnContainer = document.createElement('div');
        btnContainer.className = 'btn_addtocart btn_packageinfo luatools-store-button-container luatools-store-remove';

        const button = document.createElement('span');
        button.setAttribute('data-panel', '{"focusable":true,"clickOnActivate":true}');
        button.setAttribute('role', 'button');
        button.className = 'btn_blue_steamui btn_medium';
        button.style.marginLeft = '2px';

        const buttonSpan = document.createElement('span');
        const removeText = t('menu.removeLuaTools', 'Remove via LuaTools');
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
                Millennium.callServerMethod('luatools', 'DeleteLuaToolsForApp', { appid: appId, contentScriptQuery: '' })
                    .then(function(res){
                        let payload = res;
                        if (typeof res === 'string') {
                            try { payload = JSON.parse(res); } catch(_) { payload = null; }
                        }
                        if (payload && payload.success) {
                            document.querySelector('#luatools-in-library-banner')?.remove();
                            document.querySelectorAll('.package_in_library_flag').forEach(function(f){ f.remove(); });
                            const storeBtn = document.querySelector('.luatools-store-button-container');
                            if (storeBtn && storeBtn.parentElement) storeBtn.parentElement.removeChild(storeBtn);
                            createStoreAddButton(appId);
                            const successText = t('menu.remove.success', 'LuaTools removed for this app.');
                            if (typeof ShowLuaToolsAlert === 'function') {
                                ShowLuaToolsAlert('LuaTools', successText);
                            }
                        } else {
                            const failureText = t('menu.remove.failure', 'Failed to remove LuaTools.');
                            const errMsg = (payload && payload.error) ? String(payload.error) : failureText;
                            if (typeof ShowLuaToolsAlert === 'function') {
                                ShowLuaToolsAlert('LuaTools', errMsg);
                            }
                        }
                    })
                    .catch(function(err){
                        const failureText = t('menu.remove.failure', 'Failed to remove LuaTools.');
                        const errMsg = (err && err.message) ? err.message : failureText;
                        if (typeof ShowLuaToolsAlert === 'function') {
                            ShowLuaToolsAlert('LuaTools', errMsg);
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

        button.onclick = function() {
            const confirmMessage = t('menu.remove.confirm', 'Remove via LuaTools for this game?');
            if (typeof showLuaToolsConfirm === 'function') {
                showLuaToolsConfirm('LuaTools', confirmMessage, function(){ doRemove(); }, function(){});
            } else {
                doRemove();
            }
        };

        container.appendChild(btnContainer);
    }

    let storeCheckInFlight = false;
    let storeCheckAppId = null;
    function ensureStoreAddButton() {
        const bundleIds = getBundleAppIds();
        const existing = document.querySelector('.luatools-store-button-container');
        if (bundleIds && bundleIds.length) {
            if (!existing || !existing.classList.contains('luatools-store-bundle')) {
                if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
                createStoreBundleAddButton();
            }
            return;
        } else {
            if (existing && existing.classList.contains('luatools-store-bundle')) {
                try { existing.parentElement.removeChild(existing); } catch(_) {}
            }
        }

        const appId = getCurrentAppId();
        if (!appId) return;
        if (storeCheckInFlight && storeCheckAppId === appId) return;
        storeCheckInFlight = true;
        storeCheckAppId = appId;
        try {
            Millennium.callServerMethod('luatools', 'HasLuaToolsForApp', { appid: appId, contentScriptQuery: '' })
                .then(function(res) {
                    let payload = res;
                    if (typeof res === 'string') {
                        try { payload = JSON.parse(res); } catch(_) { payload = null; }
                    }
                    const exists = payload && payload.success && payload.exists === true;
                    const existingBtn = document.querySelector('.luatools-store-button-container');
                    if (exists) {
                        if (!existingBtn || !existingBtn.classList.contains('luatools-store-remove')) {
                            if (existingBtn && existingBtn.parentElement) existingBtn.parentElement.removeChild(existingBtn);
                            createStoreRemoveButton(appId);
                        }
                        showLibraryBanners();
                    } else {
                        if (!existingBtn || !existingBtn.classList.contains('luatools-store-add')) {
                            if (existingBtn && existingBtn.parentElement) existingBtn.parentElement.removeChild(existingBtn);
                            createStoreAddButton(appId);
                        }
                    }
                })
                .catch(function() {
                    createStoreAddButton(appId);
                })
                .finally(function() {
                    storeCheckInFlight = false;
                });
        } catch(_) {
            storeCheckInFlight = false;
            createStoreAddButton(appId);
        }
    }

    
    ensureTranslationsLoaded(false);

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

        
        if (document.querySelector('.luatools-overlay')) return;
        
        
        
        ensureLuaToolsStyles();
        const overlay = document.createElement('div');
        overlay.className = 'luatools-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:400px;max-width:560px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(102,192,244,0.3);animation:slideUp 0.1s ease-out;';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:22px;color:#fff;margin-bottom:16px;font-weight:700;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        title.className = 'luatools-title';
        title.textContent = 'LuaTools';

        const body = document.createElement('div');
        body.style.cssText = 'font-size:14px;line-height:1.4;margin-bottom:12px;';
        body.className = 'luatools-status';
        body.textContent = lt('Working…');

        const progressWrap = document.createElement('div');
        progressWrap.style.cssText = 'background:rgba(42,71,94,0.5);height:12px;border-radius:4px;overflow:hidden;position:relative;display:none;border:1px solid rgba(102,192,244,0.3);';
        progressWrap.className = 'luatools-progress-wrap';
        const progressBar = document.createElement('div');
        progressBar.style.cssText = 'height:100%;width:0%;background:linear-gradient(90deg, #66c0f4 0%, #a4d7f5 100%);transition:width 0.1s linear;box-shadow:0 0 10px rgba(102,192,244,0.5);';
        progressBar.className = 'luatools-progress-bar';
        progressWrap.appendChild(progressBar);

        const percent = document.createElement('div');
        percent.style.cssText = 'text-align:right;color:#8f98a0;margin-top:8px;font-size:12px;display:none;';
        percent.className = 'luatools-percent';
        percent.textContent = '0%';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'margin-top:16px;display:flex;gap:8px;justify-content:flex-end;';
        const cancelBtn = document.createElement('a');
        cancelBtn.className = 'btnv6_blue_hoverfade btn_medium luatools-cancel-btn';
        cancelBtn.innerHTML = `<span>${lt('Cancel')}</span>`;
        cancelBtn.href = '#';
        cancelBtn.style.display = 'none';
        cancelBtn.onclick = function(e){ e.preventDefault(); cancelOperation(); };
        const hideBtn = document.createElement('a');
        hideBtn.className = 'btnv6_blue_hoverfade btn_medium luatools-hide-btn';
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
                const appid = match ? parseInt(match[1], 10) : (window.__LuaToolsCurrentAppId || NaN);
                if (!isNaN(appid) && typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                    Millennium.callServerMethod('luatools', 'CancelAddViaLuaTools', { appid, contentScriptQuery: '' });
                }
            } catch(_) {}
            
            const status = overlay.querySelector('.luatools-status');
            if (status) status.textContent = lt('Cancelled');
            const cancelBtn = overlay.querySelector('.luatools-cancel-btn');
            if (cancelBtn) cancelBtn.style.display = 'none';
            const hideBtn = overlay.querySelector('.luatools-hide-btn');
            if (hideBtn) hideBtn.innerHTML = `<span>${lt('Close')}</span>`;
            
            const wrap = overlay.querySelector('.luatools-progress-wrap');
            const percent = overlay.querySelector('.luatools-percent');
            if (wrap) wrap.style.display = 'none';
            if (percent) percent.style.display = 'none';
            
            runState.inProgress = false;
            runState.appid = null;
        }
    }

    
    function showFixesResultsPopup(data, isGameInstalled) {
        if (document.querySelector('.luatools-fixes-results-overlay')) return;
        
        try { const d = document.querySelector('.luatools-overlay'); if (d) d.remove(); } catch(_) {}
        try { closeToolsMenu(); } catch(_) {}
        try { const f = document.querySelector('.luatools-fixes-results-overlay'); if (f) f.remove(); } catch(_) {}
        try { const l = document.querySelector('.luatools-loading-fixes-overlay'); if (l) l.remove(); } catch(_) {}

        ensureLuaToolsStyles();
        const overlay = document.createElement('div');
        overlay.className = 'luatools-fixes-results-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'position:relative;background:linear-gradient(135deg, #2b2b2b 0%, #1a1a1a 100%);color:#f2f2f2;border:2px solid #6f6f6f;border-radius:8px;min-width:580px;max-width:700px;max-height:80vh;display:flex;flex-direction:column;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.85), 0 0 0 1px rgba(200,200,200,0.2);animation:slideUp 0.1s ease-out;';

        const header = document.createElement('div');
        header.style.cssText = 'flex:0 0 auto;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid rgba(200,200,200,0.25);';

        const title = document.createElement('div');
        title.style.cssText = 'font-size:24px;color:#f2f2f2;font-weight:700;text-shadow:0 2px 8px rgba(0,0,0,0.6);background:linear-gradient(135deg, #f2f2f2 0%, #bdbdbd 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        title.textContent = lt('LuaTools · Fixes Menu');

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
                    const genericUrl = 'https://files.luatools.work/GameBypasses/' + data.appid + '.zip';
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
                    const onlineUrl = data.onlineFix.url || ('https://files.luatools.work/OnlineFix1/' + data.appid + '.zip');
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
                    showLuaToolsConfirm('LuaTools', lt('Are you sure you want to un-fix? This will remove fix files and verify game files.'),
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
                        Millennium.callServerMethod('luatools', 'OpenExternalUrl', { url: 'https://github.com/ShayneVi/', contentScriptQuery: '' });
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
            if (window.__LuaToolsGameInstallPath) {
                try {
                    Millennium.callServerMethod('luatools', 'OpenGameFolder', { path: window.__LuaToolsGameInstallPath, contentScriptQuery: '' });
                } catch(err) { backendLog('LuaTools: Failed to open game folder: ' + err); }
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
            const url = 'https://discord.gg/luatools';
            try { Millennium.callServerMethod('luatools', 'OpenExternalUrl', { url, contentScriptQuery: '' }); } catch(_) {}
        };
        settingsBtn.onclick = function(e) {
            e.preventDefault();
            try { overlay.remove(); } catch(_) {}
            showSettingsManagerPopup(false, function() { showFixesResultsPopup(data, isGameInstalled); });
        };

        function startUnfix(appid) {
            try {
                Millennium.callServerMethod('luatools', 'UnFixGame', { appid: appid, installPath: window.__LuaToolsGameInstallPath, contentScriptQuery: '' }).then(function(res){
                    const payload = typeof res === 'string' ? JSON.parse(res) : res;
                    if (payload && payload.success) {
                        showUnfixProgress(appid);
                    } else {
                        const errorKey = (payload && payload.error) ? String(payload.error) : '';
                        const errorMsg = (errorKey && (errorKey.startsWith('menu.error.') || errorKey.startsWith('common.'))) ? t(errorKey) : (errorKey || lt('Failed to start un-fix'));
                        ShowLuaToolsAlert('LuaTools', errorMsg);
                    }
                }).catch(function(){
                    const msg = lt('Error starting un-fix');
                    ShowLuaToolsAlert('LuaTools', msg);
                });
            } catch(err) { backendLog('LuaTools: Un-Fix start error: ' + err); }
        }
    }

    function showFixesLoadingPopupAndCheck(appid) {
        if (document.querySelector('.luatools-loading-fixes-overlay')) return;
        try { const d = document.querySelector('.luatools-overlay'); if (d) d.remove(); } catch(_) {}
        try { closeToolsMenu(); } catch(_) {}
        try { const f = document.querySelector('.luatools-fixes-overlay'); if (f) f.remove(); } catch(_) {}

        ensureLuaToolsStyles();
        const overlay = document.createElement('div');
        overlay.className = 'luatools-loading-fixes-overlay';
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

        Millennium.callServerMethod('luatools', 'CheckForFixes', { appid, contentScriptQuery: '' }).then(function(res){
            const payload = typeof res === 'string' ? JSON.parse(res) : res;
            if (payload && payload.success) {
                const isGameInstalled = window.__LuaToolsGameIsInstalled === true;
                showFixesResultsPopup(payload, isGameInstalled);
            } else {
                const errText = (payload && payload.error) ? String(payload.error) : lt('Failed to check for fixes.');
                ShowLuaToolsAlert('LuaTools', errText);
            }
        }).catch(function() {
            const msg = lt('Error checking for fixes');
            ShowLuaToolsAlert('LuaTools', msg);
        }).finally(function() {
            clearInterval(progressInterval);
            progressBar.style.width = '100%';
            setTimeout(function() {
                try {
                    const l = document.querySelector('.luatools-loading-fixes-overlay');
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
            
            
            if (!window.__LuaToolsGameInstallPath) {
                const msg = lt('Game install path not found');
                ShowLuaToolsAlert('LuaTools', msg);
                return;
            }
            
            backendLog('LuaTools: Applying fix ' + fixType + ' for appid ' + appid);
            
            
            Millennium.callServerMethod('luatools', 'ApplyGameFix', { 
                appid: appid, 
                downloadUrl: downloadUrl, 
                installPath: window.__LuaToolsGameInstallPath,
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
                        ShowLuaToolsAlert('LuaTools', errorMsg);
                    }
                } catch(err) {
                    backendLog('LuaTools: ApplyGameFix response error: ' + err);
                    const msg = lt('Error applying fix');
                    ShowLuaToolsAlert('LuaTools', msg);
                }
            }).catch(function(err){
                backendLog('LuaTools: ApplyGameFix error: ' + err);
                const msg = lt('Error applying fix');
                ShowLuaToolsAlert('LuaTools', msg);
            });
        } catch(err) {
            backendLog('LuaTools: applyFix error: ' + err);
        }
    }

    
    function showFixDownloadProgress(appid, fixType) {
        
        if (document.querySelector('.luatools-overlay')) return;

        ensureLuaToolsStyles();
        const overlay = document.createElement('div');
        overlay.className = 'luatools-overlay';
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
        hideBtn.className = 'luatools-btn';
        hideBtn.style.flex = '1';
        hideBtn.innerHTML = `<span>${lt('Hide')}</span>`;
        hideBtn.onclick = function(e){ e.preventDefault(); overlay.remove(); };
        btnRow.appendChild(hideBtn);

        const cancelBtn = document.createElement('a');
        cancelBtn.href = '#';
        cancelBtn.className = 'luatools-btn primary';
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
            Millennium.callServerMethod('luatools', 'CancelApplyFix', { appid: appid, contentScriptQuery: '' }).then(function(res){
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
                    backendLog('LuaTools: CancelApplyFix response error: ' + err);
                    const msg = lt('Failed to cancel fix download');
                    ShowLuaToolsAlert('LuaTools', msg);
                }
            }).catch(function(err){
                cancelBtn.dataset.pending = '0';
                const span2 = cancelBtn.querySelector('span');
                if (span2) span2.textContent = lt('Cancel');
                const msgEl2 = document.getElementById('lt-fix-progress-msg');
                if (msgEl2 && msgEl2.dataset.last) msgEl2.textContent = msgEl2.dataset.last;
                backendLog('LuaTools: CancelApplyFix error: ' + err);
                const msg = lt('Failed to cancel fix download');
                ShowLuaToolsAlert('LuaTools', msg);
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
        closeBtn.className = 'luatools-btn primary';
        closeBtn.style.minWidth = '140px';
        closeBtn.innerHTML = `<span>${lt('Close')}</span>`;
        closeBtn.onclick = function(e){ e.preventDefault(); overlayEl.remove(); };
        styleGreyscaleLoadingButton(closeBtn, true);
        btnRow.appendChild(closeBtn);
    }

    
    function pollFixProgress(appid, fixType) {
        const poll = function() {
            try {
                const overlayEl = document.querySelector('.luatools-overlay');
                if (!overlayEl) return; 
                
                Millennium.callServerMethod('luatools', 'GetApplyFixStatus', { appid: appid, contentScriptQuery: '' }).then(function(res){
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
                        backendLog('LuaTools: GetApplyFixStatus error: ' + err);
                    }
                });
            } catch(err) {
                backendLog('LuaTools: pollFixProgress error: ' + err);
            }
        };
        setTimeout(poll, 500);
    }

    
    function showUnfixProgress(appid) {
        
        try { const old = document.querySelector('.luatools-unfix-overlay'); if (old) old.remove(); } catch(_) {}

        ensureLuaToolsStyles();
        const overlay = document.createElement('div');
        overlay.className = 'luatools-unfix-overlay';
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
        hideBtn.className = 'luatools-btn';
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
                const overlayEl = document.querySelector('.luatools-unfix-overlay');
                if (!overlayEl) return; 
                
                Millennium.callServerMethod('luatools', 'GetUnfixStatus', { appid: appid, contentScriptQuery: '' }).then(function(res){
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
                                        closeBtn.className = 'luatools-btn primary';
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
                                        backendLog('LuaTools: Running verify for appid ' + appid);
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
                                        closeBtn.className = 'luatools-btn primary';
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
                        backendLog('LuaTools: GetUnfixStatus error: ' + err);
                    }
                });
            } catch(err) {
                backendLog('LuaTools: pollUnfixProgress error: ' + err);
            }
        };
        setTimeout(poll, 500);
    }

    function fetchSettingsConfig(forceRefresh) {
        try {
            if (!forceRefresh && window.__LuaToolsSettings && Array.isArray(window.__LuaToolsSettings.schema)) {
                return Promise.resolve(window.__LuaToolsSettings);
            }
        } catch(_) {}

        if (typeof Millennium === 'undefined' || typeof Millennium.callServerMethod !== 'function') {
            return Promise.reject(new Error(lt('LuaTools backend unavailable')));
        }

        return Millennium.callServerMethod('luatools', 'GetSettingsConfig', { contentScriptQuery: '' }).then(function(res){
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
            window.__LuaToolsSettings = config;
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
        if (document.querySelector('.luatools-settings-manager-overlay')) return;

        try { closeToolsMenu(); } catch(_) {}

        ensureLuaToolsStyles();
        ensureFontAwesome();

        const overlay = document.createElement('div');
        overlay.className = 'luatools-settings-manager-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:100000;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.className = 'luatools-settings-manager-modal';
        modal.style.cssText = 'position:relative;border-radius:8px;min-width:650px;max-width:750px;max-height:85vh;display:flex;flex-direction:column;animation:slideUp 0.1s ease-out;overflow:hidden;';

        const header = document.createElement('div');
        header.className = 'luatools-settings-manager-header';
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:22px 24px 14px;';

        const title = document.createElement('div');
        title.className = 'luatools-settings-manager-title';
        title.style.cssText = 'font-size:22px;font-weight:700;';
        title.textContent = t('settings.title', 'LuaTools · Settings');

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
        contentWrap.className = 'luatools-settings-manager-content';
        contentWrap.style.cssText = 'flex:1 1 auto;overflow-y:auto;overflow-x:hidden;padding:18px;margin:0 24px;border-radius:12px;';

        const tabsBar = document.createElement('div');
        tabsBar.className = 'luatools-settings-tabs';

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'padding:18px 24px 22px;display:flex;gap:12px;justify-content:space-between;align-items:center;';

        const backBtn = createSettingsButton('back', '<i class="fa-solid fa-arrow-left"></i>');
        const rightButtons = document.createElement('div');
        rightButtons.style.cssText = 'display:flex;gap:8px;';
        const refreshBtn = createSettingsButton('refresh', '<i class="fa-solid fa-arrow-rotate-right"></i>');
        const saveBtn = createSettingsButton('save', '<i class="fa-solid fa-floppy-disk"></i>', true);

        modal.appendChild(header);
        modal.appendChild(tabsBar);
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

            btn.className = 'luatools-btn';
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
            title.textContent = t('settings.title', 'LuaTools · Settings');
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
            btn.className = 'luatools-settings-tab';
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
            let statusLine = contentWrap.querySelector('.luatools-settings-status');
            if (!statusLine) {
                statusLine = document.createElement('div');
                statusLine.className = 'luatools-settings-status';
                statusLine.style.cssText = 'font-size:12px;margin-top:10px;transform:translateY(12px);color:#cfcfcf;min-height:18px;text-align:center;';
                contentWrap.insertBefore(statusLine, contentWrap.firstChild);
            }
            statusLine.textContent = text || '';
            statusLine.style.color = color || '#cfcfcf';
        }

        function clearStatus() {
            const statusLine = contentWrap.querySelector('.luatools-settings-status');
            if (statusLine) statusLine.remove();
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
                    groupTitle.style.cssText = 'font-size:20px;color:#e6e6e6;margin-bottom:16px;margin-top:-20px;font-weight:600;text-align:center;';
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
                            try { backendLog('LuaTools: language select changed to ' + selectEl.value); } catch(_) {}
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
                        yesBtn.className = 'btnv6_blue_hoverfade btn_small';
                        yesBtn.href = '#';
                        yesBtn.innerHTML = '<span>' + yesLabel + '</span>';

                        const noBtn = document.createElement('a');
                        noBtn.className = 'btnv6_blue_hoverfade btn_small';
                        noBtn.href = '#';
                        noBtn.innerHTML = '<span>' + noLabel + '</span>';

                        const yesSpan = yesBtn.querySelector('span');
                        const noSpan = noBtn.querySelector('span');

                        function refreshToggleButtons() {
                            const currentValue = state.draft[group.key][option.key] === true;
                            if (currentValue) {
                                yesBtn.style.background = '#bdbdbd';
                                yesBtn.style.color = '#1a1a1a';
                                if (yesSpan) yesSpan.style.color = '#1a1a1a';
                                noBtn.style.background = '';
                                noBtn.style.color = '';
                                if (noSpan) noSpan.style.color = '';
                            } else {
                                noBtn.style.background = '#bdbdbd';
                                noBtn.style.color = '#1a1a1a';
                                if (noSpan) noSpan.style.color = '#1a1a1a';
                                yesBtn.style.background = '';
                                yesBtn.style.color = '';
                                if (yesSpan) yesSpan.style.color = '';
                            }
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
            sectionEl.id = 'luatools-installed-fixes-section';
            sectionEl.style.cssText = 'margin-top:8px;padding:18px;background:linear-gradient(135deg, rgba(70,70,70,0.2) 0%, rgba(30,30,30,0.6) 100%);border:1px solid rgba(150,150,150,0.35);border-radius:12px;box-shadow:0 4px 15px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.03);position:relative;overflow:hidden;';

            const sectionGlow = document.createElement('div');
            sectionGlow.style.cssText = 'position:absolute;top:-100%;left:-100%;width:300%;height:300%;background:radial-gradient(circle, rgba(180,180,180,0.08) 0%, transparent 70%);pointer-events:none;';
            sectionEl.appendChild(sectionGlow);

            const sectionTitle = document.createElement('div');
            sectionTitle.style.cssText = 'font-size:18px;color:#e6e6e6;margin-bottom:16px;font-weight:700;text-align:center;text-shadow:none;position:relative;z-index:1;letter-spacing:0.5px;';
            sectionTitle.innerHTML = '<i class="fa-solid fa-wrench" style="margin-right:10px;"></i>' + (titleOverride || t('settings.installedFixes.title', 'Installed Fixes'));
            sectionEl.appendChild(sectionTitle);

            const listContainer = document.createElement('div');
            listContainer.id = 'luatools-fixes-list';
            listContainer.style.cssText = 'min-height:50px;';
            sectionEl.appendChild(listContainer);

            host.appendChild(sectionEl);

            loadInstalledFixes(listContainer, filterFn);
        }

        function loadInstalledFixes(container, filterFn) {
            container.innerHTML = '<div style="padding:14px;text-align:center;color:#cfcfcf;">' + t('settings.installedFixes.loading', 'Scanning for installed fixes...') + '</div>';

            Millennium.callServerMethod('luatools', 'GetInstalledFixes', { contentScriptQuery: '' })
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
            gameName.textContent = fix.gameName || 'Unknown Game (' + fix.appid + ')';
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

                showLuaToolsConfirm(
                    fix.gameName || 'LuaTools',
                    t('settings.installedFixes.deleteConfirm', 'Are you sure you want to remove this fix? This will delete fix files and run Steam verification.'),
                    function() {
                        
                        deleteBtn.dataset.busy = '1';
                        deleteBtn.style.opacity = '0.6';
                        deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

                        Millennium.callServerMethod('luatools', 'UnFixGame', {
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

                Millennium.callServerMethod('luatools', 'GetUnfixStatus', { appid: appid, contentScriptQuery: '' })
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
                                    backendLog('LuaTools: Running verify for appid ' + appid);
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
            sectionEl.id = 'luatools-installed-lua-section';
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
            listContainer.id = 'luatools-lua-list';
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

            Millennium.callServerMethod('luatools', 'GetInstalledLuaScripts', { contentScriptQuery: '' })
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

                        
                        const hasUnknownGames = filtered.some(function(s) {
                            return s.gameName && s.gameName.startsWith('Unknown Game');
                        });

                        
                        if (hasUnknownGames) {
                            const infoBanner = document.createElement('div');
                            infoBanner.style.cssText = 'margin-bottom:16px;padding:12px 14px;background:rgba(120,120,120,0.2);border:1px solid rgba(180,180,180,0.35);border-radius:6px;color:#d9d9d9;font-size:12px;display:flex;align-items:center;gap:10px;';
                            infoBanner.innerHTML = '<i class="fa-solid fa-circle-info" style="font-size:16px;"></i><span>' + t('settings.installedLua.unknownInfo', 'Games showing \'Unknown Game\' were installed manually (not via LuaTools).') + '</span>';
                            container.appendChild(infoBanner);
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
            gameName.textContent = script.gameName || 'Unknown Game (' + script.appid + ')';

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

                showLuaToolsConfirm(
                    script.gameName || 'LuaTools',
                    t('settings.installedLua.deleteConfirm', 'Remove via LuaTools for this game?'),
                    function() {
                        
                        deleteBtn.dataset.busy = '1';
                        deleteBtn.style.opacity = '0.6';
                        deleteBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

                        Millennium.callServerMethod('luatools', 'DeleteLuaToolsForApp', {
                            appid: script.appid,
                            contentScriptQuery: ''
                        })
                        .then(function(res) {
                            const response = typeof res === 'string' ? JSON.parse(res) : res;
                            if (!response || !response.success) {
                                alert(t('settings.installedLua.deleteError', 'Failed to remove Lua script.'));
                                deleteBtn.dataset.busy = '0';
                                deleteBtn.style.opacity = '1';
                                deleteBtn.innerHTML = '<span><i class="fa-solid fa-trash"></i> ' + t('settings.installedLua.delete', 'Delete') + '</span>';
                                return;
                            }

                            
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
                            deleteBtn.innerHTML = '<span><i class="fa-solid fa-trash"></i> ' + t('settings.installedLua.delete', 'Delete') + '</span>';
                        });
                    },
                    function() {
                        
                    }
                );
            });

            itemEl.appendChild(deleteBtn);
            return itemEl;
        }

        function renderGamesTab() {
            contentWrap.innerHTML = '';
            clearStatus();
            renderInstalledLuaSection(contentWrap, t('settings.tab.gamesTitle', 'Games via LuaTools'));
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
                    ShowLuaToolsAlert('LuaTools', message);
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
            try { backendLog('LuaTools: collectChanges payload ' + JSON.stringify(changes)); } catch(_) {}
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
            try { backendLog('LuaTools: sending settings payload ' + JSON.stringify(payloadToSend)); } catch(_) {}
            
            Millennium.callServerMethod('luatools', 'ApplySettingsChanges', {
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
                    if (window.__LuaToolsSettings) {
                        window.__LuaToolsSettings.values = JSON.parse(JSON.stringify(state.config.values));
                        window.__LuaToolsSettings.schemaVersion = state.config.schemaVersion;
                        window.__LuaToolsSettings.lastFetched = Date.now();
                        if (response && response.translations && typeof response.translations === 'object') {
                            window.__LuaToolsSettings.translations = response.translations;
                        }
                        if (response && response.language) {
                            window.__LuaToolsSettings.language = response.language;
                        }
                    }
                } catch(_) {}

                if (response && response.translations && typeof response.translations === 'object') {
                    applyTranslationBundle({
                        language: response.language || (window.__LuaToolsI18n && window.__LuaToolsI18n.language) || 'en',
                        locales: (window.__LuaToolsI18n && window.__LuaToolsI18n.locales) || (state.config && state.config.locales) || [],
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
            
            var list = document.querySelectorAll('.luatools-settings-overlay');
            for (var i = 0; i < list.length; i++) {
                if (list[i].classList && list[i].classList.contains('luatools-tools-panel')) continue;
                try { list[i].remove(); } catch(_) {}
            }
            
            var list2 = document.getElementsByClassName('luatools-overlay');
            while (list2 && list2.length > 0) {
                try { list2[0].remove(); } catch(_) { break; }
            }
        } catch(_) {}
    }

    
    function showLuaToolsNotification(title, message, options) {
        ensureLuaToolsStyles();
        var opts = (options && typeof options === 'object') ? options : {};
        var timeoutMs = (typeof opts.timeoutMs === 'number') ? opts.timeoutMs : 3000;

        var stack = document.querySelector('.luatools-toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.className = 'luatools-toast-stack';
            document.body.appendChild(stack);
        }

        var toast = document.createElement('div');
        toast.className = 'luatools-toast';

        var titleEl = document.createElement('div');
        titleEl.className = 'luatools-toast-title';
        titleEl.textContent = String(title || 'LuaTools');

        var messageEl = document.createElement('div');
        messageEl.className = 'luatools-toast-message';
        messageEl.textContent = String(message || '');

        function dismiss(reason) {
            if (toast.getAttribute('data-closing') === '1') return;
            toast.setAttribute('data-closing', '1');
            toast.classList.add('luatools-toast-out');
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
        if (window.__LuaToolsRestartCountdownInFlight) return;
        window.__LuaToolsRestartCountdownInFlight = true;

        let remaining = secs;
        let toast = null;
        let useOverlay = overlay && document.body && document.body.contains(overlay);

        function updateMessage() {
            const msg = lt('Restarting Steam in {count}…').replace('{count}', remaining);
            if (useOverlay) {
                const status = overlay.querySelector('.luatools-status');
                if (status) status.textContent = msg;
            } else if (toast && toast.__messageEl) {
                toast.__messageEl.textContent = msg;
            }
        }

        if (!useOverlay) {
            toast = showLuaToolsNotification('LuaTools', lt('Restarting Steam in {count}…').replace('{count}', remaining), { timeoutMs: secs * 1000 });
        }
        updateMessage();

        const timer = setInterval(function() {
            remaining -= 1;
            if (remaining <= 0) {
                clearInterval(timer);
                try {
                    if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                        Millennium.callServerMethod('luatools', 'RestartSteam', { contentScriptQuery: '' });
                    }
                } catch(_) {}
                window.__LuaToolsRestartCountdownInFlight = false;
                return;
            }
            updateMessage();
        }, 1000);
    }

    
    function showLuaToolsAlert(title, message, onClose) {
        if (document.querySelector('.luatools-alert-overlay')) return;

        ensureLuaToolsStyles();
        const overlay = document.createElement('div');
        overlay.className = 'luatools-alert-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);z-index:100001;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);z-index:100001;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:400px;max-width:520px;padding:32px 36px;box-shadow:0 20px 60px rgba(0,0,0,.9), 0 0 0 1px rgba(102,192,244,0.4);animation:slideUp 0.1s ease-out;';

        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size:22px;color:#fff;margin-bottom:20px;font-weight:700;text-align:left;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        titleEl.textContent = String(title || 'LuaTools');

        const messageEl = document.createElement('div');
        messageEl.style.cssText = 'font-size:15px;line-height:1.6;margin-bottom:28px;color:#c7d5e0;text-align:left;padding:0 8px;';
        messageEl.textContent = String(message || '');

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;justify-content:flex-end;';

        const okBtn = document.createElement('a');
        okBtn.href = '#';
        okBtn.className = 'luatools-btn primary';
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

    
    function ShowLuaToolsAlert(title, message) {
        try {
            showLuaToolsNotification(title, message, { timeoutMs: 3000 });
        } catch(err) {
            backendLog('LuaTools: Alert error, falling back: ' + err);
            try { showLuaToolsAlert(title, message); } catch(_) {}
            try { alert(String(title) + '\n\n' + String(message)); } catch(_) {}
        }
    }

    
    function showLuaToolsConfirm(title, message, onConfirm, onCancel) {
        
        closeSettingsOverlay();

        
        if (document.querySelector('.luatools-confirm-overlay')) return;

        ensureLuaToolsStyles();
        const overlay = document.createElement('div');
        overlay.className = 'luatools-confirm-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);z-index:100001;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(10px);z-index:100001;display:flex;align-items:center;justify-content:center;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:420px;max-width:540px;padding:32px 36px;box-shadow:0 20px 60px rgba(0,0,0,.9), 0 0 0 1px rgba(102,192,244,0.4);animation:slideUp 0.1s ease-out;';

        const titleEl = document.createElement('div');
        titleEl.style.cssText = 'font-size:22px;color:#fff;margin-bottom:20px;font-weight:700;text-align:center;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;';
        titleEl.textContent = String(title || 'LuaTools');

        const messageEl = document.createElement('div');
        messageEl.style.cssText = 'font-size:15px;line-height:1.6;margin-bottom:28px;color:#c7d5e0;text-align:center;';
        messageEl.textContent = String(message || lt('Are you sure?'));

        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;gap:12px;justify-content:center;';

        const cancelBtn = document.createElement('a');
        cancelBtn.href = '#';
        cancelBtn.className = 'luatools-btn';
        cancelBtn.style.flex = '1';
        cancelBtn.innerHTML = `<span>${lt('Cancel')}</span>`;
        cancelBtn.onclick = function(e) {
            e.preventDefault();
            overlay.remove();
            try { onCancel && onCancel(); } catch(_) {}
        };
        const confirmBtn = document.createElement('a');
        confirmBtn.href = '#';
        confirmBtn.className = 'luatools-btn primary';
        confirmBtn.style.flex = '1';
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

    
    function ensureStyles() {
        if (!document.getElementById('luatools-spacing-styles')) {
            const style = document.createElement('style');
            style.id = 'luatools-spacing-styles';
            style.textContent = '.luatools-restart-button, .luatools-button, .luatools-icon-button{ margin-left:6px !important; }';
            document.head.appendChild(style); 
        }
    }

    
    function updateButtonTranslations() {
        try {
            
            const restartBtn = document.querySelector('.luatools-restart-button');
            if (restartBtn) {
                const restartText = lt('Restart Steam');
                restartBtn.title = restartText;
                restartBtn.setAttribute('data-tooltip-text', restartText);
                const rspan = restartBtn.querySelector('span');
                if (rspan) {
                    rspan.textContent = restartText;
                }
            }
            
            
            const luatoolsBtn = document.querySelector('.luatools-button');
            if (luatoolsBtn) {
                const addViaText = lt('Add via LuaTools');
                luatoolsBtn.title = addViaText;
                luatoolsBtn.setAttribute('data-tooltip-text', addViaText);
                const span = luatoolsBtn.querySelector('span');
                if (span) {
                    span.textContent = addViaText;
                }
            }
        } catch(err) {
            backendLog('LuaTools: updateButtonTranslations error: ' + err);
        }
    }

    
    function addLuaToolsButton() {
        
        try {
            const injected = document.querySelectorAll('.luatools-restart-button, .luatools-button, .luatools-icon-button');
            for (let i = 0; i < injected.length; i++) {
                try { injected[i].remove(); } catch(_) {}
            }
        } catch(_) {}
        return;

        
        const currentUrl = window.location.href;
        if (window.__LuaToolsLastUrl !== currentUrl) {
            
            window.__LuaToolsLastUrl = currentUrl;
            window.__LuaToolsButtonInserted = false;
            window.__LuaToolsRestartInserted = false;
            window.__LuaToolsIconInserted = false;
            window.__LuaToolsPresenceCheckInFlight = false;
            window.__LuaToolsPresenceCheckAppId = undefined;
            
            ensureTranslationsLoaded(false).then(function() {
                updateButtonTranslations();
            });
        }
        
        
        const steamdbContainer = document.querySelector('.steamdb-buttons') || 
                                document.querySelector('[data-steamdb-buttons]') ||
                                document.querySelector('.apphub_OtherSiteInfo');

        if (steamdbContainer) {
            
            const existingBtn = document.querySelector('.luatools-button');
            if (existingBtn) {
                ensureTranslationsLoaded(false).then(function() {
                    updateButtonTranslations();
                });
            }
            
            
            if (existingBtn || window.__LuaToolsButtonInserted) {
                if (!logState.existsOnce) { backendLog('LuaTools button already exists, skipping'); logState.existsOnce = true; }
                
                return;
            }

            
            try {
                if (!document.querySelector('.luatools-restart-button') && !window.__LuaToolsRestartInserted) {
                    ensureStyles();
                    const referenceBtn = steamdbContainer.querySelector('a');
                    const restartBtn = document.createElement('a');
                    if (referenceBtn && referenceBtn.className) {
                        restartBtn.className = referenceBtn.className + ' luatools-restart-button';
                    } else {
                        restartBtn.className = 'btnv6_blue_hoverfade btn_medium luatools-restart-button';
                    }
                    restartBtn.href = '#';
                    const restartText = lt('Restart Steam');
                    restartBtn.title = restartText;
                    restartBtn.setAttribute('data-tooltip-text', restartText);
                    const rspan = document.createElement('span');
                    rspan.textContent = restartText;
                    restartBtn.appendChild(rspan);
                    
                    try {
                        if (referenceBtn) {
                            const cs = window.getComputedStyle(referenceBtn);
                            restartBtn.style.marginLeft = cs.marginLeft;
                            restartBtn.style.marginRight = cs.marginRight;
                        }
                    } catch(_) {}

                    restartBtn.addEventListener('click', function(e){
                        e.preventDefault();
                        try { Millennium.callServerMethod('luatools', 'RestartSteam', { contentScriptQuery: '' }); } catch(_) {}
                    });

                    if (referenceBtn && referenceBtn.parentElement) {
                        referenceBtn.after(restartBtn);
                    } else {
                        steamdbContainer.appendChild(restartBtn);
                    }
                    
                    try {
                        if (!document.querySelector('.luatools-icon-button') && !window.__LuaToolsIconInserted) {
                            const iconBtn = document.createElement('a');
                            if (referenceBtn && referenceBtn.className) {
                                iconBtn.className = referenceBtn.className + ' luatools-icon-button';
                            } else {
                                iconBtn.className = 'btnv6_blue_hoverfade btn_medium luatools-icon-button';
                            }
                            iconBtn.href = '#';
                            iconBtn.title = 'LuaTools Helper';
                            iconBtn.setAttribute('data-tooltip-text', 'LuaTools Helper');
                            
                            try {
                                if (referenceBtn) {
                                    const cs = window.getComputedStyle(referenceBtn);
                                    iconBtn.style.marginLeft = cs.marginLeft;
                                    iconBtn.style.marginRight = cs.marginRight;
                                }
                            } catch(_) {}
                            const ispan = document.createElement('span');
                            const img = document.createElement('img');
                            img.alt = '';
                            img.style.height = '16px';
                            img.style.width = '16px';
                            img.style.verticalAlign = 'middle';
                            
                            try {
                                Millennium.callServerMethod('luatools', 'GetIconDataUrl', { contentScriptQuery: '' }).then(function(res){
                                    try {
                                        const payload = typeof res === 'string' ? JSON.parse(res) : res;
                                        if (payload && payload.success && payload.dataUrl) {
                                            img.src = payload.dataUrl;
                                        } else {
                                            img.src = 'LuaTools/luatools-icon.png';
                                        }
                                    } catch(_) { img.src = 'LuaTools/luatools-icon.png'; }
                                });
                            } catch(_) {
                                img.src = 'LuaTools/luatools-icon.png';
                            }
                            
                            img.onerror = function(){
                                ispan.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 8a4 4 0 100 8 4 4 0 000-8zm9.94 3.06l-2.12-.35a7.962 7.962 0 00-1.02-2.46l1.29-1.72a.75.75 0 00-.09-.97l-1.41-1.41a.75.75 0 00-.97-.09l-1.72 1.29c-.77-.44-1.6-.78-2.46-1.02L13.06 2.06A.75.75 0 0012.31 2h-1.62a.75.75 0 00-.75.65l-.35 2.12a7.962 7.962 0 00-2.46 1.02L5 4.6a.75.75 0 00-.97.09L2.62 6.1a.75.75 0 00-.09.97l1.29 1.72c-.44.77-.78 1.6-1.02 2.46l-2.12.35a.75.75 0 00-.65.75v1.62c0 .37.27.69.63.75l2.14.36c.24.86.58 1.69 1.02 2.46L2.53 18a.75.75 0 00.09.97l1.41 1.41c.26.26.67.29.97.09l1.72-1.29c.77.44 1.6.78 2.46 1.02l.35 2.12c.06.36.38.63.75.63h1.62c.37 0 .69-.27.75-.63l.36-2.14c.86-.24 1.69-.58 2.46-1.02l1.72 1.29c.3.2.71.17.97-.09l1.41-1.41c.26-.26.29-.67.09-.97l-1.29-1.72c.44-.77.78-1.6 1.02-2.46l2.12-.35c.36-.06.63-.38.63-.75v-1.62a.75.75 0 00-.65-.75z"/></svg>';
                            };
                            ispan.appendChild(img);
                            iconBtn.appendChild(ispan);
                            iconBtn.addEventListener('click', function(e){ e.preventDefault(); showSettingsPopup(); });
                            restartBtn.after(iconBtn);
                            window.__LuaToolsIconInserted = true;
                            backendLog('Inserted Icon button');
                        }
                    } catch(_) {}
                    window.__LuaToolsRestartInserted = true;
                    backendLog('Inserted Restart Steam button');
                }
            } catch(_) {}

            
            if (document.querySelector('.luatools-button') || window.__LuaToolsButtonInserted) {
                return;
            }
            
            
            let referenceBtn = steamdbContainer.querySelector('a');
            const luatoolsButton = document.createElement('a');
            luatoolsButton.href = '#';
            
            if (referenceBtn && referenceBtn.className) {
                luatoolsButton.className = referenceBtn.className + ' luatools-button';
            } else {
                luatoolsButton.className = 'btnv6_blue_hoverfade btn_medium luatools-button';
            }
            const span = document.createElement('span');
            const addViaText = lt('Add via LuaTools');
            span.textContent = addViaText;
            luatoolsButton.appendChild(span);
            
            luatoolsButton.title = addViaText;
            luatoolsButton.setAttribute('data-tooltip-text', addViaText);
            
            try {
                if (referenceBtn) {
                    const cs = window.getComputedStyle(referenceBtn);
                    luatoolsButton.style.marginLeft = cs.marginLeft;
                    luatoolsButton.style.marginRight = cs.marginRight;
                }
            } catch(_) {}
            
            
            luatoolsButton.addEventListener('click', function(e) {
                e.preventDefault();
                backendLog('LuaTools button clicked (delegated handler will process)');
            });
            
            
            try {
                const match = window.location.href.match(/https:\/\/store\.steampowered\.com\/app\/(\d+)/) || window.location.href.match(/https:\/\/steamcommunity\.com\/app\/(\d+)/);
                const appid = match ? parseInt(match[1], 10) : NaN;
                if (!isNaN(appid) && typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                    
                    if (window.__LuaToolsPresenceCheckInFlight && window.__LuaToolsPresenceCheckAppId === appid) {
                        return;
                    }
                    window.__LuaToolsPresenceCheckInFlight = true;
                    window.__LuaToolsPresenceCheckAppId = appid;
                    window.__LuaToolsCurrentAppId = appid;
                    Millennium.callServerMethod('luatools', 'HasLuaToolsForApp', { appid, contentScriptQuery: '' }).then(function(res){
                        try {
                            const payload = typeof res === 'string' ? JSON.parse(res) : res;
                            if (payload && payload.success && payload.exists === true) {
                                backendLog('LuaTools already present for this app; not inserting button');
                                window.__LuaToolsPresenceCheckInFlight = false;
                                return; 
                            }
                            
                            if (!document.querySelector('.luatools-button') && !window.__LuaToolsButtonInserted) {
                                const restartExisting = steamdbContainer.querySelector('.luatools-restart-button');
                                if (restartExisting && restartExisting.after) {
                                    restartExisting.after(luatoolsButton);
                                } else if (referenceBtn && referenceBtn.after) {
                                    referenceBtn.after(luatoolsButton);
                                } else {
                                    steamdbContainer.appendChild(luatoolsButton);
                                }
                                window.__LuaToolsButtonInserted = true;
                                backendLog('LuaTools button inserted');
                            }
                            window.__LuaToolsPresenceCheckInFlight = false;
                        } catch(_) {
                            if (!document.querySelector('.luatools-button') && !window.__LuaToolsButtonInserted) {
                                steamdbContainer.appendChild(luatoolsButton);
                                window.__LuaToolsButtonInserted = true;
                                backendLog('LuaTools button inserted');
                            }
                            window.__LuaToolsPresenceCheckInFlight = false;
                        }
                    });
                } else {
                    if (!document.querySelector('.luatools-button') && !window.__LuaToolsButtonInserted) {
                        const restartExisting = steamdbContainer.querySelector('.luatools-restart-button');
                        if (restartExisting && restartExisting.after) {
                            restartExisting.after(luatoolsButton);
                        } else if (referenceBtn && referenceBtn.after) {
                            referenceBtn.after(luatoolsButton);
                        } else {
                            steamdbContainer.appendChild(luatoolsButton);
                        }
                        window.__LuaToolsButtonInserted = true;
                        backendLog('LuaTools button inserted');
                    }
                }
            } catch(_) {
                if (!document.querySelector('.luatools-button') && !window.__LuaToolsButtonInserted) {
                    const restartExisting = steamdbContainer.querySelector('.luatools-restart-button');
                    if (restartExisting && restartExisting.after) {
                        restartExisting.after(luatoolsButton);
                    } else if (referenceBtn && referenceBtn.after) {
                        referenceBtn.after(luatoolsButton);
                    } else {
                        steamdbContainer.appendChild(luatoolsButton);
                    }
                    window.__LuaToolsButtonInserted = true;
                    backendLog('LuaTools button inserted');
                }
            }
        } else {
            if (!logState.missingOnce) { backendLog('LuaTools: steamdbContainer not found on this page'); logState.missingOnce = true; }
        }
    }
    
    
    function onFrontendReady() {
        addLuaToolsButton();
        ensureStoreAddButton();
        ensureToolsWidget();
        
        try {
            if (typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                Millennium.callServerMethod('luatools', 'GetInitApisMessage', { contentScriptQuery: '' }).then(function(res){
                    try {
                        const payload = typeof res === 'string' ? JSON.parse(res) : res;
                        if (payload && payload.message) {
                            const msg = String(payload.message);
                            
                            const isUpdateMsg = msg.toLowerCase().includes('update') || msg.toLowerCase().includes('restart');
                            
                            if (isUpdateMsg) {
                                
                                showLuaToolsConfirm('LuaTools', msg, function() {
                                    
                                    try { Millennium.callServerMethod('luatools', 'RestartSteam', { contentScriptQuery: '' }); } catch(_) {}
                                }, function() {
                                    
                                });
                            } else {
                                
                                showLuaToolsNotification('LuaTools', msg, { timeoutMs: 3000 });
                            }
                        }
                    } catch(_){ }
                });
                
                try {
                    if (!sessionStorage.getItem('LuaToolsLoadedAppsGate')) {
                        sessionStorage.setItem('LuaToolsLoadedAppsGate', '1');
                        Millennium.callServerMethod('luatools', 'ReadLoadedApps', { contentScriptQuery: '' }).then(function(res){
                            try {
                                const payload = typeof res === 'string' ? JSON.parse(res) : res;
                                const apps = (payload && payload.success && Array.isArray(payload.apps)) ? payload.apps : [];
                                if (apps.length > 0) {
                                    showLoadedAppsPopup(apps);
                                }
                            } catch(_){ }
                        });
                    }
                } catch(_){ }
            }
        } catch(_) { }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', onFrontendReady);
    } else {
        onFrontendReady();
    }
    
    
    document.addEventListener('click', function(evt) {
        const anchor = evt.target && (evt.target.closest ? evt.target.closest('.luatools-button') : null);
        if (anchor) {
            evt.preventDefault();
            backendLog('LuaTools delegated click');
            
            if (!document.querySelector('.luatools-overlay')) {
                showTestPopup();
            }
            try {
                const match = window.location.href.match(/https:\/\/store\.steampowered\.com\/app\/(\d+)/) || window.location.href.match(/https:\/\/steamcommunity\.com\/app\/(\d+)/);
                const appid = match ? parseInt(match[1], 10) : NaN;
                if (!isNaN(appid) && typeof Millennium !== 'undefined' && typeof Millennium.callServerMethod === 'function') {
                    if (runState.inProgress && runState.appid === appid) {
                        backendLog('LuaTools: operation already in progress for this appid');
                        return;
                    }
                    runState.inProgress = true;
                    runState.appid = appid;
                    Millennium.callServerMethod('luatools', 'StartAddViaLuaTools', { appid, contentScriptQuery: '' });
                    startPolling(appid);
                }
            } catch(_) {}
        }
    }, true);

    
    function startPolling(appid){
        let done = false;
        const timer = setInterval(() => {
            if (done) { clearInterval(timer); return; }
            try {
                Millennium.callServerMethod('luatools', 'GetAddViaLuaToolsStatus', { appid, contentScriptQuery: '' }).then(function(res){
                    try {
                        const payload = typeof res === 'string' ? JSON.parse(res) : res;
                        const st = payload && payload.state ? payload.state : {};
                        
                        
                        const overlay = document.querySelector('.luatools-overlay');
                        const title = overlay ? overlay.querySelector('.luatools-title') : null;
                        const status = overlay ? overlay.querySelector('.luatools-status') : null;
                        const wrap = overlay ? overlay.querySelector('.luatools-progress-wrap') : null;
                        const percent = overlay ? overlay.querySelector('.luatools-percent') : null;
                        const bar = overlay ? overlay.querySelector('.luatools-progress-bar') : null;
                        
                        
                        if (st.currentApi && title) title.textContent = lt('LuaTools · {api}').replace('{api}', st.currentApi);
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
                            
                            const cancelBtn = overlay ? overlay.querySelector('.luatools-cancel-btn') : null;
                            if (cancelBtn) cancelBtn.style.display = '';
                        }
                        if (st.status === 'done'){
                            
                            if (bar) bar.style.width = '100%';
                            if (percent) percent.textContent = '100%';
                            if (status) status.textContent = lt('Game added!');
                            
                            const cancelBtn = overlay ? overlay.querySelector('.luatools-cancel-btn') : null;
                            if (cancelBtn) cancelBtn.style.display = 'none';
                            const hideBtn = overlay ? overlay.querySelector('.luatools-hide-btn') : null;
                            if (hideBtn) hideBtn.innerHTML = '<span>' + lt('Close') + '</span>';
                            
                            if (wrap || percent) {
                            setTimeout(function(){ if (wrap) wrap.style.display = 'none'; if (percent) percent.style.display = 'none'; }, 300);
                            }
                            done = true; clearInterval(timer);
                            runState.inProgress = false; runState.appid = null;
                            
                            const btnEl = document.querySelector('.luatools-button');
                            if (btnEl && btnEl.parentElement) {
                                btnEl.parentElement.removeChild(btnEl);
                            }
                            const storeBtn = document.querySelector('.luatools-store-button-container');
                            if (storeBtn && storeBtn.parentElement) {
                                storeBtn.parentElement.removeChild(storeBtn);
                            }
                            showLibraryBanners();
                            ensureStoreAddButton();
                            scheduleRestartSteam(3, overlay);
                        }
                        if (st.status === 'failed'){
                            
                            if (status) status.textContent = lt('Failed: {error}').replace('{error}', st.error || lt('Unknown error'));
                            
                            const cancelBtn = overlay ? overlay.querySelector('.luatools-cancel-btn') : null;
                            if (cancelBtn) cancelBtn.style.display = 'none';
                            const hideBtn = overlay ? overlay.querySelector('.luatools-hide-btn') : null;
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
    
    
    setTimeout(addLuaToolsButton, 1000);
    setTimeout(addLuaToolsButton, 3000);
    
    
    let lastUrl = window.location.href;
    function checkUrlChange() {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            
            window.__LuaToolsButtonInserted = false;
            window.__LuaToolsRestartInserted = false;
            window.__LuaToolsIconInserted = false;
            window.__LuaToolsPresenceCheckInFlight = false;
            window.__LuaToolsPresenceCheckAppId = undefined;
            
            ensureTranslationsLoaded(false).then(function() {
                updateButtonTranslations();
                addLuaToolsButton();
            });
        }
    }
    
    setInterval(checkUrlChange, 500);
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
            mutations.forEach(function(mutation) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    
                    updateButtonTranslations();
                    addLuaToolsButton();
                    ensureStoreAddButton();
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function showLoadedAppsPopup(apps) {
        
        if (document.querySelector('.luatools-loadedapps-overlay')) return;
        ensureLuaToolsStyles();
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.className = 'luatools-loadedapps-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease-out;';
        overlay.className = 'luatools-loadedapps-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;';
        const modal = document.createElement('div');
        modal.style.cssText = 'background:linear-gradient(135deg, #1b2838 0%, #2a475e 100%);color:#fff;border:2px solid #66c0f4;border-radius:8px;min-width:420px;max-width:640px;padding:28px 32px;box-shadow:0 20px 60px rgba(0,0,0,.8), 0 0 0 1px rgba(102,192,244,0.3);animation:slideUp 0.1s ease-out;';
        const title = document.createElement('div');
        title.style.cssText = 'font-size:24px;color:#fff;margin-bottom:20px;font-weight:700;text-shadow:0 2px 8px rgba(102,192,244,0.4);background:linear-gradient(135deg, #66c0f4 0%, #a4d7f5 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-align:center;';
        title.textContent = lt('LuaTools · Added Games');
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
                    try { Millennium.callServerMethod('luatools', 'OpenExternalUrl', { url, contentScriptQuery: '' }); } catch(_) {}
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
        dismissBtn.onclick = function(e){ e.preventDefault(); try { Millennium.callServerMethod('luatools', 'DismissLoadedApps', { contentScriptQuery: '' }); } catch(_) {} try { sessionStorage.setItem('LuaToolsLoadedAppsShown', '1'); } catch(_) {} overlay.remove(); };
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
