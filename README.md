# Study Notes — thư viện bài học

Website tĩnh dùng HTML, CSS và JavaScript thuần, hiển thị dữ liệu từ các file JSON.

## Giao diện
- Nền giấy kẻ được tạo bằng CSS, không cần ảnh nền.
- Card bài học dạng sketch với màu pastel ổn định theo section (Từ vựng, Kanji, Ngữ pháp, Đọc hiểu, Nghe hiểu).
- Không có sidebar, thumbnail video, tag hoặc tiến trình học.
- Chọn khóa học ở thanh đầu trang; chọn danh mục bằng các tab ngang.
- Lưới 3 cột trên desktop và tablet; 1 cột trên mobile.
- Card có tiêu đề, breadcrumb và nút play để mở video trong modal.
- Tìm kiếm theo tiêu đề và đường dẫn danh mục, không phân biệt dấu tiếng Việt.

## Chạy website
Do trình duyệt thường chặn `fetch()` file JSON khi mở trực tiếp bằng `file://`, hãy chạy qua máy chủ tĩnh. Từ thư mục `e-learning`:

```bash
python3 -m http.server 8000
```

Mở http://localhost:8000.

## Thêm khóa học
1. Thêm file JSON vào thư mục `data/`.
2. Đăng ký file trong `data/index.json` theo cấu trúc:

```json
[
  { "id": "n2", "title": "JLPT N2", "file": "./data/N2.json" },
  { "id": "n3", "title": "JLPT N3", "file": "./data/N3.json" }
]
```

Mỗi file JSON giữ nguyên cấu trúc dữ liệu nguồn. Thẻ bài học dùng `lec_title`, các nhánh `cats`/`lessons` và `list_lectures` để dựng tiêu đề và breadcrumb. Video ưu tiên Vimeo, sau đó dùng YouTube nếu có mã video hợp lệ. Bài không có video hoặc bị khóa sẽ không mở trình phát.
