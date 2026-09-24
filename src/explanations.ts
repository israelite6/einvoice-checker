// Plain-language titles for the rules that fail most often. The official rule text and ID are
// always shown as well; these titles only help non-experts understand what to fix.
import type { Lang } from './i18n';

type Text = Record<Lang, string>;

export const EXPLANATIONS: Record<string, Text> = {
  'BR-01': { de: 'Die Angabe zur Spezifikation (CustomizationID) fehlt.', en: 'The specification identifier (CustomizationID) is missing.' },
  'BR-02': { de: 'Die Rechnungsnummer fehlt.', en: 'The invoice number is missing.' },
  'BR-03': { de: 'Das Rechnungsdatum fehlt.', en: 'The invoice date is missing.' },
  'BR-04': { de: 'Der Rechnungstyp (z. B. 380 = Rechnung) fehlt.', en: 'The invoice type code (e.g. 380 = invoice) is missing.' },
  'BR-05': { de: 'Die Rechnungswährung fehlt.', en: 'The invoice currency is missing.' },
  'BR-06': { de: 'Der Name des Verkäufers fehlt.', en: "The seller's name is missing." },
  'BR-07': { de: 'Der Name des Käufers fehlt.', en: "The buyer's name is missing." },
  'BR-08': { de: 'Die Anschrift des Verkäufers fehlt.', en: "The seller's address is missing." },
  'BR-10': { de: 'Die Anschrift des Käufers fehlt.', en: "The buyer's address is missing." },
  'BR-16': { de: 'Die Rechnung enthält keine Rechnungsposition.', en: 'The invoice has no invoice line.' },
  'BR-CL-04': { de: 'Der Währungscode ist ungültig (erwartet z. B. EUR).', en: 'The currency code is not valid (expected e.g. EUR).' },
  'BR-CO-10': { de: 'Die Summe der Positionsbeträge stimmt nicht.', en: 'The sum of the line amounts is wrong.' },
  'BR-CO-13': { de: 'Der Gesamtbetrag ohne Umsatzsteuer ist falsch berechnet.', en: 'The total without VAT is calculated incorrectly.' },
  'BR-CO-14': { de: 'Der Umsatzsteuer-Gesamtbetrag passt nicht zur Summe der Steuerbeträge.', en: 'The VAT total does not match the sum of the VAT amounts.' },
  'BR-CO-15': { de: 'Der Gesamtbetrag mit Umsatzsteuer ist falsch berechnet.', en: 'The total including VAT is calculated incorrectly.' },
  'BR-CO-16': { de: 'Der fällige Betrag passt nicht zu Gesamtbetrag, Anzahlungen und Rundung.', en: 'The amount due does not match the total, prepayments and rounding.' },
  'BR-DE-1': { de: 'Zahlungsinformationen (z. B. Überweisung mit IBAN) fehlen.', en: 'Payment instructions (e.g. credit transfer with IBAN) are missing.' },
  'BR-DE-2': { de: 'Kontaktangaben des Verkäufers fehlen.', en: "The seller's contact details are missing." },
  'BR-DE-5': { de: 'Der Name des Ansprechpartners beim Verkäufer fehlt.', en: "The seller's contact person is missing." },
  'BR-DE-6': { de: 'Die Telefonnummer des Verkäufers fehlt.', en: "The seller's phone number is missing." },
  'BR-DE-7': { de: 'Die E-Mail-Adresse des Verkäufers fehlt.', en: "The seller's e-mail address is missing." },
  'BR-DE-15': { de: 'Die Käuferreferenz (bei Behörden die Leitweg-ID) fehlt.', en: 'The buyer reference (Leitweg-ID for public authorities) is missing.' },
  'BR-DE-21': { de: 'Die Spezifikationskennung passt nicht zu XRechnung 3.0.', en: 'The specification identifier does not match XRechnung 3.0.' },
  'BR-DE-TMP-32': { de: 'Empfehlung: Liefer- oder Leistungsdatum bzw. Leistungszeitraum angeben.', en: 'Recommendation: state the delivery date or the invoicing period.' },
  'PDF-XML-NR': { de: 'Die Rechnungsnummer aus der XML steht nicht im PDF-Bild. Maßgeblich ist die XML.', en: 'The invoice number from the XML does not appear in the PDF picture. The XML is authoritative.' },
  'PDF-XML-DATE': { de: 'Das Rechnungsdatum aus der XML steht nicht im PDF-Bild. Maßgeblich ist die XML.', en: 'The invoice date from the XML does not appear in the PDF picture. The XML is authoritative.' },
  'PDF-XML-TOTAL': { de: 'Der Gesamtbetrag aus der XML steht nicht im PDF-Bild. Maßgeblich ist die XML.', en: 'The total from the XML does not appear in the PDF picture. The XML is authoritative.' },
  'PDF-XML-DUE': { de: 'Der fällige Betrag aus der XML steht nicht im PDF-Bild. Maßgeblich ist die XML.', en: 'The amount due from the XML does not appear in the PDF picture. The XML is authoritative.' },
  'PDF-XML-IBAN': { de: 'Die IBAN aus der XML steht nicht im PDF-Bild. Bitte vor dem Bezahlen prüfen – maßgeblich ist die XML.', en: 'The IBAN from the XML does not appear in the PDF picture. Please check before paying – the XML is authoritative.' },
  'PDF-XML-NOTEXT': { de: 'Das PDF enthält keinen lesbaren Text (z. B. ein Scan); ein Bild-Vergleich war nicht möglich.', en: 'The PDF has no readable text (e.g. a scan); the picture could not be compared.' },
  'XSD': { de: 'Aufbau der Datei entspricht nicht dem Schema.', en: 'The file structure does not match the schema.' },
};

export function plainTitle(code: string, lang: Lang): string | null {
  return EXPLANATIONS[code]?.[lang] ?? null;
}
