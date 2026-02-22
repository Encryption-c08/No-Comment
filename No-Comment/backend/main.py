import json
import math
import os
import shutil
import threading
import sys
import webbrowser

from typing import Any

import Millennium                
import PluginUtils                

from api_manifest import (
    fetch_free_apis_now as api_fetch_free_apis_now,
    get_init_apis_message as api_get_init_message,
    init_apis as api_init_apis,
)
from auto_update import (
    apply_pending_update_if_any,
    check_for_updates_now as auto_check_for_updates_now,
    restart_steam as auto_restart_steam,
    start_auto_update_background_check,
)
from config import WEBKIT_DIR_NAME, WEB_UI_ICON_FILE, WEB_UI_JS_FILE
from downloads import (
    cancel_add_via_NoComment,
    delete_NoComment_for_app,
    dismiss_loaded_apps,
    get_add_status,
    get_api_related_entries,
    get_daily_add_usage,
    get_icon_data_url,
    get_installed_lua_scripts,
    get_steamdb_related_entries,
    has_NoComment_for_app,
    init_applist,
    read_loaded_apps,
    start_add_via_NoComment,
)
from fixes import (
    apply_game_fix,
    cancel_apply_fix,
    check_for_fixes,
    get_apply_fix_status,
    get_installed_fixes,
    get_unfix_status,
    unfix_game,
)
from utils import ensure_temp_download_dir
from utils import migrate_legacy_backend_layout
from http_client import close_http_client, ensure_http_client
from logger import logger as shared_logger
from paths import get_plugin_dir
from settings.manager import (
    apply_settings_changes,
    get_available_locales,
    get_custom_setting_value,
    get_settings_payload,
    get_translation_map,
    init_settings,
    set_custom_setting_value,
)
from steam_utils import detect_steam_install_path, get_game_install_path_response, open_game_folder

logger = shared_logger


def GetPluginDir() -> str:                                   
    return get_plugin_dir()


class Logger:
    @staticmethod
    def log(message: str) -> str:
        shared_logger.log(f"[Frontend] {message}")
        return json.dumps({"success": True})

    @staticmethod
    def warn(message: str) -> str:
        shared_logger.warn(f"[Frontend] {message}")
        return json.dumps({"success": True})

    @staticmethod
    def error(message: str) -> str:
        shared_logger.error(f"[Frontend] {message}")
        return json.dumps({"success": True})


def _steam_ui_path() -> str:
    return os.path.join(Millennium.steam_path(), "steamui", WEBKIT_DIR_NAME)


def _copy_webkit_files() -> None:
    plugin_dir = get_plugin_dir()
    steam_ui_path = _steam_ui_path()
    if os.path.isdir(steam_ui_path):
        try:
            shutil.rmtree(steam_ui_path)
        except Exception as exc:
            logger.warn(f"Failed to clear NoComment web UI directory {steam_ui_path}: {exc}")
    os.makedirs(steam_ui_path, exist_ok=True)

    public_dir = os.path.join(plugin_dir, "public")
    if not os.path.isdir(public_dir):
        logger.error(f"NoComment public assets directory not found: {public_dir}")
        return

    copied = 0
    for root, _, files in os.walk(public_dir):
        rel_path = os.path.relpath(root, public_dir)
        target_dir = steam_ui_path if rel_path in (".", "") else os.path.join(steam_ui_path, rel_path)
        os.makedirs(target_dir, exist_ok=True)
        for filename in files:
            src = os.path.join(root, filename)
            dst = os.path.join(target_dir, filename)
            try:
                shutil.copy(src, dst)
                copied += 1
            except Exception as exc:
                logger.error(f"Failed to copy NoComment asset {src} -> {dst}: {exc}")

    logger.log(f"Copied {copied} NoComment web assets to {steam_ui_path}")

    js_dst = os.path.join(steam_ui_path, WEB_UI_JS_FILE)
    if not os.path.exists(js_dst):
        logger.error(f"NoComment entry script missing after copy: {js_dst}")

    icon_dst = os.path.join(steam_ui_path, WEB_UI_ICON_FILE)
    if not os.path.exists(icon_dst):
        logger.warn(f"NoComment icon missing after copy: {icon_dst}")


def _inject_webkit_files() -> None:
    script_paths = [
        os.path.join(WEBKIT_DIR_NAME, WEB_UI_JS_FILE),
        os.path.join(WEBKIT_DIR_NAME, "modules", "NoComment.app.js"),
    ]
    for script_path in script_paths:
        Millennium.add_browser_js(script_path)
        logger.log(f"NoComment injected web UI: {script_path}")


def InitApis(contentScriptQuery: str = "") -> str:
    return api_init_apis(contentScriptQuery)


