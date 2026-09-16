## 1. 项目初始化与基础配置

- [x] 1.1 使用 Vite 创建 React + TypeScript 项目：`npm create vite@latest . -- --template react-ts`，验证 `npm run dev` 启动成功
- [x] 1.2 安装 TailwindCSS 3.x 及相关依赖（postcss, autoprefixer），配置 `tailwind.config.ts` 和 `postcss.config.js`，在 `index.css` 添加 Tailwind directives，验证 `npm run dev` 无报错且 Tailwind 类名生效
- [x] 1.3 初始化 shadcn/ui：运行 `npx shadcn@latest init -y -b natural`，安装 Button、Input、Popover、Label 等用到的组件，验证 shadcn 组件在页面中正常渲染
- [x] 1.4 安装核心依赖：`@dnd-kit/core`、`@dnd-kit/sortable`、`@dnd-kit/utilities`、`html2canvas`，验证 `package.json` 中依赖列表完整
- [x] 1.5 创建项目目录结构（src/components, src/components/ui, src/lib, src/hooks）及基础文件：types.ts、storage.ts、utils.ts，验证所有文件能通过 TypeScript 编译检查

## 2. 数据层与状态管理

- [x] 2.1 在 `src/lib/types.ts` 中定义 TypeScript 类型：Tier、ImageItem、TierState 接口及默认数据，验证类型无错误
- [x] 2.2 在 `src/lib/storage.ts` 中实现 localStorage 读写封装：`loadState()` 和 `saveState(state)`，包含 JSON 序列化/反序列化和错误处理，验证函数可正确保存和恢复状态
- [x] 2.3 在 `src/hooks/useTierState.ts` 中实现排行榜状态管理 hook，包含添加图片、删除图片、移动图片、更新等级名称、更新等级颜色、重置等操作，验证 hook 返回正确的 state 和 actions

## 3. 排行榜核心 UI

- [x] 3.1 实现 `src/components/TierLabel.tsx`：可编辑等级标签，显示名称和颜色，双击进入编辑模式修改名称，点击颜色区域弹出 Popover 选择器修改颜色，验证修改后标签立即更新
- [x] 3.2 实现 `src/components/TierRow.tsx`：单个等级行容器，左侧渲染 TierLabel，右侧为图片内容区域，使用 Tailwind 构建行列布局，验证五个等级行以 S→A→B→C→D 顺序垂直排列
- [x] 3.3 实现 `src/components/TierBoard.tsx`：排行榜主容器，渲染所有 TierRow，提供 ref 用于导出，验证整体布局与设计稿一致
- [x] 3.4 实现 `src/components/ImageCard.tsx`：单张图片卡片组件，显示缩略图，悬停时显示删除按钮，支持加载状态和错误占位图，验证图片能正常展示

## 4. 图片池与图片添加

- [x] 4.1 实现 `src/components/ImageUploader.tsx`：本地文件上传组件，支持点击按钮和拖拽上传区域，多文件选择，格式校验（PNG/JPG/GIF/WEBP），大小校验（≤10MB），上传前压缩图片到最大宽度 400px，验证上传成功后图片出现在图片池
- [x] 4.2 实现 `src/components/UrlImageInput.tsx`：URL 图片添加组件，Input 输入框 + 添加按钮，校验 URL 格式，加载图片并转为可用格式，验证有效 URL 图片能添加到图片池、无效 URL 显示错误提示
- [x] 4.3 实现 `src/components/ImagePool.tsx`：图片池区域，与 TierBoard 分离放置，渲染图片池中所有 ImageCard，空状态显示提示文字，验证图片池可独立滚动

## 5. dnd-kit 拖拽系统集成

- [x] 5.1 在 `App.tsx` 中用 dnd-kit 的 `DnDContext` 包裹整个排行榜，配置传感器（PointerSensor + MouseSensor + TouchSensor），验证拖拽 API 正常初始化
- [x] 5.2 将每个 TierRow 和 ImagePool 改造为 `Droppable` 容器，使用 `SortableContext` 管理内部图片顺序，验证可放置目标被正确识别
- [x] 5.3 将 ImageCard 改造为可拖拽组件，使用 `useSortable` hook，实现拖拽源半透明效果（isDragging 时 opacity 0.3），验证拖拽开始时视觉反馈正确
- [x] 5.4 实现 `DragOverlay` 拖拽预览层，跟随鼠标显示当前拖拽的图片，验证预览图像正确跟随指针
- [x] 5.5 实现 `onDragOver` 中的占位符逻辑（indicator），在 Droppable 容器中根据指针位置计算插入点并显示占位框，验证松开鼠标后图片插入到正确位置
- [x] 5.6 实现目标区域高亮：当拖拽悬停在有效 Droppable 上时，容器边框变色 + 背景色变化，离开时恢复，验证高亮效果即时反馈
- [x] 5.7 实现 `onDragEnd` 处理跨容器移动逻辑：图片池→等级行、等级行→图片池、等级行之间互相移动、同容器内重新排序，验证所有移动场景正确更新状态
- [x] 5.8 实现取消拖拽：ESC 键监听、拖拽到窗口外松开取消，验证取消后图片回到原始位置
- [x] 5.9 验证移动端触摸拖拽：长按触发拖拽、触摸移动跟随、松手放置，验证触摸设备上拖拽可用

## 6. 导出功能

- [x] 6.1 实现 `src/components/ExportButton.tsx`：导出按钮组件，使用 html2canvas 获取 TierBoard ref 节点，配置 `useCORS: true`、`scale: 2`，导出为 PNG 并触发下载，验证导出文件名为 `tier-list-YYYYMMDD-HHmmss.png` 格式
- [x] 6.2 验证导出图片只包含排行榜主体（等级行 + 图片），不包含上传按钮、输入框等 UI 控件，验证导出图片清晰（2x 分辨率）
- [x] 6.3 处理导出错误场景：跨域图片失败时捕获异常并显示友好提示，验证用户体验

## 7. 持久化与全局集成

- [x] 7.1 在 useTierState hook 中集成 localStorage 持久化：状态变更时自动 saveState，初始化时 loadState，验证页面刷新后等级名称、颜色、图片位置等所有状态恢复
- [x] 7.2 图片删除功能：ImageCard 悬停显示删除图标，点击删除图片（从所有引用位置移除），验证删除后图片不再出现且状态正确更新
- [x] 7.3 端到端验证：完整测试流程——上传图片→拖拽到等级行→修改等级名称颜色→刷新页面→再次拖拽移动→导出 PNG，验证全流程无错误

## 8. 构建与部署验证

- [x] 8.1 执行 `npm run build`，验证 Vite + Rollup 构建成功、无 TypeScript 错误、产物在 dist/ 目录
- [x] 8.2 执行 `npm run preview`，验证构建产物在本地预览服务器正常运行，所有功能可用
