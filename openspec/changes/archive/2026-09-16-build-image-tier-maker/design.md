## Context

全新绿色项目，无现有代码或技术栈约束。需求是构建纯前端图片排行榜应用——用户通过拖拽图片到 S/A/B/C/D 等级行来创建排行榜。所有数据保存在浏览器本地（localStorage），无需后端服务。

**确定技术栈**：React + TypeScript + Vite + TailwindCSS + shadcn/ui + dnd-kit + Rollup。

## Goals / Non-Goals

**Goals:**

- 使用 React + TypeScript 构建类型安全的单页应用
- 基于 dnd-kit 实现流畅的拖拽交互与清晰视觉反馈
- 使用 shadcn/ui + TailwindCSS 快速构建一致美观的 UI
- 排行榜配置（标签名称、颜色）持久化到 localStorage
- 支持本地图片和 URL 图片两种来源
- 一键导出为 PNG 分享

**Non-Goals:**

- 不实现后端服务、用户系统或云同步
- 不实现实时协作功能
- 不实现自定义等级数量（固定为 S/A/B/C/D 五个等级）
- 不实现复杂的图片编辑（裁剪、滤镜等）
- 不实现排行榜的导入功能

## Decisions

### 1. 技术栈选型

| 类别    | 选择                        | 理由                                                           |
| ------- | --------------------------- | -------------------------------------------------------------- |
| 框架    | React 18 + TypeScript       | 类型安全、生态成熟、组件化适合此类交互密集应用                 |
| 构建    | Vite                        | 开发体验好、热更新快，Rollup 作为底层打包器                    |
| 样式    | TailwindCSS                 | 原子化 CSS、快速原型、与 shadcn/ui 集成良好                    |
| UI 组件 | shadcn/ui                   | 基于 Radix UI 的高质量组件，可自定义、无额外运行时依赖         |
| 拖拽    | dnd-kit                     | React 生态中最现代的拖拽库，原生触摸支持、可访问性好、API 简洁 |
| 导出    | html2canvas                 | 纯前端 DOM 截图导出 PNG 的主流方案                             |
| 状态    | React useState + useReducer | 应用规模不大，无需 Redux/Zustand 等外部状态库                  |
| 存储    | localStorage                | 浏览器原生持久化，约 5MB 够用                                  |

### 2. 图片存储策略：Data URL（本地文件）+ 原始 URL（网络图片）

**选择**：本地文件通过 FileReader 转为 Data URL 存储；网络图片直接存储原始 URL。排行榜状态存于 localStorage。

**理由**：

- Data URL 保证本地图片在离线时仍可显示
- 网络图片存 URL 节省存储空间，但需注意跨域导出问题
- localStorage 容量约 5MB，够用（本地图片上传时自动压缩）

**备选方案**：

- IndexedDB：存储容量更大但 API 复杂度更高，对 MVP 过度设计

### 3. 导出实现：html2canvas

**选择**：引入 html2canvas 将排行榜 DOM 渲染为 canvas 并导出 PNG。

**理由**：

- 纯前端导出的主流成熟方案
- 支持跨域图片代理配置（`useCORS: true`）
- 易于与 React 集成，使用 `useRef` 获取排行榜根节点

**风险**：网络图片跨域可能导致导出失败 → 配置 `useCORS: true` 并提示用户部分图片可能因跨域限制无法导出完整内容

### 4. 项目结构

```
open-tiermaker/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── components.json          # shadcn/ui 配置
├── public/
└── src/
    ├── main.tsx             # 入口
    ├── App.tsx              # 根组件
    ├── index.css            # Tailwind + shadcn 基础样式
    ├── lib/
    │   ├── utils.ts         # shadcn 提供的 cn() 工具等
    │   ├── storage.ts       # localStorage 持久化封装
    │   └── types.ts         # 全局类型定义
    ├── components/
    │   ├── ui/              # shadcn/ui 组件 (button, input, color-picker...)
    │   ├── TierBoard.tsx    # 排行榜主容器
    │   ├── TierRow.tsx      # 单个等级行（dnd-kit DnDContext + Droppable）
    │   ├── TierLabel.tsx    # 等级标签（可编辑名称 + 颜色）
    │   ├── ImagePool.tsx    # 图片池区域（Droppable）
    │   ├── ImageCard.tsx    # 单张图片卡片（Draggable）
    │   ├── ImageUploader.tsx # 本地文件上传
    │   ├── UrlImageInput.tsx # URL 图片添加
    │   └── ExportButton.tsx  # 导出按钮
    └── hooks/
        ├── useTierState.ts   # 排行榜状态管理 hook
        └── useDragDrop.ts    # dnd-kit 拖拽逻辑封装
```

### 5. dnd-kit 拖拽架构

使用 dnd-kit 的 `@dnd-kit/core` + `@dnd-kit/sortable`：

- 每个 `TierRow` 和 `ImagePool` 作为 `Droppable` 容器
- 每张图片卡片作为 `SortableContext` 中的可拖拽项（`useSortable`）
- `DnDContext` 包裹整个排行榜，管理拖拽状态
- 使用 `DragOverlay` 显示拖拽预览
- `onDragEnd` 中处理跨容器移动逻辑（图片池 ↔ 等级行、等级行 ↔ 等级行）

### 6. 数据模型（TypeScript）

```typescript
interface Tier {
  id: string; // 'S' | 'A' | 'B' | 'C' | 'D'
  label: string; // 显示名称，可自定义
  color: string; // 标签背景色
  imageIds: string[]; // 该等级行中的图片 ID 列表（有顺序）
}

interface ImageItem {
  id: string;
  src: string; // Data URL 或网络 URL
  source: "local" | "url";
  createdAt: number;
}

interface TierState {
  tiers: Tier[];
  pool: string[]; // 图片池中图片 ID 列表
  images: Record<string, ImageItem>;
}
```

### 7. shadcn/ui 组件清单

- Button：导出、上传、添加等按钮
- Input：URL 图片输入框
- Label：等级标签编辑
- Popover：颜色选择器弹出面板
- Progress：上传进度

## Risks / Trade-offs

| 风险                                              | 缓解措施                                                                    |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| localStorage 5MB 限制可能容纳不下大量高清本地图片 | 上传时自动压缩图片到合适尺寸（如最大宽度 400px），或提示用户清理            |
| 网络图片 URL 失效导致图片加载失败                 | 加载失败时显示占位图标并标记                                                |
| html2canvas 导出跨域网络图片失败                  | 配置 useCORS，导出前提示跨域限制，导出失败时显示友好错误                    |
| dnd-kit Draggable + SortableContext 嵌套复杂度    | 将每个等级行内的图片作为独立 SortableContext，跨等级移动在 onDragEnd 中处理 |
| Data URL 大图片渲染性能                           | 本地图片上传时压缩，列表中使用缩略图尺寸显示                                |

## Open Questions

- 是否需要支持导入/加载之前保存的排行榜配置 JSON？（Non-Goal 可后续再议）
- 是否需要支持自定义背景色或主题切换？（MVP 不需要）
