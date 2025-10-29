import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react'
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom'
import ProfilePage from './pages/ProfilePage'
import SignInPage from './pages/SignInPage'
import SSOCallback from './pages/SSOCallback'
import OAuthLoginCallback from './pages/OAuthLoginCallback'

export default function App() {
  return (
    <BrowserRouter>
      <div>
        {/* 主要内容 */}
        <main style={{ minHeight: '100vh' }}>
          <Routes>
            <Route path="/sso-callback" element={<SSOCallback />} />
            <Route path="/oauth-callback" element={<OAuthLoginCallback />} />
            <Route path="/" element={
              <>
                <SignedOut>
                  <SignInPage />
                </SignedOut>
                <SignedIn>
                  {/* 已登录用户的导航栏 */}
                  <header style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 24px',
                    borderBottom: '1px solid #e5e7eb',
                    backgroundColor: 'white',
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}>
                        APP
                      </div>
                      <h1 style={{ fontSize: '18px', fontWeight: '600', color: '#1f2937', margin: 0 }}>
                        我的应用
                      </h1>
                      <nav style={{ display: 'flex', gap: '16px', marginLeft: '24px' }}>
                        <Link
                          to="/"
                          style={{
                            textDecoration: 'none',
                            color: '#1f2937',
                            fontSize: '14px',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            backgroundColor: '#f3f4f6'
                          }}
                        >
                          个人资料
                        </Link>
                        <Link
                          to="/oauth-callback"
                          style={{
                            textDecoration: 'none',
                            color: '#1f2937',
                            fontSize: '14px',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            backgroundColor: '#f3f4f6'
                          }}
                        >
                          OAuth 登录测试
                        </Link>
                      </nav>
                    </div>
                    <UserButton />
                  </header>

                  {/* 用户内容区域 */}
                  <div style={{ padding: '24px' }}>
                    <ProfilePage />
                  </div>
                </SignedIn>
              </>
            } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}
