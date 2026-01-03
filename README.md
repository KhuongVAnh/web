# Hệ Thống Quản Lý Bàn Học Thư Viện

Hệ thống phần mềm quản lý chỗ ngồi bàn học trong thư viện với khả năng giám sát trạng thái sử dụng bàn học theo thời gian thực, điều khiển thiết bị (đèn bàn), và tính toán điện năng tiêu thụ.

## 🚀 Cài Đặt Nhanh

### Yêu Cầu
- Node.js 18+
- MySQL 8+
- npm hoặc yarn

### Backend

```bash
cd backend
npm install
# File .env đã được tạo sẵn với DATABASE_URL
npm run prisma:generate  # Tạo Prisma Client
npm run prisma:migrate   # Chạy migrations
npm run seed             # Seed database với user và admin
npm run dev              # Chạy server
```

Hoặc chạy tất cả một lần:
```bash
cd backend
npm run setup  # Install, generate, migrate, seed
npm run dev
```

Backend sẽ chạy tại `http://localhost:3001`

### Frontend

```bash
cd frontend
npm install
cp .env.example .env  # Đã cấu hình sẵn
npm run dev
```

Frontend sẽ chạy tại `http://localhost:5173`

## 👤 Tài Khoản Mặc Định

Sau khi chạy `npm run seed`:

- **Sinh viên:**
  - Username: `user`
  - Password: `12345678`

- **Quản trị viên:**
  - Username: `admin`
  - Password: `12345678`

## 📡 MQTT Configuration

Hệ thống sử dụng HiveMQ Cloud để nhận dữ liệu từ ESP32:

- **Broker:** `5b91e3ce790f41e78062533f58758704.s1.eu.hivemq.cloud`
- **Port:** `8883` (TLS)
- **Username:** `ESP32`
- **Password:** `Vanh080105`
- **Topic Data:** `esp32/data`
- **Topic Config:** `esp32/config`

## 🏗️ Cấu Trúc Dự Án

```
├── frontend/
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── package.json
│   └── .env
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middlewares/
│   │   └── index.js
│   ├── prisma/
│   │   └── schema.prisma
│   ├── seed.js
│   ├── package.json
│   └── .env
│
└── README.md
```

## 🎯 Tính Năng

### Giao Diện Người Dùng (User)
- ✅ Hiển thị danh sách 5 phòng học
- ✅ Sơ đồ bàn học với trạng thái real-time
- ✅ Hiển thị bàn đang có người sử dụng / trống
- ✅ Trạng thái đèn học (bật/tắt)
- ✅ Icon người đang ngồi học
- ✅ Thời gian sử dụng (số phút)
- ✅ Nhiệt độ và độ ẩm theo thời gian thực

### Giao Diện Quản Trị (Admin)
- ✅ Tất cả chức năng của User
- ✅ Bật/tắt đèn của từng bàn học thủ công
- ✅ Điều chỉnh độ nhạy cảm biến khoảng cách
- ✅ Nhập công suất đèn học (W) cho mỗi bàn
- ✅ Tự động tính toán điện năng tiêu thụ:
  - Điện năng của từng bàn
  - Tổng điện năng của từng phòng
- ✅ Cấu hình ESP32 (tần số lấy mẫu, ngưỡng phát hiện, chu kỳ gửi dữ liệu)
- ✅ Báo cáo năng lượng chi tiết

## 📊 Database Schema

### Models
- `StudyRoom`: Phòng học (5 phòng)
- `Desk`: Bàn học (100 bàn: 5 phòng x 4 dãy x 5 bàn)
- `SensorReading`: Dữ liệu cảm biến khoảng cách
- `DHT`: Dữ liệu nhiệt độ & độ ẩm
- `EnergyRecord`: Bản ghi điện năng tiêu thụ
- `ESP32Config`: Cấu hình ESP32
- `User`: Người dùng (user/admin)

## 🔌 API Endpoints

### Public
- `GET /api/health` - Health check
- `POST /api/auth/login` - Đăng nhập
- `GET /api/rooms` - Lấy danh sách phòng
- `GET /api/rooms/:id` - Lấy thông tin phòng
- `GET /api/desks` - Lấy danh sách bàn
- `GET /api/desks/:id` - Lấy thông tin bàn

### Admin Only
- `GET /api/admin/stats` - Thống kê tổng quan
- `GET /api/admin/energy-report` - Báo cáo năng lượng
- `PATCH /api/desks/:id/toggle-light` - Bật/tắt đèn
- `PATCH /api/desks/:id/config` - Cập nhật cấu hình bàn
- `POST /api/admin/esp32/config` - Cập nhật cấu hình ESP32

## 🛠️ Công Nghệ Sử Dụng

### Frontend
- React 18
- Vite
- TailwindCSS
- Axios
- React Router DOM
- Lucide React (Icons)

### Backend
- Node.js
- Express
- Prisma ORM
- MySQL 8+
- MQTT (mqtt.js)
- JWT Authentication
- bcryptjs

## 📝 Ghi Chú

- **ESP32 chỉ được gắn vào Bàn 1, Dãy 1, Phòng 1**
  - Chỉ bàn này có cảm biến thực và trạng thái thay đổi theo dữ liệu từ ESP32 qua MQTT
  
- **Các bàn khác (99 bàn còn lại)**
  - Trạng thái được **FIX CỨNG** khi seed database (30% bàn occupied, 70% trống)
  - Trạng thái **KHÔNG THAY ĐỔI** trong suốt quá trình chạy chương trình
  - Chỉ có dữ liệu DHT (nhiệt độ, độ ẩm) được cập nhật định kỳ

- **Hệ thống tự động bật đèn** khi ESP32 phát hiện người ngồi (chỉ bàn 1 phòng 1)
- **Điện năng được tính toán** dựa trên công suất và thời gian sử dụng thực tế (chỉ bàn 1 phòng 1)

## 📄 License

MIT

