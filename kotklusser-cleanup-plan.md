# KotKlusser Cleanup Plan

Laatst bijgewerkt: 16 juli 2026

Dit document is bedoeld als startpunt voor een aparte taak rond de cleanup van de **bestaande standalone KotKlusser-app**. Het gaat hier dus niet over de nieuwe platformmodule, maar over het rechttrekken van de huidige app zodat die:

- inhoudelijk correct staat
- technisch consistenter wordt
- later een betere bron vormt voor de `KotKlusser`-module in het nieuwe platform

---

## 1. Doel Van Deze Cleanup

De cleanup heeft vier doelen:

1. De bestaande `KotKlusser` als aparte app stabiel en logisch maken.
2. Functionele en technische inconsistenties wegwerken.
3. Het domeinmodel scherp krijgen voor studenten, panden, tickets, aannemers en toegang.
4. Zorgen dat we later geen fouten dubbel moeten oplossen in zowel de standalone app als de platformmodule.

Belangrijk:

- De bestaande `KotKlusser` blijft als aparte app bestaan.
- We bouwen in deze fase nog niet het nieuwe platform.
- We herschrijven nu niet alles naar de finale platformarchitectuur.
- We maken de huidige app eerst “juist”.

---

## 2. Scope

### In scope

- Rollen en toegangsmodel verduidelijken
- Studentflow opschonen
- Join-code flow opschonen
- Property- en pandlogica rechttrekken
- Ticket- en chatflow valideren
- Aannemerflow verduidelijken
- Terminologie en UX consistent maken
- Huidige technische inconsistenties in frontend/backend in kaart brengen
- Hostingrichting en doelrichting helder maken

### Niet in scope

- Volledige migratie naar het nieuwe platform
- Volledige herbouw naar Supabase binnen deze cleanupfase
- Definitief pricing- of subscriptionmodel voor het platform
- Integratie met `KotContract` of `KotPlaatsbeschrijving`

---

## 3. Wat Eerst In Kaart Moet Komen

Vooraleer we echt beginnen aanpassen, moeten we de huidige app strak analyseren op deze punten:

### A. Rollen En Actoren

Te verifiëren:

- Welke rollen bestaan vandaag echt in code?
- Welke rechten hebben `landlord`, `student` en `aannemer` werkelijk?
- Waar zitten impliciete aannames die niet meer kloppen?

Output:

- eenduidig huidig rollenoverzicht
- lijst van onduidelijke of fout gemodelleerde rechten

### B. Studentflow

Te verifiëren:

- Hoe registreert een student vandaag?
- Wanneer wordt een student aan een pand gekoppeld?
- Welke data is verplicht?
- Waar zit frictie of inconsistent gedrag?

Output:

- duidelijk overzicht huidige student onboarding
- lijst met concrete pijnpunten

### C. Propertyflow

Te verifiëren:

- Hoe maakt een verhuurder een pand aan?
- Hoe worden verdiepingen en kamers vandaag geïnterpreteerd?
- Hoe hangt een student aan een pand of kamer?

Output:

- huidige propertystructuur
- punten die later botsen met platformkern `properties`/`rooms`

### D. Ticket- En Chatflow

Te verifiëren:

- Welke ticketstatussen bestaan?
- Welke acties kunnen student, verhuurder en aannemer uitvoeren?
- Hoe werkt unread state?
- Welke delen zijn al stabiel en welke niet?

Output:

- flowdiagram of lijst van huidige ticket lifecycle
- lijst met inconsistenties

### E. Aannemerflow

Te verifiëren:

- Hoe wordt een aannemer vandaag toegevoegd of uitgenodigd?
- Welke toegang krijgt hij echt?
- Hoe goed sluit dat aan op het gewenste externe contractor-model?

Output:

- huidige aannemerflow
- mismatch met gewenste eindrichting

### F. Technische Structuur

Te verifiëren:

- Welke delen van frontend en backend zijn rommelig of te sterk gekoppeld?
- Welke naming is verwarrend?
- Welke API-contracten zijn instabiel?
- Welke stukken zijn klaar om later als bron te dienen?

Output:

- technische cleanup-lijst
- prioritering per risico

---

## 4. Gewenste Eindsituatie Van De Cleanup