def GetInitApisMessage(contentScriptQuery: str = "") -> str:
    return api_get_init_message(contentScriptQuery)


def FetchFreeApisNow(contentScriptQuery: str = "") -> str:
    return api_fetch_free_apis_now(contentScriptQuery)


def CheckForUpdatesNow(contentScriptQuery: str = "") -> str:
    return json.dumps(auto_check_for_updates_now())


def RestartSteam(contentScriptQuery: str = "") -> str:
    success = auto_restart_steam()
    if success:
        return json.dumps({"success": True})
    return json.dumps({"success": False, "error": "Failed to restart Steam"})


def HasNoCommentForApp(appid: int, contentScriptQuery: str = "") -> str:
    return has_NoComment_for_app(appid)


def StartAddViaNoComment(
    appid: int,
    baseAppid: int = 0,
    baseOwnedOnSteam: bool = False,
    contentScriptQuery: str = "",
) -> str:
    return start_add_via_NoComment(
        appid,
        base_appid=baseAppid,
        base_owned_on_steam=bool(baseOwnedOnSteam),
    )


def GetAddViaNoCommentStatus(appid: int, contentScriptQuery: str = "") -> str:
    return get_add_status(appid)


def GetDailyAddUsage(contentScriptQuery: str = "") -> str:
    return get_daily_add_usage()


def CancelAddViaNoComment(appid: int, contentScriptQuery: str = "") -> str:
    return cancel_add_via_NoComment(appid)


def GetIconDataUrl(contentScriptQuery: str = "") -> str:
    return get_icon_data_url()


def ReadLoadedApps(contentScriptQuery: str = "") -> str:
    return read_loaded_apps()


def DismissLoadedApps(contentScriptQuery: str = "") -> str:
    return dismiss_loaded_apps()


def DeleteNoCommentForApp(appid: int, contentScriptQuery: str = "") -> str:
    return delete_NoComment_for_app(appid)


def CheckForFixes(appid: int, contentScriptQuery: str = "") -> str:
    return check_for_fixes(appid)


def ApplyGameFix(appid: int, downloadUrl: str, installPath: str, fixType: str = "", gameName: str = "", contentScriptQuery: str = "") -> str:
    return apply_game_fix(appid, downloadUrl, installPath, fixType, gameName)


def GetApplyFixStatus(appid: int, contentScriptQuery: str = "") -> str:
    return get_apply_fix_status(appid)


def CancelApplyFix(appid: int, contentScriptQuery: str = "") -> str:
    return cancel_apply_fix(appid)


def UnFixGame(appid: int, installPath: str = "", fixDate: str = "", contentScriptQuery: str = "") -> str:
    return unfix_game(appid, installPath, fixDate)


def GetUnfixStatus(appid: int, contentScriptQuery: str = "") -> str:
    return get_unfix_status(appid)


def GetInstalledFixes(contentScriptQuery: str = "") -> str:
    return get_installed_fixes()


def GetInstalledLuaScripts(contentScriptQuery: str = "") -> str:
    return get_installed_lua_scripts()


def GetSteamDbRelatedEntries(appid: int, contentScriptQuery: str = "") -> str:
    return get_steamdb_related_entries(appid)


def GetApiRelatedEntries(appid: int, contentScriptQuery: str = "") -> str:
    return get_api_related_entries(appid)


def GetGameInstallPath(appid: int, contentScriptQuery: str = "") -> str:
    result = get_game_install_path_response(appid)
    return json.dumps(result)


def OpenGameFolder(path: str, contentScriptQuery: str = "") -> str:
    success = open_game_folder(path)
    if success:
        return json.dumps({"success": True})
    return json.dumps({"success": False, "error": "Failed to open path"})


def OpenExternalUrl(url: str, contentScriptQuery: str = "") -> str:
    try:
        value = str(url or "").strip()
        if not (value.startswith("http://") or value.startswith("https://")):
            return json.dumps({"success": False, "error": "Invalid URL"})
        if sys.platform.startswith("win"):
            try:
                os.startfile(value)                              
            except Exception:
                webbrowser.open(value)
        else:
            webbrowser.open(value)
        return json.dumps({"success": True})
    except Exception as exc:
        logger.warn(f"NoComment: OpenExternalUrl failed: {exc}")
        return json.dumps({"success": False, "error": str(exc)})


def OpenSteamUri(uri: str, contentScriptQuery: str = "") -> str:
    try:
        value = str(uri or "").strip()
        if not value.startswith("steam://"):
            return json.dumps({"success": False, "error": "Invalid Steam URI"})
        if sys.platform.startswith("win"):
            try:
                os.startfile(value)                              
            except Exception:
                webbrowser.open(value)
        else:
            webbrowser.open(value)
        return json.dumps({"success": True})
    except Exception as exc:
        logger.warn(f"NoComment: OpenSteamUri failed: {exc}")
        return json.dumps({"success": False, "error": str(exc)})


