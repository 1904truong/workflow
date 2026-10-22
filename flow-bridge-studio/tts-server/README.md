# TTS server (tạo audio từ văn bản)

Dịch vụ nhỏ chạy trên máy, dùng [edge-tts](https://github.com/rany2/edge-tts). Web soạn giáo trình gọi vào đây khi bấm nút "Tạo audio".

- Cài lần đầu: `python -m venv .venv` rồi `.venv\Scripts\python -m pip install -r requirements.txt`
- Chạy: bấm đúp `start-tts.bat` (để cửa sổ mở trong lúc dùng). Địa chỉ: http://127.0.0.1:8765
- Hội thoại: mỗi dòng `A: ...` / `B: ...`, giọng chọn trong hộp "Tạo audio" của web.
- Lưu ý: edge-tts dùng dịch vụ đọc của Microsoft Edge (không chính thức), có thể bị đổi/chặn.
