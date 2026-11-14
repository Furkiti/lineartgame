# Mürekkep Sokağı (lineartgame)

Mürekkeple çizilmiş bir Japon sokağında joystick ile yürüdüğün küçük bir mobil web oyunu.
İlk çizgilerle kendi yolcunu oluştur; başın, ceketindeki işaret ve mührün sana ait olsun.
Ekranda bir yere basıp sürükle; joystick parmağının altında çıkar. Gün kendiliğinden
akşama, akşam geceye döner. Yanından geçtiğin insanlar selam verir, kedi uyanır,
telin altında koşarsan serçeler kaçar. Çizdiklerin ve seçimlerin tarayıcıda kaydedilir.
Oyun acelesiz günler olarak akar. Kırmızı turnaya dokunursan sana yön gösterir.
Sabah Kenta'nın ağaca takılan uçurtması yerine fırçayla yenisini çizersin: ne çizersen uçurtma
birebir o olur. Kenta akşam yemeğe gelmek ister; evet ya da hayır demek akşamı değiştirir.
Kapında adının yazdığı bir levha, boş bir fener (istersen üstüne çiz, gece içinden ışık vurur) ve
bankta bir kedi var (bir oyuncak çiz, istersen eve davet et). Evde bohçanı askıya asar, buz
dolabından balığı alır, yakın planda kendi ellerinle suşi yaparsın. Gece fenerin altında
kıpırdamadan beklersen utangaç bir tilki gelir. Uyuyunca defter günün sayfasını senin
çizimlerinle yazar.
Eski süreli turna oyunu `?turna` ile açılır.

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
| `src/story/` | hikâye: bir gün (Kenta'nın uçurtması, suşi yakın planı, gece tilkisi, defter), kamera istekleri, balonlar, rehber turna, hayalet el |
| `src/joystick.ts` | dokunduğun yerde çıkan joystick + klavye |
| `src/lib/`, `src/village/` | line-art-animation kütüphanesi ve köy sahnesi (MIT, `LICENSE.line-art-animation`) |

## Yeni akış — `codex/lineartgame-dev`

Deneme sürümü: https://furkiti.github.io/lineartgame/playtest/

- Başlangıçta başını, gövdeni ve mührünü çiz. Baş çizgin karakterinde, gövde çizimin ceketinin arkasında, mührün ceketinde ve defterinde kalır; portren evde asılır.
- Birkaç adım sonra Kenta karşılaşması kendiliğinden başlar. Çizimler sokaktan ayrılan sade bir kâğıtta yapılır; örnekten yardım almak mümkündür.
- Turna düğmesi isteğe bağlı yön gösterir. İlk günün öğreticisi bitene kadar zaman bekler; çizim ve yemek yakın planında yavaşlar, defterde ve arka planda durur.
- Davet edilen Kenta akşam gelir, kapıda bekler; çok geç kalırsan not bırakır. Başka akşam yeniden davet edilebilir. Erken hazırlanan sofra Kenta gelene kadar kalır.
- İkinci gün kaligrafi siparişi, kalıcı tabela, dört sikke ve seçilebilir minder/su kabı açılır. Cebinden iki sikkeye rüzgâr çanı alabilirsin.
- Üçüncü gün yağmur, çay köşesi/fener masası seçimi, kendi deseninle ortak alan ve akşam buluşması açılır. Köşe ile çizimler sonraki günlerde kalır.
- İlerleme bu tarayıcıda otomatik kaydedilir. Defter önceki günleri saklar. **Yeni sayfa** onayından sonra yerel kayıt silinerek başlangıca dönülür.

`npm test` (Node 22.6+) zaman/randevu sınırlarını ve kayıt hata durumlarını sınar. `npx tsc --noEmit` tür kontrolünü yapar.

Kayıt modülü: `src/story/save.ts`; zaman/randevu kuralları: `src/story/schedule.ts`; odaklı çizim yüzeyi: `src/story/paper.ts`.
