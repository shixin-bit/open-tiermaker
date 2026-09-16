## Why

用户需要一个简单易用的工具来创建图片排行榜（tier list），广泛应用于游戏角色排名、动漫角色喜好对比、产品评价等场景。目前这类工具要么需要注册、要么有广告、要么需要后端服务。一个纯前端的本地应用可以让用户快速、隐私安全地创建和分享自己的排行榜。

## What Changes

- 创建一个单页纯前端应用，包含 S/A/B/C/D 五个固定等级行
- 用户可从本地上传图片（多文件支持）
- 用户可通过 URL 添加网络图片
- 图片支持跨等级行拖拽移动，拖拽过程有视觉反馈（占位符、高亮目标区域）
- 未分配的图片放置在独立的图片池（pool）区域
- 支持从排行榜中移除图片回到图片池
- 支持自定义等级标签名称和颜色
- 支持将排行榜导出为图片（PNG）

## Capabilities

### New Capabilities

- `tier-board`: 排行榜核心画布，包含等级行的渲染、自定义等级标签/颜色、整体布局管理
- `image-library`: 图片管理，支持本地文件上传和 URL 添加，图片池区域管理，图片删除
- `drag-drop`: 拖拽系统，基于 dnd-kit 实现、跨等级行移动、视觉反馈（拖拽预览、目标高亮、占位符）
- `export`: 排行榜导出为 PNG 图片功能

### Modified Capabilities

（无现有能力需要修改）

## Impact

- **新建项目**：从零开始构建，无现有代码受影响
- **技术栈**：计划使用原生 React + TypeScript + Vite + dnd-kit + Tailwind CSS + Shadcn-ui ，拖拽使用 dnd-kit，导出使用 html2canvas 或 canvas API
- **依赖**：无后端依赖，构建工具是rollup，其他依赖可见技术栈。
- **浏览器兼容**：现代浏览器（Chrome、Firefox、Safari、Edge）最新两个版本
