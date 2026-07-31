# 本地更新日志工作流

这套工具使用文件内容哈希比较当前博客与上次收集时的差异，不依赖源码目录中的 Git 仓库。

## 常用命令

```bash
# 手动检测并收集变化
npm run changelog:collect

# 查看尚未发布的更新
npm run changelog:status

# 添加自动检测无法准确描述的内容
npm run changelog:add -- "新增音乐播放器的音量和播放模式"

# 指定更新类型
npm run changelog:add -- "调整手机端背景" --type=style

# 将所有待发布内容整理到现有网站日志页面
npm run changelog:publish

# 使用自定义标题发布
npm run changelog:publish -- --title="七月网站功能更新"
```

`npm run deploy` 会通过 npm 的 `predeploy` 生命周期自动执行一次
`changelog:collect`，随后依次执行 `hexo generate` 和 `hexo deploy`。
直接运行 `hexo deploy` 或 `hexo d` 不会触发收集，因此建议统一使用：

```bash
npm run deploy
```

## 本地文件

快照和待发布队列保存在：

```text
.local/changelog/state.json
.local/changelog/pending.json
```

`.local/` 已加入 `.gitignore`，并且不在 Hexo 的 `source` 目录中，因此不会进入生成的网站。

## 发布阈值

默认达到以下任一条件时提示发布：

- 累计 20 条更新；
- 最早一条更新已保存 30 天。

可以在 `changelog.config.json` 中调整：

```json
{
  "threshold": {
    "entries": 5,
    "days": 14
  },
  "autoPublishOnThreshold": false
}
```

保持 `autoPublishOnThreshold` 为 `false` 时，只会提示，不会自行修改日志页面。
设置为 `true` 后，部署前收集达到阈值时会自动生成正式日志。

## 自动识别规则

- `source/_posts` 新文件：发布新文章；
- `source/_posts` 修改或删除：更新或移除文章；
- `source/js`、`source/css`：新增、优化或移除组件；
- `_config.butterfly.yml`：主题与视觉调整；
- `source/img`、`source/downloads`：图片和附件资源；
- `scripts`、`tools`：构建脚本与自动化工具；
- `package.json`、`package-lock.json`、`_config.yml`：配置、依赖与维护。

对于自动描述不够准确的变化，可以用 `changelog:add` 增加一条人工说明。
