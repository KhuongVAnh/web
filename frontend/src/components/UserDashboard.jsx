import { useState, useEffect } from "react"
import axios from "axios"
import { Droplets, Thermometer, Users, Lightbulb, Clock, User } from "lucide-react"

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api"

export default function UserDashboard() {
  const [rooms, setRooms] = useState([])
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const response = await axios.get(`${API_BASE}/rooms`)
        setRooms(response.data)
        if (response.data.length > 0 && !selectedRoomId) {
          setSelectedRoomId(response.data[0].id)
        }
      } catch (error) {
        console.error("Lỗi tải phòng:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchRooms()
    const interval = setInterval(fetchRooms, 5000) // Update every 5 seconds
    return () => clearInterval(interval)
  }, [selectedRoomId])

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    )
  }

  const occupiedCount = selectedRoom?.desks?.filter((d) => d.occupancyStatus).length || 0
  const totalDesks = selectedRoom?.desks?.length || 0

  // Organize desks by row
  const organizeDesksByRow = (desks) => {
    const rows = {}
    desks?.forEach((desk) => {
      if (!rows[desk.row]) {
        rows[desk.row] = []
      }
      rows[desk.row].push(desk)
    })
    Object.keys(rows).forEach((row) => {
      rows[row].sort((a, b) => a.position - b.position)
    })
    return rows
  }

  const desksByRow = organizeDesksByRow(selectedRoom?.desks || [])

  // Calculate usage time for occupied desks
  const getUsageTime = (desk) => {
    if (!desk.occupancyStatus || !desk.occupancyStartTime) return 0
    const startTime = new Date(desk.occupancyStartTime)
    const now = new Date()
    return Math.floor((now - startTime) / 60000) // minutes
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Tình Trạng Phòng Học</h2>
      </div>

      {/* Stats Cards */}
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
            <h3 className="text-sm font-medium text-gray-700">Bàn Đã Dùng</h3>
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

      {/* Room Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Chọn Phòng</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {rooms.map((room) => {
            const roomOccupied = room.desks?.filter((d) => d.occupancyStatus).length || 0
            const roomTotal = room.desks?.length || 0
            return (
              <button
                key={room.id}
                onClick={() => setSelectedRoomId(room.id)}
                className={`p-3 rounded-lg transition ${
                  selectedRoomId === room.id
                    ? "bg-blue-600 text-white shadow-md"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                }`}
              >
                <div className="font-semibold">{room.name}</div>
                <div className="text-xs mt-1">
                  {roomOccupied}/{roomTotal} bàn
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Desk Layout */}
      {selectedRoom && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">Sơ Đồ Bàn Học - {selectedRoom.name}</h3>
            <div className="text-sm text-gray-600">
              {selectedRoom.currentTemperature?.toFixed(1)}°C / {selectedRoom.currentHumidity?.toFixed(1)}%
            </div>
          </div>

          {/* Desk Grid: 4 rows x 5 tables */}
          <div className="space-y-3">
            {[1, 2, 3, 4].map((rowNum) => (
              <div key={rowNum} className="flex items-center gap-2">
                <div className="w-12 text-sm font-medium text-gray-600">Dãy {rowNum}</div>
                <div className="flex-1 grid grid-cols-5 gap-2">
                  {desksByRow[rowNum]?.map((desk) => {
                    const usageTime = getUsageTime(desk)
                    return (
                      <div
                        key={desk.id}
                        className={`p-3 rounded-lg border-2 transition ${
                          desk.occupancyStatus
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
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
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
      )}
    </div>
  )
}

