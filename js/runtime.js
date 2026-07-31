/**
 * 网站运行时间与旅行者 1 号距离信息。
 *
 * 旧版本依赖 custom-footer.js 预先创建 #workboard；一旦自定义页脚没有
 * 插入成功，脚本虽然正常加载，也没有任何可见输出。现在脚本会：
 * 1. 优先使用自定义页脚中的 #workboard；
 * 2. 找不到时，在 Butterfly 当前版本的页脚中创建独立容器；
 * 3. 兼容 PJAX，并避免重复计时器和重复节点；
 * 4. 使用本地状态标签，不再依赖容易失效的远程徽章图片。
 *
 * 页面中的时间与距离由浏览器实时计算；源文件只保存起始参数和计算逻辑。
 */
(function () {
  'use strict';

  var SITE_BIRTH = new Date('2025-06-29T10:46:34+08:00');
  var AU_IN_KM = 149597870.7;
  var FALLBACK_JULIAN_DAY = 2461247.5;
  var FALLBACK_DISTANCE_KM = 25534609993;
  var FALLBACK_RANGE_RATE_KM_S = 34.254380783;
  var DEPLOY_BUSY_DURATION_MS = 3 * 60 * 60 * 1000;
  var voyagerEphemeris = null;
  var ephemerisRequest = null;
  var deployStatus = null;
  var deployStatusRequest = null;
  var deployStatusRefreshTimer = null;
  var timerId = null;

  function pad(number) {
    return String(number).padStart(2, '0');
  }

  function findOrCreateBoard() {
    var existing = document.getElementById('workboard');
    if (existing) return existing;

    var footer =
      document.querySelector('#footer .footer-other') ||
      document.getElementById('footer');

    if (!footer) return null;

    var board = document.createElement('section');
    board.id = 'workboard';
    board.className = 'runtime-board runtime-board--standalone';
    board.setAttribute('aria-label', '网站运行状态');

    var quote = footer.querySelector('#ft.footer-quote');
    var copyright = footer.querySelector('.footer-copyright');
    var anchor = quote || copyright;

    if (anchor) {
      footer.insertBefore(board, anchor);
    } else {
      footer.appendChild(board);
    }

    return board;
  }

  function prepareBoard(board) {
    board.classList.add('runtime-board');

    if (board.dataset.runtimeReady === 'true') return;

    board.innerHTML =
      '<div class="runtime-status-row">' +
        '<span class="runtime-status-dot" aria-hidden="true"></span>' +
        '<span class="runtime-status-text"></span>' +
      '</div>' +
      '<div class="runtime-details">' +
        '<div class="runtime-line">' +
          '<i class="fas fa-heartbeat" aria-hidden="true"></i>' +
          '<span>本站已运行 </span>' +
          '<strong class="runtime-duration"></strong>' +
        '</div>' +
        '<div class="runtime-line runtime-voyager">' +
          '<i class="fas fa-rocket" aria-hidden="true"></i>' +
          '<span>旅行者 1 号距离地球约 </span>' +
          '<strong class="runtime-distance"></strong>' +
          '<span> 千米（</span>' +
          '<strong class="runtime-au"></strong>' +
          '<span> AU）</span>' +
          '<span class="runtime-data-source" title="NASA/JPL Horizons 地心几何星历">JPL</span>' +
        '</div>' +
      '</div>';

    board.dataset.runtimeReady = 'true';
  }

  function unixTimeToJulianDay(time) {
    return time / 86400000 + 2440587.5;
  }

  function interpolateVoyagerDistance(now) {
    var currentJulianDay = unixTimeToJulianDay(now.getTime());
    var points =
      voyagerEphemeris &&
      Array.isArray(voyagerEphemeris.points)
        ? voyagerEphemeris.points
        : null;

    if (points && points.length >= 2) {
      var first = points[0];
      var last = points[points.length - 1];

      if (currentJulianDay <= first[0]) {
        return first[1] +
          (currentJulianDay - first[0]) * 86400 * first[2];
      }
      if (currentJulianDay >= last[0]) {
        return last[1] +
          (currentJulianDay - last[0]) * 86400 * last[2];
      }

      var low = 0;
      var high = points.length - 1;
      while (high - low > 1) {
        var middle = Math.floor((low + high) / 2);
        if (points[middle][0] <= currentJulianDay) {
          low = middle;
        } else {
          high = middle;
        }
      }

      var start = points[low];
      var end = points[high];
      var ratio =
        (currentJulianDay - start[0]) /
        (end[0] - start[0]);
      return start[1] + (end[1] - start[1]) * ratio;
    }

    return FALLBACK_DISTANCE_KM +
      (currentJulianDay - FALLBACK_JULIAN_DAY) *
      86400 *
      FALLBACK_RANGE_RATE_KM_S;
  }

  function loadVoyagerEphemeris() {
    if (voyagerEphemeris) return Promise.resolve(voyagerEphemeris);
    if (ephemerisRequest) return ephemerisRequest;

    var dailyCacheKey = Math.floor(Date.now() / 86400000);
    ephemerisRequest = window
      .fetch(
        '/data/voyager1-ephemeris.json?v=' + dailyCacheKey,
        { cache: 'no-cache' }
      )
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Ephemeris request failed: ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        if (!data || !Array.isArray(data.points) || data.points.length < 2) {
          throw new Error('Invalid ephemeris data');
        }
        voyagerEphemeris = data;
        updateBoard();
        return data;
      })
      .catch(function (error) {
        ephemerisRequest = null;
        console.warn('[runtime] 使用 JPL 校准回退值：', error);
        return null;
      });

    return ephemerisRequest;
  }

  function loadDeployStatus() {
    if (deployStatusRequest) return deployStatusRequest;

    var cacheWindow = Math.floor(Date.now() / 300000);
    deployStatusRequest = window
      .fetch(
        '/data/deploy-status.json?v=' + cacheWindow,
        { cache: 'no-store' }
      )
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Deploy status request failed: ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        var deployedAt = data && Date.parse(data.deployedAt);
        deployStatus = Number.isFinite(deployedAt) ? data : null;
        updateBoard();
        return deployStatus;
      })
      .catch(function (error) {
        deployStatus = null;
        console.warn('[runtime] 无法读取部署状态：', error);
        return null;
      })
      .finally(function () {
        deployStatusRequest = null;
      });

    return deployStatusRequest;
  }

  function updateBoard() {
    var board = findOrCreateBoard();
    if (!board) return;

    prepareBoard(board);

    var now = new Date();
    var elapsed = Math.max(0, now.getTime() - SITE_BIRTH.getTime());
    var totalSeconds = Math.floor(elapsed / 1000);
    var days = Math.floor(totalSeconds / 86400);
    var hours = Math.floor((totalSeconds % 86400) / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;

    var distance = Math.trunc(interpolateVoyagerDistance(now));
    var astronomicalUnits = (distance / AU_IN_KM).toFixed(3);

    var deployedAt =
      deployStatus && deployStatus.deployedAt
        ? Date.parse(deployStatus.deployedAt)
        : NaN;
    var busyUntil =
      deployStatus && deployStatus.busyUntil
        ? Date.parse(deployStatus.busyUntil)
        : deployedAt + DEPLOY_BUSY_DURATION_MS;
    var isWorking =
      Number.isFinite(deployedAt) &&
      Number.isFinite(busyUntil) &&
      now.getTime() >= deployedAt &&
      now.getTime() < busyUntil;
    var statusText = board.querySelector('.runtime-status-text');
    var duration = board.querySelector('.runtime-duration');
    var distanceText = board.querySelector('.runtime-distance');
    var auText = board.querySelector('.runtime-au');

    board.classList.toggle('is-working', isWorking);
    board.classList.toggle('is-resting', !isWorking);

    if (statusText) {
      statusText.textContent = isWorking
        ? '忙碌中 · 博客正在建设'
        : '博客在线 · 此刻正在安静运行';
    }
    if (duration) {
      duration.textContent =
        days + ' 天 ' +
        pad(hours) + ' 小时 ' +
        pad(minutes) + ' 分 ' +
        pad(seconds) + ' 秒';
    }
    if (distanceText) {
      distanceText.textContent = distance.toLocaleString('zh-CN');
    }
    if (auText) {
      auText.textContent = astronomicalUnits;
    }
  }

  function startRuntime() {
    updateBoard();
    loadVoyagerEphemeris();
    loadDeployStatus();

    if (timerId === null) {
      timerId = window.setInterval(updateBoard, 1000);
    }
    if (deployStatusRefreshTimer === null) {
      deployStatusRefreshTimer = window.setInterval(
        loadDeployStatus,
        5 * 60 * 1000
      );
    }
  }

  document.addEventListener('pjax:complete', startRuntime);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) updateBoard();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startRuntime);
  } else {
    startRuntime();
  }
})();
