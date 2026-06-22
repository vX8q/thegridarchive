// Truck, ARCA, Xfinity (NOAPS), Modified — technical_spec keys/values from data/teams/*.json
(function () {
  if (typeof window === 'undefined') return;
  window.TGA_RU = window.TGA_RU || {};

  Object.assign(window.TGA_RU.specKeyRu || (window.TGA_RU.specKeyRu = {}), {
    'body construction': 'Конструкция кузова',
    'power limiting': 'Ограничение мощности'
  });

  Object.assign(window.TGA_RU.specValueExact || (window.TGA_RU.specValueExact = {}), {
    'nascar craftsman truck series': 'NASCAR Craftsman Truck Series',
    'arca menards series': 'ARCA Menards Series',
    'nascar whelen modified tour': 'NASCAR Whelen Modified Tour',
    'xfinity series car (gen 6–based)': 'Xfinity Series (на базе Gen 6)',
    'xfinity series car (gen 6-based)': 'Xfinity Series (на базе Gen 6)',
    'composite/approved truck body panels styled to production pickup': 'Композитные / одобренные панели кузова пикапа (стилизация под серийную модель)',
    'composite body, asymmetrical (offset)': 'Композитный асимметричный кузов (смещение)',
    'open‑wheel modified stock car': 'Сток-кар Modified с открытыми колёсами',
    'open-wheel modified stock car': 'Сток-кар Modified с открытыми колёсами',
    'hand‑fabricated sheetmetal panels': 'Ручная сборка листовых панелей',
    'hand-fabricated sheetmetal panels': 'Ручная сборка листовых панелей',
    'open front wheels, exposed front suspension': 'Открытые передние колёса, открытая передняя подвеска',
    'branding decals only (no oem chassis/body)': 'Только брендинг (без OEM-шасси/кузова)',
    'troyer engineering · chassis dynamics · spafco · raceworks · fury race cars / lfr chassis': 'Troyer Engineering · Chassis Dynamics · Spafco · Raceworks · Fury Race Cars / LFR Chassis',
    '~650-700 hp unrestricted / ~450 hp restricted': '~650–700 л.с. без ограничений / ~450 л.с. с ограничением',
    '~650 hp': '~650 л.с.',
    '~700 nm (~520 ft-lb)': '~700 Н·м (~520 фут·фунт)',
    '~680–700 nm (≈ 500–515 ft·lb)': '~680–700 Н·м (≈ 500–515 фут·фунт)',
    'sunoco green e15 (85% unleaded blend + 15% ethanol)': 'Sunoco Green E15 (85% бензина + 15% этанола)',
    '~18 us gal (~68 l)': '~18 гал (США) (~68 л)',
    '~18 us gal (≈ 68 l)': '~18 гал (США) (≈ 68 л)',
    'series-approved suspension (coil/short-long arm derivative)': 'Серийная подвеска (производная coil/SLA)',
    'steel disc brakes (multiple-piston calipers)': 'Стальные дисковые тормоза (многопоршневые суппорты)',
    'steel disc brakes, 4‑piston calipers': 'Стальные дисковые тормоза, 4-поршневые суппорты',
    'steel disc brakes, 4-piston calipers': 'Стальные дисковые тормоза, 4-поршневые суппорты',
    'series-approved racing wheels (steel or aluminum)': 'Серийные гоночные колёса (сталь или алюминий)',
    '15″ steel wheels, 5‑lug': '15″ стальные колёса, 5 шпилек',
    '15″ steel wheels, 5-lug': '15″ стальные колёса, 5 шпилек',
    'goodyear eagle racing tires (slicks; rain tires if applicable)': 'Гоночные шины Goodyear Eagle (слики; дождевые при необходимости)',
    'goodyear eagle bias‑ply racing tires': 'Гоночные шины Goodyear Eagle (диагональная конструкция)',
    'goodyear eagle bias-ply racing tires': 'Гоночные шины Goodyear Eagle (диагональная конструкция)',
    'goodyear eagle bias-ply': 'Goodyear Eagle (диагональная конструкция)',
    'hoosier racing tire (modified‑spec slicks)': 'Hoosier Racing Tire (слики Modified)',
    'hoosier racing tire (modified-spec slicks)': 'Hoosier Racing Tire (слики Modified)',
    'approved front air dam / truck body aero package (series rules)': 'Одобренный передний air dam / аэропакет кузова пикапа (регламент серии)',
    'flat floor with nascar-mandated safety and control devices': 'Плоское днище с обязательными элементами безопасности NASCAR',
    'roll cage, hans device, 6-point harness, onboard fire suppression (standard nascar)': 'Каркас безопасности, HANS, 6-точечные ремни, бортовое пожаротушение (стандарт NASCAR)',
    'full roll cage, hans, 6‑point harness, fire suppression (nascar mandated)': 'Полный каркас, HANS, 6-точечные ремни, пожаротушение (NASCAR)',
    'race pickup body, carburetor or series spec injection engine, live rear axle, 4-speed manual gearbox': 'Кузов пикапа, карбюратор или серийный впрыск, живая задняя ось, 4-ступенчатая МКПП',
    'carburetor v8, steel chassis, live rear axle, 4‑speed manual, low‑downforce stock‑car aero': 'Карбюраторный V8, стальное шасси, живая задняя ось, 4-ступенчатая МКПП, низкоприжимная аэродинамика сток-кара',
    'carburetor engine, live rear axle, 5-lug wheels, no sequential gearbox': 'Карбюраторный двигатель, живая задняя ось, 5 шпилек, без секвентальной КПП',
    'front splitter, rear spoiler (arca‑approved)': 'Передний сплиттер, задний спойлер (одобрено ARCA)',
    'front splitter, rear spoiler (arca-approved)': 'Передний сплиттер, задний спойлер (одобрено ARCA)',
    'ultra‑wide track, very low ride height, open wheels, carbureted v8, fabricator chassis': 'Очень широкая колея, низкая посадка, открытые колёса, карбюраторный V8, шасси fabricator',
    'ultra-wide track, very low ride height, open wheels, carbureted v8, fabricator chassis': 'Очень широкая колея, низкая посадка, открытые колёса, карбюраторный V8, шасси fabricator',
    'wide steel racing wheels (series‑approved)': 'Широкие стальные гоночные колёса (одобрено серией)',
    'wide steel racing wheels (series-approved)': 'Широкие стальные гоночные колёса (одобрено серией)',
    'steel disc brakes, multi‑piston calipers': 'Стальные дисковые тормоза, многопоршневые суппорты',
    'steel disc brakes, multi-piston calipers': 'Стальные дисковые тормоза, многопоршневые суппорты',
  });

  var parts = window.TGA_RU.specValueParts || (window.TGA_RU.specValueParts = []);
  var extraParts = [
    [/Xfinity Series Car \(Gen 6[–-]based\)/gi, 'Xfinity Series (на базе Gen 6)'],
    [/NASCAR Craftsman Truck Series/gi, 'NASCAR Craftsman Truck Series'],
    [/ARCA Menards Series/gi, 'ARCA Menards Series'],
    [/NASCAR Whelen Modified Tour/gi, 'NASCAR Whelen Modified Tour'],
    [/Composite\/approved truck body panels styled to production pickup/gi, 'Композитные / одобренные панели кузова пикапа'],
    [/~650-700 hp unrestricted \/ ~450 hp restricted/gi, '~650–700 л.с. без ограничений / ~450 л.с. с ограничением'],
    [/Sunoco Green E15 \(85% unleaded blend \+ 15% ethanol\)/gi, 'Sunoco Green E15 (85% бензина + 15% этанола)'],
    [/Series-approved suspension/gi, 'Серийная подвеска'],
    [/Series-approved racing wheels/gi, 'Серийные гоночные колёса'],
    [/Approved front air dam/gi, 'Одобренный передний air dam'],
    [/Flat floor with NASCAR-mandated/gi, 'Плоское днище с обязательными элементами NASCAR'],
    [/onboard fire suppression/gi, 'бортовое пожаротушение'],
    [/Hoosier Racing Tire/gi, 'Hoosier Racing Tire'],
    [/Modified‑spec slicks/gi, 'слики Modified'],
    [/Modified-spec slicks/gi, 'слики Modified'],
    [/low‑downforce stock‑car aero/gi, 'низкоприжимная аэродинамика сток-кара'],
    [/low-downforce stock-car aero/gi, 'низкоприжимная аэродинамика сток-кара'],
    [/Open‑wheel modified stock car/gi, 'Сток-кар Modified с открытыми колёсами'],
    [/Branding decals only/gi, 'Только брендинг'],
    [/no OEM chassis\/body/gi, 'без OEM-шасси/кузова'],
    [/Hand‑fabricated sheetmetal/gi, 'Ручная сборка листовых панелей'],
    [/Open front wheels, exposed front suspension/gi, 'Открытые передние колёса, открытая передняя подвеска'],
    [/Not fixed by rule/gi, 'Не фиксировано регламентом'],
    [/estimated/gi, 'ориентировочно'],
    [/wider than Cup car/gi, 'шире машины Cup'],
    [/lower than Cup car/gi, 'ниже машины Cup'],
    [/additional ballast for/gi, 'дополнительный балласт для'],
    [/Typically/gi, 'Обычно'],
    [/Turbo V8/gi, 'турбо V8'],
    [/Turbo V6/gi, 'турбо V6'],
    [/Turbo I6/gi, 'турбо I6'],
    [/GT3 Evo/gi, 'GT3 Evo']
  ];
  extraParts.forEach(function (pair) {
    var exists = parts.some(function (p) { return String(p[0]) === String(pair[0]); });
    if (!exists) parts.push(pair);
  });
})();
