# Clerk React + Golang 后端集成

这是一个使用 Clerk 进行身份验证的 React 前端应用，配合 Golang 后端进行登录验证。

## 🚀 快速开始

### 前端应用

```bash
npm install
npm run dev
```

应用运行在 `http://localhost:5174/`

## 📡 API 接口说明

前端会向 Golang 后端发送以下请求：

### `GET /profile` 验证用户登录

**请求头 Headers:**
```
Authorization: Bearer <clerk_jwt_token>
X-User-Info: <base64_encoded_user_info>
X-User-Info-Encoded: base64
Content-Type: application/json
```

**注意**: `X-User-Info` 头部使用 Base64 编码以避免中文字符编码问题。Golang 后端需要先解码：

```go
// Golang 后端解码示例
import "encoding/base64"
import "encoding/json"

// 获取编码的用户信息
encodedUserInfo := r.Header.Get("X-User-Info")

// Base64 解码
decodedBytes, err := base64.StdEncoding.DecodeString(encodedUserInfo)
if err != nil {
    http.Error(w, "无效的用户信息编码", http.StatusBadRequest)
    return
}

// 解析 JSON
var userInfo struct {
    ClerkUserId string `json:"clerkUserId"`
    Email       string `json:"email"`
    Name        string `json:"name"`
}
json.Unmarshal(decodedBytes, &userInfo)
```

**期望响应格式:**
```json
{
  "message": "登录验证成功",
  "user": {
    "id": "用户ID",
    "email": "用户邮箱",
    "name": "用户姓名"
  },
  "verified": true
}
```

## 🔧 Golang 后端实现要点

### 1. 验证 Clerk JWT Token

```go
// 使用 github.com/clerkinc/clerk-go
import "github.com/clerkinc/clerk-go/jwt"

func verifyClerkToken(tokenString string) (*jwt.Claims, error) {
    verifier, err := jwt.NewJWTVerifier("your_clerk_secret_key")
    if err != nil {
        return nil, err
    }

    claims, err := verifier.Verify(tokenString)
    return claims, err
}
```

### 2. 处理 /profile 请求

```go
func profileHandler(w http.ResponseWriter, r *http.Request) {
    // 1. 获取 Authorization header
    authHeader := r.Header.Get("Authorization")
    if !strings.HasPrefix(authHeader, "Bearer ") {
        http.Error(w, "未授权", http.StatusUnauthorized)
        return
    }

    token := strings.TrimPrefix(authHeader, "Bearer ")

    // 2. 验证 JWT
    claims, err := verifyClerkToken(token)
    if err != nil {
        http.Error(w, "无效的令牌", http.StatusUnauthorized)
        return
    }

    // 3. 获取用户信息
    userInfo := r.Header.Get("X-User-Info")

    // 4. 处理业务逻辑 (验证/创建用户等)

    // 5. 返回响应
    response := map[string]interface{}{
        "message": "登录验证成功",
        "user": map[string]string{
            "id":    claims.Subject,
            "email": // 从 userInfo 或 claims 中提取,
            "name":  // 从 userInfo 或 claims 中提取,
        },
        "verified": true,
    }

    json.NewEncoder(w).Encode(response)
}
```

## 🎯 前端功能

### 登录流程
1. 用户点击"登录"按钮
2. 跳转到 Clerk Google OAuth 页面
3. 登录成功后自动跳转回应用
4. 前端获取 Clerk JWT Token
5. 向 Golang 后端 `/profile` 发送验证请求
6. 显示验证结果

### 用户界面
- **未登录**: 显示登录按钮和欢迎信息
- **已登录**: 显示用户信息和后台验证状态
- **错误处理**: 详细的错误信息和调试提示

## 📝 环境配置

### 前端 `.env`
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_你的密钥
```

### Golang 后端需要配置
- Clerk JWT 验证密钥
- 数据库连接
- CORS 设置 (允许 `http://localhost:5174`)

## 🔧 Golang CORS 配置

**必需配置**: 你的 Golang 后端必须配置 CORS 来允许前端访问

### 方法 1: 使用 `github.com/rs/cors` 库 (推荐)

```go
import (
    "github.com/rs/cors"
    "net/http"
)

func main() {
    mux := http.NewServeMux()

    // 你的路由处理器
    mux.HandleFunc("/profile", profileHandler)

    // CORS 配置
    c := cors.New(cors.Options{
        AllowedOrigins: []string{"http://localhost:5174"}, // 允许前端域名
        AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
        AllowedHeaders: []string{
            "Content-Type",
            "Authorization",
            "X-User-Info",
            "X-User-Info-Encoded",
        },
        AllowCredentials: true,
        Debug: true, // 开发时可以开启调试
    })

    // 包装路由器
    handler := c.Handler(mux)

    log.Println("服务器启动在 :8080")
    log.Fatal(http.ListenAndServe(":8080", handler))
}
```

### 方法 2: 手动 CORS 中间件

```go
func corsMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // 设置 CORS 头部
        w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5174")
        w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Info, X-User-Info-Encoded")
        w.Header().Set("Access-Control-Allow-Credentials", "true")

        // 处理预检请求
        if r.Method == "OPTIONS" {
            w.WriteHeader(http.StatusOK)
            return
        }

        next.ServeHTTP(w, r)
    })
}

// 使用中间件
func main() {
    mux := http.NewServeMux()
    mux.HandleFunc("/profile", profileHandler)

    // 应用 CORS 中间件
    handler := corsMiddleware(mux)

    log.Println("服务器启动在 :8080")
    log.Fatal(http.ListenAndServe(":8080", handler))
}
```

### 安装依赖 (如果使用方法 1):

```bash
go get github.com/rs/cors
```

### 重要提示:
- **AllowedOrigins**: 必须包含 `http://localhost:5174`
- **AllowedHeaders**: 必须包含 `Authorization`, `X-User-Info`, `X-User-Info-Encoded`
- **预检请求**: 必须正确处理 OPTIONS 请求

## 🛠 调试信息

前端会显示详细的调试信息：
- 请求地址: `http://localhost:8080/profile`
- 认证方式: Bearer Token (Clerk JWT)
- 额外头部: X-User-Info
- 控制台日志输出

## 📱 测试流程

1. 确保 Golang 后端运行在 `localhost:8080`
2. 启动前端应用 `npm run dev`
3. 访问 `http://localhost:5174/`
4. 使用 Google 账号登录
5. 查看前端显示的验证结果

## 🔍 故障排除

### 常见问题：
- **CORS 错误**: 确保在 Golang 后端正确配置 CORS (见上方 CORS 配置部分)
  ```
  错误信息: Access to XMLHttpRequest blocked by CORS policy
  解决方案: 添加 Access-Control-Allow-Origin: http://localhost:5174
  ```
- **JWT 验证失败**: 检查 Clerk 密钥配置
- **连接被拒绝**: 确认 Golang 后端正在运行在正确端口
- **401 错误**: 检查 JWT token 格式和有效性
- **预检请求失败**: 确保正确处理 OPTIONS 请求

### 调试技巧：
- 查看浏览器控制台日志
- 检查 Golang 后端日志
- 使用浏览器开发者工具查看网络请求
- 验证 Clerk Dashboard 中的配置

## 项目结构

```
src/
├── api/
│   └── client.ts          # API 客户端配置
├── pages/
│   ├── SignInPage.tsx     # 登录页面
│   └── ProfilePage.tsx    # 用户信息和验证页面
├── App.tsx                # 主应用组件
├── main.tsx              # 应用入口和 Clerk 配置
└── .env                  # 环境变量
```

现在你的前端 React 应用已经准备好与 Golang 后端集成了！🎉
