"""Handling of NoComment add/download flows and related utilities."""

from __future__ import annotations

import base64
import datetime
import html as html_lib
import io
import json
import os
import re
import shutil
import threading
import time
import zipfile
from typing import Any, Dict, List, Optional, Tuple

import httpx
import Millennium                
import requests

from api_manifest import load_api_manifest
from config import (
    APP_META_CACHE_FILE,
    APP_META_CACHE_ZIP_DIR,
    APPID_LOG_FILE,
    DAILY_ADD_LIMIT,
    DAILY_ADD_USAGE_FILE,
    LOADED_APPS_FILE,
    USER_AGENT,
    WEBKIT_DIR_NAME,
    WEB_UI_ICON_FILE,
    WEB_UI_JS_FILE,
)
from http_client import ensure_http_client
from logger import logger
from paths import backend_path, public_path
from steam_utils import detect_steam_install_path, has_lua_for_app
from utils import (
    count_apis,
    ensure_temp_download_dir,
    normalize_manifest_text,
    read_json,
    read_text,
    write_json,
    write_text,
)

DOWNLOAD_STATE: Dict[int, Dict[str, any]] = {}
DOWNLOAD_LOCK = threading.Lock()

                                      
DAILY_ADD_LOCK = threading.Lock()
DAILY_ADD_WINDOW_SECONDS = 24 * 60 * 60

                                                 
APP_NAME_CACHE: Dict[int, str] = {}
APP_NAME_CACHE_LOCK = threading.Lock()
APP_TYPE_CACHE: Dict[int, str] = {}
APP_FULLGAME_CACHE: Dict[int, int] = {}
APP_META_CACHE_LOCK = threading.Lock()
APP_META_STEAMDB_CHECK_TTL_SECONDS = 12 * 60 * 60
APP_META_STEAMDB_FAILED_CHECK_TTL_SECONDS = 30 * 60

                                   
LAST_API_CALL_TIME = 0
API_CALL_MIN_INTERVAL = 0.3                                           

                                           
DAILY_ADD_USAGE_PATH: str = ""

                                                
APPLIST_DATA: Dict[int, str] = {}
APPLIST_LOADED = False
APPLIST_LOCK = threading.Lock()
APPLIST_FILE_NAME = "all-appids.json"
APPLIST_URL = "https://applist.morrenus.xyz/"
APPLIST_FALLBACK_URLS = [
    "https://raw.githubusercontent.com/jsnli/steamappidlist/master/data/games_appid.json",
    "https://raw.githubusercontent.com/jsnli/steamappidlist/master/data/dlc_appid.json",
]
APPLIST_DOWNLOAD_TIMEOUT = 45
APPLIST_DOWNLOAD_RETRIES = 1
APPLIST_RETRY_DELAY_SECONDS = 0.5

LOADED_APPS_NAME_CACHE_LOCK = threading.Lock()
LOADED_APPS_NAME_CACHE: Dict[str, Any] = {
    "path": "",
    "mtime_ns": 0,
    "size": -1,
    "names": {},
}

LUA_FILE_SCAN_CACHE_LOCK = threading.Lock()
LUA_FILE_SCAN_CACHE: Dict[str, Dict[str, Any]] = {}
LUA_FILE_SCAN_CACHE_MAX_ENTRIES = 4096

ADDAPPID_CALL_RE = re.compile(r"^\s*addappid\(\s*(\d+)([^)]*)\)", re.IGNORECASE)
COMMENT_LINE_RE = re.compile(r"^\s*--")
HTML_TAG_RE = re.compile(r"<[^>]+>")
STEAMDB_ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.IGNORECASE | re.DOTALL)
STEAMDB_APPID_RE = re.compile(r'href="/app/(\d+)/[^"]*"', re.IGNORECASE)
STEAMDB_TITLE_RE = re.compile(r"<title>(.*?)</title>", re.IGNORECASE | re.DOTALL)
STEAMDB_OG_TITLE_RE = re.compile(
    r'<meta[^>]+property=["\']og:title["\'][^>]+content=["\'](.*?)["\']',
    re.IGNORECASE | re.DOTALL,
)


def _parse_addappid_line(raw_line: str) -> Optional[Tuple[int, bool]]:
    """Parse addappid line and return (appid, has_extra_args)."""
    match = ADDAPPID_CALL_RE.match(raw_line or "")
    if not match:
        return None
    try:
        appid = int(match.group(1))
    except Exception:
        return None
    arg_tail = str(match.group(2) or "")
    has_extra_args = "," in arg_tail
    return appid, has_extra_args


def _clean_html_text(raw: str) -> str:
    try:
        text = HTML_TAG_RE.sub(" ", str(raw or ""))
        text = html_lib.unescape(text)
        text = re.sub(r"\s+", " ", text).strip()
        return text
    except Exception:
        return ""


def _parse_steamdb_related_entries(base_appid: int, html_text: str) -> List[Dict[str, Any]]:
    by_id: Dict[str, Dict[str, Any]] = {}
    for row in STEAMDB_ROW_RE.findall(html_text or ""):
        appid_match = STEAMDB_APPID_RE.search(row)
        if not appid_match:
            continue
        try:
            related_appid = int(appid_match.group(1))
        except Exception:
            continue
        if related_appid <= 0 or related_appid == int(base_appid):
            continue

        anchor_matches = re.findall(
            rf'<a[^>]+href="/app/{related_appid}/[^"]*"[^>]*>(.*?)</a>',
            row,
            flags=re.IGNORECASE | re.DOTALL,
        )
        name = ""
        for raw in anchor_matches:
            cleaned = _clean_html_text(raw)
            if cleaned and not cleaned.isdigit():
                name = cleaned
                break
        if not name and anchor_matches:
            name = _clean_html_text(anchor_matches[-1])
        if not name:
            name = f"App {related_appid}"

        key = str(related_appid)
        existing = by_id.get(key)
        if existing:
            existing_name = str(existing.get("name") or "")
            if (not existing_name or existing_name.startswith("App ")) and not name.startswith("App "):
                existing["name"] = name
            continue

        by_id[key] = {"appid": related_appid, "name": name}

    values = list(by_id.values())
    values.sort(key=lambda item: int(item.get("appid", 0)))
    return values


def _extract_added_appids_from_lua_file(path: str) -> List[int]:
    appids: List[int] = []
    seen: set[int] = set()
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as handle:
            for raw_line in handle:
                if COMMENT_LINE_RE.match(raw_line):
                    continue
                parsed_addappid = _parse_addappid_line(raw_line)
                if not parsed_addappid:
                    continue
                parsed, has_extra_args = parsed_addappid
                # Only treat single-argument addappid entries as app/content IDs.
                # Multi-argument addappid calls are usually depot directives.
                if has_extra_args:
                    continue
                if parsed <= 0 or parsed in seen:
                    continue
                seen.add(parsed)
                appids.append(parsed)
    except Exception as exc:
        logger.warn(f"NoComment: Failed to parse addappid entries from {path}: {exc}")
    return appids


def _extract_related_appids_from_lua_text(base_appid: int, lua_text: str) -> List[int]:
    related: List[int] = []
    seen: set[int] = set()
    for raw_line in (lua_text or "").splitlines():
        if COMMENT_LINE_RE.match(raw_line):
            continue
        parsed_addappid = _parse_addappid_line(raw_line)
        if not parsed_addappid:
            continue
        target_appid, has_extra_args = parsed_addappid
        if has_extra_args:
            # Depot/hash directives are not app/content entries.
            continue
        if target_appid <= 0 or target_appid == int(base_appid) or target_appid in seen:
            continue
        seen.add(target_appid)
        related.append(target_appid)
    return related


def _extract_related_appids_from_content_bytes(base_appid: int, content_bytes: bytes) -> List[int]:
    """Extract related app IDs from API payload bytes (zip or plain lua text)."""
    related: List[int] = []
    seen: set[int] = set()

    # Prefer parsing zipped payloads first (current API standard).
    try:
        with zipfile.ZipFile(io.BytesIO(content_bytes), "r") as archive:
            names = archive.namelist()
            candidates: List[str] = []
            for name in names:
                pure = os.path.basename(name)
                if re.fullmatch(r"\d+\.lua", pure):
                    candidates.append(name)

            if candidates:
                preferred = f"{int(base_appid)}.lua"
                ordered: List[str] = []
                for name in candidates:
                    if os.path.basename(name) == preferred:
                        ordered.append(name)
                        break
                for name in candidates:
                    if name not in ordered:
                        ordered.append(name)

                for name in ordered:
                    data = archive.read(name)
                    try:
                        lua_text = data.decode("utf-8")
                    except Exception:
                        lua_text = data.decode("utf-8", errors="replace")

                    for rel_id in _extract_related_appids_from_lua_text(base_appid, lua_text):
                        if rel_id in seen:
                            continue
                        seen.add(rel_id)
                        related.append(rel_id)
                return related
    except Exception:
        # Not a valid zip payload; attempt plain text parsing next.
        pass

    try:
        lua_text = content_bytes.decode("utf-8")
    except Exception:
        lua_text = content_bytes.decode("utf-8", errors="replace")

    for rel_id in _extract_related_appids_from_lua_text(base_appid, lua_text):
        if rel_id in seen:
            continue
        seen.add(rel_id)
        related.append(rel_id)

    return related


def _meta_cache_file_path() -> str:
    return backend_path(APP_META_CACHE_FILE)


def _meta_cache_zip_rel_path(source_appid: int) -> str:
    return os.path.join(APP_META_CACHE_ZIP_DIR, f"{int(source_appid)}.zip")


def _meta_cache_zip_abs_path(source_appid: int) -> str:
    rel_path = _meta_cache_zip_rel_path(source_appid)
    abs_path = backend_path(rel_path)
    try:
        os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    except Exception:
        pass
    return abs_path


def _normalize_positive_int_list(values: Any) -> List[int]:
    output: List[int] = []
    seen: set[int] = set()
    raw = values if isinstance(values, list) else []
    for value in raw:
        try:
            parsed = int(value)
        except Exception:
            continue
        if parsed <= 0 or parsed in seen:
            continue
        seen.add(parsed)
        output.append(parsed)
    return output


def _rebuild_app_meta_index(sources: Dict[str, Any]) -> Dict[str, List[int]]:
    index: Dict[str, List[int]] = {}
    if not isinstance(sources, dict):
        return index

    for source_key, entry in sources.items():
        try:
            source_appid = int(source_key)
        except Exception:
            continue
        if source_appid <= 0 or not isinstance(entry, dict):
            continue
        included = _normalize_positive_int_list(entry.get("includedAppIds"))
        if source_appid not in included:
            included.append(source_appid)
        for target_appid in included:
            key = str(int(target_appid))
            arr = index.get(key) or []
            if source_appid not in arr:
                arr.append(source_appid)
            index[key] = arr

    return index


def _load_app_meta_cache_locked() -> Dict[str, Any]:
    cache = read_json(_meta_cache_file_path())
    if not isinstance(cache, dict):
        cache = {}

    sources = cache.get("sources")
    if not isinstance(sources, dict):
        sources = {}

    by_appid = cache.get("byAppid")
    if not isinstance(by_appid, dict):
        by_appid = _rebuild_app_meta_index(sources)
    elif not by_appid and sources:
        by_appid = _rebuild_app_meta_index(sources)

    return {"sources": sources, "byAppid": by_appid}


def _save_app_meta_cache_locked(cache: Dict[str, Any]) -> None:
    payload = {
        "sources": cache.get("sources", {}) if isinstance(cache, dict) else {},
        "byAppid": cache.get("byAppid", {}) if isinstance(cache, dict) else {},
    }
    write_json(_meta_cache_file_path(), payload)


