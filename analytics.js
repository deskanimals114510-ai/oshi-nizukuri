// GA4計測。ローカル開発サーバーからのアクセスは除外し、本番GA4へのダミーpageview記録を防ぐ。
// GA4プロパティ「診断ツール群」(549448334)のウェブストリーム「推しと荷づくり」(16177698069、2026-10-22作成)。
(function () {
  const GA_MEASUREMENT_ID = 'G-ZKMJ4YNYQR';
  const host = location.hostname;
  const isLocalDev = ['localhost', '127.0.0.1', '[::1]', ''].includes(host) || host.endsWith('.local') ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host); // スマホ実機確認のLAN内アドレスも除外
  if (!GA_MEASUREMENT_ID || isLocalDev) return;
  const gaScript = document.createElement('script');
  gaScript.async = true;
  gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(gaScript);
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, { page_location: location.href });

  // 外部リンクのクリックを計測。Amazonはamazon_click(どの持ち物・どの商品・どのページから)で分けて数える。
  // 全リンクのtagがtinywonders-22で他サイトと共通のため、Amazon側のレポートだけではこのサイトの効果が分からない。
  // 中ボタンで新しいタブに開いた分も数えるため、auxclickも同じ処理で拾う
  function onLinkClick(e) {
    const a = e.target.closest('a[href]');
    if (!a) return;
    let url;
    try { url = new URL(a.getAttribute('href'), location.href); } catch (err) { return; }
    if (url.hostname === location.hostname) return;
    const linkText = (a.textContent || '').trim().slice(0, 100);
    if (/(^|\.)amazon\.co\.jp$/.test(url.hostname)) {
      window.gtag('event', 'amazon_click', {
        link_url: url.href,
        link_text: linkText,
        page_path: location.pathname,
        item_id: a.dataset.item || '',
        asin: a.dataset.asin || ''
      });
    } else {
      window.gtag('event', 'outbound_click', {
        link_url: url.href,
        link_domain: url.hostname,
        link_text: linkText
      });
    }
  }
  document.addEventListener('click', onLinkClick, true);
  document.addEventListener('auxclick', function (e) { if (e.button === 1) onLinkClick(e); }, true);
})();
