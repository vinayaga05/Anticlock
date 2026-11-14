import React, { useEffect, useState } from 'react';
import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { AppIcon, type IconName } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { businessInitials, type BusinessBrand } from '../businessProfileModel';

type Props = {
  name: string;
  category: string;
  tagline: string | null;
  coverUrl: string | null;
  logoUrl: string | null;
  brand: BusinessBrand;
  approved: boolean;
  location: string;
  distance: string | null;
  rating: number | null;
  reviewCount: number;
  status: string;
  hours: string | null;
  statusOpen: boolean;
  topInset: number;
  saved: boolean;
  saving: boolean;
  onBack: () => void;
  onShare: () => void;
  onSave: () => void;
  onMore: () => void;
  onCover?: () => void;
};

function HeaderButton({
  icon,
  label,
  onPress,
  disabled = false,
  active = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <PressableScale
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.headerButton,
        active ? { backgroundColor: '#F5EDD8' } : {},
      ]}
    >
      <AppIcon name={icon} color={active ? '#24252B' : '#FFFFFF'} size={20} />
    </PressableScale>
  );
}

export function BusinessProfileHeader(props: Props) {
  const theme = useTheme();
  const dark = theme.mode === 'dark';
  const [coverFailed, setCoverFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setCoverFailed(false), [props.coverUrl]);
  useEffect(() => setLogoFailed(false), [props.logoUrl]);
  const surface = dark ? '#171D20' : '#FFFDF9';
  const ink = dark ? '#F8F3EA' : '#232A27';
  const muted = dark ? '#B5BDB8' : '#6B746E';
  return (
    <View testID="business-profile-header">
      <View
        style={[
          styles.cover,
          { height: 276 + props.topInset, backgroundColor: props.brand.deep },
        ]}
      >
        {props.coverUrl && !coverFailed ? (
          <Image
            testID="business-cover-image"
            source={{ uri: props.coverUrl }}
            onError={() => setCoverFailed(true)}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
          />
        ) : (
          <Svg
            style={StyleSheet.absoluteFill}
            width="100%"
            height="100%"
            viewBox="0 0 400 320"
            preserveAspectRatio="xMidYMid slice"
          >
            <Defs>
              <LinearGradient
                id="businessFallbackCover"
                x1="0"
                y1="0"
                x2="1"
                y2="1"
              >
                <Stop offset="0" stopColor={props.brand.accent} />
                <Stop offset="1" stopColor={props.brand.deep} />
              </LinearGradient>
            </Defs>
            <Rect width="400" height="320" fill="url(#businessFallbackCover)" />
            <Circle
              cx="330"
              cy="80"
              r="150"
              fill="none"
              stroke="#F5EDD8"
              strokeOpacity="0.17"
            />
            <Circle
              cx="330"
              cy="80"
              r="115"
              fill="none"
              stroke="#F5EDD8"
              strokeOpacity="0.17"
            />
            <Path
              d="M-10 290L175 0M60 320L245 0M130 350L315 0"
              stroke="#F5EDD8"
              strokeOpacity="0.09"
            />
            <Path d="M35 250H365" stroke="#F5EDD8" strokeOpacity="0.3" />
          </Svg>
        )}
        <Svg
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          width="100%"
          height="100%"
        >
          <Defs>
            <LinearGradient id="businessCoverShade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#06130D" stopOpacity="0.5" />
              <Stop offset="0.5" stopColor="#06130D" stopOpacity="0.03" />
              <Stop offset="1" stopColor="#06130D" stopOpacity="0.65" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#businessCoverShade)" />
        </Svg>
        <View style={[styles.topBar, { paddingTop: props.topInset + 8 }]}>
          <HeaderButton icon="back" label="Back" onPress={props.onBack} />
          <View style={styles.topActions}>
            <HeaderButton
              icon="share"
              label="Share business profile"
              onPress={props.onShare}
            />
            <HeaderButton
              icon="bookmark"
              label={props.saved ? 'Unsave business' : 'Save business'}
              onPress={props.onSave}
              disabled={props.saving}
              active={props.saved}
            />
            <HeaderButton
              icon="more"
              label="More business options"
              onPress={props.onMore}
            />
          </View>
        </View>
        <View pointerEvents="none" style={styles.coverCaption}>
          <Text style={styles.coverEyebrow}>THE BUSINESS EDIT</Text>
          <View style={styles.coverRule} />
          <Text style={styles.coverCopy}>
            Discover the people behind the craft.
          </Text>
        </View>
        {props.onCover && props.coverUrl && !coverFailed ? (
          <PressableScale
            accessibilityLabel="Open business cover"
            onPress={props.onCover}
            style={styles.coverExpand}
          >
            <AppIcon name="images" size={16} color="#FFFFFF" />
          </PressableScale>
        ) : null}
      </View>
      <View style={[styles.identity, { backgroundColor: surface }]}>
        <View style={styles.logoRow}>
          <View style={[styles.logoFrame, { backgroundColor: surface }]}>
            {props.logoUrl && !logoFailed ? (
              <Image
                testID="business-logo"
                source={{ uri: props.logoUrl }}
                onError={() => setLogoFailed(true)}
                style={styles.logo}
              />
            ) : (
              <View
                testID="business-logo-fallback"
                style={[
                  styles.logo,
                  styles.logoFallback,
                  { backgroundColor: props.brand.soft },
                ]}
              >
                <Text style={[styles.initials, { color: props.brand.accent }]}>
                  {businessInitials(props.name)}
                </Text>
              </View>
            )}
          </View>
          {props.approved ? (
            <View
              style={[styles.approved, { backgroundColor: props.brand.soft }]}
            >
              <AppIcon name="verified" size={14} color={props.brand.accent} />
              <Text
                style={[styles.approvedText, { color: props.brand.accent }]}
              >
                Approved business
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.category, { color: props.brand.accent }]}>
          {props.category || 'INDEPENDENT BUSINESS'}
        </Text>
        <Text accessibilityRole="header" style={[styles.name, { color: ink }]}>
          {props.name}
        </Text>
        {props.tagline ? (
          <Text style={[styles.tagline, { color: muted }]}>
            {props.tagline}
          </Text>
        ) : null}
        <View style={styles.facts}>
          {props.reviewCount > 0 && props.rating !== null ? (
            <View style={styles.fact}>
              <AppIcon name="star" size={14} color={props.brand.accent} />
              <Text style={[styles.factStrong, { color: ink }]}>
                {props.rating.toFixed(1)}
              </Text>
              <Text style={[styles.factText, { color: muted }]}>
                ({props.reviewCount})
              </Text>
            </View>
          ) : null}
          {props.location ? (
            <View style={[styles.fact, { flexShrink: 1 }]}>
              <AppIcon name="location" size={14} color={muted} />
              <Text style={[styles.factText, { color: muted, flexShrink: 1 }]}>
                {props.location}
                {props.distance ? ` · ${props.distance}` : ''}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.hours}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: props.statusOpen ? '#3C8A64' : muted },
            ]}
          />
          <Text
            style={[
              styles.status,
              {
                color: props.statusOpen
                  ? dark
                    ? '#94D6AD'
                    : '#34634B'
                  : muted,
              },
            ]}
          >
            {props.status}
          </Text>
          {props.hours ? (
            <Text style={[styles.factText, { color: muted, flexShrink: 1 }]}>
              {props.hours}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { overflow: 'hidden' },
  topBar: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topActions: { flexDirection: 'row', gap: 8 },
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#10221980',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#FFFFFF50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverCaption: {
    position: 'absolute',
    left: 24,
    bottom: 48,
    right: 60,
    gap: 9,
  },
  coverEyebrow: {
    color: '#F9F2E2',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
  },
  coverRule: { width: 28, height: 1, backgroundColor: '#E3D7BB' },
  coverCopy: { color: '#FAF5E9', fontSize: 13, lineHeight: 20 },
  coverExpand: {
    position: 'absolute',
    right: 20,
    bottom: 45,
    height: 44,
    width: 44,
    borderRadius: 16,
    backgroundColor: '#13251B80',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identity: { paddingHorizontal: 24, paddingBottom: 24 },
  logoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginTop: -30,
    marginBottom: 14,
  },
  logoFrame: {
    padding: 5,
    borderRadius: 26,
    shadowColor: '#13251B',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 3,
  },
  logo: { width: 82, height: 82, borderRadius: 21 },
  logoFallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 28, fontWeight: '600', letterSpacing: -1 },
  approved: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 34,
    flexShrink: 1,
  },
  approvedText: { fontSize: 10, fontWeight: '600', flexShrink: 1 },
  category: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  name: {
    fontSize: 32,
    lineHeight: 39,
    fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
    letterSpacing: -0.8,
  },
  tagline: { fontSize: 14, lineHeight: 22, marginTop: 10 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 16 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  factStrong: { fontSize: 12, fontWeight: '700' },
  factText: { fontSize: 12, lineHeight: 18 },
  hours: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: 7,
    rowGap: 3,
    marginTop: 12,
  },
  statusDot: { height: 5, width: 5, borderRadius: 3 },
  status: { fontSize: 12, fontWeight: '600' },
});
