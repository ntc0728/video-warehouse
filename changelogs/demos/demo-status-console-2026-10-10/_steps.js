/* 任务流走查 · 状态监控台 — 步骤机与演示交互 */
(function () {
  "use strict";

  var TOTAL = 6;
  var body = document.body;
  var posEl = document.getElementById("nav-pos");
  var stepLis = Array.prototype.slice.call(document.querySelectorAll("#wl-steps li"));
  var notes = Array.prototype.slice.call(document.querySelectorAll("#wl-notes .note"));
  var rail = document.getElementById("sc-rail");
  var toastEl = document.getElementById("wl-toast");
  var toastTimer = null;
  var recheckBusy = false;
  var deployBusy = false;

  var ROWS = {
    "iptv-a": { name: "聚合源 IPTV-A", pill: "ok", pillText: "可用", url: "https://example.com/iptv-a.m3u", err: "—", ago: "2 分钟前 · 连续成功", lat: "32ms" },
    "iptv-b": { name: "聚合源 IPTV-B", pill: "ok", pillText: "可用", url: "https://example.com/iptv-b.m3u", err: "—", ago: "2 分钟前 · 连续成功", lat: "47ms" },
    "video-a": { name: "聚合源 A", pill: "ok", pillText: "可用", url: "https://api.example.com/vod", err: "—", ago: "2 分钟前 · 连续成功", lat: "45ms" },
    "video-b": { name: "聚合源 B", pill: "ok", pillText: "可用", url: "https://api2.example.com/vod", err: "—", ago: "2 分钟前 · 连续成功", lat: "58ms" },
    "video-fallback": { name: "备用源", pill: "err", pillText: "异常", url: "https://example.com/vod-c.m3u", err: "connect ETIMEDOUT (10s)", ago: "2 分钟前 · 连续失败 3 次", lat: "—" },
    "proxy-cors": { name: "视频 CORS 代理", pill: "idle", pillText: "未配置", url: "—", err: "—", ago: "—", lat: "—" },
    "proxy-iptv": { name: "IPTV 流代理", pill: "idle", pillText: "未配置", url: "—", err: "—", ago: "—", lat: "—" }
  };

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 1600);
  }

  /* ---------- 步骤机 ---------- */
  function goStep(n) {
    n = Math.max(0, Math.min(TOTAL - 1, n));
    body.dataset.step = String(n);
    posEl.textContent = String(n + 1);
    stepLis.forEach(function (li, i) {
      li.classList.toggle("is-on", i === n);
      li.classList.toggle("is-done", i < n);
    });
    notes.forEach(function (el) { el.classList.toggle("is-on", Number(el.dataset.note) === n); });

    if (n !== 1 && n !== 2 && n !== 5) closeRail();

    if (n === 2) openRail("video-fallback");
    if (n === 4) maybeAutoDeploy();
    if (n === 5) maybeRecheck();
    if (n === 3) setPipe(2);
  }

  document.addEventListener("click", function (e) {
    var goto = e.target.closest("[data-goto]");
    if (goto) goStep(Number(goto.dataset.goto));
  });
  document.getElementById("btn-prev").addEventListener("click", function () { goStep(Number(body.dataset.step) - 1); });
  document.getElementById("btn-next").addEventListener("click", function () { goStep(Number(body.dataset.step) + 1); });

  /* ---------- 源检测：分段 ---------- */
  var seg = document.getElementById("sc-seg");
  var table = document.getElementById("sc-table");
  seg.addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-seg]");
    if (!btn) return;
    Array.prototype.forEach.call(seg.children, function (b) { b.classList.toggle("is-on", b === btn); });
    var key = btn.dataset.seg;
    Array.prototype.forEach.call(table.tBodies[0].rows, function (row) {
      row.style.display = key === "all" || row.dataset.seg === key ? "" : "none";
    });
  });

  /* ---------- 源检测：inspector ---------- */
  function openRail(id) {
    var d = ROWS[id];
    if (!d) return;
    Array.prototype.forEach.call(table.tBodies[0].rows, function (row) {
      row.classList.toggle("is-sel", row.dataset.id === id);
    });
    var pill = document.getElementById("rail-pill");
    pill.className = "pill pill--" + d.pill;
    pill.textContent = d.pillText;
    document.getElementById("rail-name").textContent = d.name;
    document.getElementById("rail-url").textContent = d.url;
    document.getElementById("rail-err").textContent = d.err;
    document.getElementById("rail-err").className = "mono" + (d.err !== "—" ? " is-err" : "");
    document.getElementById("rail-ago").textContent = d.ago;
    document.getElementById("rail-lat").textContent = d.lat;
    rail.setAttribute("aria-hidden", "false");
    body.dataset.rail = "open";
  }
  function closeRail() {
    body.dataset.rail = "closed";
    rail.setAttribute("aria-hidden", "true");
    Array.prototype.forEach.call(table.tBodies[0].rows, function (row) { row.classList.remove("is-sel"); });
  }
  table.tBodies[0].addEventListener("click", function (e) {
    var row = e.target.closest("tr[data-id]");
    if (row) openRail(row.dataset.id);
  });
  document.getElementById("rail-close").addEventListener("click", closeRail);

  document.getElementById("btn-to-px").addEventListener("click", function () { goStep(3); });

  /* ---------- 一键检测 / 复检动画 ---------- */
  function countTo(el, from, to, ms) {
    var t0 = performance.now();
    (function tick(t) {
      var p = Math.min(1, (t - t0) / ms);
      el.textContent = String(Math.round(from + (to - from) * p));
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  }

  function setMetric(key, dot, value) {
    var li = document.querySelector('.hero-metrics li[data-k="' + key + '"]');
    if (!li) return;
    li.querySelector(".dot").className = "dot dot--" + dot;
    li.querySelector("b").textContent = value;
  }

  function runRecheck(fix) {
    if (recheckBusy) return;
    recheckBusy = true;
    var btn = document.getElementById("btn-recheck");
    btn.disabled = true;
    btn.textContent = "检测中…";
    var rows = Array.prototype.slice.call(table.tBodies[0].rows);
    rows.forEach(function (r) { r.classList.add("is-scanning"); });
    document.getElementById("hero-state").textContent = "检测中 · 并发 4 路…";

    setTimeout(function () {
      rows.forEach(function (r) { r.classList.remove("is-scanning"); });
      if (fix) {
        body.dataset.recheck = "ok";
        var bad = table.querySelector('tr[data-id="video-fallback"]');
        bad.classList.remove("is-bad");
        bad.querySelector(".pill").className = "pill pill--ok";
        bad.querySelector(".pill").textContent = "可用";
        bad.querySelector(".c-lat").textContent = "52ms";
        bad.querySelector(".c-ago").textContent = "刚刚";
        ROWS["video-fallback"] = { name: "备用源", pill: "ok", pillText: "可用", url: "https://example.com/vod-c.m3u", err: "—", ago: "刚刚 · 经代理恢复", lat: "52ms" };
        ["proxy-cors", "proxy-iptv"].forEach(function (id) {
          var r2 = table.querySelector('tr[data-id="' + id + '"]');
          r2.classList.remove("is-idle");
          r2.querySelector(".pill").className = "pill pill--ok";
          r2.querySelector(".pill").textContent = "运行中";
          r2.querySelector(".c-url").textContent = "https://vod-cors-proxy.example.workers.dev";
          r2.querySelector(".c-lat").textContent = "18ms";
          r2.querySelector(".c-ago").textContent = "刚刚";
        });
        setMetric("video", "ok", "4/4");
        setMetric("cors", "ok", "运行中");
        setMetric("i-proxy", "ok", "运行中");
        countTo(document.getElementById("hero-ok"), 3, 5, 600);
        document.getElementById("hero-state").textContent = "全部正常 · 备用源已走代理链路";
        toast("复检通过 · 5/5");
      } else {
        countTo(document.getElementById("hero-ok"), 3, 3, 300);
        document.getElementById("hero-state").textContent = "2 项待修复 · 备用源异常、代理未配置";
        toast("检测完成 · 发现 2 项待修复");
      }
      btn.disabled = false;
      btn.textContent = "一键检测";
      recheckBusy = false;
    }, 1100);
  }

  var recheckArmed = true;
  function maybeRecheck() {
    if (!recheckArmed) return;
    if (body.dataset.recheck === "ok") return;
    recheckArmed = false;
    setTimeout(function () { runRecheck(true); }, 500);
  }
  document.getElementById("btn-recheck").addEventListener("click", function () {
    runRecheck(body.dataset.recheck === "ok");
  });

  /* ---------- 代理配置 ---------- */
  var entries = document.getElementById("px-entries");
  entries.addEventListener("click", function (e) {
    var btn = e.target.closest(".entry");
    if (!btn) return;
    Array.prototype.forEach.call(entries.children, function (b) { b.classList.toggle("is-selected", b === btn); });
    document.getElementById("px-context").textContent = btn.dataset.entry === "cors" ? "备用源 · 视频 CORS" : "备用源 · IPTV 流代理";
  });

  var eye = document.getElementById("px-eye");
  eye.addEventListener("click", function () {
    var input = document.getElementById("px-token");
    var show = input.type === "password";
    input.type = show ? "text" : "password";
    eye.textContent = show ? "隐藏" : "显示";
  });

  var pipe = document.getElementById("px-pipe");
  function setPipe(active) {
    Array.prototype.forEach.call(pipe.children, function (li) {
      var p = Number(li.dataset.p);
      li.classList.toggle("is-done", p < active);
      li.classList.toggle("is-on", p === active);
    });
  }
  setPipe(2);

  var LOGS = [
    { t: "校验 API Token …", cls: "dim", d: 260 },
    { t: "Token 有效 · 读取 Account a1b2…c5d6", cls: "ok", d: 340 },
    { t: "检查 Worker: vod-cors-proxy …", cls: "dim", d: 300 },
    { t: "上传 Worker 代码 (2.1 kB) …", cls: "dim", d: 420 },
    { t: "部署完成 · vod-cors-proxy.example.workers.dev", cls: "ok", d: 380 },
    { t: "回写项目设置: proxy.videoCors …", cls: "dim", d: 300 },
    { t: "全部完成 ✓", cls: "ok", d: 240 }
  ];
  var logEl = document.getElementById("px-log");
  var deployed = false;

  function deploy() {
    if (deployBusy) return;
    deployBusy = true;
    deployed = false;
    var btn = document.getElementById("btn-deploy");
    btn.disabled = true;
    btn.textContent = "部署中…";
    document.getElementById("px-result").hidden = true;
    logEl.innerHTML = "<code><span class='dim'>[12:04:01] 开始部署 · 选择项: " +
      (document.querySelector(".entry.is-selected").dataset.entry === "cors" ? "视频采集 CORS" : "IPTV 流代理") +
      "</span></code>";
    setPipe(3);

    var i = 0;
    (function next() {
      if (i >= LOGS.length) {
        var d = new Date();
        logEl.innerHTML += "\n<code class='ok'>[" + d.toTimeString().slice(0, 8) + "] done</code>";
        logEl.scrollTop = logEl.scrollHeight;
        setPipe(5);
        deployed = true;
        document.getElementById("px-result").hidden = false;
        btn.disabled = false;
        btn.textContent = "重新部署";
        deployBusy = false;
        toast("部署成功");
        return;
      }
      var item = LOGS[i++];
      setTimeout(function () {
        var d = new Date();
        logEl.innerHTML += "\n<code class='" + item.cls + "'>[" + d.toTimeString().slice(0, 8) + "] " + item.t + "</code>";
        logEl.scrollTop = logEl.scrollHeight;
        next();
      }, item.d);
    })();
  }
  var deployArmed = true;
  function maybeAutoDeploy() {
    if (!deployArmed || deployed) return;
    deployArmed = false;
    setTimeout(deploy, 600);
  }
  document.getElementById("btn-deploy").addEventListener("click", deploy);

  document.getElementById("btn-copy").addEventListener("click", function () {
    var url = document.getElementById("px-url").textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast("已复制"); }, function () { toast("复制失败，请手动选择"); });
    } else {
      toast("已复制（demo 模拟）");
    }
  });
  document.getElementById("btn-recheck-2").addEventListener("click", function () {
    if (body.dataset.recheck === "ok") { goStep(5); return; }
    goStep(5);
    recheckArmed = false;
    setTimeout(function () { runRecheck(true); }, 400);
  });

  /* ---------- 键盘 ---------- */
  document.addEventListener("keydown", function (e) {
    if (e.target.tagName === "INPUT") return;
    if (e.key === "ArrowRight") goStep(Number(body.dataset.step) + 1);
    if (e.key === "ArrowLeft") goStep(Number(body.dataset.step) - 1);
  });

  goStep(0);
})();
