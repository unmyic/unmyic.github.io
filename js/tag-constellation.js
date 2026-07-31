(function () {
  function hueFor(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i += 1) {
      hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    }
    return 190 + hash % 105;
  }

  function bindPage() {
    var cloud = document.querySelector('#page > .tag-cloud-list');
    if (!cloud || cloud.dataset.constellationReady === 'true') return;

    var links = Array.from(cloud.querySelectorAll(':scope > a'));
    if (!links.length) return;

    var head = document.createElement('section');
    head.className = 'tag-constellation-head';
    head.innerHTML =
      '<div class="tag-constellation-kicker">KNOWLEDGE CONSTELLATION</div>' +
      '<div class="tag-constellation-title">探索知识星图</div>' +
      '<div class="tag-constellation-meta">共 <strong>' + links.length + '</strong> 个标签 · 节点大小由内容热度决定</div>' +
      '<input class="tag-constellation-search" type="search" placeholder="搜索标签，例如 Hexo、CSS…" aria-label="搜索标签">';
    cloud.parentElement.insertBefore(head, cloud);

    links.forEach(function (link) {
      var name = link.textContent.trim();
      var originalSize = parseFloat(link.style.fontSize) || 1.2;
      link.dataset.tagName = name.toLocaleLowerCase();
      link.removeAttribute('style');
      link.style.setProperty('--tag-hue', hueFor(name));
      link.style.setProperty('--tag-scale', Math.min(1.035, .99 + (originalSize - 1.2) * .12));
      link.title = '查看标签：' + name;
    });

    head.querySelector('input').addEventListener('input', function (event) {
      var keyword = event.target.value.trim().toLocaleLowerCase();
      var visible = 0;

      links.forEach(function (link) {
        var matched = !keyword || link.dataset.tagName.includes(keyword);
        link.classList.toggle('is-hidden', !matched);
        if (matched) visible += 1;
      });

      head.querySelector('.tag-constellation-meta').innerHTML = keyword
        ? '找到 <strong>' + visible + '</strong> 个匹配标签'
        : '共 <strong>' + links.length + '</strong> 个标签 · 节点大小由内容热度决定';
    });

    cloud.classList.add('tag-constellation-ready');
    cloud.dataset.constellationReady = 'true';
  }

  document.addEventListener('pjax:complete', bindPage);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindPage);
  } else {
    bindPage();
  }
})();
