# 华夏人杰 · 地方志（源码）

一款完全离线的 Android 应用：收录全国 34 个省级行政区、135 处地方的历史名人（1180 位）与文化景区（595 处）详细介绍，并整合哈佛大学 CBDB（中国历代人物传记资料库）13.3 万条结构化人物档案。

> 版权：小虫工作室 @2026
> CBDB 数据来源：China Biographical Database, Harvard University（2023-03-24 版，CC BY-NC-SA 4.0，非商业使用）

## 目录结构

```
app/
├── AndroidManifest.xml        应用清单（零权限，无 INTERNET）
├── build.sh                   一键构建脚本
├── src/com/huaxia/renjie/
│   └── MainActivity.java      原生壳：WebView 加载本地页面
├── res/                       图标、主题、字符串（含版权 strings）
│   ├── mipmap-*/ic_launcher.png
│   └── values/{strings,styles}.xml
└── assets/                    前端（离线 WebApp）
    ├── index.html             主页面
    ├── app.js                 路由、渲染、CBDB 人物库、领域分类
    ├── app.css                中国风样式
    └── data/
        ├── huabei/dongbei/huadong*/huazhong/huanan*/xinan/xibei.js
        │                      七大区分省数据（省 → 地方 → 名人/景区）
        ├── anhui.js          安徽 16 地市专项数据
        ├── more1..15.js      人物增量包（按地名自动并入）
        ├── cbdb.js           CBDB 人物库 133061 条（10.8MB）
        └── cbdb_enrich.js    现有名片的 CBDB 档案补全（427 条）
```

## 数据格式

**地方数据**（`data/*.js`）：

```js
window.REGIONS.push({
  region: "华东",
  provinces: [{
    name: "浙江省", intro: "...",
    places: [{
      name: "绍兴市", brief: "...",
      people: [{ name, era, field, alias, text, quote? }],   // 历史名人
      spots:  [{ name, level, kind, time, text }]            // 文化景区
    }]
  }]
});
```

**人物增量包**（`more*.js`）：

```js
window.MORE_PEOPLE = window.MORE_PEOPLE || {};
window.MORE_PEOPLE["地名"] = (window.MORE_PEOPLE["地名"] || []).concat([
  { name, era, field, alias, text }
]);
```

**CBDB 人物库**（`cbdb.js`）：`window.CBDB_PEOPLE` 为数组，每条
`[id, 姓名, 朝代, 生年, 卒年, 省, 县, 科第, 官职, 字, 号, 著作]`。

## 构建要求

- JDK 8 及以上
- Android SDK：`build-tools;34.0.0` 与 `platforms;android-34`
  （可用 sdkmanager 安装：`sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"`）

## 构建

```bash
ANDROID_SDK_ROOT=/path/to/android-sdk ./build.sh
# 产出：华夏人杰-v1.6.apk（minSdk 21，Android 5.0+）
```

签名密钥由脚本首次运行时自动生成（口令 `huaxia2026`，别名 `huaxia`）。
正式发布请替换为自己的密钥。

## 修改内容

1. **改文字/加人物**：编辑 `assets/data/*.js`（注意不要与同城人物重名，App 启动时会自动去重合并）
2. **加地方**：在对应省份的 `places` 数组中追加条目，需同时含 `people` 与 `spots`
3. **改界面/功能**：`assets/app.js`（路由格式 `#/home|prov|place|field|cbdb|search|fav|about`）
4. 改完重新执行 `./build.sh` 即可

## 功能一览

- 地方志浏览：大区 → 省 → 地方 → 名人/景区双选项卡
- 按领域浏览：科学家 / 文学家 / 艺术家 / 思想家·学者 / 政治·军事 / 实业·先驱（按朝代分组）
- CBDB 人物库：朝代筛选（唐/五代/宋/元/明/清/民国）、省份筛选、关键词搜索
- 寻踪检索：人名、朝代、地名、景区名全局搜索，并自动提示 CBDB 相关人物
- 收藏（本机 localStorage）、随机漫游、名人/景区总览

## 技术说明

原生壳为单 Activity + WebView，全部页面为离线 HTML/JS/CSS，
未申请任何权限（无 INTERNET），可在飞行模式下完整使用。
