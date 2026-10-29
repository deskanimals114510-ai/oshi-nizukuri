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
      cond: { days: current('days'), scene: current('scene'), move: current('move') },
      color: current('color'),
      checked: boxes.filter((b) => b.checked).map((b) => b.dataset.id)
    };
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* 保存できない環境では今の画面だけで動かす */ }
  }

  function restore() {
    const state = load();
    const cond = state.cond && typeof state.cond === 'object' ? state.cond : {};
    ['days', 'scene', 'move'].forEach((name) => select(name, cond[name]));
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
    const days = current('days');
    const scene = current('scene');
    const move = current('move');
    items.forEach((li) => {
      li.hidden = !(matches(li, 'days', days) && matches(li, 'scene', scene) && matches(li, 'move', move));
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
      const combo = `${days}|${scene}|${move}`;
      if (!sentCombos.has(combo) && typeof window.gtag === 'function') {
        sentCombos.add(combo);
        window.gtag('event', 'checklist_complete', { days: days, scene: scene, move: move, item_count: total });
      }
    } else if (o.announce) {
      say(`条件に合う持ち物は${total}個です`);
    }
    wasDone = isDone;
  }

  restore();
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
})();
