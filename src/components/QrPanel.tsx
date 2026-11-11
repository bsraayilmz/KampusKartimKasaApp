// Her 30 saniyede bir yeni imzalı QR üretir ve geri sayımı gösterir.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { buildToken, PERIOD_SEC, windowAt, type DeviceKey } from '@/lib/qrToken';
import { colors, fonts } from '@/lib/theme';
import { CountdownRing } from './CountdownRing';
import { LogoMark } from './Logo';

const Code = memo(function Code({ value, size }: { value: string; size: number }) {
  return <QRCode value={value} size={size} color={colors.ink} backgroundColor={colors.white} ecl="H" quietZone={0} />;
});

export function QrPanel({ device, clockOffsetMs, size }: { device: DeviceKey; clockOffsetMs: number; size: number }) {
  const [now, setNow] = useState(() => Date.now() + clockOffsetMs);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + clockOffsetMs), 250);
    return () => clearInterval(t);
  }, [clockOffsetMs]);

  const win = windowAt(now);
  const token = useMemo(() => buildToken(device, win * PERIOD_SEC * 1000), [device, win]);

  // Kod değişince kısa bir geçiş animasyonu
  const [fade] = useState(() => new Animated.Value(1));
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    fade.setValue(0.15);
    Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }, [token.url, fade]);

  const remaining = Math.max(0, token.expiresAt - now);
  const secs = Math.ceil(remaining / 1000);
  const pad = Math.round(size * 0.07);

  return (
    <View style={styles.col}>
      <View style={[styles.card, { padding: pad, borderRadius: pad + 8 }]}>
        <Animated.View style={{ opacity: fade }}>
          <Code value={token.url} size={size} />
        </Animated.View>
        <View style={[styles.badge, { width: size * 0.2, height: size * 0.2, borderRadius: size * 0.045, left: pad + size * 0.4, top: pad + size * 0.4 }]}>
          <LogoMark size={size * 0.13} />
        </View>
      </View>

      <View style={styles.timer} accessibilityLabel={`${secs} saniye sonra yeni kod`}>
        <CountdownRing progress={remaining / (PERIOD_SEC * 1000)} warn={secs <= 5} />
        <Text style={styles.secs}>{secs}</Text>
        <Text style={styles.timerText}>sn sonra yeni kod</Text>
      </View>
      <Text style={styles.note}>Kod her 30 saniyede otomatik yenilenir</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  col: { alignItems: 'center', gap: 18 },
  card: {
    backgroundColor: colors.white,
    borderWidth: 10,
    borderColor: 'rgba(108,59,255,0.35)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 20 },
    elevation: 16,
  },
  badge: {
    position: 'absolute',
    backgroundColor: colors.ink,
    borderWidth: 5,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  secs: { fontFamily: fonts.displayHeavy, fontSize: 26, color: colors.white, minWidth: 34, textAlign: 'right', fontVariant: ['tabular-nums'] },
  timerText: { fontFamily: fonts.medium, fontSize: 15, color: colors.muted },
  note: { fontFamily: fonts.body, fontSize: 13, color: colors.muted, marginTop: -6 },
});
