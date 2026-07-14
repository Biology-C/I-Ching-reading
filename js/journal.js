/**
 * 決策卦跡：所有資料只保存在目前裝置。
 * 每天第一筆正式起卦會標記為「今日一卦」，也只有這筆能解鎖圖鑑與解答藏書。
 */
const YiJournal = (() => {
  const STORAGE_KEY = 'yi_journal_v1';
  const MAX_HISTORY = 120;
  const USER_RESPONSE_OPTIONS = Object.freeze({
    reactions: Object.freeze([
      { key: 'hit', label: '有被說中' },
      { key: 'partial', label: '只說中一半' },
      { key: 'knew', label: '好啦，我知道' },
      { key: 'resist', label: '我偏不要' },
      { key: 'disagree', label: '這次不聽你的' },
      { key: 'hold', label: '先放著' }
    ]),
    choices: Object.freeze([
      { key: 'pause', label: '我先不動' },
      { key: 'observe', label: '我再看看局勢' },
      { key: 'stay', label: '現在這樣就很好' },
      { key: 'try', label: '我偏要試一次' },
      { key: 'choose_self', label: '這次我選自己' },
      { key: 'seek_support', label: '我去找個人說說' },
      { key: 'defer', label: '今天拒絕作答' }
    ]),
    values: Object.freeze([
      { key: 'peace', label: '想要平靜' },
      { key: 'dignity', label: '不想再委屈' },
      { key: 'relationship', label: '想保住這段關係' },
      { key: 'freedom', label: '想要自由' },
      { key: 'growth', label: '想再成長一點' },
      { key: 'stability', label: '需要穩定' },
      { key: 'breathing_room', label: '只想喘口氣' },
      { key: 'unknown', label: '還不知道啦' }
    ])
  });

  function dateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function emptyData() {
    return { version: 3, history: [], unlocked: {}, wisdomUnlocked: {} };
  }

  function getData() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !Array.isArray(saved.history)) return emptyData();
      return {
        version: 3,
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
      userResponse: null,
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

  function getResponseOptions() {
    return {
      reactions: USER_RESPONSE_OPTIONS.reactions.map(item => ({ ...item })),
      choices: USER_RESPONSE_OPTIONS.choices.map(item => ({ ...item })),
      values: USER_RESPONSE_OPTIONS.values.map(item => ({ ...item }))
    };
  }

  function findResponseOption(type, key) {
    return USER_RESPONSE_OPTIONS[type]?.find(item => item.key === key) || null;
  }

  function saveUserResponse(id, payload = {}) {
    return updateEntry(id, entry => {
      const current = entry.userResponse || {};
      const reaction = Object.prototype.hasOwnProperty.call(payload, 'reactionKey')
        ? findResponseOption('reactions', payload.reactionKey)
        : current.reaction || null;
      const choice = Object.prototype.hasOwnProperty.call(payload, 'choiceKey')
        ? findResponseOption('choices', payload.choiceKey)
        : current.choice || null;
      const values = Object.prototype.hasOwnProperty.call(payload, 'valueKeys')
        ? [...new Set(Array.isArray(payload.valueKeys) ? payload.valueKeys : [])]
          .map(key => findResponseOption('values', key))
          .filter(Boolean)
          .slice(0, 2)
        : Array.isArray(current.values) ? current.values.slice(0, 2) : [];

      return {
        ...entry,
        userResponse: {
          reaction: reaction ? { ...reaction } : null,
          choice: choice ? { ...choice } : null,
          values: values.map(item => ({ ...item })),
          updatedAt: new Date().toISOString()
        }
      };
    });
  }

  function toggleFavorite(id) {
    return updateEntry(id, entry => ({ ...entry, favorite: !entry.favorite }));
  }

  function saveEcho(id, choice) {
    const labels = {
      pause: '我停了一下',
      courage: '我勇敢試了',
      stay: '維持現狀也很好',
      pending: '我還在觀察',
      done: '我做了',
      partial: '我做了一部分',
      changed: '我改變主意了',
      not_yet: '我還沒做',
      no_need: '已經不需要了'
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

  function recentDateKeys(count = 7) {
    const anchor = new Date();
    anchor.setHours(12, 0, 0, 0);
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(anchor);
      date.setDate(anchor.getDate() - (count - index - 1));
      return dateKey(date);
    });
  }

  function mostFrequent(items) {
    const counts = new Map();
    items.filter(Boolean).forEach(item => {
      const current = counts.get(item.key) || { ...item, count: 0 };
      current.count += 1;
      counts.set(item.key, current);
    });
    return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }

  function getSevenDayReview() {
    const keys = recentDateKeys(7);
    const dailyEntries = getData().history.filter(item => item.isDailyFirst);
    const entriesByDate = new Map(dailyEntries.map(item => [item.dateKey, item]));
    const days = keys.map(key => ({ dateKey: key, entry: entriesByDate.get(key) || null }));
    const entries = days.map(day => day.entry).filter(Boolean);
    const choices = mostFrequent(entries.map(entry => entry.userResponse?.choice));
    const values = mostFrequent(entries.flatMap(entry => (
      Array.isArray(entry.userResponse?.values) ? entry.userResponse.values : []
    )));

    return {
      days,
      completedDays: entries.length,
      responseDays: entries.filter(entry => entry.userResponse?.choice).length,
      echoDays: entries.filter(entry => entry.echo).length,
      choices,
      values,
      topChoice: choices[0] || null,
      topValues: values.slice(0, 2)
    };
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
    getResponseOptions,
    saveUserResponse,
    toggleFavorite,
    saveEcho,
    getAtlas,
    getWisdomIndexes,
    getWisdomCollection,
    getSevenDayReview,
    getSummary
  };
})();
