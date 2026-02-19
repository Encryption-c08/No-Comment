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

    
