## MODIFIED Requirements

### Requirement: 本地文件上传

用户 SHALL 能够通过点击上传按钮或拖拽文件到指定上传区域，从本地选择一个或多个图片文件添加到图片池。支持的格式 SHALL 包括 PNG、JPG/JPEG、GIF、WEBP。根据用户登录状态，图片存储方式不同：未登录时以 base64 编码存入浏览器 localStorage；已登录时以二进制形式上传到云端 Postgres bytea 列。

#### Scenario: 点击上传按钮添加图片

- **WHEN** 用户点击"上传图片"按钮并选择 3 个 PNG 文件
- **THEN** 图片被添加到图片池；未登录时以 base64 存入 localStorage，已登录时以二进制上传到云端 Postgres bytea 列

#### Scenario: 拖拽文件到上传区域

- **WHEN** 用户将 JPG 文件拖拽到页面顶部的上传区域
- **THEN** 文件被接受并添加到图片池，按当前登录状态选择对应存储方式

#### Scenario: 不支持的文件格式

- **WHEN** 用户尝试上传 .txt 或 .pdf 文件
- **THEN** 系统忽略该文件并显示提示信息说明不支持的格式

#### Scenario: 上传超过大小限制

- **WHEN** 用户上传的图片超过 10MB（登录模式）或导致 localStorage 接近 5MB 上限（游客模式）
- **THEN** 系统拒绝上传并显示对应提示；游客模式下额外提示登录可解锁更大存储空间

#### Scenario: 登录模式图片上传持久化

- **WHEN** 已登录用户上传图片后刷新页面或在另一设备登录同一账户
- **THEN** 之前上传的图片仍然可见

#### Scenario: 游客模式 localStorage 耗尽警告

- **WHEN** 未登录用户上传图片导致 localStorage 已使用量超过 4MB
- **THEN** 系统展示存储进度条警告 toast，提示登录可解锁无限云端存储
