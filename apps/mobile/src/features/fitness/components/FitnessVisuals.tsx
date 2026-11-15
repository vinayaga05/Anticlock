import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';
import { Dumbbell, Leaf, Mountain, PersonStanding } from 'lucide-react-native';
import { FitnessPhotoTextContext, useFitnessColors } from './FitnessUI';

const photos = {
  workout: require('../assets/workout.jpg'),
  strength: require('../assets/strength.jpg'),
  yoga: require('../assets/yoga.jpg'),
  food: require('../assets/food.jpg'),
  fruit: require('../assets/fruit.jpg'),
  grains: require('../assets/grains.jpg'),
  protein: require('../assets/protein.jpg'),
  outdoor: require('../assets/outdoor.jpg'),
} satisfies Record<string, ImageSourcePropType>;
const photoLabels = {
  workout: 'People enjoying an exercise class',
  strength: 'Strength training in a gym',
  yoga: 'A woman practicing yoga at sunset',
  food: 'A colourful bowl of vegetables',
  fruit: 'A basket of fresh fruit',
  grains: 'A bowl of seasoned rice',
  protein: 'An egg on toast',
  outdoor: 'A runner climbing outdoor steps',
};
export function FitnessPhoto({
  kind,
  style,
  children,
  label,
}: {
  kind: keyof typeof photos;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
  label?: string;
}) {
  const c = useFitnessColors();
  const gradientId = `fitness-photo-${React.useId().replace(
    /[^a-zA-Z0-9]/g,
    '',
  )}`;
  const [failed, setFailed] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  React.useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [kind]);
  const Glyph = ['food', 'fruit', 'grains', 'protein'].includes(kind)
    ? Leaf
    : kind === 'outdoor'
    ? Mountain
    : kind === 'yoga'
    ? PersonStanding
    : Dumbbell;
  return (
    <View
      style={[
        {
          height: 190,
          borderRadius: 24,
          overflow: 'hidden',
          backgroundColor: c.soft,
        },
        style,
        Boolean(children) && {
          height: undefined,
          minHeight:
            typeof StyleSheet.flatten(style)?.height === 'number'
              ? (StyleSheet.flatten(style)?.height as number)
              : 190,
        },
      ]}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <Glyph size={40} strokeWidth={1.2} color={c.accent} />
      </View>
      {!failed && (
        <Image
          source={photos[kind]}
          testID={`fitness-photo-${kind}`}
          accessibilityLabel={label ?? photoLabels[kind]}
          resizeMode="cover"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={[StyleSheet.absoluteFill, { opacity: loaded ? 1 : 0 }]}
        />
      )}
      {children && (
        <Svg
          width="100%"
          height="100%"
          style={StyleSheet.absoluteFill}
          accessible={false}
        >
          <Defs>
            <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#061C14" stopOpacity={0.45} />
              <Stop offset="1" stopColor="#061C14" stopOpacity={0.94} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      )}
      {children && (
        <View
          style={{
            flexGrow: 1,
            padding: 20,
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <FitnessPhotoTextContext.Provider value>
            {children}
          </FitnessPhotoTextContext.Provider>
        </View>
      )}
    </View>
  );
}
export function FitnessAvatar({
  uri,
  name,
  size = 46,
}: {
  uri?: string | null;
  name: string;
  size?: number;
}) {
  const c = useFitnessColors();
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [uri]);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: c.soft,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          accessibilityLabel={`${name}'s profile photo`}
          onError={() => setFailed(true)}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <Text
          accessibilityLabel={name}
          style={{ color: c.accent, fontWeight: '600', fontSize: size * 0.34 }}
        >
          {name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map(n => n[0])
            .join('')
            .toUpperCase() || 'A'}
        </Text>
      )}
    </View>
  );
}
export function FitnessRing({
  value,
  size = 100,
  strokeWidth = 8,
  color,
  children,
  label,
}: {
  value?: number | null;
  size?: number;
  strokeWidth?: number;
  color?: string;
  children?: React.ReactNode;
  label: string;
}) {
  const c = useFitnessColors();
  const percent =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.min(100, Math.max(0, value))
      : null;
  const radius = (size - strokeWidth) / 2;
  const length = 2 * Math.PI * radius;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      accessibilityValue={
        percent === null
          ? { text: 'No comparison available' }
          : {
              min: 0,
              max: 100,
              now: percent,
              text: `${Number(percent.toFixed(1))}%`,
            }
      }
      style={{
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Svg
        width={size}
        height={size}
        style={StyleSheet.absoluteFill}
        accessible={false}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={c.line}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {percent !== null && percent > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color ?? c.accent}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${length} ${length}`}
            strokeDashoffset={length * (1 - percent / 100)}
            strokeLinecap="round"
            rotation={-90}
            origin={`${size / 2},${size / 2}`}
          />
        )}
      </Svg>
      <View
        style={{
          maxWidth: size - strokeWidth * 3,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}
/** Decorative, neutral silhouettes are self-description choices, never body analysis. */
export function FitnessIllustration({
  kind = 'empty',
  size = 120,
}: {
  kind?: 'welcome' | 'empty' | 'body-lean' | 'body-athletic' | 'body-broad';
  size?: number;
}) {
  const c = useFitnessColors();
  if (kind.startsWith('body-')) {
    const broad = kind === 'body-broad';
    const athletic = kind === 'body-athletic';
    const left = broad ? 32 : athletic ? 36 : 40;
    const right = 100 - left;
    return (
      <Svg width={size} height={size} viewBox="0 0 100 115" accessible={false}>
        <Ellipse cx="50" cy="108" rx="29" ry="4" fill={c.line} />
        <Circle cx="50" cy="17" r="10" fill={c.accent} />
        <Path
          d={`M${left} 34 Q50 28 ${right} 34 L${right + 7} 65 Q${
            right + 8
          } 70 ${right + 3} 71 L${right - 4} 48 L${
            right - 5
          } 69 L58 104 Q54 109 52 103 L50 77 L48 103 Q45 109 42 104 L${
            left + 5
          } 69 L${left + 4} 48 L${left - 3} 71 Q${left - 8} 70 ${
            left - 7
          } 65 Z`}
          fill={c.accent}
          opacity="0.72"
        />
        <Path
          d="M43 39 Q50 43 57 39"
          stroke={c.onAccent}
          strokeWidth="1.5"
          fill="none"
          opacity="0.6"
        />
      </Svg>
    );
  }
  return (
    <Svg width={size} height={size} viewBox="0 0 160 140" accessible={false}>
      <Defs>
        <LinearGradient id={`fitness-${kind}`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={c.soft} />
          <Stop offset="1" stopColor={c.surface} />
        </LinearGradient>
      </Defs>
      <Circle cx="81" cy="68" r="60" fill={`url(#fitness-${kind})`} />
      <Ellipse cx="81" cy="125" rx="57" ry="7" fill={c.line} opacity=".5" />
      <Path
        d="M30 114 Q27 78 47 66 Q63 91 44 116"
        fill={c.accent}
        opacity=".35"
      />
      <Path d="M42 117 L44 84" stroke={c.accent} strokeWidth="2" />
      <Rect
        x="57"
        y="40"
        width="66"
        height="79"
        rx="15"
        fill={c.surface}
        stroke={c.line}
        strokeWidth="2"
      />
      <Rect x="73" y="33" width="34" height="15" rx="7" fill={c.accent} />
      <Circle cx="77" cy="70" r="6" fill={c.soft} />
      <Path
        d="M74 70 L77 73 L82 66"
        fill="none"
        stroke={c.accent}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Path
        d="M91 70 H109 M91 87 H109 M72 103 H109"
        fill="none"
        stroke={c.line}
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Circle cx="77" cy="87" r="6" fill={c.soft} />
      <Path
        d="M74 87 L77 90 L82 83"
        fill="none"
        stroke={c.accent}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Circle cx="126" cy="32" r="13" fill={c.clay} opacity=".9" />
      <Path
        d="M126 25 V39 M119 32 H133"
        stroke={c.surface}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </Svg>
  );
}
export function FitnessEmptyGraphic() {
  return (
    <View style={{ alignItems: 'center' }}>
      <FitnessIllustration kind="empty" size={128} />
    </View>
  );
}
