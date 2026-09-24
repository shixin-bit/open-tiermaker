## Purpose

让用户能够为自己的排行榜生成匿名可访问的短链接，并通过可见性和密码保护控制分享范围。

## Requirements

### Requirement: 可见性设置

每个排行榜 SHALL 支持三种可见性模式：private（仅所有者可访问）、unlisted（知道链接即可访问）、public（可被公开浏览功能收录）。新建排行榜默认为 private。

#### Scenario: 默认 private

- **WHEN** 用户创建新排行榜
- **THEN** 可见性默认设置为 private，不生成分享链接

#### Scenario: 修改可见性

- **WHEN** 用户在排行榜设置中切换可见性为 unlisted
- **THEN** 系统生成一个唯一 shareId，排行榜现在可通过短链接匿名访问

### Requirement: 生成分享链接

已登录用户 SHALL 能够为自己的排行榜生成或重新生成短分享链接。

#### Scenario: 首次生成

- **WHEN** 用户将排行榜可见性切换为 unlisted 或 public
- **THEN** 系统生成一个 8 位 URL-safe 字符的短 shareId，返回完整分享链接

#### Scenario: 重新生成

- **WHEN** 用户点击"重置分享链接"
- **THEN** 系统生成新的 shareId，旧链接立即失效

### Requirement: 匿名只读访问

持有有效 shareId 的访客 SHALL 无需登录即可查看排行榜的只读版本。只读版本 SHALL 支持完整的 tier 展示和图片渲染，但不支持任何编辑操作。

#### Scenario: 访问 unlisted 排行榜

- **WHEN** 用户访问 `/share/{validShareId}`
- **THEN** 系统返回排行榜完整内容，前端渲染只读视图（不可拖拽、不可编辑标签）

#### Scenario: shareId 无效

- **WHEN** 用户访问 `/share/{invalidShareId}`
- **THEN** 系统返回 404，前端展示"排行榜不存在或已被禁用"

#### Scenario: 访问 private 排行榜的 shareId

- **WHEN** 排行榜可见性为 private 但仍持有旧的 shareId
- **THEN** 系统返回 404，视为分享已撤销

### Requirement: 密码保护

排行榜所有者 SHALL 能够为分享链接设置可选的访问密码。设置后，访客访问时需先输入正确密码才能查看。

#### Scenario: 设置密码保护后访问

- **WHEN** 排行榜设置了分享密码，访客通过 shareId 访问
- **THEN** 系统前端展示密码输入页面；输入正确密码后才渲染排行榜内容

#### Scenario: 密码错误

- **WHEN** 访客输入的密码不正确
- **THEN** 前端显示密码错误提示，不渲染排行榜内容

### Requirement: 分享仅限登录用户触发

未登录用户 SHALL 无法主动生成分享链接，系统 SHALL 在点击分享按钮时触发登录流程。

#### Scenario: 游客点击分享

- **WHEN** 未登录用户点击"生成分享链接"按钮
- **THEN** 系统弹出登录 Modal，用户完成登录后自动继续分享流程
