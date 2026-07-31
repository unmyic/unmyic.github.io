/**
 * 将 Butterfly 的原生分类文字列表增强为可访问的分类磁贴。
 * 原始链接仍保留，因此禁用 JavaScript 时会自然退化为主题默认列表。
 */
(function () {
  var CATEGORY_META = {
    'Web 开发': {
      icon: 'fa-code',
      type: 'WEB / CREATE',
      description: '记录前端、后端、Hexo 与博客组件的设计和实现过程。',
      hue: 203
    },
    '学习资料': {
      icon: 'fa-graduation-cap',
      type: 'STUDY / NOTES',
      description: '课程复习、有限元方法，以及持续整理的结构化学习笔记。',
      hue: 258
    }
  };

  function hashHue(value) {
    var hash = 0;
    for (var index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return 190 + (hash % 105);
  }

  function createElement(tag, className, text) {
    var element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function bindTilt(link) {
    if (
      link.dataset.categoryTiltReady === 'true' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) return;

    link.addEventListener('pointermove', function (event) {
      if (window.innerWidth <= 760) return;
      var rect = link.getBoundingClientRect();
      var x = (event.clientX - rect.left) / rect.width;
      var y = (event.clientY - rect.top) / rect.height;
      link.style.setProperty('--tile-x', (x * 100).toFixed(1) + '%');
      link.style.setProperty('--tile-y', (y * 100).toFixed(1) + '%');
      link.style.setProperty('--tile-rx', ((0.5 - y) * 7).toFixed(2) + 'deg');
      link.style.setProperty('--tile-ry', ((x - 0.5) * 9).toFixed(2) + 'deg');
    });

    link.addEventListener('pointerleave', function () {
      link.style.setProperty('--tile-x', '50%');
      link.style.setProperty('--tile-y', '50%');
      link.style.setProperty('--tile-rx', '0deg');
      link.style.setProperty('--tile-ry', '0deg');
    });

    link.dataset.categoryTiltReady = 'true';
  }

  function enhanceTile(item) {
    if (item.dataset.categoryTileReady === 'true') return;

    var link = item.querySelector(':scope > .category-list-link');
    var countElement = item.querySelector(':scope > .category-list-count');
    if (!link) return;

    var name = link.textContent.trim();
    var count = countElement ? countElement.textContent.trim() : '0';
    var meta = CATEGORY_META[name] || {
      icon: 'fa-folder-open',
      type: 'COLLECTION',
      description: '浏览这个分类下收录的文章、笔记与专题内容。',
      hue: hashHue(name)
    };

    if (countElement) countElement.remove();
    link.textContent = '';
    link.className = 'category-list-link category-tile-link';
    link.style.setProperty('--tile-hue', meta.hue);
    link.setAttribute(
      'aria-label',
      '打开分类“' + name + '”，共 ' + count + ' 篇文章'
    );

    var content = createElement('span', 'category-tile-content');
    var topLine = createElement('span', 'category-tile-topline');
    topLine.appendChild(
      createElement('span', 'category-tile-type', meta.type)
    );
    topLine.appendChild(
      createElement('span', 'category-tile-count', count + ' 篇文章')
    );

    var icon = createElement('span', 'category-tile-icon');
    icon.innerHTML =
      '<i class="fas ' + meta.icon + '" aria-hidden="true"></i>';

    var title = createElement('strong', 'category-tile-title', name);
    var description = createElement(
      'span',
      'category-tile-description',
      meta.description
    );
    var action = createElement(
      'span',
      'category-tile-action',
      '进入分类'
    );
    action.innerHTML +=
      '<i class="fas fa-arrow-right" aria-hidden="true"></i>';

    content.appendChild(topLine);
    content.appendChild(icon);
    content.appendChild(title);
    content.appendChild(description);
    content.appendChild(action);
    link.appendChild(content);

    bindTilt(link);

    item.dataset.categoryTileReady = 'true';
  }

  function enhanceCategoryPage() {
    var lists = document.querySelectorAll(
      '#page > .category-lists > .category-list'
    );

    lists.forEach(function (list) {
      list.parentElement.classList.add('category-tiles-ready');
      list.querySelectorAll(':scope > .category-list-item').forEach(enhanceTile);
    });

    document
      .querySelectorAll('.category-tile-demo-card')
      .forEach(bindTilt);
  }

  document.addEventListener('pjax:complete', enhanceCategoryPage);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhanceCategoryPage);
  } else {
    enhanceCategoryPage();
  }
})();
