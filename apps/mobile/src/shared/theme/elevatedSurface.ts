import { Platform, processColor, type ViewStyle } from 'react-native';

/** Android elevation must sit on an opaque surface or its shadow can show
 * through the fill and form rectangular patches around child content. Blend
 * the tint once, keeping the shadow, border and child opacity independent.
 */
export function elevatedSurface(style: ViewStyle, surface: string): ViewStyle {
  if (Platform.OS !== 'android' || !(Number(style.elevation) > 0)) return style;
  const foreground = processColor(style.backgroundColor);
  const background = processColor(surface);
  if (typeof foreground !== 'number' || typeof background !== 'number') return style;
  const alpha = (foreground >>> 24) / 255;
  if (alpha === 1 || (background >>> 24) !== 255) return style;
  const channel = (shift: number) => Math.round(
    ((foreground >>> shift) & 255) * alpha + ((background >>> shift) & 255) * (1 - alpha),
  );
  return {
    ...style,
    backgroundColor: `rgb(${channel(16)}, ${channel(8)}, ${channel(0)})`,
  };
}
