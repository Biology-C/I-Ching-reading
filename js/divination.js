/**
 * 易經起卦算法模組 v2
 * 支援四態輸出（6老陰/7少陽/8少陰/9老陽）+ 動爻 + 變卦
 */
const Divination = (() => {
  const TRIGRAM_NAMES = ['坤','艮','坎','巽','震','離','兌','乾'];

  // King Wen 序：[上卦][下卦] → 卦序(1-64)
  const KW = [
    [2,23,8,20,16,35,45,12],
    [15,52,39,53,62,56,31,33],
    [7,4,29,59,3,64,47,6],
    [46,18,48,57,32,50,28,44],
    [24,27,3,42,51,21,17,25],
    [36,22,63,37,55,30,49,13],
    [19,41,60,61,54,38,58,10],
    [11,26,5,9,34,14,43,1]
  ];

  /** 6爻值(6/7/8/9)陣列 → 本卦ID */
  function linesToHexId(lines) {
    const yao = lines.map(v => (v===7||v===9) ? 1 : 0);
    const lo = yao[0] + yao[1]*2 + yao[2]*4;
    const up = yao[3] + yao[4]*2 + yao[5]*4;
    return KW[up][lo];
  }

  /** 6爻值 → 變卦ID（動爻翻轉） */
  function changingHexId(lines) {
    const changed = lines.map(v => {
      if (v === 6) return 7;  // 老陰→少陽
      if (v === 9) return 8;  // 老陽→少陰
      return v;
    });
    return linesToHexId(changed);
  }

  /** 取得動爻位置（0-based） */
  function getChangingLines(lines) {
    return lines.reduce((acc, v, i) => {
      if (v === 6 || v === 9) acc.push(i);
      return acc;
    }, []);
  }

  /**
   * 判讀模式（朱熹《易學啟蒙》）
   * 回傳 { focus, description }
   *   focus: 'original' | 'changing' | 'both' | 'changed_stable' | 'changed'
   */
  function getReadingMode(lines) {
    const cl = getChangingLines(lines);
    const n = cl.length;
    const hexId = linesToHexId(lines);
    if (n === 0) return { focus:'original', desc:'靜卦，以本卦卦辭為主' };
    if (n <= 2) return { focus:'changing', desc:'聚焦動爻爻辭' };
    if (n === 3) return { focus:'both', desc:'本卦與變卦並觀' };
    if (n <= 5) return { focus:'changed_stable', desc:'聚焦變卦中不動之爻' };
    // n === 6
    if (hexId === 1) return { focus:'extra', desc:'乾卦用九' };
    if (hexId === 2) return { focus:'extra', desc:'坤卦用六' };
    return { focus:'changed', desc:'全爻皆動，以變卦卦辭為主' };
  }

  /** 完整占卜結果 */
  function getReading(lines) {
    const originalId = linesToHexId(lines);
    const changingLines = getChangingLines(lines);
    const changedId = changingLines.length > 0 ? changingHexId(lines) : null;
    const mode = getReadingMode(lines);
    const yao = lines.map(v => (v===7||v===9) ? 1 : 0);

    // 變卦的爻陣列
    const changedYao = changedId ? lines.map(v => {
      if (v === 6) return 1; if (v === 9) return 0;
      return (v===7) ? 1 : 0;
    }) : null;

    // 變卦中不動的爻位置
    const stableInChanged = changedId ? lines.reduce((acc, v, i) => {
      if (v !== 6 && v !== 9) acc.push(i);
      return acc;
    }, []) : [];

    return {
      lines, yao, originalId, changedId,
      changingLines, stableInChanged,
      mode, changedYao
    };
  }

  // === 三種起卦方式 ===

  /** 一念成卦：隨機產生6爻(含動爻機率) */
  function instant() {
    const lines = [];
    for (let i = 0; i < 6; i++) {
      const r = Math.random();
      if (r < 0.125) lines.push(6);       // 老陰 12.5%
      else if (r < 0.5) lines.push(7);    // 少陽 37.5%
      else if (r < 0.875) lines.push(8);  // 少陰 37.5%
      else lines.push(9);                  // 老陽 12.5%
    }
    return getReading(lines);
  }

  /** 數字起卦：6組3位數 → 6爻 */
  function fromNumbers(numbers) {
    const lines = numbers.map(num => {
      const sum = String(num).split('').reduce((a,b) => a + Number(b), 0);
      const r = sum % 8;
      if (r === 0) return 6;        // 老陰
      if (r <= 3) return 7;         // 少陽
      if (r <= 6) return 8;         // 少陰
      return 9;                      // 老陽
    });
    return getReading(lines);
  }

  /** 擲幣：模擬3枚銅錢 */
  function tossCoin() {
    const coins = [0,0,0].map(() => Math.random() < 0.5 ? 3 : 2);
    const total = coins.reduce((a,b) => a+b, 0);
    return { coins, value: total }; // 6,7,8,9
  }

  /** 完整擲幣起卦（傳入6次擲幣結果） */
  function fromCoins(tosses) {
    const lines = tosses.map(t => t.value);
    return getReading(lines);
  }

  /** 隨機3位數 */
  function randomNum() { return Math.floor(Math.random()*900)+100; }

  /** 卦ID → 6爻陣列（反推，用少陽/少陰表示） */
  function hexIdToYao(id) {
    for (let u = 0; u < 8; u++)
      for (let l = 0; l < 8; l++)
        if (KW[u][l] === id)
          return [l&1,(l>>1)&1,(l>>2)&1, u&1,(u>>1)&1,(u>>2)&1];
    return [1,1,1,1,1,1];
  }

  return {
    instant, fromNumbers, tossCoin, fromCoins,
    getReading, getReadingMode, getChangingLines,
    linesToHexId, changingHexId, hexIdToYao, randomNum,
    TRIGRAM_NAMES
  };
})();
