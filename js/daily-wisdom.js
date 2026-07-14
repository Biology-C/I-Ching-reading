/**
 * 卦象解答庫：六十四卦各 8 則，共 512 則。
 * 每卦包含 4 則原創格言、2 則原創預言故事、2 則《易經》名著名言。
 */
const DailyWisdom = (() => {
  const VARIANTS_PER_HEXAGRAM = 8;
  const TOTAL_ENTRIES = 64 * VARIANTS_PER_HEXAGRAM;

  function profile(gift, warning, action, forecast) {
    return { gift, warning, action, forecast };
  }

  const profiles = [
    null,
    profile('創造力與主動權', '逞強與過度擴張', '選定成熟時機再全力出手', '能力會被看見，節制將決定能走多遠'),
    profile('承接力與長久耐性', '一味順從而失去自己', '把基礎照顧好並穩穩回應', '真正的成果會從持續承接中長出來'),
    profile('開創期的生命力', '因起步混亂而否定方向', '先建立秩序並找到可靠同伴', '眼前雖難，新的局面已經開始形成'),
    profile('求知與重新理解的能力', '假裝知道或急著下結論', '把問題問得更具體並接受指引', '承認未知之後，答案會比預期更快靠近'),
    profile('等待中的信任', '焦躁催促尚未成熟的事', '保存體力並完成眼前準備', '時機正在靠近，急行反而會錯過訊號'),
    profile('辨明立場的清醒', '為證明自己而把衝突推到底', '先確認真正值得守住的是什麼', '退離無益爭執後，重要的部分反而保得住'),
    profile('組織眾人的紀律', '命令混亂與各自為政', '先定規則再分配責任', '只要隊伍重新整齊，難題就能被共同承擔'),
    profile('結盟與彼此信任', '為了合群而靠近錯的人', '辨認真正同路的人並真誠回應', '可靠的連結會留下，不合適的關係會自然鬆開'),
    profile('小幅累積的力量', '因進展不大而躁進', '先收好資源並完成可控的小步', '雲已聚集，成果會在條件齊備後落下'),
    profile('謹慎行走的分寸', '低估風險或過度自信', '尊重界線並看清每一步落點', '小心不是退縮，而是讓你安全穿過險處'),
    profile('上下相通的順勢', '把好運視為理所當然', '趁局面順暢時完成最重要的合作', '門正在打開，及時分享會讓順勢延續'),
    profile('閉塞期的保存力', '在不通時反覆硬推', '收斂消耗並守住核心位置', '低潮不會永久停留，先保全自己就有轉機'),
    profile('共同目標的召集力', '只留在熟悉圈子裡', '公開真正目的並尋找同方向的人', '跨出原有邊界後，會有人願意與你同行'),
    profile('豐盛資源與影響力', '擁有之後忘記節制', '盤點手中資源並用在值得的人事上', '你得到的會增加，但如何分配決定它能否長久'),
    profile('謙遜帶來的穩定', '把自我縮小成沒有聲音', '安靜展現實力而不急著爭功', '越不炫耀，真正的份量越容易被看見'),
    profile('動員情緒與熱情', '興奮過頭而承諾太多', '把熱情放進具體節奏與準備', '氣勢可以帶路，但落實才會把願景留下'),
    profile('順應變化的彈性', '盲目跟隨而失去判斷', '確認值得追隨的方向再調整步伐', '懂得隨時，也懂得守己，就能避開無謂阻力'),
    profile('修補舊問題的勇氣', '只處理表面而放任根源', '回到問題起點並逐層修正', '舊結清理之後，新的秩序才有地方建立'),
    profile('靠近與照拂的力量', '急著掌控別人的節奏', '帶著善意接近並保留對方空間', '真誠的靠近會得到回應，但盛勢也需要節制'),
    profile('觀察全局的視野', '只看表象或只等別人評價', '退一步看清模式再決定位置', '當你停止急著介入，真正的規律會浮現'),
    profile('切開阻礙的決斷', '情緒化處罰或過度苛責', '把規則與後果說清楚再行動', '需要處理的結會被打開，公平是最重要的刀口'),
    profile('形式與內容的美感', '被外表吸引而忽略本質', '先把內容做好再整理呈現', '適度修飾會帶來助力，過度裝飾反而遮住真相'),
    profile('剝落之中的保全', '在結構鬆動時勉強擴張', '停止加碼並保護最重要的根', '不適合的部分會脫落，留下來的才值得重建'),
    profile('返回正軌的復原力', '因一次偏離就放棄自己', '回到最初的小習慣重新開始', '失去的節奏會回來，這次你會走得更清醒'),
    profile('真實自然的行動力', '妄念與不切實際的投機', '依事實行動並放下多餘算計', '不強求特定結果時，正確的路反而更容易出現'),
    profile('累積知識與資源的容量', '囤積而不使用或準備過度', '整理所學並選一處真正投入', '儲備已逐漸足夠，下一步要讓能力進入現場'),
    profile('滋養自己與他人的能力', '用錯誤資訊或欲望填補空缺', '慎選入口並照顧身心需要', '你持續餵養的事物，將成為未來的樣子'),
    profile('承受非常時刻的勇氣', '負荷超量卻不肯求援', '先支撐最關鍵處並減去次要重量', '局面雖偏斜，只要重新分配力量仍能跨過去'),
    profile('穿越險境的韌性', '因恐懼而重複踏入同一個坑', '保持固定原則並一次處理一段', '危險尚未完全消失，但你會找到可通行的節奏'),
    profile('照見與連結的明晰', '依附外界認可而失去中心', '確認自己依附的是價值還是焦慮', '光會照亮道路，也會讓不合適的依附無所遁形'),
    profile('感應彼此的開放', '把一時心動誤認成長久承諾', '留意真實回應並讓關係慢慢確認', '彼此會產生影響，能否長久取決於真誠與分寸'),
    profile('長期一致的毅力', '僵化堅持已經失效的方法', '守住方向並允許做法調整', '穩定累積會帶來成果，真正的恆久不是一成不變'),
    profile('適時退出的清醒', '因面子拖延離開時機', '拉開距離並保留必要界線', '退開之後視野會恢復，新的路也會因此顯現'),
    profile('強大推進的能量', '把力量變成壓迫或衝撞', '先校準方向再使用力量', '障礙可能被突破，但克制會決定是否留下後患'),
    profile('被看見與逐步上升', '急著證明而消耗信用', '把成果穩定呈現並接受支持', '光正在升起，持續做好眼前事會得到更多位置'),
    profile('黑暗中保存光的智慧', '在不安全時過度暴露', '收好鋒芒並守住內在原則', '暫時隱藏不是失敗，你會等到可以重新發光的地方'),
    profile('內部秩序與照顧', '把親近當成可以忽略界線', '先把角色責任與說話方式整理好', '內部穩定後，外面的問題會比原先容易處理'),
    profile('差異中的獨立判斷', '要求所有人完全一致', '先處理可合作的小事並保留差異', '分歧不一定導向分裂，適當距離反而能保持清楚'),
    profile('繞過阻礙的智慧', '在不利方向持續硬撐', '停下修正路線並尋求可靠協助', '直路暫時不通，換一個方向就會看見出口'),
    profile('鬆綁與釋放的時機', '問題已過仍緊抓不放', '處理殘留後讓事情真正結束', '壓力會開始解除，越早回到日常越能接住新局'),
    profile('減少後留下的純度', '把必要精簡誤認成失去', '主動放下一項次要負擔', '減去不必要的部分後，真正重要的會重新有力量'),
    profile('增益與彼此成就', '只想得到而忘記回流', '把新增資源投入能共同成長的地方', '願意分享與修正的人，會得到更長久的增加'),
    profile('突破前的公開決心', '用激烈手段取代清楚表態', '把決定說明白並留下合理退路', '界線一旦清楚，拖延已久的局面就會開始移動'),
    profile('意外相遇的敏銳', '被突如其來的吸引帶走', '先觀察來者的力量與代價', '新的相遇會改變局面，是否靠近需要更清醒的判斷'),
    profile('聚集資源與人心', '人多卻沒有共同中心', '重新說明集合的理由與分工', '當共同目的被看見，分散的力量會重新聚攏'),
    profile('一步一步上升的耐性', '只看高度而忽略根基', '累積一個可驗證的小成果', '上升正在發生，不必跳階也能走到更高的位置'),
    profile('困境中的志向', '把無力感變成自我否定', '節省語言與能量並守住核心', '外在資源雖少，內在方向不失就仍有翻轉可能'),
    profile('穩定供應的公共價值', '只顧取用卻不維護來源', '回到根本並修好可長期使用的系統', '真正可靠的資源會留下，但需要有人把最後一步做好'),
    profile('更新制度與身份的勇氣', '為改變而改變或時機未到', '先取得信任再更換舊方法', '改變一旦得到共識，過去的遺憾會轉成新的秩序'),
    profile('轉化材料的整合力', '容器不穩卻急著加入更多', '先正位再整合人才與資源', '不同元素會被煉成新成果，你也將承擔新的位置'),
    profile('驟變中的警醒', '受驚後失去基本判斷', '先穩住身體再檢查真正損失', '震動會很快過去，留下的提醒能幫你避開更大風險'),
    profile('停止與專注的力量', '把停下變成逃避所有關係', '停止越界思考並回到自己的位置', '外界雜音會降低，真正需要處理的事將變得清楚'),
    profile('循序成熟的耐性', '為了快速抵達而跳過階段', '完成目前階段再自然前進', '關係與成果會逐步穩定，慢反而是最快的路'),
    profile('不對等局面中的清醒', '因急於進入而接受不合適位置', '先確認名分條件與長期代價', '眼前吸引未必能長久，保留選擇會保護未來'),
    profile('高峰時刻的光與資源', '在最盛時忽略下降準備', '趁能見度最高時完成關鍵決定', '成果會被放大，提前準備能讓豐盛不成為負擔'),
    profile('陌生環境中的自持', '把暫時落腳誤認成永久歸宿', '保持禮貌謹慎並照顧隨身資源', '旅途仍會變動，守住分寸就能遇見下一個落腳處'),
    profile('柔和滲透的影響力', '反覆猶豫使意志被風吹散', '用小而一致的行動持續推進', '改變不會轟然發生，卻會在不知不覺間深入'),
    profile('交流與喜悅的感染力', '討好表面和氣而失去真誠', '說出真話並留下彼此學習空間', '坦誠的交流會帶來喜悅，也會篩出真正的朋友'),
    profile('化開隔閡的流動', '四散逃避而沒有共同核心', '先建立可信任的中心再鬆開結', '阻塞會被風吹散，重新連結後便能渡過難處'),
    profile('界線與節奏的保護', '把規律變成過度苛刻', '設定可長久遵守的限制', '適度節制會帶來自由，過苦的規則則需要調整'),
    profile('內外一致的信任', '只靠話語而缺少真實行動', '讓承諾與行動保持一致', '真誠會穿過懷疑，甚至讓原本難以溝通的人回應'),
    profile('小幅超越的精準', '在只宜小事時企圖大躍進', '把姿態放低並完成細節', '小步會得到好結果，過度升高反而容易失去平衡'),
    profile('完成後的預防意識', '因事情已成就放鬆警覺', '檢查收尾與可能重新失序之處', '成果可以維持，但最後的照顧比開始更重要'),
    profile('未完成時的希望與辨別', '在最後關頭急著跨越', '分清位置並完成尚缺的一步', '終點已經接近，耐住最後的混亂就能真正過河')
  ];

  function getDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getDateLabel(date = new Date()) {
    return `${date.getMonth() + 1} 月 ${date.getDate()} 日`;
  }

  function hashSeed(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return hash;
  }

  function getEntries(hexagramId) {
    const id = Number(hexagramId);
    const hexagram = typeof HEXAGRAMS !== 'undefined' ? HEXAGRAMS[id] : null;
    const tone = profiles[id];
    if (!hexagram || !tone) return [];

    const entry = (index, type, label, title, text, source = '') => ({
      id: `h${String(id).padStart(2, '0')}-v${index + 1}`,
      hexagramId: id,
      index,
      type,
      label,
      title,
      text,
      source
    });

    return [
      entry(0, 'maxim', '卦象格言', `${hexagram.n}卦・此刻`, hexagram.core),
      entry(1, 'maxim', '卦象格言', `${hexagram.n}卦・力量`, `${tone.gift}正在成形。今天先${tone.action}，答案會比想像更清楚。`),
      entry(2, 'maxim', '卦象格言', `${hexagram.n}卦・提醒`, `別讓${tone.warning}替你作決定。${hexagram.n}卦提醒你：${tone.forecast}。`),
      entry(3, 'maxim', '卦象格言', `${hexagram.n}卦・解答`, `${hexagram.n}卦不替你保證結果；它只提醒你，${tone.action}，${tone.forecast}。`),
      entry(4, 'story', '預言故事', `${hexagram.n}卦・夢兆`, `有人夢見${hexagram.fn}的景象：「${hexagram.im}」醒來後，他沒有追問吉凶，只先${tone.action}。後來才明白，${tone.forecast}。`, '原創象徵故事'),
      entry(5, 'story', '預言故事', `${hexagram.n}卦・旅人`, `旅人行至${hexagram.n}卦所示的路口。他沒有讓${tone.warning}帶路，而把${tone.gift}帶在身上。不久，原本模糊的局面開始顯出方向：${tone.forecast}。`, '原創象徵故事'),
      entry(6, 'classic', '名著名言', `${hexagram.n}卦・象傳`, hexagram.im, '《易經・象傳》'),
      entry(7, 'classic', '名著名言', `${hexagram.n}卦・卦辭`, hexagram.j, '《易經・卦辭》')
    ];
  }

  function get(hexagramId, date = new Date(), seenIndexes = null) {
    const entries = getEntries(hexagramId);
    if (!entries.length) return null;

    const dateKey = getDateKey(date);
    const startIndex = hashSeed(`${dateKey}:hexagram:${hexagramId}`) % entries.length;
    let index = startIndex;

    if (Array.isArray(seenIndexes) && seenIndexes.length < entries.length) {
      const seen = new Set(seenIndexes.map(Number));
      for (let offset = 0; offset < entries.length; offset++) {
        const candidate = (startIndex + offset) % entries.length;
        if (!seen.has(candidate)) {
          index = candidate;
          break;
        }
      }
    }

    return {
      ...entries[index],
      dateKey,
      dateLabel: getDateLabel(date),
      position: index + 1,
      variantsPerHexagram: VARIANTS_PER_HEXAGRAM,
      totalEntries: TOTAL_ENTRIES
    };
  }

  function getById(entryId) {
    const match = /^h(\d{2})-v([1-8])$/.exec(String(entryId || ''));
    if (!match) return null;
    return getEntries(Number(match[1]))[Number(match[2]) - 1] || null;
  }

  function getAll() {
    return Array.from({ length: 64 }, (_, index) => getEntries(index + 1)).flat();
  }

  function getStats() {
    const entries = getAll();
    return {
      hexagramCount: 64,
      variantsPerHexagram: VARIANTS_PER_HEXAGRAM,
      totalEntries: entries.length,
      typeCounts: entries.reduce((counts, item) => {
        counts[item.type] = (counts[item.type] || 0) + 1;
        return counts;
      }, {})
    };
  }

  return { get, getById, getEntries, getAll, getStats };
})();
