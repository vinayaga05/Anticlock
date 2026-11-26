import React from 'react';
import { Button, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { isHealthRoute } from '@/shared/config/releaseFeatures';

export function ReleaseRouteGuard({
  route,
  children,
}: {
  route: { name: string; params?: object };
  children: React.ReactNode;
}) {
  const navigation = useNavigation<any>();
  if (!isHealthRoute(route.name, route.params)) return <>{children}</>;
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        padding: 24,
        gap: 16,
        backgroundColor: '#fff',
      }}
    >
      <Text
        accessibilityRole="header"
        style={{ fontSize: 22, color: '#19212b' }}
      >
        Service unavailable
      </Text>
      <Text style={{ color: '#334152' }}>
        This service is not offered in this version of Knock.
      </Text>
      <Button
        title="Browse Knock"
        onPress={() => navigation.navigate('Main', { screen: 'Needs' })}
      />
    </View>
  );
}
