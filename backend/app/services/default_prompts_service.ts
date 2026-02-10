import PromptCategory from '#models/prompt_category'
import Prompt from '#models/prompt'
import type { BusinessSector } from '#models/organization'

/**
 * Default prompt categories with their prompts
 */
const DEFAULT_CATEGORIES: Array<{
  name: string
  description: string
  color: string
  icon: string
  sector: BusinessSector | null
  prompts: Array<{ title: string; content: string }>
}> = [
    {
      name: 'Ressources humaines',
      description: "Prompts pour l'analyse RH : recrutement, évaluation et gestion des talents",
      color: '#6366F1', // indigo
      icon: 'i-heroicons-user-group',
      sector: 'hr',
      prompts: [
        {
          title: "Analyse d'entretien de recrutement",
          content: `Tu es un recruteur senior expérimenté avec 15 ans en recrutement tech et cadres. À partir de la transcription complète de cet entretien d'embauche pour le poste de [intitulé exact du poste], produis un compte-rendu structuré et objectif au format suivant :

1. Synthèse globale (3-4 phrases max) : adéquation générale du candidat avec le poste
2. Compétences techniques / hard skills démontrées (liste à puces avec niveau estimé : Faible / Moyen / Bon / Excellent + une preuve tirée de l'entretien)
3. Soft skills & comportements observés (liste à puces : communication, leadership, gestion du stress, fit culturel, etc. avec exemples concrets)
4. Red flags & points de vigilance (s'il y en a – sinon indiquer "Aucun détecté")
5. Forces majeures du candidat
6. Score global de fit sur 10 (avec justification courte)
7. 4 à 6 questions de creusement à poser au prochain tour (si le candidat passe)
8. Recommandation finale : À retenir / À retenir avec réserves / Ne pas retenir

Soit factuel, cite les passages clés de la transcription entre guillemets quand c'est pertinent, et reste neutre et professionnel.`,
        },
        {
          title: "Entretien annuel d'évaluation",
          content: `Tu es un DRH expert en gestion de la performance et entretiens annuels. Analyse cette transcription d'entretien annuel d'évaluation avec [prénom ou "le collaborateur"] en poste de [poste] depuis [X] années.

Structure ton compte-rendu exactement comme ceci :

- Résumé des réussites et réalisations clés de la période (4-6 puces max avec chiffres/métriques quand mentionnés)
- Points de progression / axes d'amélioration évoqués (liste à puces avec verbatim si possible)
- Niveau de motivation & engagement perçu (faible/moyen/élevé + indices concrets)
- Besoins en formation / développement exprimés ou suggérés
- Objectifs / priorités pour l'année suivante mentionnés par le manager et/ou le collaborateur
- Signaux faibles éventuels (risque de départ, surcharge, démotivation, conflit sous-jacent – si présents, alerte avec niveau : faible / moyen / élevé)
- Note globale d'engagement / satisfaction sur 10 (avec justification)
- 3 actions prioritaires recommandées pour le manager
- 3 actions prioritaires recommandées pour le collaborateur

Ton objectif : produire un document clair, actionnable et confidentiel pour le dossier RH et le suivi.`,
        },
        {
          title: "Analyse d'entretien de départ",
          content: `Tu es un spécialiste RH en rétention et gestion des talents. Voici la transcription complète d'un exit interview avec [prénom ou "le collaborateur"] qui quitte l'entreprise après [X] années en tant que [poste].

Génère un rapport d'analyse structuré et percutant au format suivant :

1. Raisons principales du départ (classées par ordre d'importance selon ce qui ressort le plus fort)
2. Ce qui a été apprécié dans l'expérience chez l'entreprise (forces / points positifs)
3. Principaux points de douleur / frustrations exprimés (liste à puces avec citations si possible)
4. Feedback sur le management direct / l'équipe / la culture d'entreprise
5. Feedback sur les conditions matérielles (salaire, avantages, télétravail, charge de travail…)
6. Suggestions d'amélioration pour retenir des profils similaires
7. Risque de contagion (est-ce que d'autres personnes pourraient être tentées de partir pour les mêmes raisons ? Justification)
8. Actions RH / management recommandées à court terme (3 max)

Sois direct, factuel, bienveillant mais sans édulcorer. Utilise des verbatims entre guillemets pour les éléments les plus marquants.`,
        },
      ],
    },
    {
      name: 'Vente et Commerce',
      description: "Prompts pour l'analyse commerciale : prospection, démos et négociations",
      color: '#10B981', // green
      icon: 'i-heroicons-currency-euro',
      sector: 'sales',
      prompts: [
        {
          title: "Analyse d'appel de vente",
          content: `Tu es un Head of Sales senior avec 12 ans d'expérience en B2B et solutions complexes. Analyse cette transcription complète d'un appel de vente / discovery call avec un prospect [nom ou "le prospect"] pour [nom du produit/service].

Produis un compte-rendu ultra-actionnable au format suivant :

1. Synthèse en 3-4 phrases : stade du cycle de vente + niveau d'intérêt perçu
2. Pain points / besoins exprimés par le prospect (liste à puces, priorisés par intensité + citation verbatim si possible)
3. Objections soulevées (liste à puces : prix, timing, concurrence, interne, etc. + force de l'objection : faible / moyenne / forte)
4. Signaux d'achat positifs (budget, autorité, besoin, timing – BANT ou MEDDIC si applicable, avec preuves)
5. Score de qualification sur 10 (avec justification courte : pourquoi ce score ?)
6. Next steps proposés / à proposer (3-5 actions concrètes, qui fait quoi, deadline suggérée)
7. Probabilité de closing dans les 90 jours (estimation % + facteurs clés)
8. 4 questions puissantes à poser au prochain call pour avancer / qualifier plus fort
9. Recommandation stratégique : Pousser fort / Nourrir / Disqualifier poliment

Sois direct, factuel, cite les passages clés entre guillemets, et adopte un ton business orienté résultats.`,
        },
        {
          title: 'Analyse de démo produit',
          content: `Tu es un expert en sales enablement et en technique closing. Voici la transcription d'une démo produit / présentation commerciale faite à [nom prospect / entreprise] pour [nom produit].

Génère un rapport structuré et percutant exactement comme suit :

- Résumé global de la démo (3 phrases max : points forts perçus, moment clé, réaction globale)
- Fonctionnalités / bénéfices les plus appréciés par le prospect (liste à puces + verbatim si pertinent)
- Questions posées par le prospect pendant la démo (liste chronologique + ce qu'elles révèlent sur leurs priorités)
- Points de friction / doutes exprimés (UI, intégration, prix, comparaison concurrente…)
- Niveau d'engagement perçu (passif / intéressé / très engagé / enthousiaste – avec indices concrets)
- Éléments à re-démontrer ou approfondir au prochain call (3 max)
- Objections techniques ou business non traitées pendant la démo
- Recommandation closing : Quel est le meilleur next step pour maximiser les chances ? (ex: POC, call décisionnaire, proposition commerciale…)
- Score "Demo Momentum" sur 10

Objectif : permettre au commercial de rebondir ultra-efficacement sur ce qui a marché et ce qui a coincé.`,
        },
        {
          title: 'Analyse de négociation / closing',
          content: `Tu es un closer expérimenté spécialisé en négociations B2B à fort enjeu. Analyse cette transcription de call de closing / négociation avec [nom prospect] pour finaliser le deal de [montant approx. / scope].

Structure ton analyse comme ceci :

1. État actuel du deal au début du call (dernières concessions, prix discuté, objections restantes)
2. Points gagnés pendant la négociation (concessions obtenues par le vendeur)
3. Concessions accordées (ce que le vendeur a lâché – liste avec impact business)
4. Signaux de closing forts (ex: "on signe quand ?", demande de contrat, validation interne…)
5. Blocages restants (s'il y en a – et leur criticité)
6. Tactiques utilisées par le prospect (silence, good cop/bad cop, last minute discount, etc.)
7. Probabilité de signature dans les 15 jours (estimation % + justification)
8. Stratégie recommandée pour la suite (dernière offre, deadline artificielle, impliquer le décideur final, walk-away…)
9. Leçons apprises pour les prochains deals similaires

Sois incisif, stratégique et orienté cash : l'objectif est de maximiser le win-rate et le deal value.`,
        },
        {
          title: 'Probabilité de Closing (Expert)',
          content: `# RÔLE
Tu es un Directeur Commercial d'élite avec 20 ans d'expérience en vente B2B High Ticket (logiciels, conseil, services). Tu es expert en méthodologies de vente (MEDDIC, SPIN Selling, Challenger Sale).

# TÂCHE
Ton objectif est d'analyser la transcription de réunion fournie ci-dessous pour déterminer la probabilité réelle que ce prospect signe (Closing). Ne sois pas complaisant. Sois critique, factuel et analytique.

# INSTRUCTIONS D'ANALYSE
Analyse l'échange en te concentrant sur ces 4 piliers :
1. DOULEUR (PAIN) : Le prospect a-t-il clairement exprimé un problème urgent ou coûteux ?
2. POUVOIR (AUTHORITY) : Le prospect est-il le décideur final ou doit-il en parler à son N+1 ?
3. BUDGET & TIMING : A-t-on parlé d'argent ou de date de mise en place ?
4. OBJECTIONS CACHÉES : Détecte les non-dits, les hésitations ou les réponses polies qui cachent un "non".

# FORMAT DE SORTIE (Strictement en Markdown)

## 🎯 Score de Closing : [X]/100
(Donne une note réaliste. Si c'est un premier RDV sans budget évoqué, ne dépasse jamais 60/100).

## 🌡️ Analyse du Sentiment & Engagement
* **Atmosphère globale :** (ex: Curieuse, Sceptique, Conquise, Pressée...)
* **Niveau d'intérêt du prospect :** (Faible / Moyen / Fort) - Justifie avec une citation du texte.

## 🚩 Drapeaux Rouges (Risques)
* (Liste ici les hésitations, les moments où le prospect a reculé, ou les concurrents mentionnés).
* (Exemple : "Le prospect a dit 'Je dois voir avec ma direction', ce qui indique qu'il n'est pas décideur unique").

## 🟢 Feux Verts (Signaux d'achat)
* (Liste les moments où le prospect se projette).
* (Exemple : Questions sur l'implémentation, demande de prix, utilisation du futur "quand on aura l'outil").

## 💡 Recommandation Stratégique (Action suivante)
Donne 3 conseils concrets au commercial pour la prochaine étape afin de sécuriser le deal.
1.
2.
3.

## 📝 Résumé Exécutif (3 lignes max)
Synthèse ultra-courte de la réunion pour le CRM.`,
        },
      ],
    },
    {
      name: 'Droit & affaires juridiques',
      description: "Prompts pour l'analyse juridique : consultations, dépositions et négociations",
      color: '#8B5CF6', // violet
      icon: 'i-heroicons-scale',
      sector: 'legal',
      prompts: [
        {
          title: 'Analyse de consultation client',
          content: `Tu es un avocat senior spécialisé en droit des affaires avec 18 ans d'expérience. Analyse cette transcription complète d'une consultation client (premier RDV ou point d'étape) avec [nom du client ou "le client"] concernant [brève description du dossier : ex. création société, litige commercial, contrat...].

Produis un compte-rendu juridique structuré et professionnel au format suivant :

1. Synthèse factuelle en 4-5 phrases : situation exposée, enjeux principaux, objectifs du client
2. Faits clés & chronologie des événements relatés (timeline à puces chronologique avec dates si mentionnées)
3. Éléments juridiques identifiés (droits/obligations, risques potentiels, qualifications possibles : ex. rupture abusive, vice du consentement, clause abusive...)
4. Points à clarifier / documents à demander (liste à puces : pièces justificatives, contrats antérieurs, preuves, etc.)
5. Hypothèses juridiques principales et probabilité subjective (faible/moyenne/élevée) pour chaque
6. Stratégie recommandée à court terme (3-5 actions concrètes : mise en demeure, négociation amiable, assignation...)
7. Risques & points de vigilance (juridiques, financiers, réputationnels)
8. Estimation du temps et du coût potentiel du dossier (fourchette indicative)
9. Recommandation globale : Accepter le dossier / Accepter avec conditions / Refuser poliment

Sois précis, cite les passages clés entre guillemets, reste objectif et neutre, et adopte un ton formel et confidentiel.`,
        },
        {
          title: 'Analyse de déposition / audition',
          content: `Tu es un avocat plaideur expert en contentieux civil et commercial. Voici la transcription complète d'une déposition / audition [préciser si possible : témoin, partie adverse, expert...] dans le cadre du dossier [référence ou description brève].

Génère un rapport d'analyse deposition structuré exactement comme suit :

- Résumé global de la déposition (3-4 phrases : position de la personne, cohérence globale, impact sur le dossier)
- Faits nouveaux ou confirmés (liste à puces chronologique avec citations verbatim si déterminantes)
- Contradictions / incohérences avec les éléments précédents du dossier (liste + références si connues)
- Admissions / concessions faites par la personne (éléments utiles pour nous)
- Points faibles / vulnérabilités de la déposition (ex. hésitations, réponses évasives, manque de précision)
- Éléments exploitables pour la plaidoirie / négociation (arguments à développer, preuves à contrer)
- Score de crédibilité perçu sur 10 (avec justification)
- 5 questions de contre-interrogatoire ou de creusement à préparer pour la suite
- Recommandation stratégique : Utiliser pour appuyer notre thèse / Minimiser / Attaquer la crédibilité

Objectif : fournir un outil rapide pour préparer la suite du contentieux ou la négociation.`,
        },
        {
          title: 'Analyse de négociation / règlement amiable',
          content: `Tu es un avocat négociateur spécialisé en résolution amiable et transactions. Analyse cette transcription d'une réunion de négociation / point d'étape règlement amiable avec [adverse ou "la partie adverse"] dans le dossier [description].

Structure ton rapport comme ceci :

1. État des lieux au début de la réunion (positions respectives, dernière offre connue)
2. Concessions obtenues pendant la discussion (ce que l'adverse a lâché – liste avec valeur estimée)
3. Concessions proposées / accordées par nous (impact financier/juridique)
4. Signaux de closing forts (ex. accord de principe, demande de rédaction protocole, calendrier envisagé)
5. Points de blocage restants (classés par ordre de criticité)
6. Tactiques observées de l'adverse (ex. bluff, good cop/bad cop, pression temporelle...)
7. Probabilité de settlement dans les 30 jours (estimation % + facteurs clés)
8. Stratégie recommandée pour la suite (dernière contre-offre, deadline, recours au juge si échec, walk-away threshold)
9. Leçons pour les prochaines négociations similaires

Sois incisif, stratégique et orienté résultat : maximiser la valeur du deal tout en minimisant les risques.`,
        },
      ],
    },
    {
      name: 'Finance & Comptabilité',
      description: "Prompts pour l'analyse financière : patrimoine, budget et investissements",
      color: '#F59E0B', // amber
      icon: 'i-heroicons-banknotes',
      sector: 'finance',
      prompts: [
        {
          title: 'Analyse de consultation patrimoniale',
          content: `Tu es un expert-comptable et conseiller en gestion de patrimoine senior avec 20 ans d'expérience. Analyse cette transcription complète d'une consultation / entretien client avec [nom du client ou "le client"] concernant [ex. : bilan patrimonial, optimisation fiscale, investissement, succession...].

Produis un compte-rendu financier structuré et professionnel au format suivant :

1. Synthèse globale (4-5 phrases) : situation patrimoniale/fiscale actuelle + objectifs principaux exprimés
2. Éléments chiffrés clés extraits (revenus, charges, patrimoine net, impôts actuels, liquidités, dettes – liste à puces avec montants verbatim si mentionnés)
3. Risques financiers & fiscaux identifiés (ex. : exposition successorale, IRPP élevé, manque de diversification, non-conformité...)
4. Opportunités d'optimisation suggérées par le client ou détectées (liste à puces : PER, SCI, défiscalisation, réorganisation...)
5. Documents & informations complémentaires à demander (liste priorisée : derniers avis d'imposition, relevés bancaires, contrats d'assurance-vie...)
6. Hypothèses & scénarios possibles (3 max, avec impact estimé : ex. +15% de rendement via diversification)
7. Recommandations prioritaires (3-5 actions concrètes : rendez-vous notaire, simulation PER, renégociation crédit...)
8. Estimation du potentiel d'économies / gains (fourchette indicative en €)
9. Recommandation globale : Mission à lancer / Suivi léger / Pas d'action immédiate

Soit factuel, cite les chiffres et passages clés entre guillemets, reste neutre et conforme aux règles déontologiques.`,
        },
        {
          title: 'Analyse de revue budgétaire',
          content: `Tu es un Directeur Administratif et Financier (DAF) expert en pilotage budgétaire et contrôle de gestion. Voici la transcription d'un point budgétaire / revue mensuelle/trimestrielle avec [nom du manager ou "l'équipe"] pour [entité/projet : ex. département commercial, filiale...].

Génère un rapport d'analyse budgétaire structuré exactement comme suit :

- Résumé exécutif (3 phrases max : performance globale vs budget, écarts majeurs, tendance)
- Écarts significatifs (liste à puces : postes en dépassement ou sous-consommation, avec % et montant absolu + explication tirée de l'échange)
- KPI financiers clés discutés (CA, marge, trésorerie, encours clients, etc. – avec valeurs actuelles vs cible)
- Signaux d'alerte (risque de dérapage, retards paiement, surcoûts imprévus – niveau : faible / moyen / critique)
- Actions correctives évoquées ou à proposer (liste priorisée : réduction coûts, relance clients, réallocation budget...)
- Prévision de fin d'exercice / trimestre (estimation basée sur la discussion)
- Points à escalader à la direction (si nécessaire)
- Score de maîtrise budgétaire sur 10 (avec justification)

Objectif : fournir un outil rapide pour le DAF ou le contrôleur de gestion afin de piloter efficacement.`,
        },
        {
          title: "Analyse d'entretien d'investissement",
          content: `Tu es un conseiller en investissements financiers certifié AMF, expert en allocation d'actifs. Analyse cette transcription d'un entretien / point portefeuille avec [nom du client] concernant son portefeuille [type : actions, obligations, immobilier, crypto...].

Structure ton rapport comme ceci :

1. Profil de risque & objectifs rappelés (tolérance au risque, horizon, besoins de liquidité, rendement cible)
2. Composition actuelle du portefeuille (répartition % par classe d'actifs + montants si cités)
3. Performance perçue & commentaires du client (gains/pertes, satisfaction, frustrations)
4. Points de rééquilibrage suggérés (sous-pondérations, sur-expositions, diversification nécessaire)
5. Risques spécifiques identifiés (concentration sectorielle, volatilité, fiscalité à venir...)
6. Opportunités d'investissement discutées (nouveaux produits, arbitrages, entrée/sortie marchés)
7. Probabilité d'ajustement majeur dans les 6 mois (estimation % + raisons)
8. Recommandations d'allocation cible (ex. : 40% actions / 30% obligations / 20% immobilier / 10% alternatifs)
9. Prochaines étapes (simulation, proposition écrite, RDV de suivi)

Sois prudent, cite les éléments clés, et adopte un ton professionnel orienté long terme et prudence.`,
        },
      ],
    },
    {
      name: 'Psychologie et Thérapie',
      description: "Prompts pour l'analyse clinique : séances de thérapie et suivi patient",
      color: '#EC4899', // pink
      icon: 'i-heroicons-heart',
      sector: 'psychology',
      prompts: [
        {
          title: 'Note de session standard',
          content: `Tu es un psychologue clinicien senior avec 15 ans d'expérience en thérapie individuelle (approches intégratives : TCC, psychodynamique, humaniste). Analyse cette transcription complète d'une séance de thérapie avec [prénom du patient ou "le patient"] – séance numéro [X] sur [thématique principale si connue, ex. anxiété, trauma, estime de soi].

Produis un compte-rendu clinique structuré et professionnel au format suivant (style DAP : Data / Assessment / Plan) :

1. Data (faits observés) : résumé factuel des thèmes abordés, émotions exprimées, contenus verbaux/non-verbaux clés (liste à puces chronologique, citations verbatim entre guillemets pour éléments significatifs)
2. Émotions et état affectif dominant (liste : ex. anxiété élevée, tristesse, colère contenue, dissociation – avec intensité estimée et indices concrets)
3. Thèmes récurrents / patterns identifiés (ex. schéma d'abandon, évitement, perfectionnisme – lien avec historique si mentionné)
4. Assessment (évaluation clinique) : hypothèses sur le fonctionnement psychique actuel, niveau de distress, progrès ou régression depuis la séance précédente, éléments de risque (suicidaire, auto-agressif – si présents : niveau faible/moyen/élevé)
5. Interventions du thérapeute pendant la séance (écoute active, reformulation, confrontation douce, technique spécifique utilisée)
6. Plan pour la suite : objectifs de la prochaine séance (2-4 points), homework suggéré au patient, points à explorer plus profondément
7. Note globale de la séance sur 10 (engagement du patient + alliance thérapeutique perçue, avec justification courte)

Soit factuel, objectif, bienveillant, évite tout jugement moral. Respecte strictement la confidentialité et n'ajoute aucune interprétation non soutenue par la transcription.`,
        },
        {
          title: 'Focus émotions et patterns',
          content: `Tu es un thérapeute expert en suivi émotionnel et repérage de schémas. À partir de cette transcription de séance avec [prénom], produis un résumé focalisé sur l'évolution émotionnelle et les dynamiques internes.

Structure exacte :

- Résumé émotionnel de la séance (3-4 phrases : émotions principales traversées, intensité, évolution au fil de l'heure)
- Patterns / schémas activés (liste à puces : nom du schéma + déclencheur dans la séance + conséquence observée + citation si pertinente)
- Progrès observés depuis les dernières séances (ex. meilleure régulation émotionnelle, moins d'évitement, insight nouveau – ou stagnation/régression)
- Moments de rupture alliance ou transfert (si détectés : description neutre + impact)
- Éléments de résilience / ressources mobilisées par le patient
- Suggestions pour le thérapeute : techniques à privilégier prochainement (ex. grounding, travail sur le corps, exploration enfance)
- Niveau de risque suicidaire / auto-destructeur perçu (aucun / faible / à surveiller / élevé – justification)

Ton objectif : aider le thérapeute à suivre finement l'évolution sans réécrire toute la séance.`,
        },
        {
          title: 'Analyse de première séance / anamnèse',
          content: `Tu es un psychologue clinicien spécialisé dans l'accueil et l'évaluation initiale. Analyse cette transcription de première séance (anamnèse) avec [prénom].

Génère un rapport d'évaluation initiale structuré comme suit :

1. Motif de consultation et demande explicite (verbatim si possible)
2. Antécédents personnels et familiaux clés (chronologie synthétique : événements de vie majeurs, traumas, hospitalisations, traitements antérieurs)
3. Symptomatologie actuelle (liste DSM-like ou descriptive : anxiété, dépression, troubles du sommeil, addictions, etc. + intensité et fréquence)
4. Fonctionnement actuel (travail, relations, quotidien, isolement/socialisation)
5. Forces & ressources du patient (ce qui ressort de positif : soutien, hobbies, coping efficaces)
6. Hypothèses diagnostiques principales (différentielles, sans poser de diagnostic définitif)
7. Plan thérapeutique proposé ou à proposer (fréquence des séances, orientation : TCC, EMDR, analytique..., objectifs à 3-6 mois)
8. Éléments de vigilance immédiats (risque, urgence psychiatrique si besoin)
9. Impression clinique globale (alliance naissante : bonne/moyenne/difficile)

Reste prudent, factuel et déontologique : pas de diagnostic ferme en première séance.`,
        },
      ],
    },
    {
      name: 'Général',
      description: 'Prompts polyvalents pour tout type de conversation ou réunion',
      color: '#3B82F6', // blue
      icon: 'i-heroicons-document-text',
      sector: null,
      prompts: [
        {
          title: "Résumé général d'entretien (avancé)",
          content: `Tu es un assistant professionnel expert en synthèse de conversations. À partir de cette transcription complète d'un entretien / meeting / appel avec [prénom ou "la personne" ou "les participants"], produis un compte-rendu clair, concis et actionnable au format suivant :

1. Synthèse globale (3-5 phrases max) : objectif de l'entretien, points principaux discutés, ton général et issue/outcome perçu
2. Chronologie des sujets abordés (liste à puces chronologique : thème + éléments clés évoqués, avec citations verbatim entre guillemets pour les phrases les plus importantes)
3. Décisions prises ou accords (liste à puces : ce qui a été validé, engagements, next steps si mentionnés)
4. Points ouverts / à suivre (liste à puces : sujets non résolus, questions en suspens, tâches à clarifier)
5. Actions / tâches assignées (qui fait quoi, pour quand – si explicite dans la discussion ; sinon proposer des suggestions logiques basées sur le contenu)
6. Signaux émotionnels ou relationnels observés (ex. enthousiasme, frustration, hésitation, bonne entente – avec indices concrets et niveau : faible / moyen / fort)
7. Recommandations pour la suite (3 max : actions prioritaires, personnes à recontacter, documents à préparer, etc.)
8. Note globale de productivité de l'entretien sur 10 (avec justification courte : efficacité, clarté, avancement)

Soit factuel, objectif, professionnel et concis. Utilise un ton neutre et bienveillant. Cite les éléments clés entre guillemets quand ils apportent de la valeur.`,
        },
        {
          title: 'Résumé Exécutif (simple)',
          content: `Fais un résumé exécutif de cette conversation en 3-5 points clés. Mets en avant les décisions prises et les actions à suivre.`,
        },
      ],
    },
  ]

