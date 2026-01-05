import { Save, Settings } from "lucide-react"

export default function AdminConfigTab({
  esp32Config,
  setEsp32Config,
  handleUpdateESP32Config,
  saving,
}) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Cấu Hình ESP32
        </h3>

        <div className="space-y-4">
          <div className="border-t pt-4">
            <h4 className="text-md font-semibold text-gray-800 mb-3">Vị trí ESP32</h4>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phòng (Room)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={esp32Config.room || ""}
                  onChange={(e) => setEsp32Config({ ...esp32Config, room: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="1-5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dãy (Row)</label>
                <input
                  type="number"
                  min="1"
                  max="4"
                  value={esp32Config.row || ""}
                  onChange={(e) => setEsp32Config({ ...esp32Config, row: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="1-4"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bàn (Table)</label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={esp32Config.table || ""}
                  onChange={(e) => setEsp32Config({ ...esp32Config, table: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="1-5"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Device ID (tùy chọn)</label>
                <input
                  type="text"
                  value={esp32Config.deviceId || ""}
                  onChange={(e) => setEsp32Config({ ...esp32Config, deviceId: e.target.value || null })}
                  className="w-full px-3 py-2 border rounded-lg"
                  placeholder="ESP32-xxx"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Cấu hình vị trí hiện tại của ESP32 (topic: esp32/abc/config). Có thể để trống nếu chỉ cập nhật thông số khác.
            </p>
          </div>
          <div className="border-t pt-4">
            <h4 className="text-md font-semibold text-gray-800 mb-3">Cấu Hình Thiết Bị</h4>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tần số lấy mẫu HC-SR04 (fs1)
              </label>
              <input
                type="number"
                value={esp32Config.fs1}
                onChange={(e) => setEsp32Config({ ...esp32Config, fs1: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tần số lấy mẫu BH1750 (fs2)
              </label>
              <input
                type="number"
                value={esp32Config.fs2}
                onChange={(e) => setEsp32Config({ ...esp32Config, fs2: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tần số lấy mẫu DHT (fs3)
              </label>
              <input
                type="number"
                value={esp32Config.fs3}
                onChange={(e) => setEsp32Config({ ...esp32Config, fs3: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Ngưỡng phát hiện người (cm)
              </label>
              <input
                type="number"
                step="0.1"
                value={esp32Config.distanceCm}
                onChange={(e) => setEsp32Config({ ...esp32Config, distanceCm: parseFloat(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                Bật đèn: &gt; 2000, Tắt đèn: 0
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chu kỳ gửi dữ liệu (ms)
              </label>
              <input
                type="number"
                value={esp32Config.duration}
                onChange={(e) => setEsp32Config({ ...esp32Config, duration: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <button
            onClick={handleUpdateESP32Config}
            disabled={saving}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Đang lưu..." : "Lưu Cấu Hình"}
          </button>
        </div>
      </div>
    </div>
  )
}
