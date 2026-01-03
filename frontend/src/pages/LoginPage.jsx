import { useState } from "react"
import { useNavigate } from "react-router-dom"
import axios from "axios"
import { AlertCircle } from "lucide-react"

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001/api"

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    try {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        username,
        password,
      })

      onLogin(response.data.token, response.data.user.role)
      navigate("/")
    } catch (err) {
      setError(err.response?.data?.message || "Đăng nhập thất bại")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">📚 Thư Viện</h1>
          <p className="text-blue-100">Hệ Thống quản lý bàn học thư viện</p>
        </div>

        <div className="bg-white rounded-lg shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Đăng Nhập</h2>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tài Khoản</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Nhập tài khoản"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Mật Khẩu</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 rounded-lg transition"
            >
              {loading ? "Đang xử lý..." : "Đăng Nhập"}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t">
            <p className="text-xs text-gray-600 font-semibold mb-3">Tài khoản Demo:</p>
            <div className="space-y-2">
              <div className="bg-blue-50 p-3 rounded text-sm">
                <p className="font-bold text-blue-900">Sinh Viên</p>
                <p className="text-blue-700">Tài khoản: user</p>
                <p className="text-blue-700">Mật khẩu: 12345678</p>
              </div>
              <div className="bg-purple-50 p-3 rounded text-sm">
                <p className="font-bold text-purple-900">Quản Trị Viên</p>
                <p className="text-purple-700">Tài khoản: admin</p>
                <p className="text-purple-700">Mật khẩu: 12345678</p>
              </div>
            </div>
          </div>
        </div>

        {/* <p className="text-center text-blue-100 text-xs mt-6">Hệ Thống quản lý bàn học thư viện Thư Viện v1.0</p> */}
      </div>
    </div>
  )
}

