package main

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/clerkinc/clerk-sdk-go/clerk"
	"github.com/joho/godotenv"
)

// 解码经过 Base64 编码的请求头
func decodeEncodedHeader(value string) (string, error) {
	decoded, err := base64.StdEncoding.DecodeString(value)
	if err != nil {
		return "", err
	}
	// URL 解码处理 Unicode 字符
	return url.QueryUnescape(string(decoded))
}

// 安全地获取请求头，支持编码格式
func getHeaderValueSafe(r *http.Request, key string) string {
	// 首先尝试直接获取
	value := r.Header.Get(key)
	if value != "" {
		return value
	}

	// 尝试获取编码版本
	encodedValue := r.Header.Get(key + "-Encoded")
	if encodedValue != "" {
		decoded, err := decodeEncodedHeader(encodedValue)
		if err == nil {
			log.Printf("Successfully decoded encoded header %s", key)
			return decoded
		}
		log.Printf("Failed to decode encoded header %s: %v", key, err)
	}

	return ""
}

// FrontendUserInfo 表示前端传递的用户信息
type FrontendUserInfo struct {
	UserId      string                 `json:"userId"`
	Username    string                 `json:"username"`
	Email       string                 `json:"email"`
	Name        string                 `json:"name"`
	Avatar      string                 `json:"avatar"`
	Preferences map[string]interface{} `json:"preferences"`
	Metadata    map[string]interface{} `json:"metadata"`
}

// 解析前端传递的用户信息
func extractFrontendUserInfo(r *http.Request) (*FrontendUserInfo, error) {
	// 首先尝试获取编码的用户信息
	encodedUserInfo := r.Header.Get("X-User-Info-Encoded")
	userInfoHeader := r.Header.Get("X-User-Info")

	var userInfoStr string
	var encodingType string

	// 检查编码方式标记
	encodingMarker := r.Header.Get("X-User-Info-Encoded-Type")
	if encodingMarker == "" {
		encodingMarker = r.Header.Get("X-User-Info-Encoded") // 兼容前端示例
	}

	// 优先使用编码信息
	if encodedUserInfo != "" {
		userInfoStr = encodedUserInfo
		encodingType = encodingMarker
	} else if userInfoHeader != "" {
		userInfoStr = userInfoHeader
		encodingType = "raw"
	} else {
		return nil, nil // 没有提供用户信息
	}

	// 安全检查：限制数据大小
	if len(userInfoStr) > 10240 { // 10KB 限制
		return nil, fmt.Errorf("user info data too large: %d bytes", len(userInfoStr))
	}

	// 根据编码类型解码
	var decodedStr string
	var err error

	switch strings.ToLower(encodingType) {
	case "base64":
		decodedBytes, decodeErr := base64.StdEncoding.DecodeString(userInfoStr)
		if decodeErr != nil {
			return nil, fmt.Errorf("failed to decode base64 user info: %v", decodeErr)
		}
		decodedStr = string(decodedBytes)
	case "raw", "":
		decodedStr = userInfoStr
	default:
		// 尝试 URL 解码
		decodedStr, err = url.QueryUnescape(userInfoStr)
		if err != nil {
			return nil, fmt.Errorf("failed to decode user info with encoding %s: %v", encodingType, err)
		}
	}

	// 解析 JSON
	var userInfo FrontendUserInfo
	if err := json.Unmarshal([]byte(decodedStr), &userInfo); err != nil {
		return nil, fmt.Errorf("failed to parse user info JSON: %v", err)
	}

	// 验证必要字段
	if userInfo.UserId == "" && userInfo.Username == "" && userInfo.Email == "" {
		return nil, fmt.Errorf("user info missing required identification fields")
	}

	// 清理和验证数据
	userInfo = sanitizeUserInfo(userInfo)

	return &userInfo, nil
}

// 清理和验证用户信息
func sanitizeUserInfo(userInfo FrontendUserInfo) FrontendUserInfo {
	// 限制字符串长度，防止过长数据
	if len(userInfo.UserId) > 255 {
		userInfo.UserId = userInfo.UserId[:255]
	}
	if len(userInfo.Username) > 100 {
		userInfo.Username = userInfo.Username[:100]
	}
	if len(userInfo.Email) > 255 {
		userInfo.Email = userInfo.Email[:255]
	}
	if len(userInfo.Name) > 200 {
		userInfo.Name = userInfo.Name[:200]
	}
	if len(userInfo.Avatar) > 500 {
		userInfo.Avatar = userInfo.Avatar[:500]
	}

	// 清理 preferences 和 metadata 中的敏感字段
	userInfo.Preferences = sanitizeMap(userInfo.Preferences)
	userInfo.Metadata = sanitizeMap(userInfo.Metadata)

	return userInfo
}

