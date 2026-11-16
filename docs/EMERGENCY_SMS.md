# SMS aux contacts d’urgence

Le texte est généré par `backend/src/modules/safety/domain/emergency-sms.ts`
et transmis par le canal Textbee déjà configuré dans l’application.

Exemple de contenu (les valeurs entre crochets sont remplacées) :

```text
Mediane - Alerte pour [prénom et nom]

[Prénom] n'a pas répondu après une alerte de sécurité dans son véhicule (le [date] à [heure]).

Que faire : appelez [prénom] au [numéro international du conducteur].
Dernière position connue : https://maps.google.com/?q=[latitude],[longitude]

Vous recevez ce message car [prénom] vous a désigné(e) comme contact d'urgence.
```

- Pour un SOS manuel, le texte indique « [Prénom] a demandé de l’aide depuis son véhicule. »
  Cela couvre aussi un SOS qui fait escalader un incident déjà ouvert.
- Le numéro du conducteur vient de son profil et apparaît uniquement s’il est
  renseigné au format international. Il ne s’agit pas du numéro du destinataire.
- En l’absence de coordonnées valides, le SMS indique « Position non disponible. »
  La position est la dernière position signalée, pas un suivi GPS en direct.
- Si le motif exact n’est pas disponible, le texte indique simplement
  « Une alerte de sécurité concernant [prénom] a été déclenchée. »
- Le SMS ne contient ni diagnostic, ni mesures médicales, ni score de modèle.
- L’heure est affichée dans le fuseau de la Tunisie (`Africa/Tunis`).
- Le SMS ne contient pas de référence technique d’incident.
- Le contenu peut occuper plusieurs segments SMS selon la longueur et l’encodage.

Après une réponse du conducteur depuis l’application ou le boîtier, le suivi
indique que le conducteur a confirmé aller bien et donne l’heure de clôture.
Il n’annonce pas une sécurité médicalement confirmée.
Une clôture automatique n’est pas une réponse du conducteur ; le traitement actuel
ne programme pas de SMS de levée d’alerte pour ces clôtures.

Les SMS d’alerte partent à l’escalade de l’incident : immédiatement pour un SOS,
ou après expiration du délai de réponse pour une détection éligible. Les scénarios
REPLAY ne créent pas d’incidents d’urgence et ne déclenchent pas ces SMS.

L’envoi réel nécessite la configuration Textbee du serveur concerné. Les tests
emploient des canaux simulés ; ils n’envoient pas de SMS à de vrais contacts.
