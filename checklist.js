// 遠征の持ち物チェックリスト。項目の出し分けはCSS(index.htmlの生成スタイル)が行い、ここは件数・保存・操作を受け持つ。
// チェック・条件・推し色はlocalStorageにだけ保存する。保存値は「ページ上に存在するid・選択肢」に絞ってから使う(壊れた値や古い項目を無視するため)。
(function () {
  document.documentElement.classList.remove('no-js');
  const KEY = 'oshi-nizukuri:v1';
  const form = document.getElementById('conds');
  const items = Array.from(document.querySelectorAll('.item'));
  const boxes = items.map((li) => li.querySelector('input[type="checkbox"]'));
  const tag = document.getElementById('tag');
  const stamp = document.getElementById('stamp');
  const count = document.getElementById('count');
  const status = document.getElementById('status');
  const miniCount = document.getElementById('mini-count');
  const bar = document.getElementById('bar');
  const resetBtn = document.getElementById('reset');
  const colors = window.OSHI_COLORS || {};
  const CONDS = ['days', 'scene', 'move', 'season'];
  const sentCombos = new Set();
  let wasDone = false;

  function radios(name) {
    return Array.from(form.querySelectorAll('input[type="radio"]')).filter((r) => r.name === name);
  }

  function current(name) {
    const r = radios(name).find((x) => x.checked);
    return r ? r.value : '';
  }

  function select(name, value) {
    const r = radios(name).find((x) => x.value === value);
    if (r) r.checked = true;
  }

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      return raw && typeof raw === 'object' ? raw : {};
    } catch (e) {
      return {};
    }
  }

  function save() {
    const state = {
      cond: Object.fromEntries(CONDS.map((name) => [name, current(name)])),
      color: current('color'),
      checked: boxes.filter((b) => b.checked).map((b) => b.dataset.id)
    };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 保存できない環境では今の画面だけで動かす */ }
  }

  function restore() {
    const state = load();
    const cond = state.cond && typeof state.cond === 'object' ? state.cond : {};
    CONDS.forEach((name) => select(name, cond[name]));
    select('color', state.color);
    const checked = new Set(Array.isArray(state.checked) ? state.checked : []);
    boxes.forEach((b) => { b.checked = checked.has(b.dataset.id); });
  }

  function matches(li, name, value) {
    const allowed = li.dataset[name];
    return !allowed || allowed.split(' ').includes(value);
  }

  function applyColor() {
    const c = colors[current('color')];
    if (!c) return;
    document.documentElement.style.setProperty('--oshi', c.fill);
    document.documentElement.style.setProperty('--oshi-ink', c.ink);
  }

  // 同じ文が続くと読み上げない環境があるため、いったん空にしてから入れる
  function say(text) {
    status.textContent = '';
    requestAnimationFrame(() => { status.textContent = text; });
  }

  // announce: 条件を変えた時と完了した時だけ読み上げる(チェックのたびに読むとうるさいため)
  function update(opts) {
    const o = opts || {};
    const cond = Object.fromEntries(CONDS.map((name) => [name, current(name)]));
    items.forEach((li) => {
      li.hidden = !CONDS.every((name) => matches(li, name, cond[name]));
    });
    document.querySelectorAll('.cat').forEach((cat) => {
      const shown = Array.from(cat.querySelectorAll('.item:not([hidden])'));
      const done = shown.filter((li) => li.querySelector('input').checked).length;
      cat.hidden = shown.length === 0;
      cat.querySelector('.cat-count').textContent = `${done} / ${shown.length}`;
      cat.querySelector('.cat-count-sr').textContent = `(${shown.length}個中${done}個チェック済み)`;
    });
    const visible = boxes.filter((b) => !b.closest('.item').hidden);
    const done = visible.filter((b) => b.checked).length;
    const total = visible.length;
    const isDone = total > 0 && done === total;
    const text = total === 0 ? 'この条件で要る物はありません' : isDone ? `${total}個、ぜんぶ詰めた` : `${done} / ${total} 詰めた`;
    count.textContent = text;
    miniCount.textContent = text;
    bar.style.width = total ? `${(done / total) * 100}%` : '0';
    stamp.hidden = !isDone;
    tag.classList.toggle('done', isDone);
    if (isDone && !wasDone && !o.initial) {
      tag.classList.remove('just-done');
      void tag.offsetWidth; // アニメーションを毎回最初から再生するため
      tag.classList.add('just-done');
      status.textContent = `${total}個、ぜんぶ詰めました`;
      const combo = CONDS.map((name) => cond[name]).join('|');
      if (!sentCombos.has(combo) && typeof window.gtag === 'function') {
        sentCombos.add(combo);
        window.gtag('event', 'checklist_complete', Object.assign({ item_count: total }, cond));
      }
    } else if (o.announce) {
      say(`条件に合う持ち物は${total}個です`);
    }
    wasDone = isDone;
  }

  // 送られてきたリンク(?days=2&season=winter など)の条件は、保存していた条件より優先する。チェックは受け取った人のものを残す。
  // URLは書き換えない(replaceStateはGA4の履歴計測でpage_viewが2回数えられうるため)。再読み込みで条件を戻さないよう、適用済みのクエリはタブごとに覚える
  function fromUrl() {
    const q = new URLSearchParams(location.search);
    const names = CONDS.filter((name) => q.has(name));
    if (!names.length) return;
    try { if (sessionStorage.getItem(KEY + ':applied') === location.search) return; } catch (e) { /* 覚えられない環境では毎回適用する */ }
    names.forEach((name) => select(name, q.get(name)));
    save();
    try { sessionStorage.setItem(KEY + ':applied', location.search); } catch (e) { /* 同上 */ }
  }

  restore();
  fromUrl();
  applyColor();
  update({ initial: true });

  form.addEventListener('change', (e) => {
    if (e.target.name === 'color') {
      applyColor();
    } else {
      update({ announce: true });
    }
    save();
  });
  document.getElementById('list').addEventListener('change', (e) => {
    if (e.target.matches('.item input')) { update(); save(); }
  });

  // 確認ダイアログ(confirm)はアプリ内ブラウザで出ないことがあるため、2回押しで確定する
  let armed = false;
  let armTimer = 0;
  const resetLabel = resetBtn.textContent;
  function disarm() {
    armed = false;
    resetBtn.textContent = resetLabel;
    resetBtn.classList.remove('armed');
  }
  resetBtn.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      resetBtn.textContent = 'もう一度押す';
      resetBtn.classList.add('armed');
      say('もう一度押すと、チェックが全部外れます');
      clearTimeout(armTimer);
      armTimer = setTimeout(disarm, 4000);
      return;
    }
    clearTimeout(armTimer);
    disarm();
    boxes.forEach((b) => { b.checked = false; });
    update();
    save();
    say('チェックを全部外しました');
    resetBtn.textContent = '外しました'; // 画面でも結果が分かるよう、少しの間だけ表示する
    armTimer = setTimeout(disarm, 2000);
  });

  // スマホの追従表示は、荷札が画面から外れた時だけ出す(荷札の件数と2重に並ばないように)
  const mini = document.getElementById('mini');
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      mini.classList.toggle('away', !entries[0].isIntersecting);
    }).observe(tag);
  } else {
    mini.classList.add('away');
  }
  document.getElementById('print').addEventListener('click', () => window.print());

  // 同行者に送るリンクには条件だけを入れる(チェックや推し色は入れない)。GA4で着地が分かるようutmを付ける
  const shareBtn = document.getElementById('share');
  const fallback = document.getElementById('share-fallback');
  shareBtn.hidden = false;
  function track(method) {
    if (typeof window.gtag === 'function') {
      window.gtag('event', 'share_list', Object.assign({ method: method }, Object.fromEntries(CONDS.map((name) => [name, current(name)]))));
    }
  }
  function showFallback(url) {
    const input = document.getElementById('share-url');
    input.value = url;
    fallback.hidden = false;
    track('manual');
    input.focus();
    input.select();
  }
  shareBtn.addEventListener('click', () => {
    const q = new URLSearchParams(CONDS.map((name) => [name, current(name)]));
    q.set('utm_source', 'share');
    q.set('utm_medium', 'social');
    q.set('utm_campaign', 'oshi_share');
    const url = `${location.origin}${location.pathname}?${q}`;
    const labels = CONDS.map((name) => {
      const r = radios(name).find((x) => x.checked);
      return r ? r.nextElementSibling.textContent : '';
    }).filter(Boolean).join('・');
    if (navigator.share) {
      navigator.share({ title: document.title, text: `遠征の持ち物リスト(${labels})`, url: url })
        .then(() => track('share'))
        .catch((e) => { if (e && e.name !== 'AbortError') showFallback(url); });
      return;
    }
    const copy = navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject(new Error('no clipboard'));
    copy.then(() => {
      track('copy');
      // 読み上げはstatusだけで行い、画面の表示はaria-hiddenにする(2重に読まれないように)
      say('リンクをコピーしました。LINEなどに貼って送れます');
      const done = document.getElementById('share-done');
      done.hidden = false;
      setTimeout(() => { done.hidden = true; }, 4000);
    }).catch(() => showFallback(url));
  });
})();
