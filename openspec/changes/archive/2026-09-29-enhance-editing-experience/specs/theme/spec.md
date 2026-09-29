## Purpose

为 Open TierMaker 提供暗色主题切换能力,让用户在夜间或低光环境下长时间编辑不刺眼;支持浅色 / 深色 / 跟随系统三种模式,选择持久化到 localStorage,跨页面与跨刷新保持一致。

## Requirements

### Requirement: 三种主题模式

系统 SHALL 支持三种主题模式:`light`(浅色,默认)、`dark`(深色)、`system`(跟随系统 `prefers-color-scheme`)。`system` 模式下,系统主题变更时 SHALL 实时跟随切换。

#### Scenario: 首次访问默认跟随系统

- **WHEN** 用户首次访问应用(localStorage 中无主题偏好记录)
- **THEN** 系统使用 `system` 模式;若系统为暗色主题,页面渲染为深色;若系统为浅色,渲染为浅色

#### Scenario: 用户手动切换到深色

- **WHEN** 用户点击主题切换器并选择"深色"
- **THEN** 页面立即变为深色,`<html>` 元素添加 `class="dark"`;选择写入 localStorage

#### Scenario: 用户切换到"跟随系统"后系统主题变化

- **WHEN** 用户将主题设为"跟随系统",然后操作系统主题从浅色切换到深色
- **THEN** 页面实时切换为深色,无需刷新;`<html>` 元素的 `class` 同步更新

#### Scenario: 刷新页面后保持主题

- **WHEN** 用户选择了"深色"后刷新页面
- **THEN** 页面加载时从 localStorage 读取偏好,渲染为深色,无主题闪烁(白屏一瞬变深)

### Requirement: 主题切换器组件

系统 SHALL 在所有页面 Header 右上角显示主题切换器组件。切换器 SHALL 提供三态选择(浅色 / 深色 / 跟随系统),当前选中态 SHALL 高亮显示。

#### Scenario: 切换器三态显示

- **WHEN** 用户在任意页面查看 Header 右上角
- **THEN** 看到三个选项(浅色 / 深色 / 跟随系统,可用图标 ☀️ / 🌙 / 💻 或文字标签),当前模式高亮

#### Scenario: 点击切换主题

- **WHEN** 用户点击切换器中的"深色"选项
- **THEN** 主题立即切换,切换器当前态高亮更新为"深色"

#### Scenario: 切换器跨页面一致

- **WHEN** 用户在编辑页将主题设为深色,然后导航到首页或排行榜列表页
- **THEN** 所有页面均显示深色主题;切换器在所有页面均显示当前态为"深色"

### Requirement: 主题持久化与初始化

主题选择 SHALL 持久化到 localStorage(`open-tiermaker-theme` 键,值 `light` / `dark` / `system`)。应用初始化时 SHALL 从 localStorage 读取偏好并同步 `<html>` 元素的 class,避免主题闪烁。

#### Scenario: 应用初始化无闪烁

- **WHEN** 用户已设偏好为"深色"并刷新页面
- **THEN** 页面首次渲染时 `<html>` 已带 `class="dark"`,无白屏闪烁;CSS 中所有 `dark:` 变体规则直接生效

#### Scenario: localStorage 中无偏好记录

- **WHEN** 应用初始化时 localStorage 中无 `open-tiermaker-theme` 键
- **THEN** 默认使用 `system` 模式;`<html>` 是否加 `dark` class 取决于当前系统主题

#### Scenario: localStorage 中值为非法字符串

- **WHEN** localStorage 中 `open-tiermaker-theme` 值为 `"purple"`(不在枚举内)
- **THEN** 系统忽略该值,回退到 `system` 模式;不抛出异常

### Requirement: 暗色样式覆盖范围

系统 SHALL 使用 Tailwind 4 `class` 策略(`dark:` 变体)。所有现有页面(首页、登录、注册、OAuth 回调、排行榜列表、新建、编辑、分享只读)SHALL 在深色模式下视觉一致,无硬编码 `bg-white` / `text-black` 等浅色专有色。

#### Scenario: 编辑页深色模式完整覆盖

- **WHEN** 用户在编辑页将主题切换为深色
- **THEN** Header、上传按钮、URL 输入框、等级行、图片池、拖拽预览、占位符、保存按钮、分享面板、AuthModal 等所有 UI 元素均显示深色背景与浅色文字;无残留浅色块

#### Scenario: 分享只读页深色模式

- **WHEN** 访客访问分享链接(`/share/:shareId`)并将主题设为深色(若切换器在分享页可见)
- **THEN** 只读排行榜渲染为深色主题;切换器在分享页 SHALL 也可见可用

### Requirement: 跟随系统模式的实时响应

`system` 模式下,系统 SHALL 注册 `matchMedia('(prefers-color-scheme: dark)')` 监听器;系统主题变化时 SHALL 立即同步 `<html>` class,无需刷新页面。

#### Scenario: 系统切换主题实时响应

- **WHEN** 主题设为"跟随系统",系统主题从深色切换到浅色
- **THEN** 页面立即变为浅色,无刷新;`<html>` 的 `class="dark"` 被移除

#### Scenario: 用户从 system 切换到 dark 后系统主题变化

- **WHEN** 用户将主题从"跟随系统"切到"深色",然后系统主题从深色变为浅色
- **THEN** 页面保持深色,不受系统主题影响;matchMedia 监听器对当前模式无副作用
