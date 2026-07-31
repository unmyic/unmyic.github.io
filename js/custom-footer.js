/**
 * 页脚格言。
 *
 * Butterfly 5.x 的页脚容器是 #footer .footer-other，不再使用旧版的
 * #footer-wrap。这里只保留格言；导航、友链、徽章、时钟和运行时间均由
 * 其他页面区域或独立脚本负责。
 */
(function () {
  'use strict';

  function insertFooterQuote() {
    if (document.getElementById('ft')) return;

    var footer =
      document.querySelector('#footer .footer-other') ||
      document.getElementById('footer');

    if (!footer) return;

    var quote = document.createElement('section');
    quote.id = 'ft';
    quote.className = 'footer-quote';
    quote.setAttribute('aria-label', '页脚格言');
    quote.innerHTML =
      '<div class="footer-quote-title">' +
        '<i class="fas fa-quote-left" aria-hidden="true"></i>' +
        '<span>格言</span>' +
      '</div>' +
      '<blockquote>' +
        '看着那个光点，是的，那就是我们的家园，我们的一切。' +
        '你所爱的每一个人，你认识的每一个人，你听说过的每一个人，' +
        '曾经有过的每一个人，都在它上面度过他们的一生。' +
        '这里聚集了一切的欢乐和痛苦，数以千计的自以为是的宗教、意识形态和经济学说，' +
        '所有的猎人与强盗、英雄与懦夫、文明的缔造者与毁灭者、国王与农夫、年轻的情侣、' +
        '母亲与父亲、满怀希望的孩子、发明家和探险家、德高望重的教师、腐败的政客、' +
        '超级明星、最高领袖、人类历史上的每一个圣人与罪犯，都住在这里——' +
        '一粒悬浮在阳光中的微尘。' +
      '</blockquote>';

    var copyright = footer.querySelector('.footer-copyright');

    if (copyright) {
      footer.insertBefore(quote, copyright);
    } else {
      footer.appendChild(quote);
    }
  }

  document.addEventListener('pjax:complete', insertFooterQuote);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', insertFooterQuote);
  } else {
    insertFooterQuote();
  }
})();
