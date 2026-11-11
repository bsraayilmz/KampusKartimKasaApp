// Okutma onaylandığında tam ekran yeşil bildirim (mockup'taki Onay ekranının kasa karşılığı).
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { ScanEvent } from '@/lib/api';
import { colors, fonts } from '@/lib/theme';

const SHOW_MS = 5000;

export function ScanToast({ subscribe }: { subscribe: (cb: (ev: ScanEvent) => void) => () => void }) {
  const [current, setCurrent] = useState<ScanEvent | null>(null);
  const queue = useRef<ScanEvent[]>([]);
  const [opacity] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.3));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showing = useRef(false);

  const showNext = () => {
    const ev = queue.current.shift() ?? null;
    showing.current = !!ev;
    setCurrent(ev);
    if (!ev) return;
    opacity.setValue(0);
    scale.setValue(0.3);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
    ]).start();
    timer.current = setTimeout(dismiss, SHOW_MS);
  };

  const dismiss = () => {
    if (timer.current) clearTimeout(timer.current);
    Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => showNext());
  };

  useEffect(() => {
    const off = subscribe((ev) => {
      queue.current.push(ev);
      if (!showing.current) showNext();
    });
    return () => {
      off();
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe]);

  if (!current) return null;
  const time = new Date(current.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.wrap, { opacity }]} accessibilityLiveRegion="polite">
      <Pressable style={styles.inner} onPress={dismiss} accessibilityLabel="Bildirimi kapat">
        <Animated.View style={[styles.check, { transform: [{ scale }] }]}>
          <Svg width={74} height={74} viewBox="0 0 24 24">
            <Path d="M5 12.5l4.5 4.5L19 7.5" stroke={colors.lime} strokeWidth={2.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
        <Text style={styles.title}>İndirim onaylandı</Text>
        <View style={styles.card}>
          <Text style={styles.badge}>{current.badge}</Text>
          <Text style={styles.campaign}>{current.campaign}</Text>
          <Text style={styles.student}>
            {current.student} · {time}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: colors.green, zIndex: 10 },
  inner: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18, padding: 24 },
  check: { width: 140, height: 140, borderRadius: 70, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.displayHeavy, fontSize: 40, color: colors.ink, letterSpacing: -1, textAlign: 'center' },
  card: { backgroundColor: colors.white, borderRadius: 28, paddingVertical: 24, paddingHorizontal: 48, alignItems: 'center', gap: 6 },
  badge: { fontFamily: fonts.displayHeavy, fontSize: 64, color: colors.purple, lineHeight: 70 },
  campaign: { fontFamily: fonts.bold, fontSize: 20, color: colors.ink, textAlign: 'center' },
  student: { fontFamily: fonts.body, fontSize: 15, color: colors.mutedDark },
});
