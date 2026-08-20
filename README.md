# ViperLensAI : Hibrid Zərərverici Proqram (Malware) Analiz Platformasi

ViperLensAI statik bayt-kod evristikasi, dinamik sandbox davranis analizi ve Google Gemini 1.5 Flash muhakime modelini birlesdiren hibrid tehlukesizlik analiz laboratoriyasidir. Sistem SOC (Security Operations Center) analitikleri ucun hem suretli texniki diaqnostika, hem de strukturlaşdırılmış hadisə hesabatı teqdim edir.

## Esas Imkanlar

* Statik Analiz Muherriki: Shannon entropiya profili, IAT (Import Address Table) risk tesnifati, PE bolme (section) analizi, regex IOC skanlamasi ve normallasdirilmis tehluke bali.
* Dinamik Davranis Analizi: Hybrid Analysis (Falcon Sandbox) inteqrasiyasi ile faylin icra zamani proses, sebeke ve fayl sistemi tesirlerinin izlenmesi.
* Suni Intellekt Muhakimesi: Gemini 1.5 Flash vasitesile statik ve dinamik gostericilerin sintezi, tehlukeniz esaslandirilmasi ve tovsiyeler.
* SOC Istifadeci Paneli: Express ve EJS esasli qaranliq interfeys, sessiya autentifikasiyasi, skan tarixcesi ve profil idareetmesi.
* Avtomatlasdirilmis Hesabat: Texniki ve idareetme heyeti ucun strukturlaşdırılmış PDF hadise hesabatlarinin yaradilmasi.

## Texnoloji Arxitektura

* Backend: Node.js, Express.js
* Verilenler Bazasi: SQLite, Sequelize ORM
* Statik Analiz Modulu: Python 3, `pefile`, `numpy`, `matplotlib`
* Dinamik Analiz: Hybrid Analysis API (Falcon Sandbox)
* AI Muhakime: Google Generative AI SDK (Gemini 1.5 Flash)
* Frontend: EJS sablonlari, Tailwind CSS, Chart.js

## Sistem Analiz Pipeline

1. Statik Evristika Layi:
   Yuklenen PE fayli lokal olaraq analiz edilir: bolmeler uzre entropiya anomaliyalari, subheli API cagirislar (proses inyeksiyasi, yaddas manipuliyasiyasi) ve bayt struktur gostericileri hesablanir.

2. Dinamik Sandbox Layi:
   Numune Hybrid Analysis mühitinə gonderilir: sebeke elaqeleri, yaranan prosesler, qeydiyyat defteri deyisiklikleri ve MITRE ATT&CK uygunluqlari cixarilir.

3. AI Sintez ve Qerar Layi:
   Gemini 1.5 Flash modeli statik ve dinamik faktlari birlesdirerek analitik ucun aydin hadise hesabatini ve prioritetlesdirilmis cavab tedbirlerini formalasdirir.

## Qurasdirma

### 1: Node.js Asililiqlarini Qurasdirmaq
```bash
npm install
```

### 2: Python Asililiqlarini Qurasdirmaq
```bash
pip install -r requirements.txt
```

### 3: Ehtiyat ve Konfiqurasiya
`.env.example` faylini `.env` olaraq kopyalayib lazimi acarlari teyin edin:

```bash
cp .env.example .env
```

Esas `.env` deyisenleri:
* `SESSION_SECRET`: Sessiya tehlukesizlik acari
* `GEMINI_API_KEY`: Google Generative AI API acari
* `HYBRID_ANALYSIS_API_KEY`: Hybrid Analysis API acari

### 4: Platformani Baslatmaq
```bash
npm start
```

Server standart olaraq `http://localhost:3000` unvaninda ise dusur.

## Tehlukesizlik Qeydleri

* Sifreler Bcrypt alqoritmi ile heshlenerek saxlanilir.
* Istifadeci skan tarixcesi tehlukesiz sekilde izolasiya edilir.
* API yuklerinin optimal saxlanmasi ucun sandbox cixislari normallasdirilir.
