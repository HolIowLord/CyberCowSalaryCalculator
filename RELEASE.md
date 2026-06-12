# 发布说明

`CyberCowSalaryCalculator.zip` 是给普通用户下载的解压即用版本。

由于当前 zip 约 120MB，超过 GitHub 普通 Git 单文件 100MB 限制，因此不要把 zip 直接提交到仓库。推荐把它作为 GitHub Release 附件发布。

## 自动发布

仓库已包含 GitHub Actions 工作流：

```text
.github/workflows/release.yml
```

触发方式：

- 在 GitHub 页面手动运行 `Build Release`
- 或推送版本标签，例如 `v0.1.0`

```powershell
git tag v0.1.0
git push origin v0.1.0
```

工作流会生成：

```text
CyberCowSalaryCalculator.zip
```

如果是 tag 触发，zip 会自动挂到对应 GitHub Release。

## 本地发布

本地已经生成的发布包位于：

```text
publish\CyberCowSalaryCalculator.zip
```

这个目录被 `.gitignore` 忽略，不会进入源码仓库。需要手动发布时，可以在 GitHub Release 页面上传该 zip。

## 用户使用

用户下载 `CyberCowSalaryCalculator.zip` 后：

1. 解压 zip
2. 运行解压出来的 `CyberCowSalaryCalculator.exe`
