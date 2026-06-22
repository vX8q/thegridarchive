// Latin → Cyrillic transliteration for driver names (fallback when no Wikipedia override).
(function () {
  if (typeof window === 'undefined') return;
  window.TGA_RU = window.TGA_RU || {};

  // French / common motorsport given names — Russian Wikipedia-style (not letter-by-letter).
  var givenNameRu = {
    'pierre': 'Пьер',
    'jean': 'Жан',
    'jacques': 'Жак',
    'jean-jacques': 'Жан-Жак',
    'jean-pierre': 'Жан-Пьер',
    'jean-eric': 'Жан-Эрик',
    'jean-jose': 'Жан-Хосе',
    'louis': 'Луи',
    'charles': 'Шарль',
    'charles-henri': 'Шарль-Анри',
    'henri': 'Анри',
    'henry': 'Генри',
    'marc': 'Марк',
    'herve': 'Эрве',
    'perceval': 'Персиваль',
    'jose': 'Хосе',
    'alexandre': 'Александр',
    'philippe': 'Филипп',
    'william': 'Уильям',
    'james': 'Джеймс',
    'emilian': 'Эмилиан',
    'alejandro': 'Алехандро',
    'lourenzo': 'Лоренсо',
    'nicolas': 'Николя',
    'sebastien': 'Себастьен',
    'aurelien': 'Орельен',
    'antoine': 'Антуан',
    'romain': 'Ромен',
    'francois': 'Франсуа',
    'alain': 'Ален',
    'gilles': 'Жиль',
    'andre': 'Андре',
    'andrea': 'Андреа',
    'thierry': 'Тьерри',
    'yves': 'Ив',
    'rene': 'Рене',
    'olivier': 'Оливье',
    'eric': 'Эрик',
    'etienne': 'Этьен',
    'pierre-alexandre': 'Пьер-Александр',
    'esteban': 'Эстебан',
    'fernando': 'Фернандо',
    'franco': 'Франко',
    'gabriel': 'Габриэль',
    'george': 'Джордж',
    'lance': 'Лэнс',
    'oliver': 'Оливер',
    'isack': 'Исак',
    'max': 'Макс',
    'lando': 'Ландо',
    'kimi': 'Кими',
    // English (motorsport / Wikipedia RU)
    'ryan': 'Райан',
    'kyle': 'Кайл',
    'tyler': 'Тайлер',
    'chase': 'Чейз',
    'casey': 'Кейси',
    'justin': 'Джастин',
    'josh': 'Джош',
    'jake': 'Джейк',
    'chris': 'Крис',
    'austin': 'Остин',
    'carson': 'Карсон',
    'daniel': 'Даниэль',
    'michael': 'Майкл',
    'kevin': 'Кевин',
    'david': 'Дэвид',
    'joey': 'Джоуи',
    'bobby': 'Бобби',
    'corey': 'Кори',
    'cole': 'Коул',
    'ross': 'Росс',
    'noah': 'Ноа',
    'erik': 'Эрик',
    'brad': 'Брэд',
    'martin': 'Мартин',
    'denny': 'Денни',
    'bubba': 'Бабба',
    'jesse': 'Джесси',
    'brandon': 'Брэндон',
    'ben': 'Бен',
    'chandler': 'Чендлер',
    'sheldon': 'Шелдон',
    'taylor': 'Тейлор',
    'tanner': 'Таннер',
    'sam': 'Сэм',
    'sammy': 'Сэмми',
    'frankie': 'Фрэнки',
    'hailie': 'Хейли',
    'jeb': 'Джеб',
    'connor': 'Коннор',
    'garrett': 'Гарретт',
    'parker': 'Паркер',
    'blaine': 'Блейн',
    'bryce': 'Брайс',
    'brendan': 'Брендан',
    'dean': 'Дин',
    'nick': 'Ник',
    'timmy': 'Тимми',
    'mason': 'Мейсон',
    'kaden': 'Кейден',
    'rajah': 'Раджа',
    'anthony': 'Энтони',
    'luke': 'Люк',
    'landen': 'Лэнден',
    'brenden': 'Брендан',
    'tony': 'Тони',
    'clint': 'Клинт',
    'jeff': 'Джефф',
    'dale': 'Дейл',
    'kurt': 'Курт',
    'jimmie': 'Джимми',
    'ty': 'Тай',
    'alex': 'Алекс',
    'william': 'Уильям',
    'john': 'Джон',
    'riley': 'Райли',
    'zane': 'Зейн',
    'shane': 'Шейн',
    'brian': 'Брайан',
    'josef': 'Джозеф',
    'colton': 'Колтон',
    'scott': 'Скотт',
    'marcus': 'Маркус',
    'felix': 'Феликс',
    'graham': 'Грэм',
    'conor': 'Конор',
    'lewis': 'Льюис',
    'jack': 'Джек',
    'liam': 'Лиам',
    'oscar': 'Оскар',
    'sergio': 'Серхио',
    'valtteri': 'Валттери',
    'nico': 'Нико'
  };

  // Established Russian surnames (Wikipedia / domestic usage; not letter-by-letter).
  var surnameRu = {
    'hadjar': 'Хаджар',
    'preece': 'Прис',
    'hunter-reay': 'Хантер-Рей',
    'allgaier': 'Олгайер',
    'majeski': 'Майески',
    'hemric': 'Хемрик',
    'ankrum': 'Анкрум',
    'wallace': 'Уоллас',
    'love': 'Лав',
    'rhodes': 'Роудс',
    'dye': 'Дай',
    'sawalich': 'Савалич',
    'labbe': 'Лабб',
    'muniz': 'Мьюниз',
    'enfinger': 'Энфингер',
    'eckes': 'Экес',
    'smithley': 'Смитли',
    'retzlaff': 'Ретцлафф',
    'reaume': 'Ром',
    'deegan': 'Диган',
    'caruth': 'Карут',
    'bonsignore': 'Бонсиньор',
    'ruggiero': 'Руджьеро',
    'elliott': 'Элиот',
    'alfredo': 'Альфредо',
    'heim': 'Хайм',
    'honeycutt': 'Ханикатт',
    'maggio': 'Маджио',
    'queen': 'Куин',
    'applegate': 'Эпплгейт',
    'reif': 'Райф',
    'zilisch': 'Зилич',
    'gray': 'Грей',
    'mayer': 'Майер',
    'jones': 'Джонс',
    'creed': 'Крид',
    'sanchez': 'Санчес',
    'riggs': 'Риггс',
    'friesen': 'Фризен',
    'clements': 'Клементс',
    'coulter': 'Коултер',
    'starr': 'Старр',
    'perkins': 'Перкинс',
    'mcleod': 'Маклеод',
    'yeley': 'Йели',
    'mears': 'Мирс',
    'musial': 'Мьюзиал',
    'linde': 'Линде',
    'albon': 'Албон'
  };

  var pairs = [
    ['sch', 'ш'], ['sh', 'ш'], ['ch', 'ч'], ['kh', 'х'], ['zh', 'ж'],
    ['ts', 'ц'], ['ya', 'я'], ['yu', 'ю'], ['yo', 'ё'], ['ye', 'е'],
    ['ay', 'ей'], ['ey', 'ей'], ['oy', 'ой'], ['ow', 'оу'], ['aw', 'о'],
    ['ee', 'и'], ['oo', 'у'], ['ou', 'у'], ['ai', 'ай'], ['ei', 'ей'],
    ['oi', 'ой'], ['au', 'ау'], ['eu', 'еу'], ['ia', 'ия'], ['io', 'ио'],
    ['ie', 'и'], ['ae', 'э'], ['oe', 'ё'], ['ue', 'ю'], ['ui', 'уи'],
    ['th', 'т'], ['ph', 'ф'], ['ck', 'к'], ['qu', 'кв'], ['wh', 'у'],
    ['ng', 'нг'], ['nk', 'нк'], ['ll', 'лл'], ['ss', 'сс'], ['tt', 'тт'],
    ['nn', 'нн'], ['mm', 'мм'], ['rr', 'рр'], ['ff', 'фф'], ['pp', 'пп'],
    ['a', 'а'], ['b', 'б'], ['c', 'к'], ['d', 'д'], ['e', 'е'], ['f', 'ф'],
    ['g', 'г'], ['h', 'х'], ['i', 'и'], ['j', 'дж'], ['k', 'к'], ['l', 'л'],
    ['m', 'м'], ['n', 'н'], ['o', 'о'], ['p', 'п'], ['q', 'к'], ['r', 'р'],
    ['s', 'с'], ['t', 'т'], ['u', 'у'], ['v', 'в'], ['w', 'в'], ['x', 'кс'],
    ['y', 'и'], ['z', 'з']
  ];

  function foldLatin(s) {
    return String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae');
  }

  function capitalizeRu(word) {
    if (!word) return '';
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  function translitLetters(w) {
    var out = '';
    var i = 0;
    while (i < w.length) {
      var matched = false;
      for (var p = 0; p < pairs.length; p++) {
        var en = pairs[p][0];
        if (w.slice(i, i + en.length) === en) {
          out += pairs[p][1];
          i += en.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        out += w.charAt(i);
        i += 1;
      }
    }
    return out;
  }

  function translitSingleWord(word) {
    var raw = String(word || '').trim();
    if (!raw) return '';
    if (/^\d+$/.test(raw)) return raw;
    var w = foldLatin(raw).toLowerCase();
    if (givenNameRu[w]) return givenNameRu[w];
    if (surnameRu[w]) return surnameRu[w];
    if (w.length <= 2 && /^[a-z]\.?$/.test(w)) {
      var letter = w.charAt(0);
      var map = { a: 'Эй', b: 'Би', c: 'Си', d: 'Ди', e: 'И', f: 'Эф', g: 'Джи', h: 'Эйч', i: 'Ай', j: 'Джей', k: 'Кей', l: 'Эл', m: 'Эм', n: 'Эн', o: 'О', p: 'Пи', q: 'Кью', r: 'Ар', s: 'Эс', t: 'Ти', u: 'Ю', v: 'Ви', w: 'Дабл-ю', x: 'Икс', y: 'Уай', z: 'Зет' };
      var ru = map[letter] || letter.toUpperCase();
      return w.length === 2 ? ru + '.' : ru;
    }
    var out = translitLetters(w);
    if (!out) return raw;
    return capitalizeRu(out);
  }

  function translitWord(word) {
    var raw = String(word || '').trim();
    if (!raw) return '';
    if (raw.indexOf('-') >= 0) {
      var whole = foldLatin(raw).toLowerCase();
      if (givenNameRu[whole]) return givenNameRu[whole];
      if (surnameRu[whole]) return surnameRu[whole];
      return raw.split('-').map(function (seg) {
        return translitSingleWord(seg);
      }).join('-');
    }
    return translitSingleWord(raw);
  }

  var nameParticles = /^(van|von|de|del|der|della|la|le|st|di|bin|al|mc|da|dos|das|el|den|ter)$/i;

  function stripDriverMarkers(name) {
    return String(name || '').trim().replace(/\s*\((?:i|r|g)\)\s*$/i, '').trim();
  }

  function isAbbreviatedDriverName(name) {
    var t = stripDriverMarkers(name);
    if (!t) return false;
    if (/^[A-Z](?:\.|\s+[A-Z]\.)\s+\S/i.test(t)) return true;
    if (/^[A-Z]\.[A-Z]\./i.test(t)) return true;
    return false;
  }

  function latinInitialToRu(ch) {
    var map = {
      A: 'А', B: 'Б', C: 'К', D: 'Д', E: 'Е', F: 'Ф', G: 'Г', H: 'Х', I: 'И',
      J: 'Дж', K: 'К', L: 'Л', M: 'М', N: 'Н', O: 'О', P: 'П', Q: 'К', R: 'Р',
      S: 'С', T: 'Т', U: 'У', V: 'В', W: 'В', X: 'Кс', Y: 'И', Z: 'З'
    };
    var u = String(ch || '').toUpperCase();
    return map[u] || translitSingleWord(u).charAt(0) || u;
  }

  function translitAbbreviatedDriverName(name) {
    var t = stripDriverMarkers(name);
    var m = t.match(/^((?:[A-Z]\.\s*)+)\s*(.+)$/i);
    if (!m) return translitDriverNameCore(t);
    var initials = m[1].trim().split(/\s+/).map(function (init) {
      var letter = init.replace(/\./g, '').charAt(0);
      return latinInitialToRu(letter) + '.';
    }).join(' ');
    var surname = translitWord(m[2].trim());
    return initials + ' ' + surname;
  }

  function translitSurnameLatin(surnameLatin) {
    var parts = String(surnameLatin || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '';
    if (parts.length === 1) return translitWord(parts[0]);
    var ruParts = parts.map(function (p) { return translitWord(p); });
    for (var i = 0; i < ruParts.length - 1; i++) {
      var seg = ruParts[i];
      if (seg) ruParts[i] = seg.charAt(0).toLowerCase() + seg.slice(1);
    }
    var last = ruParts[ruParts.length - 1] || '';
    if (last) ruParts[ruParts.length - 1] = last.charAt(0).toUpperCase() + last.slice(1);
    return ruParts.join(' ');
  }

  function driverSurnameLatin(base) {
    var words = String(base || '').trim().split(/\s+/).filter(Boolean);
    if (!words.length) return '';
    if (words.length === 1) return words[0];
    var start = words.length - 1;
    while (start > 0 && nameParticles.test(words[start - 1])) start--;
    return words.slice(start).join(' ');
  }

  function parseDriverSuffix(name) {
    var s = stripDriverMarkers(name);
    var m = s.match(/^(.*?)\s+(Jr\.?|Sr\.?|III|II|IV|I)$/i);
    if (!m) return { base: s, suffix: '' };
    return { base: m[1].trim(), suffix: m[2].replace(/\.$/, '').toUpperCase() };
  }

  function driverSuffixToRu(suffix) {
    if (!suffix) return '';
    var map = { JR: 'Мл.', SR: 'Ср.', I: 'Первый', II: 'Второй', III: 'Третий', IV: 'Четвёртый', V: 'Пятый' };
    return map[suffix] || '';
  }

  function translitDriverNameCore(name) {
    if (name == null) return '';
    var s = String(name).trim();
    if (!s) return '';
    if (/[\u0400-\u04FF]/.test(s)) return s;
    return s.split(/(\s+|[-/])/g).map(function (part) {
      if (!part || /^\s+$/.test(part) || part === '-' || part === '/') return part;
      return translitWord(part);
    }).join('').replace(/\s+/g, ' ').trim();
  }

  function translitDriverNameToRu(name) {
    if (name == null) return '';
    var raw = String(name).trim();
    if (!raw) return '';
    if (/[\u0400-\u04FF]/.test(raw)) return raw;
    if (isAbbreviatedDriverName(raw)) return translitAbbreviatedDriverName(raw);
    var parsed = parseDriverSuffix(raw);
    var base = translitDriverNameCore(parsed.base);
    var suf = driverSuffixToRu(parsed.suffix);
    return suf ? base + ' ' + suf : base;
  }

  window.TGA_RU.translitDriverNameCore = translitDriverNameCore;
  window.TGA_RU.driverSurnameLatin = driverSurnameLatin;

  window.TGA_RU.stripDriverMarkers = stripDriverMarkers;
  window.TGA_RU.isAbbreviatedDriverName = isAbbreviatedDriverName;
  window.TGA_RU.translitAbbreviatedDriverName = translitAbbreviatedDriverName;
  window.TGA_RU.parseDriverSuffix = parseDriverSuffix;
  window.TGA_RU.driverSuffixToRu = driverSuffixToRu;
  window.TGA_RU.translitDriverNameToRu = translitDriverNameToRu;
})();
