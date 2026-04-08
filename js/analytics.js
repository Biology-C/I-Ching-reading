/**
 * 易經問卦工具 — 使用行為分析模組
 * 追蹤：問卦方向、首次/追問、起卦方式、分享類型、愛心、意見回饋
 * 資料存於 localStorage（本機）+ Google Analytics GA4（跨用戶）
 *
 * 查看統計：在瀏覽器 console 輸入 Analytics.getStats()
 */
const Analytics = (() => {
  const SESSION_KEY = 'yi_sess';
  const LOCAL_KEY   = 'yi_stats';

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || { count: 0 }; }
    catch { return { count: 0 }; }
  }
  function saveSession(s) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch {}
  }

  function emptyStats() {
    return {
      questions:       0,
      by_direction:    { love:0, study:0, career:0, wealth:0 },
      first_q:         { love:0, study:0, career:0, wealth:0 },
      followup_q:      { love:0, study:0, career:0, wealth:0 },
      share_link:      { love:0, study:0, career:0, wealth:0 },
      share_image:     { love:0, study:0, career:0, wealth:0 },
      methods:         { instant:0, number:0, coin:0 },
      likes:           0,
      feedbacks:       0
    };
  }
  function getLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_KEY));
      return Object.assign(emptyStats(), saved);
    } catch { return emptyStats(); }
  }
  function saveLocal(d) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(d)); } catch {}
  }

  function send(event, params) {
    if (typeof gtag === 'function') gtag('event', event, params);
  }

  /** 記錄一次問卦完成（direction + method + 首次或追問） */
  function trackQuestion(direction, method) {
    const sess  = getSession();
    const local = getLocal();
    const isFirst = sess.count === 0;

    sess.count++;
    saveSession(sess);

    local.questions++;
    local.by_direction[direction] = (local.by_direction[direction] || 0) + 1;
    local.methods[method]         = (local.methods[method] || 0) + 1;
    if (isFirst) local.first_q[direction]   = (local.first_q[direction] || 0) + 1;
    else         local.followup_q[direction] = (local.followup_q[direction] || 0) + 1;
    saveLocal(local);

    send('question_asked', {
      direction,
      method,
      question_type:   isFirst ? 'first' : 'followup',
      session_count:   sess.count
    });
  }

  /** 記錄分享（type: 'link' | 'image'） */
  function trackShare(type, direction) {
    const local = getLocal();
    const key = type === 'image' ? 'share_image' : 'share_link';
    local[key][direction] = (local[key][direction] || 0) + 1;
    saveLocal(local);
    send('share', { share_type: type, direction });
  }

  /** 記錄愛心 */
  function trackLike(direction) {
    const local = getLocal();
    local.likes = (local.likes || 0) + 1;
    saveLocal(local);
    send('like', { direction });
  }

  /** 記錄意見回饋送出 */
  function trackFeedback(rating) {
    const local = getLocal();
    local.feedbacks = (local.feedbacks || 0) + 1;
    saveLocal(local);
    send('feedback', { rating });
  }

  /** 取得本機統計（在 console 輸入 Analytics.getStats() 查看） */
  function getStats() { return getLocal(); }

  return { trackQuestion, trackShare, trackLike, trackFeedback, getStats };
})();
