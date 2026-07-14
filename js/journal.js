/**
 * 決策卦跡：所有資料只保存在目前裝置。
 * 每天第一筆正式起卦會標記為「今日一卦」，也只有這筆能解鎖圖鑑與解答藏書。
 */
const YiJournal = (() => {
  const STORAGE_KEY = 'yi_journal_v1';
  const MAX_HISTORY = 120;

  function dateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function emptyData() {
    return { version: 2, history: [], unlocked: {}, wisdomUnlocked: {} };
  }

  function getData() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !Array.isArray(saved.history)) return emptyData();
      return {
        version: 2,
        history: saved.history,
        unlocked: saved.unlocked && typeof saved.unlocked === 'object' ? saved.unlocked : {},
        wisdomUnlocked: saved.wisdomUnlocked && typeof saved.wisdomUnlocked === 'object'
          ? saved.wisdomUnlocked
          : {}
      };
    } catch {
      return emptyData();
    }
  }

  function saveData(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  function createId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function recordReading(payload) {
    const data = getData();
    const now = new Date();
    const today = dateKey(now);
    const isDailyFirst = !data.history.some(item => item.dateKey === today);
    const originalId = Number(payload.reading.originalId);
    const entry = {
      id: createId(),
      createdAt: now.toISOString(),
      dateKey: today,
      direction: payload.direction || 'love',
      method: payload.method || 'instant',
      question: String(payload.question || '').trim().slice(0, 160),
      lines: payload.reading.lines.slice(0, 6),
      originalId,
      changedId: payload.reading.changedId || null,
      changingLines: payload.reading.changingLines.slice(),
      wisdom: payload.wisdom ? {
        id: payload.wisdom.id || '',
        hexagramId: Number(payload.wisdom.hexagramId) || originalId,
        index: Number.isInteger(payload.wisdom.index) ? payload.wisdom.index : null,
        type: payload.wisdom.type || 'maxim',
        label: payload.wisdom.label || '卦象格言',
        title: payload.wisdom.title || '',
        dateKey: payload.wisdom.dateKey,
        dateLabel: payload.wisdom.dateLabel || '',
        text: payload.wisdom.text,
        source: payload.wisdom.source || ''
      } : null,
      decision: payload.decision ? {
        key: payload.decision.key,
        label: payload.decision.label
      } : null,
      isDailyFirst,
      reflection: '',
      favorite: false,
      echo: null
    };

    let unlockedNow = false;
    if (isDailyFirst && originalId >= 1 && originalId <= 64 && !data.unlocked[originalId]) {
      data.unlocked[originalId] = {
        firstSeenAt: entry.createdAt,
        readingId: entry.id
      };
      unlockedNow = true;
    }

    let wisdomUnlockedNow = false;
    if (isDailyFirst && entry.wisdom?.id && !data.wisdomUnlocked[entry.wisdom.id]) {
      data.wisdomUnlocked[entry.wisdom.id] = {
        firstSeenAt: entry.createdAt,
        readingId: entry.id,
        hexagramId: originalId,
        index: entry.wisdom.index
      };
      wisdomUnlockedNow = true;
    }

    data.history.unshift(entry);
    data.history = data.history.slice(0, MAX_HISTORY);
    const saved = saveData(data);
    return {
      saved,
      entry,
      isDailyFirst,
      unlockedNow,
      unlockedCount: Object.keys(data.unlocked).length,
      wisdomUnlockedNow,
      wisdomUnlockedCount: Object.keys(data.wisdomUnlocked).length
    };
  }

  function getEntry(id) {
    return getData().history.find(item => item.id === id) || null;
  }

  function list() {
    return getData().history.slice();
  }

  function getToday() {
    const today = dateKey();
    return getData().history.find(item => item.dateKey === today && item.isDailyFirst) || null;
  }

  function updateEntry(id, updater) {
    const data = getData();
    const index = data.history.findIndex(item => item.id === id);
    if (index < 0) return null;
    const next = updater({ ...data.history[index] });
    data.history[index] = next;
    return saveData(data) ? next : null;
  }

  function saveReflection(id, reflection) {
    return updateEntry(id, entry => ({
      ...entry,
      reflection: String(reflection || '').trim().slice(0, 280)
    }));
  }

  function toggleFavorite(id) {
    return updateEntry(id, entry => ({ ...entry, favorite: !entry.favorite }));
  }

  function saveEcho(id, choice) {
    const labels = {
      pause: '我停了一下',
      courage: '我勇敢試了',
      stay: '維持現狀也很好',
      pending: '我還在觀察'
    };
    if (!labels[choice]) return null;
    return updateEntry(id, entry => ({
      ...entry,
      echo: {
        choice,
        label: labels[choice],
        createdAt: new Date().toISOString()
      }
    }));
  }

  function getAtlas() {
    const unlocked = getData().unlocked;
    return Array.from({ length: 64 }, (_, index) => {
      const id = index + 1;
      return { id, unlocked: unlocked[id] || null };
    });
  }

  function getWisdomIndexes(hexagramId) {
    const id = Number(hexagramId);
    return Object.values(getData().wisdomUnlocked)
      .filter(item => Number(item.hexagramId) === id && Number.isInteger(item.index))
      .map(item => item.index);
  }

  function getWisdomCollection() {
    return { ...getData().wisdomUnlocked };
  }

  function getSummary() {
    const data = getData();
    const today = dateKey();
    const monthPrefix = today.slice(0, 7);
    const dailyEntries = data.history.filter(item => item.isDailyFirst);
    return {
      historyCount: data.history.length,
      favoriteCount: data.history.filter(item => item.favorite).length,
      unlockedCount: Object.keys(data.unlocked).length,
      wisdomUnlockedCount: Object.keys(data.wisdomUnlocked).length,
      monthDays: new Set(dailyEntries.filter(item => item.dateKey.startsWith(monthPrefix)).map(item => item.dateKey)).size,
      pendingEchoCount: dailyEntries.filter(item => item.dateKey < today && !item.echo).length,
      today: dailyEntries.find(item => item.dateKey === today) || null
    };
  }

  return {
    dateKey,
    recordReading,
    getEntry,
    list,
    getToday,
    saveReflection,
    toggleFavorite,
    saveEcho,
    getAtlas,
    getWisdomIndexes,
    getWisdomCollection,
    getSummary
  };
})();
