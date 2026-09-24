"""Generate negative test files from the official XRechnung test suite by breaking one thing per copy."""
import os, re, sys
src = [l.strip() for l in open('testfiles.txt') if l.strip()]
out = 'mutants'; os.makedirs(out, exist_ok=True)

def sub1(pattern, repl, s):
    n = re.sub(pattern, repl, s, count=1, flags=re.S)
    return n if n != s else None

MUT = {
  # BT-1 invoice number removed
  'no-invoice-number': [r'(<cbc:CustomizationID>.*?</cbc:CustomizationID>.*?)<cbc:ID>[^<]*</cbc:ID>', r'\1',
                        r'(<rsm:ExchangedDocument>\s*)<ram:ID>[^<]*</ram:ID>', r'\1'],
  # BT-115 amount due changed so totals no longer add up
  'wrong-payable-amount': [r'(<cbc:PayableAmount[^>]*>)([0-9.]+)', lambda m: m.group(1) + str(round(float(m.group(2)) + 1.11, 2)),
                           r'(<ram:DuePayableAmount[^>]*>)([0-9.]+)', lambda m: m.group(1) + str(round(float(m.group(2)) + 1.11, 2))],
  # BT-5 invalid currency code
  'bad-currency': [r'(<cbc:DocumentCurrencyCode[^>]*>)[^<]*', r'\1ZZZ',
                   r'(<ram:InvoiceCurrencyCode>)[^<]*', r'\1ZZZ'],
  # BT-10 buyer reference removed (XRechnung requirement)
  'no-buyer-reference': [r'<cbc:BuyerReference>[^<]*</cbc:BuyerReference>', '',
                         r'<ram:BuyerReference>[^<]*</ram:BuyerReference>', ''],
  # BT-27 seller name emptied
  'empty-seller-name': [r'(<cac:AccountingSupplierParty>.*?<cbc:RegistrationName>)[^<]*', r'\1',
                        r'(<ram:SellerTradeParty>.*?<ram:Name>)[^<]*', r'\1'],
  # schema violation: unknown element
  'unknown-element': [r'(<cbc:CustomizationID>)', r'<cbc:Bogus>x</cbc:Bogus>\1',
                      r'(<rsm:ExchangedDocument>)', r'<ram:Bogus>x</ram:Bogus>\1'],
  # BT-2 invalid issue date
  'bad-issue-date': [r'(<cbc:IssueDate>)[^<]*', r'\g<1>2026-02-30',
                     r'(<rsm:ExchangedDocument>.*?<udt:DateTimeString format="102">)[^<]*', r'\g<1>20261345'],
}
made = 0
for f in src:
    s = open(f, encoding='utf-8').read()
    base = os.path.basename(f)[:-4]
    for name, (p_ubl, r_ubl, p_cii, r_cii) in MUT.items():
        n = sub1(p_ubl, r_ubl, s) if '<cbc:' in s else sub1(p_cii, r_cii, s)
        if n:
            open(f'{out}/{base}__{name}.xml', 'w', encoding='utf-8').write(n); made += 1
print('mutants:', made)
