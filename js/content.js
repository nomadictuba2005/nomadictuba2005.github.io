// Hotlines, checklists and lists for the notebook, in English and Spanish.
// Hotline numbers are US national services.
import { pick } from './i18n.js';

// Each text field is { en, es }; L() picks the current language (see pick in i18n.js).
const L = pick;

const RESOURCES = [
  {
    name: { en: 'National Domestic Violence Hotline', es: 'Línea Nacional sobre la Violencia Doméstica' },
    desc: {
      en: 'Open 24/7, free and confidential, in over 200 languages. They can help with safety plans and finding shelter.',
      es: 'Abierta 24/7, gratis y confidencial, en más de 200 idiomas. Pueden ayudarte con un plan de seguridad y a encontrar refugio.',
    },
    call: '18007997233', callLabel: '1-800-799-7233',
    text: { to: '88788', body: 'START', label: { en: 'Text START to 88788', es: 'Envía START al 88788' } },
    web: 'https://www.thehotline.org',
  },
  {
    name: { en: 'Emergency services', es: 'Emergencias' },
    desc: {
      en: 'If you’re in danger right now. Many areas also take texts to 911 when calling isn’t safe.',
      es: 'Si estás en peligro ahora mismo. En muchos lugares también puedes enviar un mensaje al 911 si no es seguro llamar.',
    },
    call: '911', callLabel: '911',
    text: { to: '911', body: '', label: { en: 'Text 911 (where available)', es: 'Mensaje al 911 (donde esté disponible)' } },
  },
  {
    name: { en: 'love is respect (teens & young adults)', es: 'love is respect (adolescentes y jóvenes)' },
    desc: {
      en: 'For teens and young adults dealing with dating abuse. Call, text or chat.',
      es: 'Para adolescentes y jóvenes que viven abuso en el noviazgo. Llama, envía un mensaje o chatea.',
    },
    call: '18663319474', callLabel: '1-866-331-9474',
    text: { to: '22522', body: 'LOVEIS', label: { en: 'Text LOVEIS to 22522', es: 'Envía LOVEIS al 22522' } },
    web: 'https://www.loveisrespect.org',
  },
  {
    name: { en: 'RAINN Sexual Assault Hotline', es: 'RAINN, línea sobre agresión sexual' },
    desc: { en: 'Confidential support any time, day or night.', es: 'Apoyo confidencial a cualquier hora, de día o de noche.' },
    call: '18006564673', callLabel: '1-800-656-4673',
    web: 'https://www.rainn.org',
  },
  {
    name: { en: '988 Suicide & Crisis Lifeline', es: '988 Línea de Prevención del Suicidio y Crisis' },
    desc: {
      en: 'If you’re thinking about hurting yourself, or it all feels like too much.',
      es: 'Si estás pensando en hacerte daño, o todo se siente demasiado. Para español, marca 2 o envía AYUDA al 988.',
    },
    call: '988', callLabel: '988',
    text: { to: '988', body: { en: '', es: 'AYUDA' }, label: { en: 'Text 988', es: 'Envía AYUDA al 988' } },
  },
  {
    name: { en: 'Childhelp National Child Abuse Hotline', es: 'Childhelp, línea nacional contra el abuso infantil' },
    desc: { en: 'For children, parents and anyone worried about a child.', es: 'Para niños, padres y cualquier persona preocupada por un niño.' },
    call: '18004224453', callLabel: '1-800-422-4453',
  },
  {
    name: { en: 'StrongHearts Native Helpline', es: 'StrongHearts Native Helpline' },
    desc: {
      en: 'Native advocates supporting American Indian and Alaska Native people.',
      es: 'Personas de apoyo nativas para indígenas de EE. UU. y nativos de Alaska.',
    },
    call: '18447628483', callLabel: '1-844-762-8483',
  },
];

// Stored by id so entries stay readable if the language changes.
const INCIDENT_TYPES = [
  ['physical', { en: 'Hit, pushed or hurt me', es: 'Me golpeó, empujó o lastimó' }],
  ['verbal', { en: 'Yelled, insulted or put me down', es: 'Me gritó, insultó o humilló' }],
  ['threats', { en: 'Threatened me', es: 'Me amenazó' }],
  ['sexual', { en: 'Forced or pressured me sexually', es: 'Me forzó o presionó sexualmente' }],
  ['stalking', { en: 'Followed or watched me', es: 'Me siguió o vigiló' }],
  ['money', { en: 'Controlled my money', es: 'Controló mi dinero' }],
  ['digital', { en: 'Checked my phone or accounts', es: 'Revisó mi teléfono o mis cuentas' }],
  ['property', { en: 'Broke or took my things', es: 'Rompió o se llevó mis cosas' }],
  ['kids', { en: 'Involved my kids', es: 'Involucró a mis hijos' }],
  ['other', { en: 'Something else', es: 'Otra cosa' }],
];