def GetToolsWidgetPosition(contentScriptQuery: str = "") -> str:
    try:
        stored = get_custom_setting_value("uiState", "toolsWidgetPosition", None)
        if not isinstance(stored, dict):
            return json.dumps({"success": True, "position": None})

        x_raw = stored.get("x")
        y_raw = stored.get("y")
        x = float(x_raw)
        y = float(y_raw)
        if not math.isfinite(x) or not math.isfinite(y):
            return json.dumps({"success": True, "position": None})

        position = {"x": int(round(x)), "y": int(round(y))}
        return json.dumps({"success": True, "position": position})
    except Exception as exc:
        logger.warn(f"NoComment: GetToolsWidgetPosition failed: {exc}")
        return json.dumps({"success": False, "error": str(exc)})


def SetToolsWidgetPosition(
    x: Any = None,
    y: Any = None,
    position: Any = None,
    contentScriptQuery: str = "",
) -> str:
    try:
        source = position if isinstance(position, dict) else {"x": x, "y": y}
        x_raw = source.get("x")
        y_raw = source.get("y")
        x_num = float(x_raw)
        y_num = float(y_raw)
        if not math.isfinite(x_num) or not math.isfinite(y_num):
            return json.dumps({"success": False, "error": "Invalid position"})

        payload = {"x": int(round(x_num)), "y": int(round(y_num))}
        changed = set_custom_setting_value("uiState", "toolsWidgetPosition", payload)
        return json.dumps({"success": True, "changed": bool(changed), "position": payload})
    except Exception as exc:
        logger.warn(f"NoComment: SetToolsWidgetPosition failed: {exc}")
        return json.dumps({"success": False, "error": str(exc)})


def GetSettingsConfig(contentScriptQuery: str = "") -> str:
    try:
        payload = get_settings_payload()
        response = {
            "success": True,
            "schemaVersion": payload.get("version"),
            "schema": payload.get("schema", []),
            "values": payload.get("values", {}),
            "language": payload.get("language"),
            "locales": payload.get("locales", []),
            "translations": payload.get("translations", {}),
        }
        return json.dumps(response)
    except Exception as exc:
        logger.warn(f"NoComment: GetSettingsConfig failed: {exc}")
        return json.dumps({"success": False, "error": str(exc)})


def ApplySettingsChanges(
    contentScriptQuery: str = "", changes: Any = None, **kwargs: Any
) -> str:                              
    try:
        if "changes" in kwargs and changes is None:
            changes = kwargs["changes"]
        if changes is None and isinstance(kwargs, dict):
            changes = kwargs

        try:
            logger.log(
                "NoComment: ApplySettingsChanges raw argument "
                f"type={type(changes)} value={changes!r}"
            )
            logger.log(f"NoComment: ApplySettingsChanges kwargs: {kwargs}")
        except Exception:
            pass

        payload: Any = None

        if isinstance(changes, str) and changes:
            try:
                payload = json.loads(changes)
            except Exception:
                logger.warn("NoComment: Failed to parse changes string payload")
                return json.dumps({"success": False, "error": "Invalid JSON payload"})
            else:
                                                                                   
                if isinstance(payload, dict) and "changes" in payload:
                    kwargs_payload = payload
                    payload = kwargs_payload.get("changes")
                    if "contentScriptQuery" in kwargs_payload and not contentScriptQuery:
                        contentScriptQuery = kwargs_payload.get("contentScriptQuery", "")
                elif isinstance(payload, dict) and "changesJson" in payload and isinstance(payload["changesJson"], str):
                    try:
                        payload = json.loads(payload["changesJson"])
                    except Exception:
                        logger.warn("NoComment: Failed to parse changesJson string inside payload")
                        return json.dumps({"success": False, "error": "Invalid JSON payload"})
        elif isinstance(changes, dict) and changes:
                                                              
            if "changesJson" in changes and isinstance(changes["changesJson"], str):
                try:
                    payload = json.loads(changes["changesJson"])
                except Exception:
                    logger.warn("NoComment: Failed to parse changesJson payload from dict")
                    return json.dumps({"success": False, "error": "Invalid JSON payload"})
            elif "changes" in changes:
                payload = changes.get("changes")
            else:
                payload = changes
        else:
                                                  
            changes_json = kwargs.get("changesJson")
            if isinstance(changes_json, dict):
                payload = changes_json
            elif isinstance(changes_json, str) and changes_json:
                try:
                    payload = json.loads(changes_json)
                except Exception:
                    logger.warn("NoComment: Failed to parse changesJson payload")
                    return json.dumps({"success": False, "error": "Invalid JSON payload"})
            elif isinstance(changes_json, dict):
                payload = changes_json
            else:
                payload = changes

        if payload is None:
            payload = {}
        elif not isinstance(payload, dict):
            logger.warn(f"NoComment: Parsed payload is not a dict: {payload!r}")
            return json.dumps({"success": False, "error": "Invalid payload format"})

        try:
            logger.log(f"NoComment: ApplySettingsChanges received payload: {payload}")
        except Exception:
            pass

        result = apply_settings_changes(payload)
        try:
            logger.log(f"NoComment: ApplySettingsChanges result: {result}")
        except Exception:
            pass
        response = json.dumps(result)
        try:
            logger.log(f"NoComment: ApplySettingsChanges response json: {response}")
        except Exception:
            pass
        return response
    except Exception as exc:
        logger.warn(f"NoComment: ApplySettingsChanges failed: {exc}")
        return json.dumps({"success": False, "error": str(exc)})


