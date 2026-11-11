import { useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Brand } from '@/components/Logo';
import { useKasa } from '@/lib/kasa';
import { colors, fonts } from '@/lib/theme';

const formatCode = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 6);
  return d.length > 3 ? `${d.slice(0, 3)}·${d.slice(3)}` : d;
};

export default function PairScreen() {
  const { pair, mock, revokeReason } = useKasa();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const complete = code.replace(/\D/g, '').length === 6;

  async function submit() {
    if (!complete || busy) return;
    setBusy(true);
    setError('');
    const res = await pair(code);
    // Başarılıysa Stack.Protected otomatik olarak QR ekranına geçer
    if (!res.ok) {
      setBusy(false);
      setError(res.message);
      input.current?.focus();
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.blob} pointerEvents="none" />
      <View style={styles.card}>
        <View style={styles.brandRow}>
          <Brand onDark={false} />
          <Text style={styles.pill}>KASA</Text>
        </View>

        <Text style={styles.h1}>Bu tableti kasaya bağla</Text>
        <Text style={styles.lead}>
          Kampüs Kartım panelinde <Text style={styles.leadBold}>Kasa cihazları › Tablet eşleştir</Text> ekranındaki 6 haneli
          kodu gir. Kod 15 dakika geçerlidir, kullanıcı girişi gerekmez.
        </Text>

        {revokeReason ? <Text style={styles.notice}>{revokeReason}</Text> : null}

        <Text style={styles.label}>EŞLEŞTİRME KODU</Text>
        <TextInput
          ref={input}
          value={code}
          onChangeText={(v) => {
            setCode(formatCode(v));
            setError('');
          }}
          onSubmitEditing={submit}
          keyboardType="number-pad"
          maxLength={7}
          placeholder="000·000"
          placeholderTextColor="#D6D0EA"
          autoFocus
          style={styles.input}
          accessibilityLabel="Eşleştirme kodu"
        />
        <Text style={styles.error} accessibilityLiveRegion="assertive">
          {error}
        </Text>

        <Pressable
          onPress={submit}
          disabled={!complete || busy}
          style={({ pressed }) => [styles.btn, (!complete || busy) && styles.btnDisabled, pressed && styles.btnPressed]}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color={colors.lime} /> : <Text style={styles.btnText}>Eşleştir</Text>}
        </Pressable>

        {mock ? <Text style={styles.hint}>Demo modu: her 6 haneli kod eşleşir · 000000 süresi dolmuş kodu dener</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'hidden' },
  blob: { position: 'absolute', right: -160, top: -160, width: 520, height: 520, borderRadius: 260, backgroundColor: colors.purple, opacity: 0.45 },
  card: { width: '100%', maxWidth: 520, backgroundColor: colors.paper, borderRadius: 32, padding: 32, gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pill: {
    fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: colors.purpleDeep,
    backgroundColor: colors.purpleSoft, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5, overflow: 'hidden',
  },
  h1: { fontFamily: fonts.displayHeavy, fontSize: 28, color: colors.ink, marginTop: 10, letterSpacing: -0.5 },
  lead: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23, color: colors.mutedDark },
  leadBold: { fontFamily: fonts.bold, color: colors.ink },
  notice: {
    fontFamily: fonts.semibold, fontSize: 14, color: '#A3142A', backgroundColor: colors.redSoft,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, overflow: 'hidden',
  },
  label: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 0.6, color: colors.mutedDark, marginTop: 6 },
  input: {
    height: 76, borderWidth: 2, borderColor: '#E2DCF5', borderRadius: 20, backgroundColor: colors.white,
    fontFamily: fonts.displayHeavy, fontSize: 38, letterSpacing: 8, textAlign: 'center', color: colors.ink,
  },
  error: { fontFamily: fonts.semibold, fontSize: 13, color: '#C4182B', minHeight: 18 },
  btn: { height: 58, borderRadius: 999, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center' },
  btnDisabled: { opacity: 0.35 },
  btnPressed: { transform: [{ scale: 0.98 }] },
  btnText: { fontFamily: fonts.display, fontSize: 17, color: colors.lime },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.mutedDark, textAlign: 'center' },
});
