// PickupPointsView.js — Public shareable pickup points page (no auth required).
import React from 'react';
import DocLibraryView from '@/pages/DocLibraryView';

export default function PickupPointsView() {
  return (
    <DocLibraryView
      collectionName="pickup_points"
      kindLabel="PICKUP POINTS"
      defaultEmoji="📍"
      shareEmoji="📍"
      showRoute
      notFoundText="These pickup points don't exist or may have been removed."
    />
  );
}