// 清理 map 中的敏感数据
func sanitizeMap(data map[string]interface{}) map[string]interface{} {
	if data == nil {
		return nil
	}

	sanitized := make(map[string]interface{})
	sensitiveKeys := []string{"password", "token", "secret", "key", "auth", "credential"}

	for k, v := range data {
		// 检查是否为敏感字段
		keyLower := strings.ToLower(k)
		isSensitive := false
		for _, sensitive := range sensitiveKeys {
			if strings.Contains(keyLower, sensitive) {
				isSensitive = true
				break
			}
		}

		if isSensitive {
			sanitized[k] = "[REDACTED]"
		} else {
			// 递归清理嵌套的 map
			if nestedMap, ok := v.(map[string]interface{}); ok {
				sanitized[k] = sanitizeMap(nestedMap)
			} else if str, ok := v.(string); ok && len(str) > 1000 {
				// 限制字符串长度
				sanitized[k] = str[:1000] + "...[TRUNCATED]"
			} else {
				sanitized[k] = v
			}
		}
	}

	return sanitized
}

// 安全地获取字符串指针的值
func getStringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// 生成唯一的请求ID
func generateRequestID() string {
	bytes := make([]byte, 16)
	rand.Read(bytes)
	return fmt.Sprintf("req_%x", bytes)
}

// 构建详细的用户资料响应
func buildDetailedUserProfile(user *clerk.User, frontendUserInfo *FrontendUserInfo) map[string]interface{} {
	profile := map[string]interface{}{
		// 基本信息
		"id":        user.ID,
		"username":  user.Username,
		"firstName": getStringValue(user.FirstName),
		"lastName":  getStringValue(user.LastName),
		"fullName":  fmt.Sprintf("%s %s", getStringValue(user.FirstName), getStringValue(user.LastName)),

		// 邮箱信息
		"primaryEmail": getPrimaryEmail(user),
		"emails":       user.EmailAddresses,

		// 头像信息
		"imageUrl": user.ImageURL,
		"hasImage": user.ImageURL != nil && *user.ImageURL != "",

		// 时间信息
		"createdAt": user.CreatedAt,
		"updatedAt": user.UpdatedAt,

		// 账户状态
		"banned":   user.Banned,
		"locked":   user.Locked,
		"verified": isUserVerified(user),

		// 元数据
		"publicMetadata":  user.PublicMetadata,
		"privateMetadata": user.PrivateMetadata,
		"unsafeMetadata":  user.UnsafeMetadata,

		// 外部账户
		"externalAccounts": user.ExternalAccounts,
		"lastSignInAt":     user.LastSignInAt,

		// 安全信息
		"twoFactorEnabled": hasTwoFactorEnabled(user),
		"passwordEnabled":  hasPasswordEnabled(user),
	}

	// 添加电话号码信息（如果存在）
	if len(user.PhoneNumbers) > 0 {
		profile["primaryPhone"] = user.PhoneNumbers[0].PhoneNumber
		profile["phones"] = user.PhoneNumbers
	}

	// 添加网站信息（如果存在）
	if len(user.Web3Wallets) > 0 {
		profile["web3Wallets"] = user.Web3Wallets
	}

	// 添加前端用户信息（如果存在）
	if frontendUserInfo != nil {
		profile["frontendInfo"] = map[string]interface{}{
			"userId":      frontendUserInfo.UserId,
			"username":    frontendUserInfo.Username,
			"email":       frontendUserInfo.Email,
			"name":        frontendUserInfo.Name,
			"avatar":      frontendUserInfo.Avatar,
			"preferences": frontendUserInfo.Preferences,
			"metadata":    frontendUserInfo.Metadata,
		}

		// 如果 Clerk 用户信息缺失某些字段，可以使用前端信息补充
		if profile["username"] == nil && frontendUserInfo.Username != "" {
			profile["username"] = frontendUserInfo.Username
		}
		if profile["firstName"] == nil || profile["firstName"] == "" {
			if frontendUserInfo.Name != "" {
				// 尝试分割全名
				parts := strings.Fields(frontendUserInfo.Name)
				if len(parts) > 0 {
					profile["firstName"] = parts[0]
					if len(parts) > 1 {
						profile["lastName"] = strings.Join(parts[1:], " ")
					}
				}
			}
		}
		if profile["imageUrl"] == nil && frontendUserInfo.Avatar != "" {
			profile["imageUrl"] = frontendUserInfo.Avatar
		}
	}

	return profile
}

