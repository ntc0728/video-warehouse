# Issue 跟踪器：本地 Markdown

本仓库的 Issue 和 PRD 以 markdown 文件形式存放在 `.scratch/` 目录下。

## 约定

- 每个功能一个目录：`.scratch/<feature-slug>/`
- PRD 文件：`.scratch/<feature-slug>/PRD.md`
- 实现 Issue：`.scratch/<feature-slug>/issues/<NN>-<slug>.md`，编号从 `01` 开始
- Triage 状态记录在每个 issue 文件顶部的 `Status:` 行（标签字符串见 `triage-labels.md`）
- 讨论和评论追加到文件底部的 `## Comments` 标题下

## 技能说"发布到 issue 跟踪器"时

在 `.scratch/<feature-slug>/` 下创建新文件（如目录不存在则自动创建）。

## 技能说"获取相关 ticket"时

读取指定路径的文件。用户通常会直接提供路径或 issue 编号。
