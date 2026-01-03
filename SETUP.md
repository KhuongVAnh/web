# Hướng Dẫn Setup Hệ Thống

## 🚀 Setup Nhanh

### Bước 1: Setup Backend

```bash
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
npm run dev
```

Backend sẽ chạy tại `http://localhost:3001`

### Bước 2: Setup Frontend (Terminal mới)

```bash
cd frontend
npm install
npm run dev
```

Frontend sẽ chạy tại `http://localhost:5173`

## 📝 Chi Tiết

### Backend Setup

1. **Cài đặt dependencies:**
   ```bash
   cd backend
   npm install
   ```

2. **Generate Prisma Client:**
   ```bash
   npm run prisma:generate
   ```
   Lệnh này sẽ tạo thư mục `node_modules/.prisma/client` với Prisma Client đã generate.

3. **Chạy migrations:**
   ```bash
   npm run prisma:migrate
   ```
   Tạo database schema trong MySQL.

4. **Seed database:**
   ```bash
   npm run seed
   ```
   Tạo 5 phòng học, 100 bàn học, và 2 tài khoản (user + admin).

5. **Chạy server:**
   ```bash
   npm run dev
   ```

### Frontend Setup

1. **Cài đặt dependencies:**
   ```bash
   cd frontend
   npm install
   ```

2. **Chạy development server:**
   ```bash
   npm run dev
   ```

## 👤 Tài Khoản Đăng Nhập

Sau khi chạy `npm run seed`:

- **Sinh viên:**
  - Username: `user`
  - Password: `12345678`

- **Quản trị viên:**
  - Username: `admin`
  - Password: `12345678`

## 📌 Lưu Ý Quan Trọng

### Trạng Thái Bàn Học

- **Bàn 1, Dãy 1, Phòng 1 (ESP32):**
  - Có cảm biến thực
  - Trạng thái thay đổi theo dữ liệu từ ESP32 qua MQTT
  - Tự động bật/tắt đèn khi phát hiện người ngồi

- **Các bàn khác (99 bàn):**
  - Trạng thái **FIX CỨNG** khi seed database
  - **KHÔNG THAY ĐỔI** trong suốt quá trình chạy
  - Chỉ có dữ liệu DHT (nhiệt độ, độ ẩm) được cập nhật định kỳ

### Để Reset Trạng Thái Bàn

Nếu muốn thay đổi trạng thái ban đầu của các bàn, chạy lại seed:

```bash
cd backend
npm run prisma:reset  # Xóa tất cả data
npm run seed          # Seed lại với trạng thái mới
```

## 🔧 Troubleshooting

### Lỗi Prisma Client chưa được generate

```bash
cd backend
npm run prisma:generate
```

### Lỗi database connection

Kiểm tra file `backend/.env` có đúng DATABASE_URL không.

### Lỗi MQTT connection

MQTT sẽ tự động reconnect. Kiểm tra console log để xem trạng thái kết nối.

### Bàn không thay đổi trạng thái

- Đây là **hành vi bình thường** - chỉ bàn 1 phòng 1 mới thay đổi
- Các bàn khác giữ nguyên trạng thái đã seed

## 📦 Scripts Có Sẵn

### Backend

- `npm run dev` - Chạy development server với auto-reload
- `npm run start` - Chạy production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Chạy database migrations
- `npm run prisma:studio` - Mở Prisma Studio (GUI cho database)
- `npm run prisma:reset` - Reset database (xóa tất cả data)
- `npm run seed` - Seed database với dữ liệu mẫu
- `npm run setup` - Chạy tất cả: install, generate, migrate, seed

### Frontend

- `npm run dev` - Chạy development server
- `npm run build` - Build production
- `npm run preview` - Preview production build

