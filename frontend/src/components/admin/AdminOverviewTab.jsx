import { Droplets, Thermometer } from "lucide-react"

export default function AdminOverviewTab({ stats, rooms }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Tổng Số Bàn</p>
          <p className="text-3xl font-bold text-gray-900">{stats.totalDesks}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Bàn Đang Dùng</p>
          <p className="text-3xl font-bold text-red-600">{stats.occupiedDesks}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Tỷ Lệ Chiếm Dụng</p>
          <p className="text-3xl font-bold text-blue-600">{stats.occupancyRate}%</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <p className="text-sm text-gray-600">Tổng Điện Năng</p>
          <p className="text-3xl font-bold text-green-600">{stats.totalEnergyWh} Wh</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Tổng Quan Phòng Học</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {rooms.map((room) => {
            const occupied = room.desks?.filter((d) => d.occupancyStatus).length || 0
            const total = room.desks?.length || 0
            const energy = room.desks?.reduce((sum, d) => sum + d.energyConsumedWh, 0) || 0
            return (
              <div
                key={room.id}
                className="border rounded-xl p-4 bg-white shadow-sm hover:shadow-md transition"
              >
                <h4 className="font-semibold text-gray-900 mb-3">{room.name}</h4>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Sử dụng</span>
                    <span className="font-semibold text-gray-900">
                      {occupied}/{total}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Năng lượng</span>
                    <span className="font-semibold text-gray-900">
                      {energy.toFixed(1)} Wh
                    </span>
                  </div>
                </div>

                <div className="h-px bg-gray-100 my-3" />

                <div className="flex gap-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm">
                    <Thermometer className="w-4 h-4" />
                    <span className="font-medium">
                      {room.currentTemperature != null
                        ? `${room.currentTemperature.toFixed(1)}°C`
                        : "--"}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm">
                    <Droplets className="w-4 h-4" />
                    <span className="font-medium">
                      {room.currentHumidity != null
                        ? `${room.currentHumidity.toFixed(1)}%`
                        : "--"}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
