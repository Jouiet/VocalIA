Lis les fichiers suivants pour generer un briefing de session:

1. `memory/MEMORY.md` — etat courant du projet
2. `docs/MATURITY-AUDIT.md` — scores de maturite
3. `docs/ROADMAP-TO-COMPLETION.md` (lignes 1-60) — header + scores

Genere un briefing en 15 lignes max:

### Etat
- Score maturite: X% (delta depuis derniere session)
- Tests: X pass, X fail
- Bugs critiques ouverts: X

### Top 3 Priorites
1. [Action a plus fort impact revenue]
2. [Action a plus fort impact technique]
3. [Action a plus fort impact maturite]

### Blockers
- [Blocker 1 + effort estime]
- [Blocker 2 + effort estime]

### Alerte Drift
- Compare le "Next" declare dans MEMORY.md avec les sessions recentes.
  Si le meme "Next" est mentionne >3 fois sans avancement, signale-le.
