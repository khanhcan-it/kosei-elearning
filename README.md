# Study Notes — website E-learning tĩnh

Website học trực tuyến dùng HTML5, CSS3 và JavaScript thuần. Dữ liệu khóa học được đọc động từ JSON; tiến độ cá nhân được lưu bằng LocalStorage. Không cần Node.js, framework hoặc bước build.

## Chạy website

Do trình duyệt hạn chế `fetch()` khi mở file `index.html` trực tiếp, hãy chạy qua máy chủ HTTP tĩnh.

1. Giải nén thư mục `e-learning`.
2. Mở terminal tại thư mục này.
3. Chạy:

   ```bash
   python3 -m http.server 8000
   ```

4. Mở <http://localhost:8000> trong trình duyệt.

Có thể dùng tiện ích Live Server của VS Code thay cho lệnh trên. Không cần cài Node.js.

## Cấu trúc dự án

```text
e-learning/
├── index.html
├── README.md
├── assets/
│   └── icons/
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

`N2.json` và `N3.json` được giữ nguyên nội dung nguồn. `data/index.json` là registry để website biết tên khóa học và đường dẫn tới dữ liệu.

## Thêm khóa học mới

1. Chép file JSON vào thư mục `data/`, ví dụ `N1.json`.
2. Mở `data/index.json` và thêm một phần tử:

   ```json
   {
     "id": "n1",
     "title": "JLPT N1",
     "file": "./data/N1.json"
   }
   ```

3. Lưu file và tải lại trang. Không cần sửa JavaScript nếu file tuân theo cấu trúc dữ liệu tương tự.

Website hỗ trợ cấu trúc đang có trong dữ liệu: `root[] → cats[] → lessons[] → list_lectures[]`, đồng thời xử lý `lessons[]`, `cats[]` và `list_lectures[]` nếu xuất hiện ở những cấp khác. Các trường thiếu hoặc `null` không làm hỏng toàn bộ trang.

## Tính năng

- Chọn khóa học từ `data/index.json`.
- Cây nội dung có thể mở rộng/thu gọn.
- Tìm kiếm theo tên bài và đường dẫn phân cấp, không phân biệt dấu.
- Lọc tất cả, miễn phí, đã học, chưa học, có video và mục không có video.
- Chuyển chế độ lưới/danh sách.
- Đánh dấu hoàn thành và lưu theo khóa học + ID bài học trong LocalStorage.
- Tiến độ tổng quan.
- Thumbnail Vimeo qua oEmbed, lazy-load bằng `IntersectionObserver`, cache trong bộ nhớ và LocalStorage.
- Modal Vimeo, tự động yêu cầu phát, hỗ trợ fullscreen và loại bỏ iframe khi đóng.
- Responsive cho desktop, tablet và điện thoại.

## Vimeo và thumbnail

Website chỉ dùng `vimeo_id` để tạo trình phát Vimeo. Mã có dạng `1132535281?h=...` được giữ lại cả tham số `h` khi tạo URL player. `video_id` và `youtube_id` không được dùng thay thế cho `vimeo_id`.

Thumbnail được yêu cầu từ Vimeo oEmbed (`https://vimeo.com/api/oembed.json`). Tính năng này phụ thuộc vào quyền truy cập mạng, CORS, khả năng phản hồi của Vimeo và quyền riêng tư/nhúng của từng video. Nếu không lấy được thumbnail, website hiển thị placeholder; giao diện vẫn hoạt động. Nếu video bị giới hạn domain, riêng tư hoặc chủ video tắt nhúng, iframe có thể không phát được dù URL được tạo đúng.

Trình duyệt có thể chặn autoplay có âm thanh; người dùng có thể nhấn Play trong trình phát. Website không tự đánh dấu hoàn thành khi mở video.

## Lưu ý dữ liệu và quyền truy cập

- JSON nguồn chỉ được đọc, không bị sửa đổi bởi website.
- Trạng thái hoàn thành cá nhân được ghi riêng trong LocalStorage của trình duyệt hiện tại.
- Trường `is_lock: true` chặn mở video ở giao diện. Trường `free` chỉ dùng để hiển thị/lọc nhãn; website tĩnh không thay thế hệ thống xác thực hoặc kiểm soát quyền truy cập phía máy chủ.
- Trạng thái học đã lưu trên một trình duyệt không tự đồng bộ sang thiết bị khác.

## Khắc phục lỗi

- **Không tải được JSON:** kiểm tra đường dẫn và tên file trong `data/index.json`; chạy bằng HTTP server, không mở trực tiếp bằng `file://`.
- **Danh sách trống:** xác nhận JSON hợp lệ và có mảng ở cấp gốc.
- **Không có thumbnail:** kiểm tra kết nối mạng, quyền truy cập video và phản hồi của Vimeo oEmbed. Placeholder là hành vi dự phòng có chủ đích.
- **Video không phát:** kiểm tra quyền nhúng của video, tham số riêng tư `h`, chính sách domain của chủ video và thử nút Play trong iframe.
- **Tiến độ không lưu:** kiểm tra cài đặt lưu dữ liệu của trình duyệt/Private Browsing; LocalStorage có thể bị chặn hoặc xóa khi đóng phiên.

## Checklist kiểm thử thủ công

- [ ] Mở website qua `http://localhost:8000`.
- [ ] Chọn JLPT N2 và JLPT N3; xác nhận cây nội dung đổi theo khóa.
- [ ] Tìm kiếm tên bài và thử từng bộ lọc.
- [ ] Chọn một bài video, xác nhận URL Vimeo giữ tham số `h`.
- [ ] Đóng modal bằng nút ×, phím Escape và nhấn nền ngoài.
- [ ] Đánh dấu một bài hoàn thành, tải lại trang và xác nhận trạng thái vẫn còn.
- [ ] Chọn một bài kiểm tra không có video và xác nhận không có iframe.
- [ ] Kiểm tra bố cục trên màn hình nhỏ.
