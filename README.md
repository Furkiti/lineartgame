# Mürekkep Sokağı (lineartgame)

Mürekkeple çizilmiş bir Japon sokağında joystick ile yürüdüğün küçük bir mobil web oyunu.
Ekranda bir yere basıp sürükle, joystick parmağının altında çıkar, sonuna kadar itersen koşar. Sokağa dağılmış 12 kırmızı kâğıt
turnayı en kısa sürede topla. Gün akşama, akşam geceye döner. Yanından geçtiğin insanlar
selam verir, bankta uyuyan kedi uyanır, telin altında koşarsan serçeler kaçar.
Sokağın sonundaki eve girip mutfakta suşi hazırlayabilir, masaya götürüp yiyebilirsin.

Her şey canlı SVG olarak çiziliyor, görsel stil ve köy sahnesi
[JDhruv14/line-art-animation](https://github.com/JDhruv14/line-art-animation) (MIT) kütüphanesinden geliyor.

## Çalıştırma

```sh
npm install
npm run dev      # telefondan aynı ağdan açmak için --host açık
npm run build    # dist/ klasörüne statik site
```

Klavye: ok tuşları / WASD, Shift ile koş.

## Cloudflare Pages

Dashboard → Workers & Pages → Create → Pages → Connect to Git → bu repo.
Build command: `npm run build` · Build output directory: `dist`.

## Yapı

| | |
|---|---|
| `src/main.ts` | oyun döngüsü, kamera, turnalar, skor |
| `src/player.ts` | yolcu: yürüme/koşma gait karışımı, ceket, bohça, kasa şapka; 3B gövde iskeletiyle her yöne döner |
| `src/cranes.ts` | toplanan kâğıt turnalar |
| `src/village/home.ts` | sokağın sonundaki ev: içi kesit çizim (genkan, tatami oda, mutfak), suşi hazırlama |
| `src/joystick.ts` | dokunduğun yerde çıkan joystick + klavye |
| `src/lib/`, `src/village/` | line-art-animation kütüphanesi ve köy sahnesi (MIT, `LICENSE.line-art-animation`) |
