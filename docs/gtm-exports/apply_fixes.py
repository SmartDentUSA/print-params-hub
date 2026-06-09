#!/usr/bin/env python3
"""
SmartDent GTM Fix Script — 2026-06-09
Applies all 4-task corrections to the 3 GTM container JSON files.

Changes applied:
  MNPGDCH (loja):
    - Tag 28: event_id  {{JS - Event ID UUID}} → {{DLV - sd_event_id}}
    - Tag 47: measurementIdOverride  G-LJ7X8G61N4 → G-1411Z6YVPY
    - Tag 29: linker.domains  remove trailing comma
    - Tag 66: remove paused=true  (reactivate Meta Pixel PageView)
    - New variable DLV - sd_event_id  (dataLayer, key: sd_event_id)
    - Remove dead UA variable (Analytics / UA-69042627-2)

  NZ64Q899 (site):
    - Tag 7: conversionId  AW-1203384992 → AW-18143771674
    - Tag 11: linker.domains  remove trailing comma

  MFN4T8P4 (server-side):
    - Tag 22: logType  debug → no_logging
"""

import json
import copy
import os
import re

UPLOAD_DIR = "/root/.claude/uploads/5009e216-0dba-58ea-903c-339f7e743794"
OUT_DIR    = "/home/user/print-params-hub/docs/gtm-exports"

FILES = {
    "MNPGDCH": "54a75ccf-GTMMNPGDCH_v40.json",
    "NZ64Q899": "c16dc70d-GTMNZ64Q899_v52.json",
    "MFN4T8P4": "83399104-GTMMFN4T8P4_v19.json",
}

changes_log = []

def log(msg):
    changes_log.append(msg)
    print(msg)

def remove_trailing_comma(value):
    """Remove trailing comma (and optional whitespace) from linker.domains string."""
    cleaned = value.rstrip().rstrip(",")
    if cleaned != value:
        return cleaned, True
    return value, False

# ─────────────────────────────────────────────
# MNPGDCH — loja.smartdent.com.br
# ─────────────────────────────────────────────
def fix_mnpgdch(data):
    cv = data["containerVersion"]
    tags = cv["tag"]
    variables = cv["variable"]

    # --- Tag 28: event_id  JS-UUID → DLV sd_event_id ---
    for tag in tags:
        if tag["tagId"] == "28":
            for param in tag.get("parameter", []):
                if param.get("key") == "eventSettingsTable" and param.get("type") == "LIST":
                    for row in param.get("list", []):
                        if row.get("type") == "MAP":
                            row_map = {m["key"]: m for m in row.get("map", [])}
                            if row_map.get("parameter", {}).get("value") == "event_id":
                                old = row_map["parameterValue"]["value"]
                                row_map["parameterValue"]["value"] = "{{DLV - sd_event_id}}"
                                log(f"[MNPGDCH] Tag 28: event_id  '{old}' → '{{{{DLV - sd_event_id}}}}'")

    # --- Tag 47: measurementIdOverride  G-LJ7X8G61N4 → G-1411Z6YVPY ---
    for tag in tags:
        if tag["tagId"] == "47":
            for param in tag.get("parameter", []):
                if param.get("key") == "measurementIdOverride":
                    old = param["value"]
                    param["value"] = "G-1411Z6YVPY"
                    log(f"[MNPGDCH] Tag 47: measurementIdOverride  '{old}' → 'G-1411Z6YVPY'")

    # --- Tag 29: linker.domains — remove trailing comma ---
    for tag in tags:
        if tag["tagId"] == "29":
            for param in tag.get("parameter", []):
                if param.get("key") == "configSettingsTable" and param.get("type") == "LIST":
                    for row in param.get("list", []):
                        if row.get("type") == "MAP":
                            row_map = {m["key"]: m for m in row.get("map", [])}
                            if row_map.get("parameter", {}).get("value") == "linker.domains":
                                val = row_map["parameterValue"]["value"]
                                cleaned, changed = remove_trailing_comma(val)
                                if changed:
                                    row_map["parameterValue"]["value"] = cleaned
                                    log(f"[MNPGDCH] Tag 29: linker.domains trailing comma removed")

    # --- Tag 66: reactivate Meta Pixel PageView (remove paused) ---
    for tag in tags:
        if tag["tagId"] == "66":
            if tag.get("paused") is True:
                del tag["paused"]
                log("[MNPGDCH] Tag 66: paused=true removed (Meta Pixel PageView reactivated)")

    # --- Remove dead UA variable (Analytics / UA-69042627-2) ---
    before = len(variables)
    cv["variable"] = [v for v in variables if not (v.get("name") == "Analytics" and
        any(p.get("key") == "trackingId" and "UA-" in p.get("value","") for p in v.get("parameter",[])))]
    if len(cv["variable"]) < before:
        log("[MNPGDCH] Variable 'Analytics' (UA-69042627-2) removed")

    # --- Add new variable DLV - sd_event_id ---
    existing_ids = {int(v["variableId"]) for v in cv["variable"]}
    new_id = str(max(existing_ids) + 1)
    new_var = {
        "accountId": cv["variable"][0]["accountId"],
        "containerId": cv["variable"][0]["containerId"],
        "variableId": new_id,
        "name": "DLV - sd_event_id",
        "type": "v",
        "parameter": [
            {"type": "INTEGER", "key": "dataLayerVersion", "value": "2"},
            {"type": "BOOLEAN", "key": "setDefaultValue",  "value": "false"},
            {"type": "TEMPLATE",  "key": "name",            "value": "sd_event_id"}
        ],
        "fingerprint": "1780999000001",
        "formatValue": {}
    }
    cv["variable"].append(new_var)
    log(f"[MNPGDCH] Variable '{new_var['name']}' added (id {new_id}, reads dataLayer.sd_event_id)")

    return data


