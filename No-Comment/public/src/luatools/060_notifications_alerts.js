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
