'use strict';
/**
 * Antigravity Korean Localization Runtime
 * Works both in Node (main process / CLI tools) and inside sandboxed Electron preload
 * (where require('fs') and relative require() are unavailable).
 */

function createTranslator(rawDict) {
  const stringsObj = (rawDict && rawDict.strings) || {};
  const patternsArr = (rawDict && rawDict.patterns) || [];

  const exact = new Map(Object.entries(stringsObj));
  const compiledPatterns = [];
  for (let i = 0; i < patternsArr.length; i++) {
    const item = patternsArr[i];
    try {
      if (Array.isArray(item) && item.length >= 2) {
        compiledPatterns.push([new RegExp(item[0], item[2] || ''), item[1]]);
      }
    } catch (_) {}
  }

  const cache = new Map();
  const MAX_CACHE = 5000;

  const MONTHS_MAP = {
    january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
    april: 4, apr: 4, may: 5, june: 6, jun: 6, july: 7, jul: 7,
    august: 8, aug: 8, september: 9, sep: 9, sept: 9,
    october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
  };

  const WEEKDAYS_MAP = {
    monday: '월요일', mon: '월', tuesday: '화요일', tue: '화', tues: '화',
    wednesday: '수요일', wed: '수', thursday: '목요일', thu: '목', thur: '목', thurs: '목',
    friday: '금요일', fri: '금', saturday: '토요일', sat: '토', sunday: '일요일', sun: '일',
  };

  const WORD_NUM_MAP = {
    one: '1', two: '2', three: '3', four: '4', five: '5', six: '6',
    seven: '7', eight: '8', nine: '9', ten: '10', twelve: '12', twenty: '20',
  };

  function normalizeLimitName(str) {
    if (!str) return str;
    let s = str.trim();
    s = s.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\b/gi, (w) => WORD_NUM_MAP[w.toLowerCase()] || w);
    let m = s.match(/^(\d+)\s*(?:-|\s)?(hour|hr|hrs|h|day|days|d|week|weeks|wk|w|minute|minutes|min|m)(?:\s+(?:limit|quota))?$/i);
    if (m) {
      const u = m[2].toLowerCase();
      const unitKo = u.startsWith('h') ? '시간' : u.startsWith('d') ? '일' : u.startsWith('w') ? '주' : '분';
      return `${m[1]}${unitKo} 한도`;
    }
    if (/^weekly(?:\s+(?:limit|quota))?$/i.test(s)) return '주간 한도';
    if (/^daily(?:\s+(?:limit|quota))?$/i.test(s)) return '일일 한도';
    if (/^monthly(?:\s+(?:limit|quota))?$/i.test(s)) return '월간 한도';
    if (/^hourly(?:\s+(?:limit|quota))?$/i.test(s)) return '시간당 한도';
    if (/^session(?:\s+(?:limit|quota))?$/i.test(s)) return '세션 한도';
    if (/^standalone(?:\s+(?:limit|quota))?$/i.test(s)) return '단독 한도';
    return s;
  }

  function translateDurationExpr(str) {
    if (!str) return null;
    const s = str.trim();
    if (/^<\s*1\s*m(?:in(?:ute)?s?)?$/i.test(s) || /^less than (?:a|1) minute$/i.test(s)) {
      return '1분 미만';
    }
    const tokenRe = /(\d+)\s*(days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s|weeks?|wks?|wk|w)\b/gi;
    let matches = 0;
    const leftover = s.replace(tokenRe, () => { matches++; return ''; }).replace(/[,and\s]+/gi, '');
    if (matches > 0 && leftover === '') {
      const parts = [];
      let m;
      tokenRe.lastIndex = 0;
      while ((m = tokenRe.exec(s)) !== null) {
        const num = m[1];
        const u = m[2].toLowerCase();
        if (u.startsWith('w')) parts.push(num + '주');
        else if (u.startsWith('d')) parts.push(num + '일');
        else if (u.startsWith('h')) parts.push(num + '시간');
        else if (u.startsWith('m')) parts.push(num + '분');
        else if (u.startsWith('s')) parts.push(num + '초');
      }
      return parts.join(' ');
    }
    return null;
  }

  function translateTimeExpr(str) {
    if (!str) return str;
    let s = str.trim();
    s = s.replace(/\b(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\b/gi, (_, h, min, ampm) => {
      const period = ampm.toUpperCase() === 'AM' ? '오전' : '오후';
      return min ? `${period} ${h}:${min}` : `${period} ${h}시`;
    });
    s = s.replace(/\b(January|Jan|February|Feb|March|Mar|April|Apr|May|June|Jun|July|Jul|August|Aug|September|Sep|Sept|October|Oct|November|Nov|December|Dec)\s+(\d{1,2})(?:,\s*(\d{4}))?(?:\s+at\s+([^\s.,]+(?:\s+[^\s.,]+)?))?/gi,
      (_, mon, day, yr, tm) => {
        const mNum = MONTHS_MAP[mon.toLowerCase()] || mon;
        const yrPart = yr ? `${yr}년 ` : '';
        const tmPart = tm ? ` ${tm}` : '';
        return `${yrPart}${mNum}월 ${day}일${tmPart}`;
      });
    s = s.replace(/\b(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)\b/gi,
      (w) => WEEKDAYS_MAP[w.toLowerCase()] || w);
    s = s.replace(/\btomorrow\s+at\s+/gi, '내일 ');
    s = s.replace(/\btoday\s+at\s+/gi, '오늘 ');
    s = s.replace(/\bat\s+(오전|오후|\d)/gi, '$1');
    return s;
  }

  function translateModelSubject(str) {
    if (!str) return str;
    let s = str.trim();
    if (exact.has(s)) return exact.get(s);
    const lower = s.toLowerCase();
    if (lower === 'all gemini models except gemini 4 argon') return 'Gemini 4 Argon을 제외한 모든 Gemini 모델';
    if (lower === 'all gemini models except argon') return 'Argon을 제외한 모든 Gemini 모델';
    if (lower === 'gemini models except gemini 4 argon') return 'Gemini 4 Argon을 제외한 Gemini 모델';
    if (lower === 'gemini models except argon') return 'Argon을 제외한 Gemini 모델';
    if (lower === 'all gemini models') return '모든 Gemini 모델';
    if (lower === 'gemini models') return 'Gemini 모델';
    if (lower === 'all claude and gpt models' || lower === 'all claude & gpt models') return '모든 Claude 및 GPT 모델';
    if (lower === 'claude and gpt models' || lower === 'claude & gpt models') return 'Claude 및 GPT 모델';
    if (lower === 'claude and gpt' || lower === 'claude & gpt' || lower === 'claude / gpt') return 'Claude 및 GPT';
    if (lower === 'all argon models' || lower === 'argon models') return 'Argon 모델';
    if (lower === 'all models') return '모든 모델';
    if (lower === 'other models') return '기타 모델';
    if (lower === 'non-argon gemini models') return 'Argon 외 Gemini 모델';

    let m = s.match(/^all\s+(.+?)\s+models\s+(?:except|excluding)\s+(.+)$/i);
    if (m) return `${translateModelSubject(m[2])}을(를) 제외한 모든 ${translateModelSubject(m[1])} 모델`;
    m = s.match(/^(.+?)\s+models\s+(?:except|excluding)\s+(.+)$/i);
    if (m) return `${translateModelSubject(m[2])}을(를) 제외한 ${translateModelSubject(m[1])} 모델`;
    m = s.match(/^all\s+(.+?)\s+models$/i);
    if (m) return `모든 ${translateModelSubject(m[1])} 모델`;
    m = s.match(/^(.+?)\s+models$/i);
    if (m) return `${translateModelSubject(m[1])} 모델`;

    return s
      .replace(/\bClaude\s*(?:and|&|\/)\s*GPT\b/gi, 'Claude 및 GPT')
      .replace(/\bStandalone\s+quota\b/gi, '단독 한도')
      .replace(/\bStandalone\s+limit\b/gi, '단독 한도')
      .replace(/\bSeparate\s+quota\b/gi, '별도 한도')
      .replace(/\bIndividual\s+quota\b/gi, '개별 한도')
      .replace(/\bShared\s+quota\b/gi, '공유 한도');
  }

  function translateSingleQuotaClause(clause) {
    if (!clause) return null;
    const c = clause.trim();
    if (!c) return null;
    if (exact.has(c)) return exact.get(c);

    const hasDot = c.endsWith('.');
    const body = hasDot ? c.slice(0, -1).trim() : c;
    if (exact.has(body)) return exact.get(body) + (hasDot ? '.' : '');

    let m;
    // 1. Reset / Refresh in <duration>
    m = body.match(/^(Resets?|Refreshes|Renews?)\s+in\s+(.+)$/i);
    if (m) {
      const verb = /^refresh/i.test(m[1]) || /^renew/i.test(m[1]) ? '갱신' : '초기화';
      const dur = translateDurationExpr(m[2]);
      if (dur) return `${dur} 후 ${verb}` + (hasDot ? '.' : '');
    }

    // 2. Reset / Refresh every <duration>
    m = body.match(/^(Resets?|Refreshes|Renews?)\s+every\s+(.+)$/i);
    if (m) {
      const verb = /^refresh/i.test(m[1]) || /^renew/i.test(m[1]) ? '갱신' : '초기화';
      const rest = m[2].trim().toLowerCase();
      if (rest === 'day' || rest === '24 hours' || rest === '24h') return `매일 ${verb}` + (hasDot ? '.' : '');
      if (rest === 'week' || rest === '7 days' || rest === '7d') return `매주 ${verb}` + (hasDot ? '.' : '');
      if (rest === 'hour' || rest === '1 hour' || rest === '1h') return `매시간 ${verb}` + (hasDot ? '.' : '');
      if (rest === 'month') return `매월 ${verb}` + (hasDot ? '.' : '');
      const dur = translateDurationExpr(m[2]);
      if (dur) return `${dur}마다 ${verb}` + (hasDot ? '.' : '');
    }

    // 3. Reset / Refresh daily / weekly / hourly / monthly
    m = body.match(/^(Resets?|Refreshes|Renews?)\s+(daily|weekly|hourly|monthly)(?:\s+at\s+(.+))?$/i);
    if (m) {
      const verb = /^refresh/i.test(m[1]) || /^renew/i.test(m[1]) ? '갱신' : '초기화';
      const freqMap = { daily: '매일', weekly: '매주', hourly: '매시간', monthly: '매월' };
      const freq = freqMap[m[2].toLowerCase()] || m[2];
      const timePart = m[3] ? ` ${translateTimeExpr(m[3])}에` : '';
      return `${freq}${timePart} ${verb}` + (hasDot ? '.' : '');
    }

    // 4. Reset / Refresh on / at <date/time>
    m = body.match(/^(Resets?|Refreshes|Renews?)\s+(?:on|at)\s+(.+)$/i);
    if (m) {
      const verb = /^refresh/i.test(m[1]) || /^renew/i.test(m[1]) ? '갱신' : '초기화';
      return `${translateTimeExpr(m[2])}에 ${verb}` + (hasDot ? '.' : '');
    }

    // 5. Window limits: "5-hour limit", "Five Hour Limit Remaining", "Weekly Limit Remaining", "Gemini 4 Argon Weekly Limit", etc.
    const bodyWithDigits = body.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten|twelve)\b/gi, (w) => WORD_NUM_MAP[w.toLowerCase()] || w);
    m = bodyWithDigits.match(/^(?:(.+?)\s+)?(\d+)\s*(?:-|\s)?(hour|hr|hrs|h|day|days|d|week|weeks|wk|w|minute|minutes|min|m)\s*(?:rolling\s+)?(limit|quota|window|cap)(?:\s+(remaining|left))?$/i);
    if (m) {
      const prefix = m[1] ? translateModelSubject(m[1]) + ' ' : '';
      const num = m[2];
      const u = m[3].toLowerCase();
      const kind = /window/i.test(m[4]) ? '기준' : '한도';
      const rem = m[5] ? '남은 ' : '';
      const unitKo = u.startsWith('h') ? '시간' : u.startsWith('d') ? '일' : u.startsWith('w') ? '주' : '분';
      return `${prefix}${rem}${num}${unitKo} ${kind}`;
    }

    m = bodyWithDigits.match(/^(?:(.+?)\s+)?(Daily|Weekly|Monthly|Hourly|Session|Rolling|Standalone|Separate|Individual|Shared|Dedicated)\s+(limit|quota|cap)(?:\s+(remaining|left))?$/i);
    if (m) {
      const prefix = m[1] ? translateModelSubject(m[1]) + ' ' : '';
      const k = m[2].toLowerCase();
      const rem = m[4] ? '남은 ' : '';
      const map = {
        daily: '일일 한도',
        weekly: '주간 한도',
        monthly: '월간 한도',
        hourly: '시간당 한도',
        session: '세션 한도',
        rolling: '롤링 한도',
        standalone: '단독 한도',
        separate: '별도 한도',
        individual: '개별 한도',
        shared: '공유 한도',
        dedicated: '전용 한도',
      };
      if (map[k]) return `${prefix}${rem}${map[k]}`;
    }

    // 5b. Status sentences from retrieveUserQuotaSummary bucket descriptions:
    // - "You have used some of your weekly limit, it will fully refresh in 6 days, 17 hours."
    // - "You have hit your weekly limit, it refreshes in 6 days, 16 hours."
    // - "You have hit your weekly limit, the 5-hour limit does not currently apply."
    // - "Your weekly limit will fully refresh in 6 days, 16 hours."
    // - "If on a supported paid plan, you can use AI credits in the interim or upgrade to a higher tier."
    m = body.match(/^You\s+have\s+used\s+some\s+of\s+your\s+(.+?),\s*it\s+(?:will\s+)?(fully\s+)?(?:refresh(?:es)?|reset(?:s)?|renew(?:s)?)\s+in\s+(.+)$/i);
    if (m) {
      const lim = normalizeLimitName(m[1]);
      const fullKo = m[2] ? '전부 ' : '';
      const dur = translateDurationExpr(m[3]) || m[3];
      return `${lim}의 일부를 사용했으며, ${dur} 후 ${fullKo}갱신됩니다` + (hasDot ? '.' : '');
    }

    m = body.match(/^You\s+have\s+(?:hit|reached|exhausted)\s+your\s+(.+?),\s*it\s+(?:will\s+)?(fully\s+)?(?:refresh(?:es)?|reset(?:s)?|renew(?:s)?)\s+in\s+(.+)$/i);
    if (m) {
      const lim = normalizeLimitName(m[1]);
      const fullKo = m[2] ? '전부 ' : '';
      const dur = translateDurationExpr(m[3]) || m[3];
      return `${lim}에 도달했으며, ${dur} 후 ${fullKo}갱신됩니다` + (hasDot ? '.' : '');
    }

    m = body.match(/^You\s+have\s+(?:hit|reached|exhausted)\s+your\s+(.+?),\s*(?:the\s+)?(.+?)\s+does\s+not\s+currently\s+apply$/i);
    if (m) {
      const lim1 = normalizeLimitName(m[1]);
      const lim2 = normalizeLimitName(m[2]);
      return `${lim1}에 도달하여 현재 ${lim2}는 적용되지 않습니다` + (hasDot ? '.' : '');
    }

    m = body.match(/^Your\s+(.+?)\s+(?:will\s+)?(fully\s+)?(?:refresh(?:es)?|reset(?:s)?|renew(?:s)?)\s+in\s+(.+)$/i);
    if (m) {
      const lim = normalizeLimitName(m[1]);
      const fullKo = m[2] ? '전부 ' : '';
      const dur = translateDurationExpr(m[3]) || m[3];
      return `${lim}는 ${dur} 후 ${fullKo}갱신됩니다` + (hasDot ? '.' : '');
    }

    m = body.match(/^If\s+on\s+a\s+supported\s+paid\s+plan,\s*you\s+can\s+use\s+AI\s+credits\s+in\s+the\s+interim\s+or\s+upgrade\s+to\s+a\s+higher\s+tier$/i);
    if (m) {
      return '지원되는 유료 요금제를 사용 중인 경우, 그동안 AI 크레딧을 사용하거나 상위 등급으로 업그레이드할 수 있습니다' + (hasDot ? '.' : '');
    }

    m = body.match(/^You\s+can\s+use\s+AI\s+credits\s+in\s+the\s+interim\s+or\s+upgrade\s+to\s+a\s+higher\s+tier$/i);
    if (m) {
      return '그동안 AI 크레딧을 사용하거나 상위 등급으로 업그레이드할 수 있습니다' + (hasDot ? '.' : '');
    }

    // 6. Standalone / Separate / Individual / Shared quota clauses
    m = body.match(/^(?:Quota\s+(?:is\s+)?|Limits?\s+(?:are\s+)?)?shared\s+(?:across|between|among|by|with|for)\s+(.+)$/i);
    if (m) {
      return `${translateModelSubject(m[1])}에서 한도 공유` + (hasDot ? '.' : '');
    }

    m = body.match(/^(Standalone|Separate|Individual|Dedicated)\s+(?:usage\s+)?(?:quota|limit)(?:\s+(?:for|on|of)\s+(.+))?$/i);
    if (m) {
      const kindKo = /^standalone/i.test(m[1]) ? '단독 한도' : /^separate/i.test(m[1]) ? '별도 한도' : /^individual/i.test(m[1]) ? '개별 한도' : '전용 한도';
      if (!m[2]) return kindKo + (hasDot ? '.' : '');
      return `${translateModelSubject(m[2])} ${kindKo}` + (hasDot ? '.' : '');
    }

    m = body.match(/^(.+?)\s+(?:standalone|separate|individual|dedicated)\s+(?:usage\s+)?(quota|limit)$/i);
    if (m) {
      const rawKind = body.match(/\b(standalone|separate|individual|dedicated)\b/i)[1].toLowerCase();
      const kindKo = rawKind === 'standalone' ? '단독 한도' : rawKind === 'separate' ? '별도 한도' : rawKind === 'individual' ? '개별 한도' : '전용 한도';
      return `${translateModelSubject(m[1])} ${kindKo}` + (hasDot ? '.' : '');
    }

    m = body.match(/^(.+?)\s+(?:has|have|uses?|is\s+on)\s+(?:a|an|its\s+own|their\s+own)?\s*(standalone|separate|individual|dedicated|independent)\s+(?:usage\s+)?(quota|limit)s?(?:\s+from\s+(.+))?$/i);
    if (m) {
      const subj = translateModelSubject(m[1]);
      const rawKind = m[2].toLowerCase();
      const kindKo = rawKind === 'standalone' ? '단독 한도' : rawKind === 'individual' ? '개별 한도' : '별도 한도';
      if (m[4]) {
        return `${subj} 모델은 ${translateModelSubject(m[4])}과(와) 구분되는 ${kindKo}가 적용됩니다` + (hasDot ? '.' : '');
      }
      return `${subj}에는 ${kindKo}가 적용됩니다` + (hasDot ? '.' : '');
    }

    m = body.match(/^Does not count toward(?:s)?\s+(.+?)(?:\s+quota|\s+limit)?$/i);
    if (m) {
      return `${translateModelSubject(m[1])} 한도에 합산되지 않습니다` + (hasDot ? '.' : '');
    }

    m = body.match(/^(?:Applies\s+to|Used\s+by|Includes?|Covers?|For)\s+(.+)$/i);
    if (m && /gemini|claude|gpt|argon|model|quota|limit/i.test(m[1])) {
      const prefix = /^include/i.test(body) ? '포함 모델: ' : '적용 대상: ';
      return `${prefix}${translateModelSubject(m[1])}` + (hasDot ? '.' : '');
    }

    // 7. Model group titles with parentheticals e.g. "Argon (Standalone quota)" or "Claude & GPT (Shared)"
    m = body.match(/^(.+?)\s*\((.+)\)$/);
    if (m && /gemini|claude|gpt|argon|standalone|separate|individual|shared|quota|limit|hour|daily|weekly/i.test(body)) {
      const left = translateSingleQuotaClause(m[1]) || translateModelSubject(m[1]);
      const right = translateSingleQuotaClause(m[2]) || translateModelSubject(m[2]);
      if (left !== m[1] || right !== m[2]) {
        return `${left} (${right})`;
      }
    }

    // 8. Fallback for phrases containing Claude & GPT or standalone quota
    if (/claude\s*(?:and|&|\/)\s*gpt|standalone\s+(?:quota|limit)|separate\s+(?:quota|limit)|individual\s+(?:quota|limit)/i.test(body)) {
      const replaced = translateModelSubject(body);
      if (replaced !== body) return replaced + (hasDot ? '.' : '');
    }

    return null;
  }

  function translateQuotaProseFallback(str) {
    if (!str) return null;
    if (!/gemini|claude|gpt|argon|quota|limit|reset|refresh|renew|shared|standalone|separate|individual|dedicated|exclusive|window|rolling|hourly|daily|weekly|monthly|credit|overage|remaining|\bleft\b|\bused\b/i.test(str)) {
      return null;
    }
    let s = str;
    // Full-sentence & clause patterns inside prose
    s = s.replace(/\b(?:Usage\s+)?(?:quota|limits?)\s+(?:is|are)\s+shared\s+(?:across|between|among)\s+all\s+Gemini\s+models\s+(?:except|excluding)\s+(?:Gemini\s+4\s+)?Argon\b/gi,
      (m) => /Gemini 4/i.test(m) ? 'Gemini 4 Argon을 제외한 모든 Gemini 모델에서 할당량이 공유됩니다' : 'Argon을 제외한 모든 Gemini 모델에서 할당량이 공유됩니다');
    s = s.replace(/\bShared\s+(?:across|between|among)\s+all\s+Gemini\s+models\s+(?:except|excluding)\s+(?:Gemini\s+4\s+)?Argon\b/gi,
      (m) => /Gemini 4/i.test(m) ? 'Gemini 4 Argon을 제외한 모든 Gemini 모델에서 공유됨' : 'Argon을 제외한 모든 Gemini 모델에서 공유됨');
    s = s.replace(/\b(?:Usage\s+)?(?:quota|limits?)\s+(?:is|are)\s+shared\s+(?:across|between|among)\s+(?:all\s+)?Gemini\s+models\b/gi, '모든 Gemini 모델에서 할당량이 공유됩니다');
    s = s.replace(/\bShared\s+(?:across|between|among)\s+(?:all\s+)?Gemini\s+models\b/gi, '모든 Gemini 모델에서 공유됨');
    s = s.replace(/\b(?:Usage\s+)?(?:quota|limits?)\s+(?:is|are)\s+shared\s+(?:across|between|among)\s+(?:all\s+)?Claude\s*(?:and|&|\/)\s*GPT\s+models\b/gi, '모든 Claude 및 GPT 모델에서 할당량이 공유됩니다');
    s = s.replace(/\bShared\s+(?:across|between|among)\s+(?:all\s+)?Claude\s*(?:and|&|\/)\s*GPT\s+models\b/gi, '모든 Claude 및 GPT 모델에서 공유됨');
    s = s.replace(/\b(?:Gemini\s+4\s+)?Argon\s+(?:has|uses)\s+(?:its\s+own\s+|a\s+)?standalone\s+(?:usage\s+)?(?:quota|limit)(?:\s+separate\s+from\s+other\s+Gemini\s+models)?\b/gi,
      (m) => (/Gemini 4/i.test(m) ? 'Gemini 4 Argon' : 'Argon') + (/other Gemini/i.test(m) ? '은(는) 다른 Gemini 모델과 별도의 단독 한도가 적용됩니다' : '은(는) 단독 한도가 적용됩니다'));
    s = s.replace(/\b(?:Resets?|Refreshes|Renews?)\s+in\s+(<\s*1\s*m(?:in(?:ute)?s?)?|(?:(?:\d+)\s*(?:days?|d|hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s|weeks?|wks?|wk|w)\s*)+)/gi,
      (full, verb, durStr) => {
        const vKo = /^refresh/i.test(full) || /^renew/i.test(full) ? '갱신' : '초기화';
        const dKo = translateDurationExpr(durStr);
        return dKo ? `${dKo} 후 ${vKo}` : full;
      });
    s = s.replace(/\b(?:Resets?|Refreshes|Renews?)\s+every\s+(\d+)\s*(hours?|hrs?|hr|h|days?|d|weeks?|wks?|wk|w|minutes?|mins?|min|m)\b/gi,
      (full, num, unit) => {
        const vKo = /^refresh/i.test(full) || /^renew/i.test(full) ? '갱신' : '초기화';
        const u = unit.toLowerCase();
        const uKo = u.startsWith('h') ? '시간' : u.startsWith('d') ? '일' : u.startsWith('w') ? '주' : '분';
        return `${num}${uKo}마다 ${vKo}`;
      });
    s = s.replace(/\b(?:Resets?|Refreshes|Renews?)\s+(daily|weekly|hourly|monthly)\b/gi,
      (full, freq) => {
        const vKo = /^refresh/i.test(full) || /^renew/i.test(full) ? '갱신' : '초기화';
        const fMap = { daily: '매일', weekly: '매주', hourly: '매시간', monthly: '매월' };
        return `${fMap[freq.toLowerCase()] || freq} ${vKo}`;
      });
    s = s.replace(/\b(\d+)\s*(?:-|\s)?(hour|hr|hrs|h|day|days|d|week|weeks|wk|w|minute|minutes|min|m)\s+(?:rolling\s+)?(limit|quota|window)\b/gi,
      (_, num, unit, kind) => {
        const u = unit.toLowerCase();
        const uKo = u.startsWith('h') ? '시간' : u.startsWith('d') ? '일' : u.startsWith('w') ? '주' : '분';
        return `${num}${uKo} ${/window/i.test(kind) ? '기준' : '한도'}`;
      });
    s = s.replace(/\b(\d+(?:\.\d+)?)%\s*(left|remaining)\b/gi, '$1% 남음');
    s = s.replace(/\b(\d+(?:\.\d+)?)%\s*used\b/gi, '$1% 사용됨');
    s = s.replace(/\bClaude\s*(?:and|&|\/)\s*GPT\s+models\b/gi, 'Claude 및 GPT 모델');
    s = s.replace(/\bClaude\s*(?:and|&|\/)\s*GPT\b/gi, 'Claude 및 GPT');
    s = s.replace(/\bArgon\s+standalone\s+(?:quota|limit)\b/gi, 'Argon 단독 한도');
    s = s.replace(/\bStandalone\s+quota\s+for\s+((?:Gemini\s+4\s+)?Argon)\b/gi, '$1 전용 단독 한도');
    s = s.replace(/\bSeparate\s+quota\s+for\s+((?:Gemini\s+4\s+)?Argon)\b/gi, '$1 전용 별도 한도');
    s = s.replace(/\bStandalone\s+(?:usage\s+)?(?:quota|limit)\b/gi, '단독 한도');
    s = s.replace(/\bSeparate\s+(?:usage\s+)?(?:quota|limit)\b/gi, '별도 한도');
    s = s.replace(/\bIndividual\s+(?:usage\s+)?(?:quota|limit)\b/gi, '개별 한도');
    s = s.replace(/\bShared\s+(?:usage\s+)?(?:quota|limit)\b/gi, '공유 한도');
    return s !== str ? s : null;
  }

  function translateQuotaOrModelDynamic(core) {
    // Handle compound strings joined by separators ("5h limit · Resets in 2h 15m", "Argon — Standalone quota", multi-sentence descriptions, etc.)
    const sepRe = /(\s*(?:·|•|\||—|–|\/)\s*|\s+-\s+|\.\s+|\n+)/;
    if (sepRe.test(core)) {
      const parts = core.split(sepRe);
      let changed = false;
      const out = parts.map((part, idx) => {
        if (idx % 2 === 1) return part; // separator
        const trimmed = part.trim();
        if (!trimmed) return part;
        const tr = exact.get(trimmed) || translateSingleQuotaClause(trimmed) || translateQuotaProseFallback(trimmed);
        if (tr && tr !== trimmed) {
          changed = true;
          return part.replace(trimmed, tr);
        }
        return part;
      });
      if (changed) return out.join('');
    }

    const direct = translateSingleQuotaClause(core);
    if (direct) return direct;

    const durDirect = translateDurationExpr(core);
    if (durDirect) return durDirect;

    return translateQuotaProseFallback(core);
  }

  function translateString(raw) {
    if (typeof raw !== 'string' || raw.length < 2 || raw.length > 800) return null;
    if (!/[A-Za-z]{2,}|\d+\s*[smhdw]\b/i.test(raw)) return null;

    if (exact.has(raw)) return exact.get(raw);

    const m = raw.match(/^(\s*)([\s\S]*?)(\s*)$/);
    if (!m) return null;
    const [, lead, core, trail] = m;
    if (!core) return null;

    if (exact.has(core)) {
      return lead + exact.get(core) + trail;
    }

    if (cache.has(core)) {
      const cached = cache.get(core);
      return cached ? lead + cached + trail : null;
    }

    let result = null;

    if (core.endsWith('...') || core.endsWith('…')) {
      const suffix = core.endsWith('...') ? '...' : '…';
      const stem = core.slice(0, core.length - suffix.length).trimEnd();
      if (exact.has(stem)) {
        result = exact.get(stem) + suffix;
      }
    } else if (core.endsWith(':') && core.length > 2) {
      const stem = core.slice(0, -1).trimEnd();
      if (exact.has(stem)) {
        result = exact.get(stem) + ':';
      }
    } else if (core.startsWith('+ ') && core.length > 3) {
      const stem = core.slice(2).trim();
      if (exact.has(stem)) {
        result = '+ ' + exact.get(stem);
      }
    }

    if (!result) {
      for (let i = 0; i < compiledPatterns.length; i++) {
        const [re, rep] = compiledPatterns[i];
        const match = re.exec(core);
        if (match) {
          result = rep.replace(/\$(\d+)/g, (_, idxStr) => {
            const val = match[Number(idxStr)];
            if (val === undefined) return '';
            const trimmed = val.trim();
            if (exact.has(trimmed)) {
              return val.replace(trimmed, exact.get(trimmed));
            }
            const dyn = translateSingleQuotaClause(trimmed);
            if (dyn) {
              return val.replace(trimmed, dyn);
            }
            return val;
          });
          break;
        }
      }
    }

    if (!result) {
      result = translateQuotaOrModelDynamic(core);
    }

    if (cache.size >= MAX_CACHE) cache.clear();
    cache.set(core, result);
    return result ? lead + result + trail : null;
  }

  function translateMenuItems(items) {
    if (!Array.isArray(items)) return items;
    return items.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const copy = { ...item };
      if (typeof copy.label === 'string') {
        const tr = translateString(copy.label);
        if (tr) copy.label = tr;
      }
      if (Array.isArray(copy.submenu)) {
        copy.submenu = translateMenuItems(copy.submenu);
      }
      return copy;
    });
  }

  return {
    version: (rawDict && rawDict.version) || '1.0.0',
    exact,
    compiledPatterns,
    translateString,
    translateMenuItems,
  };
}

