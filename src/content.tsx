// Long-form page content (FAQ, legal pages) in German and English.
import type { ReactNode } from 'react';
import type { Lang } from './i18n';

export const OWNER = { name: 'Israel Ebenezer', email: 'israel.hmis@gmail.com' };

export const FAQ: Record<Lang, { q: string; a: ReactNode }[]> = {
  de: [
    { q: 'Wird meine Rechnung hochgeladen?', a: 'Nein. Die Datei wird ausschließlich in Ihrem Browser gelesen, geprüft und dargestellt. Es gibt keinen Server, der Rechnungen empfängt. Nach der ersten Prüfung funktioniert das Tool auch ohne Internetverbindung.' },
    { q: 'Welche Regeln werden geprüft?', a: 'Das XML-Schema, die Geschäftsregeln der europäischen Norm EN 16931 und die nationalen XRechnung-Regeln – mit den offiziell veröffentlichten Prüfregeln (KoSIT-Prüfkonfiguration). Unsere Ergebnisse stimmen in Tests mit dem offiziellen Prüfprogramm überein.' },
    { q: 'Was ist der Unterschied zwischen XRechnung und ZUGFeRD?', a: 'XRechnung ist eine reine XML-Datei (Syntax UBL oder CII). ZUGFeRD ist ein PDF mit eingebetteter XML-Datei. Bei hybriden Rechnungen ist laut Bundesfinanzministerium der XML-Teil maßgeblich. Wir prüfen den XML-Teil von ZUGFeRD/Factur-X-PDFs (Profile EN 16931 und XRECHNUNG) und vergleichen wichtige Werte mit dem sichtbaren PDF-Bild. Dieser Bild-Vergleich prüft nur, ob ein Wert irgendwo im sichtbaren PDF vorkommt – er ist ein Hilfsvergleich, keine offizielle Regel. Die PDF/A-Konformität der Datei prüfen wir nicht.' },
    { q: 'Ist „gültig“ eine rechtliche Bestätigung?', a: 'Nein. Wir prüfen technisch gegen die veröffentlichten Regeln. Ob eine Rechnung steuerlich korrekt ist, hängt vom Einzelfall ab – dafür ist eine Steuerberatung zuständig.' },
    { q: 'Was kostet das?', a: 'Nichts. Keine Anmeldung, kein Konto, keine Begrenzung für einzelne Prüfungen.' },
  ],
  en: [
    { q: 'Is my invoice uploaded?', a: 'No. The file is read, checked and displayed only in your browser. There is no server that receives invoices. After your first check the tool also works without an internet connection.' },
    { q: 'Which rules are checked?', a: 'The XML schema, the business rules of the European standard EN 16931 and the German XRechnung rules – using the officially published validation rules (KoSIT configuration). In tests our results match the official validator.' },
    { q: 'What is the difference between XRechnung and ZUGFeRD?', a: 'XRechnung is a pure XML file (UBL or CII syntax). ZUGFeRD is a PDF with an embedded XML file. For hybrid invoices the German Federal Ministry of Finance says the XML part is authoritative. We check the XML part of ZUGFeRD/Factur-X PDFs (EN 16931 and XRECHNUNG profiles) and compare key values with the visible PDF picture. The picture comparison only checks whether a value appears somewhere in the visible PDF – it is a helpful comparison, not an official rule. We do not check the PDF/A conformance of the file.' },
    { q: 'Does "valid" mean legally compliant?', a: 'No. We check technically against the published rules. Whether an invoice is correct for tax purposes depends on the case – please ask a tax adviser.' },
    { q: 'What does it cost?', a: 'Nothing. No sign-up, no account, no limit on individual checks.' },
  ],
};

const mail = <a className="underline decoration-slate-300 underline-offset-4 hover:decoration-brand-500" href={`mailto:${OWNER.email}`}>{OWNER.email}</a>;

export const IMPRESSUM: Record<Lang, ReactNode> = {
  de: (
    <>
      <h1>Impressum</h1>
      <h2>Anbieter</h2>
      <p>{OWNER.name}</p>
      <h2>Kontakt</h2>
      <p>E-Mail: {mail}</p>
      <h2>Hinweis</h2>
      <p>Dieses Angebot ist ein unabhängiges, kostenloses Werkzeug. Es ist nicht mit der KoSIT, dem FeRD, dem CEN oder der Finanzverwaltung verbunden. Die Prüfung ist eine technische Prüfung gegen veröffentlichte Regeln und keine Steuer- oder Rechtsberatung.</p>
    </>
  ),
  en: (
    <>
      <h1>Legal notice</h1>
      <h2>Provider</h2>
      <p>{OWNER.name}</p>
      <h2>Contact</h2>
      <p>E-mail: {mail}</p>
      <h2>Note</h2>
      <p>This is an independent, free tool. It is not affiliated with KoSIT, FeRD, CEN or the tax administration. The check is a technical check against published rules and not tax or legal advice.</p>
    </>
  ),
};

