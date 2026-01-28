# Token Optimization

## PROBLÈME IDENTIFIÉ (Session 138 - 22/01/2026)

| Fait | Valeur | Vérification |
|------|--------|--------------|
| 3 Explore agents parallèles | 276,400 tokens | Observation directe |
| Coût estimé | ~$25/session | 276k × $0.09/1k |

---

## RÈGLES D'OPTIMISATION

### 1. Outils directs vs Agents (THÉORIQUE - Non mesuré)
```
PRÉFÉRER:
- Bash/grep -r "pattern"     → Recherche rapide
- Read file_path             → Lecture ciblée
- Glob "**/*.cjs"            → Listing fichiers

ÉVITER:
- Task(Explore) pour recherches simples
- 3+ agents parallèles
```

**Source**: Anthropic Engineering Blog (non vérifié localement)

### 2. Limiter lectures fichiers
```
Read(limit:100)  → Premières lignes seulement
Read(offset:X)   → Section spécifique
```

### 3. Un agent séquentiel vs parallèles
```
1 agent séquentiel < 3 agents parallèles
(théorique - économie exacte non mesurée)
```

---

## INDEX LÉGER CRÉÉ (VÉRIFIÉ)

| Fichier | Taille | Ratio |
|---------|--------|-------|
| `registry-index.json` | 1,358 bytes | - |
| `registry.json` | 74,704 bytes | - |
| **Ratio** | **55x** | ✅ Vérifié |

Emplacement: `automations/registry-index.json`

---

## RÈGLES POUR CLAUDE CODE

1. **Recherche codebase**: Utiliser `grep -r` ou `find` avant Task(Explore)
2. **Fichiers volumineux**: `Read(limit:100)` pour aperçu
3. **Agents**: Maximum 1 agent parallèle sauf besoin explicite
4. **Registry**: Lire `registry-index.json` (1.3KB) avant `registry.json` (75KB)

---

## À VÉRIFIER (TODO)

- [ ] Mesurer tokens réels: Bash vs Task(Explore)
- [ ] Mesurer tokens: Read() vs Read(limit:100)
- [ ] Test A/B avant/après règles
- [ ] Benchmark local des outils

---

*Màj: 22/01/2026 - Informations théoriques restaurées avec labels*
