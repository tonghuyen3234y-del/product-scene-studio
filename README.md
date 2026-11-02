# 商品场景图生成器

静态介绍页和自定义生成界面位于 `public/`。`api/` 是 Vercel Node.js 服务端函数：上传、Chatflow 流式生成、签名图片下载。密钥只从服务器环境变量读取。

## 本地运行

Node.js 22 或更高版本。复制 `.env.example` 为 `.env.local`，填写 `DIFY_API_KEY`、`SUPABASE_URL` 和 `SUPABASE_PUBLISHABLE_KEY`。可选 `DIFY_API_URL`，默认为 `https://api.dify.ai/v1`。真实密钥仅保存在被 Git 和部署忽略的 `.env.local` 中。

```sh
npm ci
npm run dev
```

打开 http://127.0.0.1:4173 。上传图片后，浏览器自动转成 JPEG 并压缩到不超过 3,000,000 字节，再发送到本站后端。HEIC 转换库已包含在静态资源中。

## Vercel

项目：`product-scene-studio`。正式地址：https://product-scene-studio-sooty.vercel.app 。`DIFY_API_KEY` 在 Production / Preview 中设置为 Secret。函数最长运行 300 秒。

发布命令：

```sh
npx vercel deploy --prod --scope team_vd8HxxsUAgSMuq6qgXjzhT1J
```

## 人工验收

上传商品照，选择尺寸和场景，数量默认 2（仅可选 1–4），点击生成。观察实际步骤，等待图片墙出现，逐张点击下载。手机端检查压缩后的体积显示和竖向布局。

图片 URL 由 Dify 签名，有有效期；请及时下载。生成过程中关闭页面会中断本网站的连接。账号设置见 `SUPABASE_SETUP.md`；作品持久化需要先执行 `supabase/works.sql`，详见 `WORKS_SETUP.md`。

## 密钥与 GitHub

GitHub 仅保存源码，不保存真实环境变量。`.env.local`、`.vercel/`、依赖和本地验收截图均不会提交。`.env.example` 仅包含空值和公开服务地址。

通过 Vercel 连接此 GitHub 仓库后，在项目环境变量中配置上述变量，再部署。`DIFY_API_KEY` 仅供服务器函数读取，不能放入前端脚本或带 `NEXT_PUBLIC_` / `VITE_` 前缀的变量中。Supabase Publishable key 用于客户端登录初始化，不是服务端管理密钥；不要填入 service_role key。

API 依据：
- https://docs.dify.ai/en/api-reference/chat-messages/send-chat-message
- https://docs.dify.ai/en/api-reference/files/upload-file
- https://docs.dify.ai/en/api-reference/guides/streaming
