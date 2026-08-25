# Earthworm Website

Earthworm Website 是无需 Docker 的独立网页版。课程数据随站点发布；匿名学习时，答题进度、不熟悉/掌握标记、声音偏好、练习模式和最近学习位置保存在当前浏览器。配置 Supabase 后，用户可以通过邮箱和密码登录并跨设备同步；邮箱首次使用时自动创建账号，不需要单独注册。

## 本地预览

```bash
pnpm website:dev
```

## 构建

```bash
pnpm website:build
```

构建产物位于 `apps/website/dist`，采用 Sites/Cloudflare Workers 兼容格式。

Vercel 静态版使用：

```bash
pnpm -F @earthworm/website build:vercel
```

产物位于 `apps/website/out`，不使用服务器函数，因此课程练习不会产生函数调用。

## 数据范围

- 21 个课程包
- 1,240 节课程
- 100,678 条中英文练习
- 英语口语开放语料全量版共 8 卷、778 课、77,779 条可解析的中英文直译关系；不做内容筛选，每条保留 Tatoeba 原始句子 ID，进入单卷时才按需加载正文
- 获授权的新概念英语四册课程共 276 个课文单元、4,795 条逐句练习：第一册 72 个单元、第二册 96 课、第三册 60 课、第四册 48 课
- 新概念路线原创补充课程共 4 个阶段、60 节课、720 条练习；保留已评审的前 5 课，不包含教材原文、答案或原版音频
- 逐词输入和拆句重组两种练习模式
- 进入题目及完成答案后的自动朗读
- 逐词音标、词性、中文释义和保守的句子结构解析
- 自动朗读、打字音效、答题反馈三个独立开关
- 不熟悉复习、掌握标记、计时、暂停和快捷键
- 匿名用户使用浏览器本地进度，保留旧版数据自动迁移
- 邮箱和密码一体化登录，首次登录自动注册；课程进度、不熟悉/掌握标记与偏好设置跨设备云同步

获授权课程数据由 `scripts/import-new-concept-authorized.mjs` 从固定版本的双语 LRC 生成，原创补充课程由 `scripts/generate-new-concept-original.mjs` 生成。执行 `pnpm -F @earthworm/website courses:generate:new-concept` 可重新生成两类课程；生成器会校验四册课数、空课程和重复 ID。

英语口语开放语料全量版由 `scripts/import-oral-english-all.mjs` 从已固定的 Tatoeba 中英直译关系快照生成。执行 `pnpm -F @earthworm/website courses:generate:oral-all` 可重新生成索引和 8 个按需加载的数据卷。语料采用 [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/) 许可，详情和署名见 `THIRD_PARTY_NOTICES.md`。该课程不是同名商业出版物的复制或改编。

## 登录与云同步配置

1. 新建 Supabase 项目，在 SQL Editor 执行 `supabase/migrations/202608230001_learning_progress.sql`。
2. 在 Authentication → Sign In / Providers → Email 中启用 Email provider，并关闭 Confirm email。关闭后，首次输入邮箱和密码即可自动创建账号并直接登录，不发送确认邮件。
3. 根据 `.env.example` 配置 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`；这里只能使用浏览器可公开的 publishable key，禁止使用 service-role key。
4. 在 Vercel 为 Production、Preview 和 Development 配置同名环境变量后重新部署。
5. 在 Authentication → URL Configuration 中把正式站点设为 Site URL，并把 `https://你的域名/reset-password` 加入 Redirect URLs。登录弹窗的“忘记密码”会发送恢复邮件，用户点击链接后可在站内设置新密码。

这一模式登录时不需要 SMTP；但忘记密码、修改邮箱等恢复流程仍需要发送邮件。公开运营前应配置自定义 SMTP，并为注册接口增加 CAPTCHA 或其他防滥用措施。

`learning_progress.state` 会保存课程位置、`statementFamiliarity`（不熟悉/已掌握标记）、最近课程与练习偏好。该表启用了 RLS，登录用户只能读取、创建和更新自己 `user_id` 对应的记录。未配置 Supabase 时，登录入口会说明服务尚未接通，原有本地保存仍然正常工作。

支持 Web Speech 的浏览器优先使用本机系统语音；不支持 Web Speech 的嵌入式浏览器会回退到百度翻译的免密钥 MP3 朗读端点，因此该环境下朗读需要联网，被朗读的英文句子会作为请求参数发送给该服务。匿名用户的学习记录不会离开当前浏览器；登录用户的学习状态会写入其 Supabase 私有记录。
