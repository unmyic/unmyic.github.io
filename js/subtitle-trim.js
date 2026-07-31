/* 裁掉首页副标题里的一言“出处/作者”部分，只保留句子本身 */
(function () {
  var SEL = '#subtitle';           // Butterfly 默认副标题节点
  var el = document.querySelector(SEL);
  if (!el) return;

  function stripSource(s) {
    if (!s) return s;
    // 兼容多种常见格式：
    // 1) 「句子」—— 出处 / —— 作者 / —— XXX
    // 2) 句子 出自：XXX / 出自 XXX / 来自 XXX
    // 3) 句子 「出处」/（出处）
    var t = s
      .replace(/\s*[-—–]+\s*[^'"\n]+$/u, '')         // 去掉 "—— XXX" 之后
      .replace(/\s*(?:出自|来自|出處)[:：]?\s*.+$/u, '') // 去掉 "出自/来自 XXX"
      .replace(/\s*「[^」]+」\s*$/u, '')              // 去掉末尾「出处」
      .replace(/\s*（[^）]+）\s*$/u, '')              // 去掉末尾（出处）
      .trim();
    return t || s;
  }

  // 监听文本变化，每次主题/typed.js 写入时都把“出处”裁掉
  var mo = new MutationObserver(function () {
    var now = el.textContent || '';
    var trimmed = stripSource(now);
    if (now !== trimmed) el.textContent = trimmed;
  });
  mo.observe(el, { childList: true, characterData: true, subtree: true });

  // PJAX 切页后重新监听
  document.addEventListener('pjax:complete', function () {
    mo.disconnect();
    el = document.querySelector(SEL);
    if (el) mo.observe(el, { childList: true, characterData: true, subtree: true });
  });
})();
