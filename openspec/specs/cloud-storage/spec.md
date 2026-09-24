## Purpose

为登录用户提供排行榜数据的云端持久化，支持多设备同步，并将图片以二进制形式存入 Postgres，解决 localStorage 容量限制问题。

## Requirements

### Requirement: 创建排行榜

已登录用户 SHALL 能够创建新的空排行榜，并设置标题和描述。

#### Scenario: 创建成功

- **WHEN** 已登录用户提交排行榜创建表单
- **THEN** 系统在云端创建一条空排行榜记录，返回排行榜 ID，用户被重定向到编辑页

#### Scenario: 未登录用户尝试通过 API 创建

- **WHEN** 未携带有效 session 的请求调用创建排行榜接口
- **THEN** 系统返回 401 Unauthorized

### Requirement: 排行榜列表查询

已登录用户 SHALL 能够查看自己所有排行榜的列表，按最近更新时间倒序排列。

#### Scenario: 有排行榜的用户

- **WHEN** 已登录用户访问"我的排行榜"页面
- **THEN** 系统返回该用户所有排行榜的概要信息（标题、描述、更新时间）

#### Scenario: 新用户（无排行榜）

- **WHEN** 已登录但从未创建过排行榜的用户访问列表页
- **THEN** 系统返回空列表，页面展示引导创建的空状态

### Requirement: 读取单个排行榜内容

已登录用户 SHALL 能够读取自己排行榜的完整内容（包含 tier 配置和所有图片条目）。

#### Scenario: 读取自己的排行榜

- **WHEN** 已登录用户请求自己的某个排行榜
- **THEN** 系统返回完整的 TierState（tiers 配置 + 所有 items + 图片数据）

#### Scenario: 尝试读取他人私有排行榜

- **WHEN** 已登录用户请求不属于自己且非公开的排行榜
- **THEN** 系统返回 403 Forbidden

### Requirement: 全量更新排行榜内容

已登录用户 SHALL 能够对自己的排行榜进行全量内容更新（tier 调整、图片增删改、排序变更等）。保存操作以幂等的全量替换方式提交。

#### Scenario: 保存修改

- **WHEN** 用户在编辑页完成拖拽排序、tier 标签改名等操作后点击保存
- **THEN** 系统接收完整 TierState 并替换排行榜的全部内容，返回成功

#### Scenario: 未持有最新版本的并发保存

- **WHEN** 同一排行榜在另一设备上先于当前请求保存了修改
- **THEN** 系统 SHALL 按"后写入覆盖先写入"策略处理，并允许后续版本加入乐观锁机制

### Requirement: 删除排行榜

已登录用户 SHALL 能够删除自己的排行榜，删除操作不可撤销。

#### Scenario: 删除成功

- **WHEN** 已登录用户确认删除自己的排行榜
- **THEN** 系统永久删除该排行榜及其所有图片数据

#### Scenario: 尝试删除他人排行榜

- **WHEN** 用户请求删除不属于自己的排行榜
- **THEN** 系统返回 403 Forbidden

### Requirement: 图片二进制上传

已登录用户 SHALL 能够将图片文件上传到云端，系统 SHALL 将图片以二进制形式存入 Postgres bytea 列。

#### Scenario: 上传本地图片到云端

- **WHEN** 已登录用户上传一个 PNG 或 JPEG 图片文件
- **THEN** 系统校验文件类型，存储二进制数据，返回分配的图片 ID

#### Scenario: 上传不支持的格式

- **WHEN** 用户上传非 PNG/JPG/JPEG/GIF/WEBP 格式的文件
- **THEN** 系统返回错误提示，不存储该文件

### Requirement: 图片 URL 资源保留

已登录用户添加图片 URL 时，系统 SHALL 按现有行为在前端直接加载远程 URL，不做服务端代理或下载。

#### Scenario: 添加 URL 图片

- **WHEN** 已登录用户输入有效的图片 URL 并确认
- **THEN** 前端直接使用该 URL 渲染图片，后端仅存储该 URL 字符串