# ─────────────────────────────────────────────
# NZ64Q899 — www.smartdent.com.br
# ─────────────────────────────────────────────
def fix_nz64q899(data):
    cv = data["containerVersion"]
    tags = cv["tag"]

    # --- Tag 7: conversionId  AW-1203384992 → AW-18143771674 ---
    for tag in tags:
        if tag["tagId"] == "7":
            for param in tag.get("parameter", []):
                if param.get("key") == "conversionId":
                    old = param["value"]
                    param["value"] = "AW-18143771674"
                    log(f"[NZ64Q899] Tag 7: conversionId  '{old}' → 'AW-18143771674'")

    # --- Tag 11: linker.domains — remove trailing comma ---
    for tag in tags:
        if tag["tagId"] == "11":
            for param in tag.get("parameter", []):
                if param.get("key") == "configSettingsTable" and param.get("type") == "LIST":
                    for row in param.get("list", []):
                        if row.get("type") == "MAP":
                            row_map = {m["key"]: m for m in row.get("map", [])}
                            if row_map.get("parameter", {}).get("value") == "linker.domains":
                                val = row_map["parameterValue"]["value"]
                                cleaned, changed = remove_trailing_comma(val)
                                if changed:
                                    row_map["parameterValue"]["value"] = cleaned
                                    log(f"[NZ64Q899] Tag 11: linker.domains trailing comma removed")

    return data


# ─────────────────────────────────────────────
# MFN4T8P4 — Server-Side
# ─────────────────────────────────────────────
def fix_mfn4t8p4(data):
    cv = data["containerVersion"]
    tags = cv["tag"]

    # --- Tag 22: logType  debug → no_logging ---
    for tag in tags:
        if tag["tagId"] == "22":
            for param in tag.get("parameter", []):
                if param.get("key") == "logType":
                    old = param["value"]
                    param["value"] = "no_logging"
                    log(f"[MFN4T8P4] Tag 22: logType  '{old}' → 'no_logging'")

    return data


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────
fixers = {
    "MNPGDCH":  fix_mnpgdch,
    "NZ64Q899": fix_nz64q899,
    "MFN4T8P4": fix_mfn4t8p4,
}

output_names = {
    "MNPGDCH":  "GTMMNPGDCH_v40_FIXED.json",
    "NZ64Q899": "GTMNZ64Q899_v52_FIXED.json",
    "MFN4T8P4": "GTMMFN4T8P4_v19_FIXED.json",
}

for key, filename in FILES.items():
    src = os.path.join(UPLOAD_DIR, filename)
    with open(src, "r", encoding="utf-8") as f:
        data = json.load(f)

    data = fixers[key](data)

    out = os.path.join(OUT_DIR, output_names[key])
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

    print(f"\n→ Saved: {out}")

print("\n" + "="*60)
print("RESUMO DE ALTERAÇÕES:")
print("="*60)
for c in changes_log:
    print(f"  ✅ {c}")
print(f"\nTotal: {len(changes_log)} alterações em 3 containers")
