# Mürekkep Sokağı · lineartgame

Mürekkeple çizilmiş bir Japon mahallesinde küçük bir mobil oyun. Sokakta yürür,
çizgilerinle kullanılan şeyler yapar, komşularla tanışır ve evini kendine benzetirsin.
Uçurtmanın biçimi, dükkânın işareti, örtünün deseni ve çanın kâğıdı senin çizdiğin gibi
kalır. Seçimlerin mekânın kullanımını, hediyelerini ve sonraki sohbetleri değiştirir.

Oyun: https://furkiti.github.io/lineartgame/ (tek yayın; eski `/playtest/` adresi buraya yönlenir)
Geliştirme: `main` dalı.

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
Başta gün ve Mürekkep Sokağı kartı görünür; ardından alt alanda hareket öğretilir.
Birkaç adım sonra Turna kendiliğinden yanına gelip tanışır ve sol alta döner.
Sonrasında ona dokununca aynı Turna sahnedeki hedefe uçup geri gelir.

Bohça eve girince kendiliğinden askıya süzülür; çıkarken sırta geri gelir ve yürümeyi
kesmez. Balık tezgâhın ortasına gelince elden yavaşça bırakılır. Hazır tabağı almak
ve masaya bırakmak yaklaşınca tamamlanır. Dolabı açmak, hazırlamaya başlamak,
yemek yemek ve uyumak bilinçli eylemlerdir. Kapıya ilerlemek sürgüyü açar;
geri çekilmek kapatır, eşiği geçmek dışarı çıkarır.

Pirinç yavaş dairelerle karıştırılır; küçük ocak alevi ve ince buhar hareket eder.
Basılı tutmak bıçağı yavaşça indirir; aşağı sürüklemek de kesimi ilerletir. Pirinci
şekillendirmek için boş alana basılı tut; bırakınca durur. Büyük yakın planda nigiriyi
boş tabak izlerine sürükle; yan yana veya üçgen düzen seçip **Sofraya hazır** de.
**Ye** / **Birlikte ye** tek seferde bütün öğünü başlatır. En yakın boş mindere
oturursun; aynı tabaktan parçalar sırayla ele ve ağza gider. Son parça misafire uzatılır.
**Uyu** ile futona uzanıp örtünü çekersin. Ayrı yürüme odası yerine açılır uyku nişi vardır.

Çay evinin yanındaki **Pazar** yazılı başka bir ara sokak **Söğüt Pazarı**’na çıkar.
Avluda aşağı doğru gezilir; aynı tezgâhın önünden ve arkasından geçilebilir. Nori ile
basılı tutarak çay doldur, Momo ile dango diz, Sora ile fincanları yerleştir, Rei ile
bir kart çiz. Kartın aynısı evinin duvarında ve defterinde kalır. Çıkış avlunun üstündedir.
Tasarım kararları: [docs/tactile-home-and-market.md](docs/tactile-home-and-market.md).

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
npm run test:market # dokunmayla ara sokak, dört satıcı, derinlik, kayıt ve eve dönüş
npm run test:home   # basılı tutma, kapalı katman, ortak yemek, bohça ve yatak
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
