/**
 * DHT Cache Service
 * 
 * Lưu trữ nhiệt độ và độ ẩm tạm thời (in-memory)
 * Chỉ phòng 1 có dữ liệu từ ESP32, các phòng khác không có
 */

// Map: roomId -> { temperature: number, humidity: number, timestamp: Date }
const dhtCache = new Map()

/**
 * @description Cập nhật dữ liệu DHT cho một phòng
 * @param {number} roomId - ID của phòng
 * @param {number} temperature - Nhiệt độ (°C)
 * @param {number} humidity - Độ ẩm (%)
 * @returns {void}
 */
export function updateDHT(roomId, temperature, humidity) {
  dhtCache.set(roomId, {
    temperature,
    humidity,
    timestamp: new Date(),
  })
}

/**
 * @description Lấy dữ liệu DHT mới nhất của một phòng
 * @param {number} roomId - ID của phòng
 * @returns {{temperature: number, humidity: number, timestamp: Date}|null} Dữ liệu DHT hoặc null nếu không có
 */
export function getDHT(roomId) {
  return dhtCache.get(roomId) || null
}

/**
 * @description Xóa dữ liệu DHT của một phòng
 * @param {number} roomId - ID của phòng
 * @returns {void}
 */
export function clearDHT(roomId) {
  dhtCache.delete(roomId)
}

/**
 * @description Lấy tất cả dữ liệu DHT
 * @returns {Map} Map chứa tất cả dữ liệu DHT
 */
export function getAllDHT() {
  return dhtCache
}