export const PRIVACY: Record<Lang, ReactNode> = {
  de: (
    <>
      <h1>Datenschutzerklärung</h1>
      <h2>Verantwortlicher</h2>
      <p>{OWNER.name}, E-Mail: {mail}</p>
      <h2>Ihre Rechnungsdateien</h2>
      <p>Rechnungen, die Sie auswählen, werden ausschließlich lokal in Ihrem Browser verarbeitet. Sie werden nicht an uns oder Dritte übertragen und nicht gespeichert.</p>
      <h2>Hosting</h2>
      <p>Die Website wird über Cloudflare Pages (Cloudflare, Inc., USA, als Auftragsverarbeiter) ausgeliefert. Dabei verarbeitet Cloudflare technisch notwendige Verbindungsdaten wie die IP-Adresse, um die Seite auszuliefern und vor Missbrauch zu schützen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren Betrieb). Cloudflare ist nach dem EU-U.S. Data Privacy Framework zertifiziert.</p>
      <h2>Anonyme Nutzungsstatistik ohne Cookies</h2>
      <p>Um zu verstehen, ob das Werkzeug genutzt wird, sendet die Seite anonyme Ereignisse an unseren Server bei Cloudflare: Seitenaufruf (mit grober Herkunftskategorie wie „Suchmaschine“ oder „direkt“), abgeschlossene Prüfung (Ergebnisart, Dateiformat, Kennungen verletzter Regeln, Dauer, ob eine Beispieldatei genutzt wurde), PDF-Auswahl, Mehrfachprüfung und Klick auf „interessiert mich“. Cloudflare ermittelt dabei aus der IP-Adresse das Land und die Netzbetreiber-Nummer (ASN); aus dem Browsertyp wird markiert, ob es sich wahrscheinlich um einen Bot handelt. Die IP-Adresse selbst wird von uns nicht gespeichert. Es werden keine Cookies gesetzt, keine Geräte-Kennungen gespeichert und keine Rechnungsinhalte, Dateinamen, Beträge oder Personendaten übermittelt.</p>
      <p>Speicherung: in Cloudflare Workers Analytics Engine (Cloudflare, Inc. als Auftragsverarbeiter), dort drei Monate. Für die Auswertung unseres Tests bewahren wir nur zusammengefasste Wochenzahlen ohne Personenbezug auf. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (Verbesserung und Bewertung des Angebots).</p>
      <h2>Kontakt per E-Mail</h2>
      <p>Wenn Sie uns schreiben (z. B. um ein falsches Prüfergebnis zu melden), verarbeiten wir Ihre E-Mail-Adresse und Nachricht nur, um zu antworten und den Fehler zu beheben. Wir löschen die Korrespondenz 12 Monate nach Abschluss, sofern keine Aufbewahrungspflicht besteht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Bitte senden Sie keine Rechnungen mit personenbezogenen Daten, ohne diese vorher zu schwärzen.</p>
      <h2>Server-Protokolle</h2>
      <p>Wir selbst werten keine Server-Protokolle aus und speichern keine IP-Adressen.</p>
      <h2>Lokale Einstellungen</h2>
      <p>Wenn Sie Sprache oder Farbschema ändern, wird diese Auswahl auf Ihrem Gerät gespeichert, damit sie beim nächsten Besuch erhalten bleibt. Diese Speicherung ist für die von Ihnen gewünschte Funktion erforderlich und wird nicht an uns übertragen.</p>
      <h2>Ihre Rechte</h2>
      <p>Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) sowie das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren. <strong>Widerspruchsrecht (Art. 21 DSGVO):</strong> Sie können der Verarbeitung auf Grundlage berechtigter Interessen jederzeit widersprechen; die anonyme Statistik können Sie unten jederzeit abschalten. Wir respektieren außerdem die Browser-Signale „Global Privacy Control“ und „Do Not Track“ und senden dann keine Statistik. Kontakt: {mail}</p>
    </>
  ),
  en: (
    <>
      <h1>Privacy policy</h1>
      <h2>Controller</h2>
      <p>{OWNER.name}, e-mail: {mail}</p>
      <h2>Your invoice files</h2>
      <p>Invoices you select are processed only locally in your browser. They are not transmitted to us or third parties and are not stored.</p>
      <h2>Hosting</h2>
      <p>The website is delivered via Cloudflare Pages (Cloudflare, Inc., USA, as processor). Cloudflare processes technically necessary connection data such as the IP address to deliver the site and protect it against abuse. Legal basis: Art. 6(1)(f) GDPR (legitimate interest in secure operation). Cloudflare is certified under the EU-U.S. Data Privacy Framework.</p>
      <h2>Anonymous usage statistics without cookies</h2>
      <p>To understand whether the tool is used, the page sends anonymous events to our server at Cloudflare: page view (with a coarse origin category such as "search engine" or "direct"), completed check (result type, file format, IDs of failed rules, duration, whether a sample file was used), PDF selection, multiple checks and a click on "I am interested". Cloudflare derives the country and the network operator number (ASN) from the IP address; the browser type is used to flag likely bots. We do not store the IP address itself. No cookies are set, no device identifiers are stored, and no invoice content, file names, amounts or personal data are transmitted.</p>
      <p>Storage: Cloudflare Workers Analytics Engine (Cloudflare, Inc. as processor), for three months. For evaluating our test we keep only aggregated weekly figures without personal data. Legal basis: Art. 6(1)(f) GDPR (improving and evaluating the service).</p>
      <h2>Contact by e-mail</h2>
      <p>If you write to us (for example to report a wrong result), we process your e-mail address and message only to reply and fix the problem. We delete the correspondence 12 months after it ends unless we are legally required to keep it. Legal basis: Art. 6(1)(f) GDPR. Please do not send invoices containing personal data without redacting them first.</p>
      <h2>Server logs</h2>
      <p>We do not analyse server logs and do not store IP addresses.</p>
      <h2>Local settings</h2>
      <p>If you change the language or colour theme, the choice is stored on your device so it is kept on your next visit. This storage is required for the function you requested and is not transmitted to us.</p>
      <h2>Your rights</h2>
      <p>You have the right to access, rectification, erasure, restriction, data portability and objection (Art. 15–21 GDPR) and the right to lodge a complaint with a data protection supervisory authority. <strong>Right to object (Art. 21 GDPR):</strong> you can object at any time to processing based on legitimate interests; you can switch the anonymous statistics off below at any time. We also respect the browser signals Global Privacy Control and Do Not Track and send no statistics when they are set. Contact: {mail}</p>
    </>
  ),
};