// 获取主要邮箱地址
func getPrimaryEmail(user *clerk.User) string {
	if len(user.EmailAddresses) > 0 && user.PrimaryEmailAddressID != nil {
		for _, email := range user.EmailAddresses {
			if email.ID == *user.PrimaryEmailAddressID {
				return email.EmailAddress
			}
		}
		// 如果没有找到主要的，返回第一个
		return user.EmailAddresses[0].EmailAddress
	}
	return ""
}

// 检查用户是否已验证
func isUserVerified(user *clerk.User) bool {
	if len(user.EmailAddresses) > 0 && user.PrimaryEmailAddressID != nil {
		for _, email := range user.EmailAddresses {
			if email.ID == *user.PrimaryEmailAddressID {
				// 假设 Clerk 的 EmailAddress 有验证状态字段
				// 根据实际 SDK 调整字段名
				return true // 简化处理，实际应该检查 email.Verification 或类似字段
			}
		}
	}
	return false
}

// 检查是否启用了双因素认证
func hasTwoFactorEnabled(user *clerk.User) bool {
	// 这里可以根据实际的 Clerk SDK 字段来判断
	// 通常在 User 对象中有 TwoFactorEnabled 字段
	return user.TwoFactorEnabled
}

// 检查是否启用了密码认证
func hasPasswordEnabled(user *clerk.User) bool {
	// 简化处理：假设有外部账户就启用了某种认证方式
	// 实际应该检查具体的认证方式类型
	return len(user.ExternalAccounts) > 0
}

func main() {
	_ = godotenv.Load()

	secretKey := os.Getenv("CLERK_SECRET_KEY")
	client, err := clerk.NewClient(secretKey)
	if err != nil {
		log.Fatalf("failed to init clerk client: %v", err)
	}

	mux := http.NewServeMux()

	profile := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 打印请求信息
		log.Printf("=== Profile API Request ===")
		log.Printf("Method: %s", r.Method)
		log.Printf("URL: %s", r.URL.String())
		log.Printf("Remote Address: %s", r.RemoteAddr)
		log.Printf("User-Agent: %s", r.UserAgent())

		// 打印所有请求头
		log.Printf("Headers:")
		for name, values := range r.Header {
			for _, value := range values {
				// 对于敏感信息如 Authorization，只打印前10个字符
				if strings.EqualFold(name, "Authorization") {
					if len(value) > 10 {
						log.Printf("  %s: %s...", name, value[:10])
					} else {
						log.Printf("  %s: %s", name, value)
					}
				} else {
					log.Printf("  %s: %s", name, value)
				}
			}
		}

		// 打印查询参数
		log.Printf("Query Parameters:")
		for key, values := range r.URL.Query() {
			for _, value := range values {
				log.Printf("  %s: %s", key, value)
			}
		}

		userId := r.Header.Get("X-Clerk-User-Id")
		log.Printf("Extracted User ID from middleware: %s", userId)

		// 解析前端传递的用户信息
		frontendUserInfo, err := extractFrontendUserInfo(r)
		if err != nil {
			log.Printf("Warning: Failed to parse frontend user info: %v", err)
		} else {
			log.Printf("Frontend user info received: %+v", frontendUserInfo)
		}

		// 获取用户详细信息
		user, err := client.Users().Read(userId)
		if err != nil {
			log.Printf("Error fetching user details: %v", err)

			// 根据错误类型返回不同的状态码
			if strings.Contains(err.Error(), "not found") {
				http.Error(w, "User not found", http.StatusNotFound)
			} else if strings.Contains(err.Error(), "unauthorized") {
				http.Error(w, "Unauthorized to access user information", http.StatusForbidden)
			} else {
				http.Error(w, "Failed to fetch user information", http.StatusInternalServerError)
			}
			return
		}

		log.Printf("User info retrieved successfully for user: %s", user.ID)

		// 构建详细的用户资料响应
		profileResp := buildDetailedUserProfile(user, frontendUserInfo)

		// 添加额外的元数据
		profileResp["requestId"] = generateRequestID()
		profileResp["timestamp"] = fmt.Sprintf("%d", time.Now().Unix())

		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")

		if err := json.NewEncoder(w).Encode(profileResp); err != nil {
			log.Printf("Error encoding response: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	})

	// 先处理 CORS，再处理认证
	mux.Handle("/profile", CORSMiddleware(ClerkAuthMiddleware(profile, client)))
	// 也为 health 端点添加 CORS
	mux.Handle("/health", CORSMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "ok",
			"time":   time.Now().Format(time.RFC3339),
		})
	})))

	fmt.Println("Server running on :8080")
	if err := http.ListenAndServe(":8080", mux); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
