package main

import (
	"encoding/base64"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/clerkinc/clerk-sdk-go/clerk"
)

// 安全地获取 Authorization 头，支持编码格式
func getAuthHeaderSafe(r *http.Request) string {
	// 首先尝试直接获取
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		return authHeader
	}

	// 尝试获取编码版本
	encodedAuth := r.Header.Get("Authorization-Encoded")
	if encodedAuth != "" {
		decoded, err := base64.StdEncoding.DecodeString(encodedAuth)
		if err == nil {
			log.Printf("Successfully decoded encoded Authorization header")
			return string(decoded)
		}
		log.Printf("Failed to decode encoded Authorization header: %v", err)
	}

	return ""
}

// CORS 中间件处理跨域请求
func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// 处理预检请求（在认证之前）
		if r.Method == "OPTIONS" {
			// 允许的来源列表（开发环境）
			allowedOrigins := []string{
				"http://localhost:5174",
				"http://localhost:3000",
				"http://localhost:8080",
				"http://127.0.0.1:5174",
				"http://127.0.0.1:3000",
				"http://localhost:5173",
				"http://127.0.0.1:8080",
			}

			// 检查来源是否被允许
			isAllowed := false
			for _, allowedOrigin := range allowedOrigins {
				if origin == allowedOrigin {
					isAllowed = true
					break
				}
			}

			if isAllowed || origin == "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
				w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-User-Info, X-User-Info-Encoded, X-User-Info-Encoded-Type, X-Requested-With")
				w.Header().Set("Access-Control-Allow-Credentials", "true")
				w.Header().Set("Access-Control-Max-Age", "86400") // 24小时
				w.WriteHeader(http.StatusOK)
			} else {
				w.WriteHeader(http.StatusForbidden)
			}
			return
		}

		// 对于实际请求，设置 CORS 头部
		allowedOrigins := []string{
			"http://localhost:5174",
			"http://localhost:3000",
			"http://localhost:8080",
			"http://127.0.0.1:5174",
			"http://127.0.0.1:3000",
			"http://localhost:5173",
			"http://127.0.0.1:8080",
		}

		isAllowed := false
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				isAllowed = true
				break
			}
		}

		if isAllowed || origin == "" {
			if origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			} else {
				w.Header().Set("Access-Control-Allow-Origin", "*")
			}
			w.Header().Set("Access-Control-Allow-Credentials", "true")
		}

		next.ServeHTTP(w, r)
	})
}

func ClerkAuthMiddleware(next http.Handler, client clerk.Client) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		log.Printf("=== Clerk Auth Middleware ===")
		log.Printf("Request path: %s %s", r.Method, r.URL.Path)
		log.Printf("Remote Address: %s", r.RemoteAddr)
		log.Printf("User-Agent: %s", r.UserAgent())

		authHeader := getAuthHeaderSafe(r)
		if authHeader == "" {
			log.Printf("Authentication failed: Missing Authorization header")
			log.Printf("Available headers: %v", r.Header)
			http.Error(w, "Missing Authorization header", http.StatusUnauthorized)
			return
		}

		log.Printf("Authorization header found (length: %d)， authorization:%s", len(authHeader), authHeader)

		token := strings.TrimPrefix(authHeader, "Bearer ")
		if len(token) < len(authHeader) {
			log.Printf("Token extracted successfully (length: %d)", len(token))
		} else {
			log.Printf("Warning: Authorization header doesn't start with 'Bearer '")
		}

		// 使用时钟容差验证 token，防止因时间同步问题导致的验证失败
		claims, err := client.VerifyToken(token, clerk.WithLeeway(30*time.Second))
		if err != nil {
			log.Printf("Token verification failed: %v", err)

			// 如果是时间相关的错误，提供更详细的错误信息
			if strings.Contains(err.Error(), "future") || strings.Contains(err.Error(), "expired") {
				log.Printf("Time-related validation error. This might be due to clock skew.")
				log.Printf("Current server time: %s", time.Now().Format(time.RFC3339))
				http.Error(w, "Token time validation failed: "+err.Error(), http.StatusUnauthorized)
			} else {
				http.Error(w, "Invalid token: "+err.Error(), http.StatusUnauthorized)
			}
			return
		}

		// user, err := client.Users().Read(claims.Subject)
		// if err != nil {
		// 	log.Printf("Failed to fetch user: %v", err)
		// 	http.Error(w, "User not found", http.StatusUnauthorized)
		// 	return
		// }
		// log.Printf("User fetched successfully: %+v", user)
		log.Printf("Token verified successfully. User ID: %s", claims.Subject)

		// 你可以在这里把 userID 注入 context
		r.Header.Set("X-Clerk-User-Id", claims.Subject)
		next.ServeHTTP(w, r)
	})
}
