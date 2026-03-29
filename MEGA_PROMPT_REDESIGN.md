# MEGA PROMPT — Refonte totale PolyAlpha (inspirée WorldQuant Foundry)

> Ce document est un prompt de design complet à appliquer sur l'ensemble de la plateforme PolyAlpha. Il traduit le langage visuel premium de WorldQuant Foundry dans le contexte d'une plateforme d'analytics pour marchés prédictifs, tout en conservant une direction artistique sombre.

---

## 1. PHILOSOPHIE GÉNÉRALE

Tu es un designer UI/UX senior spécialisé en interfaces financières haut de gamme. Tu vas redesigner entièrement la plateforme PolyAlpha (React 19 + Vite + Tailwind CSS 4 + Three.js + Framer Motion) en appliquant les principes suivants :

- **Luxe silencieux** : L'interface respire. Chaque élément a de l'espace. Rien n'est compressé, rien ne crie. La densité d'information est élevée mais la présentation est aérée.
- **Précision institutionnelle** : Chaque pixel communique la crédibilité. Le style évoque un terminal Bloomberg redessiné par un studio de design scandinave.
- **3D comme signature** : Les éléments Three.js ne sont pas décoratifs — ils sont la signature visuelle de la marque, chaque page ayant sa propre visualisation 3D contextuelle.
- **Mouvement intentionnel** : Chaque animation a un but. Pas d'animation gratuite. Les transitions sont fluides, lentes, confiantes (ease cubique, 400-600ms).

---

## 2. SYSTÈME TYPOGRAPHIQUE

### Polices
- **Display / Titres** : `"Roc Grotesk"` (ou alternative libre : `"Space Grotesk"`, `"General Sans"`) — géométrique, moderne, autoritaire
- **Mono / Labels / Données** : `"Azeret Mono"` (ou alternative libre : `"JetBrains Mono"`, `"Space Mono"`) — pour les chiffres, timestamps, catégories, badges
- **Corps** : La police display en weight 400 sert aussi pour le corps de texte

### Hiérarchie
| Niveau | Taille | Weight | Casse | Espacement | Usage |
|--------|--------|--------|-------|------------|-------|
| H1 (Hero) | 60-72px desktop / 36-42px mobile | 500 | UPPERCASE | letter-spacing: -0.02em | Titres de page, hero headlines |
| H2 (Section) | 40-48px / 28-32px mobile | 500 | UPPERCASE | letter-spacing: -0.01em | Titres de section |
| H3 (Sous-section) | 24-28px / 20-24px mobile | 500 | UPPERCASE | letter-spacing: 0.02em | Sous-titres, titres de cartes |
| Label mono | 11-13px | 400 | UPPERCASE | letter-spacing: 0.12em | Catégories, badges, méta-données, numéros de section |
| Corps | 16-18px | 400 | Normal | line-height: 1.6 | Paragraphes, descriptions |
| Données | 14-16px mono | 400 | Normal | tabular-nums | Prix, pourcentages, adresses wallet |

### Règles typographiques
- Les titres sont TOUJOURS en majuscules
- Les labels de catégorie utilisent la police mono en uppercase avec un fort letter-spacing (0.1em+)
- Les chiffres financiers utilisent TOUJOURS la police mono avec `font-variant-numeric: tabular-nums`
- Jamais de gras au-delà de weight 500 — la hiérarchie vient de la taille et de l'espacement, pas de l'épaisseur
- Les paragraphes ont une `max-width: 560px` pour une lecture confortable

---

## 3. PALETTE DE COULEURS

### Base sombre (conservée et raffinée)
```css
--bg-void:    #0A0A0A;   /* Fond principal — noir profond, pas pur noir */
--bg-deep:    #111111;   /* Fond secondaire — cartes, sections alternées */
--bg-surface: #1A1A1A;   /* Surfaces élevées — modals, dropdowns, hover states */
--bg-elevated:#222222;   /* Éléments interactifs surélevés */
```

