import { useAuth, useUser } from '@clerk/clerk-react'
import { useEffect, useState } from 'react'
import apiClient from '../api/client'

interface OAuthLoginResponse {
  [key: string]: unknown
}

export default function OAuthLoginCallback() {
  const { user } = useUser()
  const { getToken } = useAuth()
  const [responseData, setResponseData] = useState<OAuthLoginResponse | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')
  const [debugToken, setDebugToken] = useState<string>('')
  const [requestStatus, setRequestStatus] = useState<string>('准备中...')

  useEffect(() => {
    const handleOAuthLogin = async () => {
      try {
        setRequestStatus('正在获取 Clerk Token...')
        setLoading(true)
        setError('')

        // 获取 Clerk JWT token
        const token = await getToken()

        if (!token) {
          setError('无法获取认证令牌')
          return
        }

        console.log('正在调用 OAuth 登录接口...')
        console.log('🔑 调试信息 - Clerk JWT Token:')
        console.log('--------------------------------------------------')
        console.log(token)
        console.log('--------------------------------------------------')

        // 保存 token 用于页面显示
        setDebugToken(token)

        setRequestStatus('正在调用 /api/v1/auth/users/oauth-login 接口...')

        // 调用 OAuth 登录接口，将 token 放在 body 的 auth_token 字段
        const response = await apiClient.post('/api/v1/auth/users/oauth-login', {
          auth_token: token,
          // 也可以传递额外的用户信息（可选）
          user_info: {
            clerkUserId: user?.id,
            email: user?.primaryEmailAddress?.emailAddress,
            name: user?.fullName || '',
            username: user?.username || ''
          }
        })

        setResponseData(response.data)
        setRequestStatus('OAuth 登录成功完成！')
        console.log('OAuth 登录成功:', response.data)

      } catch (err: unknown) {
        console.error('OAuth 登录失败:', err)
        setRequestStatus('OAuth 登录失败')

        // 类型守卫来处理不同的错误类型
        if (err && typeof err === 'object' && 'response' in err) {
          const axiosError = err as { response?: { status?: number, data?: unknown } }
          if (axiosError.response?.status === 401) {
            setError('认证失败，请重新登录')
          } else if (axiosError.response?.status === 403) {
            setError('权限不足')
          } else {
            setError(`请求失败 (${axiosError.response?.status}): ${JSON.stringify(axiosError.response?.data) || '未知错误'}`)
          }
        } else if (err && typeof err === 'object' && 'code' in err) {
          const connectionError = err as { code?: string }
          if (connectionError.code === 'ECONNREFUSED') {
            setError('无法连接到后台服务器 (localhost:8080)')
          } else {
            setError(`连接错误: ${connectionError.code || '未知连接错误'}`)
          }
        } else if (err instanceof Error) {
          setError(`请求失败: ${err.message}`)
        } else {
          setError('OAuth 登录失败: 未知错误')
        }
      } finally {
        setLoading(false)
      }
    }

    handleOAuthLogin()
  }, [user, getToken])

  return (
    <div style={{ padding: 20 }}>
      <h2>OAuth 登录回调处理</h2>

      {/* 用户信息展示 */}
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
        <h3>当前用户信息：</h3>
        <p><strong>用户ID:</strong> {user?.id}</p>
        <p><strong>邮箱:</strong> {user?.primaryEmailAddress?.emailAddress}</p>
        <p><strong>姓名:</strong> {user?.fullName || '未设置'}</p>
        <p><strong>用户名:</strong> {user?.username || '未设置'}</p>
      </div>

      {/* 请求状态 */}
      <div style={{ marginBottom: '20px', padding: '10px', backgroundColor: '#e7f3ff', borderRadius: '5px' }}>
        <h3>请求状态：</h3>
        <p><strong>状态:</strong> {requestStatus}</p>
        {loading && <p>⏳ 正在处理 OAuth 登录...</p>}
      </div>

      {/* 错误信息展示 */}
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

      {/* 成功响应展示 */}
      {responseData && (
        <div style={{
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          color: '#155724',
          padding: '10px',
          borderRadius: '5px',
          marginBottom: '20px'
        }}>
          <h3>✅ OAuth 登录成功</h3>
          <p><strong>API 响应数据：</strong></p>
          <pre style={{
            backgroundColor: '#f8f9fa',
            padding: '10px',
            borderRadius: '3px',
            fontSize: '12px',
            overflow: 'auto',
            maxHeight: '300px',
            border: '1px solid #dee2e6'
          }}>
            {JSON.stringify(responseData, null, 2)}
          </pre>
        </div>
      )}

      {/* 调试信息 */}
      <div style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
        <h3>调试信息:</h3>
        <p>• 请求接口: POST http://localhost:8080/api/v1/auth/users/oauth-login</p>
        <p>• 请求体: {"{ auth_token: '<Clerk JWT Token>', user_info: {...} }"}</p>
        <p>• Content-Type: application/json</p>
        <p>• 认证方式: 将 Clerk JWT Token 放在 body 的 auth_token 字段</p>

        {/* Token 展开区域 */}
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

        {/* 完整请求数据 */}
        {debugToken && (
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer', color: '#007bff' }}>查看完整请求数据 (点击展开)</summary>
            <div style={{ marginTop: '10px' }}>
              <p><strong>请求 URL:</strong> POST http://localhost:8080/api/v1/auth/users/oauth-login</p>
              <p><strong>请求 Headers:</strong></p>
              <pre style={{
                backgroundColor: '#f8f9fa',
                padding: '10px',
                borderRadius: '3px',
                fontSize: '12px',
                overflow: 'auto',
                marginBottom: '10px'
              }}>
                {JSON.stringify({
                  'Content-Type': 'application/json',
                  'Accept': 'application/json'
                }, null, 2)}
              </pre>
              <p><strong>请求 Body:</strong></p>
              <pre style={{
                backgroundColor: '#f8f9fa',
                padding: '10px',
                borderRadius: '3px',
                fontSize: '12px',
                overflow: 'auto'
              }}>
                {JSON.stringify({
                  auth_token: debugToken.substring(0, 50) + '...' + debugToken.substring(debugToken.length - 20),
                  user_info: {
                    clerkUserId: user?.id,
                    email: user?.primaryEmailAddress?.emailAddress,
                    name: user?.fullName || '',
                    username: user?.username || ''
                  }
                }, null, 2)}
              </pre>
            </div>
          </details>
        )}
      </div>

      {/* 操作按钮 */}
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={() => window.history.back()}
          style={{
            marginRight: '10px',
            padding: '8px 16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          返回上页
        </button>
        <button
          onClick={() => window.location.href = '/'}
          style={{
            padding: '8px 16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          返回首页
        </button>
      </div>
    </div>
  )
}