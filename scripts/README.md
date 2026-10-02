# Migration Scripts

Thư mục này chứa các script migration dữ liệu cho hệ thống.

## Yêu cầu chung

- Có file `.env` ở root project
- Có một trong hai biến môi trường kết nối MongoDB:
  - `MONGODB_URI`
  - `MONGODB_URL`
- Nên backup database trước khi chạy migration

---

## 1) migrate-order-details.js

### Mục đích

Cập nhật toàn bộ `Order` để bổ sung `price` và `discount` còn thiếu trong từng phần tử của `orderDetails`, lấy từ `Product` theo `productId`.

### Chạy script

```bash
node scripts/migrate-order-details.js
```

### Kết quả

- Quét tất cả orders
- Với mỗi item trong `orderDetails`, nếu thiếu `price` hoặc `discount` thì lấy từ product tương ứng
- Update lại order và in log tổng kết số bản ghi đã cập nhật/lỗi

---

## 2) migrate-product-created-date.js

### Mục đích

Cập nhật các `Product` chưa có `createdDate` (hoặc `createdDate = null`) thành ngày mặc định `2025-01-01T00:00:00.000Z`.

### Chạy script

```bash
node scripts/migrate-product-created-date.js
```

### Kết quả

- Tìm các product thiếu `createdDate`
- Update hàng loạt với giá trị ngày mặc định
- In ra số lượng records match và records đã update

---

## 3) migrate-customer-created-date-random.js

### Mục đích

Cập nhật các `Customer` chưa có `createdDate` (hoặc `createdDate = null`) bằng giá trị ngẫu nhiên trước tháng 01/2024.

### Chạy script

```bash
node scripts/migrate-customer-created-date-random.js
```

### Kết quả

- Tìm các customer thiếu `createdDate`
- Gán `createdDate` ngẫu nhiên trong khoảng từ `2000-01-01` đến `2023-12-31`
---

## 4) migrate-collection-dates-random.js

### Mục đích

Cập nhật các `Collection` để gán `createdDate` và `modifiedDate` giống nhau bằng ngày ngẫu nhiên trong khoảng từ tháng 01/2022 đến tháng 12/2024.

### Chạy script

```bash
node scripts/migrate-collection-dates-random.js
```

### Kết quả

- Fetch tất cả collections
- Gán `createdDate` và `modifiedDate` cùng 1 giá trị ngẫu nhiên (2022-01-01 đến 2024-12-31)
- Update hàng loạt và in log tiến độ/tổng kết

## Gợi ý kiểm tra nhanh sau migration

- Kiểm tra số lượng bản ghi còn thiếu trường cần migration
- Kiểm tra ngẫu nhiên một vài document để xác nhận dữ liệu đúng kỳ vọng
