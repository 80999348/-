/* 华夏人杰 · 地方志 —— 前端逻辑（完全离线） */
(function () {
  var REGIONS = window.REGIONS || [];
  // 同一大区可能由多个数据文件提供，合并之
  (function () {
    var seen = {}, out = [];
    REGIONS.forEach(function (r) {
      if (seen[r.region]) { seen[r.region].provinces = seen[r.region].provinces.concat(r.provinces || []); }
      else { seen[r.region] = r; out.push(r); }
    });
    REGIONS = out;
  })();
  // 增量人物包：{ 地方名: [ {name, era, field, alias, text}, ... ] }
  (function () {
    var MORE = window.MORE_PEOPLE || {};
    REGIONS.forEach(function (r) {
      (r.provinces || []).forEach(function (p) {
        (p.places || []).forEach(function (pl) {
          var add = MORE[pl.name];
          if (!add || !add.length) return;
          pl.people = pl.people || [];
          var have = {};
          pl.people.forEach(function (x) { have[x.name] = 1; });
          add.forEach(function (x) {
            if (x && x.name && !have[x.name]) { pl.people.push(x); have[x.name] = 1; }
          });
        });
      });
    });
  })();
  var PROV = {};        // 省名 -> 省对象
  var PLACES = [];      // 全部地方（附省、地区信息）
  var PEOPLE_N = 0, SPOT_N = 0;

  /* ---------- CBDB 人物库 ---------- */
  // 数组格式：[id, 姓名, 朝代, 生年, 卒年, 省, 县, 科第, 官职, 字, 号, 著作]
  var CBDB = window.CBDB_PEOPLE || [];
  var CBMETA = window.CBDB_META || {};
  var CBE = window.CBDB_ENRICH || {};
  var CB_BY_ID = {}, CB_PROV_IDX = {}, CB_PROV_COUNT = {};
  CBDB.forEach(function (r) {
    CB_BY_ID[r[0]] = r;
    var pv = r[5] || "";
    if (pv) {
      (CB_PROV_IDX[pv] = CB_PROV_IDX[pv] || []).push(r);
      CB_PROV_COUNT[pv] = (CB_PROV_COUNT[pv] || 0) + 1;
    }
  });
  var cbQ = "", cbDyn = "", cbProv = "", cbPage = 1, cbKey = "", cbTimer = null, cbCache = [];
  var CB_PROVS = (function () {
    var seen = {}, out = [];
    CBDB.forEach(function (r) { if (r[5] && !seen[r[5]]) { seen[r[5]] = 1; out.push(r[5]); } });
    return out.sort(function (a, b) { return a.localeCompare(b, "zh"); });
  })();
  function cbCount(prov) {
    if (!prov) return CBDB.length;
    return CB_PROV_COUNT[prov] || 0;
  }
  var favs = [];
  var curTab = "people";

  try { favs = JSON.parse(localStorage.getItem("hxrj_fav") || "[]"); } catch (e) { favs = []; }
  function saveFav() { try { localStorage.setItem("hxrj_fav", JSON.stringify(favs)); } catch (e) {} }

  REGIONS.forEach(function (r) {
    (r.provinces || []).forEach(function (p) {
      p.region = r.region;
      PROV[p.name] = p;
      (p.places || []).forEach(function (pl) {
        pl.prov = p.name;
        pl.region = r.region;
        PLACES.push(pl);
        PEOPLE_N += (pl.people || []).length;
        SPOT_N += (pl.spots || []).length;
      });
    });
  });

  /* ---------- 领域分类 ---------- */
  // 把细粒度 field 归入六大类，供「按领域浏览」使用
  var CATS = [
    { id: "science", name: "科学家", icon: "科", keys: ["科学", "数学", "天文", "历算", "医学", "药学", "医药", "地理", "地质", "工程", "水利", "农学", "物理", "化学", "生物", "建筑", "铁路", "桥梁", "航天", "航空", "兵工", "机械", "发明", "算学", "地图", "气象", "考古", "地质学", "土壤", "植物", "兽医", "船政", "造船", "光学", "力学家", "声学", "遥感", "核物理", "导弹", "火箭", "计算机", "半导体", "采访博物"] },
    { id: "letters", name: "文学家", icon: "文", keys: ["文学", "诗人", "词人", "作家", "小说", "散文", "戏剧", "戏曲", "剧作家", "曲家", "诗论", "文论", "辞赋", "骈文", "寓言", "儿童文学", "翻译家", "编剧", "歌词", "民间文艺", "红学", "文艺报", "报告文学", "诗文", "文章", "诗集", "联家", "楹联", "民歌", "歌谣", "杂剧", "传奇家", "弹词", "评话", "赋", "文选学"] },
    { id: "arts", name: "艺术家", icon: "艺", keys: ["艺术", "画家", "绘画", "书法", "篆刻", "雕刻", "雕塑", "音乐", "作曲", "琴", "琵琶", "古琴", "歌唱", "声乐", "京剧", "昆曲", "越剧", "黄梅戏", "豫剧", "评剧", "粤剧", "川剧", "秦腔", "话剧", "表演", "演员", "导演", "摄影", "漫画", "连环画", "版画", "工艺美术", "陶瓷", "织绣", "刺绣", "剪纸", "面塑", "泥塑", "壁画", "指画", "指头", "曲艺", "相声", "评弹", "鼓书", "二人转", "杂技", "魔术", "舞美", "皮影", "木偶", "装裱", "鉴藏", "设计", "服装", "舞"] },
    { id: "thinkers", name: "思想家·学者", icon: "思", keys: ["思想", "哲学", "儒学", "理学", "心学", "经学", "史学", "史学家", "教育家", "学者", "训诂", "文字", "音韵", "文献", "版本", "目录", "校勘", "藏书", "书院", "朴学", "考据", "汉学", "宋学", "易学", "礼学", "佛学", "高僧", "法师", "道士", "道学", "玄学", "逻辑", "美学", "伦理", "社会", "民族", "人类", "语言", "新闻", "报人", "出版", "编辑", "律师", "法学家", "法学", "财政", "经济", "金融", "银行", "统计", "贸易", "管理"] },
    { id: "statesmen", name: "政治·军事", icon: "政", keys: ["政治", "帝王", "皇帝", "宰相", "丞相", "大臣", "尚书", "总督", "巡抚", "知府", "知县", "太守", "刺史", "节度", "将军", "将领", "元帅", "军事", "革命", "烈士", "红军", "八路", "新四军", "抗联", "义军", "起义", "领袖", "总统", "主席", "总理", "部长", "省委", "外交", "使节", "清官", "循吏", "贤相", "名臣", "谏臣", "御史", "宦官", "后妃", "太后", "可汗", "酋长", "土司", "王", "侯", "公", "伯", "督师", "提督", "总兵", "参将", "游击", "守备", "都护", "都督", "统制", "招讨", "经略", "宣抚", "安抚", "团练", "乡勇", "水师", "海军", "空军", "陆军", "警察", "宪兵", "特科"] },
    { id: "pioneers", name: "实业·先驱", icon: "实", keys: ["实业", "企业家", "商人", "商", "实业家", "侨", "华侨", "船王", "矿业", "纺织", "面粉", "火柴", "盐商", "票号", "钱庄", "银行家", "买办", "洋务", "维新", "改良", "公益", "慈善", "慈善家", "医生", "医师", "中医", "西医", "护士", "红十字", "妇女", "女杰", "巾帼", "运动", "体育", "运动员", "棋", "武术", "拳师", "镖师", "匠", "技师", "工匠", "能工", "巧匠", "名医"] }
  ];
  function catOf(field) {
    var f = field || "";
    for (var i = 0; i < CATS.length; i++) {
      var ks = CATS[i].keys;
      for (var j = 0; j < ks.length; j++) if (f.indexOf(ks[j]) >= 0) return CATS[i].id;
    }
    return "statesmen";
  }
  var PEOPLE_ALL = [];
  PLACES.forEach(function (pl) {
    (pl.people || []).forEach(function (x) { PEOPLE_ALL.push({ x: x, pl: pl, cat: catOf(x.field) }); });
  });

  // 把 CBDB 结构化档案挂到现有名人条目上（按 省|地方|姓名 匹配）
  (function () {
    PLACES.forEach(function (pl) {
      (pl.people || []).forEach(function (x) {
        var e = CBE[pl.prov + "|" + pl.name + "|" + x.name];
        if (e) x.cb = e;
      });
    });
  })();

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function enc(s) { return encodeURIComponent(s); }
  function dec(s) { try { return decodeURIComponent(s); } catch (e) { return s; } }
  function hl(text, q) {
    var t = esc(text);
    if (!q) return t;
    var qq = esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try { return t.replace(new RegExp(qq, "gi"), function (m) { return "<mark>" + m + "</mark>"; }); }
    catch (e) { return t; }
  }
  function favKey(kind, place, name) { return kind + "|" + place + "|" + name; }
  function isFav(k, p, n) { return favs.indexOf(favKey(k, p, n)) >= 0; }
  function placeOf(name) {
    for (var i = 0; i < PLACES.length; i++) if (PLACES[i].name === name) return PLACES[i];
    return null;
  }
  function countProv(p) {
    var a = 0, b = 0;
    (p.places || []).forEach(function (x) { a += (x.people || []).length; b += (x.spots || []).length; });
    return [a, b];
  }

  /* ---------- 视图 ---------- */
  var $view = document.getElementById("view");
  var $title = document.getElementById("pageTitle");
  var $sub = document.getElementById("pageSub");
  var $back = document.getElementById("backBtn");

  function setHead(title, sub, showBack) {
    $title.textContent = title;
    $sub.textContent = sub || "";
    if (showBack) $back.classList.remove("hidden"); else $back.classList.add("hidden");
  }
  function setTab(name) {
    [].forEach.call(document.querySelectorAll("#tabbar a"), function (a) {
      a.classList.toggle("on", a.getAttribute("data-tab") === name);
    });
  }
  function scrollTop() { $view.scrollTop = 0; }

  /* ---------- 首页 ---------- */
  function viewHome() {
    setHead("华夏人杰", "名人 · 胜迹 · 一方水土", false);
    setTab("home");
    var h = '';
    h += '<section class="hero">' +
      '<div class="kicker">C H I N A · 地 方 志</div>' +
      '<h2>一方水土，<em>养一方人</em></h2>' +
      '<p>从燕赵慷慨到江南烟雨，循着人名与地名，走一遍中国。</p>' +
      '</section>';
    h += '<div class="stat-row">' +
      stat(PROV_COUNT(), "省级行政区") + stat(PLACES.length, "地方") +
      stat(PEOPLE_N, "历史名人") + stat(SPOT_N, "文化景区") + '</div>';
    h += '<div class="quick">' +
      '<button data-act="random"><i>☰</i>随机漫游</button>' +
      '<button data-act="fields"><i>类</i>按领域浏览</button>' +
      '<button data-act="allpeople"><i>人</i>名人总览</button>' +
      '<button data-act="allspots"><i>景</i>景区总览</button>' +
      '</div>';
    // 领域入口条
    h += '<div class="field-grid">';
    CATS.forEach(function (c) {
      var n = 0;
      PEOPLE_ALL.forEach(function (it) { if (it.cat === c.id) n++; });
      h += '<a class="field-card" href="#/field/' + c.id + '">' +
        '<span class="ficon">' + c.icon + '</span><b>' + esc(c.name) + '</b>' +
        '<small>' + n + ' 位</small></a>';
    });
    h += '</div>';
    h += '<a class="cbdb-banner" href="#/cbdb">' +
      '<div class="cbdb-banner-hd"><span class="cbdb-mark">CBDB</span><b>中国历代人物传记资料库</b></div>' +
      '<p>哈佛大学主持的 53 万人人物数据库，已整合 <b>' + (CBDB.length / 10000).toFixed(0) + ' 万条</b>可考籍贯的官员、进士与士人档案，可按朝代与省份检索。</p>' +
      '<span class="cbdb-go">进入人物库 ›</span></a>';

    REGIONS.forEach(function (r) {
      h += '<div class="region-head"><h3>' + esc(r.region) + '</h3><div class="rule"></div></div>';
      h += '<div class="prov-grid">';
      (r.provinces || []).forEach(function (p) {
        var c = countProv(p);
        h += '<a class="prov-card" href="#/prov/' + enc(p.name) + '">' +
          '<span class="abbr">' + esc(p.abbr || p.name.charAt(0)) + '</span>' +
          '<b>' + esc(p.name) + '</b>' +
          '<small>' + p.places.length + ' 处地方 · ' + c[0] + ' 位名人</small>' +
          '<div class="bar"></div></a>';
      });
      h += '</div>';
    });
    h += '<div class="home-foot"><span>华夏人杰 · 地方志</span><b>小虫工作室 @2026</b></div>';
    return h;
  }
  function PROV_COUNT() { var n = 0; REGIONS.forEach(function (r) { n += (r.provinces || []).length; }); return n; }
  function stat(n, t) { return '<div class="stat"><b>' + n + '</b><span>' + t + '</span></div>'; }

  /* ---------- 省份页 ---------- */
  function viewProv(name) {
    var p = PROV[name];
    if (!p) return notFound();
    setHead(p.name, p.region + " · 共 " + p.places.length + " 处地方", true);
    setTab("home");
    var c = countProv(p);
    var h = '<section class="prov-hero"><span class="bigchar">' + esc(p.abbr || p.name.charAt(0)) + '</span>' +
      '<h2>' + esc(p.name) + '</h2>' +
      '<p>' + esc(p.intro || "") + '</p>' +
      '<p>' + p.places.length + ' 处地方 · ' + c[0] + ' 位历史名人 · ' + c[1] + ' 处文化景区</p></section>';
    var short = provShort(p.name);
    var cn = cbCount(short);
    if (cn) {
      h += '<a class="cb-prov-link" href="#/cbdb/p/' + enc(short) + '">CBDB 本省人物 · ' + cn + ' 位 ›</a>';
    }
    h += '<div class="place-list">';
    p.places.forEach(function (pl) {
      var names = (pl.people || []).slice(0, 4).map(function (x) { return x.name; }).join("、");
      h += '<a class="place-card" href="#/place/' + enc(p.name) + '/' + enc(pl.name) + '">' +
        '<span class="arrow">›</span>' +
        '<h4><span class="dot"></span>' + esc(pl.name) + '</h4>' +
        '<p>' + esc(pl.brief || "") + '</p>' +
        '<div class="chips">' +
        '<span class="chip red">名人 ' + (pl.people || []).length + '</span>' +
        '<span class="chip">景区 ' + (pl.spots || []).length + '</span>' +
        (names ? '<span class="chip">' + esc(names) + '</span>' : '') +
        '</div></a>';
    });
    h += '</div><div style="height:12px"></div>';
    return h;
  }

  /* ---------- 地方详情 ---------- */
  function viewPlace(pname, plname) {
    var p = PROV[pname], pl = null;
    if (p) (p.places || []).forEach(function (x) { if (x.name === plname) pl = x; });
    if (!pl) return notFound();
    setHead(pl.name, pname + " · " + (pl.people || []).length + " 名人 · " + (pl.spots || []).length + " 景区", true);
    setTab("home");
    var h = '<section class="place-hero"><span class="watermark">' + esc(pl.name.replace(/[市区县旗]$/, "").slice(0, 1)) + '</span>' +
      '<div class="crumb">' + esc(p.region) + ' / ' + esc(pname) + '</div>' +
      '<h2>' + esc(pl.name) + (pl.alias ? '<span style="font-size:13px;opacity:.7;margin-left:8px">' + esc(pl.alias) + '</span>' : '') + '</h2>' +
      '<p>' + esc(pl.brief || "") + '</p></section>';
    h += '<div class="tabs">' +
      '<button data-tab-btn="people" class="' + (curTab === "people" ? "on" : "") + '">历史名人 · ' + (pl.people || []).length + '</button>' +
      '<button data-tab-btn="spots" class="' + (curTab === "spots" ? "on" : "") + '">文化景区 · ' + (pl.spots || []).length + '</button>' +
      '</div>';
    if (curTab === "people") {
      h += '<div class="section-note">点击右上「藏」可收藏；长文为一方水土的人物小传</div>';
      h += '<div class="entry-list">';
      (pl.people || []).forEach(function (x, i) {
        h += entryHTML("person", pl, x, i);
      });
      h += '</div>';
    } else {
      h += '<div class="section-note">景区等级以官方最新公布为准，出行前请核实开放信息</div>';
      h += '<div class="entry-list">';
      (pl.spots || []).forEach(function (x, i) {
        h += entryHTML("spot", pl, x, i);
      });
      h += '</div>';
    }
    h += '<div style="height:10px"></div>';
    return h;
  }

  function provShort(pv) {
    return String(pv || "").replace(/(省|市|自治区|特别行政区|壮族|回族|维吾尔)/g, "");
  }
  function cbNoteHTML(e, pv) {
    var short = provShort(pv);
    var line1 = [], line2 = [];
    var life = "";
    if (e.b && e.x) life = e.b + "—" + e.x;
    else if (e.b) life = "生 " + e.b;
    else if (e.x) life = "卒 " + e.x;
    if (life) line1.push(life);
    if (e.p && e.p === short) line1.push(e.p + (e.c && e.c !== e.p ? "·" + e.c : ""));
    if (e.z) line2.push("字 " + e.z);
    if (e.h) line2.push("号 " + e.h);
    if (e.e) line2.push(e.e);
    if (e.o) line2.push(String(e.o).split("、")[0]);
    if (e.w) line2.push("著《" + String(e.w).split("、")[0] + "》");
    var h = '<a class="cb-note" href="#/cbdb/id/' + e.id + '"><b>CBDB 档案</b>';
    if (line1.length) h += '<span>' + esc(line1.join(" · ")) + '</span>';
    if (line2.length) h += '<span>' + esc(line2.join(" · ")) + '</span>';
    h += '<i>查看详细档案 ›</i></a>';
    return h;
  }

  function entryHTML(kind, pl, x, i) {
    var star = isFav(kind, pl.prov + "|" + pl.name, x.name) ? "on" : "";
    var h = '<article class="entry ' + (kind === "spot" ? "spot" : "") + '" id="' + kind + "-" + i + '">';
    h += '<div class="hd"><h3>' + esc(x.name) + '</h3>' +
      '<button class="star ' + star + '" data-star="' + kind + '" data-place="' + esc(pl.prov + "|" + pl.name) + '" data-name="' + esc(x.name) + '">★</button></div>';
    h += '<div class="meta">';
    if (kind === "person") {
      if (x.era) h += '<span class="tag">' + esc(x.era) + '</span>';
      if (x.field) h += '<span class="tag j">' + esc(x.field) + '</span>';
      if (x.alias) h += '<span class="tag g">' + esc(x.alias) + '</span>';
    } else {
      if (x.level) h += '<span class="tag">' + esc(x.level) + '</span>';
      if (x.kind) h += '<span class="tag j">' + esc(x.kind) + '</span>';
      if (x.time) h += '<span class="tag g">' + esc(x.time) + '</span>';
    }
    h += '</div>';
    h += '<p class="txt">' + esc(x.text) + '</p>';
    if (x.quote) h += '<p class="txt q">' + esc(x.quote) + '</p>';
    if (kind === "person" && x.cb) h += cbNoteHTML(x.cb, pl.prov);
    h += '</article>';
    return h;
  }

  /* ---------- 搜索 ---------- */
  function viewSearch() {
    setHead("寻踪", "人名 · 地名 · 景区名", false);
    setTab("search");
    var h = '<div class="search-wrap"><label class="search-box"><span>寻</span>' +
      '<input id="q" type="search" placeholder="搜人名、地名或景区，如 苏轼 / 敦煌 / 平遥" autocomplete="off"></label></div>';
    h += '<div class="hint">全书完全离线，可按人物、朝代、景区、地方任意检索。</div>';
    h += '<div class="hotwords">' + ["苏东坡", "杜甫", "王阳明", "故宫", "敦煌", "平遥", "徽州", "长城", "鲁迅", "景德镇"]
      .map(function (w) { return '<button data-hot="' + w + '">' + w + '</button>'; }).join("") + '</div>';
    h += '<div id="results"></div>';
    return h;
  }

  function doSearch(q) {
    var box = document.getElementById("results");
    if (!box) return;
    q = (q || "").trim();
    if (!q) { box.innerHTML = ''; return; }
    var people = [], spots = [], places = [];
    PLACES.forEach(function (pl) {
      if ((pl.name + pl.prov + (pl.alias || "")).indexOf(q) >= 0) places.push(pl);
      (pl.people || []).forEach(function (x) {
        if ((x.name + (x.era || "") + (x.field || "") + (x.alias || "") + x.text).indexOf(q) >= 0)
          people.push({ x: x, pl: pl });
      });
      (pl.spots || []).forEach(function (x) {
        if ((x.name + (x.kind || "") + (x.level || "") + x.text).indexOf(q) >= 0)
          spots.push({ x: x, pl: pl });
      });
    });
    var total = people.length + spots.length + places.length;
    var h = '';
    if (!total) {
      h = '<div class="empty"><span class="big">无</span>未找到「' + esc(q) + '」<br>试试换成地名（如「绍兴」）或朝代（如「唐」）</div>';
      box.innerHTML = h; return;
    }
    var cbHits = [];
    for (var ci = 0; ci < CBDB.length && cbHits.length < 200; ci++) {
      var rr = CBDB[ci];
      if ((rr[1] + " " + (rr[5] || "") + " " + (rr[6] || "") + " " + (rr[9] || "") + " " + (rr[10] || "")).indexOf(q) >= 0) cbHits.push(rr);
    }
    h += '<div class="res-title">检索结果 · 共 ' + total + ' 条</div>';
    if (cbHits.length) {
      h += '<a class="cbdb-banner small" href="#/cbdb/q/' + enc(q) + '">' +
        '<div class="cbdb-banner-hd"><span class="cbdb-mark">CBDB</span><b>人物库中有 ' + cbHits.length +
        (cbHits.length >= 200 ? '+' : '') + ' 位相关人物</b></div>' +
        '<p>' + esc(cbHits.slice(0, 5).map(function (r) { return r[1]; }).join("、")) + ' ……</p>' +
        '<span class="cbdb-go">在人物库中查看 ›</span></a>';
    }
    if (people.length) {
      h += '<div class="res-title">历史名人 ' + people.length + '</div><div class="res-list">';
      people.slice(0, 60).forEach(function (it) {
        h += '<a class="res-item" href="#/place/' + enc(it.pl.prov) + '/' + enc(it.pl.name) + '">' +
          '<b>' + hl(it.x.name, q) + '</b>' +
          '<small>' + esc(it.pl.prov) + ' · ' + esc(it.pl.name) + (it.x.era ? " · " + esc(it.x.era) : "") + (it.x.field ? " · " + esc(it.x.field) : "") + '</small>' +
          '<p>' + hl(it.x.text, q) + '</p></a>';
      });
      h += '</div>';
    }
    if (spots.length) {
      h += '<div class="res-title">文化景区 ' + spots.length + '</div><div class="res-list">';
      spots.slice(0, 60).forEach(function (it) {
        h += '<a class="res-item" href="#/place/' + enc(it.pl.prov) + '/' + enc(it.pl.name) + '">' +
          '<b>' + hl(it.x.name, q) + '</b>' +
          '<small>' + esc(it.pl.prov) + ' · ' + esc(it.pl.name) + (it.x.level ? " · " + esc(it.x.level) : "") + (it.x.kind ? " · " + esc(it.x.kind) : "") + '</small>' +
          '<p>' + hl(it.x.text, q) + '</p></a>';
      });
      h += '</div>';
    }
    if (places.length) {
      h += '<div class="res-title">地方 ' + places.length + '</div><div class="res-list">';
      places.slice(0, 60).forEach(function (pl) {
        h += '<a class="res-item" href="#/place/' + enc(pl.prov) + '/' + enc(pl.name) + '">' +
          '<b>' + hl(pl.name, q) + '</b><small>' + esc(pl.prov) + ' · ' + (pl.people || []).length + ' 名人 · ' + (pl.spots || []).length + ' 景区</small>' +
          '<p>' + hl(pl.brief || "", q) + '</p></a>';
      });
      h += '</div>';
    }
    h += '<div style="height:20px"></div>';
    box.innerHTML = h;
  }

  /* ---------- 总览列表 ---------- */
  function viewAll(kind) {
    setHead(kind === "people" ? "名人总览" : "景区总览", "按地方排列", true);
    setTab("home");
    var h = '<div class="section-note">共 ' + (kind === "people" ? PEOPLE_N : SPOT_N) + ' 条，点击进入所属地方</div>';
    h += '<div class="entry-list">';
    PLACES.forEach(function (pl) {
      var arr = kind === "people" ? pl.people : pl.spots;
      if (!arr || !arr.length) return;
      h += '<a class="res-item" href="#/place/' + enc(pl.prov) + '/' + enc(pl.name) + '">' +
        '<b>' + esc(pl.name) + '</b><small>' + esc(pl.prov) + '</small>' +
        '<p>' + esc(arr.map(function (x) { return x.name; }).join(" · ")) + '</p></a>';
    });
    h += '</div>';
    return h;
  }

  /* ---------- 领域浏览 ---------- */
  var curField = "";
  var ERA_ORDER = { "先秦": 1, "商": 2, "周": 2, "春秋": 3, "战国": 4, "秦": 5, "汉": 6, "西汉": 6, "东汉": 7, "三国": 8, "魏晋": 9, "两晋": 9, "东晋": 9, "南北朝": 10, "隋": 11, "唐": 12, "五代": 13, "宋": 14, "北宋": 14, "南宋": 15, "辽": 16, "金": 17, "元": 18, "明": 19, "清": 20, "近代": 21, "晚清": 21, "民国": 21, "现代": 22, "当代": 23 };
  function eraRank(era) {
    if (!era) return 50;
    for (var k in ERA_ORDER) if (era.indexOf(k) >= 0) return ERA_ORDER[k];
    return 50;
  }
  function viewField(id) {
    var cat = null;
    CATS.forEach(function (c) { if (c.id === id) cat = c; });
    if (!cat) return notFound();
    curField = id;
    var items = [];
    PEOPLE_ALL.forEach(function (it) { if (it.cat === id) items.push(it); });
    items.sort(function (a, b) {
      var d = eraRank(a.x.era) - eraRank(b.x.era);
      return d !== 0 ? d : a.pl.name.localeCompare(b.pl.name, "zh");
    });
    setHead(cat.name + " · 全国", "按朝代排列 · 共 " + items.length + " 位", true);
    setTab("home");
    var h = '<div class="field-tabs">';
    CATS.forEach(function (c) {
      h += '<a href="#/field/' + c.id + '" class="' + (c.id === id ? "on" : "") + '">' + esc(c.name) + '</a>';
    });
    h += '</div>';
    // 朝代分组
    var cur = null;
    h += '<div class="entry-list">';
    items.forEach(function (it) {
      var e = it.x.era || "其他";
      var eraKey = e.replace(/(初期|中期|晚期|末|初|中|末年|年间|时期|朝|代)/g, "") || "其他";
      if (eraKey !== cur) {
        cur = eraKey;
        h += '<div class="era-head">' + esc(cur) + '</div>';
      }
      h += '<a class="res-item" href="#/place/' + enc(it.pl.prov) + '/' + enc(it.pl.name) + '">' +
        '<b>' + esc(it.x.name) + '</b>' +
        '<small>' + esc(it.pl.prov) + ' · ' + esc(it.pl.name) + (it.x.field ? " · " + esc(it.x.field) : "") + '</small>' +
        '<p>' + esc(it.x.text) + '</p></a>';
    });
    h += '</div><div style="height:16px"></div>';
    return h;
  }

  /* ---------- CBDB 人物库 ---------- */
  var CB_DYNS = ["全部", "唐", "五代", "宋", "元", "明", "清", "民国", "其他"];
  function cbDynGroup(d) {
    if (!d) return "其他";
    if (d.indexOf("唐") >= 0) return "唐";
    if (d.indexOf("五代") >= 0 || d.indexOf("后") === 0) return "五代";
    if (d.indexOf("宋") >= 0) return "宋";
    if (d.indexOf("元") >= 0) return "元";
    if (d.indexOf("明") >= 0) return "明";
    if (d.indexOf("民国") >= 0) return "民国";
    if (d.indexOf("清") >= 0) return "清";
    return "其他";
  }
  function cbLife(r) {
    if (r[3] && r[4]) return r[3] + "—" + r[4];
    if (r[3]) return "生 " + r[3];
    if (r[4]) return "卒 " + r[4];
    return "";
  }
  function cbFilter() {
    var q = (cbQ || "").trim(), out = [];
    var src = cbProv ? (CB_PROV_IDX[cbProv] || []) : CBDB;
    for (var i = 0; i < src.length; i++) {
      var r = src[i];
      if (cbDyn && cbDyn !== "全部" && cbDynGroup(r[2]) !== cbDyn) continue;
      if (q) {
        var hay = r[1] + " " + (r[2] || "") + " " + (r[5] || "") + " " + (r[6] || "") + " " +
          (r[7] || "") + " " + (r[8] || "") + " " + (r[9] || "") + " " + (r[10] || "");
        if (hay.indexOf(q) < 0) continue;
      }
      out.push(r);
    }
    return out;
  }
  function cbRowHTML(r) {
    var life = cbLife(r), meta = [];
    if (r[2]) meta.push(r[2]);
    if (r[5]) meta.push(r[5] + (r[6] && r[6] !== r[5] ? "·" + r[6] : ""));
    if (r[7]) meta.push(r[7]);
    return '<a class="res-item cb-row" href="#/cbdb/id/' + r[0] + '">' +
      '<b>' + esc(r[1]) + (life ? '<span class="cb-life">' + esc(life) + '</span>' : '') + '</b>' +
      '<small>' + esc(meta.join(" · ")) + '</small>' +
      (r[8] ? '<p>' + esc(r[8]) + '</p>' : '') + '</a>';
  }
  function cbRenderList() {
    var box = document.getElementById("cbres");
    if (!box) return;
    var key = cbQ + "|" + cbDyn + "|" + cbProv;
    if (key !== cbKey) { cbCache = cbFilter(); cbKey = key; }
    var n = Math.min(cbCache.length, cbPage * 60);
    var h = '<div class="res-title">共 ' + cbCache.length + ' 位' +
      (cbCache.length > n ? '，已显示前 ' + n + ' 位' : '') + '</div>';
    if (!cbCache.length) {
      box.innerHTML = '<div class="empty"><span class="big">无</span>没有符合条件的记录<br>试试更换朝代、省份或关键词</div>';
      return;
    }
    h += '<div class="res-list">';
    for (var i = 0; i < n; i++) h += cbRowHTML(cbCache[i]);
    h += '</div>';
    if (cbCache.length > n) h += '<button class="more-btn" data-cbmore="1">再显示 60 位</button>';
    box.innerHTML = h;
  }
  function viewCbdb(prov) {
    if (prov !== undefined) { cbProv = prov; cbPage = 1; }
    setHead("CBDB 人物库", "中国历代人物传记资料库 · " + CBDB.length + " 条", true);
    setTab("cbdb");
    var h = '<div class="cb-intro">依据哈佛大学主持的 <b>CBDB</b>（China Biographical Database）整理，' +
      '以唐、宋、元、明、清五代的官员、进士与士人为主。条目为结构化档案，可与本志的人物小传互相参看。</div>';
    h += '<div class="search-wrap"><label class="search-box"><span>寻</span>' +
      '<input id="cbq" type="search" placeholder="搜姓名、字号、籍贯或官职，如 王守仁 / 余姚 / 知府" autocomplete="off" value="' + esc(cbQ) + '"></label></div>';
    h += '<div class="cb-filters">';
    CB_DYNS.forEach(function (d) {
      h += '<button class="cb-chip ' + ((cbDyn || "全部") === d ? "on" : "") + '" data-cbdyn="' + d + '">' + d + '</button>';
    });
    h += '</div>';
    h += '<div class="cb-prov-row"><label>籍贯</label><select id="cbprov">' +
      '<option value="">全部省份</option>' +
      CB_PROVS.map(function (p) {
        return '<option value="' + esc(p) + '"' + (cbProv === p ? " selected" : "") + '>' + esc(p) + '（' + cbCount(p) + '）</option>';
      }).join("") + '</select></div>';
    h += '<div id="cbres"></div>';
    h += '<div class="cb-license">数据：CBDB 2023-03-24 版，哈佛大学等机构维护，CC BY-NC-SA 4.0；' +
      '仅收录籍贯可考、且有事迹记录者，不代表 CBDB 全库。</div>';
    return h;
  }
  function provFullName(short) {
    for (var k in PROV) if (k.indexOf(short) === 0) return k;
    return "";
  }
  function viewCbdbPerson(id) {
    var r = CB_BY_ID[id];
    if (!r) return notFound();
    setHead(r[1], "CBDB 人物档案", true);
    setTab("cbdb");
    var life = cbLife(r);
    var h = '<section class="cb-hero">' +
      '<div class="cb-tag">C B D B</div>' +
      '<h2>' + esc(r[1]) + '</h2>' +
      '<p class="cb-sub">' + esc([r[2], life].filter(Boolean).join(" · ")) + '</p>' +
      '<p class="cb-jg">' + esc((r[5] || "") + (r[6] && r[6] !== r[5] ? " · " + r[6] : "")) + '</p></section>';
    h += '<div class="cb-facts">';
    function fact(k, v) {
      if (!v) return "";
      return '<div class="cb-fact"><span>' + k + '</span><b>' + esc(v) + '</b></div>';
    }
    h += fact("字", r[9]);
    h += fact("号", r[10]);
    h += fact("科第", r[7]);
    h += fact("仕历", r[8]);
    h += fact("著作", r[11]);
    h += '</div>';
    // 关联本志地方
    var pl = null;
    if (r[6]) {
      for (var i = 0; i < PLACES.length; i++) {
        if (PLACES[i].prov.indexOf(r[5]) === 0 && PLACES[i].name.indexOf(r[6].replace(/[县市]$/, "")) === 0) { pl = PLACES[i]; break; }
      }
    }
    if (pl) {
      h += '<a class="cb-place-link" href="#/place/' + enc(pl.prov) + '/' + enc(pl.name) + '">' +
        '在本志中查看「' + esc(pl.name) + '」的人物与胜迹 ›</a>';
    }
    // 同乡
    var same = [];
    for (var j = 0; j < CBDB.length && same.length < 8; j++) {
      var o = CBDB[j];
      if (o[0] !== r[0] && o[5] === r[5] && o[6] === r[6]) same.push(o);
    }
    if (same.length) {
      h += '<div class="res-title">同乡人物 · ' + esc(r[5] + (r[6] ? "·" + r[6] : "")) + '</div><div class="res-list">';
      same.forEach(function (o) { h += cbRowHTML(o); });
      h += '</div>';
    }
    h += '<div class="cb-license">档案编号 CBDB #' + r[0] + '。生卒年、仕历等据 CBDB 著录，' +
      '古籍记载互有异说，仅供参照。</div>';
    return h;
  }

  /* ---------- 收藏 ---------- */
  function viewFav() {
    setHead("收藏", "我的名人 · 胜迹", false);
    setTab("fav");
    if (!favs.length) {
      return '<div class="empty"><span class="big">藏</span>还没有收藏<br>在名人或景区卡片右上角点「★」即可收藏</div>';
    }
    var h = '<div class="section-note">共 ' + favs.length + ' 条收藏</div><div class="res-list">';
    favs.forEach(function (k, idx) {
      var parts = k.split("|");
      var kind = parts[0], pl = parts[1], nm = parts[2];
      var pp = pl.split("|");
      var place = placeOf(pp[1]);
      var obj = null;
      if (place) {
        var arr = kind === "person" ? place.people : place.spots;
        (arr || []).forEach(function (x) { if (x.name === nm) obj = x; });
      }
      h += '<div class="res-item">' +
        '<b>' + esc(nm) + '</b>' +
        '<small>' + (kind === "person" ? "历史名人" : "文化景区") + ' · ' + esc(pl) + '</small>' +
        (obj ? '<p>' + esc(obj.text) + '</p>' : '') +
        '<div style="display:flex;gap:14px;margin-top:8px">' +
        (place ? '<a href="#/place/' + enc(pp[1]) + '/' + enc(pp[1]) + '" style="display:none"></a>' : '') +
        '<a href="#/place/' + enc(pp[0]) + '/' + enc(pp[1]) + '" style="font-size:12.5px;color:#9C2B20;text-decoration:none">查看所在地方 ›</a>' +
        '<a href="javascript:void(0)" data-unfav="' + idx + '" style="font-size:12.5px;color:#8C8272;text-decoration:none">移除</a>' +
        '</div></div>';
    });
    h += '</div>';
    return h;
  }

  /* ---------- 关于 ---------- */
  function viewAbout() {
    setHead("关于", "一套可离线翻阅的中国人文小志", false);
    setTab("about");
    return '<div class="about">' +
      '<h2>为什么做这本小志</h2>' +
      '<p>中国太大，大到我们常常记得宏大的历史，却忘了每个县、每座城都有自己的人名与山水。这本小志按「省级行政区 — 地方 — 人物与景区」三层展开，把散落在地方志、碑刻与口耳相传里的名字，重新收在一处。</p>' +
      '<div class="box"><h3>收录范围</h3><ul>' +
      '<li>' + PROV_COUNT() + ' 个省级行政区，' + PLACES.length + ' 处地方</li>' +
      '<li>' + PEOPLE_N + ' 位历史名人小传</li>' +
      '<li>' + SPOT_N + ' 处文化景区（含世界遗产、全国重点文保、5A 景区等）</li>' +
      '<li>CBDB 人物库 ' + CBDB.length + ' 条结构化档案（唐至清为主）</li>' +
      '<li>完全离线，无广告、无联网权限</li></ul></div>' +
      '<div class="box"><h3>关于 CBDB</h3><ul>' +
      '<li>「人物库」数据取自 <b>China Biographical Database（CBDB，中国历代人物传记资料库）</b>，' +
      '由哈佛大学、北京大学与中研院史语所等机构合作建设</li>' +
      '<li>版本：2023-03-24；许可：CC BY-NC-SA 4.0，仅作非商业性使用与分享</li>' +
      '<li>本志仅选取籍贯可考、且有事迹记录者，并按姓名与字号与自有小传做了匹配，' +
      '匹配结果可能有误，引用请以 CBDB 原库为准</li></ul></div>' +
      '<div class="box"><h3>怎么用</h3><ul>' +
      '<li>首页按大区翻阅省级行政区，再进入具体地方</li>' +
      '<li>「寻踪」支持按人名、朝代、地名、景区名检索</li>' +
      '<li>卡片右上「★」收藏，数据存在本机</li>' +
      '<li>「随机漫游」适合没有目的地时随手翻一页</li></ul></div>' +
      '<div class="box"><h3>一点说明</h3><ul>' +
      '<li>人物籍贯、景区等级均有多种说法，本志取通行说法，行文从简</li>' +
      '<li>景区等级、门票与开放时间会变动，出行前请以官方公告为准</li>' +
      '<li>内容为面向大众的普及性介绍，不作学术引用之用</li></ul></div>' +
      '<p style="color:#8C8272;font-size:12.5px">按 Android 返回键可逐级退回上一页。</p>' +
      '<div class="sig">—— 山河为卷，人名为注 ——</div>' +
      '<div class="copyright"><b>小虫工作室 @2026</b>' +
      '<span>本志文本、编排与界面设计版权归小虫工作室所有；' +
      'CBDB 数据依 CC BY-NC-SA 4.0 许可使用，非商业性分享。</span></div>' +
      '</div>';
  }

  function notFound() {
    return '<div class="empty"><span class="big">佚</span>此处暂无内容</div>';
  }

  /* ---------- 路由 ---------- */
  function route() {
    var hash = location.hash.replace(/^#/, "") || "/home";
    var seg = hash.split("/").filter(function (s) { return s !== ""; });
    var html, key = seg[1] ? dec(seg[1]) : "";
    if (!seg.length || seg[0] === "home") html = viewHome();
    else if (seg[0] === "prov") html = viewProv(key);
    else if (seg[0] === "place") html = viewPlace(key, dec(seg[2] || ""));
    else if (seg[0] === "search") html = viewSearch();
    else if (seg[0] === "fav") html = viewFav();
    else if (seg[0] === "about") html = viewAbout();
    else if (seg[0] === "all") html = viewAll(key);
    else if (seg[0] === "field") html = viewField(key);
    else if (seg[0] === "cbdb") {
      if (seg[1] === "id") html = viewCbdbPerson(dec(seg[2] || ""));
      else if (seg[1] === "p") html = viewCbdb(dec(seg[2] || ""));
      else if (seg[1] === "q") { cbQ = dec(seg[2] || ""); html = viewCbdb(""); }
      else { cbProv = ""; html = viewCbdb(""); }
    }
    else html = viewHome();
    $view.innerHTML = '<div class="fade-in">' + html + '</div>';
    scrollTop();
    if (seg[0] === "search") {
      var inp = document.getElementById("q");
      if (inp) { inp.addEventListener("input", function () { doSearch(inp.value); }); }
    }
    if (seg[0] === "cbdb" && seg[1] !== "id") {
      cbPage = 1;
      cbRenderList();
      var cq = document.getElementById("cbq");
      if (cq) cq.addEventListener("input", function () {
        clearTimeout(cbTimer);
        cbTimer = setTimeout(function () { cbQ = cq.value; cbPage = 1; cbRenderList(); }, 200);
      });
      var cp = document.getElementById("cbprov");
      if (cp) cp.addEventListener("change", function () { cbProv = cp.value; cbPage = 1; cbRenderList(); });
    }
  }

  /* ---------- 交互 ---------- */
  $view.addEventListener("click", function (e) {
    var t = e.target;
    // 收藏
    var sb = t.closest ? t.closest("[data-star]") : null;
    if (sb) {
      var kind = sb.getAttribute("data-star"), pl = sb.getAttribute("data-place"), nm = sb.getAttribute("data-name");
      var k = favKey(kind, pl, nm);
      var i = favs.indexOf(k);
      if (i >= 0) { favs.splice(i, 1); sb.classList.remove("on"); toast("已取消收藏"); }
      else { favs.push(k); sb.classList.add("on"); toast("已收藏 · 可到「收藏」查看"); }
      saveFav();
      return;
    }
    // 取消收藏
    var ub = t.closest ? t.closest("[data-unfav]") : null;
    if (ub) {
      favs.splice(parseInt(ub.getAttribute("data-unfav"), 10), 1);
      saveFav(); route(); toast("已移除");
      return;
    }
    // 快速入口
    var qa = t.closest ? t.closest("[data-act]") : null;
    if (qa) {
      var act = qa.getAttribute("data-act");
      if (act === "random") {
        var pl = PLACES[Math.floor(Math.random() * PLACES.length)];
        location.hash = "#/place/" + enc(pl.prov) + "/" + enc(pl.name);
      } else if (act === "allpeople") location.hash = "#/all/people";
      else if (act === "allspots") location.hash = "#/all/spots";
      else if (act === "fields") location.hash = "#/field/science";
      return;
    }
    // 详情页 tab
    var tb = t.closest ? t.closest("[data-tab-btn]") : null;
    if (tb) {
      curTab = tb.getAttribute("data-tab-btn");
      route();
      return;
    }
    // CBDB 朝代筛选
    var cdb = t.closest ? t.closest("[data-cbdyn]") : null;
    if (cdb) {
      cbDyn = cdb.getAttribute("data-cbdyn");
      cbPage = 1;
      [].forEach.call(document.querySelectorAll("[data-cbdyn]"), function (b) {
        b.classList.toggle("on", b.getAttribute("data-cbdyn") === cbDyn);
      });
      cbRenderList();
      return;
    }
    // CBDB 加载更多
    var cmb = t.closest ? t.closest("[data-cbmore]") : null;
    if (cmb) { cbPage++; cbRenderList(); return; }
    // 热词
    var hb = t.closest ? t.closest("[data-hot]") : null;
    if (hb) {
      var w = hb.getAttribute("data-hot");
      var inp = document.getElementById("q");
      if (inp) { inp.value = w; doSearch(w); }
      return;
    }
  });

  document.getElementById("backBtn").addEventListener("click", function () { history.back(); });
  document.getElementById("homeBtn").addEventListener("click", function () { location.hash = "#/home"; });

  var toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.style.cssText = "position:fixed;left:50%;bottom:88px;transform:translateX(-50%);background:rgba(33,29,25,.9);color:#F7EFDF;font-size:13px;padding:9px 16px;border-radius:20px;z-index:99;opacity:0;transition:opacity .2s;max-width:80%;text-align:center;";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.style.opacity = "0"; }, 1600);
  }

  window.addEventListener("hashchange", route);
  route();
})();
