// Access Token 仅存于内存，随请求头发送。
// Refresh Token 由后端设置在 HttpOnly Cookie 中，前端不存储。
let accessToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string): void {
  accessToken = token
}

export function clearAccessToken(): void {
  accessToken = null
}

// 向后兼容：之前有 setTokens/clearTokens 调用，保留但只处理 access token。
export function setTokens(access: string, _refresh: string): void {
  setAccessToken(access)
}

export function clearTokens(): void {
  clearAccessToken()
}

// 保留 getRefreshToken/setRefreshToken 接口但不再实际存储
export function getRefreshToken(): string | null {
  return null
}

export function setRefreshToken(_token: string): void {
  // no-op：refresh token 由 HttpOnly Cookie 管理
}
