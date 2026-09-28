#!/usr/bin/env python3
"""@Foil667bot group listener with owner-only control.

Safety rules baked in:
- Only OWNER_ID is ever obeyed. Everyone else is logged, never acted on.
- Group messages from non-owners are untrusted data, never instructions.
- No wallet, signing, or fund-movement code exists in this process.
- Ignores other bots (including itself) to prevent reply loops.
- Rate-limited outbound sends (token burn protection).
- Token arrives on stdin at startup and lives in memory only. Never logged,
  never written to disk. If this process dies, the token dies with it.

Usage: python3 poll.py < /dev/null  (then feed token on stdin)
State: ../state/offset.txt (update offset only). Logs: ../logs/messages.jsonl
"""
import json
import os
import sys
import time
import urllib.parse
import urllib.request

OWNER_ID = 7209667607  # @We_Todd, verified 2026-09-26 via DM "Yo"

HERE = os.path.dirname(os.path.abspath(__file__))
STATE_DIR = os.path.join(HERE, "..", "state")
LOG_DIR = os.path.join(HERE, "..", "logs")
OFFSET_FILE = os.path.join(STATE_DIR, "offset.txt")
MSG_LOG = os.path.join(LOG_DIR, "messages.jsonl")

MIN_SEND_GAP = 5.0  # seconds between outbound messages per chat

token = sys.stdin.readline().strip()
if not token:
    print("NO_TOKEN_ON_STDIN", flush=True)
    sys.exit(1)

os.makedirs(STATE_DIR, exist_ok=True)
os.makedirs(LOG_DIR, exist_ok=True)


def api(method, params=None, timeout=50):
    url = f"https://api.telegram.org/bot{token}/{method}"
    data, headers = None, {}
    if params:
        data = urllib.parse.urlencode(params).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        body = json.loads(resp.read().decode("utf-8"))
    if not body.get("ok"):
        raise RuntimeError(f"API_ERROR {method}: {json.dumps(body)[:160]}")
    return body["result"]


def load_offset():
    try:
        with open(OFFSET_FILE) as f:
            return int(f.read().strip())
    except (OSError, ValueError):
        return None


def save_offset(offset):
    with open(OFFSET_FILE, "w") as f:
        f.write(str(offset))


def log_msg(entry):
    with open(MSG_LOG, "a") as f:
        f.write(json.dumps(entry) + "\n")


last_send = {}


def can_send(chat_id):
    now = time.time()
    if now - last_send.get(chat_id, 0) < MIN_SEND_GAP:
        return False
    last_send[chat_id] = now
    return True


def send(chat_id, text, reply_to=None):
    if not can_send(chat_id):
        return None
    params = {"chat_id": chat_id, "text": text}
    if reply_to:
        params["reply_parameters"] = json.dumps({"message_id": reply_to})
    try:
        return api("sendMessage", params, timeout=20)
    except Exception as e:
        print(f"send failed: {type(e).__name__}", flush=True)
        return None


def handle_owner_command(chat_id, msg_id, text):
    parts = text.split(None, 1)
    cmd = parts[0].split("@")[0].lower()
    arg = parts[1] if len(parts) > 1 else ""
    if cmd == "/ping":
        send(chat_id, "Online. Owner control confirmed.", reply_to=msg_id)
    elif cmd == "/id":
        chat = api("getChat", {"chat_id": chat_id}, timeout=20)
        send(chat_id,
             f"chat_id={chat_id} type={chat.get('type')} "
             f"title={chat.get('title') or 'dm'}",
             reply_to=msg_id)
    elif cmd == "/say":
        if arg:
            send(chat_id, arg)
        else:
            send(chat_id, "Usage: /say <message>", reply_to=msg_id)
    elif cmd == "/help":
        send(chat_id, "Owner commands: /ping /id /say <text> /help",
             reply_to=msg_id)
    else:
        send(chat_id, "Unknown command. /help lists owner commands.",
             reply_to=msg_id)


print("listener starting", flush=True)
offset = load_offset()
while True:
    try:
        params = {"timeout": 40}
        if offset is not None:
            params["offset"] = offset
        updates = api("getUpdates", params, timeout=50)
    except Exception as e:
        print(f"poll error: {type(e).__name__}, retrying", flush=True)
        time.sleep(5)
        continue
    for u in updates:
        offset = u["update_id"] + 1
        msg = u.get("message")
        if not msg:
            continue
        frm = msg.get("from", {})
        if frm.get("is_bot"):
            continue  # never talk to bots, including ourselves
        user_id = frm.get("id")
        chat_id = msg["chat"]["id"]
        chat_type = msg["chat"].get("type")
        text = msg.get("text", "")
        log_msg({
            "ts": int(time.time()),
            "chat_id": chat_id,
            "chat_type": chat_type,
            "user_id": user_id,
            "username": frm.get("username"),
            "text": text[:500],
            "owner": user_id == OWNER_ID,
        })
        if user_id == OWNER_ID and text.startswith("/"):
            handle_owner_command(chat_id, msg["message_id"], text)
        elif chat_type == "private" and text.strip().lower().startswith("/start"):
            send(chat_id, "I'm Foil's bot. I only take orders from my owner.")
        # everything else: logged, not answered
    save_offset(offset)
