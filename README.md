# Mürekkep Sokağı · lineartgame

Mürekkeple çizilmiş bir Japon mahallesinde küçük bir mobil oyun. Sokakta yürür,
çizgilerinle kullanılan şeyler yapar, komşularla tanışır ve evini kendine benzetirsin.
Uçurtmanın biçimi, dükkânın işareti, örtünün deseni ve çanın kâğıdı senin çizdiğin gibi
kalır. Seçimlerin mekânın kullanımını, hediyelerini ve sonraki sohbetleri değiştirir.

Deneme sürümü: https://furkiti.github.io/lineartgame/playtest/
Geliştirme branch’i: `codex/lineartgame-dev`.

## İlk beş gün

| Gün | Oynanan iş | Mahallede kalan sonuç |
| --- | --- | --- |
| 1 · Bir uçurtma, bir sofra | Turna’yla tanış, Kenta’nın kaçan uçurtmasını çiz, daveti seç, evinde suşi hazırla | Uçurtman uçar; ilk akşam evde kalabilir veya fenerini çizebilirsin |
| 2 · Çay evinde bir iz | Hana’yla tanış, serbest bir işaret çiz veya kaligrafi yap; hediyeni seç | Çizgin dükkânın tabelası olur; evde minder veya kapıda kuşların su kabı kalır |
| 3 · Yağmurda bir yer | Çay köşesi veya pati köşesi seç; direk ve örtüyü sürükleyerek kur; desenini çiz | Yağmuru kesen, gerçekten kullanılan kuru bir köşe oluşur |
| 4 · Rüzgârın sesi | Çanın yeni kâğıt dilini çiz, ipine bağla; evine ya da köşeye as | Çizgin rüzgârda sallanır; sakin köşeyi keşfedenler yağmur izlerinin sahibini görebilir |
| 5 · Birlikte kalan çizgiler | Çay sofrası ya da çizim buluşması seç, flama çiz, fincanları/fırçaları uzat | Önceki çizgilerin aynı yerde buluşur; hatırayı evinde veya ortak köşede bırakırsın |

Günlerin ayrıntılı neden-sonuç akışı: [docs/five-day-journey.md](docs/five-day-journey.md).
Bir günün işini ertelemek, sonraki gün onu silmez. Tilki isteğe bağlı keşiftir;
yemekten sonra dışarı çıkıp hayvan beklemek ya da uyumak için onu görmek gerekmez.
Beşinci günden sonra mahalle ve çizimlerin korunur. Eski süreli turna oyunu `?turna` ile açılır.

## Kontroller ve küçük etkileşimler

Yere basıp sürükle: joystick parmağının altında çıkar, her yöne yürüyebilirsin.
Kamera yürüdüğün yönün önünü yumuşakça açar. Etkileşim düğmesi sabit bir yerde durur.
Kırmızı Turna’ya dokununca aynı turna sahnedeki hedefe uçup geri gelir; ilk dokunuşta
kendini tanıtır. Hareket gösterimi elini basacağın alt alandadır.

Evde bohçayı bırakmak, balığı tezgâha koymak, hazır tabağı almak ve masaya bırakmak
yaklaşınca tamamlanır. Bohça yürümeyi kesmez. Dolabı açmak, hazırlamaya başlamak,
yemek yemek ve uyumak bilinçli eylemlerdir. Kapıya ilerlemek sürgüyü açar;
geri çekilmek kapatır, eşiği geçmek dışarı çıkarır.

Pirinç dairesel hareketlerle karıştırılır. Balık aşağı kaydırarak kesilir; pirinci
şekillendirmek için boş alana dokunabilirsin. Nigiriyi tutup ahşap tabağa sürüklersin.
Yemekte aynı parça tabaktan ele ve ağza gider; karakterler sofrada oturur.

Klavye: ok tuşları / WASD; Shift ile hafif koşu; E veya Enter ile görünen etkileşim.

İlerleme tarayıcıda kaydedilir. İnşa parçaları, çizim taslakları ve tamamlanan çizgiler
yeniden açıldığında korunur. Çizimden **Sonra çizerim** ile çıkılabilir. Test için
**oyun saatine iki kez dokun**: onaydan sonra yolculuk ve çizim taslağı birlikte silinir.

## Çalıştırma ve kontrol

```sh
npm install
npm run dev
npm run build
npx tsc --noEmit
npm test
```

Tarayıcı kontrolleri için önce `npx playwright install chromium ffmpeg`, sonra ayrı
terminalde `npm run build` ve `npm run preview -- --port 4173` çalıştır.

```sh
npm run test:play   # normal gün süresi ve gerçek dokunma girdileriyle beş tam gün
npm run test:ui     # buton/kamera/öğretici, fiziksel hareketler, alternatif seçimler, yarım işi yükleme
npm run test:edges  # yalnız yemek, kaligrafi, kedi, isteğe bağlı hayvan, büyük telefon/yatay ekran, reset
```

`test:play` oyuncu konumunu, saati veya hikâye durumunu atlamaz. Diğer tarayıcı testleri
hataları ayırmak için kayıt kurulumları ve kontrollü zaman adımları kullanır. Ekran
görüntüleri `.local/` içine yazılır. Video için `RECORD_PLAYTHROUGH=1 npm run test:play`;
farklı adres için `PLAYTEST_URL`, sistem Chromium’u için `CHROMIUM_PATH` belirtilebilir.

## Kaynaklar

Her şey canlı SVG olarak çizilir. Köyün çizim dili ve temel sahnesi
[JDhruv14/line-art-animation](https://github.com/JDhruv14/line-art-animation) (MIT)
kütüphanesinden gelir; [LICENSE.line-art-animation](LICENSE.line-art-animation) korunur.

`src/main.ts`: oyun döngüsü/kamera; `src/player.ts`: yolcu ve fiziksel pozlar;
`src/village/home.ts`: ev, taşıma, sofra; `src/story/story.ts`: sahneler ve seçimler;
`journey.ts`: beş günün ön koşulları; `handwork.ts`: sürükleyerek ortak işler;
`paper.ts`: çizim/taslaklar; `notebook.ts`: gerçek çizgilerle günün hatırası;
`save.ts` ve `schedule.ts`: kayıt, zaman ve randevu kuralları.
