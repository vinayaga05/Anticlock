import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { AppIcon } from '@/shared/components/AppIcon';
import { PressableScale } from '@/shared/components/PressableScale';
import { useTheme } from '@/shared/hooks/useTheme';
import { softFill } from '@/shared/theme/colors';
import type { ReelItem } from '@/shared/types';

type SideFact = {
  icon: 'star' | 'location' | 'badge-check' | 'briefcase' | 'coins' | 'check-circle';
  label: string;
  value: string;
  color?: string;
};

type Props = {
  clips: ReelItem[];
  fallbackPosterUrl?: string;
  providerName: string;
  clipCount?: number;
  loading?: boolean;
  sideFacts: SideFact[];
  onOpenClip: (reelId?: string) => void;
};

function remotePosterUrl(value?: string | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return trimmed;
  } catch {
    return undefined;
  }
}

function PlayPulse({ size = 54 }: { size?: number }) {
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [pulse]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: 2 - pulse.value,
  }));

  return (
    <View style={[styles.playWrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.playRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            top: 0,
            left: 0,
          },
          ringStyle,
        ]}
      />
      <View
        style={[
          styles.playButton,
          {
            width: size * 0.78,
            height: size * 0.78,
            borderRadius: size * 0.39,
          },
        ]}
      >
        <AppIcon name="play" size={size * 0.32} color="#0F172A" fill="#0F172A" />
      </View>
    </View>
  );
}

function PosterPlaceholder({ gradientId }: { gradientId: string }) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.thumbFallback,
        { backgroundColor: softFill(theme.colors.primary, 0.14) },
      ]}
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.colors.primary} stopOpacity="0.55" />
            <Stop offset="0.55" stopColor="#0F766E" stopOpacity="0.42" />
            <Stop offset="1" stopColor="#0F172A" stopOpacity="0.88" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
      </Svg>
      <View style={styles.placeholderGlyph}>
        <AppIcon name="reels" size={26} color="#FFFFFF" />
      </View>
    </View>
  );
}

function IntroPoster({
  posterUrl,
  label,
  onPress,
  accessibilityLabel,
}: {
  posterUrl?: string;
  label: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const remoteUrl = remotePosterUrl(posterUrl);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(remoteUrl) && !imageFailed;

  useEffect(() => {
    setImageFailed(false);
  }, [remoteUrl]);

  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={[
        styles.featuredCard,
        {
          borderRadius: theme.radius.xl,
          backgroundColor: theme.colors.surfaceMuted,
          ...theme.shadows.card,
        },
      ]}
    >
      <PosterPlaceholder gradientId="introPosterFeatured" />
      {showImage ? (
        <Image
          source={{ uri: remoteUrl }}
          style={styles.thumbImage}
          resizeMode="cover"
          onError={() => setImageFailed(true)}
        />
      ) : null}
      <View style={styles.thumbShade} pointerEvents="none" />
      <View style={styles.thumbPlay} pointerEvents="none">
        <PlayPulse size={52} />
      </View>
      <View style={[styles.thumbBadge, { borderRadius: theme.radius.pill }]}>
        <AppIcon name="clapperboard" size={12} color="#FFFFFF" />
        <Text style={styles.thumbBadgeText}>{label}</Text>
      </View>
    </PressableScale>
  );
}

function FactTile({ fact }: { fact: SideFact }) {
  const theme = useTheme();
  const color = fact.color ?? theme.colors.primary;
  return (
    <View
      style={[
        styles.factTile,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
        },
      ]}
    >
      <View style={[styles.factIcon, { backgroundColor: softFill(color, 0.14) }]}>
        <AppIcon name={fact.icon} size={14} color={color} />
      </View>
      <View style={styles.factCopy}>
        <Text
          style={[theme.typography.caption, { color: theme.colors.textTertiary }]}
          numberOfLines={1}
        >
          {fact.label}
        </Text>
        <Text
          style={[
            theme.typography.bodySmall,
            { color: theme.colors.textPrimary, fontWeight: '700' },
          ]}
          numberOfLines={2}
        >
          {fact.value}
        </Text>
      </View>
    </View>
  );
}

