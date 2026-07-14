/**
 * 易經問卦工具 — 主應用邏輯
 * 場景管理、粒子系統、三段式結果渲染
 */
const App = (() => {
  let currentScene = 'home';
  let selectedDirection = '';
  let currentMethod = 'instant';
  let coinTosses = [];
  let tossTimerIds = [];
  let isTossAnimating = false;
  let reading = null;
  let feedbackRating = 0;
  let currentJournalId = null;
  let currentResultSource = 'new';
  let journalTab = 'history';

  const defaultMethodPrompt = '心中默念你的問題，然後選擇一種方式';
  const directionMeta = {
    love: {
      label: '感情',
      icon: 'heart',
      prompt: '把問題放進感情、關係或人際裡，靜下來想清楚你真正想問的是什麼。'
    },
    study: {
      label: '學業',
      icon: 'book',
      prompt: '適合問考試、學習、進修與選擇，先想好你最在意的結果。'
    },
    career: {
      label: '工作',
      icon: 'briefcase',
      prompt: '適合問工作、職涯、合作與決策，問題越具體，卦意越好讀。'
    },
    wealth: {
      label: '財運',
      icon: 'coins',
      prompt: '適合問收入、投資、金錢安排，先把你想判斷的那一件事放在心裡。'
    },
    yesno: {
      label: '是／否',
      icon: 'scales',
      prompt: '適合問生活小事：要不要做、該不該聯絡、今天行不行。問題越簡單，答案越清楚。'
    }
  };
  // 生活小事的快速判斷以本卦為主、變卦為修正：1=可行，0=觀望，-1=不宜。
  const yesNoHexagramScore = {
    1: 1, 2: 1, 3: 0, 4: 0, 5: 0, 6: -1, 7: 0, 8: 1,
    9: 0, 10: 0, 11: 1, 12: -1, 13: 1, 14: 1, 15: 1, 16: 1,
    17: 1, 18: 0, 19: 1, 20: 0, 21: 1, 22: 0, 23: -1, 24: 1,
    25: 1, 26: 1, 27: 0, 28: -1, 29: -1, 30: 1, 31: 1, 32: 1,
    33: -1, 34: 0, 35: 1, 36: -1, 37: 1, 38: 0, 39: -1, 40: 1,
    41: 0, 42: 1, 43: 1, 44: -1, 45: 1, 46: 1, 47: -1, 48: 0,
    49: 0, 50: 1, 51: 0, 52: -1, 53: 0, 54: -1, 55: 1, 56: 0,
    57: 1, 58: 1, 59: 0, 60: 0, 61: 1, 62: 0, 63: 0, 64: 0
  };

  // === 粒子系統 ===
  function initParticles() {
    const canvas = document.getElementById('particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
    resize(); window.addEventListener('resize', resize);

    for (let i = 0; i < (reduceMotion ? 18 : 50); i++) {
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
      if (!reduceMotion) requestAnimationFrame(draw);
    }
    draw();
  }

  function getDirectionMeta(direction) {
    return directionMeta[direction] || directionMeta.love;
  }

  function renderSpriteIcon(iconName, className = '') {
    const classes = ['ui-icon', className].filter(Boolean).join(' ');
    return `<svg class="${classes}" aria-hidden="true" focusable="false"><use href="#icon-${iconName}"></use></svg>`;
  }

  function renderDirectionChip(direction, extraClass = '') {
    const className = ['direction-chip', extraClass].filter(Boolean).join(' ');
    return `<span class="${className}" data-direction="${escapeHtml(directionKey(direction))}">
      <span class="direction-chip__icon">${renderSpriteIcon(direction.icon)}</span>
      <span class="direction-chip__text">所問方向：${escapeHtml(direction.label)}</span>
    </span>`;
  }

  function directionKey(direction) {
    return Object.keys(directionMeta).find(key => directionMeta[key] === direction) || 'love';
  }

  function updateMethodContext() {
    const subtitle = document.getElementById('method-subtitle');
    const dailyWisdom = document.getElementById('daily-wisdom-method');
    if (!subtitle) return;
    subtitle.textContent = selectedDirection
      ? getDirectionMeta(selectedDirection).prompt
      : defaultMethodPrompt;
    if (dailyWisdom) {
      dailyWisdom.innerHTML = selectedDirection
        ? renderDailyWisdomCard(selectedDirection)
        : renderDailyWisdomCard('general');
    }
  }

  function scoreToVerdict(score) {
    if (score > 0) return 'yes';
    if (score < 0) return 'no';
    return 'wait';
  }

  function getYesNoAnswer(readingData) {
    const labelMap = { yes: '是', no: '否', wait: '先等等' };
    const stateMap = { yes: '可行', no: '不宜', wait: '觀望' };
    const headlineMap = {
      yes: '可以做，但照節奏走。',
      no: '現在不宜，先不要硬推。',
      wait: '不是完全不行，只是時機未到。'
    };
    const singleDetails = {
      yes: '這件事整體可行，照著原本節奏做，通常會比一直猶豫更順。',
      no: '卦象不太支持現在硬做，先停一下，通常比硬衝更省代價。',
      wait: '答案還在路上。先觀察、補資訊或等時機，會比現在更有把握。'
    };
    const comboDetails = {
      'yes:yes': '本卦和後勢都站在你這邊，可以做，但記得別把順風用成逞強。',
      'yes:wait': '可以做，但先小步確認會更穩。別急著一次把所有籌碼押上。',
      'yes:no': '你心裡想做沒有錯，但後勢容易轉卡，先補足條件再決定更好。',
      'wait:yes': '方向並不差，只是還差一個關鍵條件。等等再動，成功率會更高。',
      'wait:wait': '卦象沒有明確偏向，代表問題本身還需要更多資訊或時間發酵。',
      'wait:no': '局勢正在收緊，現在先不要硬推，會比勉強前進省力得多。',
      'no:yes': '眼下不宜，但不是永遠不行。若能調整方式或換個時機，後面還有轉機。',
      'no:wait': '先踩煞車。這件事至少要退一步整理，之後再看會更清楚。',
      'no:no': '卦象前後都不支持，勉強進行只會更耗神，先不要比較好。'
    };

    const originalScore = yesNoHexagramScore[readingData.originalId] ?? 0;
    const originalVerdict = scoreToVerdict(originalScore);
    const changedScore = readingData.changedId
      ? (yesNoHexagramScore[readingData.changedId] ?? 0)
      : originalScore;
    const changedVerdict = scoreToVerdict(changedScore);

    let answer = originalVerdict;
    if (readingData.changedId) {
      if (originalVerdict === 'yes') answer = changedVerdict === 'no' ? 'wait' : 'yes';
      else if (originalVerdict === 'no') answer = changedVerdict === 'yes' ? 'wait' : 'no';
      else if (changedVerdict === 'no') answer = 'no';
      else answer = 'wait';
    }

    return {
      answer,
      label: labelMap[answer],
      headline: headlineMap[answer],
      detail: readingData.changedId
        ? comboDetails[`${originalVerdict}:${changedVerdict}`]
        : singleDetails[answer],
      meta: readingData.changedId
        ? `本卦：${stateMap[originalVerdict]} · 變卦：${stateMap[changedVerdict]}`
        : `本卦：${stateMap[originalVerdict]}`
    };
  }

  function renderYesNoCard(readingData) {
    const quick = getYesNoAnswer(readingData);
    return `<div class="quick-answer-card" data-answer="${quick.answer}">
      <div class="quick-answer-label">生活小事・快速判斷</div>
      <div class="quick-answer-value">${quick.label}</div>
      <div class="quick-answer-headline">${quick.headline}</div>
      <div class="quick-answer-detail">${quick.detail}</div>
      <div class="quick-answer-meta">${quick.meta}</div>
    </div>`;
  }

  function getDecisionCue(readingData) {
    const verdict = getYesNoAnswer(readingData).answer;
    const cues = {
      yes: {
        key: 'courage',
        label: '勇敢一次',
        headline: '你可以往前一小步。',
        detail: '條件正在支持行動。不是要你一次押上全部，而是別讓猶豫遮住已經準備好的自己。',
        reflectionPrompt: '如果勇敢一次，你願意先做哪一小步？'
      },
      no: {
        key: 'pause',
        label: '停一下',
        headline: '暫停不是退縮。',
        detail: '現在更適合保留力氣、補足資訊或重新確認界線。先不做，也是一個有意識的決定。',
        reflectionPrompt: '如果先停一下，你想保護什麼？'
      },
      wait: {
        key: 'stay',
        label: '現在也很好',
        headline: '不必為了改變而改變。',
        detail: '眼前沒有非動不可的訊號。維持、觀察、讓事情多長一點，也是一種成熟的前進。',
        reflectionPrompt: '現在已經有什麼，是你想好好保留的？'
      }
    };
    return cues[verdict];
  }

  function renderDecisionCompanion(cue, journalEntry) {
    const question = journalEntry?.question
      ? `<div class="decision-companion-question">你正在想：${escapeHtml(journalEntry.question)}</div>`
      : '';
    const dailyLabel = journalEntry?.isDailyFirst
      ? `<div class="daily-reading-badge">${currentResultSource === 'new' ? '今日第一卦' : '當日第一卦'} · 已收進卦跡</div>`
      : '';
    return `<section class="decision-companion" data-cue="${cue.key}">
      <div class="decision-companion-label">此刻的決策陪伴</div>
      ${dailyLabel}
      ${question}
      <div class="decision-companion-value">${cue.label}</div>
      <div class="decision-companion-headline">${cue.headline}</div>
      <div class="decision-companion-detail">${cue.detail}</div>
      <div class="decision-companion-note">它不替你決定，只陪你把心裡的方向看清楚。</div>
    </section>`;
  }

  function renderReflectionCard(cue, journalEntry) {
    if (!journalEntry) return '';
    return `<section class="decision-reflection">
      <div class="decision-reflection-label">留一句給之後的自己</div>
      <label for="decision-reflection">${cue.reflectionPrompt}</label>
      <textarea id="decision-reflection" maxlength="280" rows="3" placeholder="寫下一句就好…">${escapeHtml(journalEntry.reflection || '')}</textarea>
      <div class="decision-reflection-actions">
        <span>只保存在你的裝置</span>
        <button type="button" class="btn btn--ghost" id="btn-save-reflection">保存卦跡</button>
      </div>
    </section>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function getDailyWisdom(direction) {
    if (typeof DailyWisdom === 'undefined') return null;
    return DailyWisdom.get(direction || 'general');
  }

  function renderDailyWisdomCard(direction, extraClass = '') {
    const wisdom = getDailyWisdom(direction);
    if (!wisdom) return '';
    const className = ['daily-wisdom-card', extraClass].filter(Boolean).join(' ');
    return `<div class="${className}">
      <div class="daily-wisdom-label">今日格言・參考一下</div>
      <div class="daily-wisdom-date">${escapeHtml(wisdom.dateLabel)}</div>
      <div class="daily-wisdom-text">${escapeHtml(wisdom.text)}</div>
    </div>`;
  }

  function scheduleTossTask(callback, delay) {
    const id = window.setTimeout(() => {
      tossTimerIds = tossTimerIds.filter(timerId => timerId !== id);
      callback();
    }, delay);
    tossTimerIds.push(id);
    return id;
  }

  function clearPendingTossTasks() {
    tossTimerIds.forEach(window.clearTimeout);
    tossTimerIds = [];
  }

  function setTossButtonState(disabled) {
    const btn = document.getElementById('btn-toss');
    if (btn) btn.disabled = disabled;
  }

  function getDecisionQuestion() {
    return document.getElementById('decision-question')?.value.trim() || '';
  }

  function resetDecisionFlow() {
    coinTosses = [];
    reading = null;
    currentJournalId = null;
    currentResultSource = 'new';
    resetCoinUI();
    const question = document.getElementById('decision-question');
    if (question) question.value = '';
    history.replaceState(null, '', location.pathname);
  }

  function recordCurrentReading() {
    const cue = getDecisionCue(reading);
    const wisdom = getDailyWisdom(selectedDirection || 'general');
    const result = YiJournal.recordReading({
      reading,
      direction: selectedDirection,
      method: currentMethod,
      question: getDecisionQuestion(),
      wisdom,
      decision: cue
    });
    currentJournalId = result.saved ? result.entry.id : null;
    currentResultSource = 'new';
    renderHomeJournalStatus();
    Analytics.trackQuestion(selectedDirection, currentMethod, {
      daily_first: result.isDailyFirst,
      atlas_unlocked: result.unlockedNow,
      has_question: !!result.entry.question,
      decision_cue: cue.key
    });
    if (result.isDailyFirst) {
      Analytics.trackEvent('daily_reading_saved', {
        hexagram_id: result.entry.originalId,
        atlas_unlocked: result.unlockedNow,
        unlocked_count: result.unlockedCount
      });
    }
  }

  // === 場景管理 ===
  function goTo(scene) {
    document.querySelectorAll('.scene').forEach(s => {
      s.classList.remove('active');
      if (s.classList.contains('scene--result') || s.classList.contains('scene--journal')) {
        s.style.position = 'fixed';
      }
    });
    const el = document.getElementById('scene-'+scene);
    if (el) {
      // 結果與卦跡頁需要自然捲動。
      if (scene === 'result' || scene === 'journal') {
        document.body.style.overflow = 'auto';
        el.style.position = 'relative';
      } else {
        document.body.style.overflow = 'hidden';
      }
      setTimeout(() => el.classList.add('active'), 50);
    }
    currentScene = scene;
    if (scene === 'home') renderHomeJournalStatus();
    if (scene === 'result' || scene === 'journal') window.scrollTo(0,0);
  }

  // === 事件綁定 ===
  function init() {
    initParticles();
    updateMethodContext();
    const journalSummary = YiJournal.getSummary();
    Analytics.init({
      has_history: journalSummary.historyCount > 0,
      has_today_reading: !!journalSummary.today
    });
    renderHomeJournalStatus();
    initJournalInteractions();

    // 首頁點擊
    document.getElementById('home-enter')?.addEventListener('click', () => {
      Analytics.trackEvent('decision_start', { has_today_reading: !!YiJournal.getToday() });
      goTo('direction');
    });
    document.getElementById('btn-open-journal')?.addEventListener('click', () => openJournal('history'));

    // 方向選擇
    document.querySelectorAll('.direction-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedDirection = card.dataset.direction;
        Analytics.trackEvent('direction_select', { direction: selectedDirection });
        updateMethodContext();
        goTo('method');
      });
    });

    // 起卦方式切換
    document.querySelectorAll('.method-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        currentMethod = tab.dataset.method;
        Analytics.trackEvent('method_select', { method: currentMethod, direction: selectedDirection });
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

    // 數字起卦 - 輸入控制（限3位、自動跳格、blur補零）
    const numberInputs = Array.from(document.querySelectorAll('.number-input'));
    numberInputs.forEach((inp, idx) => {
      inp.addEventListener('input', () => {
        // 只保留數字字符
        inp.value = inp.value.replace(/[^0-9]/g, '');
        // 達到3位自動跳到下一格
        if (inp.value.length === 3 && idx < numberInputs.length - 1) {
          numberInputs[idx + 1].focus();
          numberInputs[idx + 1].select();
        }
      });
      inp.addEventListener('blur', () => {
        const raw = inp.value.replace(/[^0-9]/g, '');
        if (raw.length > 0 && raw.length < 3) {
          inp.value = raw.padStart(3, '0');
        }
      });
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
        // blur補零後再解析
        const raw = inp.value.replace(/[^0-9]/g, '');
        if (raw.length > 0 && raw.length < 3) inp.value = raw.padStart(3, '0');
        const v = parseInt(inp.value, 10);
        if (isNaN(v) || v < 1 || v > 999) { valid = false; inp.style.borderColor = '#e85d75'; }
        else { numbers.push(v); inp.style.borderColor = ''; }
      });
      if (!valid) return;
      reading = Divination.fromNumbers(numbers);
      showAnimation();
    });

    // 擲幣
    resetCoinUI();
    document.getElementById('btn-toss')?.addEventListener('click', tossOnce);

    // 返回按鈕
    document.querySelectorAll('.back-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.back || 'home';
        if (currentScene === 'method') resetCoinUI();
        goTo(target);
      });
    });

    // 再問一卦
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      resetDecisionFlow();
      goTo('home');
    });

    initFeedbackModal();
    if (!restoreFromHash()) goTo('home');
  }

  // === 擲幣互動 ===
  function tossOnce() {
    if (coinTosses.length >= 6 || isTossAnimating) return;
    isTossAnimating = true;
    setTossButtonState(true);

    const toss = Divination.tossCoin();
    const coinEls = document.querySelectorAll('.coin');
    coinEls.forEach((el, i) => {
      el.classList.add('flipping');
      scheduleTossTask(() => {
        el.textContent = toss.coins[i] === 3 ? '字' : '花';
        el.classList.remove('flipping');
      }, 600);
    });

    coinTosses.push(toss);
    const prog = document.getElementById('coin-progress');
    if (prog) prog.textContent = `第 ${coinTosses.length} / 6 爻`;

    // 顯示已擲出的爻
    scheduleTossTask(() => {
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
        scheduleTossTask(() => {
          reading = Divination.fromCoins(coinTosses);
          showAnimation();
        }, 800);
      } else {
        isTossAnimating = false;
        setTossButtonState(false);
      }
    }, 700);
  }

  function resetCoinUI() {
    clearPendingTossTasks();
    coinTosses = [];
    isTossAnimating = false;
    setTossButtonState(false);
    const prog = document.getElementById('coin-progress');
    if (prog) prog.textContent = '第 0 / 6 爻';
    const display = document.getElementById('coin-yao-display');
    if (display) display.innerHTML = '';
    document.querySelectorAll('.coin').forEach(el => {
      el.textContent = '？';
      el.classList.remove('flipping');
    });
  }

  // === 演算動畫 ===
  function showAnimation() {
    recordCurrentReading();
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

  // === 分享連結 ===
  function shareLink() {
    if (!reading) return;
    const hash = '#r=' + reading.lines.join(',') + '&d=' + (selectedDirection || 'love');
    const url = location.origin + location.pathname + hash;
    history.replaceState(null, '', hash);

    const h = HEXAGRAMS[reading.originalId];
    const direction = getDirectionMeta(selectedDirection || 'love');
    const decision = getDecisionCue(reading);
    const quick = selectedDirection === 'yesno' ? getYesNoAnswer(reading) : null;
    const quickText = quick ? `\n快速判斷：${quick.label}｜${quick.headline}` : '';
    const shareText = `【易｜人生決策輔助器】${h.fn}（${h.n}卦）\n所問方向：${direction.label}\n決策陪伴：${decision.label}${quickText}\n${h.j}\n${h.core || ''}\n\n${url}`;

    Analytics.trackShare('link', selectedDirection);

    if (navigator.share) {
      navigator.share({ title: `易｜${h.fn}`, text: shareText, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url)
        .then(() => showToast('連結已複製到剪貼簿'))
        .catch(() => showToast('請複製網址列的連結'));
    }
  }

  // === 儲存圖片 ===
  function shareImage() {
    if (!reading || typeof html2canvas === 'undefined') {
      showToast('圖片功能載入中，請稍候…');
      return;
    }
    const h = HEXAGRAMS[reading.originalId];
    const sym = hexSymbol(reading.originalId);
    const direction = getDirectionMeta(selectedDirection || 'love');
    const decision = getDecisionCue(reading);
    const quick = selectedDirection === 'yesno' ? getYesNoAnswer(reading) : null;
    const quickColor = quick ? ({ yes: '#70e0aa', no: '#ff8b96', wait: '#8ad7ff' }[quick.answer]) : '';
    const decisionColor = ({ courage: '#78dfad', pause: '#ff9aa5', stay: '#8ad7ff' }[decision.key]);

    // 建立離屏卡片
    const card = document.createElement('div');
    card.style.cssText = [
      'position:fixed', 'left:-9999px', 'top:0',
      'width:600px', 'padding:56px 48px 48px',
      'background:linear-gradient(160deg,#06000f 0%,#130826 100%)',
      'border:1px solid rgba(242,201,76,0.4)',
      'border-radius:24px', 'font-family:GenJyuu,sans-serif',
      'color:#fff', 'text-align:center', 'box-sizing:border-box'
    ].join(';');

    card.innerHTML = `
      <div style="font-size:96px;line-height:1;color:#f2c94c;
                  text-shadow:0 0 40px rgba(242,201,76,0.5);margin-bottom:16px">${sym}</div>
      <div style="font-size:36px;color:#f2c94c;letter-spacing:.15em;margin-bottom:6px">${h.n}卦</div>
      <div style="font-size:18px;color:rgba(255,255,255,0.7);letter-spacing:.2em;margin-bottom:24px">${h.fn}</div>
      <div style="display:flex;justify-content:center;margin-bottom:${quick ? '14px' : '24px'}">
        ${renderDirectionChip(direction)}
      </div>
      <div style="margin-bottom:22px;padding:16px;border:1px solid ${decisionColor}55;border-radius:14px;background:${decisionColor}0d">
        <div style="font-size:12px;color:rgba(255,255,255,0.45);letter-spacing:.14em;margin-bottom:6px">此刻的決策陪伴</div>
        <div style="font-size:32px;color:${decisionColor};letter-spacing:.08em">${decision.label}</div>
        <div style="font-size:14px;color:rgba(255,255,255,0.68);margin-top:5px">${decision.headline}</div>
      </div>
      ${quick ? `<div style="margin-bottom:22px">
        <div style="font-size:13px;color:rgba(255,255,255,0.45);letter-spacing:.14em;margin-bottom:8px">生活小事・快速判斷</div>
        <div style="font-size:44px;color:${quickColor};line-height:1.1;letter-spacing:.08em;margin-bottom:8px">${quick.label}</div>
        <div style="font-size:15px;color:rgba(255,255,255,0.72);line-height:1.7">${quick.headline}</div>
      </div>` : ''}
      <div style="font-size:15px;color:rgba(255,255,255,0.5);font-style:italic;margin-bottom:32px;
                  border-top:1px solid rgba(242,201,76,0.2);border-bottom:1px solid rgba(242,201,76,0.2);
                  padding:16px 0">${h.j}</div>
      <div style="font-size:22px;color:#ffe880;line-height:1.9;letter-spacing:.05em;min-height:60px">
        ${h.core || ''}
      </div>
      <div style="margin-top:40px;font-size:13px;color:rgba(255,255,255,0.3);letter-spacing:.1em">
        易 — 人生決策輔助器 · biology-c.github.io/I-Ching-reading
      </div>`;

    document.body.appendChild(card);

    showToast('正在生成圖片…');
    Analytics.trackShare('image', selectedDirection);

    html2canvas(card, { backgroundColor: null, scale: 2, useCORS: true }).then(canvas => {
      document.body.removeChild(card);
      canvas.toBlob(blob => {
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], 'yi.png', { type: 'image/png' })] })) {
          navigator.share({ files: [new File([blob], 'yi.png', { type: 'image/png' })], title: `易｜${h.fn}` }).catch(() => downloadImage(canvas, h.n));
        } else {
          downloadImage(canvas, h.n);
        }
      }, 'image/png');
    }).catch(() => {
      document.body.removeChild(card);
      showToast('圖片生成失敗，請截圖分享');
    });
  }

  function downloadImage(canvas, name) {
    const a = document.createElement('a');
    a.download = `yi_${name}卦.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    showToast('圖片已儲存');
  }

  // === 今日一卦、決策卦跡與圖鑑 ===
  function formatJournalDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }

  function renderHomeJournalStatus() {
    const container = document.getElementById('home-daily-status');
    if (!container || typeof YiJournal === 'undefined') return;
    const summary = YiJournal.getSummary();
    if (!summary.today) {
      container.innerHTML = `<span class="home-daily-kicker">今日一卦</span>
        <span class="home-daily-copy">今天還沒有留下決策卦跡</span>`;
      return;
    }
    const hexagram = HEXAGRAMS[summary.today.originalId];
    const decision = summary.today.decision?.label || '已記下';
    container.innerHTML = `<span class="home-daily-kicker">今日一卦已記下</span>
      <span class="home-daily-copy">${escapeHtml(hexagram?.fn || `${summary.today.originalId} 卦`)} · ${escapeHtml(decision)}</span>`;
  }

  function openJournal(tab = 'history') {
    journalTab = tab;
    renderJournalPage();
    Analytics.trackEvent('journal_open', { tab });
    goTo('journal');
  }

  function renderJournalPage() {
    const summary = YiJournal.getSummary();
    const summaryContainer = document.getElementById('journal-summary');
    const content = document.getElementById('journal-content');
    if (!summaryContainer || !content) return;

    summaryContainer.innerHTML = `
      <div class="journal-stat"><strong>${summary.monthDays}</strong><span>本月靜心日</span></div>
      <div class="journal-stat"><strong>${summary.historyCount}</strong><span>決策卦跡</span></div>
      <div class="journal-stat"><strong>${summary.unlockedCount}<small>/64</small></strong><span>已遇見卦象</span></div>`;

    document.querySelectorAll('.journal-tab').forEach(tab => {
      const active = tab.dataset.journalTab === journalTab;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    content.innerHTML = journalTab === 'atlas'
      ? renderAtlasContent()
      : renderHistoryContent();
  }

  function renderHistoryContent() {
    const entries = YiJournal.list();
    if (!entries.length) {
      return `<div class="journal-empty">
        <div class="journal-empty-mark">易</div>
        <p>還沒有卦跡。下次卡住時，把那一刻留給未來的自己。</p>
      </div>`;
    }

    const today = YiJournal.dateKey();
    const pendingEchoes = entries.filter(entry => entry.isDailyFirst && entry.dateKey < today && !entry.echo);
    let html = '';
    if (pendingEchoes.length) {
      html += `<section class="echo-section">
        <div class="journal-section-heading">
          <span>隔日回聲</span>
          <small>後來，你怎麼選？</small>
        </div>
        ${pendingEchoes.slice(0, 3).map(renderEchoCard).join('')}
      </section>`;
    }

    html += `<section class="history-section">
      <div class="journal-section-heading">
        <span>走過的猶豫</span>
        <small>${entries.length} 筆，只存在這個裝置</small>
      </div>
      <div class="history-list">${entries.map(renderHistoryCard).join('')}</div>
    </section>`;
    return html;
  }

  function renderEchoCard(entry) {
    const hexagram = HEXAGRAMS[entry.originalId];
    const subject = entry.question || hexagram?.fn || `第 ${entry.originalId} 卦`;
    return `<article class="echo-card">
      <div class="echo-card-date">${formatJournalDate(entry.createdAt)} · ${escapeHtml(entry.decision?.label || '那一次的選擇')}</div>
      <div class="echo-card-question">${escapeHtml(subject)}</div>
      <div class="echo-card-prompt">回頭看，你最後比較接近哪一種選擇？</div>
      <div class="echo-actions">
        <button type="button" data-journal-action="echo" data-entry-id="${entry.id}" data-choice="pause">停了一下</button>
        <button type="button" data-journal-action="echo" data-entry-id="${entry.id}" data-choice="courage">勇敢試了</button>
        <button type="button" data-journal-action="echo" data-entry-id="${entry.id}" data-choice="stay">維持現狀</button>
        <button type="button" data-journal-action="echo" data-entry-id="${entry.id}" data-choice="pending">還在觀察</button>
      </div>
    </article>`;
  }

  function renderHistoryCard(entry) {
    const hexagram = HEXAGRAMS[entry.originalId];
    const direction = getDirectionMeta(entry.direction);
    const question = entry.question
      ? `<div class="history-card-question">${escapeHtml(entry.question)}</div>`
      : '<div class="history-card-question history-card-question--empty">當時沒有留下問題</div>';
    const reflection = entry.reflection
      ? `<div class="history-card-reflection">「${escapeHtml(entry.reflection)}」</div>`
      : '';
    const echo = entry.echo
      ? `<div class="history-card-echo">後來：${escapeHtml(entry.echo.label)}</div>`
      : '';
    return `<article class="history-card">
      <div class="history-card-symbol">${hexSymbol(entry.originalId)}</div>
      <div class="history-card-body">
        <div class="history-card-meta">${formatJournalDate(entry.createdAt)} · ${escapeHtml(direction.label)}${entry.isDailyFirst ? ' · 當日第一卦' : ''}</div>
        <div class="history-card-title">${escapeHtml(hexagram?.fn || `第 ${entry.originalId} 卦`)}</div>
        <div class="history-card-cue">${escapeHtml(entry.decision?.label || '決策陪伴')}</div>
        ${question}${reflection}${echo}
      </div>
      <div class="history-card-side">
        ${entry.favorite ? `<span class="history-favorite" aria-label="已收藏">${renderSpriteIcon('heart')}</span>` : ''}
        <button type="button" class="history-open-btn" data-journal-action="open" data-entry-id="${entry.id}">查看</button>
      </div>
    </article>`;
  }

  function renderAtlasContent() {
    const atlas = YiJournal.getAtlas();
    const unlockedCount = atlas.filter(item => item.unlocked).length;
    return `<section class="atlas-section">
      <div class="atlas-intro">
        <div><strong>${unlockedCount}</strong> / 64</div>
        <p>每天只有第一卦能留下新的卦象。圖鑑不是催你蒐集，而是記下人生曾在哪些地方與你相遇。</p>
      </div>
      <div class="atlas-grid">
        ${atlas.map(item => {
          const hexagram = HEXAGRAMS[item.id];
          if (!item.unlocked) {
            return `<div class="atlas-cell locked" aria-label="第 ${item.id} 卦尚未遇見">
              <span class="atlas-symbol">·</span><span class="atlas-number">${item.id}</span>
            </div>`;
          }
          return `<button type="button" class="atlas-cell unlocked" data-journal-action="open" data-entry-id="${item.unlocked.readingId}">
            <span class="atlas-symbol">${hexSymbol(item.id)}</span>
            <span class="atlas-number">${item.id}</span>
            <span class="atlas-name">${escapeHtml(hexagram?.n || '')}</span>
          </button>`;
        }).join('')}
      </div>
    </section>`;
  }

  function openJournalEntry(id) {
    const entry = YiJournal.getEntry(id);
    if (!entry) return;
    selectedDirection = entry.direction;
    currentMethod = entry.method;
    reading = Divination.getReading(entry.lines);
    currentJournalId = entry.id;
    currentResultSource = 'history';
    history.replaceState(null, '', location.pathname);
    Analytics.trackEvent('history_reading_open', { direction: entry.direction, hexagram_id: entry.originalId });
    renderResult();
  }

  function initJournalInteractions() {
    document.querySelectorAll('.journal-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        journalTab = tab.dataset.journalTab;
        Analytics.trackEvent(journalTab === 'atlas' ? 'atlas_open' : 'history_open');
        renderJournalPage();
      });
    });
    document.getElementById('journal-content')?.addEventListener('click', event => {
      const button = event.target.closest('[data-journal-action]');
      if (!button) return;
      const id = button.dataset.entryId;
      if (button.dataset.journalAction === 'open') {
        openJournalEntry(id);
        return;
      }
      if (button.dataset.journalAction === 'echo') {
        const updated = YiJournal.saveEcho(id, button.dataset.choice);
        if (!updated) return;
        Analytics.trackEvent('echo_complete', {
          choice: button.dataset.choice,
          direction: updated.direction,
          original_cue: updated.decision?.key || ''
        });
        showToast('這一次的選擇，已留在卦跡裡');
        renderJournalPage();
      }
    });
  }

  // === 意見回饋 ===
  function openFeedback() {
    feedbackRating = 0;
    document.querySelectorAll('.star').forEach(s => {
      s.classList.remove('active');
      s.setAttribute('aria-pressed', 'false');
    });
    document.getElementById('feedback-text').value = '';
    document.getElementById('feedback-modal').classList.add('show');
    Analytics.trackEvent('feedback_open', { direction: selectedDirection || '' });
  }

  function initFeedbackModal() {
    const hasEndpoint = !!String(window.YI_CONFIG?.feedbackEndpoint || '').trim();
    const deliveryNote = document.getElementById('feedback-delivery-note');
    const submitButton = document.getElementById('btn-feedback-submit');
    if (deliveryNote) {
      deliveryNote.textContent = hasEndpoint
        ? '回饋會直接送達，不會包含你記在卦跡裡的問題或心得。'
        : '送出後會開啟郵件，請在郵件程式中確認寄出。';
    }
    if (submitButton) submitButton.textContent = hasEndpoint ? '送出回饋' : '開啟郵件寄出';

    document.querySelectorAll('.star').forEach(star => {
      star.addEventListener('click', () => {
        feedbackRating = parseInt(star.dataset.v);
        document.querySelectorAll('.star').forEach(s => {
          const active = parseInt(s.dataset.v) <= feedbackRating;
          s.classList.toggle('active', active);
          s.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
      });
    });
    document.getElementById('feedback-modal')?.addEventListener('click', event => {
      if (event.target === event.currentTarget) {
        event.currentTarget.classList.remove('show');
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        document.getElementById('feedback-modal')?.classList.remove('show');
      }
    });
    document.getElementById('btn-feedback-cancel')?.addEventListener('click', () =>
      document.getElementById('feedback-modal').classList.remove('show'));
    document.getElementById('btn-feedback-submit')?.addEventListener('click', async () => {
      const feedbackText = document.getElementById('feedback-text').value.trim();
      if (!feedbackRating && !feedbackText) {
        showToast('選個星等，或留一句話再送出也可以。');
        return;
      }
      const button = document.getElementById('btn-feedback-submit');
      button.disabled = true;
      try {
        const result = await Analytics.submitFeedback(feedbackRating, feedbackText, {
          direction: selectedDirection
        });
        document.getElementById('feedback-modal').classList.remove('show');
        showToast(result.delivered ? '回饋已送達，謝謝你' : '已開啟郵件，寄出後我們才會收到');
      } catch {
        showToast('暫時無法送出，請稍後再試');
      } finally {
        button.disabled = false;
      }
    });
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
      currentJournalId = null;
      currentResultSource = 'shared';
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

    const direction = getDirectionMeta(selectedDirection || 'love');
    const sym = hexSymbol(r.originalId);
    const decisionCue = getDecisionCue(r);
    const journalEntry = currentJournalId ? YiJournal.getEntry(currentJournalId) : null;

    let html = '';

    // ── scroll hint ──
    html += `<div class="scroll-hint" id="scroll-hint">
      <span class="scroll-hint-arrow">︾</span>
      <span class="scroll-hint-text">看解卦</span>
    </div>`;

    // ── 結果頭部 ──
    html += `<div class="result-header">
      <div class="result-symbol">${sym}</div>
      <div class="result-name">${h.n}卦</div>
      <div class="result-fullname">${h.fn}</div>
      <div class="result-judgment">${h.j}</div>
    </div>`;

    // ── 方向標記 ──
    html += `<div style="text-align:center;margin-bottom:2rem">
      ${renderDirectionChip(direction)}
    </div>`;

    html += renderDailyWisdomCard(selectedDirection || 'general', 'daily-wisdom-card--result');

    html += renderDecisionCompanion(decisionCue, journalEntry);

    if (selectedDirection === 'yesno') {
      html += renderYesNoCard(r);
    }

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

    html += renderReflectionCard(decisionCue, journalEntry);

    // 底部操作
    html += `<div class="result-actions">
      <button class="btn btn--primary" id="btn-restart">問另一件事</button>
      <button class="btn btn--share" id="btn-share-image">儲存圖片</button>
      <button class="btn btn--share" id="btn-share-link">分享連結</button>
      <button class="btn btn--ghost" id="btn-home-from-result">回到首頁</button>
    </div>
    <div class="result-footer-btns">
      <button class="btn-icon${journalEntry?.favorite ? ' liked' : ''}" id="btn-like" title="收藏這一卦" aria-pressed="${journalEntry?.favorite ? 'true' : 'false'}">
        <span class="icon-heart">${renderSpriteIcon('heart')}</span>
        <span class="icon-label">${journalEntry?.favorite ? '已收藏' : '收藏'}</span>
      </button>
      <button class="btn-icon" id="btn-feedback" title="意見回饋">
        <span class="icon-msg">${renderSpriteIcon('message')}</span>
        <span class="icon-label">回饋</span>
      </button>
    </div>`;

    container.innerHTML = html;

    // 再問一卦
    document.getElementById('btn-restart')?.addEventListener('click', () => {
      resetDecisionFlow();
      goTo('home');
    });
    document.getElementById('btn-home-from-result')?.addEventListener('click', () => {
      resetDecisionFlow();
      goTo('home');
    });

    document.getElementById('btn-save-reflection')?.addEventListener('click', () => {
      if (!currentJournalId) return;
      const value = document.getElementById('decision-reflection')?.value || '';
      const updated = YiJournal.saveReflection(currentJournalId, value);
      if (!updated) {
        showToast('這次沒有保存成功，請再試一次');
        return;
      }
      Analytics.trackEvent('reflection_saved', {
        direction: updated.direction,
        has_text: !!updated.reflection,
        text_length: updated.reflection.length,
        decision_cue: updated.decision?.key || ''
      });
      showToast('已留在你的卦跡裡');
    });

    // 儲存圖片
    document.getElementById('btn-share-image')?.addEventListener('click', () => shareImage());

    // 分享連結
    document.getElementById('btn-share-link')?.addEventListener('click', () => shareLink());

    // 愛心
    document.getElementById('btn-like')?.addEventListener('click', () => {
      const btn = document.getElementById('btn-like');
      if (!currentJournalId) {
        btn.classList.add('liked');
        btn.disabled = true;
        Analytics.trackFavorite(true, selectedDirection);
        showToast('這是分享卦，收藏不會寫進你的卦跡');
        return;
      }
      const updated = YiJournal.toggleFavorite(currentJournalId);
      if (!updated) return;
      btn.classList.toggle('liked', updated.favorite);
      btn.setAttribute('aria-pressed', updated.favorite ? 'true' : 'false');
      btn.querySelector('.icon-label').textContent = updated.favorite ? '已收藏' : '收藏';
      Analytics.trackFavorite(updated.favorite, selectedDirection);
      showToast(updated.favorite ? '已收藏到你的卦跡' : '已取消收藏');
    });

    // 意見回饋
    document.getElementById('btn-feedback')?.addEventListener('click', () => openFeedback());

    goTo('result');
    Analytics.trackEvent('result_view', {
      direction: selectedDirection,
      hexagram_id: r.originalId,
      has_changed_hexagram: !!r.changedId,
      decision_cue: decisionCue.key,
      source: currentResultSource
    });
    if (currentResultSource === 'new') {
      Analytics.trackEvent('reading_result_view', {
        direction: selectedDirection,
        hexagram_id: r.originalId,
        decision_cue: decisionCue.key
      });
    }

    // 進入結果頁後緩慢下滑再彈回，提示可下滑
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      document.getElementById('scroll-hint')?.classList.add('hidden');
      return;
    }
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      setTimeout(() => {
        window.scrollTo({ top: 120, behavior: 'smooth' });
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 900);
      }, 300);

      // 使用者一開始滾動就隱藏 hint
      const hint = document.getElementById('scroll-hint');
      const hideHint = () => {
        if (hint) hint.classList.add('hidden');
        window.removeEventListener('scroll', hideHint);
      };
      window.addEventListener('scroll', hideHint, { passive: true });
      // 10 秒後自動消失
      setTimeout(hideHint, 10000);
    }, 700);
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
