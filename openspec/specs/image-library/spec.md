## Purpose

管理图片资源，支持用户通过本地文件上传或 URL 添加图片，并在图片池中展示。

## Requirements

### Requirement: 本地文件上传

用户 SHALL 能够通过点击上传按钮或拖拽文件到指定上传区域，从本地选择一个或多个图片文件添加到图片池。支持的格式 SHALL 包括 PNG、JPG/JPEG、GIF、WEBP。

#### Scenario: 点击上传按钮添加图片

- **WHEN** 用户点击"上传图片"按钮并选择 3 个 PNG 文件
- **THEN** 这 3 张图片的缩略图立即出现在图片池中

#### Scenario: 拖拽文件到上传区域

- **WHEN** 用户将 JPG 文件拖拽到页面顶部的上传区域
- **THEN** 文件被接受并添加到图片池

#### Scenario: 不支持的文件格式

- **WHEN** 用户尝试上传 .txt 或 .pdf 文件
- **THEN** 系统忽略该文件并显示提示信息说明不支持的格式

#### Scenario: 上传超过大小限制

- **WHEN** 用户尝试上传超过 10MB 的图片文件
- **THEN** 系统拒绝上传并显示提示信息

### Requirement: 通过 URL 添加图片

用户 SHALL 能够在输入框中输入有效的图片 URL，点击确认后图片 SHALL 被加载并添加到图片池。

#### Scenario: 成功添加 URL 图片

- **WHEN** 用户输入一个有效的 HTTPS 图片 URL 并点击"添加"
- **THEN** 图片被加载并显示在图片池中

#### Scenario: 无效 URL 处理

- **WHEN** 用户输入非图片 URL 或无法访问的 URL
- **THEN** 系统显示错误提示且不添加任何图片

#### Scenario: HTTP URL 警告

- **WHEN** 用户输入的是 HTTP （非 HTTPS）图片 URL
- **THEN** 系统仍然尝试加载但可能因浏览器混合内容策略失败，失败时显示友好提示

### Requirement: 图片删除

用户 SHALL 能够在图片池或等级行中点击图片上的删除按钮将该图片移除。删除操作 SHALL 不可撤销。

#### Scenario: 从图片池删除图片

- **WHEN** 用户悬停在图片池中的某张图片上并点击出现的删除图标
- **THEN** 该图片从图片池中消失

#### Scenario: 从等级行删除图片

- **WHEN** 用户悬停在 S 等级中的某张图片上并点击删除图标
- **THEN** 该图片从 S 等级中消失，不会回到图片池

### Requirement: 图片加载状态

系统 SHALL 在图片加载完成前显示占位符或加载动画，加载失败时 SHALL 显示占位图标替代。

#### Scenario: URL 图片加载中

- **WHEN** 通过 URL 添加的图片正在下载
- **THEN** 图片位置显示加载动画，加载完成后显示实际图片

#### Scenario: URL 图片加载失败

- **WHEN** URL 图片加载超时或服务器返回错误
- **THEN** 图片位置显示错误占位图标并可被删除