def _extract_zip_source_metadata(zip_path: str, source_appid: int) -> Optional[Dict[str, Any]]:
    try:
        with zipfile.ZipFile(zip_path, "r") as archive:
            names = archive.namelist()
            manifest_files = sorted(
                {
                    os.path.basename(name)
                    for name in names
                    if str(name).lower().endswith(".manifest") and os.path.basename(name)
                }
            )

            lua_candidates: List[str] = []
            for name in names:
                pure = os.path.basename(name)
                if re.fullmatch(r"\d+\.lua", pure):
                    lua_candidates.append(name)

            primary_lua = ""
            preferred = f"{int(source_appid)}.lua"
            for name in lua_candidates:
                if os.path.basename(name) == preferred:
                    primary_lua = os.path.basename(name)
                    break
            if not primary_lua and lua_candidates:
                primary_lua = os.path.basename(lua_candidates[0])

            included_ids: List[int] = []
            seen_ids: set[int] = set()
            for name in lua_candidates:
                data = archive.read(name)
                try:
                    lua_text = data.decode("utf-8")
                except Exception:
                    lua_text = data.decode("utf-8", errors="replace")
                ids = _extract_related_appids_from_lua_text(-1, lua_text)
                for rel_id in ids:
                    if rel_id in seen_ids:
                        continue
                    seen_ids.add(rel_id)
                    included_ids.append(int(rel_id))

            if int(source_appid) > 0 and int(source_appid) not in seen_ids:
                included_ids.append(int(source_appid))

            return {
                "sourceAppid": int(source_appid),
                "primaryLuaFile": primary_lua,
                "includedAppIds": _normalize_positive_int_list(included_ids),
                "manifestFiles": manifest_files,
            }
    except Exception as exc:
        logger.warn(f"NoComment: Failed to parse zip metadata for source appid={source_appid}: {exc}")
        return None


def _cache_download_metadata(source_appid: int, downloaded_zip_path: str, api_name: str, source_url: str) -> None:
    try:
        source_appid = int(source_appid)
    except Exception:
        return
    if source_appid <= 0:
        return
    if not os.path.exists(downloaded_zip_path):
        return

    parsed = _extract_zip_source_metadata(downloaded_zip_path, source_appid)
    if not parsed:
        return

    target_zip_path = _meta_cache_zip_abs_path(source_appid)
    try:
        shutil.copy2(downloaded_zip_path, target_zip_path)
    except Exception as exc:
        logger.warn(
            f"NoComment: Failed to copy downloaded zip into metadata cache for appid={source_appid}: {exc}"
        )
        return

    record = {
        "sourceAppid": int(source_appid),
        "updatedAt": int(time.time()),
        "sourceApi": str(api_name or ""),
        "sourceUrl": str(source_url or ""),
        "zipPath": _meta_cache_zip_rel_path(source_appid),
        "primaryLuaFile": parsed.get("primaryLuaFile", ""),
        "includedAppIds": _normalize_positive_int_list(parsed.get("includedAppIds")),
        "manifestFiles": parsed.get("manifestFiles", []),
    }

    with APP_META_CACHE_LOCK:
        cache = _load_app_meta_cache_locked()
        sources = cache.get("sources", {})
        if not isinstance(sources, dict):
            sources = {}
        sources[str(int(source_appid))] = record
        cache["sources"] = sources
        cache["byAppid"] = _rebuild_app_meta_index(sources)
        _save_app_meta_cache_locked(cache)

    logger.log(
        "NoComment: Cached metadata for source appid="
        f"{source_appid} included={len(record.get('includedAppIds', []))} manifests={len(record.get('manifestFiles', []))}"
    )


def _update_cached_source_steamdb_check_result(
    source_appid: int,
    related_ids: Optional[List[int]],
    check_ok: bool,
    checked_at: Optional[int] = None,
) -> None:
    try:
        source_appid = int(source_appid)
    except Exception:
        return
    if source_appid <= 0:
        return

    when = int(checked_at) if isinstance(checked_at, int) and checked_at > 0 else int(time.time())

    with APP_META_CACHE_LOCK:
        cache = _load_app_meta_cache_locked()
        sources = cache.get("sources", {})
        if not isinstance(sources, dict):
            return
        key = str(source_appid)
        current = sources.get(key)
        if not isinstance(current, dict):
            return

        updated = dict(current)
        updated["steamdbLastCheckedAt"] = when
        updated["steamdbLastCheckOk"] = bool(check_ok)
        if related_ids is not None:
            updated["steamdbRelatedIds"] = _normalize_positive_int_list(related_ids)
        sources[key] = updated
        cache["sources"] = sources
        _save_app_meta_cache_locked(cache)


def _fetch_steamdb_related_appids_for_cache(source_appid: int) -> Optional[List[int]]:
    try:
        source_appid = int(source_appid)
    except Exception:
        return None
    if source_appid <= 0:
        return None

    try:
        client = ensure_http_client("NoComment: SteamDB cache freshness")
        url = f"https://steamdb.info/app/{source_appid}/dlc/?cc=us&lang=english"
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": f"https://steamdb.info/app/{source_appid}/",
        }
        resp = client.get(url, headers=headers, follow_redirects=True, timeout=20)
        if int(resp.status_code) != 200:
            return None
        entries = _parse_steamdb_related_entries(source_appid, resp.text or "")
        ids = _normalize_positive_int_list([item.get("appid") for item in entries])
        return ids
    except Exception as exc:
        logger.warn(
            f"NoComment: SteamDB cache freshness check failed for source appid={source_appid}: {exc}"
        )
        return None


def _get_cached_source_missing_steamdb_appids(source_entry: Dict[str, Any]) -> List[int]:
    if not isinstance(source_entry, dict):
        return []

    try:
        source_appid = int(source_entry.get("sourceAppid") or 0)
    except Exception:
        source_appid = 0
    if source_appid <= 0:
        return []

    included_ids = set(_normalize_positive_int_list(source_entry.get("includedAppIds")))
    included_ids.add(int(source_appid))

    now = int(time.time())
    cached_steamdb_ids = _normalize_positive_int_list(source_entry.get("steamdbRelatedIds"))
    try:
        last_checked_at = int(source_entry.get("steamdbLastCheckedAt") or 0)
    except Exception:
        last_checked_at = 0
    last_check_ok = bool(source_entry.get("steamdbLastCheckOk", False))

    should_fetch = True
    if last_checked_at > 0:
        ttl = (
            APP_META_STEAMDB_CHECK_TTL_SECONDS
            if last_check_ok
            else APP_META_STEAMDB_FAILED_CHECK_TTL_SECONDS
        )
        if (now - last_checked_at) < ttl:
            should_fetch = False

    if should_fetch:
        fetched_ids = _fetch_steamdb_related_appids_for_cache(source_appid)
        if fetched_ids is not None:
            cached_steamdb_ids = fetched_ids
            _update_cached_source_steamdb_check_result(
                source_appid=source_appid,
                related_ids=fetched_ids,
                check_ok=True,
                checked_at=now,
            )
        else:
            _update_cached_source_steamdb_check_result(
                source_appid=source_appid,
                related_ids=None,
                check_ok=False,
                checked_at=now,
            )

    if not cached_steamdb_ids:
        return []

    missing = [rel_id for rel_id in cached_steamdb_ids if rel_id not in included_ids]
    return _normalize_positive_int_list(missing)


def _find_stale_cached_source_for_app(
    target_appid: int, preferred_source_appid: Optional[int] = None
) -> Optional[Dict[str, Any]]:
    candidates = _get_cached_source_entries_for_app(
        target_appid, preferred_source_appid=preferred_source_appid
    )
    if not candidates:
        return None

    checked_by_source: Dict[int, List[int]] = {}
    for candidate in candidates:
        try:
            source_appid = int(candidate.get("sourceAppid") or 0)
        except Exception:
            source_appid = 0
        if source_appid <= 0:
            continue

        missing_ids = checked_by_source.get(source_appid)
        if missing_ids is None:
            missing_ids = _get_cached_source_missing_steamdb_appids(candidate)
            checked_by_source[source_appid] = missing_ids

        if missing_ids:
            return {
                "sourceAppid": int(source_appid),
                "missingAppIds": _normalize_positive_int_list(missing_ids),
            }

    return None


def _get_cached_source_entries_for_app(target_appid: int, preferred_source_appid: Optional[int] = None) -> List[Dict[str, Any]]:
    try:
        target_appid = int(target_appid)
    except Exception:
        return []
    if target_appid <= 0:
        return []

    preferred = None
    try:
        if preferred_source_appid is not None:
            parsed_pref = int(preferred_source_appid)
            if parsed_pref > 0:
                preferred = parsed_pref
    except Exception:
        preferred = None

    with APP_META_CACHE_LOCK:
        cache = _load_app_meta_cache_locked()
        sources = cache.get("sources", {})
        by_appid = cache.get("byAppid", {})

    if not isinstance(sources, dict):
        return []
    if not isinstance(by_appid, dict):
        by_appid = {}

    source_candidates: List[int] = []
    raw = by_appid.get(str(target_appid), [])
    if isinstance(raw, list):
        for value in raw:
            try:
                parsed = int(value)
            except Exception:
                continue
            if parsed > 0 and parsed not in source_candidates:
                source_candidates.append(parsed)

    if str(target_appid) in sources and target_appid not in source_candidates:
        source_candidates.append(target_appid)
    if preferred and str(preferred) in sources and preferred not in source_candidates:
        preferred_record = sources.get(str(preferred))
        preferred_included = (
            _normalize_positive_int_list(preferred_record.get("includedAppIds"))
            if isinstance(preferred_record, dict)
            else []
        )
        if int(target_appid) == int(preferred) or int(target_appid) in preferred_included:
            source_candidates.insert(0, preferred)

    entries: List[Dict[str, Any]] = []
    for source_appid in source_candidates:
        record = sources.get(str(source_appid))
        if not isinstance(record, dict):
            continue
        zip_rel = str(record.get("zipPath") or "").strip()
        candidate_zip = backend_path(zip_rel) if zip_rel else ""
        if not candidate_zip or not os.path.exists(candidate_zip):
            fallback_zip = _meta_cache_zip_abs_path(source_appid)
            if os.path.exists(fallback_zip):
                candidate_zip = fallback_zip
            else:
                continue
        entry = dict(record)
        entry["sourceAppid"] = int(source_appid)
        entry["zipAbsPath"] = candidate_zip
        entries.append(entry)

    entries.sort(
        key=lambda item: (
            0 if preferred and int(item.get("sourceAppid", 0)) == preferred else 1,
            -int(item.get("updatedAt", 0)),
        )
    )
    return entries


def _has_cached_source_metadata(source_appid: int) -> bool:
    try:
        source_appid = int(source_appid)
    except Exception:
        return False
    if source_appid <= 0:
        return False
    entries = _get_cached_source_entries_for_app(source_appid, preferred_source_appid=source_appid)
    return len(entries) > 0


