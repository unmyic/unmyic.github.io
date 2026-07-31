/**
 * 为 Butterfly 的明暗切换增加背景交叉淡入淡出。
 * 不接管 Butterfly 的主题状态，只观察 data-theme，因此仍兼容原按钮与本地存储。
 */
(function () {
  var cleanupTimer = 0;
  var prepared = false;

  function prepareCrossfade(event) {
    var target = event.target.closest && event.target.closest('#darkmode');
    if (!target) return;

    var background = document.getElementById('web_bg');
    if (!background) return;

    var style = window.getComputedStyle(background);
    background.style.setProperty(
      '--theme-previous-background',
      style.backgroundImage
    );
    background.style.setProperty(
      '--theme-previous-position',
      style.backgroundPosition
    );
    background.classList.remove('theme-crossfade-run');
    background.classList.add('theme-crossfade');
    prepared = true;
  }

  function runCrossfade() {
    if (!prepared) return;
    prepared = false;

    var background = document.getElementById('web_bg');
    if (!background) return;

    window.cancelAnimationFrame(background._themeFrame);
    background._themeFrame = window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        background.classList.add('theme-crossfade-run');
      });
    });

    window.clearTimeout(cleanupTimer);
    cleanupTimer = window.setTimeout(function () {
      background.classList.remove('theme-crossfade', 'theme-crossfade-run');
      background.style.removeProperty('--theme-previous-background');
      background.style.removeProperty('--theme-previous-position');
    }, 920);
  }

  var observer = new MutationObserver(function (mutations) {
    if (
      mutations.some(function (mutation) {
        return mutation.attributeName === 'data-theme';
      })
    ) {
      runCrossfade();
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  });

  document.addEventListener('pointerdown', prepareCrossfade, true);
})();
