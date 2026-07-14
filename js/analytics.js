/**
 * 使用行為分析與回饋傳送。
 * 完整事件會保存在本機；設定 GA4 Measurement ID 後也會同步送至 GA4。
 */
const Analytics = (() => {
  const SESSION_KEY = 'yi_sess';
  const LOCAL_KEY = 'yi_stats';
  const MAX_EVENTS = 160;
  let initialized = false;

  function config() {
    return window.YI_CONFIG || {};
  }

  function getSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || { count: 0 }; }
    catch { return { count: 0 }; }
  }

  function saveSession(session) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch {}
  }

  function emptyStats() {
    return {
      questions: 0,
      by_direction: { love:0, study:0, career:0, wealth:0, yesno:0 },
      first_q: { love:0, study:0, career:0, wealth:0, yesno:0 },
      followup_q: { love:0, study:0, career:0, wealth:0, yesno:0 },
      share_link: { love:0, study:0, career:0, wealth:0, yesno:0 },
      share_image: { love:0, study:0, career:0, wealth:0, yesno:0 },
      methods: { instant:0, number:0, coin:0 },
      likes: 0,
      feedbacks: 0,
      feedback_entries: [],
      event_counts: {},
      events: [],
      active_dates: []
    };
  }

  function getLocal() {
    try {
      const saved = JSON.parse(localStorage.getItem(LOCAL_KEY));
      const stats = Object.assign(emptyStats(), saved || {});
      stats.event_counts = stats.event_counts || {};
      stats.events = Array.isArray(stats.events) ? stats.events : [];
      stats.active_dates = Array.isArray(stats.active_dates) ? stats.active_dates : [];
      return stats;
    } catch {
      return emptyStats();
    }
  }

  function saveLocal(stats) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(stats)); } catch {}
  }

  function dateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function cleanParams(params = {}) {
    return Object.fromEntries(Object.entries(params)
      .filter(([, value]) => ['string', 'number', 'boolean'].includes(typeof value))
      .map(([key, value]) => [key, typeof value === 'string' ? value.slice(0, 100) : value]));
  }

  function send(eventName, params) {
    if (typeof window.gtag === 'function') window.gtag('event', eventName, cleanParams(params));
  }

  function init(context = {}) {
    if (initialized) return;
    initialized = true;
    const measurementId = String(config().gaMeasurementId || '').trim();
    if (/^G-[A-Z0-9]+$/i.test(measurementId)) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag(){ window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', measurementId, { anonymize_ip: true });
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
      document.head.appendChild(script);
    }
    trackEvent('app_open', context);
  }

  function trackEvent(eventName, params = {}) {
    const safeName = String(eventName).replace(/[^a-z0-9_]/gi, '_').slice(0, 40);
    const safeParams = cleanParams(params);
    const stats = getLocal();
    const today = dateKey();
    stats.event_counts[safeName] = (stats.event_counts[safeName] || 0) + 1;
    stats.events.push({ name: safeName, params: safeParams, created_at: new Date().toISOString() });
    stats.events = stats.events.slice(-MAX_EVENTS);
    if (!stats.active_dates.includes(today)) stats.active_dates.push(today);
    stats.active_dates = stats.active_dates.slice(-90);
    saveLocal(stats);
    send(safeName, safeParams);
  }

  function trackQuestion(direction, method, extra = {}) {
    const session = getSession();
    const stats = getLocal();
    const isFirst = session.count === 0;
    session.count++;
    saveSession(session);

    stats.questions++;
    stats.by_direction[direction] = (stats.by_direction[direction] || 0) + 1;
    stats.methods[method] = (stats.methods[method] || 0) + 1;
    const questionBucket = isFirst ? stats.first_q : stats.followup_q;
    questionBucket[direction] = (questionBucket[direction] || 0) + 1;
    saveLocal(stats);

    trackEvent('reading_complete', {
      direction,
      method,
      question_type: isFirst ? 'first' : 'followup',
      session_count: session.count,
      ...extra
    });
  }

  function trackShare(type, direction) {
    const stats = getLocal();
    const key = type === 'image' ? 'share_image' : 'share_link';
    stats[key][direction] = (stats[key][direction] || 0) + 1;
    saveLocal(stats);
    trackEvent('share_result', { share_type: type, direction });
  }

  function trackFavorite(enabled, direction) {
    const stats = getLocal();
    if (enabled) stats.likes = (stats.likes || 0) + 1;
    saveLocal(stats);
    trackEvent('favorite_toggle', { enabled, direction });
  }

  function saveFeedbackLocally(rating, text) {
    const stats = getLocal();
    const trimmedText = String(text || '').trim().slice(0, 500);
    stats.feedbacks = (stats.feedbacks || 0) + 1;
    stats.feedback_entries.push({
      rating: rating || 0,
      text: trimmedText,
      created_at: new Date().toISOString()
    });
    stats.feedback_entries = stats.feedback_entries.slice(-20);
    saveLocal(stats);
    return trimmedText;
  }

  async function submitFeedback(rating, text, context = {}) {
    const trimmedText = saveFeedbackLocally(rating, text);
    trackEvent('feedback_submit', {
      rating: rating || 0,
      has_text: !!trimmedText,
      text_length: trimmedText.length,
      direction: context.direction || ''
    });

    const endpoint = String(config().feedbackEndpoint || '').trim();
    if (endpoint) {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          rating: rating || 0,
          message: trimmedText,
          direction: context.direction || '',
          page: location.href,
          submittedAt: new Date().toISOString(),
          _subject: '易｜人生決策輔助器：新回饋'
        })
      });
      if (!response.ok) throw new Error(`Feedback endpoint returned ${response.status}`);
      trackEvent('feedback_delivered', { channel: 'endpoint' });
      return { delivered: true, channel: 'endpoint' };
    }

    const email = String(config().feedbackEmail || '').trim();
    if (email) {
      const subject = `易｜人生決策輔助器回饋（${rating || 0} 星）`;
      const body = [
        `評分：${rating || 0} 星`,
        `方向：${context.direction || '未指定'}`,
        '',
        trimmedText || '沒有留言',
        '',
        `頁面：${location.href}`
      ].join('\n');
      location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      trackEvent('feedback_mail_open', { rating: rating || 0 });
      return { delivered: false, channel: 'email', openedMail: true };
    }

    throw new Error('No feedback destination configured');
  }

  function getStats() {
    return getLocal();
  }

  function getReport() {
    const stats = getLocal();
    const counts = stats.event_counts;
    const starts = counts.decision_start || 0;
    const directions = counts.direction_select || 0;
    const readings = counts.reading_complete || 0;
    const results = counts.reading_result_view || 0;
    const rate = (value, base) => base ? Math.round((value / base) * 1000) / 10 : 0;
    return {
      funnel: { starts, directions, readings, results },
      conversion: {
        start_to_direction: rate(directions, starts),
        direction_to_reading: rate(readings, directions),
        reading_to_result: rate(results, readings)
      },
      activeDays: stats.active_dates.length,
      eventCounts: { ...counts }
    };
  }

  return {
    init,
    trackEvent,
    trackQuestion,
    trackShare,
    trackFavorite,
    submitFeedback,
    getStats,
    getReport
  };
})();