def _install_from_cached_metadata(appid: int, preferred_source_appid: Optional[int] = None) -> bool:
    candidates = _get_cached_source_entries_for_app(appid, preferred_source_appid=preferred_source_appid)
    if not candidates:
        return False

    for candidate in candidates:
        source_appid = int(candidate.get("sourceAppid") or 0)
        zip_path = str(candidate.get("zipAbsPath") or "").strip()
        if source_appid <= 0 or not zip_path or not os.path.exists(zip_path):
            continue
        if _is_download_cancelled(appid):
            return False
        try:
            logger.log(
                "NoComment: Installing appid="
                f"{appid} from cached metadata source={source_appid}"
            )
            force_keep = [int(appid)] if int(source_appid) != int(appid) else None
            _set_download_state(
                appid,
                {"status": "processing", "currentApi": "local-cache", "sourceAppid": int(source_appid)},
            )
            _process_and_install_lua(
                int(appid),
                zip_path,
                preferred_lua_appid=int(source_appid),
                force_keep_appids=force_keep,
                delete_zip_after=False,
            )
            fetched_name = _fetch_app_name(appid) or f"UNKNOWN ({appid})"
            try:
                _append_loaded_app(appid, fetched_name)
                _log_appid_event("ADDED - local-cache", appid, fetched_name)
            except Exception:
                pass
            _set_download_state(
                appid,
                {
                    "status": "done",
                    "success": True,
                    "api": "local-cache",
                    "sourceAppid": int(source_appid),
                },
            )
            return True
        except Exception as exc:
            logger.warn(
                "NoComment: Failed cached metadata install for appid="
                f"{appid} source={source_appid}: {exc}"
            )
            continue

    return False


def _install_all_content_on_add() -> bool:
    """Return whether add-via-NoComment should keep all related addappid entries."""
    try:
        from settings.manager import _get_values_locked

        values = _get_values_locked()
        group = values.get("addViaNoComment", {}) if isinstance(values, dict) else {}
        if not isinstance(group, dict):
            return True
        raw_value = group.get("installAllContent", True)
        if isinstance(raw_value, bool):
            return raw_value
        if isinstance(raw_value, str):
            lowered = raw_value.strip().lower()
            if lowered in {"true", "1", "yes", "y"}:
                return True
            if lowered in {"false", "0", "no", "n"}:
                return False
    except Exception as exc:
        logger.warn(f"NoComment: Failed to read addViaNoComment.installAllContent setting: {exc}")
    return True


def _set_download_state(appid: int, update: dict) -> None:
    with DOWNLOAD_LOCK:
        state = DOWNLOAD_STATE.get(appid) or {}
        state.update(update)
        DOWNLOAD_STATE[appid] = state


def _get_download_state(appid: int) -> dict:
    with DOWNLOAD_LOCK:
        return DOWNLOAD_STATE.get(appid, {}).copy()


def _loaded_apps_path() -> str:
    return backend_path(LOADED_APPS_FILE)


def _read_loaded_apps_name_map() -> Dict[int, str]:
    """Read loaded apps once and cache by file signature."""
    path = _loaded_apps_path()
    try:
        stat = os.stat(path)
        mtime_ns = int(getattr(stat, "st_mtime_ns", int(stat.st_mtime * 1_000_000_000)))
        size = int(stat.st_size)
    except Exception:
        return {}

    with LOADED_APPS_NAME_CACHE_LOCK:
        same_file = (
            LOADED_APPS_NAME_CACHE.get("path") == path
            and int(LOADED_APPS_NAME_CACHE.get("mtime_ns", 0)) == mtime_ns
            and int(LOADED_APPS_NAME_CACHE.get("size", -1)) == size
        )
        if same_file:
            cached_names = LOADED_APPS_NAME_CACHE.get("names")
            if isinstance(cached_names, dict):
                return dict(cached_names)

    names: Dict[int, str] = {}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            for line in handle.read().splitlines():
                if ":" not in line:
                    continue
                parts = line.split(":", 1)
                try:
                    appid = int(parts[0].strip())
                except Exception:
                    continue
                name = str(parts[1] or "").strip()
                if appid > 0 and name:
                    names[appid] = name
    except Exception:
        return {}

    with LOADED_APPS_NAME_CACHE_LOCK:
        LOADED_APPS_NAME_CACHE["path"] = path
        LOADED_APPS_NAME_CACHE["mtime_ns"] = mtime_ns
        LOADED_APPS_NAME_CACHE["size"] = size
        LOADED_APPS_NAME_CACHE["names"] = dict(names)

    return names


def _get_cached_lua_file_metadata(file_path: str) -> Tuple[int, str, List[int]]:
    """Return file size/date/addappid metadata with per-file cache."""
    file_stat = os.stat(file_path)
    file_size = int(file_stat.st_size)
    mtime_ns = int(getattr(file_stat, "st_mtime_ns", int(file_stat.st_mtime * 1_000_000_000)))

    with LUA_FILE_SCAN_CACHE_LOCK:
        cached = LUA_FILE_SCAN_CACHE.get(file_path)
        if (
            isinstance(cached, dict)
            and int(cached.get("mtime_ns", 0)) == mtime_ns
            and int(cached.get("fileSize", -1)) == file_size
        ):
            cached_added = cached.get("addedAppIds")
            return (
                file_size,
                str(cached.get("modifiedDate") or ""),
                list(cached_added) if isinstance(cached_added, list) else [],
            )

    added_appids = _extract_added_appids_from_lua_file(file_path)
    formatted_date = datetime.datetime.fromtimestamp(file_stat.st_mtime).strftime("%Y-%m-%d %H:%M:%S")

    with LUA_FILE_SCAN_CACHE_LOCK:
        LUA_FILE_SCAN_CACHE[file_path] = {
            "mtime_ns": mtime_ns,
            "fileSize": file_size,
            "modifiedDate": formatted_date,
            "addedAppIds": list(added_appids),
        }
        if len(LUA_FILE_SCAN_CACHE) > LUA_FILE_SCAN_CACHE_MAX_ENTRIES:
            LUA_FILE_SCAN_CACHE.clear()

    return file_size, formatted_date, added_appids


def _appid_log_path() -> str:
    return backend_path(APPID_LOG_FILE)


def _daily_add_usage_path() -> str:
    global DAILY_ADD_USAGE_PATH
    if DAILY_ADD_USAGE_PATH:
        return DAILY_ADD_USAGE_PATH

    legacy_path = backend_path(DAILY_ADD_USAGE_FILE)
    steam_path = detect_steam_install_path()

    candidates = []
    if steam_path:
        candidates.append(os.path.join(steam_path, "config", "NoComment", "daily_add_limit.json"))

    local_appdata = os.environ.get("LOCALAPPDATA", "").strip()
    if local_appdata:
        candidates.append(os.path.join(local_appdata, "NoComment", "daily_add_limit.json"))

    candidates.append(legacy_path)

    preferred_path = legacy_path
    for candidate in candidates:
        try:
            os.makedirs(os.path.dirname(candidate), exist_ok=True)
            preferred_path = candidate
            break
        except Exception:
            continue

    try:
        if os.path.exists(legacy_path) and not os.path.exists(preferred_path):
            shutil.copy2(legacy_path, preferred_path)
            logger.log(f"NoComment: Migrated daily add usage file to {preferred_path}")
    except Exception as exc:
        logger.warn(f"NoComment: Failed to migrate daily usage file: {exc}")

    DAILY_ADD_USAGE_PATH = preferred_path
    return DAILY_ADD_USAGE_PATH


def _load_daily_add_usage() -> Dict[str, any]:
    now = int(time.time())
    window_start = now - DAILY_ADD_WINDOW_SECONDS
    data = read_json(_daily_add_usage_path())
    events: list[Dict[str, any]] = []
    if isinstance(data, dict):
        raw_events = data.get("events")
        if isinstance(raw_events, list):
            for value in raw_events:
                ts: int = 0
                appid_value: Optional[int] = None
                name_value: str = ""
                app_type_value: str = "game"

                if isinstance(value, dict):
                    try:
                        ts = int(value.get("ts") or value.get("timestamp") or 0)
                    except Exception:
                        ts = 0
                    try:
                        raw_appid = value.get("appid")
                        if raw_appid is not None and str(raw_appid).strip():
                            appid_value = int(raw_appid)
                    except Exception:
                        appid_value = None
                    name_value = str(value.get("name") or "").strip()
                    app_type_value = str(value.get("appType") or "game").strip().lower() or "game"
                else:
                    try:
                        ts = int(value)
                    except Exception:
                        ts = 0

                if ts > window_start:
                    event_record: Dict[str, any] = {"ts": ts, "appType": app_type_value}
                    if appid_value and appid_value > 0:
                        event_record["appid"] = appid_value
                    if name_value:
                        event_record["name"] = name_value
                    events.append(event_record)
        else:
            date_value = data.get("date")
            count_value = data.get("count")
            if isinstance(date_value, str) and isinstance(count_value, int) and count_value > 0:
                try:
                    if date_value == datetime.date.today().isoformat():
                        events = [{"ts": now, "appType": "game"} for _ in range(count_value)]
                except Exception:
                    events = []
    events = sorted(events, key=lambda event: int(event.get("ts", 0)))
    return {"events": events}


def _save_daily_add_usage(data: Dict[str, any]) -> None:
    try:
        write_json(_daily_add_usage_path(), data)
    except Exception as exc:
        logger.warn(f"NoComment: Failed to persist daily add usage: {exc}")


def _current_daily_add_usage() -> Dict[str, any]:
    with DAILY_ADD_LOCK:
        data = _load_daily_add_usage()
        events = list(data.get("events", []))
        _save_daily_add_usage({"events": events})
    now = int(time.time())
    limit = int(DAILY_ADD_LIMIT)
    count = len(events)
    remaining = max(0, limit - count)
    first_ts = int(events[0].get("ts", 0)) if events else 0
    reset_epoch = (first_ts + DAILY_ADD_WINDOW_SECONDS) if first_ts > 0 else (now + DAILY_ADD_WINDOW_SECONDS)
    reset_in_seconds = max(0, reset_epoch - now)
    reset_iso = datetime.datetime.fromtimestamp(reset_epoch).isoformat(timespec="seconds")
    return {
        "count": count,
        "limit": limit,
        "remaining": remaining,
        "window_seconds": DAILY_ADD_WINDOW_SECONDS,
        "reset_epoch": reset_epoch,
        "reset_in_seconds": reset_in_seconds,
        "reset": reset_iso,
    }


def _consume_daily_add_slot(appid: Optional[int] = None, name: str = "", app_type: str = "game") -> Dict[str, any]:
    """Attempt to consume one rolling 24h add slot. Returns metadata."""
    now = int(time.time())
    limit = int(DAILY_ADD_LIMIT)
    with DAILY_ADD_LOCK:
        data = _load_daily_add_usage()
        events = list(data.get("events", []))
        count = len(events)
        first_ts = int(events[0].get("ts", 0)) if events else 0
        reset_epoch = (first_ts + DAILY_ADD_WINDOW_SECONDS) if first_ts > 0 else (now + DAILY_ADD_WINDOW_SECONDS)
        reset_in_seconds = max(0, reset_epoch - now)
        reset_iso = datetime.datetime.fromtimestamp(reset_epoch).isoformat(timespec="seconds")
        if count >= limit:
            return {
                "allowed": False,
                "count": count,
                "limit": limit,
                "remaining": max(0, limit - count),
                "window_seconds": DAILY_ADD_WINDOW_SECONDS,
                "reset_epoch": reset_epoch,
                "reset_in_seconds": reset_in_seconds,
                "reset": reset_iso,
            }
        entry: Dict[str, any] = {"ts": now, "appType": str(app_type or "game").strip().lower() or "game"}
        try:
            if appid is not None and int(appid) > 0:
                entry["appid"] = int(appid)
        except Exception:
            pass
        cleaned_name = str(name or "").strip()
        if cleaned_name:
            entry["name"] = cleaned_name
        events.append(entry)
        payload = {"events": events}
        _save_daily_add_usage(payload)
        count = len(events)
        first_ts = int(events[0].get("ts", 0)) if events else now
        reset_epoch = first_ts + DAILY_ADD_WINDOW_SECONDS
        reset_in_seconds = max(0, reset_epoch - now)
        reset_iso = datetime.datetime.fromtimestamp(reset_epoch).isoformat(timespec="seconds")
        return {
            "allowed": True,
            "count": count,
            "limit": limit,
            "remaining": max(0, limit - count),
            "window_seconds": DAILY_ADD_WINDOW_SECONDS,
            "reset_epoch": reset_epoch,
            "reset_in_seconds": reset_in_seconds,
            "reset": reset_iso,
        }


