export interface BarangayData {
  code: string;
  name: string;
}

export interface CityData {
  code: string;
  name: string;
  barangays: BarangayData[];
}

export interface ProvinceData {
  code: string;
  name: string;
  cities: CityData[];
}

export interface RegionData {
  code: string;
  name: string;
  regionName: string;
  isNcR?: boolean;
  provinces: ProvinceData[];
  cities?: CityData[];
}

export const PH_ADDRESS_DATA: RegionData[] = [
  // 1. NCR - National Capital Region
  {
    code: '130000000',
    name: 'NCR - National Capital Region',
    regionName: 'National Capital Region',
    isNcR: true,
    provinces: [],
    cities: [
      {
        code: '133900000',
        name: 'Manila City',
        barangays: [
          { code: '133901000', name: 'Binondo' },
          { code: '133902000', name: 'Ermita' },
          { code: '133903000', name: 'Intramuros' },
          { code: '133904000', name: 'Malate' },
          { code: '133905000', name: 'Paco' },
          { code: '133906000', name: 'Pandacan' },
          { code: '133907000', name: 'Port Area' },
          { code: '133908000', name: 'Quiapo' },
          { code: '133909000', name: 'Sampaloc' },
          { code: '133910000', name: 'San Andreas' },
          { code: '133911000', name: 'San Miguel' },
          { code: '133912000', name: 'San Nicolas' },
          { code: '133913000', name: 'Santa Ana' },
          { code: '133914000', name: 'Santa Cruz' },
          { code: '133915000', name: 'Santa Mesa' },
          { code: '133916000', name: 'Tondo I' },
          { code: '133917000', name: 'Tondo II' },
        ],
      },
      {
        code: '137400000',
        name: 'Quezon City',
        barangays: [
          { code: '137401000', name: 'Alicia' },
          { code: '137403000', name: 'Bagong Pag-asa' },
          { code: '137405000', name: 'Batasan Hills' },
          { code: '137411000', name: 'Commonwealth' },
          { code: '137412000', name: 'Cubao (Socorro)' },
          { code: '137413000', name: 'Diliman' },
          { code: '137415000', name: 'Fairview' },
          { code: '137417000', name: 'Holy Spirit' },
          { code: '137418000', name: 'Kamuning' },
          { code: '137421000', name: 'Loyola Heights' },
          { code: '137422000', name: 'New Manila' },
          { code: '137423000', name: 'Novaliches Proper' },
          { code: '137425000', name: 'Payatas' },
          { code: '137433000', name: 'Tandang Sora' },
          { code: '137434000', name: 'Teachers Village East' },
          { code: '137435000', name: 'Teachers Village West' },
          { code: '137436000', name: 'Ugong Norte' },
          { code: '137437000', name: 'UP Campus' },
        ],
      },
      {
        code: '137600000',
        name: 'Makati City',
        barangays: [
          { code: '137601000', name: 'Bel-Air' },
          { code: '137602000', name: 'Cembo' },
          { code: '137603000', name: 'Dasmariñas' },
          { code: '137604000', name: 'Forbes Park' },
          { code: '137605000', name: 'Guadalupe Nuevo' },
          { code: '137606000', name: 'Guadalupe Viejo' },
          { code: '137607000', name: 'Magallanes' },
          { code: '137608000', name: 'Poblacion' },
          { code: '137609000', name: 'San Antonio' },
          { code: '137610000', name: 'San Lorenzo' },
          { code: '137611000', name: 'Urdaneta' },
        ],
      },
      {
        code: '137500000',
        name: 'Pasig City',
        barangays: [
          { code: '137501000', name: 'Bagong Ilog' },
          { code: '137502000', name: 'Caniogan' },
          { code: '137503000', name: 'Kapitolyo' },
          { code: '137504000', name: 'Manggahan' },
          { code: '137505000', name: 'Oranbo' },
          { code: '137506000', name: 'Pinagbuhatan' },
          { code: '137507000', name: 'Rosario' },
          { code: '137508000', name: 'San Antonio' },
          { code: '137509000', name: 'Santolan' },
          { code: '137510000', name: 'Ugong' },
        ],
      },
      {
        code: '137700000',
        name: 'Taguig City',
        barangays: [
          { code: '137701000', name: 'Bagumbayan' },
          { code: '137702000', name: 'Bambang' },
          { code: '137703000', name: 'Fort Bonifacio (BGC)' },
          { code: '137704000', name: 'Ligid-Tipas' },
          { code: '137705000', name: 'Lower Bicutan' },
          { code: '137706000', name: 'Pinagsama' },
          { code: '137707000', name: 'San Miguel' },
          { code: '137708000', name: 'Tuktukan' },
          { code: '137709000', name: 'Upper Bicutan' },
          { code: '137710000', name: 'Ususan' },
        ],
      },
      {
        code: '137100000',
        name: 'Caloocan City',
        barangays: [
          { code: '137101000', name: 'Barangay 1 to 50 (South Caloocan)' },
          { code: '137102000', name: 'Barangay 51 to 100' },
          { code: '137103000', name: 'Bagong Silang (Barangay 176)' },
          { code: '137104000', name: 'Camarin' },
          { code: '137105000', name: 'Tala' },
        ],
      },
      {
        code: '137200000',
        name: 'Las Piñas City',
        barangays: [
          { code: '137201000', name: 'Alabang-Zapote' },
          { code: '137202000', name: 'BF International' },
          { code: '137203000', name: 'Pamplona Uno' },
          { code: '137204000', name: 'Pamplona Dos' },
          { code: '137205000', name: 'Poblacion' },
          { code: '137206000', name: 'Talon Uno' },
          { code: '137207000', name: 'Talon Dos' },
        ],
      },
      {
        code: '137300000',
        name: 'Mandaluyong City',
        barangays: [
          { code: '137301000', name: 'Addition Hills' },
          { code: '137302000', name: 'Barangka Ilaya' },
          { code: '137303000', name: 'Highway Hills' },
          { code: '137304000', name: 'Plainview' },
          { code: '137305000', name: 'Wack-Wack Greenhills' },
        ],
      },
      {
        code: '137800000',
        name: 'Muntinlupa City',
        barangays: [
          { code: '137801000', name: 'Alabang' },
          { code: '137802000', name: 'Bayanan' },
          { code: '137803000', name: 'Cupang' },
          { code: '137804000', name: 'Poblacion' },
          { code: '137805000', name: 'Putatan' },
          { code: '137806000', name: 'Sucat' },
          { code: '137807000', name: 'Tunasan' },
        ],
      },
      {
        code: '137900000',
        name: 'Parañaque City',
        barangays: [
          { code: '137901000', name: 'Baclaran' },
          { code: '137902000', name: 'BF Homes' },
          { code: '137903000', name: 'Don Bosco' },
          { code: '137904000', name: 'Moonwalk' },
          { code: '137905000', name: 'San Dionisio' },
          { code: '137906000', name: 'San Isidro' },
          { code: '137907000', name: 'Tambo' },
        ],
      },
      {
        code: '138000000',
        name: 'Pasay City',
        barangays: [
          { code: '138001000', name: 'Barangay 1 to 50' },
          { code: '138002000', name: 'Barangay 51 to 100' },
          { code: '138003000', name: 'Barangay 101 to 200' },
          { code: '138004000', name: 'Malibay' },
          { code: '138005000', name: 'Villamor' },
        ],
      },
      {
        code: '138100000',
        name: 'Valenzuela City',
        barangays: [
          { code: '138101000', name: 'Arkong Bato' },
          { code: '138102000', name: 'Gen. T. de Leon' },
          { code: '138103000', name: 'Karuhatan' },
          { code: '138104000', name: 'Malinta' },
          { code: '138105000', name: 'Marulas' },
          { code: '138106000', name: 'Paso de Blas' },
        ],
      },
    ],
  },

  // 2. CAR - Cordillera Administrative Region
  {
    code: '140000000',
    name: 'CAR - Cordillera Administrative Region',
    regionName: 'Cordillera Administrative Region',
    provinces: [
      {
        code: '141100000',
        name: 'Benguet',
        cities: [
          {
            code: '141102000',
            name: 'Baguio City',
            barangays: [
              { code: '141102001', name: 'Asin Road' },
              { code: '141102002', name: 'Bakakeng Central' },
              { code: '141102003', name: 'Camp 7' },
              { code: '141102004', name: 'Irisan' },
              { code: '141102005', name: 'Loakan Proper' },
              { code: '141102006', name: 'Magsaysay Lower' },
              { code: '141102007', name: 'Pacdal' },
              { code: '141102008', name: 'Session Road Area' },
            ],
          },
          {
            code: '141101000',
            name: 'La Trinidad',
            barangays: [
              { code: '141101001', name: 'Balili' },
              { code: '141101002', name: 'Poblacion' },
              { code: '141101003', name: 'Puguis' },
              { code: '141101004', name: 'Pico' },
              { code: '141101005', name: 'Betag' },
            ],
          },
          {
            code: '141103000',
            name: 'Itogon',
            barangays: [
              { code: '141103001', name: 'Ampucao' },
              { code: '141103002', name: 'Poblacion' },
              { code: '141103003', name: 'Tuba' },
            ],
          },
        ],
      },
      {
        code: '140100000',
        name: 'Abra',
        cities: [
          {
            code: '140101000',
            name: 'Bangued',
            barangays: [
              { code: '140101001', name: 'Zone 1 Poblacion' },
              { code: '140101002', name: 'Zone 2 Poblacion' },
              { code: '140101003', name: 'Calaba' },
            ],
          },
          { code: '140102000', name: 'Bucay', barangays: [{ code: '140102001', name: 'Poblacion' }] },
          { code: '140103000', name: 'Tayum', barangays: [{ code: '140103001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '142700000',
        name: 'Ifugao',
        cities: [
          { code: '142701000', name: 'Lagawe', barangays: [{ code: '142701001', name: 'Poblacion North' }] },
          { code: '142702000', name: 'Banaue', barangays: [{ code: '142702001', name: 'Poblacion' }, { code: '142702002', name: 'Batad' }] },
          { code: '142703000', name: 'Kiangan', barangays: [{ code: '142703001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '143200000',
        name: 'Kalinga',
        cities: [
          { code: '143201000', name: 'Tabuk City', barangays: [{ code: '143201001', name: 'Dagupan Centro' }, { code: '143201002', name: 'Bulanao' }] },
          { code: '143202000', name: 'Lubuagan', barangays: [{ code: '143202001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '144400000',
        name: 'Mountain Province',
        cities: [
          { code: '144401000', name: 'Bontoc', barangays: [{ code: '144401001', name: 'Poblacion' }] },
          { code: '144402000', name: 'Sagada', barangays: [{ code: '144402001', name: 'Poblacion' }, { code: '144402002', name: 'Bangaan' }] },
        ],
      },
      {
        code: '148100000',
        name: 'Apayao',
        cities: [
          { code: '148101000', name: 'Kabugao', barangays: [{ code: '148101001', name: 'Poblacion' }] },
          { code: '148102000', name: 'Luna', barangays: [{ code: '148102001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 3. Region I - Ilocos Region
  {
    code: '010000000',
    name: 'Region I - Ilocos Region',
    regionName: 'Ilocos Region',
    provinces: [
      {
        code: '012800000',
        name: 'Ilocos Norte',
        cities: [
          {
            code: '012801000',
            name: 'Laoag City',
            barangays: [
              { code: '012801001', name: 'Barangay 1 San Lorenzo' },
              { code: '012801002', name: 'Barangay 2 Santa Joaquina' },
              { code: '012801003', name: 'Nalbo' },
            ],
          },
          { code: '012802000', name: 'Batac City', barangays: [{ code: '012802001', name: 'Poblacion' }] },
          { code: '012803000', name: 'Pagudpud', barangays: [{ code: '012803001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '012900000',
        name: 'Ilocos Sur',
        cities: [
          {
            code: '012901000',
            name: 'Vigan City',
            barangays: [
              { code: '012901001', name: 'Poblacion Uno' },
              { code: '012901002', name: 'Poblacion Dos' },
              { code: '012901003', name: 'Mindoro' },
            ],
          },
          { code: '012902000', name: 'Candon City', barangays: [{ code: '012902001', name: 'Poblacion' }] },
          { code: '012903000', name: 'Narvacan', barangays: [{ code: '012903001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '013300000',
        name: 'La Union',
        cities: [
          {
            code: '013301000',
            name: 'San Fernando City',
            barangays: [
              { code: '013301001', name: 'Catbangen' },
              { code: '013301002', name: 'Sevilla' },
              { code: '013301003', name: 'Lingsat' },
            ],
          },
          { code: '013302000', name: 'Agoo', barangays: [{ code: '013302001', name: 'Poblacion' }] },
          { code: '013303000', name: 'San Juan (Surfing Capital)', barangays: [{ code: '013303001', name: 'Urbiztondo' }, { code: '013303002', name: 'Poblacion' }] },
        ],
      },
      {
        code: '015500000',
        name: 'Pangasinan',
        cities: [
          {
            code: '015501000',
            name: 'Dagupan City',
            barangays: [
              { code: '015501001', name: 'Bonuan Boquig' },
              { code: '015501002', name: 'Bonuan Gueset' },
              { code: '015501003', name: 'Poblacion Oeste' },
              { code: '015501004', name: 'Tapuac' },
            ],
          },
          { code: '015502000', name: 'Urdaneta City', barangays: [{ code: '015502001', name: 'Poblacion' }, { code: '015502002', name: 'Nancayasan' }] },
          { code: '015503000', name: 'San Carlos City', barangays: [{ code: '015503001', name: 'Poblacion' }] },
          { code: '015504000', name: 'Alaminos City', barangays: [{ code: '015504001', name: 'Poblacion' }, { code: '015504002', name: 'Lucap (Hundred Islands)' }] },
          { code: '015505000', name: 'Lingayen', barangays: [{ code: '015505001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 4. Region II - Cagayan Valley
  {
    code: '020000000',
    name: 'Region II - Cagayan Valley',
    regionName: 'Cagayan Valley',
    provinces: [
      {
        code: '021500000',
        name: 'Cagayan',
        cities: [
          {
            code: '021501000',
            name: 'Tuguegarao City',
            barangays: [
              { code: '021501001', name: 'Centro 1 (Poblacion)' },
              { code: '021501002', name: 'Carig Sur' },
              { code: '021501003', name: 'Ugac Sur' },
            ],
          },
          { code: '021502000', name: 'Aparri', barangays: [{ code: '021502001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '023100000',
        name: 'Isabela',
        cities: [
          { code: '023101000', name: 'Cauayan City', barangays: [{ code: '023101001', name: 'Poblacion' }, { code: '023101002', name: 'San Fermin' }] },
          { code: '023102000', name: 'Santiago City', barangays: [{ code: '023102001', name: 'Centro West' }, { code: '023102002', name: 'Calaocan' }] },
          { code: '023103000', name: 'Ilagan City', barangays: [{ code: '023103001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '025000000',
        name: 'Nueva Vizcaya',
        cities: [
          { code: '025001000', name: 'Bayombong', barangays: [{ code: '025001001', name: 'Poblacion' }] },
          { code: '025002000', name: 'Solano', barangays: [{ code: '025002001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '025700000',
        name: 'Quirino',
        cities: [
          { code: '025701000', name: 'Cabarroguis', barangays: [{ code: '025701001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '020900000',
        name: 'Batanes',
        cities: [
          { code: '020901000', name: 'Basco', barangays: [{ code: '020901001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 5. Region III - Central Luzon
  {
    code: '030000000',
    name: 'Region III - Central Luzon',
    regionName: 'Central Luzon',
    provinces: [
      {
        code: '031400000',
        name: 'Bulacan',
        cities: [
          {
            code: '031401000',
            name: 'Malolos City',
            barangays: [
              { code: '031401001', name: 'Catmon' },
              { code: '031401002', name: 'Guinhawa' },
              { code: '031401003', name: 'San Gabriel' },
              { code: '031401004', name: 'Santo Rosario' },
            ],
          },
          { code: '031402000', name: 'Meycauayan City', barangays: [{ code: '031402001', name: 'Calvario' }, { code: '031402002', name: 'Poblacion' }] },
          { code: '031403000', name: 'San Jose del Monte City', barangays: [{ code: '031403001', name: 'Tungkong Mangga' }, { code: '031403002', name: 'Muzon' }] },
          { code: '031404000', name: 'Baliwag City', barangays: [{ code: '031404001', name: 'Poblacion' }] },
          { code: '031405000', name: 'Marilao', barangays: [{ code: '031405001', name: 'Abangan Norte' }, { code: '031405002', name: 'Ibayo' }] },
          { code: '031406000', name: 'Santa Maria', barangays: [{ code: '031406001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '035400000',
        name: 'Pampanga',
        cities: [
          {
            code: '035401000',
            name: 'Angeles City',
            barangays: [
              { code: '035401001', name: 'Balibago' },
              { code: '035401002', name: 'Lourdes Sur' },
              { code: '035401003', name: 'Sto. Rosario (Poblacion)' },
            ],
          },
          {
            code: '035402000',
            name: 'San Fernando City',
            barangays: [
              { code: '035402001', name: 'Dolores' },
              { code: '035402002', name: 'San Jose' },
              { code: '035402003', name: 'Sindalan' },
            ],
          },
          { code: '035403000', name: 'Mabalacat City', barangays: [{ code: '035403001', name: 'Dau' }, { code: '035403002', name: 'Poblacion' }] },
          { code: '035404000', name: 'Guagua', barangays: [{ code: '035404001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '034900000',
        name: 'Nueva Ecija',
        cities: [
          { code: '034901000', name: 'Cabanatuan City', barangays: [{ code: '034901001', name: 'Poblacion Norte' }, { code: '034901002', name: 'Magsaysay' }] },
          { code: '034902000', name: 'Gapan City', barangays: [{ code: '034902001', name: 'San Vicente' }] },
          { code: '034903000', name: 'Science City of Muñoz', barangays: [{ code: '034903001', name: 'Poblacion East' }] },
        ],
      },
      {
        code: '036900000',
        name: 'Tarlac',
        cities: [
          { code: '036901000', name: 'Tarlac City', barangays: [{ code: '036901001', name: 'San Vicente' }, { code: '036901002', name: 'Fairview' }] },
          { code: '036902000', name: 'Capas', barangays: [{ code: '036902001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '037100000',
        name: 'Zambales',
        cities: [
          { code: '037101000', name: 'Olongapo City', barangays: [{ code: '037101001', name: 'Barretto' }, { code: '037101002', name: 'East Tapinac' }] },
          { code: '037102000', name: 'Subic', barangays: [{ code: '037102001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '030800000',
        name: 'Bataan',
        cities: [
          { code: '030801000', name: 'Balanga City', barangays: [{ code: '030801001', name: 'Poblacion' }] },
          { code: '030802000', name: 'Mariveles', barangays: [{ code: '030802001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '037700000',
        name: 'Aurora',
        cities: [
          { code: '037701000', name: 'Baler', barangays: [{ code: '037701001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 6. Region IV-A - CALABARZON
  {
    code: '040000000',
    name: 'Region IV-A - CALABARZON',
    regionName: 'CALABARZON',
    provinces: [
      {
        code: '042100000',
        name: 'Cavite',
        cities: [
          {
            code: '042101000',
            name: 'Dasmariñas City',
            barangays: [
              { code: '042101001', name: 'Burol' },
              { code: '042101002', name: 'Dasmariñas Vecinal' },
              { code: '042101003', name: 'Salawag' },
              { code: '042101004', name: 'Sampaloc I' },
            ],
          },
          {
            code: '042102000',
            name: 'Bacoor City',
            barangays: [
              { code: '042102001', name: 'Molino I' },
              { code: '042102002', name: 'Molino III' },
              { code: '042102003', name: 'Talaba I' },
            ],
          },
          {
            code: '042103000',
            name: 'Imus City',
            barangays: [
              { code: '042103001', name: 'Anabu I-A' },
              { code: '042103002', name: 'Bucandala I' },
              { code: '042103003', name: 'Poblacion' },
            ],
          },
          { code: '042104000', name: 'General Trias City', barangays: [{ code: '042104001', name: 'Manggahan' }, { code: '042104002', name: 'San Francisco' }] },
          { code: '042105000', name: 'Tagaytay City', barangays: [{ code: '042105001', name: 'Maharlika East' }, { code: '042105002', name: 'Silang Junction' }] },
        ],
      },
      {
        code: '043400000',
        name: 'Laguna',
        cities: [
          {
            code: '043401000',
            name: 'Calamba City',
            barangays: [
              { code: '043401001', name: 'Canlubang' },
              { code: '043401002', name: 'Poblacion' },
              { code: '043401003', name: 'Real' },
            ],
          },
          {
            code: '043402000',
            name: 'Santa Rosa City',
            barangays: [
              { code: '043402001', name: 'Balibago' },
              { code: '043402002', name: 'Don Jose' },
              { code: '043402003', name: 'Tagapo' },
            ],
          },
          { code: '043403000', name: 'Biñan City', barangays: [{ code: '043403001', name: 'San Antonio' }, { code: '043403002', name: 'Poblacion' }] },
          { code: '043404000', name: 'San Pedro City', barangays: [{ code: '043404001', name: 'Pacita I' }, { code: '043404002', name: 'Poblacion' }] },
          { code: '043405000', name: 'Cabuyao City', barangays: [{ code: '043405001', name: 'Pulo' }, { code: '043405002', name: 'Poblacion' }] },
          { code: '043406000', name: 'Los Baños', barangays: [{ code: '043406001', name: 'Batong Malake' }, { code: '043406002', name: 'Mayldon' }] },
        ],
      },
      {
        code: '041000000',
        name: 'Batangas',
        cities: [
          { code: '041001000', name: 'Batangas City', barangays: [{ code: '041001001', name: 'Poblacion' }, { code: '041001002', name: 'Kumintang Ibaba' }] },
          { code: '041002000', name: 'Lipa City', barangays: [{ code: '041002001', name: 'Sabang' }, { code: '041002002', name: 'Poblacion' }] },
          { code: '041003000', name: 'Tanauan City', barangays: [{ code: '041003001', name: 'Poblacion' }] },
          { code: '041004000', name: 'Sto. Tomas City', barangays: [{ code: '041004001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '045800000',
        name: 'Rizal',
        cities: [
          {
            code: '045801000',
            name: 'Antipolo City',
            barangays: [
              { code: '045801001', name: 'Dela Paz (Poblacion)' },
              { code: '045801002', name: 'Mayamot' },
              { code: '045801003', name: 'San Roque' },
            ],
          },
          { code: '045802000', name: 'Taytay', barangays: [{ code: '045802001', name: 'San Juan' }, { code: '045802002', name: 'Dolores' }] },
          { code: '045803000', name: 'Cainta', barangays: [{ code: '045803001', name: 'San Isidro' }, { code: '045803002', name: 'San Andres' }] },
          { code: '045804000', name: 'San Mateo', barangays: [{ code: '045804001', name: 'Ampid' }, { code: '045804002', name: 'Poblacion' }] },
        ],
      },
      {
        code: '045600000',
        name: 'Quezon',
        cities: [
          { code: '045601000', name: 'Lucena City', barangays: [{ code: '045601001', name: 'Ilayang Dupay' }, { code: '045601002', name: 'Poblacion' }] },
          { code: '045602000', name: 'Tayabas City', barangays: [{ code: '045602001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 7. Region IV-B - MIMAROPA
  {
    code: '170000000',
    name: 'Region IV-B - MIMAROPA Region',
    regionName: 'MIMAROPA Region',
    provinces: [
      {
        code: '175300000',
        name: 'Palawan',
        cities: [
          {
            code: '175301000',
            name: 'Puerto Princesa City',
            barangays: [
              { code: '175301001', name: 'San Jose' },
              { code: '175301002', name: 'San Pedro' },
              { code: '175301003', name: 'Poblacion' },
            ],
          },
          { code: '175302000', name: 'El Nido', barangays: [{ code: '175302001', name: 'Poblacion (Buena Suerte)' }, { code: '175302002', name: 'Corong-Corong' }] },
          { code: '175303000', name: 'Coron', barangays: [{ code: '175303001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '175200000',
        name: 'Oriental Mindoro',
        cities: [
          { code: '175201000', name: 'Calapan City', barangays: [{ code: '175201001', name: 'Poblacion' }, { code: '175201002', name: 'Lumangbayan' }] },
          { code: '175202000', name: 'Puerto Galera', barangays: [{ code: '175202001', name: 'Poblacion' }, { code: '175202002', name: 'Sabang' }] },
        ],
      },
      {
        code: '175100000',
        name: 'Occidental Mindoro',
        cities: [
          { code: '175101000', name: 'San Jose', barangays: [{ code: '175101001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '174000000',
        name: 'Marinduque',
        cities: [
          { code: '174001000', name: 'Boac', barangays: [{ code: '174001001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '175900000',
        name: 'Romblon',
        cities: [
          { code: '175901000', name: 'Romblon', barangays: [{ code: '175901001', name: 'Poblacion' }] },
          { code: '175902000', name: 'Odiongan', barangays: [{ code: '175902001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 8. Region V - Bicol Region
  {
    code: '050000000',
    name: 'Region V - Bicol Region',
    regionName: 'Bicol Region',
    provinces: [
      {
        code: '050500000',
        name: 'Albay',
        cities: [
          {
            code: '050501000',
            name: 'Legazpi City',
            barangays: [
              { code: '050501001', name: 'Binanuahan' },
              { code: '050501002', name: 'Rawis' },
              { code: '050501003', name: 'Poblacion' },
            ],
          },
          { code: '050502000', name: 'Daraga', barangays: [{ code: '050502001', name: 'Poblacion' }, { code: '050502002', name: 'Sagpon' }] },
          { code: '050503000', name: 'Tabaco City', barangays: [{ code: '050503001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '051700000',
        name: 'Camarines Sur',
        cities: [
          {
            code: '051701000',
            name: 'Naga City',
            barangays: [
              { code: '051701001', name: 'Concepcion Pequeña' },
              { code: '051701002', name: 'San Francisco' },
              { code: '051701003', name: 'Triangulo' },
            ],
          },
          { code: '051702000', name: 'Iriga City', barangays: [{ code: '051702001', name: 'Poblacion' }] },
          { code: '051703000', name: 'Pili', barangays: [{ code: '051703001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '051600000',
        name: 'Camarines Norte',
        cities: [
          { code: '051601000', name: 'Daet', barangays: [{ code: '051601001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '056200000',
        name: 'Sorsogon',
        cities: [
          { code: '056201000', name: 'Sorsogon City', barangays: [{ code: '056201001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '052000000',
        name: 'Catanduanes',
        cities: [
          { code: '052001000', name: 'Virac', barangays: [{ code: '052001001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '054100000',
        name: 'Masbate',
        cities: [
          { code: '054101000', name: 'Masbate City', barangays: [{ code: '054101001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 9. Region VI - Western Visayas
  {
    code: '060000000',
    name: 'Region VI - Western Visayas',
    regionName: 'Western Visayas',
    provinces: [
      {
        code: '063000000',
        name: 'Iloilo',
        cities: [
          {
            code: '063022000',
            name: 'Iloilo City',
            barangays: [
              { code: '063022001', name: 'Arevalo' },
              { code: '063022002', name: 'City Proper' },
              { code: '063022003', name: 'Jaro' },
              { code: '063022004', name: 'La Paz' },
              { code: '063022005', name: 'Mandurriao' },
              { code: '063022006', name: 'Molo' },
            ],
          },
          { code: '063001000', name: 'Passi City', barangays: [{ code: '063001001', name: 'Poblacion' }] },
          { code: '063002000', name: 'Oton', barangays: [{ code: '063002001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '064500000',
        name: 'Negros Occidental',
        cities: [
          {
            code: '064501000',
            name: 'Bacolod City',
            barangays: [
              { code: '064501001', name: 'Alijis' },
              { code: '064501002', name: 'Bata' },
              { code: '064501003', name: 'Mandalagan' },
              { code: '064501004', name: 'Mansilingan' },
              { code: '064501005', name: 'Singcang-Airport' },
            ],
          },
          { code: '064502000', name: 'Talisay City', barangays: [{ code: '064502001', name: 'Poblacion' }] },
          { code: '064503000', name: 'Silay City', barangays: [{ code: '064503001', name: 'Poblacion' }] },
          { code: '064504000', name: 'Kabankalan City', barangays: [{ code: '064504001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '060400000',
        name: 'Aklan',
        cities: [
          { code: '060401000', name: 'Kalibo', barangays: [{ code: '060401001', name: 'Poblacion' }] },
          { code: '060402000', name: 'Malay (Boracay Island)', barangays: [{ code: '060402001', name: 'Balabag (Boracay Station 1)' }, { code: '060402002', name: 'Manoc-Manoc (Boracay Station 3)' }, { code: '060402003', name: 'Yapak' }] },
        ],
      },
      {
        code: '060600000',
        name: 'Antique',
        cities: [
          { code: '060601000', name: 'San Jose de Buenavista', barangays: [{ code: '060601001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '061900000',
        name: 'Capiz',
        cities: [
          { code: '061901000', name: 'Roxas City', barangays: [{ code: '061901001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '067900000',
        name: 'Guimaras',
        cities: [
          { code: '067901000', name: 'Jordan', barangays: [{ code: '067901001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 10. Region VII - Central Visayas
  {
    code: '070000000',
    name: 'Region VII - Central Visayas',
    regionName: 'Central Visayas',
    provinces: [
      {
        code: '072200000',
        name: 'Cebu',
        cities: [
          {
            code: '072217000',
            name: 'Cebu City',
            barangays: [
              { code: '072217001', name: 'Lahug' },
              { code: '072217002', name: 'Mabolo' },
              { code: '072217003', name: 'Guadalupe' },
              { code: '072217004', name: 'Banilad' },
              { code: '072217005', name: 'Talamban' },
              { code: '072217006', name: 'Pardo' },
            ],
          },
          {
            code: '072230000',
            name: 'Mandaue City',
            barangays: [
              { code: '072230001', name: 'Banilad' },
              { code: '072230002', name: 'Centro' },
              { code: '072230003', name: 'Subangdaku' },
              { code: '072230004', name: 'Tipolo' },
            ],
          },
          {
            code: '072226000',
            name: 'Lapu-Lapu City (Mactan)',
            barangays: [
              { code: '072226001', name: 'Basak' },
              { code: '072226002', name: 'Mactan' },
              { code: '072226003', name: 'Pusok' },
            ],
          },
          { code: '072250000', name: 'Talisay City', barangays: [{ code: '072250001', name: 'Poblacion' }] },
          { code: '072251000', name: 'Consolacion', barangays: [{ code: '072251001', name: 'Poblacion' }] },
          { code: '072252000', name: 'Liloan', barangays: [{ code: '072252001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '071200000',
        name: 'Bohol',
        cities: [
          { code: '071201000', name: 'Tagbilaran City', barangays: [{ code: '071201001', name: 'Poblacion' }, { code: '071201002', name: 'Cogon' }] },
          { code: '071202000', name: 'Panglao Island', barangays: [{ code: '071202001', name: 'Poblacion' }, { code: '071202002', name: 'Tawala (Alona Beach)' }] },
        ],
      },
      {
        code: '074600000',
        name: 'Negros Oriental',
        cities: [
          { code: '074601000', name: 'Dumaguete City', barangays: [{ code: '074601001', name: 'Poblacion' }, { code: '074601002', name: 'Daro' }] },
          { code: '074602000', name: 'Bais City', barangays: [{ code: '074602001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '076100000',
        name: 'Siquijor',
        cities: [
          { code: '076101000', name: 'Siquijor', barangays: [{ code: '076101001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 11. Region VIII - Eastern Visayas
  {
    code: '080000000',
    name: 'Region VIII - Eastern Visayas',
    regionName: 'Eastern Visayas',
    provinces: [
      {
        code: '083700000',
        name: 'Leyte',
        cities: [
          {
            code: '083701000',
            name: 'Tacloban City',
            barangays: [
              { code: '083701001', name: 'Downtown (Poblacion)' },
              { code: '083701002', name: 'San Jose' },
              { code: '083701003', name: 'Marasbaras' },
            ],
          },
          { code: '083702000', name: 'Ormoc City', barangays: [{ code: '083702001', name: 'Poblacion' }] },
          { code: '083703000', name: 'Baybay City', barangays: [{ code: '083703001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '086400000',
        name: 'Southern Leyte',
        cities: [
          { code: '086401000', name: 'Maasin City', barangays: [{ code: '086401001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '086000000',
        name: 'Samar (Western Samar)',
        cities: [
          { code: '086001000', name: 'Calbayog City', barangays: [{ code: '086001001', name: 'Poblacion' }] },
          { code: '086002000', name: 'Catbalogan City', barangays: [{ code: '086002001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '084800000',
        name: 'Northern Samar',
        cities: [
          { code: '084801000', name: 'Catarman', barangays: [{ code: '084801001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '082600000',
        name: 'Eastern Samar',
        cities: [
          { code: '082601000', name: 'Borongan City', barangays: [{ code: '082601001', name: 'Poblacion' }] },
          { code: '082602000', name: 'Guiuan', barangays: [{ code: '082602001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '087800000',
        name: 'Biliran',
        cities: [
          { code: '087801000', name: 'Naval', barangays: [{ code: '087801001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 12. Region IX - Zamboanga Peninsula
  {
    code: '090000000',
    name: 'Region IX - Zamboanga Peninsula',
    regionName: 'Zamboanga Peninsula',
    provinces: [
      {
        code: '097300000',
        name: 'Zamboanga del Sur',
        cities: [
          {
            code: '097301000',
            name: 'Zamboanga City',
            barangays: [
              { code: '097301001', name: 'Tetuan' },
              { code: '097301002', name: 'Canelar' },
              { code: '097301003', name: 'Santa Maria' },
              { code: '097301004', name: 'Pasonanca' },
              { code: '097301005', name: 'Tumaga' },
            ],
          },
          { code: '097302000', name: 'Pagadian City', barangays: [{ code: '097302001', name: 'Poblacion' }, { code: '097302002', name: 'San Pedro' }] },
        ],
      },
      {
        code: '097200000',
        name: 'Zamboanga del Norte',
        cities: [
          { code: '097201000', name: 'Dipolog City', barangays: [{ code: '097201001', name: 'Poblacion' }] },
          { code: '097202000', name: 'Dapitan City', barangays: [{ code: '097202001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '098300000',
        name: 'Zamboanga Sibugay',
        cities: [
          { code: '098301000', name: 'Ipil', barangays: [{ code: '098301001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 13. Region X - Northern Mindanao
  {
    code: '100000000',
    name: 'Region X - Northern Mindanao',
    regionName: 'Northern Mindanao',
    provinces: [
      {
        code: '104300000',
        name: 'Misamis Oriental',
        cities: [
          {
            code: '104305000',
            name: 'Cagayan de Oro City',
            barangays: [
              { code: '104305001', name: 'Balulang' },
              { code: '104305003', name: 'Bugo' },
              { code: '104305004', name: 'Bulua' },
              { code: '104305007', name: 'Carmen' },
              { code: '104305010', name: 'Kauswagan' },
              { code: '104305011', name: 'Lapasan' },
              { code: '104305014', name: 'Nazareth' },
            ],
          },
          { code: '104301000', name: 'Gingoog City', barangays: [{ code: '104301001', name: 'Poblacion' }] },
          { code: '104302000', name: 'El Salvador City', barangays: [{ code: '104302001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '101300000',
        name: 'Bukidnon',
        cities: [
          { code: '101301000', name: 'Malaybalay City', barangays: [{ code: '101301001', name: 'Poblacion' }] },
          { code: '101302000', name: 'Valencia City', barangays: [{ code: '101302001', name: 'Poblacion' }] },
          { code: '101303000', name: 'Manolo Fortich', barangays: [{ code: '101303001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '103500000',
        name: 'Lanao del Norte',
        cities: [
          { code: '103501000', name: 'Iligan City', barangays: [{ code: '103501001', name: 'Poblacion' }, { code: '103501002', name: 'Tibanga' }, { code: '103501003', name: 'Pala-o' }] },
        ],
      },
      {
        code: '104200000',
        name: 'Misamis Occidental',
        cities: [
          { code: '104201000', name: 'Ozamiz City', barangays: [{ code: '104201001', name: 'Poblacion' }] },
          { code: '104202000', name: 'Oroquieta City', barangays: [{ code: '104202001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '101800000',
        name: 'Camiguin',
        cities: [
          { code: '101801000', name: 'Mambajao', barangays: [{ code: '101801001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 14. Region XI - Davao Region
  {
    code: '110000000',
    name: 'Region XI - Davao Region',
    regionName: 'Davao Region',
    provinces: [
      {
        code: '112400000',
        name: 'Davao del Sur',
        cities: [
          {
            code: '112402000',
            name: 'Davao City',
            barangays: [
              // Buhangin District
              { code: '112402001', name: 'Alfonso Angliongto Sr.' },
              { code: '112402002', name: 'Buhangin Proper' },
              { code: '112402003', name: 'Cabantian' },
              { code: '112402004', name: 'Communal' },
              { code: '112402005', name: 'Indangan' },
              { code: '112402006', name: 'Lapu-Lapu' },
              { code: '112402008', name: 'Pampanga' },
              { code: '112402009', name: 'Sasa' },
              { code: '112402010', name: 'Tigatto' },
              // Poblacion District
              { code: '112402020', name: 'Barangay 1-A (Poblacion)' },
              { code: '112402021', name: 'Barangay 2-A (Poblacion)' },
              { code: '112402022', name: 'Barangay 3-A (Poblacion)' },
              { code: '112402023', name: 'Barangay 4-A (Poblacion)' },
              { code: '112402024', name: 'Barangay 5-A (Poblacion)' },
              { code: '112402025', name: 'Barangay 6-A (Poblacion)' },
              { code: '112402026', name: 'Barangay 7-A (Poblacion)' },
              { code: '112402027', name: 'Barangay 8-A (Poblacion)' },
              { code: '112402028', name: 'Barangay 9-A (Poblacion)' },
              { code: '112402029', name: 'Barangay 10-A (Poblacion)' },
              // Talomo District
              { code: '112402070', name: 'Bago Aplaya' },
              { code: '112402071', name: 'Bago Gallera' },
              { code: '112402072', name: 'Baliwasan' },
              { code: '112402073', name: 'Catalunan Grande' },
              { code: '112402074', name: 'Catalunan Pequeño' },
              { code: '112402075', name: 'Dumoy' },
              { code: '112402076', name: 'Langub' },
              { code: '112402077', name: 'Ma-a' },
              { code: '112402078', name: 'Matina Aplaya' },
              { code: '112402079', name: 'Matina Crossing' },
              { code: '112402080', name: 'Matina Pangi' },
              { code: '112402081', name: 'Talomo Proper' },
              // Agdao District
              { code: '112402090', name: 'Agdao Proper' },
              { code: '112402091', name: 'Centro (San Juan)' },
              { code: '112402092', name: 'Gov. Paciano Bangoy' },
              { code: '112402093', name: 'Lapu-Lapu (Agdao)' },
              { code: '112402094', name: 'San Antonio' },
              { code: '112402095', name: 'Vicente Hizon Sr.' },
              // Toril District
              { code: '112402100', name: 'Toril Proper' },
              { code: '112402101', name: 'Daliao' },
              { code: '112402102', name: 'Lizada' },
              { code: '112402103', name: 'Mulig' },
              // Calinan / Mintal District
              { code: '112402110', name: 'Mintal' },
              { code: '112402111', name: 'Tugbok Proper' },
              { code: '112402112', name: 'Calinan Proper' },
            ],
          },
          {
            code: '112403000',
            name: 'Digos City',
            barangays: [
              { code: '112403001', name: 'Zone 1 (Poblacion)' },
              { code: '112403002', name: 'Zone 2 (Poblacion)' },
              { code: '112403003', name: 'Zone 3 (Poblacion)' },
              { code: '112403004', name: 'Tres de Mayo' },
              { code: '112403005', name: 'Aplaya' },
            ],
          },
          { code: '112404000', name: 'Bansalan', barangays: [{ code: '112404001', name: 'Poblacion' }] },
          { code: '112405000', name: 'Santa Cruz', barangays: [{ code: '112405001', name: 'Poblacion' }, { code: '112405002', name: 'Darong' }] },
        ],
      },
      {
        code: '112300000',
        name: 'Davao del Norte',
        cities: [
          {
            code: '112319000',
            name: 'Tagum City',
            barangays: [
              { code: '112319001', name: 'Magugpo Poblacion' },
              { code: '112319002', name: 'Magugpo East' },
              { code: '112319003', name: 'Magugpo North' },
              { code: '112319004', name: 'Visayan Village' },
              { code: '112319005', name: 'Apokon' },
            ],
          },
          { code: '112315000', name: 'Panabo City', barangays: [{ code: '112315001', name: 'Santo Niño' }, { code: '112315002', name: 'San Francisco' }] },
          { code: '112317000', name: 'Samal Island (IGACOS)', barangays: [{ code: '112317001', name: 'Peñaplata' }, { code: '112317002', name: 'Babak' }, { code: '112317003', name: 'Kaputian' }] },
        ],
      },
      {
        code: '118200000',
        name: 'Davao de Oro (Compostela Valley)',
        cities: [
          { code: '118201000', name: 'Nabunturan', barangays: [{ code: '118201001', name: 'Poblacion' }] },
          { code: '118202000', name: 'Monkayo', barangays: [{ code: '118202001', name: 'Poblacion' }] },
          { code: '118203000', name: 'Pantukan', barangays: [{ code: '118203001', name: 'Kingking (Poblacion)' }] },
        ],
      },
      {
        code: '112500000',
        name: 'Davao Oriental',
        cities: [
          { code: '112501000', name: 'Mati City', barangays: [{ code: '112501001', name: 'Central (Poblacion)' }, { code: '112501002', name: 'Dahican' }] },
          { code: '112502000', name: 'Lupon', barangays: [{ code: '112502001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '118600000',
        name: 'Davao Occidental',
        cities: [
          { code: '118601000', name: 'Malita', barangays: [{ code: '118601001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 15. Region XII - SOCCSKSARGEN
  {
    code: '120000000',
    name: 'Region XII - SOCCSKSARGEN',
    regionName: 'SOCCSKSARGEN',
    provinces: [
      {
        code: '126300000',
        name: 'South Cotabato',
        cities: [
          {
            code: '126303000',
            name: 'General Santos City',
            barangays: [
              { code: '126303001', name: 'Apopong' },
              { code: '126303002', name: 'Calumpang' },
              { code: '126303003', name: 'City Heights' },
              { code: '126303004', name: 'Dadiangas East' },
              { code: '126303005', name: 'Dadiangas North' },
              { code: '126303006', name: 'Lagao' },
              { code: '126303007', name: 'San Isidro' },
            ],
          },
          { code: '126306000', name: 'Koronadal City', barangays: [{ code: '126306001', name: 'Zone I (Poblacion)' }, { code: '126306002', name: 'Zone II (Poblacion)' }] },
          { code: '126307000', name: 'Polomolok', barangays: [{ code: '126307001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '124700000',
        name: 'Cotabato (North Cotabato)',
        cities: [
          { code: '124701000', name: 'Kidapawan City', barangays: [{ code: '124701001', name: 'Poblacion' }] },
          { code: '124702000', name: 'Midsayap', barangays: [{ code: '124702001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '126500000',
        name: 'Sultan Kudarat',
        cities: [
          { code: '126501000', name: 'Tacurong City', barangays: [{ code: '126501001', name: 'Poblacion' }] },
          { code: '126502000', name: 'Isulan', barangays: [{ code: '126502001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '128000000',
        name: 'Sarangani',
        cities: [
          { code: '128001000', name: 'Alabel', barangays: [{ code: '128001001', name: 'Poblacion' }] },
          { code: '128002000', name: 'Glan', barangays: [{ code: '128002001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 16. Region XIII - Caraga Region
  {
    code: '160000000',
    name: 'Region XIII - Caraga Region',
    regionName: 'Caraga Region',
    provinces: [
      {
        code: '160200000',
        name: 'Agusan del Norte',
        cities: [
          {
            code: '160201000',
            name: 'Butuan City',
            barangays: [
              { code: '160201001', name: 'Bayanihan' },
              { code: '160201002', name: 'Doongan' },
              { code: '160201003', name: 'Libertad' },
              { code: '160201004', name: 'San Vicente' },
            ],
          },
          { code: '160202000', name: 'Cabadbaran City', barangays: [{ code: '160202001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '160300000',
        name: 'Agusan del Sur',
        cities: [
          { code: '160301000', name: 'Bayugan City', barangays: [{ code: '160301001', name: 'Poblacion' }] },
          { code: '160302000', name: 'San Francisco', barangays: [{ code: '160302001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '166700000',
        name: 'Surigao del Norte',
        cities: [
          { code: '166701000', name: 'Surigao City', barangays: [{ code: '166701001', name: 'Poblacion' }, { code: '166701002', name: 'Taft' }] },
          { code: '166702000', name: 'General Luna (Siargao Island)', barangays: [{ code: '166702001', name: 'Poblacion 1' }, { code: '166702002', name: 'Cloud 9 Area' }] },
        ],
      },
      {
        code: '166800000',
        name: 'Surigao del Sur',
        cities: [
          { code: '166801000', name: 'Bislig City', barangays: [{ code: '166801001', name: 'Mangagoy' }, { code: '166801002', name: 'Poblacion' }] },
          { code: '166802000', name: 'Tandag City', barangays: [{ code: '166802001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '168500000',
        name: 'Dinagat Islands',
        cities: [
          { code: '168501000', name: 'San Jose', barangays: [{ code: '168501001', name: 'Poblacion' }] },
        ],
      },
    ],
  },

  // 17. BARMM - Bangsamoro Autonomous Region in Muslim Mindanao
  {
    code: '190000000',
    name: 'BARMM - Bangsamoro Autonomous Region in Muslim Mindanao',
    regionName: 'BARMM',
    provinces: [
      {
        code: '193800000',
        name: 'Maguindanao del Norte & Sur',
        cities: [
          {
            code: '193801000',
            name: 'Cotabato City',
            barangays: [
              { code: '193801001', name: 'Poblacion 1' },
              { code: '193801002', name: 'Rosary Heights 1' },
              { code: '193801003', name: 'Tamontaka 1' },
            ],
          },
          { code: '193802000', name: 'Sultan Kudarat', barangays: [{ code: '193802001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '193600000',
        name: 'Lanao del Sur',
        cities: [
          { code: '193601000', name: 'Marawi City', barangays: [{ code: '193601001', name: 'Marawi Poblacion' }, { code: '193601002', name: 'Bangcolo' }] },
        ],
      },
      {
        code: '190700000',
        name: 'Basilan',
        cities: [
          { code: '190701000', name: 'Isabela City', barangays: [{ code: '190701001', name: 'Poblacion' }] },
          { code: '190702000', name: 'Lamitan City', barangays: [{ code: '190702001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '196600000',
        name: 'Sulu',
        cities: [
          { code: '196601000', name: 'Jolo', barangays: [{ code: '196601001', name: 'Poblacion' }] },
        ],
      },
      {
        code: '197000000',
        name: 'Tawi-Tawi',
        cities: [
          { code: '197001000', name: 'Bongao', barangays: [{ code: '197001001', name: 'Poblacion' }] },
        ],
      },
    ],
  },
];
