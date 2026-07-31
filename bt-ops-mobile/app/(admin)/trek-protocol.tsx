import React from 'react';
import { DocLibraryScreen } from '@/components/DocLibraryScreen';

/**
 * The "Green Trail Trek Protocol — Monsoon Edition" content, straight from
 * the ops team's reference poster. Pre-fills a brand-new Trek Protocol
 * document so there's a ready-to-publish default; every field stays fully
 * editable afterward, and it can be re-inserted into an existing entry via
 * the "Standard Protocol" button.
 */
const DEFAULT_PROTOCOL_NAME = 'Green Trail Trek Protocol';
const DEFAULT_PROTOCOL_DESCRIPTION = "Let's Trek Responsibly — Monsoon Edition";

const DEFAULT_SECTIONS = [
  {
    title: '✅ Essentials to Carry (steel or non-disposable only)',
    items: [
      'Chocolate',
      'Chips',
      'Energy bars',
      'Water — from Bisleri bottles',
      'Poncho',
      'Mobile rain cover',
      'Dettol',
    ],
  },
  {
    title: '🚫 Not Allowed On The Trail',
    items: [
      'Tissues',
      'Wet wipes',
      'Plastic boxes — disposables',
      'Plastic bottles — disposables',
      'Band-aids',
      'Cotton',
      'Cigarettes and matchboxes',
      'Chips and chocolate wrappers',
      'Plastic covers in general',
      'Food containers',
      'Plastic spoons',
      'Plastic cups',
      'Aluminium pouches',
    ],
  },
  {
    title: '👕 Recommended Trek Attire',
    items: [
      'Full-sleeve dry-fit T-shirt (quick drying, breathable)',
      'Full-length trekking pants (avoid jeans)',
      'Trekking shoes with good grip',
      'Cap or hat, sunglasses',
      'Lightweight poncho or raincoat',
    ],
  },
  {
    title: '🥾 Golden Trekking Tips',
    items: [
      'Trim your toenails before the trek to reduce discomfort and prevent your toes from hitting the front of your shoes during descents.',
      'Choose the right footwear — trekking shoes about half to one size larger than your regular size, for extra comfort especially while descending.',
      'Leech protection: apply Dettol on your shoes and around your ankles before starting the trek, and reapply after lunch if needed. If a leech attaches, gently pluck or flick it off, or use salt. If bleeding continues after removal, place a small piece of clean paper/tissue over the bite until it clots, or use a bandage.',
      'Descend with proper technique — keep your feet at approximately a 45° angle while descending to improve balance and reduce strain.',
      'Use the zig-zag method on steep slopes instead of walking straight down — this reduces pressure on your knees and gives better control.',
      'Step on firm rocks or stable surfaces whenever possible. Avoid placing your full weight on loose mud, as it can be slippery.',
      'Need more trekking tips? Feel free to ask your trek leads — always happy to help! 😄',
    ],
  },
  {
    title: '🌍 Leave No Trace',
    items: [
      'Carry a small cloth bag for your own waste and help keep our trails plastic-free.',
      'Happy Trekking! Stay safe and enjoy the journey. ⛰️',
    ],
  },
];

/**
 * Trekking Protocol — common guidance that applies across all treks (safety
 * rules, do's & don'ts, code of conduct). Editable by Super Admin /
 * Operations Manager; every other role sees a read-only view. Shares
 * publicly at /protocol/<slug> on the web app.
 */
export default function TrekProtocolScreen() {
  return (
    <DocLibraryScreen
      collectionName="trek_protocols"
      routePrefix="protocol"
      title="Trek Protocol"
      subtitle="Safety rules & code of conduct — common across all treks"
      icon="shield-checkmark-outline"
      newLabel="New Protocol"
      shareEmoji="🧭"
      perTrekOptional
      defaultName={DEFAULT_PROTOCOL_NAME}
      defaultDescription={DEFAULT_PROTOCOL_DESCRIPTION}
      defaultEmoji="🥾"
      defaultSections={DEFAULT_SECTIONS}
      standardContentLabel="Standard Protocol"
      staticPage="trek-protocol.html"
    />
  );
}
