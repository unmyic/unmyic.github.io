/**
 * Butterfly 首页文章单双列切换。
 * 选择保存在 localStorage；PJAX 换页后自动重新挂载按钮与布局。
 */
(function () {
  var STORAGE_KEY = 'unmyic-post-layout';

  function readLayout() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'two' ? 'two' : 'one';
    } catch (error) {
      return 'one';
    }
  }

  function saveLayout(layout) {
    try {
      localStorage.setItem(STORAGE_KEY, layout);
    } catch (error) {
      // 隐私模式禁止存储时仍允许本次页面正常切换。
    }
  }

  function applyLayout(layout) {
    var recentPosts = document.getElementById('recent-posts');
    var button = document.getElementById('post-layout-toggle');
    var isTwo = layout === 'two';

    if (recentPosts) {
      recentPosts.classList.toggle('post-layout-two', isTwo);
      recentPosts.classList.toggle('post-layout-one', !isTwo);
    }

    if (button) {
      button.hidden = !recentPosts;
      button.setAttribute('aria-pressed', String(isTwo));
      button.title = isTwo ? '切换为每行一篇' : '切换为每行两篇';
      button.setAttribute('aria-label', button.title);
      var icon = button.querySelector('i');
      if (icon) {
        icon.className =
          'post-layout-icon fas ' + (isTwo ? 'fa-list' : 'fa-th-large');
      }
    }
  }

  function ensureButton() {
    var container = document.getElementById('rightside-config-hide');
    if (!container) return;

    var button = document.getElementById('post-layout-toggle');
    if (!button) {
      button = document.createElement('button');
      button.id = 'post-layout-toggle';
      button.type = 'button';
      button.innerHTML =
        '<i class="post-layout-icon fas fa-th-large" aria-hidden="true"></i>';

      var asideButton = document.getElementById('hide-aside-btn');
      container.insertBefore(button, asideButton || null);

      button.addEventListener('click', function () {
        var nextLayout = readLayout() === 'two' ? 'one' : 'two';
        saveLayout(nextLayout);
        applyLayout(nextLayout);
      });
    }

    applyLayout(readLayout());
  }

  document.addEventListener('pjax:complete', ensureButton);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureButton);
  } else {
    ensureButton();
  }
})();