def GetAvailableLocales(contentScriptQuery: str = "") -> str:
    try:
        locales = get_available_locales()
        return json.dumps({"success": True, "locales": locales})
    except Exception as exc:
        logger.warn(f"NoComment: GetAvailableLocales failed: {exc}")
        return json.dumps({"success": False, "error": str(exc)})


def GetTranslations(contentScriptQuery: str = "", language: str = "", **kwargs: Any) -> str:
    try:
        if not language and "language" in kwargs:
            language = kwargs["language"]
        bundle = get_translation_map(language)
        bundle["success"] = True
        return json.dumps(bundle)
    except Exception as exc:
        logger.warn(f"NoComment: GetTranslations failed: {exc}")
        return json.dumps({"success": False, "error": str(exc)})


class Plugin:
    def _front_end_loaded(self):
        _copy_webkit_files()

    def _load(self):
        logger.log(f"bootstrapping NoComment plugin, millennium {Millennium.version()}")

        try:
            migration = migrate_legacy_backend_layout()
            moved_files = migration.get("moved_files", 0)
            removed_legacy_files = migration.get("removed_legacy_files", 0)
            merged_dirs = migration.get("merged_dirs", 0)
            if moved_files or removed_legacy_files or merged_dirs:
                logger.log(
                    "NoComment: Backend layout cleanup applied "
                    f"(moved_files={moved_files}, removed_legacy_files={removed_legacy_files}, merged_dirs={merged_dirs})"
                )
        except Exception as exc:
            logger.warn(f"NoComment: Backend layout cleanup failed: {exc}")

        try:
            detect_steam_install_path()
        except Exception as exc:
            logger.warn(f"NoComment: steam path detection failed: {exc}")

        ensure_http_client("InitApis")
        ensure_temp_download_dir()

        try:
            init_settings()
        except Exception as exc:
            logger.warn(f"NoComment: settings initialization failed: {exc}")

        try:
            message = apply_pending_update_if_any()
            if message:
                logger.log(f"AutoUpdate: {message}")
        except Exception as exc:
            logger.warn(f"AutoUpdate: apply_pending_update_if_any failed: {exc}")

        _copy_webkit_files()
        _inject_webkit_files()

        def init_applist_async() -> None:
            try:
                init_applist()
            except Exception as exc:
                logger.warn(f"NoComment: Applist initialization failed: {exc}")

        try:
            threading.Thread(
                target=init_applist_async,
                name="NoComment-ApplistInit",
                daemon=True,
            ).start()
        except Exception as exc:
            logger.warn(f"NoComment: Failed to start applist initialization thread: {exc}")

        def warm_installed_lua_cache_async() -> None:
            try:
                get_installed_lua_scripts()
            except Exception as exc:
                logger.warn(f"NoComment: Installed Lua cache warm-up failed: {exc}")

        try:
            threading.Thread(
                target=warm_installed_lua_cache_async,
                name="NoComment-InstalledLuaWarm",
                daemon=True,
            ).start()
        except Exception as exc:
            logger.warn(f"NoComment: Failed to start installed Lua cache warm-up thread: {exc}")

        try:
            start_auto_update_background_check()
        except Exception as exc:
            logger.warn(f"AutoUpdate: start_auto_update_background_check failed: {exc}")

        try:
            result = InitApis("boot")
            logger.log(f"InitApis (boot) return: {result}")
        except Exception as exc:
            logger.error(f"InitApis (boot) failed: {exc}")

        Millennium.ready()

    def _unload(self):
        logger.log("unloading")
        close_http_client("InitApis")


plugin = Plugin()
