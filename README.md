<div align="center">

# PADEL ONLINE

**Match 2v2 · Terrain vitré · Directement dans le navigateur**

[![Jouer](https://img.shields.io/badge/▶_Jouer-padel--online.vercel.app-14d3c4?style=for-the-badge)](https://padel-online.vercel.app)
[![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react&logoColor=white)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-0.170-000000?style=flat-square&logo=threedotjs&logoColor=white)](https://threejs.org)
[![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square&logo=vite&logoColor=white)](https://vite.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)

Un padel arcade en 3D, pensé pour le web et le mobile.<br/>
Toi + **Aziz** contre **Médoune** & **Imran**. Un seul service, des murs, des lobs, des bandejas.

[Jouer maintenant](https://padel-online.vercel.app) · [Code source](https://github.com/MedouneSGB/padel-online)

</div>

---

## Le terrain

Cage verre, filet, public, et une physique de balle qui vise le camp adverse — pas un simple rebond tennis.

| Coup | Rôle |
| :--- | :--- |
| **Service** | Diagonal, dans le carré |
| **Volée** | Plat, au filet |
| **Bandeja** | Défensif, haut et profond |
| **Lob** | Pour casser le filet adverse |
| **Smash** | Gagnant quand la balle est haute |

Formation **un devant / un derrière**. Les bots restent au filet, relancent les services courts, et ne s’enferment plus dans une volée infinie.

---

## Contrôles

<table>
<tr>
<td width="50%">

**Clavier**

- `ZQSD` / flèches — se déplacer
- `Espace` — servir / frapper
- `1–5` — choisir le coup
- Souris — viser et charger

</td>
<td width="50%">

**Téléphone**

- Joystick ou D-pad
- Bouton **Servir / Frapper**
- Coups en raccourcis à l’écran
- Portrait & paysage

</td>
</tr>
</table>

Tout se règle dans **Réglages** : touches, boutons visibles, vitesse de balle, vue caméra, analogique.

---

## Lancer en local

```bash
git clone https://github.com/MedouneSGB/padel-online.git
cd padel-online
npm install
npm run dev
```

Ouvre [http://localhost:5173](http://localhost:5173) — le serveur écoute aussi sur le réseau local.

```bash
npm run build     # production
npm run preview   # prévisualiser le build
```

---

## Stack

```
Vite  +  React  +  Three.js  +  TypeScript
                 │
                 └── physique balle, bots, HUD, audio Web Audio
```

Déployé sur [Vercel](https://padel-online.vercel.app).

---

<div align="center">
<sub>Padel Online · 2026</sub>
</div>
