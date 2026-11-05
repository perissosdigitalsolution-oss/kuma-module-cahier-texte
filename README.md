# KUMA Module — Cahier de Texte 🇨🇮

**Version 1.0.0 · API v1**

Cahier de texte numérique avec suivi pédagogique par enseignant, validation par la direction, et consultation par les parents.

## 📦 Installation
```bash
npx wrangler d1 execute <DB> --remote --file modules/cahier-texte/server/schema.sql
# Mount: app.route('/api/v1/modules/lessons', createLessonModule());
```

## 🔌 API v1
| Méthode | Route | Description |
|---|---|---|
| GET | `/health` | Probe |
| POST | `/plan` | Créer un plan |
| GET | `/plans` | Lister les plans |
| POST | `/material` | Ajouter un support |
| POST | `/status` | Marquer suivi |
| GET | `/summary/:classId` | Résumé classe |

MIT — libre utilisation KSP.