const PLAN = [
  {
    id: 'bag',
    title: { en: 'Pack a go-bag', es: 'Prepara una mochila de emergencia' },
    hint: {
      en: 'Things to grab if you have to leave in a hurry. Hide the bag, or keep it with someone you trust.',
      es: 'Cosas para llevarte si tienes que irte de prisa. Esconde la mochila o déjala con alguien de confianza.',
    },
    items: [
      ['id', { en: 'ID or driver’s license', es: 'Identificación o licencia de manejar' }],
      ['docs', { en: 'Birth certificates & Social Security cards', es: 'Actas de nacimiento y tarjetas del Seguro Social' }],
      ['passport', { en: 'Passports, visas or immigration papers', es: 'Pasaportes, visas o papeles de inmigración' }],
      ['cash', { en: 'Some cash, debit and credit cards', es: 'Algo de efectivo y tarjetas de débito y crédito' }],
      ['keys', { en: 'Spare house and car keys', es: 'Llaves extra de la casa y del carro' }],
      ['meds', { en: 'Medications and prescriptions', es: 'Medicinas y recetas' }],
      ['charger', { en: 'Phone charger', es: 'Cargador del teléfono' }],
      ['numbers', { en: 'Important phone numbers written on paper', es: 'Números importantes escritos en papel' }],
      ['clothes', { en: 'A change of clothes', es: 'Una muda de ropa' }],
      ['order', { en: 'Copy of any protective order', es: 'Copia de cualquier orden de protección' }],
      ['insurance', { en: 'Insurance and medical cards', es: 'Tarjetas del seguro y médicas' }],
      ['kids', { en: 'Things for children (documents, a comfort toy)', es: 'Cosas para los niños (documentos, un juguete favorito)' }],
    ],
  },
  {
    id: 'home',
    title: { en: 'Get ready at home', es: 'Prepárate en casa' },
    hint: { en: 'Small things that make it easier to get out safely.', es: 'Cosas pequeñas que hacen más fácil salir a salvo.' },
    items: [
      ['saferoom', { en: 'I know which rooms have a way out (avoid kitchen, bathroom, garage)', es: 'Sé qué cuartos tienen salida (evita la cocina, el baño y el garaje)' }],
      ['route', { en: 'I have planned and practiced how to leave quickly', es: 'Planeé y practiqué cómo salir rápido' }],
      ['codeword', { en: 'I have a code word that tells friends or kids to call for help', es: 'Tengo una palabra clave para que mis amigos o hijos pidan ayuda' }],
      ['neighbor', { en: 'A neighbor knows to call 911 if they hear fighting', es: 'Un vecino sabe que debe llamar al 911 si oye una pelea' }],
      ['kidsplan', { en: 'My kids know how to call 911 and where to go', es: 'Mis hijos saben llamar al 911 y a dónde ir' }],
      ['charged', { en: 'I try to keep my phone charged and nearby', es: 'Trato de tener el teléfono cargado y cerca' }],
    ],
  },
  {
    id: 'digital',
    title: { en: 'Protect your phone and accounts', es: 'Protege tu teléfono y tus cuentas' },
    hint: { en: 'Abusers often go through phones and track where people are.', es: 'Los agresores suelen revisar teléfonos y rastrear dónde está la otra persona.' },
    items: [
      ['location', { en: 'Checked location sharing (Find My, Google Maps, Life360, Snapchat)', es: 'Revisé si comparto mi ubicación (Buscar, Google Maps, Life360, Snapchat)' }],
      ['trackers', { en: 'Checked for hidden trackers like AirTags in my bag or car', es: 'Busqué rastreadores escondidos como AirTags en mi bolsa o carro' }],
      ['passwords', { en: 'Changed passwords they might know', es: 'Cambié las contraseñas que podría saber' }],
      ['2fa', { en: 'Turned on two-step verification on email and bank', es: 'Activé la verificación en dos pasos en mi correo y banco' }],
      ['apps', { en: 'Looked for apps I don’t recognize on my phone', es: 'Busqué apps que no reconozco en mi teléfono' }],
      ['shared', { en: 'Logged out of shared accounts and devices', es: 'Cerré sesión en cuentas y aparatos compartidos' }],
    ],
  },
];

const PLAN_NOTES = [
  ['places', { en: 'Safe places I can go', es: 'Lugares seguros a donde puedo ir' }, { en: 'A friend’s house, a relative, a shelter, a 24-hour store', es: 'La casa de un amigo, un familiar, un refugio, una tienda abierta 24 horas' }],
  ['people', { en: 'People I can call', es: 'Personas a quienes puedo llamar' }, { en: 'Who they are, and how they can help', es: 'Quiénes son y cómo pueden ayudar' }],
  ['codeword', { en: 'My code word', es: 'Mi palabra clave' }, { en: 'The word that means “I need help, call 911”', es: 'La palabra que significa “necesito ayuda, llama al 911”' }],
  ['route', { en: 'How I would leave', es: 'Cómo me iría' }, { en: 'Which door, where the keys are, where I’d go first', es: 'Por qué puerta, dónde están las llaves, a dónde iría primero' }],
  ['bagspot', { en: 'Where my go-bag is', es: 'Dónde está mi mochila de emergencia' }, { en: '', es: '' }],
];

