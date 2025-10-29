# 认证流程图

## 🔄 传统登录流程图

```mermaid
flowchart TD
    A[用户访问登录页面] --> B{选择登录方式}
    B -->|传统登录| C[输入邮箱和密码]
    C --> D[点击登录按钮]
    D --> E[前端发送登录请求<br/>POST /api/auth/login]
    E --> F[后端验证用户凭据]
    F --> G{验证结果}
    G -->|成功| H[查询用户信息]
    G -->|失败| I[返回错误信息]
    H --> J[生成平台 JWT Token]
    J --> K[设置用户会话]
    K --> L[返回 Token 和用户信息]
    L --> M[前端存储 Token]
    M --> N[跳转到用户主页]
    I --> O[显示错误消息]
    O --> C

    style A fill:#e1f5fe
    style N fill:#c8e6c9
    style O fill:#ffcdd2
    style I fill:#ffcdd2
```

## 🔐 Clerk 登录流程图

```mermaid
flowchart TD
    A[用户访问登录页面] --> B{选择登录方式}
    B -->|Clerk 登录| C[点击 Clerk 登录]
    C --> D[打开 Clerk 认证界面]
    D --> E[用户选择社交账号<br/>Google/GitHub/微信等]
    E --> F[跳转到第三方认证]
    F --> G[用户授权登录]
    G --> H[Clerk 返回 JWT Token]
    H --> I[前端获取 Clerk Token]
    I --> J[发送到后端验证<br/>POST /api/auth/clerk-login]
    J --> K[后端验证 Clerk Token]
    K --> L{Token 验证结果}
    L -->|无效| M[返回认证失败]
    L -->|有效| N[从 Clerk 获取用户信息]
    N --> O[查询平台用户数据库]
    O --> P{用户是否存在}
    P -->|不存在| Q[创建新的平台用户]
    P -->|存在| R[更新用户信息]
    Q --> S[设置默认权限]
    S --> T[关联 Clerk ID]
    R --> T
    T --> U[生成平台 JWT Token]
    U --> V[返回平台 Token 和用户信息]
    V --> W[前端存储平台 Token]
    W --> X[跳转到用户主页]
    M --> Y[显示认证失败]
    Y --> C

    style A fill:#e1f5fe
    style X fill:#c8e6c9
    style Y fill:#ffcdd2
    style M fill:#ffcdd2
    style Q fill:#fff3e0
```

## 🗂️ 用户数据映射流程图

```mermaid
flowchart TD
    A[Clerk 用户登录] --> B[获取 Clerk 用户信息]
    B --> C[提取邮箱地址]
    C --> D[查询平台用户表<br/>WHERE email = ?]
    D --> E{用户查询结果}

    E -->|找到用户| F[检查用户状态]
    F --> G{用户状态}
    G -->|正常| H[更新最后登录时间]
    G -->|禁用| I[返回账户禁用错误]

    E -->|未找到用户| J[创建新用户记录]
    J --> K[设置基本信息<br/>邮箱、姓名、头像等]
    K --> L[设置 Clerk ID 映射]
    L --> M[设置 auth_type = 'clerk']
    M --> N[分配默认权限角色]
    N --> O[发送欢迎邮件]

    H --> P[同步 Clerk 元数据]
    P --> Q[生成平台 JWT Token]
    I --> R[返回错误信息]
    O --> Q
    Q --> S[返回登录成功]

    style A fill:#e1f5fe
    style S fill:#c8e6c9
    style R fill:#ffcdd2
    style I fill:#ffcdd2
    style J fill:#fff3e0
```

## 🔗 账户关联流程图

```mermaid
flowchart TD
    A[用户登录平台账号] --> B[进入账户设置页面]
    B --> C[点击"关联社交账号"]
    C --> D[选择要关联的平台]
    D --> E[跳转到 Clerk 认证]
    E --> F[用户完成社交登录]
    F --> G[获取 Clerk Token]
    G --> H[发送关联请求<br/>POST /api/auth/link-account]
    H --> I[验证 Clerk Token]
    I --> J[获取 Clerk 用户信息]
    J --> K[检查邮箱是否匹配]
    K --> L{邮箱匹配结果}
    L -->|匹配| M[更新用户记录]
    L -->|不匹配| N[返回邮箱不匹配错误]
    M --> O[设置 auth_type = 'linked']
    O --> P[保存 Clerk ID 映射]
    P --> Q[同步用户信息]
    Q --> R[返回关联成功]
    N --> S[显示错误信息]

    style A fill:#e1f5fe
    style R fill:#c8e6c9
    style S fill:#ffcdd2
    style N fill:#ffcdd2
    style M fill:#fff3e0
```

## 🛡️ Token 验证中间件流程图

