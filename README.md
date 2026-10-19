# Astronox Portal – portal.astronox.dev

Internes Portal von Astronox Development: Webseite bearbeiten, Kunden verwalten, Anfragen und Aufträge abarbeiten und alle Projekte im Blick behalten. Läuft als eigener Container im selben Portainer-Stack wie die Webseite ([Astronox-Development](https://github.com/mstreicher98/Astronox-Development)) und teilt sich mit ihr die Datenbank.

## Was es kann

| Bereich | Inhalt |
| --- | --- |
| **Cockpit** | Offene Anfragen, Projekte in Arbeit, Umsatz, Stunden, Umsatz der letzten 12 Monate, Pipeline, nächste Termine, fällige Aufgaben, Besuche der Webseite, Hosting-Status |
| **Pipeline** | Anfrage → Erstgespräch → Angebot → Auftrag → In Arbeit → Abnahme → Abgeschlossen (+ Verloren). Kanban mit Drag & Drop (Maus, Touch mit kurzem Halten, Tastatur Alt + Pfeil) und als Liste |
| **Projekte** | Übersicht, Aufgaben mit Meilensteinen und Checklisten, Zeiterfassung (Timer oben rechts oder nachtragen) und „Abrechnen“, Belege, Verlauf mit Notizen und Mails, Dateien, Zugänge (verschlüsselt), Hosting |
| **Kunden** | Firmen und Privatpersonen, Ansprechpersonen, Projekte, Termine, Belege, Verlauf, Dateien, Zugänge, Hosting |
| **Aufgaben, Zeiten, Termine** | projektübergreifend; Termine kommen von der Webseite, Absagen und Abwesenheiten (sperrt Buchungen) direkt hier |
| **Posteingang** | liest office@astronox.dev per IMAP mit, ordnet Mails Kunden zu, Antworten und Weiterleiten aus dem Portal, Anhänge landen bei den Dateien |
| **Angebote & Rechnungen** | PDF im Astronox-Design, fortlaufende Nummern je Jahr, Festschreiben, Versand per Mail, bezahlt, angenommen/abgelehnt, **Kunde nimmt Angebote per Link an oder fragt Änderungen an** (Seite auf der Webseite), Angebot → Rechnung, Storno, Kleinunternehmer oder USt., Export (CSV und ZIP mit PDFs) für die Steuerberatung |
| **Verträge** | Hosting-, Wartungs- und Supportverträge je Kunde mit mehreren Positionen, Mindestlaufzeit und Kündigungsfrist; monatliche Sammelrechnung je Kunde, wahlweise als Entwurf oder automatisch festgeschrieben und per Mail gesendet; Übersicht mit wiederkehrendem Umsatz und den nächsten Rechnungen |
| **Einnahmen & Ausgaben** | Einnahmen-Ausgaben-Rechnung: Ausgaben mit Beleg (Foto oder PDF, am Handy direkt mit der Kamera), bezahlte Rechnungen zählen automatisch als Einnahme, wiederkehrende Ausgaben (Abos, Server, SVS) werden selbst gebucht, Anlagenverzeichnis mit AfA, Jahresübersicht nach E1a-Kennzahl, Export (CSV und ZIP mit allen Belegen) |
| **Hosting & Wartung** | Erreichbarkeit der Kundenseiten (Prüfung alle paar Minuten, Zertifikat), Verträge, Domains mit Ablaufdatum |
| **Webseite** | alle Texte, Leistungen, Ablauf, Referenzen mit Bildern, Pakete & Preise, Über mich mit Foto, Impressum, Datenschutz – als Entwurf mit Live-Vorschau (Handy/Tablet/Desktop), dann veröffentlichen. Besucherstatistik ohne Cookies |
| **Einstellungen** | Briefkopf und Belege, buchbare Zeiten, Auswahl der Projektanfrage, SMTP/IMAP (mit Passwort oder Microsoft 365), E-Mail-Texte (auch die automatischen Mails der Webseite, mit Vorschau), Checklisten, Push aufs Handy, Sicherheit, Sicherungen |

Neue Projektanfragen und Terminbuchungen der Webseite werden alle 15 Sekunden abgeholt: Kunde (per E-Mail-Adresse erkannt oder neu) und Projekt erscheinen in der Pipeline, dazu Glocke und Push aufs Handy.

## Technik

- SvelteKit (Node) + SQLite (libsql/Drizzle), dieselbe Datei wie die Webseite: `/data/astronox.db`. Eigene Tabellen mit eigener Migrationsliste (`__portal_migrations`), die Tabellen der Webseite sind in `src/lib/server/db/site.ts` gespiegelt
- PDFs mit pdfkit und der Schrift Instrument Sans, Bilder mit sharp (WebP), Mails mit nodemailer und imapflow, Push mit web-push (VAPID-Schlüssel erzeugt das Portal selbst)
- Gestaltung wie astronox.dev: Nachthimmel, Polarlicht → Nebel → Pulsar, Anybody / Instrument Sans / Martian Mono. Animierter Sternenhimmel (ca. 30 fps, pausiert im Hintergrund), weiche Seitenwechsel (View Transitions), Lichtränder an Karten, zählende Kennzahlen, federnde Drag & Drop-Karten. Bei „weniger Bewegung“ am Gerät steht alles still
- Leicht: alle Seiten zusammen rund 170 KB JavaScript (Brotli), jede Seite lädt nur ihren Teil. Als App installierbar (PWA), Service Worker hält die Programmdateien vor

## Lokal starten

```bash
npm install
cp .env.example .env   # DATA_DIR zeigt auf die Datenbank der Webseite
npm run dev            # http://localhost:5210
npm run check
npm test
```

Die Webseite muss lokal einmal gelaufen sein (sie legt ihre Tabellen an). Beim ersten Start steht der **Einrichtungscode** in der Konsole – dann `http://localhost:5210/einrichten` öffnen.

## Sicherheit

- Ein Konto, Anmeldung mit Passwort (mind. 12 Zeichen, scrypt) **und** Code aus einer Authenticator-App (Pflicht). Zehn Notfallcodes beim Einrichten
- Sitzungen 30 Tage, im Cookie nur ein Zufallswert; Bremse gegen Durchprobieren (IP und Konto)
- Zugangsdaten, SMTP/IMAP-Passwörter, der Schlüssel der Microsoft-365-App und der 2FA-Schlüssel liegen AES-256-GCM-verschlüsselt in der Datenbank. Schlüssel: `/data/.schluessel` (oder `APP_SECRET`)
- Strenge Content-Security-Policy, HTML-Mails nur in einer Sandbox ohne nachgeladene Bilder, hochgeladene Dateien werden nie als Seite ausgeführt
- Das Repository ist öffentlich – es enthält keine Zugangsdaten. Alles Geheime steht in Portainer oder verschlüsselt in der Datenbank

### Notfall-Zugang

Im Container (Portainer → Containers → `…-portal-1` → Console → `/bin/sh`):

```bash
node scripts/zugang.mjs status         # Konten anzeigen
node scripts/zugang.mjs passwort       # neues Zufallspasswort setzen und anzeigen
node scripts/zugang.mjs 2fa            # Zwei-Faktor zurücksetzen (Handy verloren)
node scripts/zugang.mjs abmelden       # alle Geräte abmelden
```

## Betrieb

Das Portal läuft im Stack der Webseite – siehe `portainer-stack.yml` und README im Repo **Astronox-Development** (Dienst `portal`, Tunnel-Route `portal.astronox.dev → http://portal:3000`).

Umgebungsvariablen des Dienstes `portal`:

| Variable | Standard | Bedeutung |
| --- | --- | --- |
| `ORIGIN` | – | Adresse des Portals, z. B. `https://portal.astronox.dev` (Pflicht hinter dem Tunnel) |
| `PORTAL_URL` | wie `ORIGIN` | für Hinweise im Protokoll |
| `WEBSITE_URL` | `https://astronox.dev` | für die Vorschau, das Kalender-Abo und Links |
| `ADDRESS_HEADER` | – | `CF-Connecting-IP`, damit die Bremse die echte IP sieht |
| `APP_SECRET` | – | optional statt `/data/.schluessel`, dann in Webseite und Portal gleich |
| `PORTAL_JOBS` | – | `aus` schaltet die Hintergrunddienste ab (nur für Tests) |

Jeder Push auf `main` baut `ghcr.io/mstreicher98/astronox-portal:latest`. Das Paket ist öffentlich, Portainer braucht dafür keinen Registry-Zugang. Sollte GitHub es privat anlegen: github.com/mstreicher98?tab=packages → `astronox-portal` → Package settings → „Change visibility“ → public.

### Hintergrunddienste

| Wann | Was |
| --- | --- |
| alle 15 s | neue Anfragen, Buchungen und Absagen von der Webseite |
| alle 30 s | fällige Erreichbarkeits-Prüfungen (Alarm nach zwei Fehlversuchen) |
| alle 2 min | Posteingang (wenn eingerichtet) |
| täglich ab 3 Uhr | Sicherung, Vertragsrechnungen, wiederkehrende Ausgaben, überfällige Rechnungen, Domain-/Zertifikatsfristen, Aufräumen |

### Push aufs Handy

Einstellungen → Benachrichtigungen → „Auf diesem Gerät einschalten“. Am iPhone funktioniert Push nur, wenn das Portal über Safari → Teilen → „Zum Home-Bildschirm“ installiert wurde.

## Rechnungen – gut zu wissen

- Nummern wie `RE26 0001` / `AN26 0001` (Format unter Einstellungen: `{JJ}`, `{JJJJ}`, `{NR}`), jedes Jahr ab 1
- **Bearbeiten:** macht einen festgeschriebenen Beleg wieder zum Entwurf, die Nummer bleibt. War er schon verschickt, wird die alte Fassung als `…_fassung_<Datum>_<Uhrzeit>.pdf` archiviert. Stornierte Rechnungen und Stornorechnungen bleiben unverändert
- **Löschen:** Angebote immer. Rechnungen nur, solange sie nie verschickt und nicht bezahlt wurden – sonst „Stornieren“ (Stornorechnung mit eigener Nummer). War es die letzte Nummer und nie verschickt, wird sie wieder vergeben, sonst bleibt eine Lücke (im Verlauf vermerkt)
- Pflichtangaben nach § 11 UStG stehen auf jeder Rechnung; Briefkopf (Anschrift, Bank) vor der ersten Rechnung unter Einstellungen eintragen
- Als Kleinunternehmer erscheint der Hinweis nach § 6 Abs. 1 Z 27 UStG; Umstellung auf Regelbesteuerung gilt für neue Belege
- Aufbewahrung: PDFs liegen unter `/data/portal/belege` und sind Teil der Sicherung

## Einnahmen & Ausgaben (EAR)

- **Zufluss-Abfluss-Prinzip:** Es zählt der Tag der Zahlung. Bezahlte Rechnungen aus „Angebote & Rechnungen“ erscheinen automatisch mit dem Bezahlt-Datum; eine Stornorechnung zählt nur, wenn die stornierte Rechnung schon bezahlt war (Rückzahlung).
- **Ausgaben** mit Kategorie (jede gehört zu einer Kennzahl der Beilage E1a), USt-Satz laut Beleg, Zahlungsart und Beleg. Als Kleinunternehmer zählt der Bruttobetrag; mit Regelbesteuerung (Einstellungen → Firma & Rechnungen) netto, die Vorsteuer wird getrennt ausgewiesen – gespeichert wird der Stand beim Buchen.
- **Kilometergeld:** Bei „Reise- & Fahrtkosten“ km eingeben, der Betrag wird mit dem amtlichen Satz (0,50 €/km) gerechnet.
- **Wiederkehrend:** monatlich, quartalsweise, halbjährlich oder jährlich – der tägliche Lauf bucht fällige Termine (auch rückwirkend) und meldet es in der Glocke. Den Beleg lädst du bei der Buchung hoch; „Ohne Beleg“ zeigt, was fehlt.
- **Anlagen:** Anschaffungen über 1.000 € (netto) werden linear über die Nutzungsdauer abgeschrieben, mit Halbjahresregel (Inbetriebnahme ab Juli → im ersten Jahr die halbe AfA). Scheidet eine Anlage aus, wird der Restbuchwert abgesetzt. Bis 1.000 € als „Geringwertige Wirtschaftsgüter“ buchen.
- **Export:** CSV mit allen Buchungen, Übersicht nach Kennzahl, oder ZIP mit beiden Tabellen, allen Belegen und den Rechnungs-PDFs. Die Kennzahlen entsprechen der Beilage E 1a 2025 (src/lib/shared/ear.ts) – das BMF nummeriert gelegentlich um, daher jedes Jahr mit dem aktuellen Formular abgleichen.
- Belege liegen unter `/data/portal/ausgaben` und sind Teil der Sicherung. Aufbewahrungspflicht: 7 Jahre.

## Verträge und Monatsrechnungen

- **Im Voraus am Monatsersten:** Der tägliche Lauf (ab 3 Uhr) rechnet jeden Zeitraum ab, der bis heute begonnen hat. Beginnt ein Vertrag mitten im Monat, kommt sofort eine anteilige Rechnung bis Monatsende („anteilig für 22 von 31 Tagen“), danach jeweils am Ersten. Endet ein Vertrag mitten im Zeitraum, wird der letzte Zeitraum anteilig berechnet. Auf der Seite „Verträge“ startet „Fällige abrechnen“ den Lauf sofort.
- **Sammelrechnung:** Alle fälligen Verträge eines Kunden landen auf einer Rechnung, jede Position mit ihrem Zeitraum.
- **Entwurf oder automatisch:** Pro Vertrag wählbar. Automatisch heißt: festschreiben, PDF ablegen und mit der Vorlage „Rechnung zu einem Vertrag“ (Einstellungen → E-Mail-Texte) an den Kunden mailen. Das passiert nur, wenn *alle* Verträge auf der Rechnung auf „Automatisch senden“ stehen und Kundenanschrift, Kunden-E-Mail, SMTP und dein Briefkopf vorhanden sind – sonst bleibt es ein Entwurf und du bekommst eine Benachrichtigung mit dem Grund. Scheitert der Versand, ist die Rechnung festgeschrieben und du wirst gebeten, sie selbst zu senden.
- **Kündigung:** „Kündigung erfassen“ setzt das Ende auf den frühestmöglichen Termin (Frist in Monaten zum Monatsende, frühestens nach der Mindestlaufzeit). Nach dem Ende wird der Vertrag automatisch stillgelegt.
- Jeder abgerechnete Zeitraum steht im Verlauf des Vertrags (Tabelle `contract_billings`) und wird nie doppelt abgerechnet. Wird ein Entwurf gelöscht, wird dieser Zeitraum nicht neu erzeugt – dann die Rechnung über „Angebote & Rechnungen“ neu anlegen oder „Nächste Rechnung ab“ im Vertrag zurücksetzen.
