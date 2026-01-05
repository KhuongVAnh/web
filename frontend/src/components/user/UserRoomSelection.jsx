import { Droplets, Thermometer } from "lucide-react"

export default function UserRoomSelection({ rooms, selectedRoomId, setSelectedRoomId }) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Chọn Phòng</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {rooms.map((room) => {
          const roomOccupied = room.desks?.filter((d) => d.occupancyStatus).length || 0
          const roomTotal = room.desks?.length || 0
          return (
            <button
              key={room.id}
              onClick={() => setSelectedRoomId(room.id)}
              className={`text-left p-4 rounded-xl border transition flex flex-col gap-2 ${selectedRoomId === room.id
                ? "border-blue-500 bg-blue-50 shadow-md"
                : "border-gray-200 bg-gray-50 hover:bg-gray-100"
                }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-gray-900">{room.name}</div>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${selectedRoomId === room.id ? "bg-white text-blue-700" : "bg-gray-200 text-gray-700"
                    }`}
                >
                  {roomOccupied}/{roomTotal} bàn
                </span>
              </div>

              <div className="flex items-center justify-between text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Thermometer className="w-4 h-4 text-red-500" />
                  <span>{room.currentTemperature != null ? `${room.currentTemperature.toFixed(1)}°C` : "--°C"}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Droplets className="w-4 h-4 text-blue-500" />
                  <span>{room.currentHumidity != null ? `${room.currentHumidity.toFixed(1)}%` : "--%"}</span>
                </div>
              </div>

              <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 via-amber-400 to-red-500"
                  style={{ width: `${Math.min(Math.max((room.currentTemperature ?? 0) * 2, 0), 100)}%` }}
                />
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
