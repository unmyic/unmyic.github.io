(function () {
  'use strict';
  var dataPromise;
  var observer;

  function norm(value) {
    return String(value || '').replace(/\/+$/, '');
  }

  function loadData() {
    if (dataPromise) return dataPromise;
    dataPromise = fetch('/data/link.json', { cache: 'no-cache' })
      .then(function (response) { return response.json(); })
      .then(function (groups) {
        return groups.reduce(function (all, group) {
          return all.concat(group.link_list || []);
        }, []);
      })
      .catch(function (error) {
        console.warn('[friend-cards] 无法读取友链数据：', error);
        return [];
      });
    return dataPromise;
  }

  function enhance(item, links) {
    if (item.dataset.friendTechReady === 'true') return;
    var anchor = item.querySelector(':scope > a');
    var nameNode = item.querySelector('.flink-item-name');
    if (!anchor || !nameNode) return;
    var name = nameNode.textContent.trim();
    var meta = links.find(function (link) {
      return norm(link.link) === norm(anchor.href) || link.name === name;
    });
    if (!meta) return;

    var shot = document.createElement('div');
    shot.className = 'friend-card-shot';
    var image = document.createElement('img');
    image.src = meta.siteshot || 'https://image.thum.io/get/width/800/crop/600/noanimate/' + norm(meta.link);
    image.alt = meta.name + ' 的网站预览';
    image.loading = 'lazy';
    image.addEventListener('error', function () { shot.classList.add('is-fallback'); });
    shot.appendChild(image);
    anchor.insertBefore(shot, anchor.firstChild);

    var scan = document.createElement('span');
    scan.className = 'friend-card-scan';
    scan.setAttribute('aria-hidden', 'true');
    anchor.appendChild(scan);
    var footer = document.createElement('span');
    footer.className = 'friend-card-footer';
    footer.textContent = '● VISIT SITE';
    anchor.appendChild(footer);
    item.dataset.friendTechReady = 'true';
  }

  function enhanceGroupHeadings(flink) {
    Array.from(flink.children).forEach(function (heading) {
      if (heading.tagName !== 'H2') return;
      var desc = heading.nextElementSibling;
      var list = desc && desc.classList.contains('flink-desc')
        ? desc.nextElementSibling
        : heading.nextElementSibling;
      var groupName = heading.textContent.trim();
      var groupHead = document.createElement('div');
      groupHead.className = 'friend-group-heading';
      groupHead.setAttribute('aria-label', groupName + '分组');

      if (list && list.classList.contains('flink-list')) {
        list.classList.add(groupName === '技术参考' ? 'friend-reference-list' : 'friend-personal-list');
      }

      var symbol = document.createElement('span');
      symbol.className = 'friend-group-symbol';
      symbol.innerHTML = '<i class="fas fa-satellite-dish" aria-hidden="true"></i>';

      heading.parentNode.insertBefore(groupHead, heading);
      groupHead.appendChild(symbol);
      groupHead.appendChild(heading);
      if (desc && desc.classList.contains('flink-desc')) groupHead.appendChild(desc);
    });
  }

  function bindPage() {
    if (observer) observer.disconnect();
    var flink = document.querySelector('#page .flink');
    if (!flink) return;
    loadData().then(function (links) {
      function run() {
        flink.classList.add('friend-tech-ready');
        enhanceGroupHeadings(flink);
        flink.querySelectorAll('.flink-list-item').forEach(function (item) {
          enhance(item, links);
        });
      }
      run();
      observer = new MutationObserver(run);
      observer.observe(flink, { childList: true, subtree: true });
    });
  }

  document.addEventListener('pjax:complete', bindPage);
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindPage);
  } else {
    bindPage();
  }
})();
