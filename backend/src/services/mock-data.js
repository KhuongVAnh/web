/**
 * Mock Data Service
 * 
 * NOTE: Service này đã được tắt vì:
 * - Không cần tạo mock DHT data nữa (chỉ phòng 1 có dữ liệu từ ESP32)
 * - Desk occupancy status là fixed (chỉ ESP32 desk thay đổi)
 * 
 * Nếu cần mock data cho testing, có thể bật lại service này.
 */

// Service đã được tắt - không tạo mock data nữa
export function startMockDataService(intervalMs = 10000) {
  console.log(`[Mock Data] ⚠️  Service disabled - No mock data generation`)
  console.log(`[Mock Data] ℹ️  Only Room 1 has real DHT data from ESP32`)
  console.log(`[Mock Data] ℹ️  Desk occupancy status is FIXED - Only ESP32 desk (identified by esp32DeviceId) changes via MQTT`)
}

