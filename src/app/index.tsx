// Kasa ekranı: büyük QR (30 sn'de bir yenilenir), işletme bilgisi, bağlantı durumu, son onaylar.
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { Brand } from '@/components/Logo';
import { QrPanel } from '@/components/QrPanel';
import { ScanToast } from '@/components/ScanToast';
import { useKasa } from '@/lib/kasa';
import { colors, fonts } from '@/lib/theme';

function useClock(offsetMs: number) {
  const [now, setNow] = useState(() => new Date(Date.now() + offsetMs));
  useEffect(() => {
    const t = setInterval(() => setNow(new Date(Date.now() + offsetMs)), 1000);
    return () => clearInterval(t);
  }, [offsetMs]);
  return now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function relTime(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'şimdi';
  if (m < 60) return `${m} dk önce`;
  return `${Math.floor(m / 60)} sa önce`;
}

export default function KasaScreen() {
  useKeepAwake(); // kasa ekranı kararmasın
  const { device, status, qr, recent, mock, unpair, onScan } = useKasa();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const clock = useClock(status.clockOffsetMs);
  const [, rerender] = useState(0);
  useEffect(() => {
    const t = setInterval(() => rerender((n) => n + 1), 30_000); // "x dk önce" güncel kalsın
    return () => clearInterval(t);
  }, []);

  if (!device) return null;

  const landscape = width > height;
  const qrSize = Math.round(landscape ? Math.min(height * 0.52, width * 0.36, 460) : Math.min(width * 0.62, height * 0.36, 460));

  // Kasiyerin yanlışlıkla bağlantıyı koparmaması için gizli: logoya 3 sn basılı tut
  const confirmUnpair = () =>
    Alert.alert(
      'Eşleştirmeyi kaldır',
      `${device.business.name} · ${device.business.register} eşleştirmesi kaldırılsın mı? Tekrar kullanmak için panelden yeni kod gerekir.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Kaldır', style: 'destructive', onPress: () => unpair() },
      ]
    );

  const conn =
    status.disabled
      ? { text: 'Panelden devre dışı bırakıldı', dot: colors.red, bg: 'rgba(255,77,94,0.16)', fg: '#FFD3D8' }
      : status.online === true
      ? { text: 'Çevrim içi', dot: colors.green, bg: colors.glass, fg: colors.white }
      : status.online === false
        ? { text: 'Bağlantı yok · yeniden bağlanıyor', dot: colors.red, bg: 'rgba(255,77,94,0.16)', fg: '#FFD3D8' }
        : { text: 'Bağlanıyor…', dot: colors.muted, bg: colors.glass, fg: colors.white };

  const info = (
    <View style={[styles.info, !landscape && styles.infoPortrait]}>
      <View style={styles.biz}>
        <View style={styles.bizIcon}>
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke={colors.ink} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10" />
            <Path d="M17 3c-2 2-2 6 0 8v10" />
          </Svg>
        </View>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.bizName} numberOfLines={1}>{device.business.name}</Text>
          <Text style={styles.bizSub} numberOfLines={1}>
            {[device.business.register, device.business.location].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {landscape ? (
        <>
          <Text style={[styles.headline, { fontSize: Math.min(56, width * 0.042) }]}>
            Öğrenci indirimin{'\n'}için <Text style={{ color: colors.lime }}>{"QR'ı okut"}</Text>
          </Text>
          <View style={styles.steps}>
            {['Kampüs Kartım uygulamasını aç', 'Ortadaki QR butonuna bas, bu kodu okut', 'Yeşil onay ekranını kasiyere göster'].map((s, i) => (
              <View key={s} style={styles.step}>
                <Text style={styles.stepNo}>{i + 1}</Text>
                <Text style={styles.stepText}>{s}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={[styles.headline, { fontSize: 34, textAlign: 'center' }]}>
          Öğrenci indirimi için <Text style={{ color: colors.lime }}>{"QR'ı okut"}</Text>
        </Text>
      )}
    </View>
  );

  const stats = (
    <View style={styles.stats}>
      <View style={styles.stat}>
        <Text style={styles.statLabel}>BUGÜN OKUTMA</Text>
        <Text style={styles.statValue}>{status.todayCount ?? '–'}</Text>
      </View>
      <View style={[styles.stat, { flex: 1 }]}>
        <Text style={styles.statLabel}>SON ONAYLAR</Text>
        {recent.length === 0 ? (
          <Text style={styles.recentEmpty}>Henüz okutma yok</Text>
        ) : (
          recent.map((ev) => (
            <View key={ev.id} style={styles.recentRow}>
              <Text style={styles.recentBadge}>{ev.badge}</Text>
              <Text style={styles.recentText} numberOfLines={1}>
                {ev.student} · {ev.campaign}
              </Text>
              <Text style={styles.recentTime}>{relTime(ev.at)}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 24, paddingLeft: insets.left + 32, paddingRight: insets.right + 32 }]}>
      <View style={styles.topbar}>
        <Pressable onLongPress={confirmUnpair} delayLongPress={3000} accessibilityHint="Eşleştirmeyi kaldırmak için 3 saniye basılı tut">
          <Brand />
        </Pressable>
        {mock ? <Text style={styles.demo}>DEMO</Text> : null}
        <View style={styles.topRight}>
          <View style={[styles.conn, { backgroundColor: conn.bg }]}>
            <View style={[styles.dot, { backgroundColor: conn.dot }]} />
            <Text style={[styles.connText, { color: conn.fg }]} numberOfLines={1}>{conn.text}</Text>
          </View>
          {landscape ? <Text style={styles.clock}>{clock}</Text> : null}
        </View>
      </View>

      {landscape ? (
        <View style={styles.rowLayout}>
          <View style={{ flex: 1, gap: 28 }}>
            {info}
            {stats}
          </View>
          <QrPanel qr={qr} clockOffsetMs={status.clockOffsetMs} size={qrSize} />
        </View>
      ) : (
        <View style={styles.colLayout}>
          {info}
          <QrPanel qr={qr} clockOffsetMs={status.clockOffsetMs} size={qrSize} />
          {stats}
        </View>
      )}

      <ScanToast subscribe={onScan} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  topbar: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  topRight: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 18, flexShrink: 1 },
  demo: {
    fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: colors.ink, backgroundColor: colors.lime,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden',
  },
  conn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, flexShrink: 1 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  connText: { fontFamily: fonts.semibold, fontSize: 13, flexShrink: 1 },
  clock: { fontFamily: fonts.display, fontSize: 20, color: colors.white, fontVariant: ['tabular-nums'] },

  rowLayout: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 48, paddingHorizontal: 24 },
  colLayout: { flex: 1, alignItems: 'stretch', justifyContent: 'space-evenly', gap: 20 },

  info: { gap: 28 },
  infoPortrait: { alignItems: 'center', gap: 18 },
  biz: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  bizIcon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.lime, alignItems: 'center', justifyContent: 'center' },
  bizName: { fontFamily: fonts.displayHeavy, fontSize: 24, color: colors.white },
  bizSub: { fontFamily: fonts.body, fontSize: 14, color: colors.muted, marginTop: 2 },
  headline: { fontFamily: fonts.displayHeavy, color: colors.white, letterSpacing: -1.2, lineHeight: undefined },
  steps: { gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNo: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: colors.purple, color: colors.white, overflow: 'hidden',
    fontFamily: fonts.display, fontSize: 14, textAlign: 'center', lineHeight: 30,
  },
  stepText: { fontFamily: fonts.medium, fontSize: 16, color: '#E8E4F7', flexShrink: 1 },

  stats: { flexDirection: 'row', gap: 12 },
  stat: { backgroundColor: colors.glass, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 16, gap: 6 },
  statLabel: { fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, color: colors.muted },
  statValue: { fontFamily: fonts.displayHeavy, fontSize: 36, color: colors.lime },
  recentEmpty: { fontFamily: fonts.body, fontSize: 14, color: colors.muted },
  recentRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recentBadge: {
    fontFamily: fonts.displayHeavy, fontSize: 12, color: colors.white, backgroundColor: colors.purple,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden',
  },
  recentText: { fontFamily: fonts.medium, fontSize: 14, color: colors.white, flex: 1 },
  recentTime: { fontFamily: fonts.body, fontSize: 12, color: colors.muted },
});