### Texte
```css
--text-primary:   #DADADA;  /* Texte principal — gris clair, PAS blanc pur */
--text-secondary: #8A8A8A;  /* Texte secondaire — descriptions, méta */
--text-muted:     #555555;  /* Texte tertiaire — placeholders, disabled */
--text-bright:    #F5F5F5;  /* Accent texte — titres hero, hover */
```

### Accents (usage parcimonieux et intentionnel)
```css
--accent-teal:    #2DD4A8;  /* Accent primaire — CTAs, liens, positif */
--accent-coral:   #FF6B4A;  /* Accent secondaire — alertes, warnings, négatif */
--accent-amber:   #F5A623;  /* Accent tertiaire — en cours, pending */
--accent-blue:    #4A9EFF;  /* Accent informatif — badges, catégories */
```

### Bordures et séparateurs
```css
--border:         rgba(255,255,255,0.06);  /* Bordures subtiles */
--border-hover:   rgba(255,255,255,0.12);  /* Bordures au hover */
--border-accent:  rgba(45,212,168,0.3);    /* Bordures accentuées */
```

### Règles couleur
- Le fond principal est `#0A0A0A`, JAMAIS `#000000` pur (trop dur)
- Le texte principal est `#DADADA`, JAMAIS `#FFFFFF` pur (trop agressif)
- Les couleurs d'accent sont utilisées avec parcimonie : un seul accent par section
- Les cartes n'ont PAS de bordure visible par défaut — elles se distinguent par leur fond légèrement plus clair (`--bg-deep` sur `--bg-void`)
- Les séparateurs horizontaux sont des `<hr>` avec `border-color: var(--border)`, très subtils

---

## 4. VISUALISATIONS 3D (Three.js)

### Principe
Chaque page/section majeure a sa propre visualisation 3D contextuelle. Les visuels 3D ne sont pas un fond décoratif — ils sont des éléments de design first-class qui communiquent le contenu.

### Catalogue de visuels par page
| Page | Visuel 3D | Description |
|------|-----------|-------------|
| **Landing Hero** | Globe de points animé | Sphère de particules (dots) représentant le réseau global des marchés prédictifs. Rotation lente, points qui pulsent. Palette monochrome (blanc/gris sur noir). |
| **Landing Sections** | Terrain de vagues (dot grid) | Grille de points ondulante, comme un terrain topographique. Transition fluide entre sections. Représente les flux de données. |
| **Wallet Stalker** | Réseau de nodes connectés | Graphe 3D de nodes (wallets) connectés par des lignes. Les nodes pulsent quand il y a de l'activité. |
| **Agent Tracker** | Essaim de particules | Nuage de particules qui se réorganise en clusters. Chaque cluster représente un agent. Mouvement organique. |
| **Arbitrage Scanner** | Flux de données parallèles | Lignes de particules qui coulent horizontalement à différentes vitesses, représentant les flux de prix entre marchés. |

### Spécifications techniques 3D
- **Rendu** : Points/dots uniquement (pas de mesh solide) — style WorldQuant Foundry
- **Taille des points** : 1.5-3px, avec atténuation par distance
- **Couleur des points** : `#DADADA` principal, avec des touches d'accent (`--accent-teal`) pour les éléments interactifs
- **Animation** : requestAnimationFrame, 60fps, mouvement subtil et continu
- **Interaction** : Les visuels réagissent subtilement au scroll (parallaxe) et au mouvement de la souris
- **Performance** : 1500-2000 points max desktop, 600-800 mobile. Utiliser `InstancedMesh` ou des shaders GLSL custom.
- **Positionnement** : Les visuels 3D peuvent être en fond (position: fixed, z-index: 0) OU intégrés dans le layout (inline, à côté du texte dans un split layout)

---

## 5. LAYOUT ET GRILLE