/** Intro video + aligned side facts for the service detail screen. */
export function ProviderIntroVideoSection({
  clips,
  fallbackPosterUrl,
  providerName,
  clipCount,
  loading,
  sideFacts,
  onOpenClip,
}: Props) {
  const theme = useTheme();
  const featured = clips[0];
  const more = clips.slice(1, 5);
  const total = clipCount ?? clips.length;
  const fallback = remotePosterUrl(fallbackPosterUrl);
  const featuredPoster = remotePosterUrl(featured?.posterUrl) || fallback;

  return (
    <Animated.View entering={FadeInDown.duration(420).delay(80)} style={styles.section}>
      <View style={styles.header}>
        <View
          style={[
            styles.headerIcon,
            { backgroundColor: softFill(theme.colors.primary, 0.14) },
          ]}
        >
          <AppIcon name="video" size={16} color={theme.colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text
            style={[
              theme.typography.section,
              { color: theme.colors.textPrimary, lineHeight: 22 },
            ]}
          >
            Intro video
          </Text>
          <Text style={[theme.typography.caption, { color: theme.colors.textTertiary }]}>
            {loading
              ? 'Loading clips…'
              : total > 0
                ? `${total} clip${total === 1 ? '' : 's'} from ${providerName}`
                : `Meet ${providerName}`}
          </Text>
        </View>
      </View>

      <View style={styles.mainRow}>
        <IntroPoster
          posterUrl={featuredPoster}
          label={featured ? 'Intro' : 'Watch'}
          accessibilityLabel={
            featured
              ? `Play intro clip from ${providerName}`
              : `Open clips for ${providerName}`
          }
          onPress={() => onOpenClip(featured?.id)}
        />

        <View style={styles.sideColumn}>
          {sideFacts.slice(0, 4).map(fact => (
            <FactTile key={`${fact.label}-${fact.value}`} fact={fact} />
          ))}
        </View>
      </View>

      {more.length > 0 ? (
        <View style={styles.moreGrid}>
          {more.map((clip, index) => {
            const poster = remotePosterUrl(clip.posterUrl) || fallback;
            return (
              <PressableScale
                key={clip.id}
                accessibilityLabel={`Play clip ${index + 2}`}
                onPress={() => onOpenClip(clip.id)}
                style={[
                  styles.moreCard,
                  {
                    borderRadius: theme.radius.lg,
                    backgroundColor: theme.colors.surfaceMuted,
                  },
                ]}
              >
                {poster ? (
                  <Image source={{ uri: poster }} style={styles.thumbImage} resizeMode="cover" />
                ) : (
                  <View
                    style={[
                      styles.thumbFallback,
                      { backgroundColor: softFill(theme.colors.primary, 0.16) },
                    ]}
                  >
                    <AppIcon name="video" size={18} color={theme.colors.primary} />
                  </View>
                )}
                <View style={styles.moreShade} />
                <View style={styles.morePlay}>
                  <AppIcon name="play" size={14} color="#FFFFFF" fill="#FFFFFF" />
                </View>
              </PressableScale>
            );
          })}
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
  },
  featuredCard: {
    flex: 1,
    aspectRatio: 3 / 4,
    overflow: 'hidden',
  },
  sideColumn: {
    flex: 1,
    gap: 8,
    justifyContent: 'space-between',
  },
  factTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 52,
  },
  factIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  factCopy: {
    flex: 1,
    gap: 1,
  },
  moreGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  moreCard: {
    width: '23.5%',
    aspectRatio: 1,
    overflow: 'hidden',
  },
  moreShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
  },
  morePlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbImage: { ...StyleSheet.absoluteFill },
  thumbFallback: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderGlyph: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbShade: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(15, 23, 42, 0.22)',
  },
  thumbPlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbBadge: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
  },
  thumbBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  playWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  playRing: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  playButton: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
