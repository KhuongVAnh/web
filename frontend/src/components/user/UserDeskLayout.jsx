import { Clock, Droplets, Lightbulb, Thermometer, User } from "lucide-react"

export default function UserDeskLayout({ selectedRoom, desksByRow, getUsageTime }) {
  if (!selectedRoom) {
    return null
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-900">Sơ Đồ Bàn Học - {selectedRoom.name}</h3>
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

                      {desk.occupancyStatus ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1 text-xs text-red-700">
                            <User className="w-3 h-3" />
                            <span>Đang sử dụng</span>
                          </div>
                          {usageTime > 0 && (
                            <div className="flex items-center gap-1 text-xs text-gray-600">
                              <Clock className="w-3 h-3" />
                              <span>{usageTime} phút</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-green-700">Trống</div>
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

      <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 text-xs text-gray-600">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-green-50 border-2 border-green-300 rounded"></div>
          <span>Bàn trống</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-50 border-2 border-red-300 rounded"></div>
          <span>Bàn đang sử dụng</span>
        </div>
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-yellow-500 fill-yellow-500" />
          <span>Đèn bật</span>
        </div>
      </div>
    </div>
  )
}