const WARNING_SIGNS = [
  { en: 'They have choked or strangled you', es: 'Te ha ahorcado o estrangulado' },
  { en: 'They have threatened to kill you or your children', es: 'Ha amenazado con matarte a ti o a tus hijos' },
  { en: 'They own a gun or can easily get one', es: 'Tiene un arma o puede conseguir una fácilmente' },
  { en: 'The violence is happening more often or getting worse', es: 'La violencia pasa más seguido o es cada vez peor' },
  { en: 'They are extremely jealous or control what you do every day', es: 'Tiene muchos celos o controla lo que haces cada día' },
  { en: 'They follow you, track your phone, or show up where you are', es: 'Te sigue, rastrea tu teléfono o aparece donde estás' },
  { en: 'They have threatened or attempted suicide', es: 'Ha amenazado con suicidarse o lo ha intentado' },
  { en: 'You have recently left, or are planning to leave', es: 'Te fuiste hace poco, o estás planeando irte' },
];

const PERSON_FIELDS = [
  ['name', { en: 'Full name', es: 'Nombre completo' }],
  ['aka', { en: 'Nicknames or other names', es: 'Apodos u otros nombres' }],
  ['relation', { en: 'How you know them', es: 'Qué relación tienen' }, { en: 'Partner, ex, parent, roommate', es: 'Pareja, ex, padre o madre, compañero de casa' }],
  ['dob', { en: 'Date of birth', es: 'Fecha de nacimiento' }, '', 'date'],
  ['looks', { en: 'What they look like', es: 'Cómo es físicamente' }, { en: 'Height, build, hair, eyes, tattoos, scars', es: 'Estatura, complexión, cabello, ojos, tatuajes, cicatrices' }, 'area'],
  ['phones', { en: 'Phone numbers', es: 'Números de teléfono' }],
  ['address', { en: 'Where they live', es: 'Dónde vive' }, '', 'area'],
  ['work', { en: 'Where they work, and when', es: 'Dónde trabaja y en qué horario' }, '', 'area'],
  ['vehicle', { en: 'Car', es: 'Carro' }, { en: 'Make, model, color, license plate', es: 'Marca, modelo, color, placas' }],
  ['weapons', { en: 'Weapons they have or can get', es: 'Armas que tiene o puede conseguir' }, '', 'area'],
  ['social', { en: 'Social media accounts', es: 'Cuentas de redes sociales' }],
  ['others', { en: 'People who might help them find you', es: 'Personas que podrían ayudarle a encontrarte' }, '', 'area'],
  ['notes', { en: 'Anything else', es: 'Algo más' }, '', 'area'],
];

// How the Abuser page groups those fields
const PERSON_GROUPS = [
  [{ en: 'Who they are', es: 'Quién es' }, ['name', 'aka', 'relation', 'dob', 'looks']],
  [{ en: 'Where they can be found', es: 'Dónde se le puede encontrar' }, ['phones', 'address', 'work', 'vehicle', 'social']],
  [{ en: 'Your safety', es: 'Tu seguridad' }, ['weapons', 'others', 'notes']],
];

// Entries saved before types had ids stored the English label; map those back.
const LEGACY_TYPES = {
  'Physical': 'physical', 'Verbal / emotional': 'verbal', 'Threats': 'threats', 'Sexual': 'sexual',
  'Stalking / following': 'stalking', 'Money control': 'money', 'Phone / online': 'digital',
  'Property damage': 'property', 'Involved children': 'kids', 'Other': 'other',
  ...Object.fromEntries(INCIDENT_TYPES.map(([id, label]) => [label.en, id])),
};

export const typeId = x => LEGACY_TYPES[x] || x;
export const typeLabel = x => L(INCIDENT_TYPES.find(([id]) => id === typeId(x))?.[1]) || x;

// Everything above, in the current language.
export function content() {
  return {
    RESOURCES: RESOURCES.map(r => ({
      ...r, name: L(r.name), desc: L(r.desc),
      text: r.text && { to: r.text.to, body: L(r.text.body), label: L(r.text.label) },
    })),
    INCIDENT_TYPES: INCIDENT_TYPES.map(([id, label]) => [id, L(label)]),
    PLAN: PLAN.map(s => ({ ...s, title: L(s.title), hint: L(s.hint), items: s.items.map(([id, label]) => [id, L(label)]) })),
    PLAN_NOTES: PLAN_NOTES.map(([k, label, ph]) => [k, L(label), L(ph)]),
    WARNING_SIGNS: WARNING_SIGNS.map(L),
    PERSON_FIELDS: PERSON_FIELDS.map(([k, label, ph = '', type]) => [k, L(label), L(ph), type]),
    PERSON_GROUPS: PERSON_GROUPS.map(([title, keys]) => [L(title), keys]),
  };
}
