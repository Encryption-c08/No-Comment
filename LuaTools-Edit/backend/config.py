"""Central configuration constants for the LuaTools backend."""

import os

WEBKIT_DIR_NAME = "LuaTools"
WEB_UI_JS_FILE = "luatools.js"
WEB_UI_ICON_FILE = "luatools-icon.png"

DEFAULT_HEADERS = {
    "Accept": "application/json",
    "X-Requested-With": "SteamDB",
    "User-Agent": "https://github.com/BossSloth/Steam-SteamDB-extension",
    "Origin": "https://github.com/BossSloth/Steam-SteamDB-extension",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
}

API_MANIFEST_URL = "https://raw.githubusercontent.com/madoiscool/lt_api_links/refs/heads/main/load_free_manifest_apis"
API_MANIFEST_PROXY_URL = "https://luatools.vercel.app/load_free_manifest_apis"
RUNTIME_DATA_DIR = "data"

API_JSON_FILE = os.path.join(RUNTIME_DATA_DIR, "api.json")

UPDATE_CONFIG_FILE = os.path.join(RUNTIME_DATA_DIR, "update.json")
UPDATE_PENDING_ZIP = os.path.join(RUNTIME_DATA_DIR, "update_pending.zip")
UPDATE_PENDING_INFO = os.path.join(RUNTIME_DATA_DIR, "update_pending.json")

HTTP_TIMEOUT_SECONDS = 15
HTTP_PROXY_TIMEOUT_SECONDS = 15

UPDATE_CHECK_INTERVAL_SECONDS = 2 * 60 * 60           

USER_AGENT = "luatools-v61-stplugin-hoe"

LOADED_APPS_FILE = os.path.join(RUNTIME_DATA_DIR, "loadedappids.txt")
APPID_LOG_FILE = os.path.join(RUNTIME_DATA_DIR, "appidlogs.txt")

DAILY_ADD_LIMIT = 25
DAILY_ADD_USAGE_FILE = os.path.join(RUNTIME_DATA_DIR, "daily_add_limit.json")
TEMP_DOWNLOAD_DIR = os.path.join(RUNTIME_DATA_DIR, "temp_dl")
