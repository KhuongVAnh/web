export default function DeskConfigModal({
  selectedDesk,
  setSelectedDesk,
  saving,
  handleUpdateDeskConfig,
}) {
  if (!selectedDesk) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h3 className="text-lg font-bold text-gray-900 mb-4">
          Cấu Hình Bàn {selectedDesk.row}-{selectedDesk.position}
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Công suất đèn (W)
            </label>
            <input
              type="number"
              step="0.1"
              defaultValue={selectedDesk.lampPowerW}
              className="w-full px-3 py-2 border rounded-lg"
              id="lampPowerW"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Độ nhạy cảm biến (cm)
            </label>
            <input
              type="number"
              step="0.1"
              defaultValue={selectedDesk.distanceSensitivity}
              className="w-full px-3 py-2 border rounded-lg"
              id="distanceSensitivity"
            />
          </div>

          <div className="text-sm text-gray-600">
            <p>Năng lượng tiêu thụ: {selectedDesk.energyConsumedWh.toFixed(2)} Wh</p>
            <p>Thời gian sử dụng: {selectedDesk.totalUsageMinutes} phút</p>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={() => setSelectedDesk(null)}
            className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
          >
            Hủy
          </button>
          <button
            onClick={() => {
              const lampPowerW = parseFloat(document.getElementById("lampPowerW").value)
              const distanceSensitivity = parseFloat(document.getElementById("distanceSensitivity").value)
              handleUpdateDeskConfig(selectedDesk.id, { lampPowerW, distanceSensitivity })
            }}
            disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  )
}
