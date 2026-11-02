# 我的作品：后台设置与人工验收

正式站点：https://product-scene-studio-sooty.vercel.app

## Supabase 只需执行一次 SQL

1. 打开 https://supabase.com/dashboard/project/nlugxhijlfmqskbrnvxw/sql/new 。
2. 打开本项目 `supabase/works.sql`，复制全部内容，粘贴到 SQL Editor，点击 Run。
3. Table Editor 应出现 `studio_works`；Storage 应出现 **Private** 的 `studio-works`。

Vercel 环境变量沿用现有 `SUPABASE_URL` 和 `SUPABASE_PUBLISHABLE_KEY`，不需要 service_role key，不用新增变量。SQL 执行成功后，无需重新发布。

如果 SQL 尚未执行，生成会在调用 Dify 前提示作品存储未就绪；不会假称已经保存。

## 保存内容

- 商品原图：此前浏览器压缩后、实际送入生成的商品参考图。
- 选定比例、场景、请求数量；实际生成的所有图片；生成完成时间。
- 图片在私有 bucket，按 `用户 UUID/作品 UUID/文件名` 存放。
- 生成完成后由服务器把结果图片从 Dify 复制到 Supabase，再提交作品记录，最后提示已保存。
- 仅完成的作品进入列表。失败或未完成请求可能留下不可见的中间记录和文件；不加入管理、删除等额外功能。
- 保存失败时页面会明确提示，保留本次图片供下载，不显示“已保存”。
- 本功能发布前已关闭的旧生成记录无法自动补回。

## 基本验收

1. 登录 A，生成一组图片，确认显示“已保存到我的作品”。
2. 点左侧“我的作品”：应显示原图、参数、时间和结果；点击图片放大、下载。
3. 关闭网页重新打开、再次登录，作品仍在；再生成一组，新作品应排在前面。
4. 登出后，作品界面清空，不能列出作品或下载私人图片。

## 证明 A 看不到 B：两个独立浏览器会话

1. 普通窗口登录 A，无痕窗口登录 B，各生成一组不同作品。
2. 两边“我的作品”各自只有自己的记录。
3. B 打开自己的作品详情，复制地址中的 `work=...` 作品 ID。把这段 ID 填入下面 `B_WORK_ID`。
4. 在 **A 的官网页**打开开发者工具 → Console，运行下面代码。不要把自己的访问 token 贴到聊天或其他地方。

```js
const B_WORK_ID = '替换成 B 的作品 UUID';
const accessToken = await window.studioAuth.getToken();
const authHeaders = {Authorization: `Bearer ${accessToken}`};
const detail = await fetch(`/api/works?id=${B_WORK_ID}`, {headers: authHeaders});
console.log('访问 B 的详情，应为 404：', detail.status);
const picture = await fetch(`/api/work-image?id=${B_WORK_ID}&index=0`, {headers: authHeaders});
console.log('访问 B 的图片，应为 404：', picture.status);
// 绕过本站服务器，直接检查数据库 RLS。
const cfg = await (await fetch('/api/auth-config')).json();
const direct = await fetch(`${cfg.url}/rest/v1/studio_works?id=eq.${B_WORK_ID}&select=id,user_id`, {
  headers: {...authHeaders, apikey: cfg.publishableKey}
});
console.log('直接查询数据库，应为 200 和 []：', direct.status, await direct.json());
```

5. 要进一步验证 Storage：在 Supabase → Storage → studio-works 找到 B 的结果文件，复制完整路径，仍在 A 的 Console 运行：

```js
const B_FILE_PATH = '替换成 B用户UUID/B作品UUID/result-0.png 的真实路径';
const storage = await fetch(`${cfg.url}/storage/v1/object/authenticated/studio-works/${B_FILE_PATH}`, {
  headers: {...authHeaders, apikey: cfg.publishableKey}
});
console.log('直接读取 B 的 Storage 图片必须失败，不能返回 200：', storage.status);
```

6. 将 B 的作品详情地址粘贴到 A 的窗口，也应显示“作品不存在或无权访问”。同样检查 B 访问 A。

不要使用 Supabase SQL Editor 的管理员查询结果证明用户隔离：管理员可绕过 RLS。上述检查必须在真实 A/B 登录会话中执行。

## 隔离机制与验证范围

服务器每次验证 Supabase 用户，再按 user_id 查记录；作品表 RLS 以 auth.uid() 校验所有权；私有 Storage 以路径第一段用户 UUID 校验所有权。服务器使用用户 JWT 和 Publishable key，不使用绕过 RLS 的 service_role。不存在长期公开图片 URL。

代码和未登录接口可本地检查。实际持久化及 A/B 权限验证必须在你执行 SQL、项目 Auth 可用且有两个账号后完成；没有执行 SQL 或真实 A/B 验收前，不应把部署 Ready 当作隔离已验证。

未编写自动化测试。

官方依据：
- https://supabase.com/docs/guides/database/postgres/row-level-security
- https://supabase.com/docs/guides/storage/security/access-control
