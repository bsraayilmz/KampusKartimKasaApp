# Kampüs Kartım Kasa (tablet)

Kafe/restoran kasasında duran tablet uygulaması. Eşleştirildiği kasa için **her 30 saniyede yenilenen** imzalı bir QR gösterir; öğrenci Kampüs Kartım uygulamasıyla okutur, onaylanan indirim tablette yeşil ekran olarak görünür.

Expo (SDK 58) + Expo Router, TypeScript.

## Çalıştırma

```bash
npm install
npx expo start          # tabletteki Expo Go ile QR'ı okut (tüm modüller Expo Go'da var)
npx expo start --web    # tarayıcıda önizleme
npm test                # QR token testleri
npx tsc --noEmit && npx expo lint
```

`EXPO_PUBLIC_KK_API_URL` verilmezse uygulama **DEMO** modunda çalışır: her 6 haneli kod eşleşir, `000000` süresi dolmuş kodu dener, ara sıra sahte okutma bildirimi gelir.

```bash
EXPO_PUBLIC_KK_API_URL=https://api.kampuskartim.com npx expo start
```

## Akış

1. **Eşleştirme** (`src/app/pair.tsx`): Süper Admin › Kasa cihazları › *Tablet eşleştir* ekranındaki 6 haneli kod girilir. Dönen cihaz sırrı Keychain/Keystore'da (`expo-secure-store`) saklanır.
2. **Kasa ekranı** (`src/app/index.tsx`): büyük QR, geri sayım halkası, işletme bilgisi, bağlantı durumu, bugünkü okutma sayısı, son 3 onay. Ekran kararmaz (`expo-keep-awake`). Yatay ve dikey yerleşimi var.
3. **Senkron** (`src/lib/kasa.tsx`): 30 sn'de bir ve uygulama öne geldiğinde `heartbeat`. Sunucu saatine göre saat farkı düzeltilir. `revoked` ya da 401/403 gelirse cihaz eşleştirmesi silinir ve eşleştirme ekranına dönülür.
4. **Gizli çıkış**: logoya 3 saniye basılı tutunca eşleştirmeyi kaldırma onayı açılır.

## QR formatı (backend ile sözleşme)

```
https://kampuskartim.com/k/{deviceId}.{window}.{sig}
window = floor(unixMs / 30000)
sig    = base64url(HMAC-SHA256(secret, "{deviceId}:{window}"))[0..22]
```

QR tablette yerelde üretilir; tablet internetsiz kalsa bile kod geçerli kalır. Sunucu aynı sırla doğrular, saat kayması için bir önceki pencereyi de kabul eder. Referans doğrulama: `verifyToken` (`src/lib/qrToken.ts`).

## Beklenen API

| Uç | İstek | Yanıt |
|---|---|---|
| `POST /kasa/pair` | `{ code, deviceName }` | `{ deviceId, secret (base64url, 32 bayt), deviceToken, business: { name, register, location } }` |
| `POST /kasa/heartbeat` | `Authorization: Bearer deviceToken`, `{ since }` | `{ serverTime, status: "active" \| "revoked", todayCount, events: [{ id, badge, campaign, student, at }] }` |

Hata yanıtları `{ message, code }`; geçersiz kod için 404, süresi dolmuş kod için 410.
