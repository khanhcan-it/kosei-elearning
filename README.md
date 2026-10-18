# Thư viện bài học — HTML, CSS và JavaScript thuần

Giao diện tối giản với nền sáng, lưới card vuông 3 cột trên desktop, thumbnail video làm nền, tiêu đề trắng lớn, breadcrumb nhỏ và nút play mở video trong modal.

## Chạy website

Vì website tải dữ liệu từ các file JSON bằng `fetch`, hãy chạy qua máy chủ tĩnh thay vì mở trực tiếp `index.html`.

```bash
cd e-learning
python3 -m http.server 8000
```

Mở <http://localhost:8000> trong trình duyệt.

## Cấu trúc dự án

```text
e-learning/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js
│   ├── data.js
│   └── vimeo.js
└── data/
    ├── index.json
    ├── N2.json
    └── N3.json
```

## Thêm khóa học mới

1. Đặt file JSON khóa học trong `data/`.
2. Thêm mục vào `data/index.json` theo định dạng:

```json
[
  { "id": "n2", "title": "JLPT N2", "file": "./data/N2.json" },
  { "id": "n3", "title": "JLPT N3", "file": "./data/N3.json" }
]
```

Mỗi file dữ liệu có thể chứa nhiều cấp nhóm như `cats`, `lessons` và danh sách video trong `list_lectures`. Trang sẽ duyệt các cấp này để tạo card và breadcrumb. File JSON nguồn được giữ nguyên.

## Giao diện và hành vi

- Lưới card vuông: 3 cột desktop, 2 cột ở màn hình nhỏ hơn.
- Card dùng thumbnail Vimeo làm ảnh nền; nếu thiếu Vimeo nhưng có YouTube ID thì dùng thumbnail YouTube.
- Tiêu đề bài học màu trắng, chữ lớn; breadcrumb cấp nội dung nằm ngay bên dưới.
- Bấm card/nút play để mở video trong modal; nhấn `Esc` hoặc nút đóng để thoát.
- Chọn khóa học N2/N3 ở thanh trên cùng.
- Tìm kiếm theo tên bài học hoặc breadcrumb, không phân biệt dấu tiếng Việt.
- Không có tag, bộ lọc, thanh tiến trình hay trạng thái hoàn thành trên giao diện.
- Một số bài thiếu ID video hoặc thumbnail có thể hiện nền dự phòng; quyền phát còn phụ thuộc tình trạng video và thiết lập nhúng của nhà cung cấp.

## Lưu ý

- Vimeo oEmbed cần kết nối mạng và có thể không cung cấp thumbnail với video riêng tư hoặc bị giới hạn nhúng.
- Không sửa hoặc ghi đè các JSON nguồn khi website chạy.
