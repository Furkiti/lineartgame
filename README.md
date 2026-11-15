# Mürekkep Sokağı (lineartgame)

Mürekkeple çizilmiş bir Japon sokağında joystick ile yürüdüğün küçük bir mobil web oyunu.
Turna ile tanış, mahalleyi görerek yürümeyi öğren ve ağacın yanındaki Kenta ile karşılaş.
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

- Karakter oluşturma kaldırıldı. Turnanın yanındaki öğretici sen dokunana kadar bekler; Kenta ve ev arasında da yürüyerek keşfedeceğin mesafe vardır.
- Kenta’ya yaklaşınca karşılaşma başlar. Uçurtmayı doğrudan sahnedeki açık alana çizersin; biçimi değişmeden canlanır. Davetin yazısı bittikten sonra seçenekler gelir. Kenta uçurtmasıyla uzaklaşınca Ev işareti yanar.
- Sol altta dolaşan aynı origami turna, dokununca hedefe uçup geri döner. İlk tanışma dışında açıklamaları sahnede görürsün; görünür bir düğme yüzeyi yoktur. İlk günün öğreticisi bitene kadar zaman bekler; çizim ve yemek yakın planında yavaşlar, defterde ve arka planda durur.
- Davet edilen Kenta akşam gelir, kapıda bekler; çok geç kalırsan not bırakır. Başka akşam yeniden davet edilebilir. Erken hazırlanan sofra Kenta gelene kadar kalır.
- İkinci gün kaligrafi siparişi, kalıcı tabela, dört sikke ve seçilebilir minder/su kabı açılır. Cebinden iki sikkeye rüzgâr çanı alabilirsin.
- Üçüncü gün yağmur, çay köşesi/fener masası seçimi, kendi deseninle ortak alan ve akşam buluşması açılır. Köşe ile çizimler sonraki günlerde kalır.
- İlerleme bu tarayıcıda otomatik kaydedilir. Defter önceki günleri saklar. Test için **oyun saatine iki kez dokun**; sıfırlama onayından sonra yerel kayıt silinerek başlangıca dönülür.

`npm test` (Node 22.6+) zaman/randevu sınırlarını ve kayıt hata durumlarını sınar. `npx tsc --noEmit` tür kontrolünü yapar.

Kayıt modülü: `src/story/save.ts`; zaman/randevu kuralları: `src/story/schedule.ts`; odaklı çizim yüzeyi: `src/story/paper.ts`.

## İlk gün etkileşimleri

Bilinçli başlatılanlar: dolabı açmak, suşiye başlamak, yemek yemek, uyumak ve diyalog seçimleri.
Yaklaşınca tamamlananlar: askıda bohçayı bırakmak, balığı tezgâha koymak, hazır tabağı almak ve masaya bırakmak.
Kapıya yürümek sürgüleri kademeli açar; geri çekilmek kapatır. Eşiği geçmek dışarı çıkarır.
Pirinç gerçek dairesel hareketlerle karıştırılır. Balık kesme, nigiri şekillendirme ve tabağa dizme aynı kısa dokunuşla ilerler; parmağın yemeği örtmek zorunda değildir. Bohçayı asarken yürümeye devam edebilirsin. Etkileşimler joystick parmağının üstüne çıkmaz.

Sofra erken hazırsa pencereyi aralayabilir, örtüye kendi desenini çizebilirsin. Desen sofrada ve günün defterinde kalır. İlk gün bu sırada doğal biçimde gün batımına yaklaşır; davetli yerine oturunca yemek açılır. Yemekten sonra sokak lambası, tilkiden sonra futon sıradaki hedef olur.

## Baştan sona oynanış kontrolü

`npm run test:play` mobil boyutta gerçek dokunma/joystick girdileriyle, normal gün süresinde açılışı, turnayı, uçurtma çizimini, daveti, eve yürüyüşü, kapıdan geri çekilmeyi ve mutfağı, sofraya çizilen deseni, akşam yemeğini, gece tilkisini ve uyuyup ikinci güne geçişi oynar. Oyuncu konumunu veya hikâye durumunu atlayarak değiştirmez.

Önce `npx playwright install chromium` çalıştır; `npm run build` sonrasında ayrı terminalde `npm run preview -- --port 4173` başlat. Ardından `npm run test:play` çalıştır. Ekran görüntüleri `.local/` içine yazılır. Klavye alternatifi için `PLAY_INPUT=keyboard` kullanılabilir. `npm run test:ui`, açılıştaki yazı çakışması, tek turnanın gidiş/dönüşü, joystickten ayrı metin/buton konumu, uçurtma şablonu ve kapı eşiği gibi hataları ayrı kurulumlarla denetler. Video için `npx playwright install ffmpeg` ve `RECORD_PLAYTHROUGH=1 npm run test:play` kullanılabilir. Farklı adres için `PLAYTEST_URL`, sistem Chromium'u için `CHROMIUM_PATH` belirtilebilir.