### Principes de mise en page
- **Whitespace extrême** : Padding de section minimum 100px vertical (desktop). L'espace vide EST le design.
- **Max-width** : Contenu limité à `1400px`, centré. Les fonds s'étendent full-width.
- **Split layouts** : Le pattern principal est le split 50/50 ou 60/40 — texte d'un côté, visuel 3D ou contenu riche de l'autre.
- **Asymétrie contrôlée** : Les éléments ne sont pas toujours centrés. Décalages intentionnels pour créer du dynamisme.

### Patterns de layout par section
```
HERO (100vh)
┌─────────────────────────────────────────┐
│  [Label mono]          [Visuel 3D      ]│
│  TITRE                 [               ]│
│  PRINCIPAL             [    Globe      ]│
│                        [               ]│
│  Sous-titre            [               ]│
│  [ CTA bracket ]                        │
│                   SCROLL TO EXPLORE ↓   │
└─────────────────────────────────────────┘

SECTION CONTENU (split)
┌─────────────────────────────────────────┐
│                                         │
│  [01]                                   │
│  TITRE DE SECTION         Paragraphe    │
│                           descriptif    │
│                           max 560px     │
│                                         │
└─────────────────────────────────────────┘

SECTION CARTES (grille)
┌─────────────────────────────────────────┐
│                                         │
│  ┌──────┐  ┌──────┐  ┌──────┐          │
│  │ Carte│  │ Carte│  │ Carte│          │
│  │      │  │      │  │      │          │
│  │      │  │      │  │      │          │
│  └──────┘  └──────┘  └──────┘          │
│                                         │
└─────────────────────────────────────────┘

SECTION CTA (full-width)
┌─────────────────────────────────────────┐
│              [Accent bg]                │
│                                         │
│         CALL TO ACTION                  │
│         [ CTA bracket ]                 │
│                                         │
└─────────────────────────────────────────┘
```

### Espacement
```css
--space-section: 100px;      /* Entre sections */
--space-block:   64px;       /* Entre blocs dans une section */
--space-element: 32px;       /* Entre éléments liés */
--space-tight:   16px;       /* Espacement compact */
--space-micro:   8px;        /* Micro-espacement */
```

---

## 6. COMPOSANTS UI

### 6.1 Boutons CTA — Style "Bracket"
Le CTA signature utilise des crochets/brackets aux coins au lieu d'un fond plein :

```
  ⌐                          ¬
       EXPLORE MARKETS →
  └                          ┘
```

- Pas de `background-color` — transparent
- Bordure : uniquement des segments de coin (pseudo-elements `::before` / `::after`)
- Texte : mono, uppercase, letter-spacing: 0.1em
- Hover : les brackets s'écartent légèrement (transform: scale), le texte passe en `--accent-teal`
- Transition : 300ms ease

### 6.2 Cartes
- **Fond** : `--bg-deep` sur `--bg-void`, ou `--bg-surface` si la section est déjà `--bg-deep`
- **Bordure** : Aucune par défaut. Au hover : `border: 1px solid var(--border-hover)`
- **Border-radius** : `0px` — angles droits, pas de rounded corners (esthétique institutionnelle)
- **Padding** : `32px` minimum
- **Hover** : Translation légère vers le haut (`translateY(-4px)`), apparition de la bordure
- **Header de carte** : Label mono en haut (`CATEGORY · 01`), titre en H3

### 6.3 Sections numérotées
Chaque section majeure est préfixée par un numéro en mono :
```
01    WALLET TRACKING
02    AGENT ANALYTICS
03    ARBITRAGE DETECTION
```
- Numéro en `--text-muted`, police mono, 13px
- Titre en H2, uppercase, juste en dessous ou à côté
- Séparateur horizontal fin entre les sections

### 6.4 Navigation sidebar (pages outils)
Pour les pages Wallet Stalker, Agent Tracker, Arbitrage Scanner :
- Navigation latérale gauche avec liste de sous-sections
- Style : texte mono, l'item actif a un indicateur (trait vertical ou changement de couleur)
- Pattern de pagination : `01 / 06` en mono dans le coin

