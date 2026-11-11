import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts } from '@/lib/theme';

export function LogoMark({ size = 30, frame = colors.white }: { size?: number; frame?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M2 8V3.5A1.5 1.5 0 0 1 3.5 2H8M16 2h4.5A1.5 1.5 0 0 1 22 3.5V8M22 16v4.5a1.5 1.5 0 0 1-1.5 1.5H16M8 22H3.5A1.5 1.5 0 0 1 2 20.5V16"
        stroke={frame}
        strokeWidth={2.4}
        fill="none"
        strokeLinecap="round"
      />
      <Circle cx={12} cy={12} r={6.5} fill={colors.lime} />
      <Path d="M9 12.2l2.1 2.1L15.2 10" stroke={colors.ink} strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function Brand({ size = 20, onDark = true }: { size?: number; onDark?: boolean }) {
  return (
    <View style={styles.row}>
      <LogoMark size={size * 1.5} frame={onDark ? colors.white : colors.ink} />
      <Text style={[styles.word, { fontSize: size, color: onDark ? colors.white : colors.ink }]}>
        kampüs<Text style={{ color: onDark ? colors.lime : colors.purple }}>kartım</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  word: { fontFamily: fonts.displayHeavy, letterSpacing: -0.5 },
});
