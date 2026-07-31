/**
 * Butterfly 首页背景与内容滚动效果。
 *
 * 背景只绘制一次，并通过统一覆盖层连续改变整体明暗；JavaScript 负责：
 * - 识别首页并启用单背景结构；
 * - 创建覆盖整个背景的统一底色层；
 * - 根据滚动距离用平滑曲线更新整体透明度；
 * - 让首页标题与下滑提示产生轻微视差并淡出；
 * - 兼容 Butterfly 的 PJAX。
 */
(function () {
  var header = null;
  var siteInfo = null;
  var scrollDown = null;
  var footer = null;
  var pageBackground = null;
  var backgroundWash = null;
  var atmosphere = null;
  var ticking = false;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function ensureBackgroundWash() {
    if (!pageBackground) return;

    var legacyGradient = document.querySelector('.hero-page-gradient');
    if (legacyGradient) legacyGradient.remove();

    var legacyOverlay = pageBackground.querySelector('.hero-page-background-fade');
    if (legacyOverlay) legacyOverlay.remove();
    pageBackground.style.removeProperty('--hero-page-background-fade');

    backgroundWash = pageBackground.querySelector('.hero-background-wash');
    if (backgroundWash) return;

    backgroundWash = document.createElement('div');
    backgroundWash.className = 'hero-background-wash';
    backgroundWash.setAttribute('aria-hidden', 'true');
    pageBackground.appendChild(backgroundWash);
  }

  function ensureAtmosphere() {
    if (!pageBackground) return;

    atmosphere = pageBackground.querySelector('.hero-atmosphere');
    if (atmosphere) {
      [
        '.hero-lantern-glow',
        '.hero-horizon-glow',
        '.hero-sea-shimmer'
      ].forEach(function (selector) {
        var legacyLayer = atmosphere.querySelector(selector);
        if (legacyLayer) legacyLayer.remove();
      });
    } else {
      atmosphere = document.createElement('div');
      atmosphere.className = 'hero-atmosphere';
      atmosphere.setAttribute('aria-hidden', 'true');
      pageBackground.insertBefore(atmosphere, backgroundWash);
    }

    [
      'hero-day-rays',
      'hero-day-glow',
      'hero-stars',
      'hero-meteors'
    ].forEach(function (className) {
      if (!atmosphere.querySelector('.' + className)) {
        var layer = document.createElement('div');
        layer.className = className;
        atmosphere.appendChild(layer);
      }
    });
  }

  function updateParallax() {
    ticking = false;
    if (
      !pageBackground ||
      !document.documentElement.contains(pageBackground)
    ) return;

    var heroHeight = Math.max(
      header && document.documentElement.contains(header)
        ? header.offsetHeight
        : 0,
      window.innerHeight,
      1
    );
    var scrollY = window.scrollY;
    var progress = clamp(scrollY / heroHeight, 0, 1);
    var washProgress = clamp(scrollY / (heroHeight * 1.45), 0, 1);
    var smoothWashProgress =
      washProgress * washProgress * (3 - 2 * washProgress);
    var maximumWash = 0.44;
    var washOpacity = smoothWashProgress * maximumWash;

    /*
     * 页脚进入视口后逐渐撤回背景淡化。这样正文仍有足够的文字对比度，
     * 页脚则恢复原始背景氛围；变化按可见比例计算，不会产生水平分界线。
     */
    if (footer && document.documentElement.contains(footer)) {
      var footerRect = footer.getBoundingClientRect();
      var revealDistance = Math.max(
        Math.min(footerRect.height, window.innerHeight) * 0.82,
        180
      );
      var footerReveal = clamp(
        (window.innerHeight - footerRect.top) / revealDistance,
        0,
        1
      );
      var smoothFooterReveal =
        footerReveal * footerReveal * (3 - 2 * footerReveal);
      washOpacity *= 1 - smoothFooterReveal;
    }

    if (pageBackground) {
      pageBackground.style.setProperty(
        '--hero-wash-opacity',
        washOpacity.toFixed(4)
      );
    }

    if (siteInfo) {
      siteInfo.style.transform =
        'translate3d(0,' + (-scrollY * 0.32).toFixed(2) + 'px,0)';
      siteInfo.style.opacity = String(clamp(1 - progress * 1.7, 0, 1));
    }

    if (scrollDown) {
      scrollDown.style.opacity = String(clamp(1 - progress * 2.2, 0, 1));
    }
  }

  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(updateParallax);
  }

  function resetHeroElements() {
    if (siteInfo) {
      siteInfo.style.removeProperty('transform');
      siteInfo.style.removeProperty('opacity');
    }
    if (scrollDown) {
      scrollDown.style.removeProperty('opacity');
    }
  }

  function bindPage() {
    resetHeroElements();

    header = document.querySelector('#page-header.full_page');
    siteInfo = header ? header.querySelector('#site-info') : null;
    scrollDown = header ? header.querySelector('#scroll-down') : null;
    footer = document.getElementById('footer');
    pageBackground = document.getElementById('web_bg');

    document.body.classList.toggle('hero-reference-effect', Boolean(header));
    document.body.classList.toggle('one-image-flow', Boolean(pageBackground));

    if (pageBackground) {
      ensureBackgroundWash();
      ensureAtmosphere();
      pageBackground.classList.add('hero-background-active');
    }

    updateParallax();
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate);
  document.addEventListener('pjax:complete', bindPage);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindPage);
  } else {
    bindPage();
  }
})();
