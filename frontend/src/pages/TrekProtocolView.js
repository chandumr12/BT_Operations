// TrekProtocolView.js — Public shareable trekking protocol page (no auth required).
import React from 'react';
import DocLibraryView from '@/pages/DocLibraryView';

export default function TrekProtocolView() {
  return (
    <DocLibraryView
      collectionName="trek_protocols"
      kindLabel="TREK PROTOCOL"
      defaultEmoji="🧭"
      shareEmoji="🧭"
      notFoundText="This protocol doesn't exist or may have been removed."
    />
  );
}
