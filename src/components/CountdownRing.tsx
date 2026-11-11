import Svg, { Circle } from 'react-native-svg';
import { colors } from '@/lib/theme';

const R = 19;
const LEN = 2 * Math.PI * R;

/** progress: 1 = tam süre kaldı, 0 = bitti */
export function CountdownRing({ progress, size = 44, warn = false }: { progress: number; size?: number; warn?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 44 44" style={{ transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={22} cy={22} r={R} stroke="rgba(255,255,255,0.12)" strokeWidth={5} fill="none" />
      <Circle
        cx={22}
        cy={22}
        r={R}
        stroke={warn ? colors.amber : colors.lime}
        strokeWidth={5}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={LEN}
        strokeDashoffset={LEN * (1 - Math.max(0, Math.min(1, progress)))}
      />
    </Svg>
  );
}
