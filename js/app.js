/**
 * 易經問卦工具 — 主應用邏輯
 * 場景管理、粒子系統、三段式結果渲染
 */
const App = (() => {
  let currentScene = 'home';
  let selectedDirection = '';
  let currentMethod = 'instant';
  let coinTosses = [];
  let reading = null;

  const dirLabels = {love:'感情',study:'學業',career:'工作',wealth:'財運'};
  const dirIcons = {love:'❤️',study:'📚',career:'💼',wealth:'💰'};

  // === 粒子系統 ===
  function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);

    for (let i = 0; i < 50; i++) {
      particles.push({
        x: Math.random()*canvas.width, y: Math.random()*canvas.height,
        vx: (Math.random()-0.5)*0.3, vy: -Math.random()*0.5 - 0.1,
        r: Math.random()*2+0.5, a: Math.random()*0.5+0.1
      });
    }
    function draw() {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      particles.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fillStyle = `rgba(212,175,55,${p.a})`;
        ctx.fill();
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10) { p.y = canvas.height+10; p.x = Math.random()*canvas.width; }
        if (p.x < -10) p.x = canvas.width+10;
        if (p.x > canvas.width+10) p.x = -10;
      });
      requestAnimationFrame(draw);
    }
    draw();
  }

  // === 場景管理 ===
  function goTo(scene) {
    document.querySelectorAll('.scene').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('scene-'+scene);
    if (el) {
      // 結果頁需要特殊處理（可捲動）
      if (scene === 'result') {
        document.body.style.overflow = 'auto';
        el.style.position = 'relative';
      } else {
        document.body.style.overflow = 'hidden';
      }
      setTimeout(() => el.classList.add('active'), 50);
    }
    currentScene = scene;
    if (scene === 'result') window.scrollTo(0,0);
  }

  // === 事件綁定 ===
  function init() {
    initParticles();

    // 首頁點擊
    document.getElementById('home-enter')?.addEventListener('click', () => goTo('direction'));

    // 方向選擇
    document.querySelectorAll('.direction-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedDirection = card.dataset.direction;
        goTo('method');
      });
    });

    // 起卦方式切換
    document.querySelectorAll('.method-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        currentMethod = tab.dataset.method;
        document.querySelectorAll('.method-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        document.querySelectorAll('.method-panel').forEach(p => p.classList.remove('active'));
        document.getElementById('panel-'+currentMethod)?.classList.add('active');
      });
    });

    // 一念成卦
    document.getElementById('btn-instant')?.addEventListener('click', () => {
      reading = Divination.instant();
      showAnimation();
    });

    // 數字起卦 - 隨機填入
    document.getElementById('btn-random-fill')?.addEventListener('click', () => {
      document.querySelectorAll('.number-input').forEach(input => {
        input.value = Divination.randomNum();
      });
    });

    // 數字起卦 - 確認
    document.getElementById('btn-number-go')?.addEventListener('click', () => {
      const inputs = document.querySelectorAll('.number-input');
      const numbers = [];
      let valid = true;
      inputs.forEach(inp => {
        const v = parseInt(inp.value);
        if (isNaN(v) || v < 100 || v > 999) { valid = false; inp.style.borderColor = '#e85d75'; }
        else { numbers.push(v); inp.style.borderColor = ''; }
      });
      if (!valid) return;
      reading = Divination.fromNumbers(numbers);
      showAnimation();
    });

    // 擲幣
    coinTosses = [];
    document.getElementById('btn-toss')?.addEventListener('click', tossOnce);

    // 返回按鈕
    document.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.back || 'home';
        if (target === 'method') coinTosses = [];
        goTo(target);
      });
    });

    // 再問一卦
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      coinTosses = [];
      reading = null;
      resetCoinUI();
      goTo('home');
    });

    if (!restoreFromHash()) goTo('home');
  }

  // === 擲幣互動 ===
  function tossOnce() {
    if (coinTosses.length >= 6) return;
    const toss = Divination.tossCoin();
    const coinEls = document.querySelectorAll('.coin');
    coinEls.forEach((el, i) => {
      el.classList.add('flipping');
      setTimeout(() => {
        el.textContent = toss.coins[i] === 3 ? '字' : '花';
        el.classList.remove('flipping');
      }, 600);
    });

    coinTosses.push(toss);
    const prog = document.getElementById('coin-progress');
    if (prog) prog.textContent = `第 ${coinTosses.length} / 6 爻`;

    // 顯示已擲出的爻
    setTimeout(() => {
      const display = document.getElementById('coin-yao-display');
      if (display) {
        const isYang = (toss.value === 7 || toss.value === 9);
        const isChanging = (toss.value === 6 || toss.value === 9);
        const line = document.createElement('div');
        line.className = 'yao-line';
        if (isYang) {
          line.innerHTML = `<div class="yang" ${isChanging?'style="box-shadow:0 0 15px rgba(232,93,117,0.6)"':''}></div>`;
        } else {
          line.innerHTML = `<div class="yin"><span ${isChanging?'style="box-shadow:0 0 15px rgba(232,93,117,0.6)"':''}></span><span ${isChanging?'style="box-shadow:0 0 15px rgba(232,93,117,0.6)"':''}></span></div>`;
        }
        display.appendChild(line);
      }

      if (coinTosses.length >= 6) {
        setTimeout(() => {
          reading = Divination.fromCoins(coinTosses);
          showAnimation();
        }, 800);
      }
    }, 700);
  }

  function resetCoinUI() {
    coinTosses = [];
    const prog = document.getElementById('coin-progress');
    if (prog) prog.textContent = '第 0 / 6 爻';
    const display = document.getElementById('coin-yao-display');
    if (display) display.innerHTML = '';
    document.querySelectorAll('.coin').forEach(el => el.textContent = '？');
  }

  // === 演算動畫 ===
  function showAnimation() {
    goTo('animation');
    const build = document.getElementById('hex-build');
    if (build) build.innerHTML = '';

    const yao = reading.yao;
    let i = 0;
    const interval = setInterval(() => {
      if (i >= 6) {
        clearInterval(interval);
        setTimeout(() => {
          // 閃光
          const flash = document.getElementById('reveal-flash');
          if (flash) { flash.classList.add('active'); setTimeout(() => flash.classList.remove('active'), 1000); }
          setTimeout(() => renderResult(), 600);
        }, 500);
        return;
      }
      const line = document.createElement('div');
      line.className = 'yao-line';
      const isChanging = reading.changingLines.includes(i);
      const glow = isChanging ? 'style="box-shadow:0 0 15px rgba(232,93,117,0.6)"' : '';
      if (yao[i] === 1) {
        line.innerHTML = `<div class="yang" ${glow}></div>`;
      } else {
        line.innerHTML = `<div class="yin"><span ${glow}></span><span ${glow}></span></div>`;
      }
      build.appendChild(line);
      setTimeout(() => line.classList.add('revealed'), 50);
      i++;
    }, 350);
  }

  // === 分享功能 ===
  function shareResult() {
    if (!reading) return;
    const hash = '#r=' + reading.lines.join(',') + '&d=' + (selectedDirection || 'love');
    const url = location.origin + location.pathname + hash;
    history.replaceState(null, '', hash);

    const h = HEXAGRAMS[reading.originalId];
    const shareText = `【易經問卦】${h.fn}（${h.n}卦）\n${h.j}\n${h.core || ''}\n\n${url}`;

    if (navigator.share) {
      navigator.share({ title: `易｜${h.fn}`, text: shareText, url })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        showToast('連結已複製到剪貼簿');
      }).catch(() => {
        showToast('請複製網址列的連結');
      });
    }
  }

  function showToast(msg) {
    const toast = document.getElementById('share-toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
  }

  // === 從 URL 還原卦象 ===
  function restoreFromHash() {
    const hash = location.hash;
    if (!hash.startsWith('#r=')) return false;
    try {
      const params = new URLSearchParams(hash.slice(1));
      const lines = params.get('r').split(',').map(Number);
      const dir = params.get('d') || 'love';
      if (lines.length !== 6 || lines.some(v => ![6,7,8,9].includes(v))) return false;
      selectedDirection = dir;
      reading = Divination.getReading(lines);
      renderResult();
      return true;
    } catch(e) { return false; }
  }

  // === 三段式結果渲染 ===
  function renderResult() {
    const r = reading;
    const h = HEXAGRAMS[r.originalId];
    const ch = r.changedId ? HEXAGRAMS[r.changedId] : null;
    if (!h) { goTo('home'); return; }

    const container = document.getElementById('result-content');
    if (!container) return;

    const sym = hexSymbol(r.originalId);
    const chSym = r.changedId ? hexSymbol(r.changedId) : '';

    let html = '';

    // ── 結果頭部 ──
    html += `<div class="result-header">
      <div class="result-symbol">${sym}</div>
      <div class="result-name">${h.n}卦</div>
      <div class="result-fullname">${h.fn}</div>
      <div class="result-judgment">${h.j}</div>
    </div>`;

    // ── 方向標記 ──
    html += `<div style="text-align:center;margin-bottom:2rem">
      <span style="font-size:0.85rem;color:var(--text-dim);letter-spacing:0.1em">
        ${dirIcons[selectedDirection]} 所問方向：${dirLabels[selectedDirection]}
      </span>
    </div>`;

    // ── 卦象圖示 ──
    html += renderHexagramVisual(r.yao, r.changingLines);

    // ── 象辭引用 ──
    html += `<div class="image-quote">
      <div class="image-quote-text">《象》曰：${h.im}</div>
    </div>`;

    // ════════════════════════════════
    // 頂部·現狀：本卦金句
    // ════════════════════════════════
    const isOriginalFocus = (r.mode.focus === 'original' || r.mode.focus === 'changing' || r.mode.focus === 'both');
    html += `<div class="core-answer" ${isOriginalFocus ? 'style="border-color:var(--gold-primary);box-shadow:0 0 40px var(--gold-glow)"' : ''}>
      <div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:1rem;letter-spacing:0.15em">▎ 現 狀</div>
      <div class="core-answer-text">${h.core}</div>
    </div>`;

    // ════════════════════════════════
    // 中部·轉折：動爻爻辭
    // ════════════════════════════════
    if (r.changingLines.length > 0) {
      const isChangingFocus = (r.mode.focus === 'changing');
      html += `<div class="divider"><span class="divider-icon">◆</span></div>`;
      html += `<div class="allegory-card" ${isChangingFocus ? 'style="border-color:var(--love-color);box-shadow:0 0 30px var(--love-glow)"' : ''}>
        <div class="section-title" style="${isChangingFocus?'color:var(--love-color)':''}">◇ 轉 折</div>
        <div style="font-size:0.8rem;color:var(--text-dim);margin-bottom:1.5rem">${r.mode.desc}</div>`;

      if (r.mode.focus === 'changed_stable' && ch) {
        // 4-5爻動：聚焦變卦中不動之爻
        r.stableInChanged.forEach(idx => {
          const yaoData = ch.yao?.[idx];
          if (yaoData) {
            html += renderYaoCard(idx, yaoData, true);
          }
        });
      } else if (r.mode.focus === 'extra' && h.extra) {
        // 6爻全動 + 乾坤：用九/用六
        html += `<div style="padding:1.5rem;text-align:center">
          <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:0.8rem;font-style:italic">${h.extra.t}</div>
          <div class="allegory-text" style="font-size:1.1rem;color:var(--gold-light)">${h.extra.c}</div>
        </div>`;
      } else if (r.mode.focus === 'changed' && ch) {
        // 6爻全動（非乾坤）：聚焦變卦卦辭
        html += `<div style="padding:1.5rem;text-align:center">
          <div class="allegory-text" style="font-size:1.1rem;color:var(--gold-light)">${ch.core}</div>
        </div>`;
      } else {
        // 1-2爻動 或 3爻動：顯示動爻
        r.changingLines.forEach(idx => {
          const yaoData = h.yao?.[idx];
          if (yaoData) {
            html += renderYaoCard(idx, yaoData, isChangingFocus);
          }
        });
        if (r.mode.focus === 'both' && ch) {
          html += `<div class="divider"><span class="divider-icon">⟡</span></div>`;
          html += `<div style="text-align:center;padding:1rem">
            <div style="font-size:0.85rem;color:var(--text-dim);margin-bottom:0.8rem">變卦之辭</div>
            <div class="allegory-text" style="color:var(--gold-light)">${ch.core}</div>
          </div>`;
        }
      }
      html += `</div>`;
    }

    // ════════════════════════════════
    // 底部·趨向：變卦結語
    // ════════════════════════════════
    if (ch) {
      const chSymbol = hexSymbol(r.changedId);
      const isChangedFocus = (r.mode.focus === 'changed' || r.mode.focus === 'changed_stable');
      html += `<div class="divider"><span class="divider-icon">◆</span></div>`;
      html += `<div class="poem-card" ${isChangedFocus ? 'style="border-color:var(--gold-primary);box-shadow:0 0 30px var(--gold-glow)"' : ''}>
        <div class="section-title" style="margin-bottom:1.5rem">◇ 趨 向</div>
        <div style="font-size:3rem;margin-bottom:0.5rem;color:var(--gold-primary)">${chSymbol}</div>
        <div style="font-size:1.3rem;font-family:var(--font-serif);color:var(--gold-light);margin-bottom:0.5rem;letter-spacing:0.15em">${ch.fn}</div>
        <div style="font-size:0.85rem;color:var(--text-dim);font-style:italic;margin-bottom:1.5rem">${ch.j}</div>
        <div class="allegory-text" style="font-size:1.05rem;text-align:center">${ch.core}</div>
      </div>`;
    }

    // 動爻說明
    html += `<div style="text-align:center;padding:1.5rem 0">
      <div style="font-size:0.75rem;color:var(--text-dim);letter-spacing:0.1em">
        動爻：${r.changingLines.length === 0 ? '無（靜卦）' : r.changingLines.map(i => ['初','二','三','四','五','上'][i]+'爻').join('、')}
        ${r.changedId && r.changedId !== r.originalId ? ` ─ 本卦 ${h.fn} → 變卦 ${ch.fn}` : ''}
      </div>
    </div>`;

    // 底部操作
    html += `<div class="result-actions">
      <button class="btn btn--primary" id="btn-restart" style="margin-right:1rem">再問一卦</button>
      <button class="btn btn--share" id="btn-share">分享結果</button>
      <button class="btn btn--ghost" onclick="App.goTo('home')" style="margin-left:1rem">回到首頁</button>
    </div>
    <div id="share-toast" class="share-toast" aria-live="polite"></div>`;

    container.innerHTML = html;

    // 重綁再問一卦
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      coinTosses = []; reading = null; resetCoinUI();
      history.replaceState(null, '', location.pathname);
      goTo('home');
    });

    // 分享按鈕
    document.getElementById('btn-share')?.addEventListener('click', () => shareResult());

    goTo('result');
  }

  // === 爻辭卡片 ===
  function renderYaoCard(idx, yaoData, highlight) {
    const pos = ['初爻','二爻','三爻','四爻','五爻','上爻'][idx];
    return `<div style="padding:1rem 0;${highlight?'':'opacity:0.7'}">
      <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.5rem">
        <span style="font-size:0.75rem;color:var(--text-dim);font-family:var(--font-serif)">${pos}</span>
        <span style="font-size:0.8rem;color:var(--text-secondary);font-style:italic">${yaoData.t}</span>
      </div>
      <div style="font-size:1.05rem;color:${highlight?'var(--text-primary)':'var(--text-secondary)'};line-height:1.8;font-family:var(--font-serif)">${yaoData.c}</div>
    </div>`;
  }

  // === 卦象圖示 ===
  function renderHexagramVisual(yao, changingLines) {
    let html = '<div class="hexagram-visual">';
    for (let i = 0; i < 6; i++) {
      const isChanging = changingLines.includes(i);
      const glow = isChanging ? 'box-shadow:0 0 12px rgba(232,93,117,0.5)' : '';
      if (yao[i] === 1) {
        html += `<div class="yao-line"><div class="yang" style="${glow}"></div></div>`;
      } else {
        html += `<div class="yao-line"><div class="yin"><span style="${glow}"></span><span style="${glow}"></span></div></div>`;
      }
    }
    html += '</div>';
    return html;
  }

  return { init, goTo };
})();

document.addEventListener('DOMContentLoaded', App.init);
