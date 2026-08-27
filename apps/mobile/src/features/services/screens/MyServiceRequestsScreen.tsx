import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ScreenContainer } from '@/shared/components/ScreenContainer';
import { Card } from '@/shared/components/Card';
import { EmptyState } from '@/shared/components/EmptyState';
import { useTheme } from '@/shared/hooks/useTheme';
import { getServiceRequests, ServiceRequestStatus } from '@/shared/data/services';

const STEPS: ServiceRequestStatus[] = [
  'requested',
  'searching',
  'assigned',
  'confirmed',
  'on_the_way',
  'started',
  'completed',
  'rated',
];

function statusIndex(status: ServiceRequestStatus) {
  return STEPS.indexOf(status);
}

export function MyServiceRequestsScreen() {
  const theme = useTheme();
  const requests = getServiceRequests();

  if (requests.length === 0) {
    return (
      <ScreenContainer tabAware={false}>
        <EmptyState icon="clipboard" title="No service requests" />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scrollable tabAware={false}>
      {requests.map(req => {
        const idx = statusIndex(req.status);
        return (
          <Card key={req.id} elevated style={{ gap: 8 }}>
            <Text style={[theme.typography.caption, { color: theme.colors.primary, fontWeight: '700' }]}>
              {req.status.replace(/_/g, ' ').toUpperCase()}
            </Text>
            <Text style={[theme.typography.section, { color: theme.colors.textPrimary }]}>
              {req.title}
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
              {req.description}
            </Text>
            <Text style={[theme.typography.bodySmall, { color: theme.colors.textTertiary }]}>
              {req.address} · {req.when}
            </Text>
            {req.providerName ? (
              <Text style={[theme.typography.bodySmall, { color: theme.colors.textSecondary }]}>
                Pro: {req.providerName}
              </Text>
            ) : null}
            <View style={styles.timeline}>
              {STEPS.slice(0, 5).map((step, i) => (
                <View
                  key={step}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        i <= idx ? theme.colors.primary : theme.colors.surface,
                      borderColor: theme.colors.border,
                    },
                  ]}
                />
              ))}
            </View>
          </Card>
        );
      })}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  timeline: { flexDirection: 'row', gap: 8, marginTop: 4 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
