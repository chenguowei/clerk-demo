import { useAuth, useUser } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import apiClient from '../api/client'

interface BackendUser {
  id: string
  username: string
  email: string[] | string | undefined | null
  firstName: string
  lastName: string
  imageUrl: string
  createdAt: string
  updatedAt: string
}

export default function ProfilePage() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const [backendUser, setBackendUser] = useState<BackendUser | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [debugToken, setDebugToken] = useState<string>('')

  useEffect(() => {
    const verifyLoginWithBackend = async () => {
      try {
        setLoading(true)
        setError('')

        // 获取 Clerk JWT token
        const token = await getToken()

        if (!token) {
          setError('无法获取认证令牌')
          return
        }

        console.log('正在向后台发送验证请求...')
        console.log('🔑 调试信息 - Clerk JWT Token:')
        console.log('--------------------------------------------------')
        console.log(token)
        console.log('--------------------------------------------------')
        console.log('📋 复制上面的 token 用于后端调试验证')

        // 保存 token 用于页面显示
        setDebugToken(token)

        // 发送请求到后台验证登录
        const userInfo = {
          clerkUserId: user?.id,
          email: user?.primaryEmailAddress?.emailAddress,
          name: user?.fullName || ''
        }

        // 将用户信息进行 Base64 编码以避免中文字符编码问题
        const encodedUserInfo = btoa(unescape(encodeURIComponent(JSON.stringify(userInfo))))

        const res = await apiClient.get('/profile', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-User-Info': encodedUserInfo,
            'X-User-Info-Encoded': 'base64' // 标记编码方式
          },
        })

        setBackendUser(res.data)
        console.log('后台验证成功:', res.data)

      } catch (err: unknown) {
        console.error('后台验证失败:', err)

        // 类型守卫来处理不同的错误类型
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosError = err as { response?: { status?: number, data?: { message?: string } } }
          if (axiosError.response?.status === 401) {
            setError('登录验证失败，请重新登录')
          } else if (axiosError.response?.status === 403) {
            setError('权限不足')
          } else {
            setError(`验证失败: ${axiosError.response?.data?.message || '未知错误'}`)
          }
        } else if (err && typeof err === 'object' && 'code' in err) {
          const connectionError = err as { code?: string }
          if (connectionError.code === 'ECONNREFUSED') {
            setError('无法连接到后台服务器 (localhost:8080)')
          } else {
            setError(`连接错误: ${connectionError.code || '未知连接错误'}`)
          }
        } else if (err instanceof Error) {
          setError(`验证失败: ${err.message}`)
        } else {
          setError('验证失败: 未知错误')
        }
      } finally {
        setLoading(false)
      }
    }

    verifyLoginWithBackend()
  }, [user, getToken])

  return (
    <div style={{ padding: 20 }}>
      <h3>当前用户信息：</h3>
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
        <p><strong>用户ID:</strong> {user?.id}</p>
        <p><strong>邮箱:</strong> {user?.primaryEmailAddress?.emailAddress}</p>
        <p><strong>姓名:</strong> {user?.fullName || '未设置'}</p>
        <p><strong>用户名:</strong> {user?.username || '未设置'}</p>
      </div>

      <h3>后台验证状态：</h3>
      {loading && <p>⏳ 正在验证登录...</p>}

      {error && (
        <div style={{
          color: '#dc3545',
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          padding: '10px',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          ❌ {error}
        </div>
      )}

      {backendUser && (
        <div style={{
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          color: '#155724',
          padding: '10px',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          <h4>✅ 后台验证成功</h4>
          <div style={{ display: 'grid', gap: '10px' }}>
            <p><strong>后台用户ID:</strong> {backendUser.id || '未设置'}</p>
            <p><strong>用户名:</strong> {backendUser.username || '未设置'}</p>
            <p><strong>邮箱列表:</strong> {
              Array.isArray(backendUser.email)
                ? backendUser.email.join(', ')
                : backendUser.email || '未设置'
            }</p>
            <p><strong>姓名:</strong> {backendUser.firstName || ''} {backendUser.lastName || ''}</p>
            <p><strong>头像:</strong></p>
            {backendUser.imageUrl && (
              <img
                src={backendUser.imageUrl}
                alt="用户头像"
                style={{
                  width: '50px',
                  height: '50px',
                  borderRadius: '50%',
                  objectFit: 'cover'
                }}
              />
            )}
            <p><strong>创建时间:</strong> {
              backendUser.createdAt
                ? new Date(backendUser.createdAt).toLocaleString()
                : '未设置'
            }</p>
            <p><strong>更新时间:</strong> {
              backendUser.updatedAt
                ? new Date(backendUser.updatedAt).toLocaleString()
                : '未设置'
            }</p>
          </div>
        </div>
      )}

      <div style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
        <h4>调试信息:</h4>
        <p>• 后台API地址: http://localhost:8080/profile</p>
        <p>• 请求方法: GET</p>
        <p>• 认证方式: Bearer Token (Clerk JWT)</p>
        <p>• X-User-Info: Base64 编码的用户信息 (避免中文字符编码问题)</p>
        <p>• X-User-Info-Encoded: base64 (编码方式标记)</p>
        <p>• 后端数据格式: 用户对象 (包含 id, username, email[], firstName, lastName, imageUrl, createdAt, updatedAt)</p>

        {debugToken && (
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', color: '#dc3545' }}>🔑 调试 Token (点击展开)</summary>
            <div style={{ marginTop: '10px' }}>
              <p style={{ color: '#dc3545', fontSize: '12px', marginBottom: '5px' }}>
                ⚠️ 复制下面的 JWT Token 用于后端调试验证:
              </p>
              <div style={{
                backgroundColor: '#f8d7da',
                border: '1px solid #f5c6cb',
                padding: '10px',
                borderRadius: '3px',
                fontSize: '10px',
                wordBreak: 'break-all',
                maxHeight: '150px',
                overflow: 'auto'
              }}>
                {debugToken}
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(debugToken)}
                style={{
                  marginTop: '5px',
                  padding: '5px 10px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                📋 复制 Token
              </button>
            </div>
          </details>
        )}

        {backendUser && (
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', color: '#007bff' }}>查看完整的后端响应数据</summary>
            <pre style={{
              backgroundColor: '#f8f9fa',
              padding: '10px',
              borderRadius: '3px',
              fontSize: '12px',
              overflow: 'auto',
              marginTop: '10px'
            }}>
              {JSON.stringify(backendUser, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}
