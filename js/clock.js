/**
 * 首页页首时光状态组件。
 * 时间使用访客设备的本地时区，不请求定位或第三方天气服务。
 */
(function () {
  'use strict';

  var root = null;
  var timerId = null;

  function pad(number) {
    return String(number).padStart(2, '0');
  }

  function getPeriod(hour) {
    if (hour >= 5 && hour < 9) {
      return { greeting: '早上好，愿今天从容展开', icon: '🌅', name: 'morning' };
    }
    if (hour >= 9 && hour < 12) {
      return { greeting: '上午好，保持好奇与专注', icon: '☀️', name: 'day' };
    }
    if (hour >= 12 && hour < 14) {
      return { greeting: '中午好，记得稍作休息', icon: '🌤️', name: 'noon' };
    }
    if (hour >= 14 && hour < 18) {
      return { greeting: '下午好，继续探索吧', icon: '⛅', name: 'afternoon' };
    }
    if (hour >= 18 && hour < 23) {
      return { greeting: '晚上好，适合阅读与思考', icon: '🌙', name: 'evening' };
    }
    return { greeting: '夜深了，也要照顾好自己', icon: '✨', name: 'night' };
  }

  function createMoment() {
    var siteInfo = document.getElementById('site-info');
    if (!siteInfo) {
      root = null;
      return null;
    }

    var existing = document.getElementById('header-moment');
    if (existing) {
      root = existing;
      return root;
    }

    root = document.createElement('section');
    root.id = 'header-moment';
    root.className = 'header-moment';
    root.setAttribute('aria-label', '当前日期时间与今日进度');
    root.title = '时间以你的设备时区为准';
    root.innerHTML =
      '<div class="hm-time-row">' +
        '<span class="hm-period-icon" aria-hidden="true"></span>' +
        '<time class="hm-clock" aria-label="当前时间"></time>' +
      '</div>' +
      '<div class="hm-context-row">' +
        '<span class="hm-date"></span>' +
        '<span class="hm-divider" aria-hidden="true"></span>' +
        '<span class="hm-greeting"></span>' +
      '</div>' +
      '<div class="hm-progress-row" title="从今天 00:00 到当前时刻">' +
        '<span class="hm-progress-label">今日进度</span>' +
        '<span class="hm-progress-track" aria-hidden="true">' +
          '<i class="hm-progress-fill"></i>' +
        '</span>' +
        '<span class="hm-progress-value"></span>' +
      '</div>';

    var socialIcons = siteInfo.querySelector('#site_social_icons');
    if (socialIcons) {
      siteInfo.insertBefore(root, socialIcons);
    } else {
      siteInfo.appendChild(root);
    }

    return root;
  }

  function updateMoment() {
    if (!root || !root.isConnected) {
      root = createMoment();
    }
    if (!root) return;

    var now = new Date();
    var hour = now.getHours();
    var period = getPeriod(hour);
    var secondsToday =
      hour * 3600 +
      now.getMinutes() * 60 +
      now.getSeconds();
    var progress = (secondsToday / 86400) * 100;

    root.dataset.period = period.name;
    root.querySelector('.hm-period-icon').textContent = period.icon;
    root.querySelector('.hm-clock').textContent =
      pad(hour) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());
    root.querySelector('.hm-date').textContent =
      new Intl.DateTimeFormat('zh-CN', {
        month: 'long',
        day: 'numeric',
        weekday: 'long'
      }).format(now);
    root.querySelector('.hm-greeting').textContent = period.greeting;
    root.querySelector('.hm-progress-fill').style.width =
      progress.toFixed(3) + '%';
    root.querySelector('.hm-progress-value').textContent =
      progress.toFixed(1) + '%';
  }

  function startMoment() {
    updateMoment();
    if (timerId === null) {
      timerId = window.setInterval(updateMoment, 1000);
    }
  }

  document.addEventListener('pjax:complete', startMoment);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) updateMoment();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startMoment);
  } else {
    startMoment();
  }
})();
