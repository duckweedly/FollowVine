# FollowVine V1 技术方案

## 架构

V1 用 Next.js 单体应用即可:

```text
Browser
  └─ Next.js UI
      └─ Next.js Route Handlers
          ├─ OpenAI gpt-image-2
          ├─ local generated image cache
          └─ share/page metadata storage
```

第一版优先减少移动部件。没有必要先拆 FastAPI、Redis、对象存储。

## API

### `POST /api/page`

生成 root page:

```json
{
  "query": "RAG 是怎么工作的",
  "style": "watercolor_book"
}
```

生成 child page:

```json
{
  "parentId": "page_id",
  "parentClick": {
    "x": 0.42,
    "y": 0.63
  }
}
```

响应:

```json
{
  "page": {
    "id": "page_id",
    "imageUrl": "/generated/page_id.png",
    "parentId": null,
    "parentClick": null,
    "initialQuery": "RAG 是怎么工作的",
    "style": "watercolor_book",
    "createdAt": "2026-05-23T00:00:00.000Z"
  }
}
```

### `GET /generated/:pageId.png`

返回已生成图片。

### `GET /share/:shareId`

打开分享路径。

## 数据模型

```ts
type Page = {
  id: string
  imageUrl: string
  parentId: string | null
  parentClick: { x: number; y: number } | null
  initialQuery: string | null
  style: StyleKey
  createdAt: string
}

type StyleKey =
  | "watercolor_book"
  | "chinese_science_magazine"
  | "whiteboard_marker"
  | "chalkboard"
```

## 缓存规则

Page id 使用确定性 hash:

```text
root id  = hash("root" + version + normalize(query) + style)
child id = hash("child" + version + parentId + round(x, 2) + round(y, 2) + style)
```

规则:

- `normalize(query)`: trim、合并空白、转小写。
- 点击坐标四舍五入到 2 位。
- 命中 `/generated/{id}.png` 时直接返回, 不调用模型。
- bump `version` 可以整体失效缓存。

## Root Page 生成

输入:

- query
- style preset

后端拼接固定 root prompt:

```text
{STYLE_DESCRIPTION}

Subject: {query}

Compose a single 16:9 Chinese illustrated explainer page about the subject above.
The image should teach the concept visually.
Use clear Chinese title and short readable labels.
Avoid dense paragraphs and tiny text.
Output one 16:9 PNG image.
```

用户只允许进入 `{query}` 这个槽位。

## Child Page 生成

流程:

1. 读取父图 PNG。
2. 根据 `parentClick.x/y` 计算像素位置。
3. 在父图上合成红圈和中心点。
4. 把带红圈父图作为参考图传给 `gpt-image-2`。
5. 使用固定 child prompt 生成下一页。

Child prompt:

```text
{STYLE_DESCRIPTION}

You are continuing a Chinese illustrated explainer book.
The provided image is the previous page.
A red circle marks where the reader pointed.
Generate the next 16:9 page by drilling into whatever the red circle is on:
zoom in, expand its internal structure, show its mechanism, or explain its role.

Match the same visual style, paper tone, line weight, palette, and title treatment.
Do not include the red circle or cursor mark in the output.
Use clear Chinese title and short readable labels.
Avoid dense paragraphs and tiny text.
Output one 16:9 PNG image.
```

## Style Presets

每个 style preset 是一段固定 prompt 文本:

- `watercolor_book`: warm paper, ink outline, soft watercolor, calm explainer book.
- `chinese_science_magazine`: modern Chinese science magazine, strong headline, clean editorial layout.
- `whiteboard_marker`: whiteboard marker sketch, simple arrows, clear labels.
- `chalkboard`: chalkboard classroom style, experimental.

同一路径内必须保持同一 style。

## 前端状态

前端维护:

```ts
type BookState = {
  pages: Page[]
  currentIndex: number
  isGenerating: boolean
  error: string | null
}
```

规则:

- root 生成成功后 `pages = [page]`。
- 从当前页点击生成 child 时, 成功后截断 `currentIndex` 后面的页面, 再 append 新页。
- Back 只改 `currentIndex`, 不请求后端。
- 缩略图跳转只改 `currentIndex`, 不请求后端。

## 校验和安全

- API key 只在服务端环境变量。
- 浏览器不能传 prompt。
- `query`: 1-300 字符。
- `style`: 必须是白名单 key。
- `parentId`: 必须匹配 page id 格式。
- `x/y`: 有限数字, 范围 `[0, 1]`。
- 图片路径只由 page id 推导, 不接受客户端传文件名。

## 失败策略

- 生成失败不自动重试。
- 前端显示一条错误: `生成失败, 换个位置再试。`
- 下一次成功生成后清除错误。
- 两次快速点击时, 第二次应被忽略或排队; V1 优先禁用点击直到当前生成完成。

## 验收标准

1. 输入 `RAG 是怎么工作的` 能生成一张中文 16:9 图解页。
2. 点击图中任意可见对象, 下一页明显围绕点击区域继续解释。
3. 连续下钻 3 页后, 风格保持一致。
4. Back 和缩略图跳转不触发新生成。
5. 同一 topic/style 第二次生成命中缓存。
6. 同一 parentId/click/style 第二次生成命中缓存。
7. API key 不出现在浏览器代码和响应里。

