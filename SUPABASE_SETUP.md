# 注册登录：后台设置与验收

正式网站：https://product-scene-studio-sooty.vercel.app

已基于 `prototype/studio-v3.html` 的深色界面升级正式站点，保留小猫 IP、CAT Logo 和六张示例图。正式入口是上述 HTTPS 网站；双击本地原型文件仍是设计演示，不是联网登录入口。

## Supabase：需要你操作

打开项目：https://supabase.com/dashboard/project/nlugxhijlfmqskbrnvxw

1. Authentication → Sign In / Providers：开启 Allow new users to sign up；Email 保持开启。
2. Authentication → URL Configuration：Site URL 填 `https://product-scene-studio-sooty.vercel.app`。
3. Redirect URLs 添加 `https://product-scene-studio-sooty.vercel.app/`，保存。本地验收时额外添加 `http://127.0.0.1:4173/`。
4. 对外开放且保留邮件确认：在 Authentication 的 Email / SMTP Settings 配置自己的 SMTP。默认发信服务通常只允许向项目团队成员发信，不能直接用于公众注册。

若目前只想立即试用邮箱密码注册，可在 Email 设置中关闭 Confirm email。这样注册成功即可登录，但邮箱不会验证归属；正式开放时建议配置 SMTP 并恢复确认。

账号列表：Authentication → Users。Dify 中的 user 现在采用对应的 Supabase 用户 UUID，上传和生成使用同一用户身份。未增加额外的使用统计界面。

## Vercel：已完成

项目 `product-scene-studio` 的 Production / Preview 已设置：

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- 原有 `DIFY_API_KEY` 保持服务器 Secret。

无需新增数据库表，不需要 service_role key，不用执行 SQL。Publishable key 可用于网页初始化；Dify 密钥仅由服务器读取。

## 怎么验收

1. 无痕窗口打开官网：上传商品图，点击生成，必须先登录。
2. 注册自己的邮箱和密码；开启邮件确认时先在邮箱里确认。
3. 登录后，右上角显示邮箱；生成一张图应能返回并下载。
4. 刷新页面，登录状态保留。点击退出，邮箱消失，不能继续生成。
5. Supabase → Users 能看到刚注册的账号。

## 已验证与限制

本地注册/登录表单切换、未登录上传和生成的 401 拦截已人工检查。没有编写自动化测试。

本机请求 Supabase Auth 时连接被重置，因此未完成真实邮箱注册、登录和已登录生成的端到端验证；请完成上述配置后按步骤验收。仅凭 Publishable key 无法修改后台 Auth 配置。

官方依据：

- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/redirect-urls