/**
 * Service to seed default prompts for an organization
 */
class DefaultPromptsService {
  /**
   * Seed default categories and prompts for an organization
   */
  async seedForOrganization(organizationId: number): Promise<void> {
    let sortOrder = 0

    for (const categoryData of DEFAULT_CATEGORIES) {
      // Create category
      const category = await PromptCategory.create({
        organizationId,
        name: categoryData.name,
        description: categoryData.description,
        color: categoryData.color,
        icon: categoryData.icon,
        isDefault: true,
        sortOrder: sortOrder++,
        businessSector: categoryData.sector,
      })

      // Create prompts for this category
      let promptSortOrder = 0
      for (const promptData of categoryData.prompts) {
        await Prompt.create({
          organizationId,
          categoryId: category.id,
          title: promptData.title,
          content: promptData.content,
          isDefault: true,
          isFavorite: false,
          usageCount: 0,
          sortOrder: promptSortOrder++,
        })
      }
    }
  }

  /**
   * Check if organization already has default prompts seeded
   */
  async hasDefaultPrompts(organizationId: number): Promise<boolean> {
    const count = await Prompt.query()
      .where('organizationId', organizationId)
      .where('isDefault', true)
      .count('id as total')
      .first()

    return (count?.$extras.total || 0) > 0
  }

  /**
   * Seed default prompts only if they don't exist
   */
  async seedIfNeeded(organizationId: number): Promise<boolean> {
    const hasPrompts = await this.hasDefaultPrompts(organizationId)
    if (!hasPrompts) {
      await this.seedForOrganization(organizationId)
      return true
    }
    return false
  }
}

export default new DefaultPromptsService()
