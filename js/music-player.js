/**
 * 自定义网易云歌单播放器。
 * 网易云接口仅用于获取歌曲信息与音频地址，界面和播放逻辑均由本站控制。
 */
(function () {
  'use strict';

  var PLAYLIST_ID = '2791970710';
  var PLAYLIST_LIMIT = 100;
  var METING_API =
    'https://api.i-meto.com/meting/api' +
    '?server=netease&type=playlist&id=' + PLAYLIST_ID;

  var root = null;
  var audio = null;
  var tracks = [];
  var currentIndex = 0;
  var playRequested = false;
  var pendingPlayAfterMetadata = false;
  var closeTimer = null;
  var skippedPreviewUrls = {};
  var trackProbeCache = {};
  var preparedNext = null;
  var trackLoadToken = 0;
  var prepareToken = 0;
  var mountObserver = null;
  var playbackMode = 'list';
  var lastAudibleVolume = 0.55;
  var PREVIEW_MIN_SECONDS = 28;
  var PREVIEW_MAX_SECONDS = 32.5;
  var PROBE_TIMEOUT_MS = 15000;

  var PLAYBACK_MODES = {
    list: '列表循环',
    shuffle: '随机播放',
    sequential: '顺序播放',
    single: '单曲循环'
  };

  function readSetting(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  }

  function saveSetting(key, value) {
    try {
      window.localStorage.setItem(key, String(value));
    } catch (error) {
      /* 隐私模式下无法写入时，仍允许本次访问正常使用。 */
    }
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
    var minutes = Math.floor(seconds / 60);
    var remainder = Math.floor(seconds % 60);
    return String(minutes).padStart(2, '0') + ':' +
      String(remainder).padStart(2, '0');
  }

  function normalizeTracks(rawTracks) {
    if (!Array.isArray(rawTracks)) return [];

    return rawTracks
      .slice(0, PLAYLIST_LIMIT)
      .filter(function (track) {
        return track && track.url;
      })
      .map(function (track) {
        return {
          name: track.title || '未知歌曲',
          artist: track.author || '未知歌手',
          url: track.url,
          cover: track.pic || ''
        };
      });
  }

  function normalizeTrackIndex(index) {
    return (index + tracks.length) % tracks.length;
  }

  function isPreviewDuration(duration) {
    return Number.isFinite(duration) &&
      duration >= PREVIEW_MIN_SECONDS &&
      duration <= PREVIEW_MAX_SECONDS;
  }

  function updateTrackAvailability(index, status) {
    if (!root) return;
    var button = root.querySelector(
      '.cmp-track[data-index="' + index + '"]'
    );
    if (!button) return;

    var unavailable = status === 'preview' || status === 'error';
    button.classList.toggle('is-unavailable', unavailable);

    if (status === 'preview') {
      button.title = '仅提供 30 秒试听，播放时将自动跳过';
    } else if (status === 'error') {
      button.title = '当前音频地址不可用';
    } else {
      button.removeAttribute('title');
    }
  }

  /**
   * 用独立 Audio 在真正播放前读取元数据。
   * preload=auto 会同时预热浏览器媒体缓存，但探测音频从不调用 play()。
   */
  function probeTrack(index) {
    index = normalizeTrackIndex(index);
    var track = tracks[index];
    var cached = trackProbeCache[track.url];

    if (cached) {
      if (cached.status === 'playable' && !cached.audio) {
        cached.audio = document.createElement('audio');
        cached.audio.preload = 'auto';
        cached.audio.src = track.url;
        cached.audio.load();
      }
      return cached.promise;
    }

    var probeAudio = document.createElement('audio');
    probeAudio.preload = 'auto';
    probeAudio.src = track.url;

    var record = {
      status: 'probing',
      duration: NaN,
      audio: probeAudio,
      promise: null
    };

    record.promise = new Promise(function (resolve) {
      var settled = false;
      var timeoutId = window.setTimeout(function () {
        finish('error', NaN);
      }, PROBE_TIMEOUT_MS);

      function cleanupListeners() {
        window.clearTimeout(timeoutId);
        probeAudio.removeEventListener('loadedmetadata', handleMetadata);
        probeAudio.removeEventListener('error', handleError);
      }

      function finish(status, duration) {
        if (settled) return;
        settled = true;
        cleanupListeners();

        record.status = status;
        record.duration = duration;
        updateTrackAvailability(index, status);

        if (status !== 'playable') {
          probeAudio.removeAttribute('src');
          probeAudio.load();
          record.audio = null;
        }

        resolve({
          index: index,
          status: status,
          duration: duration
        });
      }

      function handleMetadata() {
        var duration = probeAudio.duration;
        finish(
          isPreviewDuration(duration) ? 'preview' : 'playable',
          duration
        );
      }

      function handleError() {
        finish('error', NaN);
      }

      probeAudio.addEventListener('loadedmetadata', handleMetadata);
      probeAudio.addEventListener('error', handleError);
      probeAudio.load();
    });

    trackProbeCache[track.url] = record;
    return record.promise;
  }

  function releaseProbeAudio(track) {
    if (!track) return;
    var record = trackProbeCache[track.url];
    if (!record || !record.audio) return;

    record.audio.removeAttribute('src');
    record.audio.load();
    record.audio = null;
  }

  function createSequentialCandidates(startIndex, direction, allowWrap) {
    var candidates = [];
    var rawIndex = startIndex;

    for (var step = 0; step < tracks.length; step += 1) {
      if (!allowWrap && (rawIndex < 0 || rawIndex >= tracks.length)) break;
      candidates.push(normalizeTrackIndex(rawIndex));
      rawIndex += direction;
    }

    return candidates;
  }

  function createShuffleCandidates() {
    var candidates = tracks.map(function (_, index) {
      return index;
    }).filter(function (index) {
      return index !== currentIndex;
    });

    for (var index = candidates.length - 1; index > 0; index -= 1) {
      var randomIndex = Math.floor(Math.random() * (index + 1));
      var temporary = candidates[index];
      candidates[index] = candidates[randomIndex];
      candidates[randomIndex] = temporary;
    }

    return candidates;
  }

  function findPlayableTrack(candidates) {
    var position = 0;

    function checkNext() {
      if (position >= candidates.length) return Promise.resolve(null);
      var index = candidates[position];
      position += 1;

      return probeTrack(index).then(function (result) {
        if (result.status === 'playable') return result.index;

        if (result.status === 'preview') {
          skippedPreviewUrls[tracks[result.index].url] = true;
        }
        return checkNext();
      });
    }

    return checkNext();
  }

  function nextCandidates() {
    if (playbackMode === 'shuffle') return createShuffleCandidates();
    if (playbackMode === 'single') return [currentIndex];

    return createSequentialCandidates(
      currentIndex + 1,
      1,
      playbackMode !== 'sequential'
    );
  }

  function prepareNextTrack() {
    if (!tracks.length) return;
    var token = ++prepareToken;
    var fromIndex = currentIndex;
    var mode = playbackMode;
    var candidates = nextCandidates();

    preparedNext = null;
    if (!candidates.length) return;

    findPlayableTrack(candidates).then(function (index) {
      if (
        token !== prepareToken ||
        index === null ||
        currentIndex !== fromIndex ||
        playbackMode !== mode
      ) {
        return;
      }

      preparedNext = {
        index: index,
        fromIndex: fromIndex,
        mode: mode
      };

      if (audio && !audio.paused) {
        setStatus('下一首已预载：' + tracks[index].name);
      }
    });
  }

  function createInterface() {
    root = document.createElement('div');
    root.id = 'custom-music-player';
    root.className = 'custom-music-player is-loading';
    root.innerHTML =
      '<section class="cmp-panel" aria-label="音乐播放器">' +
        '<div class="cmp-current">' +
          '<div class="cmp-cover-wrap">' +
            '<img class="cmp-cover" alt="" src="" referrerpolicy="no-referrer">' +
            '<span class="cmp-cover-fallback" aria-hidden="true">♫</span>' +
          '</div>' +
          '<div class="cmp-meta">' +
            '<div class="cmp-title">正在载入歌单</div>' +
            '<div class="cmp-artist">网易云音乐</div>' +
          '</div>' +
        '</div>' +
        '<div class="cmp-progress-row">' +
          '<span class="cmp-time-current">00:00</span>' +
          '<input class="cmp-progress" type="range" min="0" max="100" value="0" step="0.1" aria-label="播放进度">' +
          '<span class="cmp-time-total">00:00</span>' +
        '</div>' +
        '<div class="cmp-controls">' +
          '<button class="cmp-control cmp-prev" type="button" aria-label="上一首" title="上一首">‹</button>' +
          '<button class="cmp-control cmp-play" type="button" aria-label="播放" title="播放">▶</button>' +
          '<button class="cmp-control cmp-next" type="button" aria-label="下一首" title="下一首">›</button>' +
          '<button class="cmp-control cmp-list-toggle" type="button" aria-label="显示歌单" aria-expanded="false" title="歌单">☷</button>' +
        '</div>' +
        '<div class="cmp-options">' +
          '<div class="cmp-volume-control">' +
            '<button class="cmp-volume-toggle" type="button" aria-label="静音" title="静音">🔊</button>' +
            '<input class="cmp-volume" type="range" min="0" max="1" value="0.55" step="0.01" aria-label="音量">' +
          '</div>' +
          '<label class="cmp-mode-wrap">' +
            '<span class="cmp-mode-icon" aria-hidden="true">↻</span>' +
            '<select class="cmp-mode" aria-label="播放模式">' +
              '<option value="list">列表循环</option>' +
              '<option value="shuffle">随机播放</option>' +
              '<option value="sequential">顺序播放</option>' +
              '<option value="single">单曲循环</option>' +
            '</select>' +
          '</label>' +
        '</div>' +
        '<div class="cmp-status" role="status" aria-live="polite">正在连接网易云歌单…</div>' +
        '<div class="cmp-playlist" hidden>' +
          '<ol class="cmp-playlist-items"></ol>' +
        '</div>' +
      '</section>' +
      '<button class="cmp-toggle" type="button" aria-label="展开音乐播放器" aria-expanded="false" title="音乐播放器">' +
        '<span class="cmp-toggle-icon" aria-hidden="true">♫</span>' +
      '</button>';

    audio = document.createElement('audio');
    audio.preload = 'metadata';
    root.appendChild(audio);
    document.body.appendChild(root);

    var savedMode = readSetting('cmp-playback-mode');
    if (PLAYBACK_MODES[savedMode]) playbackMode = savedMode;

    var savedVolume = Number(readSetting('cmp-volume'));
    audio.volume = Number.isFinite(savedVolume) &&
      savedVolume >= 0 &&
      savedVolume <= 1
      ? savedVolume
      : 0.55;
    if (audio.volume > 0) lastAudibleVolume = audio.volume;

    root.querySelector('.cmp-mode').value = playbackMode;
    root.querySelector('.cmp-volume').value = String(audio.volume);
    updateVolumeButton();

    bindInterfaceEvents();
    bindAudioEvents();
  }

  function setOpen(open) {
    if (!root) return;
    root.classList.toggle('is-open', open);

    var toggle = root.querySelector('.cmp-toggle');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute(
      'aria-label',
      open ? '收起音乐播放器' : '展开音乐播放器'
    );
    root.querySelector('.cmp-toggle-icon').textContent = open ? '‹' : '♫';
  }

  function setStatus(message, isError) {
    if (!root) return;
    var status = root.querySelector('.cmp-status');
    status.textContent = message || '';
    status.classList.toggle('is-error', Boolean(isError));
  }

  function updatePlayButton() {
    if (!root) return;
    var button = root.querySelector('.cmp-play');
    var playing = audio && !audio.paused;
    button.textContent = playing ? '❚❚' : '▶';
    button.setAttribute('aria-label', playing ? '暂停' : '播放');
    button.title = playing ? '暂停' : '播放';
    root.classList.toggle('is-playing', playing);
  }

  function updateVolumeButton() {
    if (!root || !audio) return;
    var button = root.querySelector('.cmp-volume-toggle');
    var effectiveVolume = audio.muted ? 0 : audio.volume;
    var icon = effectiveVolume === 0
      ? '🔇'
      : effectiveVolume < 0.5 ? '🔉' : '🔊';

    button.textContent = icon;
    button.setAttribute(
      'aria-label',
      effectiveVolume === 0 ? '恢复音量' : '静音'
    );
    button.title = effectiveVolume === 0 ? '恢复音量' : '静音';
  }

  function renderPlaylist() {
    var list = root.querySelector('.cmp-playlist-items');
    list.textContent = '';

    tracks.forEach(function (track, index) {
      var item = document.createElement('li');
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'cmp-track';
      button.dataset.index = String(index);
      button.innerHTML =
        '<span class="cmp-track-index">' + (index + 1) + '</span>' +
        '<span class="cmp-track-text">' +
          '<span class="cmp-track-title"></span>' +
          '<span class="cmp-track-artist"></span>' +
        '</span>';
      button.querySelector('.cmp-track-title').textContent = track.name;
      button.querySelector('.cmp-track-artist').textContent = track.artist;
      item.appendChild(button);
      list.appendChild(item);
    });
  }

  function updateActiveTrack() {
    if (!root) return;
    var buttons = root.querySelectorAll('.cmp-track');
    Array.prototype.forEach.call(buttons, function (button, index) {
      var active = index === currentIndex;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'true' : 'false');
    });
  }

  function applyTrack(index, shouldPlay) {
    currentIndex = normalizeTrackIndex(index);
    var track = tracks[currentIndex];
    var cover = root.querySelector('.cmp-cover');

    preparedNext = null;
    prepareToken += 1;
    root.querySelector('.cmp-title').textContent = track.name;
    root.querySelector('.cmp-artist').textContent = track.artist;
    cover.src = track.cover;
    cover.alt = track.name + ' 封面';
    root.classList.remove('has-cover');
    root.querySelector('.cmp-progress').value = '0';
    root.querySelector('.cmp-time-current').textContent = '00:00';
    root.querySelector('.cmp-time-total').textContent = '00:00';

    pendingPlayAfterMetadata = Boolean(shouldPlay);
    playRequested = Boolean(shouldPlay);
    audio.src = track.url;
    audio.load();
    updateActiveTrack();
    setStatus('第 ' + (currentIndex + 1) + ' 首，共 ' + tracks.length + ' 首');
    updatePlayButton();
    prepareNextTrack();
  }

  function loadTrack(index, shouldPlay, options) {
    if (!tracks.length) return;
    options = options || {};

    var requestToken = ++trackLoadToken;
    var direction = options.direction || 1;
    var allowWrap = options.allowWrap !== false;
    var candidates = options.candidates || createSequentialCandidates(
      index,
      direction,
      allowWrap
    );

    setStatus('正在检查歌曲权限并预载…');

    findPlayableTrack(candidates).then(function (playableIndex) {
      if (requestToken !== trackLoadToken) return;

      if (playableIndex === null) {
        playRequested = false;
        pendingPlayAfterMetadata = false;
        updatePlayButton();
        setStatus('没有找到可完整播放的歌曲', true);
        return;
      }

      applyTrack(playableIndex, shouldPlay);
    });
  }

  function playAudioNow() {
    var promise = audio.play();
    if (promise && typeof promise.catch === 'function') {
      promise.catch(function () {
        setStatus('当前歌曲无法播放，正在尝试下一首…', true);
        window.setTimeout(function () {
          nextTrack(true, 'skip');
        }, 650);
      });
    }
  }

  function skipCurrentBeforePlayback(shouldContinue) {
    var track = tracks[currentIndex];
    if (!track) return;

    skippedPreviewUrls[track.url] = true;
    pendingPlayAfterMetadata = false;
    audio.pause();
    updateTrackAvailability(currentIndex, 'preview');
    setStatus('已跳过 30 秒试听歌曲：' + track.name);
    nextTrack(Boolean(shouldContinue), 'skip');
  }

  function playCurrent() {
    if (!tracks.length) return;
    var track = tracks[currentIndex];
    var record = trackProbeCache[track.url];

    playRequested = true;

    if (record && record.status === 'preview') {
      skipCurrentBeforePlayback(true);
      return;
    }

    if (audio.readyState < 1) {
      pendingPlayAfterMetadata = true;
      setStatus('歌曲预载中…');
      audio.load();
      return;
    }

    if (isPreviewDuration(audio.duration)) {
      skipCurrentBeforePlayback(true);
      return;
    }

    pendingPlayAfterMetadata = false;
    playAudioNow();
  }

  function nextTrack(shouldPlay, reason) {
    reason = reason || 'manual';

    if (reason === 'ended' && playbackMode === 'single') {
      audio.currentTime = 0;
      playCurrent();
      return;
    }

    if (
      reason === 'ended' &&
      playbackMode === 'sequential' &&
      currentIndex === tracks.length - 1
    ) {
      playRequested = false;
      audio.pause();
      audio.currentTime = 0;
      updatePlayButton();
      setStatus('顺序播放已完成');
      return;
    }

    if (
      preparedNext &&
      preparedNext.fromIndex === currentIndex &&
      preparedNext.mode === playbackMode
    ) {
      applyTrack(preparedNext.index, shouldPlay);
      return;
    }

    var candidates = nextCandidates();
    loadTrack(
      candidates.length ? candidates[0] : currentIndex + 1,
      shouldPlay,
      { candidates: candidates }
    );
  }

  function previousTrack() {
    if (audio.currentTime > 5) {
      audio.currentTime = 0;
      return;
    }
    loadTrack(
      currentIndex - 1,
      playRequested,
      {
        direction: -1,
        allowWrap: true
      }
    );
  }

  function togglePlaylist() {
    var playlist = root.querySelector('.cmp-playlist');
    var button = root.querySelector('.cmp-list-toggle');
    var willOpen = playlist.hidden;

    playlist.hidden = !willOpen;
    button.classList.toggle('is-active', willOpen);
    button.setAttribute('aria-expanded', String(willOpen));
    button.setAttribute('aria-label', willOpen ? '隐藏歌单' : '显示歌单');

    if (willOpen) {
      var active = root.querySelector('.cmp-track.is-active');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }
  }

  function bindInterfaceEvents() {
    var toggle = root.querySelector('.cmp-toggle');

    toggle.addEventListener('click', function () {
      setOpen(!root.classList.contains('is-open'));
    });

    root.querySelector('.cmp-play').addEventListener('click', function () {
      if (!tracks.length) return;
      if (audio.paused) {
        playCurrent();
      } else {
        playRequested = false;
        audio.pause();
      }
    });

    root.querySelector('.cmp-prev').addEventListener('click', previousTrack);
    root.querySelector('.cmp-next').addEventListener('click', function () {
      nextTrack(playRequested, 'manual');
    });
    root.querySelector('.cmp-list-toggle').addEventListener('click', togglePlaylist);

    root.querySelector('.cmp-volume').addEventListener('input', function (event) {
      var volume = Number(event.target.value);
      audio.muted = false;
      audio.volume = volume;
      if (volume > 0) lastAudibleVolume = volume;
      saveSetting('cmp-volume', volume);
      updateVolumeButton();
    });

    root.querySelector('.cmp-volume-toggle').addEventListener('click', function () {
      if (audio.muted || audio.volume === 0) {
        audio.muted = false;
        audio.volume = lastAudibleVolume || 0.55;
        root.querySelector('.cmp-volume').value = String(audio.volume);
      } else {
        lastAudibleVolume = audio.volume;
        audio.muted = true;
      }
      saveSetting('cmp-volume', audio.muted ? 0 : audio.volume);
      updateVolumeButton();
    });

    root.querySelector('.cmp-mode').addEventListener('change', function (event) {
      var selectedMode = event.target.value;
      if (!PLAYBACK_MODES[selectedMode]) return;
      playbackMode = selectedMode;
      preparedNext = null;
      prepareToken += 1;
      saveSetting('cmp-playback-mode', playbackMode);
      setStatus('播放模式：' + PLAYBACK_MODES[playbackMode]);
      prepareNextTrack();
    });

    root.querySelector('.cmp-progress').addEventListener('input', function (event) {
      if (!Number.isFinite(audio.duration)) return;
      audio.currentTime = audio.duration * (Number(event.target.value) / 100);
    });

    root.querySelector('.cmp-playlist-items').addEventListener('click', function (event) {
      var button = event.target.closest('.cmp-track');
      if (!button) return;
      loadTrack(Number(button.dataset.index), true);
    });

    var cover = root.querySelector('.cmp-cover');
    cover.addEventListener('load', function () {
      root.classList.add('has-cover');
    });
    cover.addEventListener('error', function () {
      root.classList.remove('has-cover');
    });

    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      root.addEventListener('mouseenter', function () {
        window.clearTimeout(closeTimer);
        setOpen(true);
      });
      root.addEventListener('mouseleave', function () {
        closeTimer = window.setTimeout(function () {
          setOpen(false);
        }, 500);
      });
    }
  }

  function bindAudioEvents() {
    audio.addEventListener('play', updatePlayButton);
    audio.addEventListener('pause', updatePlayButton);
    audio.addEventListener('ended', function () {
      nextTrack(true, 'ended');
    });
    audio.addEventListener('loadedmetadata', function () {
      root.querySelector('.cmp-time-total').textContent =
        formatTime(audio.duration);

      var track = tracks[currentIndex];
      releaseProbeAudio(track);
      if (track && isPreviewDuration(audio.duration)) {
        var record = trackProbeCache[track.url];
        if (record) {
          record.status = 'preview';
          record.duration = audio.duration;
        }
        skipCurrentBeforePlayback(
          playRequested || pendingPlayAfterMetadata
        );
        return;
      }

      if (pendingPlayAfterMetadata && playRequested) {
        pendingPlayAfterMetadata = false;
        playAudioNow();
      }
    });
    audio.addEventListener('timeupdate', function () {
      var ratio = Number.isFinite(audio.duration) && audio.duration > 0
        ? (audio.currentTime / audio.duration) * 100
        : 0;
      root.querySelector('.cmp-progress').value = String(ratio);
      root.querySelector('.cmp-time-current').textContent =
        formatTime(audio.currentTime);
    });
    audio.addEventListener('error', function () {
      var track = tracks[currentIndex];
      if (track && trackProbeCache[track.url]) {
        trackProbeCache[track.url].status = 'error';
      }
      updateTrackAvailability(currentIndex, 'error');

      var shouldContinue = playRequested || pendingPlayAfterMetadata;
      pendingPlayAfterMetadata = false;
      setStatus('当前歌曲不可用，正在跳到下一首…', true);
      window.setTimeout(function () {
        nextTrack(shouldContinue, 'skip');
      }, 120);
    });
  }

  function loadPlaylist() {
    window.fetch(METING_API, { mode: 'cors' })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Playlist request failed: ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        tracks = normalizeTracks(data);
        if (!tracks.length) throw new Error('No playable tracks returned');

        renderPlaylist();
        root.classList.remove('is-loading');
        root.classList.add('is-ready');
        loadTrack(0, false);
      })
      .catch(function (error) {
        root.classList.remove('is-loading');
        root.classList.add('has-error');
        root.querySelector('.cmp-title').textContent = '歌单加载失败';
        root.querySelector('.cmp-artist').textContent = '请稍后重试';
        setStatus('无法连接网易云歌单', true);
        console.error('[custom-music-player]', error);
      });
  }

  function initialize() {
    var existing = document.getElementById('custom-music-player');
    if (existing) {
      root = existing;
      audio = existing.querySelector('audio');
      return;
    }
    createInterface();
    loadPlaylist();
  }

  function ensurePlayerMounted() {
    if (!document.body) return;

    if (!root) {
      initialize();
      return;
    }

    if (!root.isConnected || root.parentElement !== document.body) {
      document.body.appendChild(root);
    }

    root.hidden = false;
    root.setAttribute('data-current-page', window.location.pathname);
  }

  function handlePageReady() {
    window.requestAnimationFrame(function () {
      ensurePlayerMounted();
    });
  }

  function observePlayerMount() {
    if (mountObserver || !document.body) return;
    mountObserver = new MutationObserver(function () {
      if (root && !root.isConnected) ensurePlayerMounted();
    });
    mountObserver.observe(document.body, { childList: true });
  }

  document.addEventListener('pjax:complete', handlePageReady);
  window.addEventListener('pageshow', handlePageReady);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initialize();
      observePlayerMount();
    });
  } else {
    initialize();
    observePlayerMount();
  }

  window.__unmyicMusicPlayer = {
    ensureMounted: ensurePlayerMounted,
    open: function () { setOpen(true); },
    close: function () { setOpen(false); }
  };
})();
