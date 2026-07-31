import React from 'react';
import { DocLibraryScreen } from '@/components/DocLibraryScreen';

/**
 * The standard Bengaluru pickup route — pre-fills every new trek's pickup
 * points so admins aren't retyping the same base stops each time. Fully
 * editable per trek from there (add/remove/rename stops, swap links), and
 * can be re-inserted into an existing entry via the "Standard route" button.
 */
const STANDARD_ROUTE = [
  { name: 'Milano Pizza, Indiranagar', mapUrl: 'https://share.google/VSQsmrRbqhtAnz6Wt' },
  { name: 'Shantala Silks, Majestic', mapUrl: 'https://maps.app.goo.gl/P2zTRp5ifR6TAqsKA' },
  { name: 'Govardhan Theatre, Yeshwanthpur', mapUrl: 'https://maps.app.goo.gl/SrV8123rDB1eQQ1A6' },
  { name: 'People Tree Hospital, Gorguntepalya', mapUrl: 'https://maps.app.goo.gl/4B2BSQTUcSW1QHvp8' },
];

/**
 * Pickup Points — one entry per trek (pickup locations differ by trek).
 * Editable by Super Admin / Operations Manager; every other role sees a
 * read-only view. Shares to the standalone pickup-route.html page (works
 * identically whether reached from the web app or the mobile app).
 */
export default function PickupPointsScreen() {
  return (
    <DocLibraryScreen
      collectionName="pickup_points"
      routePrefix="pickup"
      title="Pickup Points"
      subtitle="Boarding points per trek — share with leads & participants"
      icon="location-outline"
      newLabel="New Pickup Points"
      perTrek
      shareEmoji="📍"
      withMapLinks
      itemLabel="Stop"
      defaultStops={STANDARD_ROUTE}
      staticPage="pickup-route.html"
    />
  );
}
