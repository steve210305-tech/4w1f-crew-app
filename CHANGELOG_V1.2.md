# 4W1F Crew App – V1.2.0

## UI-Rebuild
- Navigation wie Referenzdesign: Home, Events, Mitglieder, Galerie, Admin/Profil
- neues Header-Branding im 4W1F-Stil
- kompaktere Karten, violette Akzente, stärkere Typografie und klarere Hierarchie

## Rollen & Admin Center
- nur noch Owner, Admin und Mitglied
- Owner ist geschützt
- Admin-Funktionslabels wie Orga, Fotografie oder Social Media
- eigenes Admin Center als zentrale Verwaltungsoberfläche

## Ankunft teilen
- bei Events und Ankündigungen mit Standort direkt per Knopfdruck
- Standort wird vom Gerät übernommen
- Fahrzeit/Distanz via Routing berechnet, Fallback über Distanzschätzung
- ETA wird beim jeweiligen Treffpunkt angezeigt und zusätzlich in Crew Live übernommen

## Kommunikation
- Lesestatus pro Ankündigung
- frei definierbare Antworten
- Ankündigungen mit Datum, Uhrzeit, Ort und Kartenposition
- gelesene Benachrichtigungen löschbar/ausblendbar

## Sicherheit – Prototyp-Basis
- Content Security Policy
- Bild-Uploadfilter (Typ + Dateigröße)
- Owner Lock
- Audit-Log
- Server-Rollen/RLS und 2FA bleiben Pflicht vor echtem Crew-Start

## Updates
- Service Worker + Versionsdatei weitergeführt
- installierte PWA kann über dieselbe URL aktualisiert werden
