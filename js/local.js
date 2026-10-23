// Help near the user, picked from the city the weather app is showing.
// Everything is bundled here so looking up help never sends anything over the network.
//
// State coalitions come from NNEDV's list of State and U.S. Territorial Coalitions
// (nnedv.org/content/state-u-s-territory-coalitions), checked October 2026.
// Each coalition's site lists every domestic violence program in that state.

const COALITIONS = {
  'Alabama': ['Alabama Coalition Against Domestic Violence', 'https://www.acadv.org/'],
  'Alaska': ['Alaska Network on Domestic Violence and Sexual Assault', 'https://www.andvsa.org/'],
  'American Samoa': ['American Samoa Alliance Against Domestic and Sexual Violence', 'https://www.asalliance.co/'],
  'Arizona': ['Arizona Coalition to End Sexual and Domestic Violence', 'https://www.acesdv.org/'],
  'Arkansas': ['Arkansas Coalition Against Domestic Violence', 'https://www.domesticpeace.com/'],
  'California': ['California Partnership to End Domestic Violence', 'https://www.cpedv.org/'],
  'Colorado': ['Violence Free Colorado', 'https://www.violencefreecolorado.org/'],
  'Connecticut': ['Connecticut Coalition Against Domestic Violence', 'https://www.ctcadv.org/'],
  'Delaware': ['Delaware Coalition Against Domestic Violence', 'https://dcadv.org/'],
  'District of Columbia': ['DC Coalition Against Domestic Violence', 'https://www.dccadv.org/'],
  'Florida': ['Florida Partnership to End Domestic Violence', 'https://www.fpedv.org/'],
  'Georgia': ['Georgia Coalition Against Domestic Violence', 'https://gcadv.org/'],
  'Guam': ['Guam Coalition Against Sexual Assault & Family Violence', 'https://guamcoalition.org/'],
  'Hawaii': ['Hawaiʻi State Coalition Against Domestic Violence', 'https://www.hscadv.org/'],
  'Idaho': ['Idaho Coalition Against Sexual & Domestic Violence', 'https://idahocoalition.org/'],
  'Illinois': ['Illinois Coalition Against Domestic Violence', 'https://www.ilcadv.org/'],
  'Indiana': ['Indiana Coalition Against Domestic Violence', 'https://www.icadvinc.org/'],
  'Iowa': ['Iowa Coalition Against Domestic Violence', 'https://www.icadv.org/'],
  'Kansas': ['Kansas Coalition Against Sexual & Domestic Violence', 'https://www.kcsdv.org/'],
  'Kentucky': ['ZeroV (Kentucky Coalition Against Domestic Violence)', 'https://www.zerov.org/'],
  'Louisiana': ['Louisiana Coalition Against Domestic Violence', 'https://lcadv.org/'],
  'Maine': ['Maine Coalition to End Domestic Violence', 'https://www.mcedv.org/'],
  'Maryland': ['Maryland Network Against Domestic Violence', 'https://mnadv.org/'],
  'Massachusetts': ['Jane Doe Inc.', 'https://www.janedoe.org/'],
  'Michigan': ['Michigan Coalition to End Domestic & Sexual Violence', 'https://www.mcedsv.org/'],
  'Minnesota': ['Violence Free Minnesota', 'https://www.vfmn.org/'],
  'Mississippi': ['Mississippi Coalition Against Domestic Violence', 'https://mcadv.org/'],
  'Missouri': ['Missouri Coalition Against Domestic and Sexual Violence', 'https://www.mocadsv.org/'],
  'Montana': ['Montana Coalition Against Domestic & Sexual Violence', 'https://mcadsv.com/'],
  'Nebraska': ['Nebraska Coalition to End Sexual and Domestic Violence', 'https://www.nebraskacoalition.org/'],
  'Nevada': ['Nevada Coalition to End Domestic and Sexual Violence', 'https://www.ncedsv.org/'],
  'New Hampshire': ['New Hampshire Coalition Against Domestic & Sexual Violence', 'https://www.nhcadsv.org/'],
  'New Jersey': ['New Jersey Coalition to End Domestic Violence', 'https://www.njcedv.org/'],
  'New Mexico': ['New Mexico Coalition Against Domestic Violence', 'https://www.nmcadv.org/'],
  'New York': ['New York State Coalition Against Domestic Violence', 'https://www.nyscadv.org/'],
  'North Carolina': ['North Carolina Coalition Against Domestic Violence', 'https://nccadv.org/'],
  'North Dakota': ['North Dakota Domestic & Sexual Violence Coalition', 'https://nddsvc.org/'],
  'Northern Mariana Islands': ['Northern Marianas Coalition Against Domestic & Sexual Violence', 'https://www.facebook.com/EndViolenceNMI/'],
  'Ohio': ['Ohio Domestic Violence Network', 'https://www.odvn.org/'],
  // Oklahoma has no coalition on NNEDV's list; it points to the Attorney General's certified programs instead.
  'Oklahoma': ['Oklahoma Attorney General: certified victim services programs', 'https://www.oag.ok.gov/victim-services-list-oag-certified-programs'],
  'Oregon': ['Oregon Coalition Against Domestic & Sexual Violence', 'https://www.ocadsv.org/'],
  'Pennsylvania': ['Pennsylvania Coalition Against Domestic Violence', 'https://www.pcadv.org/'],
  'Puerto Rico': ['Coordinadora Paz para las Mujeres', 'https://pazparalasmujeres.org/'],
  'Rhode Island': ['Rhode Island Coalition Against Domestic Violence', 'https://www.ricadv.org/'],
  'South Carolina': ['South Carolina Coalition Against Domestic Violence and Sexual Assault', 'https://www.sccadvasa.org/'],
  'South Dakota': ['South Dakota Network Against Family Violence and Sexual Assault', 'https://www.sdnafvsa.com/'],
  'Tennessee': ['Tennessee Coalition to End Domestic & Sexual Violence', 'https://www.tncoalition.org/'],
  'Texas': ['Texas Council on Family Violence', 'https://tcfv.org/'],
  'Utah': ['Utah Domestic Violence Coalition', 'https://udvc.org/'],
  'Vermont': ['Vermont Network Against Domestic and Sexual Violence', 'https://vtnetwork.org/'],
  'Virginia': ['Virginia Sexual and Domestic Violence Action Alliance', 'https://www.vsdvalliance.org/'],
  'U.S. Virgin Islands': ['Virgin Islands Domestic Violence and Sexual Abuse Council', 'https://www.vidvsac.org/'],
  'Washington': ['Washington State Coalition Against Domestic Violence', 'https://wscadv.org/'],
  'West Virginia': ['West Virginia Coalition Against Domestic Violence', 'https://wvcadv.org/'],
  'Wisconsin': ['End Domestic Abuse Wisconsin', 'https://www.endabusewi.org/'],
  'Wyoming': ['Wyoming Coalition Against Domestic Violence & Sexual Assault', 'https://www.wyomingdvsa.org/'],
};

