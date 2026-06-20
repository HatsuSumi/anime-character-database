# Anime Character Database

一个基于 JSON 维护的二次元角色 / 作品资料库。

目前这些数据集还在陆续补充，并不完善，很多角色的声优（cv）字段以及作品的首映年份（year）和 赛季（season）都没补充，并且有些角色名或作品名存在翻译问题。

默认按照A-Z排序。

个人网站，作品集：[https://hatsusumi.github.io/FinalTestamentProofILived/](https://hatsusumi.github.io/FinalTestamentProofILived/)

这个仓库目前以静态数据文件为核心，适合：

- 公开分发数据
- 本地检索和二次处理
- 前端项目直接读取 JSON
- 用脚本做数据校验和索引生成

## 文件说明

### 1. `ip-data.json`

作品（IP）主数据。

这个文件保存每一个作品 / 系列的基础信息，例如：

- `id`：作品唯一 ID
- `name`：作品中文名 / 当前主显示名称
- `name_en`：作品英文名；如果作品标题本身就是拉丁字母标题，可先与 `name` 相同
- `year`：首映的年份，通常是第一季首映的年份
- `season`：首映的赛季

它相当于这套数据里的“作品表”。

---

### 2. `characters-data.json`

角色主数据。

这个文件保存每一个角色的核心资料，例如：

- `id`：角色唯一 ID
- `name`：角色中文名
- `name_en`：角色英文名 / 罗马音
- `ip_id`：所属作品 ID
- `cv`：声优列表
- `avatar`：角色头像 URL

其中 `cv` 使用字符串数组表示：

```json
"cv": ["花泽香菜"]
```

如果有多个声优，则写成：

```json
"cv": ["声优A", "声优B"]
```

它相当于这套数据里的“角色表”，并通过 `ip_id` 与 `ip-data.json` 建立关联。

---

### 3. `character-lookup.json`

角色查询索引。

这个文件用于把：

- `角色名@作品名`

映射到：

- `角色 ID`

例如：

```json
{
    "立华奏@Angel Beats!": "char_000007"
}
```

它的主要作用是提供快速精确查找，避免每次都遍历 `characters-data.json`。

说明：这个文件是派生索引文件，推荐通过脚本自动生成，而不是手动维护。

---

### 4. `validate-data.js`

数据校验脚本。

这个脚本用于检查当前 JSON 数据是否一致、完整、可用。它会验证例如：

- JSON 顶层结构是否正确
- 对象键和内部 `id` 是否一致
- `characters-data.json` 中的 `ip_id` 是否存在
- `character-lookup.json` 中的角色 ID 是否存在
- lookup 键是否符合 `角色名@作品名` 规则
- `cv` 是否为字符串数组
- `avatar` 是否是合法 URL

运行方式：

```bash
node validate-data.js
```

---

### 5. `generate-character-lookup.js`

角色索引生成脚本。

这个脚本会根据：

- `ip-data.json`
- `characters-data.json`

自动生成：

- `character-lookup.json`

支持两种模式：

#### 检查当前索引是否与主数据一致

```bash
node generate-character-lookup.js --check
```

#### 根据主数据重新生成索引

```bash
node generate-character-lookup.js --write
```

推荐在修改作品或角色数据后运行一次。

---

## 推荐维护流程

当你修改了 `ip-data.json` 或 `characters-data.json` 后，建议按以下顺序处理：

### 1. 重新生成角色索引

```bash
node generate-character-lookup.js --write
```

### 2. 运行数据校验

```bash
node validate-data.js
```

这样可以保证主数据和查询索引始终保持一致。

## 数据结构关系

这套数据目前可以理解为：

- `ip-data.json`：作品主表
- `characters-data.json`：角色主表
- `character-lookup.json`：查询索引表

其中：

- 一个角色通过 `ip_id` 关联到一个作品
- 一个 lookup 条目通过 `角色名@作品名` 映射到角色 ID

## 适用场景

这个仓库更适合以下场景：

- 公开二次元角色资料数据
- 静态站点直接读取
- 前端项目内嵌使用
- 数据分析前的轻量原始数据源
- 个人或小规模维护的数据集