Na de cleanup zou de bestaande standalone `KotKlusser` aan deze voorwaarden moeten voldoen:

- rollenmodel is helder
- student onboarding is logisch
- join code flow is stabiel
- property/pand-model is duidelijk
- ticket- en chatflow zijn voorspelbaar
- aannemerflow is inhoudelijk correct
- belangrijke naming en UX zijn opgeschoond
- backend- en frontendcontracten zijn duidelijker
- de app is veel bruikbaarder als referentie voor de platformmodule

---

## 5. Concrete Fasering Voor De Cleanup

### Fase K1. Analyse En Inventaris

Doel:

- exact begrijpen wat vandaag staat
- niet op gevoel werken

Taken:

- huidige rollen en rechten opsommen
- studentflow uitschrijven
- propertyflow uitschrijven
- ticket lifecycle uitschrijven
- aannemerflow uitschrijven
- technische pijnpunten verzamelen

Output:

- analyseverslag
- lijst van problemen

### Fase K2. Functioneel Model Vastzetten

Doel:

- bepalen hoe `KotKlusser` inhoudelijk juist moet werken als standalone app

Te beslissen:

- exacte actorrechten
- join-code gedrag
- student/pand-relatie
- aannemer als externe actor
- benodigde ticketstatussen

Output:

- functioneel doelmodel voor standalone `KotKlusser`

### Fase K3. UX En Terminologie Cleanup

Doel:

- de app begrijpelijker en consistenter maken

Taken:

- termen harmoniseren
- naming in schermen harmoniseren
- dubbele of verwarrende flows schrappen
- duidelijkere onboardinglogica aanbrengen

Output:

- consistente UX- en domeintermen

### Fase K4. Backend Cleanup

Doel:

- backendlogica logischer en stabieler maken

Taken:

- auth- en rolchecks nalopen
- join-code logica opschonen
- ticket- en message-endpoints nalopen
- contractor-toegang nalopen
- payloads en response-structuren harmoniseren

Output:

- opgeschoonde backendlogica

### Fase K5. Frontend Cleanup

Doel:

- frontend laten aansluiten op opgeschoond model

Taken:

- schermflows corrigeren
- formulieren en foutmeldingen verbeteren
- rollen en acties in UI aligneren met backend
- onduidelijke states of navigatie opschonen

Output:

- stabielere standalone frontend

### Fase K6. Stabilisatie En Overdraagbaarheid

Doel:

- zorgen dat deze codebasis later een goede bron is voor de platformmodule

Taken:

- documenteren welke flows “source of truth” zijn
- opschrijven welke delen later hergebruikt worden
- scheiden wat standalone-specifiek is en wat domeinlogica is

Output:

- betere overdraagbaarheid naar platformwerk

---

## 6. Prioriteiten

### Prioriteit 1

- rollen en rechten
- student onboarding
- join code gedrag
- property/pand-relatie

### Prioriteit 2

- ticket lifecycle
- chat en unread gedrag
- aannemerflow

### Prioriteit 3

- terminologie
- UX-consistentie
- technische netheid en herbruikbaarheid

---

## 7. Concrete Eerstvolgende Stappen In Een Nieuwe Taak

Wanneer we een nieuwe taak openen voor de cleanup, is dit de aanbevolen startvolgorde:

1. De huidige `KotKlusser` codebase opnieuw doornemen met focus op:
   - rollen
   - onboarding
   - panden
   - tickets
   - aannemers
2. Een bevindingenlijst maken:
   - wat klopt
   - wat fout zit
   - wat onduidelijk is
3. Een doelmodel vastleggen voor de standalone app.
4. De cleanup opdelen in:
   - functionele fixes
   - backend fixes
   - frontend fixes
5. Daarna pas effectief beginnen implementeren.

---

## 8. Relatie Met Het Platform

Deze cleanup is voorbereidende arbeid voor het platform, maar is niet hetzelfde als platformbouw.

Na de cleanup:

- blijft de standalone `KotKlusser` bestaan
- is de app inhoudelijk sterker
- kunnen we veel gerichter beslissen wat we meenemen naar de platformmodule

De cleanup moet dus helpen om dubbel werk later te verminderen, zonder nu al alles in de platformarchitectuur te forceren.
