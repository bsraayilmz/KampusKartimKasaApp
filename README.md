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

Backend Firebase'dir (yönetim paneli ve öğrenci uygulamasıyla aynı proje); ortam değişkeni gerekmez. Bağlantı `src/lib/firebase.ts`,
tüm okuma/yazma `src/lib/api.ts`. Kurallar panel deposunda: `firebase/firestore.rules` (`devices`, `pairingCodes`, `qrTokens`, `redemptions`).

## Akış

1. **Eşleştirme** (`src/app/pair.tsx`): Panel › Kasa cihazları › *Tablet eşleştir* ekranındaki 6 haneli kod girilir (15 dk, tek kullanımlık).
   Tablet anonim oturum açar, tek yazımda `devices/{yeni}` (`status: online`) oluşturur ve kodu kullanıldı işaretler.
   Cihaz kimliği Keychain/Keystore'da (`expo-secure-store`) saklanır.
2. **Kasa ekranı** (`src/app/index.tsx`): büyük QR, geri sayım halkası, işletme bilgisi, bağlantı durumu, bugünkü okutma sayısı, son 3 onay.
   Ekran kararmaz (`expo-keep-awake`). Yatay ve dikey yerleşimi var.
3. **QR**: sunucu saatine göre her 30 sn'lik pencerenin başında `qrTokens/{anahtar}` yazılır; QR içeriği
   `kampuskartim://checkout/{businessId}/{anahtar}` (öğrenci uygulaması bu biçimi okur). Anahtar sunucuya yazılmadan QR değişmez;
   bağlantı yokken üst çubuk "Bağlantı yok" gösterir.
4. **Okutmalar**: `redemptions` where `deviceId == bu cihaz` canlı dinlenir; yeni okutma yeşil onay ekranını açar.
5. **Kalp atışı** (`src/lib/kasa.tsx`): 30 sn'de bir ve uygulama öne geldiğinde `devices/{id}.lastSeenAt` (paneldeki çevrimiçi durumu).
   Sunucu saatine göre saat farkı düzeltilir. Panelden devre dışı bırakılınca QR durur, yeniden etkinleştirilince kendiliğinden döner;
   cihaz silinirse eşleştirme ekranına dönülür.
6. **Gizli çıkış**: logoya 3 saniye basılı tutunca eşleştirmeyi kaldırma onayı açılır.

`src/lib/qrToken.ts` içindeki HMAC'li çevrimdışı QR biçimi şu an kullanılmıyor (sunucu tarafında doğrulama için Cloud Functions gerekir).
