/**
 * 动态标题（离开静止 / 回来滚一遍 / 悬停站点名持续滚动）
 * 适配 Hexo / Butterfly。把本文件放到 source/js/title.js，再在主题 inject.bottom 引用。
 */
(function () {
  // ------- 可配置项 -------
  var CFG = {
    awayTitle: '👀 跑哪里去了~',            // 切走标签页时展示（不滚动）
    backWelcome: '🎉 欢迎回家！ヾ(´∀｀。ヾ)',          // 回来时用于滚动的前缀
    stepMs: 220,                             // 跑马灯每步间隔(毫秒)
    paddingSpaces: 8,                        // 两端补空格，滚动更自然
    minLengthToScroll: 18,                   // 文本<该长度则不滚动
    // 第3条：把“悬停触发”的元素选择器改成你站点名对应的DOM
    // 常见：'.site-title a' / '.site-title' / '#site-name'
    HOVER_SELECTOR: '#site-title, .site-title a'

  };
  // ------------------------

  // PJAX 防重复注入
  if (window.__title_marquee_bound__) return;
  window.__title_marquee_bound__ = true;

  var originTitle = document.title || '';
  var onceTimer = null;       // 回来后“滚一遍”的停止定时器
  var loopTimer = null;       // setInterval 用于滚动
  var hoverStopper = null;    // 悬停“持续滚动”的停止方法

  // 工具：清理所有定时器/滚动
  function stopAll() {
    clearTimeout(onceTimer);
    clearInterval(loopTimer);
    onceTimer = null;
    loopTimer = null;
    hoverStopper = null;
  }

  // 工具：生成带左右空格的滚动文本
  function padded(msg) {
    var pad = ' '.repeat(Math.max(0, CFG.paddingSpaces));
    return pad + msg + pad;
  }

  // 跑马灯核心：启动滚动（返回一个“停止函数”）
  function startMarquee(text) {
    stopAll();
    var msg = padded(text);
    var i = 0;
    document.title = msg;  // 立即显示一次
    loopTimer = setInterval(function () {
      i = (i + 1) % msg.length;
      document.title = msg.slice(i) + msg.slice(0, i);
    }, Math.max(60, CFG.stepMs));
    // 返回一个可调用的停止函数
    var stopped = false;
    return function stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(loopTimer);
      loopTimer = null;
    };
  }

  // 行为②：回来后“只滚一遍”，滚完恢复原标题
  function marqueeOnceThenRestore(text) {
    stopAll();
    // 如果太短，就不滚动，只展示2秒后恢复
    var plain = CFG.backWelcome;;
    if (plain.replace(/\s+/g, '').length < CFG.minLengthToScroll) {
      document.title = plain;
      onceTimer = setTimeout(function () { document.title = originTitle; }, 4000);
      return;
    }
    // 计算“滚一遍”需要的步数：就是补了空格的字符串长度
    var msg = padded(text);
    var steps = msg.length;
    var i = 0;
    document.title = msg;
    loopTimer = setInterval(function () {
      i++;
      var k = i % msg.length;
      document.title = msg.slice(k) + msg.slice(0, k);
      if (i >= steps) {
        clearInterval(loopTimer);
        loopTimer = null;
        document.title = originTitle; // 滚完一次 -> 恢复原标题
      }
    }, Math.max(60, CFG.stepMs));
  }

  // 行为③：悬停站点主标题 -> 持续滚动；移开停止并恢复原标题
  function bindHoverContinuous() {
    try {
      var el = document.querySelector(CFG.HOVER_SELECTOR);
      if (!el) {
        console.warn('[title-marquee] 找不到站点名元素：', CFG.HOVER_SELECTOR,
          '请在脚本里修改 CFG.HOVER_SELECTOR 为你实际的选择器');
        return;
      }
      el.addEventListener('mouseenter', function () {
        // 悬停时滚动“网站原标题”(不加前缀)
        if (hoverStopper) return; // 已经在滚
        hoverStopper = startMarquee(originTitle);
      });
      el.addEventListener('mouseleave', function () {
        if (hoverStopper) {
          hoverStopper();         // 停止滚动
          hoverStopper = null;
        }
        clearInterval(loopTimer);
        loopTimer = null;
        document.title = originTitle; // 恢复原标题
      });
    } catch (e) {
      console.error('[title-marquee] 悬停绑定失败：', e);
    }
  }

  // 行为① + ②：根据标签页可见性切换
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      // ① 切走：静止文案，不滚动
      stopAll();
      document.title = CFG.awayTitle;
    } else {
      // ② 切回：先“滚一遍”欢迎+原标题，滚完恢复原标题
      var welcome = CFG.backWelcome;
      marqueeOnceThenRestore(welcome);
    }
  });

  // PJAX 无刷新切页：更新原标题，避免恢复到旧标题
  function updateOriginTitle() {
    originTitle = document.title || originTitle;
  }
  document.addEventListener('pjax:complete', function () {
  updateOriginTitle();
  bindHoverContinuous(); // 切页后重新绑定悬停事件
});
  document.addEventListener('astro:page-load', updateOriginTitle);

  // 页面就绪后绑定悬停（行为③）
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindHoverContinuous);
  } else {
    bindHoverContinuous();
  }
})();