### 6.5 Tableaux de données
- **Headers** : Mono, uppercase, letter-spacing: 0.1em, `--text-muted`
- **Lignes** : Alternance subtile `--bg-void` / `--bg-deep`
- **Hover ligne** : `--bg-surface`
- **Bordures** : Uniquement horizontales, `var(--border)`
- **Chiffres** : Mono, tabular-nums, alignés à droite
- **Badges de statut** : Petit point coloré + texte mono

### 6.6 Inputs / Formulaires
- **Fond** : `--bg-surface`
- **Bordure** : `1px solid var(--border)`, focus: `var(--accent-teal)`
- **Border-radius** : `0px`
- **Texte** : Police display pour les inputs texte, mono pour les inputs numériques
- **Label** : Mono, uppercase, 11px, letter-spacing: 0.1em, au-dessus de l'input

---

## 7. ANIMATIONS ET TRANSITIONS

### Easing global
```css
--ease-smooth: cubic-bezier(0.16, 1, 0.3, 1);   /* Transitions de page */
--ease-out:    cubic-bezier(0.33, 1, 0.68, 1);   /* Hover, apparitions */
--ease-in:     cubic-bezier(0.32, 0, 0.67, 0);   /* Disparitions */
```

### Scroll-reveal
- Les sections apparaissent au scroll avec : `opacity: 0 → 1`, `translateY(40px) → 0`, `filter: blur(4px) → blur(0)`
- Durée : 600ms, easing: `--ease-smooth`
- Déclenchement : IntersectionObserver, threshold: 0.15
- Stagger : Les éléments enfants apparaissent avec un délai de 100ms entre chaque

### Transitions de page (Framer Motion)
```js
const pageVariants = {
  initial: { opacity: 0, y: 20, filter: "blur(6px)" },
  animate: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] }
  },
  exit: {
    opacity: 0, y: -10, filter: "blur(4px)",
    transition: { duration: 0.3, ease: [0.32, 0, 0.67, 0] }
  }
};
```

### Compteurs animés
- Les chiffres de stats comptent de 0 à leur valeur avec `requestAnimationFrame`
- Durée : 1.5s, easing décélérant
- Format : mono, tabular-nums

### Hover states
- Tous les éléments interactifs ont un hover state
- Transitions : 200-300ms
- Pas de changements brusques — tout est progressif

---

## 8. STRUCTURE DES PAGES

### 8.1 Landing Page
1. **Hero** (100vh) : Split layout — headline + sous-titre à gauche, globe 3D à droite. CTA bracket. "SCROLL TO EXPLORE" en bas.
2. **Ticker** : Bande horizontale défilante avec les marchés actifs (mono, données temps réel)
3. **Section "Pourquoi PolyAlpha"** (numérotée 01) : 3 cartes sans bordure, icône + titre + description
4. **Section Features** (numérotée 02) : Split layout alternant gauche/droite, visuel 3D inline + texte
5. **Section Métriques** : Compteurs animés (wallets trackés, agents suivis, opportunités détectées)
6. **Section "Comment ça marche"** (numérotée 03) : 3 étapes en grille, connectées visuellement
7. **CTA Final** : Section pleine largeur avec fond accent, titre + bracket CTA
8. **Footer** : Minimal, liens en mono, copyright

### 8.2 Pages Outils (Wallet Stalker, Agent Tracker, Arbitrage Scanner)
- Layout avec sidebar navigation à gauche (optionnel)
- Header de page avec : numéro de section (mono), titre (H1), description courte
- Contenu principal avec cartes de données, tableaux, graphiques
- Visuel 3D contextuel en arrière-plan ou intégré

### 8.3 Pages Auth (Login / Signup)
- Design centré, minimal
- Formulaire sur fond `--bg-deep` avec bordures subtiles
- Visuel 3D en fond (globe ou terrain, opacity réduite)
- Pas de header, lien retour discret

---

## 9. RESPONSIVE

### Breakpoints
```css
--bp-mobile:  480px;
--bp-tablet:  768px;
--bp-desktop: 1024px;
--bp-wide:    1400px;
```