function installRendererLocalization(ipcRenderer, contextBridge, inlineDict) {
  const g = globalThis;
  if (!g.document) return null;
  if (g.__agyKoInstalled) return g.__agyKoInstalled;

  const STORAGE_KEY = 'agy_ko_enabled';
  const { translateString, translateMenuItems, version } = createTranslator(inlineDict || {});

  let enabled = true;
  try {
    const saved = g.localStorage?.getItem(STORAGE_KEY);
    if (saved === 'false' || saved === '0') enabled = false;
  } catch (_) {}

  const SKIP_SELECTOR = [
    '[data-testid="user-message-content"]',
    '[data-testid="planner-response-text"]',
    '[data-testid="transcript-line-text"]',
    '[data-testid="markdown-code-block-preview"]',
    '[data-testid="markdown-frontmatter"]',
    '[contenteditable="true"]',
    '[contenteditable=""]',
    '[role="textbox"]',
    'pre',
    'code',
    'kbd',
    'samp',
    'var',
    'script',
    'style',
    'textarea',
    'svg',
    'math',
    '.katex',
    '.monaco-editor',
    '.xterm',
    '.cm-editor',
    '.prismjs',
    '.material-symbols-outlined',
    '.material-symbols-rounded',
    '.material-symbols-sharp',
    '.material-icons',
    '.codicon',
    '[data-icon]',
    '[data-ko-skip]',
  ].join(',');

  const SKIP_TAGS = new Set([
    'PRE', 'CODE', 'KBD', 'SAMP', 'VAR', 'SCRIPT', 'STYLE', 'TEXTAREA', 'SVG', 'MATH', 'NOSCRIPT',
  ]);

  const ATTRS = ['placeholder', 'title', 'aria-label', 'data-tooltip', 'data-tooltip-content'];

  const textMeta = new WeakMap();
  const attrMeta = new WeakMap();
  const trackedTextNodes = new Set();
  const trackedElements = new Set();

  let isApplying = false;

  function shouldSkipElement(el) {
    if (!el || el.nodeType !== 1) return true;
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.isContentEditable) return true;
    if (typeof el.closest === 'function' && el.closest(SKIP_SELECTOR)) return true;
    return false;
  }

  function processTextNode(node) {
    if (!enabled || !node || node.nodeType !== 3) return;
    const parent = node.parentElement;
    if (!parent || shouldSkipElement(parent)) return;

    const cur = node.nodeValue;
    if (!cur || !/[A-Za-z]{2,}|\d+\s*[smhdw]\b/i.test(cur)) return;

    const meta = textMeta.get(node);
    if (meta && cur === meta.ko) return;

    const orig = meta && cur === meta.orig ? meta.orig : cur;
    let ko;
    if (orig.trim() === 'New' && typeof parent.closest === 'function' && parent.closest('[data-testid="sidecar-new-button"]')) {
      ko = orig.replace('New', '새로 만들기');
    } else {
      ko = translateString(orig);
    }
    if (ko && ko !== orig) {
      isApplying = true;
      try {
        textMeta.set(node, { orig, ko });
        trackedTextNodes.add(node);
        node.nodeValue = ko;
      } finally {
        isApplying = false;
      }
    }
  }

  function processElementAttrs(el) {
    if (!enabled || !el || el.nodeType !== 1) return;
    if (SKIP_TAGS.has(el.tagName)) return;
    if (typeof el.closest === 'function' && el.closest('[data-testid="user-message-content"],[data-testid="planner-response-text"],[data-testid="transcript-line-text"],pre,code,.monaco-editor,.xterm')) {
      return;
    }

    for (let i = 0; i < ATTRS.length; i++) {
      const attr = ATTRS[i];
      if (!el.hasAttribute?.(attr)) continue;
      const cur = el.getAttribute(attr);
      if (!cur || !/[A-Za-z]{2,}|\d+\s*[smhdw]\b/i.test(cur)) continue;

      let map = attrMeta.get(el);
      const meta = map?.get(attr);
      if (meta && cur === meta.ko) continue;

      const orig = meta && cur === meta.orig ? meta.orig : cur;
      const ko = translateString(orig);
      if (ko && ko !== orig) {
        if (!map) {
          map = new Map();
          attrMeta.set(el, map);
        }
        map.set(attr, { orig, ko });
        trackedElements.add(el);
        isApplying = true;
        try {
          el.setAttribute(attr, ko);
        } finally {
          isApplying = false;
        }
      }
    }
  }

  function walkAndTranslate(root) {
    if (!enabled || !root) return;
    if (root.nodeType === 3) {
      processTextNode(root);
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) {
      processElementAttrs(root);
      if (shouldSkipElement(root)) return;
    }

    const doc = g.document;
    if (!doc?.createTreeWalker) return;

    const walker = doc.createTreeWalker(
      root,
      5,
      {
        acceptNode(node) {
          if (node.nodeType === 1) {
            processElementAttrs(node);
            if (shouldSkipElement(node)) return 2;
            return 3;
          }
          return 1;
        },
      }
    );

    let n;
    while ((n = walker.nextNode())) {
      processTextNode(n);
    }
  }

  function restoreOriginalAll() {
    isApplying = true;
    try {
      for (const node of trackedTextNodes) {
        const meta = textMeta.get(node);
        if (meta && node.nodeValue === meta.ko) {
          node.nodeValue = meta.orig;
        }
      }
      for (const el of trackedElements) {
        const map = attrMeta.get(el);
        if (!map) continue;
        for (const [attr, meta] of map.entries()) {
          if (el.getAttribute?.(attr) === meta.ko) {
            el.setAttribute(attr, meta.orig);
          }
        }
      }
    } finally {
      isApplying = false;
    }
  }

  function showToast(msg) {
    try {
      const doc = g.document;
      if (!doc?.body) return;
      let el = doc.getElementById('agy-ko-toast');
      if (!el) {
        el = doc.createElement('div');
        el.id = 'agy-ko-toast';
        el.setAttribute('data-ko-skip', 'true');
        el.style.cssText = [
          'position:fixed',
          'bottom:20px',
          'right:20px',
          'z-index:2147483647',
          'padding:10px 16px',
          'border-radius:8px',
          'background:rgba(24,24,27,0.94)',
          'color:#fafafa',
          'font-family:system-ui,-apple-system,"Malgun Gothic","Apple SD Gothic Neo",sans-serif',
          'font-size:13px',
          'font-weight:500',
          'box-shadow:0 8px 24px rgba(0,0,0,0.35)',
          'border:1px solid rgba(255,255,255,0.12)',
          'pointer-events:none',
          'transition:opacity 0.2s ease, transform 0.2s ease',
          'opacity:0',
          'transform:translateY(6px)',
        ].join(';');
        doc.body.appendChild(el);
      }
      el.textContent = msg;
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
      clearTimeout(el.__hideTimer);
      el.__hideTimer = setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(6px)';
      }, 2200);
    } catch (_) {}
  }

  function updateSettingsBadge() {
    try {
      const doc = g.document;
      const titleEl = doc?.getElementById('agy-ko-app-lang-title');
      if (titleEl) {
        titleEl.textContent = enabled ? '표시 언어 (Display Language)' : 'Display Language (표시 언어)';
      }
      const descEl = doc?.getElementById('agy-ko-app-lang-desc');
      if (descEl) {
        descEl.textContent = enabled
          ? '인터페이스에 사용할 언어를 선택합니다. (단축키: Ctrl+Alt+K)'
          : 'Select the language used across the interface. (Shortcut: Ctrl+Alt+K)';
      }
      const selEl = doc?.getElementById('agy-ko-app-lang-select');
      if (selEl) {
        selEl.value = enabled ? 'ko' : 'en';
      }
      renderQuotaGauges();
    } catch (_) {}
  }

  // --- ChatGPT-style Dual-Arc Model Quota Gauges (Gemini / Claude / Argon) ---
  const QUOTA_CACHE_KEY = 'agy_ko_quota_summary_v2';
  let quotaState = {
    gemini: { fiveHour: null, weekly: null },
    claude: { fiveHour: null, weekly: null },
    argon: { fiveHour: null, weekly: null },
    updatedAt: 0,
  };
  try {
    const savedQ = g.localStorage?.getItem(QUOTA_CACHE_KEY);
    if (savedQ) {
      const parsed = JSON.parse(savedQ);
      if (parsed && typeof parsed === 'object') {
        quotaState = { ...quotaState, ...parsed };
        if (quotaState.argon) quotaState.argon.fiveHour = null;
      }
    } else {
      const oldQ = g.localStorage?.getItem('agy_ko_quota_summary_v1');
      if (oldQ) {
        const parsedOld = JSON.parse(oldQ);
        if (parsedOld && typeof parsedOld === 'object') {
          if (parsedOld.gemini) quotaState.gemini = parsedOld.gemini;
          if (parsedOld.claude) quotaState.claude = parsedOld.claude;
          if (parsedOld.argon) {
            const aw =
              typeof parsedOld.argon.weekly === 'number'
                ? parsedOld.argon.weekly
                : typeof parsedOld.argon.fiveHour === 'number'
                ? parsedOld.argon.fiveHour
                : null;
            quotaState.argon = { fiveHour: null, weekly: aw };
          }
        }
      }
    }
  } catch (_) {}

  function saveQuotaState() {
    try {
      g.localStorage?.setItem(QUOTA_CACHE_KEY, JSON.stringify(quotaState));
    } catch (_) {}
  }

  function classifyQuotaGroup(name) {
    const s = String(name || '').toLowerCase();
    if (s.includes('argon')) return 'argon';
    if (s.includes('claude') || s.includes('gpt')) return 'claude';
    if (s.includes('gemini')) return 'gemini';
    return null;
  }

  function classifyQuotaBucket(labelOrWindow) {
    const s = String(labelOrWindow || '').toLowerCase();
    if (
      /(?:^|\b)(?:5\s*h|5\s*-?\s*hour|five\s*hour|5\s*시간)/.test(s) ||
      s === '5h' ||
      s === 'five_hour' ||
      s === 'fivehour'
    ) {
      return 'fiveHour';
    }
    if (s.includes('week') || s.includes('7d') || s.includes('주간') || s.includes('daily') || s.includes('일일')) {
      return 'weekly';
    }
    return null;
  }

  function parseQuotaResponseObj(obj) {
    try {
      const groups =
        obj?.response?.groups ||
        obj?.groups ||
        obj?.summary?.response?.groups ||
        obj?.summary?.groups ||
        obj?.result?.response?.groups;
      if (!Array.isArray(groups) || groups.length === 0) return false;
      let updated = false;
      for (const grp of groups) {
        const gKey = classifyQuotaGroup(grp?.displayName);
        if (!gKey || !Array.isArray(grp?.buckets)) continue;
        for (const b of grp.buckets) {
          let bKey = classifyQuotaBucket(b?.window || b?.displayName || b?.bucketId);
          if (gKey === 'argon') {
            bKey = 'weekly';
          } else if (!bKey && grp.buckets.length === 1) {
            bKey = 'weekly';
          }
          if (!bKey) continue;
          let frac = null;
          if (typeof b?.remainingFraction === 'number') {
            frac = b.remainingFraction;
          } else if (b?.remaining?.case === 'remainingFraction' && typeof b.remaining.value === 'number') {
            frac = b.remaining.value;
          } else if (typeof b?.remaining_fraction === 'number') {
            frac = b.remaining_fraction;
          }
          if (frac === null && b?.disabled) {
            frac = 0;
          }
          if (typeof frac === 'number' && !Number.isNaN(frac)) {
            quotaState[gKey][bKey] = Math.max(0, Math.min(100, Math.round(frac * 100)));
            updated = true;
          }
        }
      }
      quotaState.argon.fiveHour = null;
      if (updated) {
        quotaState.updatedAt = Date.now();
        saveQuotaState();
        renderQuotaGauges();
      }
      return updated;
    } catch (_) {
      return false;
    }
  }

  function scrapeQuotaFromDom() {
    try {
      const doc = g.document;
      if (!doc) return;
      let changed = false;

      // Scrape from Settings > Models & Usage cards if currently open in DOM
      const spans = doc.querySelectorAll('span, div');
      let currentGroup = null;
      for (let i = 0; i < spans.length; i++) {
        const el = spans[i];
        if (el.closest?.('#agy-ko-quota-bar')) continue;
        if (el.childElementCount > 0) continue;
        const txt = (el.textContent || '').trim();
        if (!txt) continue;

        if (/^(Gemini|Gemini Models|Gemini 모델)$/i.test(txt)) {
          currentGroup = 'gemini';
          continue;
        }
        if (/^(Claude\s*(?:&|and|및)\s*GPT(?:\s*Models|\s*모델)?)$/i.test(txt)) {
          currentGroup = 'claude';
          continue;
        }
        if (/^(Gemini 4 Argon|Argon|Argon 단독 한도|Argon \(단독 한도\))$/i.test(txt)) {
          currentGroup = 'argon';
          continue;
        }

        let bKey = null;
        let explicitGroup = currentGroup;
        if (/argon/i.test(txt) && /(weekly|주간|한도|limit)/i.test(txt)) {
          explicitGroup = 'argon';
          bKey = 'weekly';
        } else if (/^(Weekly Limit Remaining|Weekly limit|주간 한도|남은 주간 한도|주간 한도 Remaining)$/i.test(txt)) {
          bKey = 'weekly';
        } else if (/^(Five Hour Limit Remaining|5-hour limit|5h limit|5시간 한도|남은 5시간 한도|Five Hour Limit)$/i.test(txt)) {
          bKey = 'fiveHour';
        }

        if (bKey && explicitGroup) {
          // Find the row container and look for the percentage badge span ("NN%") or disabled state
          let row = el.parentElement;
          for (let depth = 0; depth < 5 && row; depth++) {
            const pctSpan = Array.from(row.querySelectorAll('span')).find((s) =>
              /^\d{1,3}\s*%$/.test((s.textContent || '').trim())
            );
            if (pctSpan) {
              const rawNum = parseInt((pctSpan.textContent || '').trim(), 10);
              const isInvisible = pctSpan.className && String(pctSpan.className).includes('invisible');
              const val = isInvisible ? 0 : Math.max(0, Math.min(100, rawNum));
              const targetKey = explicitGroup === 'argon' ? 'weekly' : bKey;
              if (quotaState[explicitGroup][targetKey] !== val) {
                quotaState[explicitGroup][targetKey] = val;
                changed = true;
              }
              break;
            }
            const rowTxt = row.textContent || '';
            if (/does not currently apply|현재 적용되지 않습니다/i.test(rowTxt)) {
              const targetKey = explicitGroup === 'argon' ? 'weekly' : bKey;
              if (quotaState[explicitGroup][targetKey] !== 0) {
                quotaState[explicitGroup][targetKey] = 0;
                changed = true;
              }
              break;
            }
            row = row.parentElement;
          }
        }
      }

      if (quotaState.argon.fiveHour !== null) {
        quotaState.argon.fiveHour = null;
        changed = true;
      }

      for (const gk of ['gemini', 'claude']) {
        if (quotaState[gk].weekly === 0 && quotaState[gk].fiveHour === null) {
          quotaState[gk].fiveHour = 0;
          changed = true;
        }
      }

      if (changed) {
        quotaState.updatedAt = Date.now();
        saveQuotaState();
        renderQuotaGauges();
      }
    } catch (_) {}
  }

  let lastQuotaFetchAttempt = 0;
  let isQuotaRefreshing = false;
  let didStartupSilentRefresh = false;

  function fetchQuotaFromLocalEndpoint(force = false) {
    const now = Date.now();
    if (!force && now - lastQuotaFetchAttempt < 15000) return;
    lastQuotaFetchAttempt = now;
    try {
      if (typeof g.fetch !== 'function') return;
      const origin = g.location?.origin || '';
      if (!origin.startsWith('http')) return;
      const endpoints = [
        '/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary',
        '/exa.language_server_pb.LanguageServerService/GetUserQuotaSummary',
      ];
      for (const ep of endpoints) {
        g.fetch(origin + ep, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Connect-Protocol-Version': '1',
          },
          body: JSON.stringify(force ? { forceRefresh: true } : {}),
        })
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => {
            if (data) parseQuotaResponseObj(data);
          })
          .catch(() => {});
      }
    } catch (_) {}
  }

  function findModelsRefreshButton(doc) {
    const btns = doc.querySelectorAll('button');
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      const txt = (b.textContent || '').trim();
      const title = (b.getAttribute('title') || b.getAttribute('aria-label') || '').trim();
      if (
        /^(Refresh|새로고침|새로 고침|갱신)$/i.test(txt) ||
        /^(Refresh|새로고침|새로 고침|갱신)$/i.test(title) ||
        /refresh/i.test(b.getAttribute('data-testid') || '')
      ) {
        return b;
      }
    }
    return null;
  }

  function findCloseSettingsButton(doc) {
    const backTestId = doc.querySelector('[data-testid="settings-back-button"], [data-testid="settings-close-button"]');
    if (backTestId) return backTestId;
    const btns = doc.querySelectorAll('button');
    for (let i = 0; i < btns.length; i++) {
      const b = btns[i];
      const txt = (b.textContent || '').trim();
      if (/^(Back to Agent|Back|에이전트로 돌아가기|돌아가기|뒤로)$/i.test(txt)) {
        return b;
      }
    }
    return null;
  }

  function triggerQuotaRefresh({ silent = false } = {}) {
    if (isQuotaRefreshing) return;
    const doc = g.document;
    if (!doc) return;

    isQuotaRefreshing = true;
    renderQuotaGauges();
    fetchQuotaFromLocalEndpoint(true);

    try {
      g.postMessage?.({ type: 'AGY_KO_TRIGGER_QUOTA_FETCH' }, '*');
    } catch (_) {}

    try {
      // Check if Settings > Models is already open
      const existingModelsNav = doc.querySelector('[data-testid="settings-nav-item-Models"]');
      if (existingModelsNav) {
        existingModelsNav.click();
        setTimeout(() => {
          const refBtn = findModelsRefreshButton(doc);
          if (refBtn && !refBtn.disabled) refBtn.click();
          setTimeout(() => {
            scrapeQuotaFromDom();
            isQuotaRefreshing = false;
            renderQuotaGauges();
          }, 550);
        }, 120);
        return;
      }

      const stBtn = doc.querySelector('[data-testid="settings-button"]');
      if (!stBtn) {
        isQuotaRefreshing = false;
        renderQuotaGauges();
        return;
      }

      // Temporarily suppress visual flash while performing the background Settings > Models refresh
      let cloakStyle = null;
      if (silent) {
        cloakStyle = doc.createElement('style');
        cloakStyle.id = 'agy-ko-silent-refresh-cloak';
        cloakStyle.textContent = `
          body { pointer-events: none !important; }
        `;
        doc.head?.appendChild(cloakStyle);
      }

      stBtn.click();
      setTimeout(() => {
        const modelsNav = doc.querySelector('[data-testid="settings-nav-item-Models"]');
        if (modelsNav) modelsNav.click();

        setTimeout(() => {
          const refBtn = findModelsRefreshButton(doc);
          if (refBtn && !refBtn.disabled) {
            refBtn.click();
          }
          scrapeQuotaFromDom();

          setTimeout(() => {
            scrapeQuotaFromDom();
            const closeBtn = findCloseSettingsButton(doc);
            if (closeBtn) {
              closeBtn.click();
            } else {
              // Dispatch Escape if back button wasn't matched
              doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
            }
            if (cloakStyle) cloakStyle.remove();
            setTimeout(() => {
              if (enabled && doc.documentElement) walkAndTranslate(doc.documentElement);
              isQuotaRefreshing = false;
              renderQuotaGauges();
            }, 120);
          }, 520);
        }, 160);
      }, 90);
    } catch (_) {
      const cloak = doc.getElementById('agy-ko-silent-refresh-cloak');
      if (cloak) cloak.remove();
      isQuotaRefreshing = false;
      renderQuotaGauges();
    }
  }

  function installMainWorldQuotaInterceptor() {
    try {
      const doc = g.document;
      if (!doc?.head || doc.getElementById('agy-ko-quota-hook')) return;
      const s = doc.createElement('script');
      s.id = 'agy-ko-quota-hook';
      s.textContent = `(() => {
        if (window.__agyKoQuotaHooked) return;
        window.__agyKoQuotaHooked = true;
        let capturedHeaders = null;
        let autoFetched = false;
        const origFetch = window.fetch;
        const doManualQuotaFetch = (force) => {
          if (typeof origFetch !== 'function' || !capturedHeaders) return;
          const qHeaders = Object.assign({}, capturedHeaders, {
            'Content-Type': 'application/json',
            'Connect-Protocol-Version': '1',
          });
          origFetch('/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary', {
            method: 'POST',
            headers: qHeaders,
            body: JSON.stringify(force ? { forceRefresh: true } : {}),
          }).then((r) => (r.ok ? r.json() : null)).then((data) => {
            if (data) window.postMessage({ type: 'AGY_KO_QUOTA_DATA', payload: data }, '*');
          }).catch(() => {});
        };
        window.addEventListener('message', (ev) => {
          if (ev && ev.data && ev.data.type === 'AGY_KO_TRIGGER_QUOTA_FETCH') {
            doManualQuotaFetch(true);
          }
        });
        if (typeof origFetch === 'function') {
          window.fetch = async function(...args) {
            try {
              const req = args[0];
              const init = args[1] || {};
              const url = String((req && req.url) || req || '');
              if (/LanguageServerService/i.test(url) && !capturedHeaders) {
                const h = {};
                const srcH = init.headers || (req && req.headers);
                if (srcH) {
                  if (typeof srcH.forEach === 'function') {
                    srcH.forEach((v, k) => { h[k] = v; });
                  } else if (typeof srcH === 'object') {
                    Object.assign(h, srcH);
                  }
                }
                capturedHeaders = h;
                if (!autoFetched) {
                  autoFetched = true;
                  setTimeout(() => doManualQuotaFetch(false), 300);
                }
              }
            } catch (_) {}
            const res = await origFetch.apply(this, args);
            try {
              const url = String((args[0] && args[0].url) || args[0] || '');
              if (/QuotaSummary/i.test(url)) {
                res.clone().json().then((data) => {
                  window.postMessage({ type: 'AGY_KO_QUOTA_DATA', payload: data }, '*');
                }).catch(() => {});
              }
            } catch (_) {}
            return res;
          };
        }
      })();`;
      doc.head.appendChild(s);
    } catch (_) {}
  }

  g.addEventListener?.('message', (e) => {
    try {
      if (e?.data?.type === 'AGY_KO_QUOTA_DATA' && e.data.payload) {
        parseQuotaResponseObj(e.data.payload);
      }
    } catch (_) {}
  });

  function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = ((angleDeg - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  function describeArcCW(cx, cy, r, startDeg, sweepDeg) {
    if (sweepDeg <= 0.1) return '';
    const clamped = Math.min(359.9, sweepDeg);
    const start = polarToCartesian(cx, cy, r, startDeg);
    const end = polarToCartesian(cx, cy, r, startDeg + clamped);
    const largeArc = clamped > 180 ? '1' : '0';
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  }

  function getGaugeCenterIconMarkup(key) {
    if (key === 'gemini') {
      // Gemini 4-point sparkle star icon
      return `<path d="M16 9.6 C16 13.1 18.9 16 22.4 16 C18.9 16 16 18.9 16 22.4 C16 18.9 13.1 16 9.6 16 C13.1 16 16 13.1 16 9.6 Z" fill="currentColor" opacity="0.88"/>`;
    }
    if (key === 'claude') {
      // Claude starburst / sea-urchin rays icon
      const rays = [];
      const count = 10;
      for (let i = 0; i < count; i++) {
        const ang = (i * 360) / count;
        const rad = (ang * Math.PI) / 180;
        const x1 = (16 + 1.6 * Math.cos(rad)).toFixed(2);
        const y1 = (16 + 1.6 * Math.sin(rad)).toFixed(2);
        const x2 = (16 + 5.7 * Math.cos(rad)).toFixed(2);
        const y2 = (16 + 5.7 * Math.sin(rad)).toFixed(2);
        rays.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" opacity="0.88"/>`);
      }
      rays.push(`<circle cx="16" cy="16" r="1.8" fill="currentColor" opacity="0.88"/>`);
      return rays.join('');
    }
    // Argon chemical element symbol "Ar"
    return `<text x="16" y="16.6" text-anchor="middle" dominant-baseline="central" fill="currentColor" opacity="0.9" style="font-size:9.5px;font-weight:800;font-family:var(--agy-ko-font-sans),system-ui,sans-serif;letter-spacing:-0.03em;">Ar</text>`;
  }

  function showQuotaFloatingTooltip(anchorEl, text) {
    try {
      const doc = g.document;
      if (!doc?.body) return;
      let tip = doc.getElementById('agy-ko-quota-tooltip');
      if (!tip) {
        tip = doc.createElement('div');
        tip.id = 'agy-ko-quota-tooltip';
        tip.setAttribute('data-ko-skip', 'true');
        tip.style.cssText = [
          'position:fixed',
          'z-index:2147483647',
          'padding:6px 12px',
          'border-radius:10px',
          'background:#18181b',
          'color:#ffffff',
          'font-family:var(--agy-ko-font-sans),system-ui,sans-serif',
          'font-size:12.5px',
          'font-weight:600',
          'letter-spacing:-0.01em',
          'white-space:nowrap',
          'box-shadow:0 6px 20px rgba(0,0,0,0.38)',
          'border:1px solid rgba(255,255,255,0.12)',
          'pointer-events:none',
          'opacity:0',
          'transition:opacity 0.12s ease',
        ].join(';');
        doc.body.appendChild(tip);
      }
      tip.textContent = text;
      const rect = anchorEl.getBoundingClientRect();
      tip.style.opacity = '1';
      const tipRect = tip.getBoundingClientRect();
      let left = rect.right + 8;
      let top = rect.top + (rect.height - tipRect.height) / 2;
      if (left + tipRect.width > g.innerWidth - 12) {
        left = Math.max(8, rect.left + (rect.width - tipRect.width) / 2);
        top = Math.max(8, rect.top - tipRect.height - 8);
      }
      tip.style.left = `${Math.round(left)}px`;
      tip.style.top = `${Math.round(top)}px`;
    } catch (_) {}
  }

  function hideQuotaFloatingTooltip() {
    try {
      const tip = g.document?.getElementById('agy-ko-quota-tooltip');
      if (tip) tip.style.opacity = '0';
    } catch (_) {}
  }

  function renderQuotaGauges() {
    try {
      const doc = g.document;
      if (!doc) return;
      const settingsBtn = doc.querySelector('[data-testid="settings-button"]');
      if (!settingsBtn || !settingsBtn.parentElement) return;

      const parent = settingsBtn.parentElement;
      let bar = doc.getElementById('agy-ko-quota-bar');
      if (!bar) {
        bar = doc.createElement('div');
        bar.id = 'agy-ko-quota-bar';
        bar.setAttribute('data-ko-skip', 'true');
        bar.style.cssText = [
          'display:flex',
          'flex-direction:row',
          'align-items:center',
          'justify-content:flex-start',
          'gap:6px',
          'padding:4px 8px 6px 8px',
          'user-select:none',
        ].join(';');
        settingsBtn.insertAdjacentElement('beforebegin', bar);
      } else if (bar.nextElementSibling !== settingsBtn) {
        parent.insertBefore(bar, settingsBtn);
      }

      const sig = JSON.stringify({
        g5: quotaState.gemini.fiveHour,
        gw: quotaState.gemini.weekly,
        c5: quotaState.claude.fiveHour,
        cw: quotaState.claude.weekly,
        a5: quotaState.argon.fiveHour,
        aw: quotaState.argon.weekly,
        en: enabled,
        ref: isQuotaRefreshing,
      });
      if (bar.getAttribute('data-sig') === sig && bar.childElementCount === 4) {
        return;
      }
      bar.setAttribute('data-sig', sig);

      const specs = [
        {
          key: 'gemini',
          titleKo: 'Gemini',
          titleEn: 'Gemini',
          hasFiveHour: true,
          fiveHour: quotaState.gemini.fiveHour,
          weekly: quotaState.gemini.weekly,
        },
        {
          key: 'claude',
          titleKo: 'Claude 및 GPT',
          titleEn: 'Claude & GPT',
          hasFiveHour: true,
          fiveHour: quotaState.claude.fiveHour,
          weekly: quotaState.claude.weekly,
        },
        {
          key: 'argon',
          titleKo: 'Argon 단독',
          titleEn: 'Argon',
          hasFiveHour: false,
          fiveHour: null,
          weekly: quotaState.argon.weekly,
        },
      ];

      const r = 11.5;
      const cx = 16;
      const cy = 16;
      // Top small arc: -52deg to +52deg (104deg span)
      const topStart = -52;
      const topSpan = 104;
      // Bottom wide arc: +72deg to +288deg (216deg span)
      const botStart = 72;
      const botSpan = 216;

      bar.innerHTML = '';

      for (const item of specs) {
        const btn = doc.createElement('div');
        btn.setAttribute('data-ko-skip', 'true');
        btn.setAttribute('data-quota-model', item.key);
        btn.style.cssText = [
          'position:relative',
          'width:32px',
          'height:32px',
          'border-radius:9px',
          'display:inline-flex',
          'align-items:center',
          'justify-content:center',
          'cursor:pointer',
          'color:var(--foreground, currentColor)',
          'transition:background-color 0.15s ease',
        ].join(';');

        let hoverZone = null; // 'top' | 'bottom'

        const topPct = item.fiveHour !== null ? item.fiveHour : 100;
        const botPct = item.weekly !== null ? item.weekly : 100;
        const topKnown = item.fiveHour !== null;
        const botKnown = item.weekly !== null;

        const buildSvg = () => {
          const topTrackOp = hoverZone === 'bottom' ? 0.14 : 0.22;
          const botTrackOp = item.hasFiveHour && hoverZone === 'top' ? 0.14 : 0.22;
          const topFillOp = hoverZone === 'bottom' ? 0.32 : 0.88;
          const botFillOp = item.hasFiveHour && hoverZone === 'top' ? 0.32 : 0.88;

          const topTrackPath = item.hasFiveHour ? describeArcCW(cx, cy, r, topStart, topSpan) : '';
          const topFillPath =
            item.hasFiveHour && topPct > 0 ? describeArcCW(cx, cy, r, topStart, (topSpan * topPct) / 100) : '';

          const botTrackPath = describeArcCW(cx, cy, r, botStart, botSpan);
          const botFillPath = botPct > 0 ? describeArcCW(cx, cy, r, botStart, (botSpan * botPct) / 100) : '';

          return `
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;">
              ${topTrackPath ? `<path d="${topTrackPath}" stroke="currentColor" stroke-opacity="${topTrackOp}" stroke-width="2.35" stroke-linecap="round" />` : ''}
              ${topFillPath ? `<path d="${topFillPath}" stroke="currentColor" stroke-opacity="${topFillOp}" stroke-width="2.35" stroke-linecap="round" />` : ''}
              <path d="${botTrackPath}" stroke="currentColor" stroke-opacity="${botTrackOp}" stroke-width="2.35" stroke-linecap="round" />
              ${botFillPath ? `<path d="${botFillPath}" stroke="currentColor" stroke-opacity="${botFillOp}" stroke-width="2.35" stroke-linecap="round" />` : ''}
              ${getGaugeCenterIconMarkup(item.key)}
            </svg>
          `;
        };

        btn.innerHTML = buildSvg();

        const updateHover = (e) => {
          const rect = btn.getBoundingClientRect();
          const relY = e.clientY - rect.top;
          const nextZone = item.hasFiveHour && relY < rect.height * 0.43 ? 'top' : 'bottom';
          if (nextZone !== hoverZone) {
            hoverZone = nextZone;
            btn.innerHTML = buildSvg();
          }
          const modelLabel = enabled ? item.titleKo : item.titleEn;
          let tipText;
          if (hoverZone === 'top' && item.hasFiveHour) {
            const fStr = topKnown ? `${topPct}%` : '--%';
            tipText = enabled
              ? `${modelLabel} · 5시간 한도 · ${fStr} 남음`
              : `${modelLabel} · 5-hour limit · ${fStr} left`;
          } else {
            const wStr = botKnown ? `${botPct}%` : '--%';
            tipText = enabled
              ? `${modelLabel} · 주간 한도 · ${wStr} 남음`
              : `${modelLabel} · Weekly limit · ${wStr} left`;
          }
          showQuotaFloatingTooltip(btn, tipText);
        };

        btn.addEventListener('mouseenter', (e) => {
          btn.style.backgroundColor = 'rgba(128,128,128,0.14)';
          fetchQuotaFromLocalEndpoint();
          updateHover(e);
        });
        btn.addEventListener('mousemove', updateHover);
        btn.addEventListener('mouseleave', () => {
          hoverZone = null;
          btn.style.backgroundColor = 'transparent';
          btn.innerHTML = buildSvg();
          hideQuotaFloatingTooltip();
        });
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          hideQuotaFloatingTooltip();
          // Open Settings > Models & Usage on click so user can inspect or refresh full details
          const stBtn = doc.querySelector('[data-testid="settings-button"]');
          if (stBtn) {
            stBtn.click();
            setTimeout(() => {
              const modelsNav = doc.querySelector('[data-testid="settings-nav-item-Models"]');
              if (modelsNav) modelsNav.click();
            }, 80);
          }
        });

        bar.appendChild(btn);
      }

      // 4th button: Refresh icon with matching dual-arc circular scale
      const refreshBtn = doc.createElement('div');
      refreshBtn.setAttribute('data-ko-skip', 'true');
      refreshBtn.setAttribute('data-quota-model', 'refresh');
      refreshBtn.style.cssText = [
        'position:relative',
        'width:32px',
        'height:32px',
        'border-radius:9px',
        'display:inline-flex',
        'align-items:center',
        'justify-content:center',
        'cursor:pointer',
        'color:var(--foreground, currentColor)',
        'transition:background-color 0.15s ease, transform 0.2s ease',
      ].join(';');

      const buildRefreshSvg = (hovered) => {
        const op = hovered || isQuotaRefreshing ? 0.92 : 0.62;
        const spinStyle = isQuotaRefreshing ? 'animation:agy-ko-spin 0.85s linear infinite;transform-origin:16px 16px;' : '';
        // Two curved refresh arcs at radius ~10.5 matching the dual-arc scale
        const arc1 = describeArcCW(16, 16, 10.2, -55, 135);
        const arc2 = describeArcCW(16, 16, 10.2, 125, 135);
        // Arrowheads at end of each arc (80deg and 260deg)
        const end1 = polarToCartesian(16, 16, 10.2, 80);
        const end2 = polarToCartesian(16, 16, 10.2, 260);
        return `
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;overflow:visible;">
            <g style="${spinStyle}" opacity="${op}">
              <path d="${arc1}" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" />
              <path d="M ${(end1.x - 2.8).toFixed(2)} ${(end1.y - 1.9).toFixed(2)} L ${end1.x.toFixed(2)} ${(end1.y + 0.5).toFixed(2)} L ${(end1.x + 2.1).toFixed(2)} ${(end1.y - 2.3).toFixed(2)}" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />
              <path d="${arc2}" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" />
              <path d="M ${(end2.x + 2.8).toFixed(2)} ${(end2.y + 1.9).toFixed(2)} L ${end2.x.toFixed(2)} ${(end2.y - 0.5).toFixed(2)} L ${(end2.x - 2.1).toFixed(2)} ${(end2.y + 2.3).toFixed(2)}" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" />
            </g>
          </svg>
        `;
      };

      refreshBtn.innerHTML = buildRefreshSvg(false);

      refreshBtn.addEventListener('mouseenter', () => {
        refreshBtn.style.backgroundColor = 'rgba(128,128,128,0.14)';
        refreshBtn.innerHTML = buildRefreshSvg(true);
        const tipText = isQuotaRefreshing
          ? enabled
            ? '잔여 한도 새로고침 중...'
            : 'Refreshing quota...'
          : enabled
          ? '모델 잔여 한도 새로고침'
          : 'Refresh model quota';
        showQuotaFloatingTooltip(refreshBtn, tipText);
      });
      refreshBtn.addEventListener('mouseleave', () => {
        refreshBtn.style.backgroundColor = 'transparent';
        refreshBtn.innerHTML = buildRefreshSvg(false);
        hideQuotaFloatingTooltip();
      });
      refreshBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideQuotaFloatingTooltip();
        triggerQuotaRefresh({ silent: false });
      });

      bar.appendChild(refreshBtn);

      if (!didStartupSilentRefresh) {
        didStartupSilentRefresh = true;
        setTimeout(() => {
          const needsInitialSync =
            quotaState.gemini.weekly === null ||
            quotaState.claude.weekly === null ||
            quotaState.argon.weekly === null ||
            Date.now() - (quotaState.updatedAt || 0) > 60000;
          if (needsInitialSync) {
            triggerQuotaRefresh({ silent: true });
          } else {
            fetchQuotaFromLocalEndpoint(true);
          }
        }, 900);
      }
    } catch (_) {}
  }

  function ensureSettingsLanguageRow() {
    try {
      const doc = g.document;
      if (!doc) return;

      // Remove any legacy sidebar/header buttons if present
      const oldSidebarBtn = doc.getElementById('agy-ko-settings-row');
      if (oldSidebarBtn) oldSidebarBtn.remove();
      const oldHdrBtn = doc.getElementById('agy-ko-header-toggle');
      if (oldHdrBtn) oldHdrBtn.remove();

      // Inject Language selector card inside the "Appearance" (대화 형식) settings screen
      // ktb renders: <UP title="Appearance" description="Configure the agent's visual theme and display preferences.">
      const allDesc = doc.querySelectorAll('p, div, span, h1, h2, h3');
      let appearanceHeaderContainer = null;
      for (let i = 0; i < allDesc.length; i++) {
        const el = allDesc[i];
        if (el.childElementCount > 0) continue;
        const txt = (el.textContent || '').trim();
        if (
          txt === "Configure the agent's visual theme and display preferences." ||
          txt === '에이전트의 시각적 테마 및 표시 환경설정을 구성합니다.' ||
          txt === '에이전트의 시각적 테마와 표시 환경설정을 구성합니다.'
        ) {
          // Walk up to find the main content column inside Appearance screen
          let cur = el.parentElement;
          while (cur && cur.parentElement) {
            if (cur.parentElement.children.length >= 2) {
              appearanceHeaderContainer = cur;
              break;
            }
            cur = cur.parentElement;
          }
          break;
        }
      }

      if (!appearanceHeaderContainer || !appearanceHeaderContainer.parentElement) return;
      const screenRoot = appearanceHeaderContainer.parentElement;
      if (screenRoot.querySelector('#agy-ko-appearance-lang-card')) return;

      const card = doc.createElement('div');
      card.id = 'agy-ko-appearance-lang-card';
      card.setAttribute('data-ko-skip', 'true');
      card.style.cssText = [
        'display:flex',
        'align-items:center',
        'justify-content:space-between',
        'gap:16px',
        'padding:14px 16px',
        'margin-bottom:16px',
        'border-radius:10px',
        'border:1px solid rgba(128,128,128,0.22)',
        'background:rgba(128,128,128,0.05)',
      ].join(';');

      const leftCol = doc.createElement('div');
      leftCol.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:0;flex:1;';

      const titleEl = doc.createElement('div');
      titleEl.id = 'agy-ko-app-lang-title';
      titleEl.className = 'text-sm font-medium text-foreground';
      titleEl.textContent = enabled ? '표시 언어 (Display Language)' : 'Display Language (표시 언어)';

      const descEl = doc.createElement('div');
      descEl.id = 'agy-ko-app-lang-desc';
      descEl.className = 'text-xs text-muted-foreground';
      descEl.textContent = enabled
        ? '인터페이스에 사용할 언어를 선택합니다. (단축키: Ctrl+Alt+K)'
        : 'Select the language used across the interface. (Shortcut: Ctrl+Alt+K)';

      leftCol.appendChild(titleEl);
      leftCol.appendChild(descEl);

      const selectEl = doc.createElement('select');
      selectEl.id = 'agy-ko-app-lang-select';
      selectEl.setAttribute('aria-label', '표시 언어 선택');
      selectEl.style.cssText = [
        'padding:6px 12px',
        'border-radius:8px',
        'font-size:13px',
        'font-weight:600',
        'cursor:pointer',
        'border:1px solid rgba(128,128,128,0.32)',
        'background:var(--background, #18181b)',
        'color:var(--foreground, inherit)',
        'outline:none',
        'min-width:140px',
      ].join(';');

      const optKo = doc.createElement('option');
      optKo.value = 'ko';
      optKo.textContent = '한국어 (Korean)';
      optKo.style.cssText = 'background:#18181b;color:#fafafa;';

      const optEn = doc.createElement('option');
      optEn.value = 'en';
      optEn.textContent = 'English (영어)';
      optEn.style.cssText = 'background:#18181b;color:#fafafa;';

      selectEl.appendChild(optKo);
      selectEl.appendChild(optEn);
      selectEl.value = enabled ? 'ko' : 'en';

      selectEl.addEventListener('change', (e) => {
        const nextKo = e.target.value === 'ko';
        if (nextKo !== enabled) {
          setEnabled(nextKo, true);
        }
      });

      card.appendChild(leftCol);
      card.appendChild(selectEl);

      appearanceHeaderContainer.insertAdjacentElement('afterend', card);
    } catch (_) {}
  }

  function injectKoreanStyles() {
    const doc = g.document;
    if (!doc?.head) return;
    if (!doc.getElementById('agy-ko-fonts')) {
      const fontUrls = [
        'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css',
        'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=Noto+Sans+KR:wght@400;500;600;700&display=swap',
      ];
      const frag = doc.createElement('div');
      frag.id = 'agy-ko-fonts';
      for (const href of fontUrls) {
        const link = doc.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        doc.head.appendChild(link);
      }
      doc.head.appendChild(frag);
    }
    if (!doc.getElementById('agy-ko-style')) {
      const style = doc.createElement('style');
      style.id = 'agy-ko-style';
      style.textContent = `
        :root {
          --agy-ko-font-sans: "Pretendard Variable", "Pretendard", "SUIT Variable", "IBM Plex Sans KR", "Noto Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", "맑은 고딕", sans-serif;
        }
        html[lang="ko"] body,
        html[lang="ko"] button,
        html[lang="ko"] input,
        html[lang="ko"] select {
          font-family: var(--agy-ko-font-sans) !important;
          word-break: keep-all;
          font-weight: 500;
          letter-spacing: -0.01em;
          -webkit-text-stroke: 0 !important;
          font-synthesis: weight style;
        }
        html[lang="ko"] .font-light,
        html[lang="ko"] .font-normal {
          font-weight: 500 !important;
        }
        html[lang="ko"] .font-medium {
          font-weight: 600 !important;
        }
        html[lang="ko"] .font-semibold,
        html[lang="ko"] .font-bold,
        html[lang="ko"] h1,
        html[lang="ko"] h2,
        html[lang="ko"] h3,
        html[lang="ko"] h4,
        html[lang="ko"] strong,
        html[lang="ko"] b {
          font-weight: 700 !important;
        }
        @keyframes agy-ko-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      doc.head.appendChild(style);
    }
    if (doc.documentElement) {
      doc.documentElement.lang = enabled ? 'ko' : 'en';
    }
  }

  function setEnabled(next, notify = true) {
    enabled = Boolean(next);
    try {
      g.localStorage?.setItem(STORAGE_KEY, String(enabled));
    } catch (_) {}
    try {
      ipcRenderer?.send?.('ko:set-enabled', enabled);
    } catch (_) {}
    if (g.document?.documentElement) {
      g.document.documentElement.lang = enabled ? 'ko' : 'en';
    }
    if (enabled) {
      walkAndTranslate(g.document?.documentElement);
      if (notify) showToast('한국어 UI가 활성화되었습니다 (단축키: Ctrl+Alt+K)');
    } else {
      restoreOriginalAll();
      if (notify) showToast('English UI enabled (Shortcut: Ctrl+Alt+K)');
    }
    updateSettingsBadge();
    return enabled;
  }

  function toggleEnabled() {
    return setEnabled(!enabled, true);
  }

  const pendingRoots = new Set();
  const pendingAttrs = new Set();
  let rafScheduled = false;

  function flushMutations() {
    rafScheduled = false;
    installMainWorldQuotaInterceptor();
    if (!enabled) {
      pendingRoots.clear();
      pendingAttrs.clear();
      scrapeQuotaFromDom();
      renderQuotaGauges();
      return;
    }
    for (const el of pendingAttrs) {
      processElementAttrs(el);
    }
    pendingAttrs.clear();

    for (const node of pendingRoots) {
      walkAndTranslate(node);
    }
    pendingRoots.clear();
    ensureSettingsLanguageRow();
    scrapeQuotaFromDom();
    renderQuotaGauges();
  }

  function scheduleFlush() {
    if (rafScheduled) return;
    rafScheduled = true;
    const raf = g.requestAnimationFrame || ((fn) => setTimeout(fn, 16));
    raf(flushMutations);
  }

  let observedRoot = null;
  let observer = null;

  function ensureObserverAttached() {
    const doc = g.document;
    const rootEl = doc?.documentElement;
    if (!rootEl || typeof g.MutationObserver !== 'function') return;
    if (!rootEl.hasAttribute('data-agy-ko-ready')) {
      rootEl.setAttribute('data-agy-ko-ready', '1');
    }
    injectKoreanStyles();
    installMainWorldQuotaInterceptor();
    if (observedRoot !== rootEl) {
      observedRoot = rootEl;
      if (observer) {
        try { observer.disconnect(); } catch (_) {}
      }
      observer = new g.MutationObserver((mutations) => {
        if (!enabled) return;
        for (let i = 0; i < mutations.length; i++) {
          const m = mutations[i];
          if (m.type === 'characterData') {
            const node = m.target;
            const meta = textMeta.get(node);
            if (!meta || node.nodeValue !== meta.ko) {
              pendingRoots.add(node);
            }
          } else if (m.type === 'attributes') {
            const el = m.target;
            const attr = m.attributeName;
            const meta = attr ? attrMeta.get(el)?.get(attr) : null;
            if (!meta || el.getAttribute?.(attr) !== meta.ko) {
              pendingAttrs.add(el);
            }
          } else if (m.type === 'childList') {
            if (m.target && (m.target.nodeType === 1 || m.target.nodeType === 11)) {
              pendingRoots.add(m.target);
            }
            const added = m.addedNodes;
            for (let j = 0; j < added.length; j++) {
              const n = added[j];
              if (n.nodeType === 1 || n.nodeType === 3) {
                pendingRoots.add(n);
              }
            }
          }
        }
        if (pendingRoots.size > 0 || pendingAttrs.size > 0) {
          scheduleFlush();
        }
      });
      observer.observe(rootEl, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ATTRS,
      });
    }
    if (enabled) {
      walkAndTranslate(rootEl);
    }
    ensureSettingsLanguageRow();
    scrapeQuotaFromDom();
    renderQuotaGauges();
    fetchQuotaFromLocalEndpoint();
  }

  ensureObserverAttached();
  g.document.addEventListener?.('DOMContentLoaded', () => {
    ensureObserverAttached();
    try { ipcRenderer?.send?.('ko:renderer-ready', { version, enabled }); } catch (_) {}
  });
  g.addEventListener?.('load', ensureObserverAttached);
  // Trigger a fast post-click / post-key / post-navigation sweep so screen transitions (e.g. closing Settings) never leave English strings behind
  g.document.addEventListener?.(
    'click',
    () => {
      setTimeout(() => {
        if (g.document?.documentElement) {
          if (enabled) walkAndTranslate(g.document.documentElement);
          ensureSettingsLanguageRow();
          scrapeQuotaFromDom();
          renderQuotaGauges();
        }
      }, 30);
      setTimeout(() => {
        if (g.document?.documentElement) {
          if (enabled) walkAndTranslate(g.document.documentElement);
          ensureSettingsLanguageRow();
          scrapeQuotaFromDom();
          renderQuotaGauges();
        }
      }, 150);
    },
    true
  );
  // Periodic light check to ensure any delayed React mounts or animations stay localized
  setInterval(() => {
    if (g.document?.documentElement) {
      ensureObserverAttached();
    }
  }, 1200);

  g.addEventListener?.(
    'keydown',
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K' || e.code === 'KeyK')) {
        e.preventDefault();
        e.stopPropagation();
        toggleEnabled();
      }
    },
    true
  );

  try {
    ipcRenderer?.on?.('ko:toggle', () => toggleEnabled());
    ipcRenderer?.on?.('ko:set-enabled', (_event, val) => setEnabled(val, true));
  } catch (_) {}

  const api = {
    version,
    isEnabled: () => enabled,
    setEnabled: (val) => setEnabled(val, true),
    toggle: () => toggleEnabled(),
    translate: (s) => (enabled ? translateString(s) || s : s),
    translateNow: () => walkAndTranslate(g.document?.documentElement),
  };

  try {
    contextBridge?.exposeInMainWorld?.('agyKo', api);
  } catch (_) {
    g.agyKo = api;
  }

  const instance = {
    api,
    isEnabled: () => enabled,
    translateString,
    translateMenuItems: (items) => (enabled ? translateMenuItems(items) : items),
  };
  g.__agyKoInstalled = instance;
  return instance;
}

function loadDictionaryFromDisk() {
  const fs = require('fs');
  const path = require('path');
  const candidates = [
    path.join(__dirname, 'ko-dict.json'),
    path.join(__dirname, '..', 'locales', 'ko.json'),
  ];
  let base = { strings: {}, patterns: [] };
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        base = JSON.parse(fs.readFileSync(p, 'utf8'));
        break;
      }
    } catch (_) {}
  }
  try {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    if (home) {
      const customPath = path.join(home, '.gemini', 'antigravity', 'ko-custom.json');
      if (fs.existsSync(customPath)) {
        const custom = JSON.parse(fs.readFileSync(customPath, 'utf8'));
        const customStrings = custom.strings || custom;
        if (customStrings && typeof customStrings === 'object') {
          Object.assign(base.strings, customStrings);
        }
        if (Array.isArray(custom.patterns)) {
          base.patterns = [...custom.patterns, ...(base.patterns || [])];
        }
      }
    }
  } catch (_) {}
  return base;
}

module.exports = {
  loadDictionaryFromDisk,
  createTranslator,
  installRendererLocalization,
};
