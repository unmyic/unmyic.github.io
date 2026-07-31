(function () {
  var tooltip = null;
  var activeTarget = null;
  var resizeTimer = null;
  var supportsHover = window.matchMedia(
    '(hover: hover) and (pointer: fine)'
  );

  function ensureTooltip() {
    if (tooltip && document.documentElement.contains(tooltip)) return tooltip;

    tooltip = document.createElement('div');
    tooltip.id = 'summary-detail-tooltip';
    tooltip.setAttribute('role', 'tooltip');
    tooltip.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tooltip);
    return tooltip;
  }

  function isTruncated(element) {
    return (
      element.scrollHeight > element.clientHeight + 1 ||
      element.scrollWidth > element.clientWidth + 1
    );
  }

  function positionTooltip(target) {
    if (!tooltip || !target) return;

    var gap = 10;
    var edge = 12;
    var targetRect = target.getBoundingClientRect();
    var tooltipRect = tooltip.getBoundingClientRect();
    var left =
      targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
    var top = targetRect.top - tooltipRect.height - gap;

    left = Math.max(
      edge,
      Math.min(left, window.innerWidth - tooltipRect.width - edge)
    );

    if (top < edge) {
      top = targetRect.bottom + gap;
    }

    top = Math.min(top, window.innerHeight - tooltipRect.height - edge);
    tooltip.style.left = Math.round(left) + 'px';
    tooltip.style.top = Math.round(Math.max(edge, top)) + 'px';
  }

  function showTooltip(target) {
    if (!supportsHover.matches || !target.classList.contains('summary-tooltip-target')) {
      return;
    }

    var detail = ensureTooltip();
    var text = target.textContent.replace(/\s+/g, ' ').trim();
    if (!text) return;

    activeTarget = target;
    detail.textContent = text;
    detail.setAttribute('aria-hidden', 'false');
    positionTooltip(target);
    detail.classList.add('is-visible');
  }

  function hideTooltip() {
    activeTarget = null;
    if (!tooltip) return;
    tooltip.classList.remove('is-visible');
    tooltip.setAttribute('aria-hidden', 'true');
  }

  function bindSummary(summary) {
    summary.classList.remove('summary-tooltip-target');
    summary.removeAttribute('tabindex');
    summary.removeAttribute('aria-describedby');

    if (!supportsHover.matches || !isTruncated(summary)) return;

    summary.classList.add('summary-tooltip-target');
    summary.setAttribute('tabindex', '0');
    summary.setAttribute('aria-describedby', 'summary-detail-tooltip');

    if (summary.dataset.summaryTooltipBound === 'true') return;
    summary.dataset.summaryTooltipBound = 'true';

    summary.addEventListener('mouseenter', function () {
      showTooltip(summary);
    });
    summary.addEventListener('mouseleave', hideTooltip);
    summary.addEventListener('focus', function () {
      showTooltip(summary);
    });
    summary.addEventListener('blur', hideTooltip);
  }

  function bindPage() {
    hideTooltip();
    document
      .querySelectorAll('#recent-posts .recent-post-info > .content')
      .forEach(bindSummary);
  }

  function scheduleBind() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(bindPage, 120);
  }

  window.addEventListener('resize', scheduleBind);
  window.addEventListener('scroll', function () {
    if (activeTarget) positionTooltip(activeTarget);
  }, { passive: true });
  document.addEventListener('pjax:complete', bindPage);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindPage);
  } else {
    bindPage();
  }
})();