def _fetch_app_identity(appid: int) -> Tuple[str, str]:
    """Fetch best-known app name and Steam app type (game/dlc/etc)."""
    global LAST_API_CALL_TIME

    with APP_NAME_CACHE_LOCK:
        cached_name = APP_NAME_CACHE.get(appid, "")
        cached_type = APP_TYPE_CACHE.get(appid, "")
        if cached_name and cached_type:
            return cached_name, cached_type

    applist_name = _get_app_name_from_applist(appid)
    if applist_name:
        with APP_NAME_CACHE_LOCK:
            if not APP_NAME_CACHE.get(appid):
                APP_NAME_CACHE[appid] = applist_name

    with APP_NAME_CACHE_LOCK:
        time_since_last_call = time.time() - LAST_API_CALL_TIME
        if time_since_last_call < API_CALL_MIN_INTERVAL:
            time.sleep(API_CALL_MIN_INTERVAL - time_since_last_call)
        LAST_API_CALL_TIME = time.time()

    client = ensure_http_client("NoComment: _fetch_app_identity")
    try:
        url = f"https://store.steampowered.com/api/appdetails?appids={appid}"
        resp = client.get(url, follow_redirects=True, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        entry = data.get(str(appid)) or data.get(int(appid)) or {}
        if isinstance(entry, dict):
            inner = entry.get("data") or {}
            resolved_name = ""
            raw_name = inner.get("name")
            if isinstance(raw_name, str) and raw_name.strip():
                resolved_name = raw_name.strip()
            app_type = str(inner.get("type") or "").strip().lower()
            with APP_NAME_CACHE_LOCK:
                if resolved_name:
                    APP_NAME_CACHE[appid] = resolved_name
                if app_type:
                    APP_TYPE_CACHE[appid] = app_type
                final_name = APP_NAME_CACHE.get(appid) or resolved_name or applist_name or ""
                final_type = APP_TYPE_CACHE.get(appid) or app_type or ""
            return final_name, final_type
    except Exception as exc:
        logger.warn(f"NoComment: _fetch_app_identity failed for {appid}: {exc}")

    with APP_NAME_CACHE_LOCK:
        fallback_name = APP_NAME_CACHE.get(appid) or applist_name or ""
        fallback_type = APP_TYPE_CACHE.get(appid) or ""
    return fallback_name, fallback_type


def _fetch_fullgame_appid(appid: int) -> Optional[int]:
    """Return fullgame appid for DLC app IDs, if available."""
    global LAST_API_CALL_TIME

    with APP_NAME_CACHE_LOCK:
        cached = APP_FULLGAME_CACHE.get(int(appid))
        if cached:
            return int(cached)

    with APP_NAME_CACHE_LOCK:
        time_since_last_call = time.time() - LAST_API_CALL_TIME
        if time_since_last_call < API_CALL_MIN_INTERVAL:
            time.sleep(API_CALL_MIN_INTERVAL - time_since_last_call)
        LAST_API_CALL_TIME = time.time()

    client = ensure_http_client("NoComment: _fetch_fullgame_appid")
    try:
        url = f"https://store.steampowered.com/api/appdetails?appids={appid}"
        resp = client.get(url, follow_redirects=True, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        entry = data.get(str(appid)) or data.get(int(appid)) or {}
        if isinstance(entry, dict):
            inner = entry.get("data") or {}
            fullgame = inner.get("fullgame") or {}
            try:
                fullgame_appid = int(fullgame.get("appid") or 0)
            except Exception:
                fullgame_appid = 0
            if fullgame_appid > 0:
                with APP_NAME_CACHE_LOCK:
                    APP_FULLGAME_CACHE[int(appid)] = int(fullgame_appid)
                return int(fullgame_appid)
    except Exception as exc:
        logger.warn(f"NoComment: _fetch_fullgame_appid failed for {appid}: {exc}")

    return None


def _fetch_app_name(appid: int) -> str:
    """Fetch app name with rate limiting and caching.
    
    Fallback order:
    1. In-memory cache
    2. Applist file (in-memory) - checked before web requests
    3. Steam API (web request as final resort)
    """
    global LAST_API_CALL_TIME

                       
    with APP_NAME_CACHE_LOCK:
        if appid in APP_NAME_CACHE:
            cached = APP_NAME_CACHE[appid]
            if cached:                            
                return cached

                                                   
    applist_name = _get_app_name_from_applist(appid)
    if applist_name:
                                       
        with APP_NAME_CACHE_LOCK:
            APP_NAME_CACHE[appid] = applist_name
        return applist_name

                                             
                                   
    with APP_NAME_CACHE_LOCK:
        time_since_last_call = time.time() - LAST_API_CALL_TIME
        if time_since_last_call < API_CALL_MIN_INTERVAL:
            time.sleep(API_CALL_MIN_INTERVAL - time_since_last_call)
        LAST_API_CALL_TIME = time.time()

    client = ensure_http_client("NoComment: _fetch_app_name")
    try:
        url = f"https://store.steampowered.com/api/appdetails?appids={appid}"
        resp = client.get(url, follow_redirects=True, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        entry = data.get(str(appid)) or data.get(int(appid)) or {}
        if isinstance(entry, dict):
            inner = entry.get("data") or {}
            name = inner.get("name")
            app_type = str(inner.get("type") or "").strip().lower()
            if isinstance(name, str) and name.strip():
                name = name.strip()
                                   
                with APP_NAME_CACHE_LOCK:
                    APP_NAME_CACHE[appid] = name
                    if app_type:
                        APP_TYPE_CACHE[appid] = app_type
                return name
    except Exception as exc:
        logger.warn(f"NoComment: _fetch_app_name failed for {appid}: {exc}")

                                                          
    with APP_NAME_CACHE_LOCK:
        APP_NAME_CACHE[appid] = ""
    return ""


def _fetch_app_names_batch(appids: List[int]) -> Dict[int, str]:
    """Best-effort batch app name lookup with cache/applist fallback."""
    global LAST_API_CALL_TIME

    result: Dict[int, str] = {}
    unique_ids: List[int] = []
    seen: set[int] = set()
    for value in appids or []:
        try:
            parsed = int(value)
        except Exception:
            continue
        if parsed <= 0 or parsed in seen:
            continue
        seen.add(parsed)
        unique_ids.append(parsed)

    if not unique_ids:
        return result

    missing: List[int] = []
    with APP_NAME_CACHE_LOCK:
        for target_appid in unique_ids:
            cached_name = str(APP_NAME_CACHE.get(target_appid) or "").strip()
            if cached_name:
                result[target_appid] = cached_name
                continue
            applist_name = str(_get_app_name_from_applist(target_appid) or "").strip()
            if applist_name:
                APP_NAME_CACHE[target_appid] = applist_name
                result[target_appid] = applist_name
            else:
                missing.append(target_appid)

    if not missing:
        return result

    client = ensure_http_client("NoComment: _fetch_app_names_batch")
    chunk_size = 40
    for i in range(0, len(missing), chunk_size):
        chunk = missing[i : i + chunk_size]
        if not chunk:
            continue
        try:
            with APP_NAME_CACHE_LOCK:
                time_since_last_call = time.time() - LAST_API_CALL_TIME
                if time_since_last_call < API_CALL_MIN_INTERVAL:
                    time.sleep(API_CALL_MIN_INTERVAL - time_since_last_call)
                LAST_API_CALL_TIME = time.time()

            joined = ",".join(str(x) for x in chunk)
            url = f"https://store.steampowered.com/api/appdetails?appids={joined}&l=english"
            resp = client.get(url, follow_redirects=True, timeout=15)
            resp.raise_for_status()
            data = resp.json() if resp is not None else {}

            for target_appid in chunk:
                entry = data.get(str(target_appid)) if isinstance(data, dict) else None
                if not isinstance(entry, dict) or not entry.get("success"):
                    continue
                inner = entry.get("data") or {}
                name = str(inner.get("name") or "").strip()
                if not name:
                    continue
                app_type = str(inner.get("type") or "").strip().lower()
                with APP_NAME_CACHE_LOCK:
                    APP_NAME_CACHE[target_appid] = name
                    if app_type:
                        APP_TYPE_CACHE[target_appid] = app_type
                result[target_appid] = name
        except Exception as exc:
            logger.warn(f"NoComment: _fetch_app_names_batch failed for chunk {chunk}: {exc}")

    return result


def _extract_steamdb_app_name_from_html(html_text: str) -> str:
    text = str(html_text or "")

    # Prefer og:title if present.
    og_match = STEAMDB_OG_TITLE_RE.search(text)
    if og_match:
        raw = _clean_html_text(og_match.group(1))
        if raw:
            cleaned = re.sub(r"\s*[·|-]\s*SteamDB\s*$", "", raw, flags=re.IGNORECASE).strip()
            if cleaned and cleaned.lower() != "steamdb":
                return cleaned

    title_match = STEAMDB_TITLE_RE.search(text)
    if title_match:
        raw_title = _clean_html_text(title_match.group(1))
        if raw_title:
            cleaned = re.sub(r"\s*[·|-]\s*SteamDB\s*$", "", raw_title, flags=re.IGNORECASE).strip()
            cleaned = re.sub(r"\s*\(App\s*\d+\)\s*$", "", cleaned, flags=re.IGNORECASE).strip()
            if cleaned and cleaned.lower() not in {"steamdb", "app"}:
                return cleaned

    h1_match = re.search(r"<h1[^>]*>(.*?)</h1>", text, re.IGNORECASE | re.DOTALL)
    if h1_match:
        raw_h1 = _clean_html_text(h1_match.group(1))
        if raw_h1:
            cleaned = re.sub(r"\s*\(App\s*\d+\)\s*$", "", raw_h1, flags=re.IGNORECASE).strip()
            if cleaned and cleaned.lower() not in {"steamdb", "app"}:
                return cleaned

    return ""


def _fetch_steamdb_app_names_batch(appids: List[int]) -> Dict[int, str]:
    """Best-effort SteamDB name lookup for unresolved hidden app IDs."""
    result: Dict[int, str] = {}
    unique_ids: List[int] = []
    seen: set[int] = set()
    for value in appids or []:
        try:
            parsed = int(value)
        except Exception:
            continue
        if parsed <= 0 or parsed in seen:
            continue
        seen.add(parsed)
        unique_ids.append(parsed)

    if not unique_ids:
        return result

    client = ensure_http_client("NoComment: _fetch_steamdb_app_names_batch")
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://steamdb.info/",
    }

    for appid in unique_ids:
        try:
            url = f"https://steamdb.info/app/{appid}/?cc=us&lang=english"
            resp = client.get(url, headers=headers, follow_redirects=True, timeout=15)
            if int(resp.status_code) != 200:
                continue
            name = _extract_steamdb_app_name_from_html(resp.text or "")
            if not name:
                continue
            with APP_NAME_CACHE_LOCK:
                APP_NAME_CACHE[int(appid)] = name
            result[int(appid)] = name
        except Exception:
            continue

    return result


def _append_loaded_app(appid: int, name: str) -> None:
    try:
        path = _loaded_apps_path()
        lines = []
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as handle:
                lines = handle.read().splitlines()
        prefix = f"{appid}:"
        lines = [line for line in lines if not line.startswith(prefix)]
        lines.append(f"{appid}:{name}")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write("\n".join(lines) + "\n")
    except Exception as exc:
        logger.warn(f"NoComment: _append_loaded_app failed for {appid}: {exc}")


def _remove_loaded_app(appid: int) -> None:
    try:
        path = _loaded_apps_path()
        if not os.path.exists(path):
            return
        with open(path, "r", encoding="utf-8") as handle:
            lines = handle.read().splitlines()
        prefix = f"{appid}:"
        new_lines = [line for line in lines if not line.startswith(prefix)]
        if len(new_lines) != len(lines):
            with open(path, "w", encoding="utf-8") as handle:
                handle.write("\n".join(new_lines) + ("\n" if new_lines else ""))
    except Exception as exc:
        logger.warn(f"NoComment: _remove_loaded_app failed for {appid}: {exc}")


def _log_appid_event(action: str, appid: int, name: str) -> None:
    try:
        stamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
        line = f"[{action}] {appid} - {name} - {stamp}\n"
        with open(_appid_log_path(), "a", encoding="utf-8") as handle:
            handle.write(line)
    except Exception as exc:
        logger.warn(f"NoComment: _log_appid_event failed: {exc}")


def _preload_app_names_cache(include_applist: bool = True) -> None:
    """Pre-load app names from logs/loaded apps, optionally including applist."""
                                                         
    try:
        log_path = _appid_log_path()
        if os.path.exists(log_path):
            with open(log_path, "r", encoding="utf-8") as handle:
                for line in handle.read().splitlines():
                                                                          
                                                                                      
                                                            
                    if "]" in line and " - " in line:
                        try:
                                                                 
                            parts = line.split("]", 1)
                            if len(parts) < 2:
                                continue

                            content = parts[1].strip()
                                                                                         
                            content_parts = content.split(" - ", 2)

                            if len(content_parts) >= 2:
                                appid_str = content_parts[0].strip()
                                name = content_parts[1].strip()

                                                    
                                appid = int(appid_str)

                                                                          
                                if name and not name.startswith("Unknown") and not name.startswith("UNKNOWN"):
                                    with APP_NAME_CACHE_LOCK:
                                        APP_NAME_CACHE[appid] = name
                        except (ValueError, IndexError):
                            continue
    except Exception as exc:
        logger.warn(f"NoComment: _preload_app_names_cache from logs failed: {exc}")

                                                                                
    try:
        path = _loaded_apps_path()
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as handle:
                for line in handle.read().splitlines():
                    if ":" in line:
                        parts = line.split(":", 1)
                        try:
                            appid = int(parts[0].strip())
                            name = parts[1].strip()
                            if name:
                                with APP_NAME_CACHE_LOCK:
                                    APP_NAME_CACHE[appid] = name
                        except (ValueError, IndexError):
                            continue
    except Exception as exc:
        logger.warn(f"NoComment: _preload_app_names_cache from loaded_apps failed: {exc}")
    
                                                                                            
                                                                        
    if include_applist:
        try:
            _load_applist_into_memory()
        except Exception as exc:
            logger.warn(f"NoComment: _preload_app_names_cache from applist failed: {exc}")


def _get_loaded_app_name(appid: int) -> str:
    """Get app name from loadedappids.txt, with applist as fallback."""
    try:
        path = _loaded_apps_path()
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as handle:
                for line in handle.read().splitlines():
                    if line.startswith(f"{appid}:"):
                        name = line.split(":", 1)[1].strip()
                        if name:
                            return name
    except Exception:
        pass
    
                                                          
    return _get_app_name_from_applist(appid)


def _applist_file_path() -> str:
    """Get the path to the applist JSON file."""
    temp_dir = ensure_temp_download_dir()
    return os.path.join(temp_dir, APPLIST_FILE_NAME)


def _load_applist_into_memory() -> None:
    """Load the applist JSON file into memory for fast lookups."""
    global APPLIST_DATA, APPLIST_LOADED
    
    with APPLIST_LOCK:
        if APPLIST_LOADED:
            return
        
        file_path = _applist_file_path()
        if not os.path.exists(file_path):
            logger.log("NoComment: Applist file not found, skipping load")
            APPLIST_LOADED = True                                           
            return
        
        try:
            logger.log("NoComment: Loading applist into memory...")
            with open(file_path, "r", encoding="utf-8") as handle:
                data = json.load(handle)
            
            if isinstance(data, list):
                count = 0
                for entry in data:
                    if isinstance(entry, dict):
                        appid = entry.get("appid")
                        name = entry.get("name")
                        if appid and name and isinstance(name, str) and name.strip():
                            APPLIST_DATA[int(appid)] = name.strip()
                            count += 1
                logger.log(f"NoComment: Loaded {count} app names from applist into memory")
            else:
                logger.warn("NoComment: Applist file has invalid format (expected array)")
            
            APPLIST_LOADED = True
        except Exception as exc:
            logger.warn(f"NoComment: Failed to load applist into memory: {exc}")
            APPLIST_LOADED = True                                                    


def _get_app_name_from_applist(appid: int) -> str:
    """Get app name from in-memory applist."""
    global APPLIST_DATA, APPLIST_LOADED
    
                              
    if not APPLIST_LOADED:
        _load_applist_into_memory()
    
    with APPLIST_LOCK:
        return APPLIST_DATA.get(int(appid), "")


def _ensure_applist_file() -> None:
    """Download the applist file if it doesn't exist."""
    file_path = _applist_file_path()
    
    if os.path.exists(file_path):
        logger.log("NoComment: Applist file already exists, skipping download")
        return
    
    logger.log("NoComment: Applist file not found, downloading...")

    headers = {"User-Agent": USER_AGENT, "Accept": "application/json"}

    def _normalize_applist_payload(payload: Any) -> List[Any]:
        if isinstance(payload, list):
            return payload
        if isinstance(payload, dict):
            applist = payload.get("applist")
            if isinstance(applist, dict):
                apps = applist.get("apps")
                if isinstance(apps, list):
                    return apps
        raise ValueError("Downloaded applist has invalid format (expected array)")

    def _download_with_shared_client() -> List[Any]:
        client = ensure_http_client("NoComment: DownloadApplist")
        last_error: Optional[Exception] = None
        for attempt in range(APPLIST_DOWNLOAD_RETRIES):
            try:
                resp = client.get(
                    APPLIST_URL,
                    headers=headers,
                    follow_redirects=True,
                    timeout=APPLIST_DOWNLOAD_TIMEOUT,
                )
                resp.raise_for_status()
                return _normalize_applist_payload(resp.json())
            except Exception as exc:
                last_error = exc
                if attempt + 1 < APPLIST_DOWNLOAD_RETRIES:
                    time.sleep(APPLIST_RETRY_DELAY_SECONDS)
        raise last_error if last_error else RuntimeError("Unknown applist download error")

    def _download_with_direct_client() -> List[Any]:
        # Fallback path for environments with broken HTTPS proxy vars.
        with httpx.Client(timeout=APPLIST_DOWNLOAD_TIMEOUT, trust_env=False) as direct_client:
            last_error: Optional[Exception] = None
            for attempt in range(APPLIST_DOWNLOAD_RETRIES):
                try:
                    resp = direct_client.get(
                        APPLIST_URL,
                        headers=headers,
                        follow_redirects=True,
                        timeout=APPLIST_DOWNLOAD_TIMEOUT,
                    )
                    resp.raise_for_status()
                    return _normalize_applist_payload(resp.json())
                except Exception as exc:
                    last_error = exc
                    if attempt + 1 < APPLIST_DOWNLOAD_RETRIES:
                        time.sleep(APPLIST_RETRY_DELAY_SECONDS)
            raise last_error if last_error else RuntimeError("Unknown applist fallback download error")

    def _download_from_github_fallbacks() -> List[Any]:
        combined: List[Any] = []
        by_appid: Dict[int, str] = {}
        for fallback_url in APPLIST_FALLBACK_URLS:
            resp = requests.get(
                fallback_url,
                headers=headers,
                timeout=APPLIST_DOWNLOAD_TIMEOUT,
            )
            resp.raise_for_status()
            payload = _normalize_applist_payload(resp.json())
            for entry in payload:
                if not isinstance(entry, dict):
                    continue
                try:
                    appid = int(entry.get("appid"))
                except Exception:
                    continue
                name = str(entry.get("name") or "").strip()
                if appid <= 0 or not name:
                    continue
                if appid not in by_appid:
                    by_appid[appid] = name
                    combined.append({"appid": appid, "name": name})
        if not combined:
            raise ValueError("No valid app entries received from fallback sources")
        return combined

    def _is_tls_wrong_version_error(exc: Optional[Exception]) -> bool:
        if exc is None:
            return False
        try:
            return "WRONG_VERSION_NUMBER" in str(exc).upper()
        except Exception:
            return False

    data: Optional[List[Any]] = None
    shared_error: Optional[Exception] = None

    try:
        data = _download_with_shared_client()
    except Exception as exc:
        shared_error = exc
        logger.warn(f"NoComment: Shared client applist download failed: {exc}")

    if data is None:
        fallback_exc: Optional[Exception] = None
        if _is_tls_wrong_version_error(shared_error):
            logger.warn("NoComment: Skipping direct applist retry after TLS WRONG_VERSION_NUMBER; trying GitHub fallback")
        else:
            try:
                data = _download_with_direct_client()
                logger.log("NoComment: Applist download succeeded with direct fallback client")
            except Exception as exc:
                fallback_exc = exc

        if data is None:
            if shared_error is not None and fallback_exc is not None:
                logger.warn(
                    f"NoComment: Failed to download applist file. shared_error={shared_error}; "
                    f"fallback_error={fallback_exc}"
                )
            elif fallback_exc is not None:
                logger.warn(f"NoComment: Failed to download applist file: {fallback_exc}")

            try:
                data = _download_from_github_fallbacks()
                logger.log("NoComment: Applist download succeeded using GitHub fallback sources")
            except Exception as github_exc:
                logger.warn(f"NoComment: GitHub fallback applist download failed: {github_exc}")
                return

    with open(file_path, "w", encoding="utf-8") as handle:
        json.dump(data, handle)

    logger.log(f"NoComment: Successfully downloaded and saved applist file ({len(data)} entries)")


def init_applist() -> None:
    """Initialize the applist system: download if needed, then load into memory."""
    try:
        _ensure_applist_file()
        _load_applist_into_memory()
    except Exception as exc:
        logger.warn(f"NoComment: Applist initialization failed: {exc}")


def fetch_app_name(appid: int) -> str:
    return _fetch_app_name(appid)


def _process_and_install_lua(
    appid: int,
    zip_path: str,
    preferred_lua_appid: Optional[int] = None,
    force_keep_appids: Optional[List[int]] = None,
    delete_zip_after: bool = True,
) -> None:
    """Process downloaded zip and install lua file into stplug-in directory."""
    import zipfile

    if _is_download_cancelled(appid):
        raise RuntimeError("cancelled")

    base_path = detect_steam_install_path() or Millennium.steam_path()
    target_dir = os.path.join(base_path or "", "config", "stplug-in")
    os.makedirs(target_dir, exist_ok=True)

    forced_keep_set: set[int] = set()
    for value in (force_keep_appids or []):
        try:
            parsed = int(value)
            if parsed > 0:
                forced_keep_set.add(parsed)
        except Exception:
            continue

    with zipfile.ZipFile(zip_path, "r") as archive:
        names = archive.namelist()

        try:
            # Steam expects depot manifests under config\depotcache.
            depotcache_dir = os.path.join(base_path or "", "config", "depotcache")
            os.makedirs(depotcache_dir, exist_ok=True)
            for name in names:
                try:
                    if _is_download_cancelled(appid):
                        raise RuntimeError("cancelled")
                    if name.lower().endswith(".manifest"):
                        pure = os.path.basename(name)
                        data = archive.read(name)
                        out_path = os.path.join(depotcache_dir, pure)
                        with open(out_path, "wb") as manifest_file:
                            manifest_file.write(data)
                        logger.log(f"NoComment: Extracted manifest -> {out_path}")
                except Exception as manifest_exc:
                    logger.warn(f"NoComment: Failed to extract manifest {name}: {manifest_exc}")
        except Exception as depot_exc:
            logger.warn(f"NoComment: depotcache extraction failed: {depot_exc}")

        candidates = []
        for name in names:
            pure = os.path.basename(name)
            if re.fullmatch(r"\d+\.lua", pure):
                candidates.append(name)

        if _is_download_cancelled(appid):
            raise RuntimeError("cancelled")

        chosen = None
        preferred_source_appid = int(preferred_lua_appid or appid)
        preferred = f"{preferred_source_appid}.lua"
        for name in candidates:
            if os.path.basename(name) == preferred:
                chosen = name
                break
        if chosen is None and candidates:
            chosen = candidates[0]
        if not chosen:
            raise RuntimeError("No numeric .lua file found in zip")

        data = archive.read(chosen)
        try:
            text = data.decode("utf-8")
        except Exception:
            text = data.decode("utf-8", errors="replace")

        install_all_content = _install_all_content_on_add()
        removed_related_lines = 0
        kept_base_lines = 0
        kept_depot_lines = 0
        processed_lines = []
        full_mode_lines = []
        existing_single_arg_ids: set[int] = set()

        for line in text.splitlines(True):
            is_comment_line = COMMENT_LINE_RE.match(line) is not None
            # Keep manifest directives intact.
            full_mode_lines.append(line)
            if is_comment_line:
                processed_lines.append(line)
                continue

            parsed_addappid = _parse_addappid_line(line)

            if forced_keep_set and parsed_addappid:
                target_appid, has_extra_args = parsed_addappid
                if has_extra_args:
                    kept_depot_lines += 1
                    processed_lines.append(line)
                    continue
                existing_single_arg_ids.add(target_appid)
                if target_appid in forced_keep_set:
                    kept_base_lines += 1
                    processed_lines.append(line)
                    continue
                removed_related_lines += 1
                continue

            if not forced_keep_set and not install_all_content and parsed_addappid:
                target_appid, has_extra_args = parsed_addappid
                if has_extra_args:
                    # Preserve depot/hash directives in base-only mode.
                    kept_depot_lines += 1
                else:
                    # Validate item type and keep only the base game app entry.
                    if target_appid != int(appid):
                        removed_related_lines += 1
                        continue
                    _, target_type = _fetch_app_identity(target_appid)
                    if str(target_type or "").strip().lower() != "game":
                        removed_related_lines += 1
                        continue
                    kept_base_lines += 1

            processed_lines.append(line)

        if forced_keep_set:
            missing_forced_ids = [x for x in sorted(forced_keep_set) if x not in existing_single_arg_ids]
            if missing_forced_ids:
                raise RuntimeError(
                    "Requested appid(s) not present in source metadata: "
                    + ", ".join(str(x) for x in missing_forced_ids)
                )
            logger.log(
                "NoComment: Force-keep add mode enabled for appid="
                f"{appid}; source={preferred_source_appid} kept={kept_base_lines} "
                f"kept_depot={kept_depot_lines} filtered={removed_related_lines} addappid entries"
            )
        else:
            if not install_all_content and kept_base_lines == 0 and removed_related_lines > 0:
                logger.warn(
                    "NoComment: Base-only add mode found no base addappid entry for appid="
                    f"{appid}; keeping full script to avoid a broken install"
                )
                processed_lines = full_mode_lines
                removed_related_lines = 0

            if not install_all_content:
                logger.log(
                    "NoComment: Base-only add mode enabled for appid="
                    f"{appid}; kept_base={kept_base_lines} kept_depot={kept_depot_lines} "
                    f"filtered={removed_related_lines} addappid entries"
                )

        processed_text = "".join(processed_lines)

        _set_download_state(appid, {"status": "installing"})
        dest_file = os.path.join(target_dir, f"{appid}.lua")
        if _is_download_cancelled(appid):
            raise RuntimeError("cancelled")
        with open(dest_file, "w", encoding="utf-8") as output:
            output.write(processed_text)
        logger.log(f"NoComment: Installed lua -> {dest_file}")
        _set_download_state(appid, {"installedPath": dest_file})

    if delete_zip_after:
        try:
            os.remove(zip_path)
        except Exception:
            try:
                for _ in range(3):
                    time.sleep(0.2)
                    try:
                        os.remove(zip_path)
                        break
                    except Exception:
                        continue
            except Exception:
                pass


def _is_download_cancelled(appid: int) -> bool:
    try:
        return _get_download_state(appid).get("status") == "cancelled"
    except Exception:
        return False


def _attempt_download_and_install(
    requested_appid: int,
    install_appid: int,
    client: Any,
    apis: List[Dict[str, Any]],
    dest_path: str,
    preferred_lua_appid: Optional[int] = None,
    force_keep_appids: Optional[List[int]] = None,
    cache_source_appid: Optional[int] = None,
    cache_only: bool = False,
    log_context: str = "",
) -> bool:
    for api in apis:
        name = api.get("name", "Unknown")
        template = api.get("url", "")
        success_code = int(api.get("success_code", 200))
        unavailable_code = int(api.get("unavailable_code", 404))
        url = template.replace("<appid>", str(requested_appid))
        _set_download_state(
            install_appid, {"status": "checking", "currentApi": name, "bytesRead": 0, "totalBytes": 0}
        )
        logger.log(f"NoComment: Trying API '{name}' -> {url}{log_context}")
        try:
            headers = {"User-Agent": USER_AGENT}
            if _is_download_cancelled(install_appid):
                logger.log(f"NoComment: Download cancelled before contacting API '{name}'")
                return False
            with client.stream("GET", url, headers=headers, follow_redirects=True) as resp:
                code = resp.status_code
                logger.log(f"NoComment: API '{name}' status={code}")
                if code == unavailable_code:
                    continue
                if code != success_code:
                    continue
                total = int(resp.headers.get("Content-Length", "0") or "0")
                _set_download_state(
                    install_appid, {"status": "downloading", "bytesRead": 0, "totalBytes": total}
                )
                with open(dest_path, "wb") as output:
                    for chunk in resp.iter_bytes():
                        if not chunk:
                            continue
                        if _is_download_cancelled(install_appid):
                            logger.log(
                                f"NoComment: Download cancelled mid-stream for appid={install_appid}"
                            )
                            raise RuntimeError("cancelled")
                        output.write(chunk)
                        state = _get_download_state(install_appid)
                        read = int(state.get("bytesRead", 0)) + len(chunk)
                        _set_download_state(install_appid, {"bytesRead": read})
                        if _is_download_cancelled(install_appid):
                            logger.log(
                                "NoComment: Download cancelled after writing chunk for appid="
                                f"{install_appid}"
                            )
                            raise RuntimeError("cancelled")
                logger.log(f"NoComment: Download complete -> {dest_path}")

                if _is_download_cancelled(install_appid):
                    logger.log(
                        "NoComment: Download marked cancelled after completion for appid="
                        f"{install_appid}"
                    )
                    raise RuntimeError("cancelled")

                try:
                    with open(dest_path, "rb") as fh:
                        magic = fh.read(4)
                        if magic not in (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"):
                            file_size = os.path.getsize(dest_path)
                            with open(dest_path, "rb") as check_f:
                                preview = check_f.read(512)
                                content_preview = preview[:100].decode("utf-8", errors="ignore")
                            logger.warn(
                                f"NoComment: API '{name}' returned non-zip file (magic={magic.hex()}, size={file_size}, preview={content_preview[:50]})"
                            )
                            try:
                                os.remove(dest_path)
                            except Exception:
                                pass
                            continue
                except FileNotFoundError:
                    logger.warn("NoComment: Downloaded file not found after download")
                    continue
                except Exception as validation_exc:
                    logger.warn(f"NoComment: File validation failed for API '{name}': {validation_exc}")
                    try:
                        os.remove(dest_path)
                    except Exception:
                        pass
                    continue

                try:
                    source_for_cache = int(cache_source_appid) if cache_source_appid is not None else int(requested_appid)
                except Exception:
                    source_for_cache = int(requested_appid)
                try:
                    _cache_download_metadata(
                        source_appid=source_for_cache,
                        downloaded_zip_path=dest_path,
                        api_name=str(name or ""),
                        source_url=str(url or ""),
                    )
                except Exception as cache_exc:
                    logger.warn(
                        f"NoComment: Failed to cache downloaded metadata for source {source_for_cache}: {cache_exc}"
                    )

                if cache_only:
                    try:
                        os.remove(dest_path)
                    except Exception:
                        pass
                    logger.log(
                        "NoComment: Metadata-only download succeeded for source appid="
                        f"{source_for_cache}"
                    )
                    return True

                try:
                    if _is_download_cancelled(install_appid):
                        logger.log(
                            f"NoComment: Processing aborted due to cancellation for appid={install_appid}"
                        )
                        raise RuntimeError("cancelled")
                    _set_download_state(install_appid, {"status": "processing"})
                    _process_and_install_lua(
                        install_appid,
                        dest_path,
                        preferred_lua_appid=preferred_lua_appid,
                        force_keep_appids=force_keep_appids,
                    )
                    if _is_download_cancelled(install_appid):
                        logger.log(
                            "NoComment: Installation complete but marked cancelled for appid="
                            f"{install_appid}"
                        )
                        raise RuntimeError("cancelled")
                    try:
                        fetched_name = _fetch_app_name(install_appid) or f"UNKNOWN ({install_appid})"
                        _append_loaded_app(install_appid, fetched_name)
                        _log_appid_event(f"ADDED - {name}", install_appid, fetched_name)
                        logger.log(
                            "NoComment: Added item appid="
                            f"{install_appid} name={fetched_name} api={name}"
                        )
                    except Exception:
                        pass
                    _set_download_state(
                        install_appid,
                        {
                            "status": "done",
                            "success": True,
                            "api": name,
                            "sourceAppid": int(requested_appid),
                        },
                    )
                    return True
                except Exception as install_exc:
                    if isinstance(install_exc, RuntimeError) and str(install_exc) == "cancelled":
                        try:
                            if os.path.exists(dest_path):
                                os.remove(dest_path)
                        except Exception:
                            pass
                        logger.log(
                            "NoComment: Cancelled download cleanup complete for appid="
                            f"{install_appid}"
                        )
                        return False
                    logger.warn(f"NoComment: Processing failed -> {install_exc}")
                    _set_download_state(
                        install_appid,
                        {"status": "failed", "error": f"Processing failed: {install_exc}"},
                    )
                    try:
                        os.remove(dest_path)
                    except Exception:
                        pass
                    return False
        except RuntimeError as cancel_exc:
            if str(cancel_exc) == "cancelled":
                try:
                    if os.path.exists(dest_path):
                        os.remove(dest_path)
                except Exception:
                    pass
                logger.log(
                    f"NoComment: Download cancelled and cleaned up for appid={install_appid}"
                )
                return False
            logger.warn(
                f"NoComment: Runtime error during download for appid={install_appid}: {cancel_exc}"
            )
            _set_download_state(install_appid, {"status": "failed", "error": str(cancel_exc)})
            return False
        except Exception as err:
            logger.warn(f"NoComment: API '{name}' failed with error: {err}")
            continue

    return False


def _download_zip_for_app(appid: int, base_appid: Optional[int] = None, base_owned_on_steam: bool = False):
    client = ensure_http_client("NoComment: download")
    apis = load_api_manifest()
    if not apis:
        logger.warn("NoComment: No enabled APIs in manifest")
        _set_download_state(appid, {"status": "failed", "error": "No APIs available"})
        return

    dest_root = ensure_temp_download_dir()
    dest_path = os.path.join(dest_root, f"{appid}.zip")
    _set_download_state(
        appid,
        {"status": "checking", "currentApi": None, "bytesRead": 0, "totalBytes": 0, "dest": dest_path},
    )

    preferred_base_appid: Optional[int] = None
    try:
        parsed_base = int(base_appid) if base_appid is not None else 0
        if parsed_base > 0 and parsed_base != int(appid):
            preferred_base_appid = parsed_base
    except Exception:
        preferred_base_appid = None

    stale_cache = _find_stale_cached_source_for_app(
        int(appid), preferred_source_appid=preferred_base_appid
    )
    if stale_cache:
        stale_source_appid = int(stale_cache.get("sourceAppid") or 0)
        missing_ids = _normalize_positive_int_list(stale_cache.get("missingAppIds"))
        if stale_source_appid > 0:
            preview = ", ".join(str(x) for x in missing_ids[:6]) if missing_ids else ""
            if preview and len(missing_ids) > 6:
                preview = preview + ", ..."
            logger.log(
                "NoComment: Cached metadata is stale for source appid="
                f"{stale_source_appid}; SteamDB has {len(missing_ids)} newer item(s)"
                + (f" ({preview})" if preview else "")
                + ". Refreshing metadata from API before local install."
            )
            refreshed = _attempt_download_and_install(
                requested_appid=int(stale_source_appid),
                install_appid=int(appid),
                client=client,
                apis=apis,
                dest_path=dest_path,
                preferred_lua_appid=int(stale_source_appid),
                cache_source_appid=int(stale_source_appid),
                cache_only=True,
                log_context=(
                    f" (metadata refresh from stale local cache; delta={len(missing_ids)})"
                ),
            )
            if refreshed:
                logger.log(
                    "NoComment: Metadata refresh succeeded for source appid="
                    f"{stale_source_appid}; reusing updated local cache for appid={appid}"
                )
            else:
                logger.warn(
                    "NoComment: Metadata refresh failed for stale source appid="
                    f"{stale_source_appid}; continuing with normal add flow for appid={appid}"
                )

    # Fast path: reuse cached metadata first when available.
    if _install_from_cached_metadata(appid, preferred_source_appid=preferred_base_appid):
        return

    # Primary path: install directly for requested appid.
    if _attempt_download_and_install(
        requested_appid=int(appid),
        install_appid=int(appid),
        client=client,
        apis=apis,
        dest_path=dest_path,
        cache_source_appid=int(appid),
    ):
        return

    app_name, app_type = _fetch_app_identity(appid)
    app_type_norm = str(app_type or "").strip().lower()

    # Resolve base source for non-game content.
    fullgame_appid: Optional[int] = preferred_base_appid
    if (fullgame_appid is None or int(fullgame_appid) <= 0) and app_type_norm == "dlc":
        fullgame_appid = _fetch_fullgame_appid(appid)

    if fullgame_appid and int(fullgame_appid) > 0 and int(fullgame_appid) != int(appid):
        # Retry local metadata install with explicit base preference.
        if _install_from_cached_metadata(appid, preferred_source_appid=int(fullgame_appid)):
            return

        logger.log(
            "NoComment: Item package unavailable; attempting base-game fallback for "
            f"appid={appid} ({app_name or 'Unknown'}) via base={fullgame_appid}"
        )
        if _attempt_download_and_install(
            requested_appid=int(fullgame_appid),
            install_appid=int(appid),
            client=client,
            apis=apis,
            dest_path=dest_path,
            preferred_lua_appid=int(fullgame_appid),
            force_keep_appids=[int(appid)],
            cache_source_appid=int(fullgame_appid),
            log_context=f" (fallback from base appid {fullgame_appid})",
        ):
            return

        # If metadata still isn't available and user owns the base game, warm metadata
        # cache with a base download only (no install), then retry local install.
        if bool(base_owned_on_steam) and not _has_cached_source_metadata(int(fullgame_appid)):
            logger.log(
                "NoComment: No local metadata for base appid="
                f"{fullgame_appid}; warming cache from API before retrying appid={appid}"
            )
            warmed = _attempt_download_and_install(
                requested_appid=int(fullgame_appid),
                install_appid=int(appid),
                client=client,
                apis=apis,
                dest_path=dest_path,
                preferred_lua_appid=int(fullgame_appid),
                cache_source_appid=int(fullgame_appid),
                cache_only=True,
                log_context=f" (metadata warm-up for base appid {fullgame_appid})",
            )
            if warmed and _install_from_cached_metadata(appid, preferred_source_appid=int(fullgame_appid)):
                return

    _set_download_state(appid, {"status": "failed", "error": "Not available on any API"})


def start_add_via_NoComment(
    appid: int, base_appid: Optional[int] = None, base_owned_on_steam: bool = False
) -> str:
    try:
        appid = int(appid)
    except Exception:
        return json.dumps({"success": False, "error": "Invalid appid"})

    logger.log(
        "NoComment: StartAddViaNoComment appid="
        f"{appid} base_appid={base_appid} base_owned={bool(base_owned_on_steam)}"
    )
    app_name, app_type = _fetch_app_identity(appid)
    resolved_name = app_name or f"App {appid}"
    app_type_norm = str(app_type or "").strip().lower()

    # Count toward the 24h limit only when app type is confirmed as a game.
    counts_toward_limit = app_type_norm == "game"
    if counts_toward_limit:
        usage = _consume_daily_add_slot(
            appid=appid,
            name=resolved_name,
            app_type=(app_type_norm or "game"),
        )
        if not usage.get("allowed"):
            limit = usage.get("limit", DAILY_ADD_LIMIT)
            reset_date = usage.get("reset", "")
            message = f"Daily add limit reached ({limit} per 24h). Resets on {reset_date}."
            logger.warn(
                "NoComment: Daily add limit reached for appid="
                f"{appid} ({resolved_name}) ({usage.get('count', 0)}/{limit})"
            )
            _set_download_state(
                appid,
                {"status": "failed", "error": message, "bytesRead": 0, "totalBytes": 0},
            )
            return json.dumps(
                {
                    "success": False,
                    "error": message,
                    "limit": limit,
                    "count": usage.get("count", 0),
                    "reset": reset_date,
                }
            )
    else:
        logger.log(
            "NoComment: Daily add slot not consumed for appid="
            f"{appid} ({resolved_name}) type={app_type_norm}"
        )

    _set_download_state(appid, {"status": "queued", "bytesRead": 0, "totalBytes": 0})
    normalized_base_appid: Optional[int] = None
    try:
        parsed_base = int(base_appid) if base_appid is not None else 0
        if parsed_base > 0 and parsed_base != int(appid):
            normalized_base_appid = parsed_base
    except Exception:
        normalized_base_appid = None

    thread = threading.Thread(
        target=_download_zip_for_app,
        args=(appid, normalized_base_appid, bool(base_owned_on_steam)),
        daemon=True,
    )
    thread.start()
    return json.dumps({"success": True})


def get_daily_add_usage() -> str:
    try:
        usage = _current_daily_add_usage()
        payload = {"success": True}
        payload.update(usage)
        return json.dumps(payload)
    except Exception as exc:
        return json.dumps({"success": False, "error": str(exc)})


def _resolve_cache_source_appid_for_target(target_appid: int) -> int:
    entries = _get_cached_source_entries_for_app(
        int(target_appid), preferred_source_appid=int(target_appid)
    )
    if entries:
        try:
            chosen = int(entries[0].get("sourceAppid") or 0)
            if chosen > 0:
                return chosen
        except Exception:
            pass

    with APP_META_CACHE_LOCK:
        cache = _load_app_meta_cache_locked()
        sources = cache.get("sources", {})
        by_appid = cache.get("byAppid", {})

    if isinstance(sources, dict) and str(target_appid) in sources:
        return int(target_appid)

    raw = by_appid.get(str(target_appid), []) if isinstance(by_appid, dict) else []
    if isinstance(raw, list):
        for value in raw:
            try:
                parsed = int(value)
            except Exception:
                continue
            if parsed > 0:
                return parsed

    return int(target_appid)


def _clear_cached_source_metadata(source_appid: int) -> Tuple[int, bool]:
    deleted_zip_count = 0
    changed = False
    zip_paths: List[str] = []

    with APP_META_CACHE_LOCK:
        cache = _load_app_meta_cache_locked()
        sources = cache.get("sources", {})
        if not isinstance(sources, dict):
            sources = {}

        record = sources.pop(str(source_appid), None)
        if record is not None:
            changed = True
            zip_rel = str(record.get("zipPath") or "").strip() if isinstance(record, dict) else ""
            if zip_rel:
                zip_paths.append(backend_path(zip_rel))

        cache["sources"] = sources
        cache["byAppid"] = _rebuild_app_meta_index(sources)
        if changed:
            _save_app_meta_cache_locked(cache)

    zip_paths.append(_meta_cache_zip_abs_path(source_appid))

    seen_paths: set[str] = set()
    for candidate in zip_paths:
        normalized = os.path.normpath(str(candidate or ""))
        if not normalized or normalized in seen_paths:
            continue
        seen_paths.add(normalized)
        if not os.path.exists(normalized):
            continue
        try:
            os.remove(normalized)
            deleted_zip_count += 1
        except Exception as exc:
            logger.warn(
                "NoComment: Failed to remove cached zip for source appid="
                f"{source_appid} path={normalized}: {exc}"
            )

    return deleted_zip_count, changed


def clear_game_cache_and_refetch(appid: int) -> str:
    try:
        appid = int(appid)
    except Exception:
        return json.dumps({"success": False, "error": "Invalid appid"})

    if appid <= 0:
        return json.dumps({"success": False, "error": "Invalid appid"})

    try:
        current_state = _get_download_state(appid)
        active_statuses = {"queued", "checking", "downloading", "processing"}
        if str(current_state.get("status") or "").lower() in active_statuses:
            return json.dumps(
                {
                    "success": False,
                    "error": "Another operation is already in progress for this app",
                }
            )
    except Exception:
        pass

    source_appid = _resolve_cache_source_appid_for_target(appid)
    if source_appid <= 0:
        source_appid = int(appid)

    logger.log(
        "NoComment: Manual cache refresh requested for appid="
        f"{appid} using source_appid={source_appid}"
    )

    deleted_zip_count, removed_source_entry = _clear_cached_source_metadata(source_appid)

    apis = load_api_manifest()
    if not apis:
        return json.dumps({"success": False, "error": "No APIs available"})

    client = ensure_http_client("NoComment: manual cache refresh")
    dest_root = ensure_temp_download_dir()
    dest_path = os.path.join(dest_root, f"cache_refresh_{appid}_{source_appid}.zip")

    ok = _attempt_download_and_install(
        requested_appid=int(source_appid),
        install_appid=int(appid),
        client=client,
        apis=apis,
        dest_path=dest_path,
        preferred_lua_appid=int(source_appid),
        cache_source_appid=int(source_appid),
        cache_only=True,
        log_context=f" (manual cache refresh for appid {appid})",
    )

    if not ok:
        return json.dumps(
            {
                "success": False,
                "error": "Failed to refetch cache from available APIs",
                "appid": int(appid),
                "sourceAppid": int(source_appid),
                "deletedZipCount": int(deleted_zip_count),
                "removedSourceEntry": bool(removed_source_entry),
            }
        )

    message = f"Cache refreshed for appid {appid} (source {source_appid})."
    logger.log(
        "NoComment: Manual cache refresh complete for appid="
        f"{appid} source={source_appid} deleted_zips={deleted_zip_count}"
    )
    return json.dumps(
        {
            "success": True,
            "message": message,
            "appid": int(appid),
            "sourceAppid": int(source_appid),
            "deletedZipCount": int(deleted_zip_count),
            "removedSourceEntry": bool(removed_source_entry),
        }
    )


def get_steamdb_related_entries(appid: int) -> str:
    try:
        appid = int(appid)
    except Exception:
        return json.dumps({"success": False, "error": "Invalid appid"})

    if appid <= 0:
        return json.dumps({"success": False, "error": "Invalid appid"})

    try:
        client = ensure_http_client("NoComment: SteamDB related")
        url = f"https://steamdb.info/app/{appid}/dlc/?cc=us&lang=english"
        headers = {
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": f"https://steamdb.info/app/{appid}/",
        }
        resp = client.get(url, headers=headers, follow_redirects=True, timeout=20)
        if resp.status_code != 200:
            return json.dumps(
                {"success": False, "error": f"SteamDB responded with status {resp.status_code}", "entries": []}
            )

        html_text = resp.text or ""
        entries = _parse_steamdb_related_entries(appid, html_text)
        return json.dumps({"success": True, "entries": entries})
    except Exception as exc:
        logger.warn(f"NoComment: Failed to fetch SteamDB related entries for {appid}: {exc}")
        return json.dumps({"success": False, "error": str(exc), "entries": []})


def get_api_related_entries(appid: int) -> str:
    try:
        appid = int(appid)
    except Exception:
        return json.dumps({"success": False, "error": "Invalid appid"})

    if appid <= 0:
        return json.dumps({"success": False, "error": "Invalid appid"})

    apis = load_api_manifest()
    if not apis:
        return json.dumps({"success": False, "error": "No APIs available", "entries": []})

    client = ensure_http_client("NoComment: API related")
    by_id: Dict[str, Dict[str, Any]] = {}
    successful_sources: List[str] = []
    errors: List[str] = []

    for api in apis:
        api_name = str(api.get("name") or "Unknown")
        template = str(api.get("url") or "")
        if not template:
            continue

        success_code = int(api.get("success_code", 200))
        unavailable_code = int(api.get("unavailable_code", 404))
        url = template.replace("<appid>", str(appid))
        try:
            headers = {"User-Agent": USER_AGENT}
            resp = client.get(url, headers=headers, follow_redirects=True, timeout=25)
            code = int(resp.status_code)
            if code == unavailable_code:
                continue
            if code != success_code:
                continue

            content_bytes = resp.content or b""
            if not content_bytes:
                continue
            related_ids = _extract_related_appids_from_content_bytes(appid, content_bytes)
            if not related_ids:
                continue

            successful_sources.append(api_name)
            for rel_id in related_ids:
                key = str(rel_id)
                if key in by_id:
                    continue
                name = _get_app_name_from_applist(rel_id)
                by_id[key] = {"appid": rel_id, "name": name}
        except Exception as exc:
            logger.warn(f"NoComment: API related lookup failed via '{api_name}' for {appid}: {exc}")
            errors.append(f"{api_name}: {exc}")
            continue

    if by_id:
        unresolved_ids: List[int] = []
        for key, item in by_id.items():
            current_name = str(item.get("name") or "").strip()
            if current_name and not current_name.startswith("App "):
                continue
            try:
                unresolved_ids.append(int(key))
            except Exception:
                continue

        if unresolved_ids:
            resolved_names = _fetch_app_names_batch(unresolved_ids)
            for rel_id, resolved_name in resolved_names.items():
                key = str(rel_id)
                if key not in by_id:
                    continue
                cleaned = str(resolved_name or "").strip()
                if cleaned:
                    by_id[key]["name"] = cleaned

        unresolved_after_store: List[int] = []
        for key, item in by_id.items():
            current_name = str(item.get("name") or "").strip()
            if current_name and not current_name.startswith("App "):
                continue
            try:
                unresolved_after_store.append(int(key))
            except Exception:
                continue

        if unresolved_after_store:
            steamdb_names = _fetch_steamdb_app_names_batch(unresolved_after_store)
            for rel_id, resolved_name in steamdb_names.items():
                key = str(rel_id)
                if key not in by_id:
                    continue
                cleaned = str(resolved_name or "").strip()
                if cleaned:
                    by_id[key]["name"] = cleaned

        entries = list(by_id.values())
        entries.sort(key=lambda item: int(item.get("appid", 0)))
        return json.dumps(
            {
                "success": True,
                "entries": entries,
                "sources": successful_sources,
            }
        )

    err = "No related entries found from APIs"
    if errors:
        err = err + " (" + "; ".join(errors[:3]) + ")"
    return json.dumps({"success": False, "error": err, "entries": []})


def get_add_status(appid: int) -> str:
    try:
        appid = int(appid)
    except Exception:
        return json.dumps({"success": False, "error": "Invalid appid"})
    state = _get_download_state(appid)
    return json.dumps({"success": True, "state": state})


def read_loaded_apps() -> str:
    try:
        path = _loaded_apps_path()
        entries = []
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as handle:
                for line in handle.read().splitlines():
                    if ":" in line:
                        appid_str, name = line.split(":", 1)
                        appid_str = appid_str.strip()
                        name = name.strip()
                        if appid_str.isdigit() and name:
                            entries.append({"appid": int(appid_str), "name": name})
        return json.dumps({"success": True, "apps": entries})
    except Exception as exc:
        return json.dumps({"success": False, "error": str(exc)})


def dismiss_loaded_apps() -> str:
    try:
        path = _loaded_apps_path()
        if os.path.exists(path):
            os.remove(path)
        return json.dumps({"success": True})
    except Exception as exc:
        return json.dumps({"success": False, "error": str(exc)})


def delete_NoComment_for_app(appid: int) -> str:
    try:
        appid = int(appid)
    except Exception:
        return json.dumps({"success": False, "error": "Invalid appid"})

    base = detect_steam_install_path() or Millennium.steam_path()
    target_dir = os.path.join(base or "", "config", "stplug-in")
    paths = [
        os.path.join(target_dir, f"{appid}.lua"),
        os.path.join(target_dir, f"{appid}.lua.disabled"),
    ]
    deleted = []
    for path in paths:
        try:
            if os.path.exists(path):
                os.remove(path)
                deleted.append(path)
        except Exception as exc:
            logger.warn(f"NoComment: Failed to delete {path}: {exc}")
    try:
        name = _get_loaded_app_name(appid) or _fetch_app_name(appid) or f"UNKNOWN ({appid})"
        _remove_loaded_app(appid)
        if deleted:
            _log_appid_event("REMOVED", appid, name)
            logger.log(f"NoComment: Removed item appid={appid} name={name}")
    except Exception:
        pass
    return json.dumps({"success": True, "deleted": deleted, "count": len(deleted)})


def get_icon_data_url() -> str:
    try:
        steam_ui_path = os.path.join(Millennium.steam_path(), "steamui", WEBKIT_DIR_NAME)
        icon_path = os.path.join(steam_ui_path, WEB_UI_ICON_FILE)
        if not os.path.exists(icon_path):
            icon_path = public_path(WEB_UI_ICON_FILE)
        with open(icon_path, "rb") as handle:
            data = handle.read()
        b64 = base64.b64encode(data).decode("ascii")
        return json.dumps({"success": True, "dataUrl": f"data:image/png;base64,{b64}"})
    except Exception as exc:
        logger.warn(f"NoComment: GetIconDataUrl failed: {exc}")
        return json.dumps({"success": False, "error": str(exc)})


def has_NoComment_for_app(appid: int) -> str:
    try:
        appid = int(appid)
    except Exception:
        return json.dumps({"success": False, "error": "Invalid appid"})
    exists = has_lua_for_app(appid)
    return json.dumps({"success": True, "exists": exists})


def cancel_add_via_NoComment(appid: int) -> str:
    try:
        appid = int(appid)
    except Exception:
        return json.dumps({"success": False, "error": "Invalid appid"})

    state = _get_download_state(appid)
    if not state or state.get("status") in {"done", "failed"}:
        return json.dumps({"success": True, "message": "Nothing to cancel"})

    _set_download_state(appid, {"status": "cancelled", "error": "Cancelled by user"})
    logger.log(f"NoComment: Cancellation requested for appid={appid}")
    return json.dumps({"success": True})


def get_installed_lua_scripts() -> str:
    """Get list of all installed Lua scripts from stplug-in directory."""
    try:
        # Keep this endpoint hot-path fast: avoid full applist loading/network lookups.
        _preload_app_names_cache(include_applist=False)

        base_path = detect_steam_install_path() or Millennium.steam_path()
        if not base_path:
            return json.dumps({"success": False, "error": "Could not find Steam installation path"})

        target_dir = os.path.join(base_path, "config", "stplug-in")
        if not os.path.exists(target_dir):
            return json.dumps({"success": True, "scripts": []})

        loaded_apps_names = _read_loaded_apps_name_map()
        installed_scripts = []

        try:
            for filename in sorted(os.listdir(target_dir)):
                if filename.endswith(".lua") or filename.endswith(".lua.disabled"):
                    try:
                        appid_str = filename.replace(".lua.disabled", "").replace(".lua", "")
                        appid = int(appid_str)

                        is_disabled = filename.endswith(".lua.disabled")

                        game_name = ""
                        with APP_NAME_CACHE_LOCK:
                            game_name = str(APP_NAME_CACHE.get(appid, "") or "").strip()

                        if not game_name:
                            game_name = str(loaded_apps_names.get(appid, "") or "").strip()

                        # If applist is already warm in memory, use it. Do not trigger full load here.
                        if not game_name:
                            with APPLIST_LOCK:
                                if APPLIST_LOADED:
                                    game_name = str(APPLIST_DATA.get(appid, "") or "").strip()

                        if not game_name:
                            game_name = f"AppID {appid}"

                        file_path = os.path.join(target_dir, filename)
                        file_size, formatted_date, added_appids = _get_cached_lua_file_metadata(file_path)

                        script_info = {
                            "appid": appid,
                            "gameName": game_name,
                            "filename": filename,
                            "isDisabled": is_disabled,
                            "fileSize": file_size,
                            "modifiedDate": formatted_date,
                            "path": file_path,
                            "addedAppIds": added_appids,
                            "addedAppCount": len(added_appids),
                        }

                        installed_scripts.append(script_info)

                    except ValueError:
                                                      
                        continue
                    except Exception as exc:
                        logger.warn(f"NoComment: Failed to process Lua file {filename}: {exc}")
                        continue

        except Exception as exc:
            logger.warn(f"NoComment: Failed to scan stplug-in directory: {exc}")
            return json.dumps({"success": False, "error": f"Failed to scan directory: {str(exc)}"})

                       
        installed_scripts.sort(key=lambda x: x["appid"])

        return json.dumps({"success": True, "scripts": installed_scripts})

    except Exception as exc:
        logger.warn(f"NoComment: Failed to get installed Lua scripts: {exc}")
        return json.dumps({"success": False, "error": str(exc)})


__all__ = [
    "cancel_add_via_NoComment",
    "clear_game_cache_and_refetch",
    "delete_NoComment_for_app",
    "dismiss_loaded_apps",
    "fetch_app_name",
    "get_add_status",
    "get_api_related_entries",
    "get_daily_add_usage",
    "get_icon_data_url",
    "get_installed_lua_scripts",
    "get_steamdb_related_entries",
    "has_NoComment_for_app",
    "init_applist",
    "read_loaded_apps",
    "start_add_via_NoComment",
]
