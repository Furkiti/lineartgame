# Dokunma, ev ve Söğüt Pazarı

Açılış: iki kısa satır, üstte gün ve altta Mürekkep Sokağı. Kart kalkınca doğrudan alt alanda hareket gösterimi. İlk birkaç adımından sonra aynı Turna sol alttan yanına uçar, nerede bulunacağını söyler, geri döner. Öğretici metni bir defada görünür, daha büyük ve koyudur; konuşma balonlarından ayrılır.

Mutfak: saydam yakın plan kalıntısı kapalı durumda hiçbir karede çizilmez. Balık yalnız tezgâh merkezinde algılanır; aynı balık elden tezgâh merkezine yavaşça bırakılır. Buhar, ateş ve kesme etkileri ince çizgiler ve kısa yerel tepkilerdir. Ekranı dolduran patlamalar kullanılmaz. Basılı tutmak bıçağı malzemenin içine yavaşça indirir; hareketle de yönlendirilebilir. Pirinç sıkıştırma, parmağın basılı olduğu kadar ilerler; bırakınca durur.

Dizme: portrede malzeme üstte, tabak hemen altta; uzak kameraya gerek kalmaz. Yan yana ve küçük üçgen iki geçerli düzen. En yakın boş iz parçayı yumuşakça tutar; süre/puan yoktur. Üç parçadan sonra tasarım tamamlanabilir; düzen taşınan ve yenilen tabakta da korunur. İlham: Unpacking'in kendi hızında yerleştirmesi ve A Little to the Left'in birden çok geçerli düzeni.

Sofra: tek başlatma. Oyuncu en yakın boş mindere geçer; yemek ortak tabaktan gerçekten azalır. Misafir varsa sırayla yenir, son parça elde uzatılarak ikram edilir. İşaretler ve kâğıtlar mobilya yüzeyinde, insanların arkasındadır. Yatakta oturma → yana uzanma → örtünün çekilmesi → gece geçişi görülür. Bohça eve girince askıya, çıkarken tekrar sırta hafif bir yay çizerek gider; kapı hareketiyle birlikte çalışır.

Ev: yol uzatacak ikinci bir oda yerine mevcut uyku bölümünü açılır shoji nişi olarak ayırmak daha uygun. Pencere havası, lamba salınımı, birkaç toz zerresi, küçük yaprak hareketleri ve minderin esnemesi evin sakin biçimde yaşamasını sağlar.

Yeni yer: çay evinin yanındaki başka bir ara sokak Söğüt Pazarı'na çıkar. Önden çizilen arka cephe korunur. Avlu aşağıya doğru iki ekran kadar yürünebilir; figür ölçeği sabit, paralel zemin çizgileri kullanılır. Çaycı, dango arabası, kâğıtçı ve seramikçinin tezgâhları farklı y seviyelerinde durur. Arkalarından geçerken tezgâh figürü örter; önlerine geçince figür tezgâhı örter. Yatay ve dikey geçişleri açık koridorlar bağlar. Çay doldurma, dango dizme ve kart çizme gibi küçük işler bulunur; hediye/çizimler eve ve deftere taşınır.

## Yerleştirme referansları

- [Unpacking](https://www.unpackinggame.com/): süre ve puan baskısı olmadan nesneleri yerleştirme. Burada tabak düzeni için geri sayım yok.
- [A Little to the Left / Max Inferno](https://www.maxinferno.com/press): bazı düzenlemelerin birden çok geçerli çözümü var. Burada yan yana ve üçgen düzenin ikisi de tamamlanmış tabak sayılır.

Çizgi hissi için efektler canlı SVG ile çizilir: buharın eğrileri, küçük ocak alevleri, kademeli kesik izi, kısa bıçak parlaması, birkaç malzeme zerresi ve yerel ses. Harici video ya da ağır tam ekran shader gerekmez. Kesme ilerlemesi basılı tutma süresi ve aşağı sürüklemeyle ölçülür; farklı telefonların basınç sensörlerine bağımlı değildir.

## Doğrulama

- 10 temel test: boş minder seçimi, ortak parça sahipliği, tabakta taşmama/çifte yerleştirme, çizimleri bozmadan sığdırma, kayıt/sıfırlama ve beş günün ön koşulları.
- Normal oyun saati ve gerçek dokunma girdileriyle beş günün tamamı: ilk uçurtma → ortak yemek → çay tabelası → yağmur köşesi → çan → beşinci gün buluşması → beş ayrı defter sayfası.
- Ev: basılı tutma/bırakma, mutfağa geri dönme ve yeniden yükleme, merkeze balık bırakma, tek komutla ortak tabak ve son ikram, geri çevrilebilen bohça hareketi, futona uzanma ve örtü.
- Pazar: gerçek ara sokak girişi, dört satıcı, basılı çay doldurma, çizimin yeniden yüklenmesi, aynı tezgâhın iki tarafında doğru örtüşme ve eve dönüş.
- Alternatif seçimler, yalnız yemek, kaligrafi, kedi, isteğe bağlı gece keşfi, büyük telefon/yatay görünüm ve saatten sıfırlama.
- Ek görsel kontrol: tabak düzenlerken telefonu çevirme, üçgen düzeni taşımaya devam etme, tabağın yüzün altında kalması ve ilk yürüyüşte kaldırım sınırına dayanmanın öğreticiyi kilitlememesi.

Tarayıcı doğrulamaları Chromium/Playwright ile yapılır; fiziksel iPhone testi değildir.
