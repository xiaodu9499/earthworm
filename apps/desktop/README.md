# Earthworm Desktop

Earthworm Desktop 是面向 macOS 和 Windows 的完全独立离线客户端。它使用 Electron 提供原生应用窗口，内置 Nuxt 前端、本地课程 API 和课程数据，不依赖 Docker、PostgreSQL、Redis 或 Logto。

## 数据存储

课程数据打包在应用内部。学习进度、掌握列表、课程完成次数和学习时长保存在 Electron 的用户数据目录中；升级应用不会清空这些数据。

## 开发

```bash
pnpm desktop:dev
```

## 打包

```bash
# macOS ARM64 和 Intel：DMG + ZIP
pnpm desktop:build:mac

# Windows x64：NSIS 安装包 + 便携版
pnpm desktop:build:win
```

打包前会从开发环境的 Earthworm 数据库导出公开课程，并生成离线 Nuxt 资源。产物位于 `apps/desktop/dist`；最终用户运行安装包时不需要 Docker。

当前 macOS 产物使用本地签名但未经过 Apple 公证；Windows 产物未配置正式的 Authenticode 发布证书。面向其他用户公开分发前，应配置对应平台的开发者证书与签名流程。
