# AGENT.md — news-image-20261125-entry

## The six stories (all Wednesday 25 November 2026)

1. **TANKERS ABLAZE IN HORMUZ** — Two oil tankers struck naval mines,
   exploded and caught fire in the Strait of Hormuz; Iran's Revolutionary
   Guards Navy said so and warned vessels to coordinate passage. Brent
   crude fell to about $90.97 a barrel. Source: Reuters, 25 Nov 2026.
2. **HUAWEI GUILTY IN U.S. FRAUD TRIAL** — A New York jury convicted
   Huawei of bank fraud, wire fraud, sanctions violations and conspiring to
   steal trade secrets: guilty on 10 of 12 counts, acquitted of
   racketeering. Sentencing set for 14 September 2027. Sources: Reuters /
   CNN; verdict 24 Nov, widely reported 25 Nov.
3. **PAKISTAN REACHES ORBIT** — China's Shenzhou-24 docked with the
   Tiangong station carrying Muhammad Zeeshan Ali, 40, a Pakistani pilot:
   the first Pakistani in orbit and the first foreign astronaut aboard
   China's station. Source: Reuters, 25 Nov 2026.
4. **UKRAINE SINKS RUSSIAN WARSHIP OFF LIBYA** — Ukrainian sea drones
   sank the Russian corvette Merkury off Benghazi, Libya (attack Sunday
   22 Nov); two Libyan soldiers later died of wounds. Reported 25 Nov 2026.
5. **ALL HOSTAGES FREED IN CARTAGENA** — Colombian security forces
   stormed a supermarket in Cartagena and freed all hostages after a
   day-long siege; one assailant killed. 25 Nov 2026.
6. **ASIAN TECH SHARES TUMBLE** — Asian tech shares fell on renewed
   doubts over the AI boom: Japan's Nikkei down 2.8%, South Korean shares
   down more than 6%, SoftBank down about 15%. 25 Nov 2026.

## How the image was drawn

`main.ts` renders the whole 1024x1024 front page pixel by pixel into an
RGBA buffer and encodes the PNG itself (manual PNG chunks, CRC32,
node:zlib deflate). No external files, no network, no copied photos. Text
uses a hand-written 5x7 bitmap font (upper/lowercase, digits,
punctuation) with word wrap. Illustrations are drawn from code: a burning
tanker at sea, a courthouse, a rocket over Earth, a warship under a drone,
a supermarket with open doors, and a falling market chart. Palette is
newspaper paper cream, black ink, one red accent.

## Verification

- Rendered and viewed the PNG; fixed three layout defects: the rocket's
  Earth disc covering the standfirst, the Ukraine headline wrapping to a
  fifth line and clipping into its picture, and three standfirsts running
  into the footer. Final render checked clean: no overlapping or cut-off
  text, all six illustrations read as what they depict.
- Ran `main.ts` twice to two different output dirs: byte-identical
  (`cmp` clean, deterministic).
- Image: 1024x1024, 27,766 bytes (limit 1,048,576), valid PNG signature.
- Zero console errors (only the harmless Node module-type warning, which
  the repo's `package.json` with `"type": "module"` removes).
- No external URLs in the code; the only URLs in the repo are the three
  required make.fun badge links in README.md.