// Other spellings the weather app's place names might use
const ALIASES = {
  'D.C.': 'District of Columbia', 'DC': 'District of Columbia', 'Washington, D.C.': 'District of Columbia',
  'Hawaiʻi': 'Hawaii', 'Virgin Islands': 'U.S. Virgin Islands', 'United States Virgin Islands': 'U.S. Virgin Islands',
};

// Detailed local programs for specific areas, matched by a lat/lon box.
// Numbers checked on each organization's own website, October 2026.
const AREAS = [
  {
    name: 'Orange County, California',
    box: { south: 33.38, north: 33.95, west: -118.13, east: -117.41 },
    resources: [
      {
        name: 'Human Options',
        desc: { en: '24-hour hotline, emergency shelter, counseling and help for kids. Based in Irvine.', es: 'Línea de 24 horas, refugio de emergencia, consejería y ayuda para niños. En Irvine.' },
        call: '18778543594', callLabel: '877-854-3594',
        web: 'https://www.humanoptions.org/',
      },
      {
        name: 'Laura’s House',
        desc: { en: '24/7 crisis hotline, shelter, counseling and legal help across Orange County.', es: 'Línea de crisis 24/7, refugio, consejería y ayuda legal en todo el condado de Orange.' },
        call: '18664981511', callLabel: '866-498-1511',
        web: 'https://laurashouse.org/',
      },
      {
        name: 'Interval House',
        desc: { en: 'Crisis hotlines and shelter for Orange County and Long Beach.', es: 'Líneas de crisis y refugio para el condado de Orange y Long Beach.' },
        call: '15625944555', callLabel: '562-594-4555',
        alt: { call: '17148918121', callLabel: '714-891-8121' },
        web: 'https://www.intervalhouse.org/',
      },
    ],
  },
];

// The city the weather app last showed: { name, lat, lon } or null
export function currentPlace() {
  try { return JSON.parse(localStorage.getItem('breeze.prefs'))?.city || null; }
  catch { return null; }
}

function stateFrom(place) {
  const parts = place.name.split(',').map(s => s.trim());
  for (const p of [place.name, ...parts.reverse()]) {
    const key = ALIASES[p] || p;
    if (COALITIONS[key]) return key;
  }
  return null;
}

// Help near `place`: { area, resources, state, coalition } (any may be missing)
export function localHelp(place = currentPlace()) {
  if (!place) return null;
  const area = AREAS.find(a => place.lat >= a.box.south && place.lat <= a.box.north && place.lon >= a.box.west && place.lon <= a.box.east);
  const state = stateFrom(place);
  return {
    area: area?.name,
    resources: area?.resources || [],
    state,
    coalition: state ? { name: COALITIONS[state][0], web: COALITIONS[state][1] } : null,
  };
}
