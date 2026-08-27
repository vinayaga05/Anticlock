import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { useTheme } from '@/shared/hooks/useTheme';
import { useCommunityStore } from '@/shared/data/community';

export function CreateClubScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const createClub = useCommunityStore(s => s.createClub);

  const [name, setName] = useState('');
  const [sport, setSport] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const inputStyle = [
    styles.input,
    {
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      color: theme.colors.textPrimary,
      borderRadius: theme.radius.md,
    },
  ];

  const onCreate = () => {
    if (!name.trim() || !sport.trim() || !location.trim()) {
      Alert.alert('Missing details', 'Name, sport, and location are required.');
      return;
    }
    const club = createClub({
      name: name.trim(),
      sport: sport.trim(),
      location: location.trim(),
      description: description.trim() || `${sport.trim()} team in ${location.trim()}.`,
    });
    navigation.replace('ClubDetail', { clubId: club.id });
  };

  return (
    <ScreenContainer scrollable tabAware={false}>
      <AppHeader title="Create team" showBrand={false} showActions={false} />

      <Card style={{ gap: 12 }}>
        <Field label="Name">
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Coastal Runners"
            placeholderTextColor={theme.colors.textTertiary}
            style={inputStyle}
          />
        </Field>
        <Field label="Sport">
          <TextInput
            value={sport}
            onChangeText={setSport}
            placeholder="Running"
            placeholderTextColor={theme.colors.textTertiary}
            style={inputStyle}
          />
        </Field>
        <Field label="Location">
          <TextInput
            value={location}
            onChangeText={setLocation}
            placeholder="Chennai"
            placeholderTextColor={theme.colors.textTertiary}
            style={inputStyle}
          />
        </Field>
        <Field label="Description">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What is this team about?"
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            style={[inputStyle, { minHeight: 88, textAlignVertical: 'top' }]}
          />
        </Field>
      </Card>

      <View style={{ marginTop: 4 }}>
        <Button title="Create team" icon="plus" onPress={onCreate} />
      </View>
    </ScreenContainer>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={[theme.typography.label, { color: theme.colors.textSecondary }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
});
