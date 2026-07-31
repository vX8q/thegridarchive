// Class definitions for series Specs/Classes tabs (no event-by-event BoP numbers).
// Keys match series id slugs used in /series/{id}/classes.
window.SERIES_CLASSES_SPEC = {
  wec: {
    classes: ['Hypercar', 'LMGT3'],
    sections: [
      {
        title: 'FIA World Endurance Championship classes (2026)',
        layout: 'kv',
        valueHeader: 'Definition',
        rows: [
          {
            key: 'Hypercar',
            value: 'Top prototype class: Le Mans Hypercar (LMH) and Le Mans Daytona h (LMDh) cars competing together'
          },
          {
            key: 'LMGT3',
            value: 'Production-based GT class on the FIA GT3 platform (replaced GTE from 2024); private / customer programmes with FIA driver categorisation rules'
          },
          {
            key: 'LMP2',
            value: 'Not a full-season FIA WEC class; LMP2 remains eligible for the 24 Hours of Le Mans under ACO/FIA Le Mans supplementary regulations'
          }
        ]
      }
    ]
  },
  elms: {
    classes: ['LMP2', 'LMP2 Pro/Am', 'LMP3', 'LMGT3'],
    sections: [
      {
        title: 'European Le Mans Series categories (2026)',
        layout: 'kv',
        valueHeader: 'Definition',
        rows: [
          {
            key: 'LMP2',
            value: 'Highest ELMS prototype category for independent teams (FIA/ACO LMP2 technical regulations)'
          },
          {
            key: 'LMP2 Pro/Am',
            value: 'LMP2 cars with Pro-Am lineups; only Bronze-ranked drivers may qualify the car (ELMS 2026 sporting regulations summary)'
          },
          {
            key: 'LMP3',
            value: 'Junior prototype category (ACO LMP3); Michelin control tyres in 2026 ELMS'
          },
          {
            key: 'LMGT3',
            value: 'GT category based on FIA GT3 / ACO LMGT3 rules; only Bronze-ranked drivers may qualify the car (ELMS 2026)'
          },
          {
            key: 'Source',
            value: 'europeanlemansseries.com — 2026 Technical and Sporting Regulations'
          }
        ]
      }
    ]
  },
  gtwce_end: {
    classes: ['Pro', 'Gold Cup', 'Silver Cup', 'Bronze Cup'],
    sections: [
      {
        title: 'GT World Challenge Europe Endurance — cups (SRO Sporting Regulations 2024 Art. 10.1.1)',
        layout: 'kv',
        valueHeader: 'Maximum line-ups',
        rows: [
          {
            key: 'Pro Category',
            value: 'Any FIA driver categorisation combination will be accepted'
          },
          {
            key: 'Gold Cup',
            value: 'Cases A/C (3h/6h): Gold / Gold / Silver. Case B (24h): Gold/Gold/Gold/Silver or Gold/Gold/Silver'
          },
          {
            key: 'Silver Cup',
            value: 'Cases A/C: Silver / Silver / Silver. Case B (24h): Silver / Silver / Silver / Silver'
          },
          {
            key: 'Bronze Cup',
            value: 'Cases A/C: Platinum / Silver / Bronze°. Case B (24h): Platinum/Silver/Silver/Bronze° or Platinum/Silver/Bronze° (Bronze° per Art. 10.4.7)'
          },
          {
            key: 'Pro-Am (Spa 24h only)',
            value: 'Case B only: Platinum/Bronze/Bronze or Platinum/Platinum/Bronze/Bronze; no season title in 2024 text'
          },
          {
            key: 'Note',
            value: 'Cups use FIA Driver Categorisation combinations, not different car BoP packages. Source PDF is 2024 SRO Sporting Regulations (Visa S02-GTWCE/B24); 2026 sporting PDF not supplied'
          }
        ]
      }
    ]
  },
  gtwce_sprint: {
    classes: ['Pro', 'Gold Cup', 'Silver Cup', 'Bronze Cup'],
    sections: [
      {
        title: 'GT World Challenge Europe Sprint — cups (SRO Sporting Regulations 2024 Art. 10.1.2)',
        layout: 'kv',
        valueHeader: 'Maximum line-ups',
        rows: [
          {
            key: 'Pro Category',
            value: 'No driver categorisations will be applied'
          },
          {
            key: 'Gold Cup',
            value: 'Case D: maximum pairings with one Gold and one Silver driver'
          },
          {
            key: 'Silver Cup',
            value: 'Case D: maximum pairings of two Silver drivers'
          },
          {
            key: 'Bronze Cup',
            value: 'Case D: maximum pairings of one Platinum driver and one Bronze° (Bronze° per Art. 10.4.7)'
          },
          {
            key: 'Note',
            value: 'Cups use FIA Driver Categorisation combinations, not different car BoP packages. Source PDF is 2024 SRO Sporting Regulations (Visa S02-GTWCE/B24); 2026 sporting PDF not supplied'
          }
        ]
      }
    ]
  },
  dtm: {
    classes: ['DTM (FIA GT3 + GT3 DTM Homologation)'],
    sections: [
      {
        title: 'DTM 2026 — class definition',
        layout: 'kv',
        valueHeader: 'Regulation',
        rows: [
          {
            key: 'Class structure',
            value: 'Single class'
          },
          {
            key: 'Technical basis',
            value: 'Cars must comply fully with FIA GT3 technical regulations (ISC Appendix J Art. 257A) and FIA GT3 homologations valid in 2026, plus the GT3 DTM Homologation including all updates (DTM 2026 Sporting Regulations)'
          },
          {
            key: 'BoP',
            value: 'Initial classification via FIA/SRO BoP testing; numerical BoP tables are not fixed seasonal constants in the sporting text'
          },
          {
            key: 'Source',
            value: '11_DTM_2026_sporting_regulations_approved_clean.pdf (ADAC / ITR / DMSB)'
          }
        ]
      }
    ]
  },
  super_gt: {
    classes: ['GT500', 'GT300'],
    sections: [
      {
        title: 'SUPER GT — technical class definitions',
        layout: 'kv',
        valueHeader: 'Definition',
        rows: [
          {
            key: 'GT500',
            value: 'Cars conforming to the technical regulations jointly formulated with DTM (from 2020); manufacturer GT500 packages under a common class formula (supergt.net technical regulations)'
          },
          {
            key: 'GT300',
            value: 'Cars conforming to FIA GT3, GT300, or GT300MC regulations may compete, balanced under GTA BoP (supergt.net technical regulations)'
          },
          {
            key: 'Source',
            value: 'supergt.net/en/about-super-gt/regulation/technical_regulations'
          }
        ]
      }
    ]
  }
};
