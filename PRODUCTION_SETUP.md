# 4W1F V3.0.0 – Production Release

Echte Production-Fassung mit separatem Supabase-Projekt `4W1F Production`.

## Einmalige Supabase-Einstellung vor dem ersten Signup
Supabase Dashboard → 4W1F Production → Authentication → URL Configuration
- Site URL: `https://steve210305-tech.github.io/4w1f-crew-app/`
- Redirect URL hinzufügen: `https://steve210305-tech.github.io/4w1f-crew-app/**`

## Erster Owner-Start
Öffne die App mit dem Owner-Einladungscode, registriere dein Konto und bestätige die E-Mail.
Danach erzeugst du im Admin Center → Einladungen je einen Admin-Testlink.

## Test → Release
Solange `Admin Test` aktiv ist, erlaubt der Server nur Owner/Admin.
Nach dem Admin-Go: Release Center → `FAMILY` → Crew Release aktivieren.
Dann können Member-Invites direkt verteilt werden.

## Push
Für iPhone: App über Safari zum Home-Bildschirm hinzufügen und Push erlauben.
Push funktioniert danach auch bei geschlossener PWA. Ungelesene Nachrichten werden serverseitig erneut erinnert.
