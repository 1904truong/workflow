"""Dịch vụ đọc văn bản thành audio chạy trên máy (dùng edge-tts), cho web soạn giáo trình gọi.

Chạy: start-tts.bat  (hoặc .venv\\Scripts\\python server.py)
  GET  /health            -> {"ok": true}
  GET  /voices            -> danh sách giọng gợi ý
  POST /tts  {"text": "A: Hi\\nB: Hello", "voices": {"A": "en-US-JennyNeural", "B": "en-US-GuyNeural"}, "rate": "+0%"}
                          -> audio/mpeg

Chỉ lắng nghe 127.0.0.1 (không mở ra mạng ngoài).
"""
import asyncio
import json
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import edge_tts

for _s in (sys.stdout, sys.stderr):
    try:
        _s.reconfigure(encoding="utf-8")
    except Exception:
        pass

HOST, PORT = "127.0.0.1", 8765
MAX_CHARS = 20000

# Giọng gợi ý cho bài nghe tiếng Anh + tiếng Việt
VOICES = [
    {"id": "en-US-JennyNeural", "label": "Jenny (US, nữ)", "lang": "en-US"},
    {"id": "en-US-AriaNeural", "label": "Aria (US, nữ)", "lang": "en-US"},
    {"id": "en-US-GuyNeural", "label": "Guy (US, nam)", "lang": "en-US"},
    {"id": "en-US-DavisNeural", "label": "Davis (US, nam)", "lang": "en-US"},
    {"id": "en-GB-SoniaNeural", "label": "Sonia (UK, nữ)", "lang": "en-GB"},
    {"id": "en-GB-LibbyNeural", "label": "Libby (UK, nữ)", "lang": "en-GB"},
    {"id": "en-GB-RyanNeural", "label": "Ryan (UK, nam)", "lang": "en-GB"},
    {"id": "en-GB-ThomasNeural", "label": "Thomas (UK, nam)", "lang": "en-GB"},
    {"id": "vi-VN-HoaiMyNeural", "label": "Hoài My (VN, nữ)", "lang": "vi-VN"},
    {"id": "vi-VN-NamMinhNeural", "label": "Nam Minh (VN, nam)", "lang": "vi-VN"},
]
DEFAULT_VOICE = "en-US-JennyNeural"
SPEAKER_RE = re.compile(r"^\s*([A-Za-z0-9_]{1,20})\s*:\s*(.+)$")
RATE_RE = re.compile(r"^[+-]\d{1,3}%$")


def parse_turns(text, voices):
    """'A: câu nói' -> [(voice, câu)]. Có tên người nói mà không khai báo giọng thì dùng giọng mặc định.
    Dòng không có tên người nói dùng lại người trước (hoặc giọng mặc định)."""
    turns, current = [], voices.get("_default", DEFAULT_VOICE)
    for line in text.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        m = SPEAKER_RE.match(line)
        if m and m.group(1) in voices:
            current = voices[m.group(1)]
            line = m.group(2).strip()
        turns.append((current, line))
    return turns


async def synth(text, voices, rate):
    audio = bytearray()
    for voice, line in parse_turns(text, voices):
        comm = edge_tts.Communicate(line, voice, rate=rate)
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                audio += chunk["data"]
    return bytes(audio)


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        # Chỉ nghe localhost nên cho phép web (localhost:5173 hoặc bản đã đưa lên mạng) gọi vào
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            return self._json(200, {"ok": True})
        if self.path == "/voices":
            return self._json(200, {"voices": VOICES, "default": DEFAULT_VOICE})
        self._json(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/tts":
            return self._json(404, {"error": "not found"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            req = json.loads(self.rfile.read(n) or b"{}")
        except Exception:
            return self._json(400, {"error": "JSON không hợp lệ"})
        text = str(req.get("text") or "").strip()
        if not text:
            return self._json(400, {"error": "Chưa có nội dung để đọc"})
        if len(text) > MAX_CHARS:
            return self._json(400, {"error": f"Văn bản quá dài (tối đa {MAX_CHARS} ký tự)"})
        valid = {v["id"] for v in VOICES}
        voices = {k: v for k, v in (req.get("voices") or {}).items() if isinstance(v, str) and v in valid}
        voices.setdefault("_default", DEFAULT_VOICE)
        rate = str(req.get("rate") or "+0%")
        if not RATE_RE.match(rate):
            rate = "+0%"
        try:
            data = asyncio.run(synth(text, voices, rate))
        except Exception as e:
            return self._json(502, {"error": f"Dịch vụ đọc lỗi: {e}"})
        if not data:
            return self._json(502, {"error": "Không nhận được âm thanh"})
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "audio/mpeg")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        sys.stderr.write("[tts] " + (fmt % args) + "\n")


if __name__ == "__main__":
    print(f"TTS server: http://{HOST}:{PORT}  (Ctrl+C để dừng)")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
