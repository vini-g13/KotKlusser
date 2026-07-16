# DEZE FILE MOET VERWIJDERD WORDEN — zie kotklusser-cleanup-plan.md sectie 2.1
#
# Dit bestand bevatte een rauwe kopie van .env (Mongo-connectiestring, DB-naam en
# een JWT_SECRET) onder een .py-extensie die niet door .gitignore gedekt werd.
# De inhoud is hier verwijderd als eerste stap, maar het bestand zelf kon niet
# programmatisch verwijderd worden vanuit deze sessie (geen bash-toegang tot deze
# repo-locatie). Verwijder dit bestand handmatig, en zorg dat de echte productie-
# JWT_SECRET op Railway geroteerd wordt (deze file lekte een andere, eveneens
# zwakke waarde dan de hardcoded fallback die in server.py stond) los van of dit
# bestand ooit gecommit is geweest — check dat met:
#   git log --all --full-history -- backend/CopyNULL.py
