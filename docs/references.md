# FollowVine 参考资料

## 核心参考

### Flipbook Page

- URL: https://flipbook-page.com/
- 参考点:
  - AI-native visual browser。
  - 每一页都是实时生成的像素页面。
  - 用户可以点击任意位置继续深入探索。

FollowVine 借鉴它的核心体验: 输入主题后得到一张视觉页, 点击图中任意位置继续下钻。

## illustrated-explainer-spec

- URL: https://github.com/vthinkxie/illustrated-explainer-spec
- 参考点:
  - 单页 Web App。
  - 主题输入后生成一张 16:9 illustrated explainer。
  - 点击任意位置生成下一页。
  - 页面状态是一条线性路径, 从中间点击会截断后续分支。
  - 前端只发送 query 或归一化坐标, 不持有 prompt 和 API key。
  - 使用 content-addressed cache。
  - child page 使用 red-circle trick: 后端在父图点击处合成红圈, 把带红圈参考图发给图像模型, 让模型理解用户点了哪里。

FollowVine V1 直接采用这些工程原则, 但面向中文知识图解和可选视觉风格。

## OpenAI Image Generation

- URL: https://developers.openai.com/api/docs/guides/image-generation
- 参考点:
  - `gpt-image-2` 可通过 Image API 生成图片。
  - 图片编辑和多步图像体验可以结合参考图片完成。
  - 官方限制包括延迟、文字渲染、视觉一致性、精确构图控制。

FollowVine V1 直接接真实 `gpt-image-2`, 不做假生成器作为主路径。

## OpenAI Pricing

- URL: https://developers.openai.com/api/docs/pricing
- 参考点:
  - `gpt-image-2` 使用 token 计费。
  - 图像输出价格和尺寸、质量相关。

FollowVine V1 必须把缓存作为核心能力, 避免重复生成同一页。

