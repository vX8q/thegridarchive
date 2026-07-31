// IMSA WeatherTech Classes — definitions + current LMP2 technical (FIA/ACO 2026).
// Sources: IMSA Sporting Regulations 2026; FIA 2026 LMP2 Technical Regulations
// (homologated 2017); imsa.com/weathertech/discover/the-classes.
// GTP/GTD: class definitions only (no event-by-event BoP numbers).
// LMP2 “2028” future package is NOT used here.
window.IMSA_CLASSES_SPEC = {
  classes: [
    'Grand Touring Prototype (GTP) (LMDh and LMH)',
    'Le Mans Prototype 2 (LMP2)',
    'GT Daytona Pro (GTD Pro)',
    'GT Daytona (GTD)'
  ],
  sections: [
    {
      title: 'Class definitions (IMSA WeatherTech 2026)',
      layout: 'kv',
      valueHeader: 'Definition',
      rows: [
        {
          key: 'GTP (Grand Touring Prototype)',
          value: 'Top prototype class: LMDh and LMH cars racing together under IMSA GTP designation (IMSA Sporting Regulations Art. 1.20–1.24)'
        },
        {
          key: 'LMP2',
          value: 'Closed-cockpit customer prototype developed by four approved constructors; also races in ELMS, Asian Le Mans Series, and the 24 Hours of Le Mans (not a full-season FIA WEC class)'
        },
        {
          key: 'GTD PRO (Grand Touring Daytona Pro)',
          value: 'FIA GT3-based cars for professional / factory-oriented lineups (IMSA Sporting Regulations)'
        },
        {
          key: 'GTD (Grand Touring Daytona)',
          value: 'FIA GT3-based cars for customer / Pro-Am lineups (same technical GT3 basis as GTD PRO; driver categorisation differs)'
        },
        {
          key: 'BoP note',
          value: 'Balance of Performance for GTP / GTD PRO / GTD is set event-by-event in IMSA Technical Regulations / bulletins — not listed here as a fixed seasonal figure'
        }
      ]
    },
    {
      title: 'GTP architecture — LMDh / LMH (no seasonal BoP numbers)',
      layout: 'kv',
      valueHeader: 'Platform',
      rows: [
        {
          key: 'LMDh',
          value: 'Le Mans Daytona h: manufacturer bodywork on a common prototype chassis from approved suppliers (Dallara / Ligier / Multimatic / Oreca), with a standardised hybrid system and manufacturer ICE — races as GTP in IMSA and Hypercar in WEC'
        },
        {
          key: 'LMH',
          value: 'Le Mans Hypercar: fully manufacturer-designed prototype; hybrid optional (front-axle MGU when fitted); races as Hypercar in WEC and eligible as GTP in IMSA when conforming'
        },
        {
          key: 'Shared competition principle',
          value: 'LMDh and LMH compete together under global Hypercar/GTP Balance of Performance — values are bulletin/event-specific (see IMSA/ACO technical regs hub), not frozen season constants in this Specs view'
        },
        {
          key: 'Source',
          value: 'imsa.com/competitors/2026-aco-imsa-rules-regulations — LMDh Technical Regulations + IMSA Sporting Regulations'
        }
      ]
    },
    {
      title: 'Key Differences: GTD Pro vs GTD',
      layout: 'compare',
      columns: ['GTD Pro', 'GTD'],
      rows: [
        {
          key: 'Official name',
          values: ['Grand Touring Daytona Pro (GTD PRO)', 'Grand Touring Daytona (GTD)']
        },
        {
          key: 'Cars',
          values: [
            'Race cars built to FIA GT3 technical regulations',
            'Race cars built to FIA GT3 technical regulations (same technical basis)'
          ]
        },
        {
          key: 'Typical programme',
          values: [
            'Factory-backed / professional lineups',
            'Customer / Pro-Am lineups'
          ]
        },
        {
          key: 'BoP',
          values: [
            'Applied (event-by-event; see IMSA Technical Regulations)',
            'Applied (event-by-event; see IMSA Technical Regulations)'
          ]
        }
      ]
    },
    {
      title: 'LMP2 – Vehicle & Technical Specifications (2026 Regulations)',
      layout: 'kv',
      valueHeader: 'LMP2 Regulation (2026)',
      rows: [
        { key: 'Class Name', value: 'Le Mans Prototype 2 (LMP2)' },
        {
          key: 'Regulation year',
          value: '2026 FIA/ACO Technical Regulations for LMP2 Prototype Homologated in 2017 (published 11.12.2025)'
        },
        {
          key: 'Championships',
          value: 'IMSA / ELMS / Asian Le Mans Series; 24 Hours of Le Mans (not full-season FIA WEC)'
        },
        { key: 'Car Type', value: 'Closed-cockpit endurance racing prototype' },
        { key: 'Chassis Concept', value: 'Spec LMP2 platform (homologated 2017 generation)' },
        { key: 'Monocoque', value: 'Carbon-fibre monocoque' },
        {
          key: 'Approved Chassis Suppliers',
          value: 'Dallara / Ligier / Oreca / Riley-Multimatic'
        },
        { key: 'Chassis Development', value: 'Frozen (performance development restricted by homologation)' },
        { key: 'Minimum Vehicle Weight', value: '930 kg (Art. 4.1)' },
        { key: 'Maximum Length', value: '4,750 mm (Art. 3.1.2)' },
        { key: 'Overall Width', value: '1,800 mm (min) – 1,900 mm (max) (Art. 3.1.4)' },
        { key: 'Maximum Height', value: '1,050 mm (Art. 3.1.5)' },
        { key: 'Drivetrain', value: 'Rear-wheel drive (RWD)' },
        {
          key: 'Internal Combustion Engine',
          value: 'Sole FIA/ACO-designated engine — Gibson GK428 4.2 L V8 naturally aspirated (Art. 5.1; Gibson Tech)'
        },
        { key: 'Engine Displacement', value: '4,200 cc' },
        {
          key: 'Engine Power',
          value: '450 kW / 600 BHP (Gibson GK428 manufacturer specification)'
        },
        {
          key: 'Hybrid System',
          value: 'Not permitted (sole designated ICE; active systems restricted — Art. 2.2 / 5.1)'
        },
        { key: 'Fuel Tank Capacity', value: '75 litres maximum onboard (Art. 6.2.1)' },
        {
          key: 'Exhaust noise',
          value: 'Max 110 dBA in qualifying and race, measured 15 m from track edge (Art. 5.5.1)'
        },
        {
          key: 'Balance of Performance (BoP)',
          value: 'Not applied as GT3-style BoP; performance fixed by spec package (event ECU / stratification notes may apply at Le Mans)'
        },
        {
          key: 'Gearbox',
          value: 'Homologated sequential gearbox; ≤6 forward ratios from a common chassis-constructor ratio list, 1 final drive, 1 reverse (Art. 11.4); carbon casings forbidden; supplier not named in the FIA LMP2 2026 text (no Xtrac article)'
        },
        { key: 'Number of Gears', value: 'Maximum 6 forward + reverse (Art. 11.4.2)' },
        {
          key: 'Complete wheel envelope',
          value: 'Must fit in a cylinder — front Ø 690 mm × 342 mm; rear Ø 715 mm × 362 mm (Art. 15.2)'
        },
        {
          key: 'Rim dimensions',
          value: '18″ diameter front and rear; front width 12.5″; rear width 13.0″ (Art. 15.4.2)'
        },
        {
          key: 'Wheel weight (tyre removed)',
          value: 'Front min 10.5 kg; rear min 11.0 kg (Art. 15.3)'
        },
        { key: 'Tyres', value: 'Single supplier per championship' },
        { key: 'Fuel', value: 'Series / FIA-ACO approved fuel as specified for each championship' },
        { key: 'Cost Control', value: 'Spec engine, homologated chassis/aero, price and spare-part controls in regulations' }
      ]
    }
  ]
};
