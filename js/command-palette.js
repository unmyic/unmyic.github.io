(function () {
  var searchIndex = null;
  var searchPromise = null;
  var activeIndex = 0;
  var currentItems = [];

  var commands = [
    { title: '返回首页', description: '回到博客首页', icon: 'fa-home', hue: 205, path: '/' },
    { title: '文章归档', description: '按时间浏览全部文章', icon: 'fa-box-archive', hue: 225, path: '/archives/' },
    { title: '知识标签', description: '进入标签知识星图', icon: 'fa-tags', hue: 190, path: '/tags/' },
    { title: '文章分类', description: '浏览分类磁贴', icon: 'fa-folder-open', hue: 260, path: '/categories/' },
    { title: '友情链接', description: '发现更多优秀站点', icon: 'fa-link', hue: 170, path: '/link/' },
    { title: '更新日志', description: '查看博客最近的变化', icon: 'fa-clock-rotate-left', hue: 285, path: '/log/' },
    { title: '切换亮暗主题', description: '在白天与夜间主题之间切换', icon: 'fa-circle-half-stroke', hue: 45, action: 'theme' },
    { title: '进入阅读模式', description: '隐藏干扰内容，专注阅读正文', icon: 'fa-book-open-reader', hue: 145, action: 'readmode' }
  ];

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      }[char];
    });
  }

  function stripHtml(value) {
    var box = document.createElement('div');
    box.innerHTML = value || '';
    return (box.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function getOverlay() {
    return document.getElementById('command-palette-overlay');
  }

  function createPalette() {
    if (getOverlay()) return;

    var overlay = document.createElement('div');
    overlay.id = 'command-palette-overlay';
    overlay.className = 'command-palette-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<section class="command-palette" role="dialog" aria-modal="true" aria-label="全站快捷面板">' +
        '<div class="command-search-wrap">' +
          '<i class="fas fa-wand-magic-sparkles" aria-hidden="true"></i>' +
          '<input id="command-palette-input" type="search" autocomplete="off" placeholder="搜索文章或输入一个操作…" aria-label="搜索文章或操作">' +
          '<span class="command-esc">ESC</span>' +
        '</div>' +
        '<div id="command-palette-results" class="command-results" role="listbox"></div>' +
        '<div class="command-footer"><span><kbd>↑↓</kbd>选择</span><span><kbd>Enter</kbd>打开</span><span><kbd>Esc</kbd>关闭</span></div>' +
      '</section>';
    document.body.appendChild(overlay);

    overlay.addEventListener('mousedown', function (event) {
      if (event.target === overlay) closePalette();
    });
    overlay.querySelector('#command-palette-input').addEventListener('input', renderResults);
    overlay.querySelector('#command-palette-input').addEventListener('keydown', handleInputKey);
    renderCommands();
  }

  function createNavButton() {
    var menus = document.getElementById('menus');
    var toggleMenu = document.getElementById('toggle-menu');
    if (!menus || document.getElementById('command-palette-button')) return;

    var button = document.createElement('button');
    button.id = 'command-palette-button';
    button.type = 'button';
    button.className = 'site-page';
    button.title = '快捷导航（Ctrl/⌘ + K）';
    button.setAttribute('aria-label', '打开全站快捷面板');
    var shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';
    button.innerHTML = '<i class="fas fa-bolt" aria-hidden="true"></i><span class="command-key">' + shortcut + '</span>';
    button.addEventListener('click', openPalette);
    if (toggleMenu) {
      menus.insertBefore(button, toggleMenu);
    } else {
      menus.appendChild(button);
    }
  }

  function itemMarkup(item, index) {
    var description = item.description || '';
    return '<button class="command-item' + (index === activeIndex ? ' is-active' : '') +
      '" type="button" role="option" aria-selected="' + (index === activeIndex) +
      '" data-index="' + index + '" style="--command-hue:' + (item.hue || 205) + '">' +
      '<span class="command-item-icon"><i class="fas ' + escapeHtml(item.icon || 'fa-arrow-right') + '"></i></span>' +
      '<span class="command-item-copy"><span class="command-item-title">' + escapeHtml(item.title) +
      '</span><span class="command-item-description">' + escapeHtml(description) + '</span></span>' +
      '<span class="command-item-hint">' + (item.type === 'article' ? '文章' : '打开') + '</span></button>';
  }

  function bindResultItems(container) {
    Array.from(container.querySelectorAll('.command-item')).forEach(function (button) {
      button.addEventListener('mouseenter', function () {
        activeIndex = Number(button.dataset.index);
        updateActive();
      });
      button.addEventListener('click', function () {
        runItem(currentItems[Number(button.dataset.index)]);
      });
    });
  }

  function renderCommands() {
    var container = document.getElementById('command-palette-results');
    if (!container) return;
    currentItems = commands.filter(function (item) {
      return item.action !== 'readmode' || document.getElementById('readmode');
    });
    activeIndex = 0;
    container.innerHTML = '<div class="command-section-label">快捷访问</div>' +
      currentItems.map(itemMarkup).join('');
    bindResultItems(container);
  }

  function loadSearchIndex() {
    if (searchIndex) return Promise.resolve(searchIndex);
    if (searchPromise) return searchPromise;

    searchPromise = fetch('/search.json', { credentials: 'same-origin' })
      .then(function (response) {
        if (!response.ok) throw new Error('Search index unavailable');
        return response.json();
      })
      .then(function (data) {
        searchIndex = Array.isArray(data) ? data : [];
        return searchIndex;
      })
      .catch(function () {
        searchIndex = [];
        return searchIndex;
      });
    return searchPromise;
  }

  function renderResults(event) {
    var query = event ? event.target.value.trim().toLocaleLowerCase() : '';
    if (!query) {
      renderCommands();
      return;
    }

    var container = document.getElementById('command-palette-results');
    container.innerHTML = '<div class="command-empty"><i class="fas fa-circle-notch fa-spin"></i>正在检索知识库…</div>';

    loadSearchIndex().then(function (index) {
      var actionMatches = commands.filter(function (item) {
        if (item.action === 'readmode' && !document.getElementById('readmode')) return false;
        return (item.title + ' ' + item.description).toLocaleLowerCase().includes(query);
      });
      var articleMatches = index.filter(function (item) {
        return (item.title + ' ' + stripHtml(item.content)).toLocaleLowerCase().includes(query);
      }).slice(0, 7).map(function (item) {
        return {
          title: item.title || '未命名文章',
          description: stripHtml(item.content).slice(0, 72),
          icon: 'fa-file-lines',
          hue: 210,
          path: item.url || item.path,
          type: 'article'
        };
      });

      currentItems = actionMatches.slice(0, 3).concat(articleMatches);
      activeIndex = 0;
      if (!currentItems.length) {
        container.innerHTML = '<div class="command-empty"><i class="fas fa-satellite-dish"></i>没有找到匹配内容，换个关键词试试</div>';
        return;
      }
      container.innerHTML = '<div class="command-section-label">搜索结果 · ' + currentItems.length + '</div>' +
        currentItems.map(itemMarkup).join('');
      bindResultItems(container);
    });
  }

  function updateActive() {
    var nodes = Array.from(document.querySelectorAll('#command-palette-results .command-item'));
    nodes.forEach(function (node, index) {
      var active = index === activeIndex;
      node.classList.toggle('is-active', active);
      node.setAttribute('aria-selected', String(active));
    });
    if (nodes[activeIndex]) nodes[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  function handleInputKey(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!currentItems.length) return;
      var direction = event.key === 'ArrowDown' ? 1 : -1;
      activeIndex = (activeIndex + direction + currentItems.length) % currentItems.length;
      updateActive();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (currentItems[activeIndex]) runItem(currentItems[activeIndex]);
    } else if (event.key === 'Escape') {
      closePalette();
    }
  }

  function navigate(path) {
    closePalette();
    var url = path || '/';
    if (window.pjax && typeof window.pjax.loadUrl === 'function') {
      window.pjax.loadUrl(url);
    } else {
      window.location.href = url;
    }
  }

  function runItem(item) {
    if (!item) return;
    if (item.path) {
      navigate(item.path);
      return;
    }
    closePalette();
    if (item.action === 'theme') {
      var darkButton = document.getElementById('darkmode');
      if (darkButton) darkButton.click();
    } else if (item.action === 'readmode') {
      var readButton = document.getElementById('readmode');
      if (readButton) readButton.click();
    }
  }

  function openPalette() {
    createPalette();
    var overlay = getOverlay();
    var input = document.getElementById('command-palette-input');
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('command-palette-open');
    input.value = '';
    renderCommands();
    window.setTimeout(function () { input.focus(); }, 20);
  }

  function closePalette() {
    var overlay = getOverlay();
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('command-palette-open');
  }

  function handleGlobalKey(event) {
    var target = event.target;
    var typing = target && (target.matches('input, textarea, select') || target.isContentEditable);
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === 'k') {
      event.preventDefault();
      getOverlay() && getOverlay().classList.contains('is-open') ? closePalette() : openPalette();
    } else if (event.key === 'Escape' && getOverlay() && getOverlay().classList.contains('is-open')) {
      closePalette();
    } else if (!typing && event.key === '/') {
      event.preventDefault();
      openPalette();
    }
  }

  function init() {
    createPalette();
    createNavButton();
  }

  document.addEventListener('keydown', handleGlobalKey);
  document.addEventListener('pjax:complete', function () {
    closePalette();
    createNavButton();
  });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
