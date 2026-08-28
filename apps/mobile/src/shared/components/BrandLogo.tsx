import React from 'react';
import {
  Image,
  ImageStyle,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { BRAND_LOGO, brandLogoSize } from '@/shared/assets/brand';
import { APP_NAME } from '@/shared/constants';
import { useTheme } from '@/shared/hooks/useTheme';

type BrandLogoProps = {
  /** Logo height; width is derived from the native aspect ratio. */
  height?: number;
  showName?: boolean;
  name?: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export function BrandLogo({
  height = 40,
  showName = false,
  name,
  style,
  imageStyle,
}: BrandLogoProps) {
  const theme = useTheme();
  const dimensions = brandLogoSize(height);

  return (
    <View style={[styles.row, style]}>
      <Image
        source={BRAND_LOGO}
        accessibilityLabel={`${APP_NAME} logo`}
        resizeMode="contain"
        style={[dimensions, styles.image, imageStyle]}
      />
      {showName ? (
        <Text
          style={[theme.typography.brand, styles.name, { color: theme.colors.textPrimary }]}>
          {name ?? APP_NAME}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  image: {
    flexShrink: 0,
  },
  name: {
    flexShrink: 1,
  },
});
