import React from 'react';
import { View } from 'react-native';
import { SectionHeader } from '@/shared/components/SectionHeader';
import { ServiceCategoryGrid } from '@/features/services/components/ServiceCategoryGrid';
import { getCategoriesByTree, getTree } from '@/shared/data/services';
export function RoomsRestaurantHub() {
  return (
    <View style={{ gap: 12 }}>
      <SectionHeader title={getTree('rooms_restaurant')!.name} />
      <ServiceCategoryGrid
        treeId="rooms_restaurant"
        categories={getCategoriesByTree('rooms_restaurant')}
        compact
      />
    </View>
  );
}
