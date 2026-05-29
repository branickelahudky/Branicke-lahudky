export const STORAGE_TEMP_LABELS: Record<string, string> = {
  FROZEN: 'Mraženo (-18°C)',
  REFRIGERATED: 'Chladnička (0-5°C)',
  COOL: 'Chladno (do 14°C)',
  ROOM_TEMP: 'Pokojová teplota',
}

export const ALLERGENS = [
  { code: '1', name: 'Lepek', detail: 'pšenice, žito, ječmen, oves' },
  { code: '2', name: 'Korýši', detail: 'krevety, krabi, raci...' },
  { code: '3', name: 'Vejce', detail: undefined },
  { code: '4', name: 'Ryby', detail: undefined },
  { code: '5', name: 'Arašídy', detail: undefined },
  { code: '6', name: 'Sója', detail: undefined },
  { code: '7', name: 'Mléko', detail: 'včetně laktózy' },
  { code: '8', name: 'Skořápkové plody', detail: 'mandle, lískové ořechy, vlašské ořechy...' },
  { code: '9', name: 'Celer', detail: undefined },
  { code: '10', name: 'Hořčice', detail: undefined },
  { code: '11', name: 'Sezam', detail: undefined },
  { code: '12', name: 'Oxid siřičitý a siřičitany', detail: undefined },
  { code: '13', name: 'Vlčí bob (lupina)', detail: undefined },
  { code: '14', name: 'Měkkýši', detail: undefined },
]

export const COUNTRIES = [
  { code: 'CZ', name: 'Česká republika' },
  { code: 'SK', name: 'Slovensko' },
  { code: 'DE', name: 'Německo' },
  { code: 'AT', name: 'Rakousko' },
  { code: 'PL', name: 'Polsko' },
  { code: 'IT', name: 'Itálie' },
  { code: 'FR', name: 'Francie' },
  { code: 'ES', name: 'Španělsko' },
  { code: 'HU', name: 'Maďarsko' },
  { code: 'NL', name: 'Nizozemsko' },
  { code: 'BE', name: 'Belgie' },
  { code: 'PT', name: 'Portugalsko' },
  { code: 'GR', name: 'Řecko' },
  { code: 'RO', name: 'Rumunsko' },
  { code: 'HR', name: 'Chorvatsko' },
  { code: 'DK', name: 'Dánsko' },
  { code: 'SE', name: 'Švédsko' },
  { code: 'NO', name: 'Norsko' },
]
