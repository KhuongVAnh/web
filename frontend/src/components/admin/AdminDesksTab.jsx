import { Clock, Droplets, Lightbulb, Loader2, Settings, Thermometer, User } from "lucide-react"
import DeskConfigModal from "./DeskConfigModal"

export default function AdminDesksTab({
  rooms,
  selectedRoomId,
  setSelectedRoomId,
  selectedRoom,
  desksByRow,
  getUsageTime,
  handleToggleLight,
  togglingDesks,
  handlePrefillFromDesk,
  selectedDesk,
  setSelectedDesk,
  saving,
  handleUpdateDeskConfig,
}) {
  return (
    <div className="space-y-6">
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

      {selectedRoom && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Điều Khiển Bàn
              <span className="ml-1 text-gray-500 font-medium">
                - {selectedRoom.name}
              </span>
            </h3>

            <div className="flex gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-50 text-red-700 text-sm">
                <Thermometer className="w-4 h-4" />
                <span className="font-medium">
                  {selectedRoom.currentTemperature != null
                    ? `${selectedRoom.currentTemperature.toFixed(1)}°C`
                    : "--"}
                </span>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-sm">
                <Droplets className="w-4 h-4" />
                <span className="font-medium">
                  {selectedRoom.currentHumidity != null
                    ? `${selectedRoom.currentHumidity.toFixed(1)}%`
                    : "--"}
                </span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((rowNum) => (
              <div key={rowNum} className="bg-gray-50 border rounded-lg p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-700">Dãy {rowNum}</div>
                  <div className="text-xs text-gray-500">
                    {desksByRow[rowNum]?.length || 0} bàn
                  </div>
                </div>

                <div className="space-y-2">
                  {desksByRow[rowNum]?.length ? (
                    desksByRow[rowNum].map((desk) => {
                      const usageTime = getUsageTime(desk)
                      return (
                        <div
                          key={desk.id}
                          className={`p-3 rounded-lg border-2 transition ${desk.occupancyStatus
                            ? "bg-red-50 border-red-300"
                            : "bg-green-50 border-green-300"
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-700">
                              Bàn {desk.row}-{desk.position}
                            </span>
                            {desk.lightStatus && (
                              <Lightbulb className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            )}
                          </div>

                          {desk.occupancyStatus && (
                            <div className="flex items-center gap-1 text-xs text-red-700 mb-1">
                              <User className="w-3 h-3" />
                              <span>Đang dùng</span>
                            </div>
                          )}

                          {usageTime > 0 && (
                            <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                              <Clock className="w-3 h-3" />
                              <span>{usageTime} phút</span>
                            </div>
                          )}
                          {desk.disabled && (
                            <div className="text-xs text-amber-700 mb-2 font-semibold">
                              Đang vô hiệu hóa
                            </div>
                          )}

                          <div className="flex flex-wrap gap-1">
                            <button
                              onClick={() => handleToggleLight(desk.id)}
                              disabled={togglingDesks.has(desk.id)}
                              className={`flex-1 px-2 py-1 text-xs rounded transition flex items-center justify-center gap-1 ${togglingDesks.has(desk.id)
                                ? "bg-gray-400 text-gray-600 cursor-not-allowed opacity-75"
                                : desk.disabled
                                  ? "bg-green-100 text-green-800 hover:bg-green-200"
                                  : "bg-red-100 text-red-800 hover:bg-red-200"
                                }`}
                              title={desk.disabled ? "Kích hoạt bàn" : "Vô hiệu hóa bàn"}
                            >
                              {togglingDesks.has(desk.id) ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Đang xử lý...</span>
                                </>
                              ) : (
                                <span>{desk.disabled ? "Kích hoạt" : "Vô hiệu hóa"}</span>
                              )}
                            </button>
                            <button
                              onClick={() => handlePrefillFromDesk(desk, selectedRoom.roomNumber)}
                              className="px-2 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600 transition"
                              title="Chọn bàn này để gửi cấu hình ESP32"
                            >
                              ESP32
                            </button>
                            <button
                              onClick={() => setSelectedDesk(desk)}
                              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                              title="Cấu hình bàn"
                            >
                              <Settings className="w-3 h-3" />
                            </button>
                          </div>
                          {desk.esp32DeviceId && (
                            <div className="text-xs text-blue-600 mt-1 font-semibold"></div>
                          )}
                        </div>
                      )
                    })
                  ) : (
                    <div className="text-xs text-gray-500 border rounded-md px-3 py-2 bg-white">
                      Chưa có bàn trong dãy này
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <DeskConfigModal
        selectedDesk={selectedDesk}
        setSelectedDesk={setSelectedDesk}
        saving={saving}
        handleUpdateDeskConfig={handleUpdateDeskConfig}
      />
    </div>
  )
}
