/**
 * Desk State Service
 * 
 * Quản lý trạng thái hiện tại của bàn (in-memory)
 * Lưu trữ thời điểm bắt đầu phiên sử dụng tạm thời
 * Trạng thái này được tính toán real-time từ cảm biến, không lưu vào DB
 */

// Map: deskId -> { startTime: Date, isOccupied: boolean }
const deskStates = new Map()

/**
 * @description Đặt trạng thái bàn là occupied và lưu thời điểm bắt đầu
 * @param {number} deskId - ID của bàn
 * @param {Date} startTime - Thời điểm bắt đầu (mặc định là now)
 * @returns {void}
 */
export function setDeskOccupied(deskId, startTime = new Date()) {
  deskStates.set(deskId, {
    startTime: startTime instanceof Date ? startTime : new Date(startTime),
    isOccupied: true,
  })
}

/**
 * @description Đặt trạng thái bàn là unoccupied và trả về thời điểm bắt đầu
 * @param {number} deskId - ID của bàn
 * @returns {Date|null} Thời điểm bắt đầu phiên sử dụng, hoặc null nếu không có
 */
export function setDeskUnoccupied(deskId) {
  const state = deskStates.get(deskId)
  if (state) {
    deskStates.delete(deskId) // Xóa khỏi map khi unoccupied
    return state.startTime
  }
  return null
}

/**
 * @description Lấy trạng thái hiện tại của bàn
 * @param {number} deskId - ID của bàn
 * @returns {{startTime: Date, isOccupied: boolean}|null} Trạng thái bàn hoặc null nếu không có
 */
export function getDeskState(deskId) {
  return deskStates.get(deskId) || null
}

/**
 * @description Kiểm tra xem bàn có đang được sử dụng không
 * @param {number} deskId - ID của bàn
 * @returns {boolean} true nếu bàn đang được sử dụng
 */
export function isDeskOccupied(deskId) {
  const state = deskStates.get(deskId)
  return state?.isOccupied === true
}

/**
 * @description Xóa trạng thái của bàn
 * @param {number} deskId - ID của bàn
 * @returns {void}
 */
export function clearDeskState(deskId) {
  deskStates.delete(deskId)
}

/**
 * @description Lấy tất cả trạng thái bàn
 * @returns {Map} Map chứa tất cả trạng thái bàn
 */
export function getAllDeskStates() {
  return deskStates
}

