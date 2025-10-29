import { useUser } from '@clerk/clerk-react'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function SSOCallback() {
  const { isLoaded, isSignedIn } = useUser()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoaded) {
      if (isSignedIn) {
        // 登录成功，重定向到主页
        navigate('/')
      } else {
        // 登录失败，重定向到登录页
        navigate('/?error=login_failed')
      }
    }
  }, [isLoaded, isSignedIn, navigate])

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{
        background: 'white',
        padding: '40px',
        borderRadius: '12px',
        textAlign: 'center'
      }}>
        <h2>正在完成登录...</h2>
        <p>请稍候，正在处理您的登录信息</p>
      </div>
    </div>
  )
}