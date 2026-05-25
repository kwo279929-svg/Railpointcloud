# 铁路点云项目作品集网页

这是一个面向实习招聘的静态作品集网页，用于展示铁路隧道滑槽检测和铁路 OCS 腕臂部件识别与测距项目。

## 本地预览

在 `portfolio-site` 目录启动静态服务：

```bash
python -m http.server 4173
```

浏览器打开：

```text
http://localhost:4173
```

## 部署到 GitHub Pages

1. 新建 GitHub 仓库，例如 `rail-pointcloud-portfolio`。
2. 上传 `portfolio-site` 目录中的 `index.html`、`styles.css`、`app.js` 和 `README.md`。
3. 在仓库 `Settings -> Pages` 中选择 `Deploy from a branch`。
4. Branch 选择 `main`，目录选择 `/root`。
5. 保存后等待部署完成，GitHub 会生成一个公开访问链接。

## 后续可替换内容

- 将首页姓名、邮箱和求职方向替换为真实信息。
- 将模拟点云替换为真实项目数据转换后的前端点云。
- 补充项目时间、工具链、测距误差、处理数据规模和真实可视化截图。
