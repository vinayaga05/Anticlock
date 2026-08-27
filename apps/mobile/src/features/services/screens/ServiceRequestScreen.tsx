import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import {
  SchedulePicker,
  useScheduleState,
} from '@/shared/components/SchedulePicker';
import { useTheme } from '@/shared/hooks/useTheme';
import { getCategory, getProvider } from '@/shared/data/services';
import { RootStackParamList } from '@/shared/navigation/types';

const ADDRESSES = [
  '12 Anna Nagar, Chennai',
  '45 T Nagar Main Road, Chennai',
  '8 OMR, Sholinganallur',
];

export function ServiceRequestScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<RootStackParamList, 'ServiceRequest'>>();
  const { categoryId, providerId } = route.params;
  const category = getCategory(categoryId);
  const provider = providerId ? getProvider(providerId) : undefined;
  const [problem, setProblem] = useState('');
  const [address, setAddress] = useState(ADDRESSES[0]);
  const { selectedDate, selectedTime, setSelectedDate, setSelectedTime } =
    useScheduleState();

  if (!category) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="search" title="Category not found" />
      </ScreenContainer>
    );
  }

  const submit = () => {
    if (!problem.trim()) {
      Alert.alert('Describe the job', 'Add a short problem description.');
      return;
    }
    if (!selectedDate || !selectedTime) {
      Alert.alert('Pick a slot', 'Choose when you need the service.');
      return;
    }
    Alert.alert(
      'Request submitted',
      `We are matching a ${category.name.toLowerCase()} pro near you.`,
      [
        {
          text: 'View requests',
          onPress: () => navigation.replace('MyServiceRequests'),
        },
      ],
    );
  };

  return (
    <ScreenContainer scrollable tabAware={false}>
      <Text style={[theme.typography.largeTitle, { color: theme.colors.textPrimary }]}>
        Request {category.name}
      </Text>
      {provider ? (
        <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
          Preferred: {provider.name}
        </Text>
      ) : null}

      <Card style={{ gap: 8 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          Problem description
        </Text>
        <TextInput
          value={problem}
          onChangeText={setProblem}
          multiline
          placeholder="What needs to be done?"
          placeholderTextColor={theme.colors.textTertiary}
          style={[
            theme.typography.body,
            styles.input,
            {
              color: theme.colors.textPrimary,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
            },
          ]}
        />
      </Card>

      <Card style={{ gap: 8 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          Photo attachment
        </Text>
        <Button
          title="Add photo (mock)"
          variant="secondary"
          icon="plus"
          onPress={() => Alert.alert('Attached', 'Mock photo added.')}
        />
      </Card>

      <Card style={{ gap: 8 }}>
        <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
          Service address
        </Text>
        {ADDRESSES.map(item => (
          <Button
            key={item}
            title={item}
            variant={address === item ? 'primary' : 'secondary'}
            onPress={() => setAddress(item)}
          />
        ))}
      </Card>

      <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
        Preferred time
      </Text>
      <SchedulePicker
        selectedDate={selectedDate}
        selectedTime={selectedTime}
        onSelectDate={setSelectedDate}
        onSelectTime={setSelectedTime}
      />

      <Button title="Submit request" icon="clipboard" onPress={submit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 100,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    textAlignVertical: 'top',
  },
});
