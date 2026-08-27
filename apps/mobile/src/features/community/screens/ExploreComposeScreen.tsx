import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { AppHeader } from '@/shared/components/AppHeader';
import { Button } from '@/shared/components/Button';
import { Card } from '@/shared/components/Card';
import { useTheme } from '@/shared/hooks/useTheme';
import { useCommunityStore } from '@/shared/data/community';
import { RootStackParamList } from '@/shared/navigation/types';

type Props = {
  kind: 'event' | 'product';
  challengeId?: string;
};

export function ExploreComposeScreen({ kind, challengeId }: Props) {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  const isEvent = kind === 'event';
  const linkEventToChallenge = useCommunityStore(s => s.linkEventToChallenge);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [location, setLocation] = useState('');
  const [when, setWhen] = useState('');
  const [capacity, setCapacity] = useState('');

  const inputStyle = [
    styles.input,
    {
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      color: theme.colors.textPrimary,
      borderRadius: theme.radius.md,
    },
  ];

  const onSaveDraft = () => {
    Alert.alert('Draft saved', 'You can come back and submit when ready.');
  };

  const onSubmit = () => {
    if (!title.trim()) {
      Alert.alert('Add a title', `Give your ${isEvent ? 'event' : 'product'} a name.`);
      return;
    }

    if (isEvent && challengeId) {
      const eventId = `evt-local-${Date.now()}`;
      linkEventToChallenge(eventId, challengeId);
    }

    Alert.alert(
      'Submitted successfully',
      challengeId
        ? 'Event linked to the challenge. Visible to your followers while we review it for public Explore.'
        : 'Visible to your followers while we review it for public Explore.',
      [
        {
          text: 'View post',
          onPress: () => {
            if (challengeId) {
              navigation.navigate('ChallengeDetail', { challengeId });
              return;
            }
            navigation.navigate('Main', { screen: 'Community' });
          },
        },
        { text: 'Done', style: 'cancel', onPress: () => navigation.popToTop() },
      ],
    );
  };

  return (
    <ScreenContainer scrollable tabAware={false}>
      <AppHeader
        title={isEvent ? 'Create Event' : 'Post Product'}
        showBrand={false}
        showActions={false}
      />

      <Card style={{ gap: 10 }}>
        {challengeId ? (
          <Text style={[theme.typography.caption, { color: theme.colors.primary }]}>
            This event will be linked to the challenge after submit.
          </Text>
        ) : null}
        <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
          After submit: followers can see it immediately. Public Explore requires Admin approval.
        </Text>

        <Field label="Title">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={isEvent ? 'Weekend Cycling Meetup' : 'Resistance Band Set'}
            placeholderTextColor={theme.colors.textTertiary}
            style={inputStyle}
          />
        </Field>

        <Field label="Description">
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Tell people what to expect"
            placeholderTextColor={theme.colors.textTertiary}
            multiline
            style={[inputStyle, { minHeight: 88, textAlignVertical: 'top' }]}
          />
        </Field>

        {isEvent ? (
          <>
            <Field label="Date & time">
              <TextInput
                value={when}
                onChangeText={setWhen}
                placeholder="Aug 30 · 6:00 AM"
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
            <Field label="Capacity">
              <TextInput
                value={capacity}
                onChangeText={setCapacity}
                placeholder="20"
                keyboardType="number-pad"
                placeholderTextColor={theme.colors.textTertiary}
                style={inputStyle}
              />
            </Field>
          </>
        ) : (
          <Field label="Quantity / stock">
            <TextInput
              value={capacity}
              onChangeText={setCapacity}
              placeholder="25"
              keyboardType="number-pad"
              placeholderTextColor={theme.colors.textTertiary}
              style={inputStyle}
            />
          </Field>
        )}

        <Field label="Price (₹)">
          <TextInput
            value={price}
            onChangeText={setPrice}
            placeholder={isEvent ? '499' : '899'}
            keyboardType="number-pad"
            placeholderTextColor={theme.colors.textTertiary}
            style={inputStyle}
          />
        </Field>
      </Card>

      <View style={styles.actions}>
        <Button title="Save Draft" variant="secondary" onPress={onSaveDraft} />
        <Button title="Submit for Review" icon="send" onPress={onSubmit} />
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

export function CreateExploreEventScreen() {
  const route = useRoute<RouteProp<RootStackParamList, 'CreateExploreEvent'>>();
  return <ExploreComposeScreen kind="event" challengeId={route.params?.challengeId} />;
}

export function CreateExploreProductScreen() {
  return <ExploreComposeScreen kind="product" />;
}

const styles = StyleSheet.create({
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  actions: {
    gap: 10,
    marginTop: 8,
  },
});
