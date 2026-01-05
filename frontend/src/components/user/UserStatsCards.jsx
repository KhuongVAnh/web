import { Droplets, Thermometer, Users } from "lucide-react"

export default function UserStatsCards({ selectedRoom, occupiedCount, totalDesks }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Nhiệt Độ</h3>
          <Thermometer className="w-5 h-5 text-red-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">
          {selectedRoom?.currentTemperature?.toFixed(1) || "22.0"}°C
        </p>
        <p className="text-xs text-gray-600 mt-1">Điều kiện phòng</p>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Độ Ẩm</h3>
          <Droplets className="w-5 h-5 text-blue-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">
          {selectedRoom?.currentHumidity?.toFixed(1) || "60.0"}%
        </p>
        <p className="text-xs text-gray-600 mt-1">Độ ẩm không khí</p>
      </div>

      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">Bàn Đang Dùng</h3>
          <Users className="w-5 h-5 text-green-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">
          {occupiedCount}/{totalDesks}
        </p>
        <p className="text-xs text-gray-600 mt-1">
          {totalDesks > 0 ? `${((occupiedCount / totalDesks) * 100).toFixed(0)}% chiếm dụng` : "Không có bàn"}
        </p>
      </div>
    </div>
  )
}