### Adaptations mobiles
- Les split layouts passent en stack vertical
- Les titres H1 descendent à 36px, H2 à 28px
- Le padding de section passe à 60px vertical
- Les visuels 3D réduisent leur nombre de particules (600-800)
- La navigation sidebar devient un menu hamburger ou un onglet horizontal
- Les bracket CTAs gardent leur style mais s'adaptent en largeur

---

## 10. PATTERNS SPÉCIFIQUES À CONSERVER / ADAPTER

### De l'existant PolyAlpha à conserver
- Le `ParticleField` Three.js en fond persistant (mais upgrader les visuels par page)
- Le système de routes React Router
- L'AnimatePresence pour les transitions de page
- Le ToastProvider pour les notifications
- La structure Header + Main avec padding conditionnel

### De WorldQuant Foundry à adapter
- ❌ NE PAS utiliser de sections à fond clair (#D9D9D9) — on reste full dark
- ✅ Adapter les dot grids/terrains 3D au contexte crypto/prediction markets
- ✅ Adapter les bracket CTAs
- ✅ Adapter la typographie Roc Grotesk (ou Space Grotesk en libre)
- ✅ Adapter les sections numérotées (01, 02, 03)
- ✅ Adapter le whitespace généreux
- ❌ NE PAS copier les photos d'équipe recadrées en yeux — pas pertinent ici
- ✅ Adapter les séparateurs horizontaux subtils
- ✅ Adapter la pagination mono (01/06)
- ✅ Adapter le "SCROLL TO EXPLORE" dans le hero

---

## 11. INSTRUCTIONS D'IMPLÉMENTATION

Quand tu codes ce redesign :

1. **Commence par `index.css`** : Définis toutes les CSS custom properties (couleurs, espacements, easing) en variables globales. Importe les fonts (Space Grotesk + JetBrains Mono de Google Fonts, ou les versions premium si dispo).

2. **Crée un fichier `design-tokens.js`** : Exporte les constantes partagées (breakpoints, durées d'animation, variants Framer Motion).

3. **Refais chaque page une par une** dans cet ordre :
   - Landing Page (la vitrine — la plus critique)
   - Login / Signup (simple, rapide)
   - Wallet Stalker (page outil principale)
   - Agent Tracker
   - Arbitrage Scanner

4. **Pour chaque page** :
   - Définis le layout avec le système de grille (split ou centré)
   - Intègre le visuel 3D approprié
   - Applique la typographie (H1 uppercase, labels mono, corps 16px)
   - Ajoute les scroll-reveal animations
   - Teste le responsive

5. **Le ParticleField** doit être refactorisé pour supporter les différents modes visuels (globe, terrain, réseau, essaim, flux) via un prop `mode`. Chaque page définit son mode.

6. **Les bracket CTAs** doivent être un composant réutilisable `<BracketButton>`.

7. **Les cartes numérotées** doivent être un composant `<NumberedSection index="01" title="..." >`.

---

## 12. CHECKLIST FINALE

Avant de considérer le redesign terminé, vérifie :

- [ ] Toutes les polices sont chargées (display + mono)
- [ ] Aucun texte n'est en blanc pur (#FFF) — utiliser #DADADA ou #F5F5F5
- [ ] Aucun fond n'est en noir pur (#000) — utiliser #0A0A0A
- [ ] Tous les titres sont en uppercase
- [ ] Tous les chiffres financiers sont en mono
- [ ] Toutes les sections ont un padding vertical ≥ 80px
- [ ] Les bracket CTAs fonctionnent et ont un hover state
- [ ] Les visuels 3D changent par page/section
- [ ] Les scroll-reveal animations se déclenchent correctement
- [ ] Le responsive fonctionne sur mobile (480px), tablet (768px), desktop (1024px+)
- [ ] Les transitions de page sont fluides (pas de flash blanc, pas de saut)
- [ ] Les performances sont bonnes (60fps sur les animations 3D)
- [ ] L'accessibilité est maintenue (contraste suffisant, focus visible)
