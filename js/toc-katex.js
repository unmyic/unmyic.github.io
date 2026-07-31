/**
 * 修复 Butterfly 目录中的 KaTeX 标题。
 *
 * Hexo 的目录生成器会把 KaTeX 的 MathML、TeX annotation 和可视 HTML
 * 一起转换为纯文本，造成同一个公式在目录里重复三次。文章标题本身已经
 * 正确渲染，因此这里按目录链接找到对应标题，并只在包含公式时复制其
 * 已渲染 HTML。
 */
(function () {
  'use strict';

  function getHeadingFromLink(link) {
    var href = link.getAttribute('href');
    if (!href || href.charAt(0) !== '#') return null;

    try {
      return document.getElementById(decodeURIComponent(href.slice(1)));
    } catch (error) {
      return null;
    }
  }

  function syncTocKatex() {
    document.querySelectorAll('#card-toc .toc-link').forEach(function (link) {
      var tocText = link.querySelector('.toc-text');
      var heading = getHeadingFromLink(link);

      if (!tocText || !heading || !heading.querySelector('.katex')) return;

      var headingCopy = heading.cloneNode(true);
      headingCopy.querySelectorAll('.headerlink').forEach(function (anchor) {
        anchor.remove();
      });

      tocText.innerHTML = headingCopy.innerHTML;
      tocText.classList.add('toc-text--katex-fixed');
    });
  }

  function scheduleSync() {
    window.requestAnimationFrame(syncTocKatex);
  }

  document.addEventListener('pjax:complete', scheduleSync);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleSync);
  } else {
    scheduleSync();
  }
})();