```mermaid
flowchart TD
    A[API 请求到达] --> B[检查 Authorization 头]
    B --> C{Token 是否存在}
    C -->|不存在| D[返回 401 未授权]
    C -->|存在| E[提取平台 JWT Token]
    E --> F[解析 Token]
    F --> G{Token 格式验证}
    G -->|无效| H[返回 401 Token 无效]
    G -->|有效| I[验证 Token 签名]
    I --> J{签名验证结果}
    J -->|失败| K[返回 401 签名无效]
    J -->|成功| L[检查 Token 过期时间]
    L --> M{Token 是否过期}
    M -->|已过期| N[返回 401 Token 过期]
    M -->|未过期| O[提取用户 ID]
    O --> P[查询用户信息]
    P --> Q{用户是否存在}
    Q -->|不存在| R[返回 401 用户不存在]
    Q -->|存在| S[检查用户状态]
    S --> T{用户状态}
    T -->|禁用| U[返回 403 账户禁用]
    T -->|正常| V[将用户信息加入 Context]
    V --> W[继续处理请求]

    D --> X[结束]
    H --> X
    K --> X
    N --> X
    R --> X
    U --> X
    W --> Y[返回 API 响应]
    Y --> X

    style A fill:#e1f5fe
    style Y fill:#c8e6c9
    style D fill:#ffcdd2
    style H fill:#ffcdd2
    style K fill:#ffcdd2
    style N fill:#ffcdd2
    style R fill:#ffcdd2
    style U fill:#ffcdd2
```

## 🔄 用户信息同步流程图

```mermaid
flowchart TD
    A[用户登录成功] --> B[检查用户信息最后同步时间]
    B --> C{是否需要同步}
    C -->|是| D[从 Clerk 获取最新用户信息]
    C -->|否| E[跳过同步]
    D --> F[比较本地和 Clerk 信息]
    F --> G{信息是否有变化}
    G -->|有变化| H[更新本地用户信息]
    G -->|无变化| I[保持现有信息]
    H --> J[更新头像 URL]
    J --> K[更新用户基本信息]
    K --> L[更新 Clerk 元数据]
    L --> M[记录同步时间]
    M --> N[返回更新后的用户信息]
    I --> O[返回缓存用户信息]
    E --> O
    N --> P[前端显示用户信息]
    O --> P

    style A fill:#e1f5fe
    style P fill:#c8e6c9
    style H fill:#fff3e0
    style D fill:#e8f5e8
```

## 🚨 错误处理流程图

```mermaid
flowchart TD
    A[API 请求处理] --> B{发生错误}
    B -->|无错误| C[正常返回响应]
    B -->|有错误| D[识别错误类型]
    D --> E{错误类型}
    E -->|认证错误| F[返回 401 错误]
    E -->|授权错误| G[返回 403 错误]
    E -->|请求错误| H[返回 400 错误]
    E -->|服务器错误| I[返回 500 错误]
    E -->|Clerk 错误| J[处理 Clerk API 错误]

    F --> K[记录错误日志]
    G --> K
    H --> K
    I --> K
    J --> L{Clerk 错误类型}
    L -->|Token 无效| M[返回认证失败]
    L -->|网络超时| N[返回服务暂时不可用]
    L -->|配额超限| O[返回服务繁忙]
    L -->|其他错误| P[返回未知错误]

    K --> Q[格式化错误响应]
    M --> Q
    N --> Q
    O --> Q
    P --> Q
    Q --> R[返回 JSON 错误信息]
    R --> S[记录监控指标]
    S --> T[结束请求处理]

    style A fill:#e1f5fe
    style C fill:#c8e6c9
    style F fill:#ffcdd2
    style G fill:#ffcdd2
    style H fill:#ffcdd2
    style I fill:#ffcdd2
    style J fill:#fff3e0
```

## 📊 监控和日志流程图

```mermaid
flowchart TD
    A[用户登录请求] --> B[记录请求开始]
    B --> C[提取请求元数据<br/>IP、User-Agent、时间戳]
    C --> D[记录认证方式]
    D --> E{认证方式}
    E -->|传统登录| F[记录邮箱登录尝试]
    E -->|Clerk 登录| G[记录 Clerk Token 验证]
    F --> H[处理登录逻辑]
    G --> H
    H --> I[记录处理结果]
    I --> J{登录结果}
    J -->|成功| K[记录成功日志]
    J -->|失败| L[记录失败日志]
    K --> M[更新成功计数器]
    L --> N[更新失败计数器]
    M --> O[发送监控指标]
    N --> O
    O --> P[记录响应时间]
    P --> Q[返回响应]
    Q --> R[记录请求结束]

    style A fill:#e1f5fe
    style Q fill:#c8e6c9
    style K fill:#c8e6c9
    style L fill:#ffcdd2
    style O fill:#fff3e0
```

这些流程图详细展示了混合认证架构的各个关键环节，包括：

1. **传统登录流程** - 用户名密码认证的完整过程
2. **Clerk 登录流程** - 第三方社交登录的详细步骤
3. **用户数据映射** - Clerk 用户与平台用户的关联逻辑
4. **账户关联** - 现有用户绑定社交账号的流程
5. **Token 验证** - 中间件验证平台 JWT 的完整过程
6. **信息同步** - 用户信息的实时同步机制
7. **错误处理** - 各种错误情况的处理流程
8. **监控日志** - 系统监控和日志记录的完整流程

每个流程图都用不同颜色标识了成功路径（绿色）、失败路径（红色）和特殊处理路径（橙色），便于理解和实施。