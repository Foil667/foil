#!/usr/bin/env python3
"""Minimal Telegram Bot API CLI. Auth via Secure Vault surrogate (never touches the raw token)."""
import json
import sys
import urllib.parse
import urllib.request

sys.path.insert(0, "/opt/hatch/skills/skill-creator/bin")
from dynamic_credentials import (
    url_with_surrogate_path_segment,
    read_json_response,
)

CRED = "custom.telegram"
HOSTS = ["api.telegram.org"]
BASE = "https://api.telegram.org/bot{}/{}"


def api(method, params=None):
    url = url_with_surrogate_path_segment(BASE.format("{}", method), CRED, allowed_hosts=HOSTS)
    data = None
    headers = {}
    if params:
        data = urllib.parse.urlencode(params).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=60) as resp:
        body = read_json_response(resp)
    if not body.get("ok"):
        raise SystemExit(f"Telegram API error: {json.dumps(body)[:300]}")
    return body["result"]


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: tg.py me | send <chat_id> <text> | updates [--offset N] [--timeout S]")
    cmd = sys.argv[1]
    if cmd == "me":
        me = api("getMe")
        print(json.dumps(me, indent=1))
    elif cmd == "send":
        if len(sys.argv) < 4:
            raise SystemExit("usage: tg.py send <chat_id> <text>")
        res = api("sendMessage", {"chat_id": sys.argv[2], "text": sys.argv[3]})
        print("sent message_id:", res["message_id"])
    elif cmd == "updates":
        offset, timeout = None, 30
        args = sys.argv[2:]
        for i, a in enumerate(args):
            if a == "--offset" and i + 1 < len(args):
                offset = int(args[i + 1])
            if a == "--timeout" and i + 1 < len(args):
                timeout = int(args[i + 1])
        params = {"timeout": timeout}
        if offset is not None:
            params["offset"] = offset
        updates = api("getUpdates", params)
        print(json.dumps(updates, indent=1)[:4000])
    else:
        raise SystemExit(f"unknown command: {cmd}")


if __name__ == "__main__":
    main()
