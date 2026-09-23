/**
 * FR + EN from day one. The camera has almost no words; keep it that way.
 * Language follows the browser, no picker.
 */
const dict = {
	en: {
		framesLeft: 'frames left',
		wind: 'Wind the film',
		flash: 'Flash',
		rollFull: 'Roll finished',
		dropOff: 'Take it to the lab',
		developing: 'Developing…',
		ready: 'Your prints are ready',
		collect: 'Collect the roll',
		loadNew: 'Load a new roll',
		shutter: 'Shutter',
		atLab: 'One roll is at the lab.',
		labBusy: 'The lab still has your previous roll — this one waits in the camera.',
		installTitle: 'Put Retroviseur on your Home Screen',
		installBodyIOS: 'On iPhone, your rolls are only kept safe once the app is installed. Tap Share, then “Add to Home Screen”, and open it from there.',
		installBodyAndroid: 'Install the app so your rolls are kept safe and it opens like a camera.',
		installBodyAndroidManual: 'Open the browser menu (⋮), choose “Add to Home screen” or “Install app”, then open it from there.',
		installButton: 'Install',
		installedOpen: 'Installed — open Retroviseur from your Home Screen.',
		installSkip: 'Continue in the browser anyway',
		collectOpen: 'Your prints are ready — collect them',
		collectNote: 'The roll comes back as a .zip archive. Once you have saved it, it leaves the phone for good.',
		collectSave: 'Save the roll',
		collectDone: 'I saved it — clear it from the phone',
		collectAgain: 'Save it again',
		close: 'Close',
		share: 'Share',
		shareText: 'A disposable film camera for your phone: 27 shots, no preview, develop to discover.',
		linkCopied: 'Link copied.',
		about: 'About',
		aboutBody: 'Retroviseur is a disposable film camera for your phone. 27 frames, no preview, no delete. Wind the wheel, shoot, and when the roll is full, take it to the lab. A few days later your prints are ready: you get the whole roll as an archive, and it leaves the phone.',
		aboutHow: 'Hold the phone sideways, header on the left. Roll the wheel to the left until it locks, then press the shutter.',
		aboutCredits: 'Free software (AGPL-3.0).',
		cameraDenied: 'Camera access was refused. Allow it in your browser settings, then try again.',
		cameraUnavailable: 'No camera could be opened on this device.',
		cameraInsecure: 'The camera needs a secure (https) page.',
		retry: 'Try again',
		captureFailed: 'That frame did not take — the film was not advanced.'
	},
	fr: {
		framesLeft: 'poses restantes',
		wind: 'Armez la pellicule',
		flash: 'Flash',
		rollFull: 'Pellicule terminée',
		dropOff: 'Déposer au labo',
		developing: 'En développement…',
		ready: 'Vos tirages sont prêts',
		collect: 'Récupérer la pellicule',
		loadNew: 'Charger une pellicule',
		shutter: 'Déclencheur',
		atLab: 'Une pellicule est au labo.',
		labBusy: 'Le labo a encore votre pellicule précédente — celle-ci attend dans l’appareil.',
		installTitle: 'Ajoutez Retroviseur à l’écran d’accueil',
		installBodyIOS: 'Sur iPhone, vos pellicules ne sont en sécurité qu’une fois l’app installée. Touchez Partager, puis « Sur l’écran d’accueil », et ouvrez-la depuis là.',
		installBodyAndroid: 'Installez l’app pour garder vos pellicules en sécurité et l’ouvrir comme un appareil photo.',
		installBodyAndroidManual: 'Ouvrez le menu du navigateur (⋮), choisissez « Ajouter à l’écran d’accueil » ou « Installer l’application », puis ouvrez-la depuis là.',
		installButton: 'Installer',
		installedOpen: 'Installée — ouvrez Retroviseur depuis l’écran d’accueil.',
		installSkip: 'Continuer dans le navigateur quand même',
		collectOpen: 'Vos tirages sont prêts — récupérez-les',
		collectNote: 'La pellicule revient sous forme d’archive .zip. Une fois enregistrée, elle quitte le téléphone pour de bon.',
		collectSave: 'Enregistrer la pellicule',
		collectDone: 'C’est enregistré — l’effacer du téléphone',
		collectAgain: 'L’enregistrer à nouveau',
		close: 'Fermer',
		share: 'Partager',
		shareText: 'Un appareil photo jetable pour votre téléphone : 27 poses, pas d’aperçu, on découvre au développement.',
		linkCopied: 'Lien copié.',
		about: 'À propos',
		aboutBody: 'Retroviseur est un appareil photo jetable pour votre téléphone. 27 poses, pas d’aperçu, pas d’effacement. Armez la molette, déclenchez, et quand la pellicule est pleine, déposez-la au labo. Quelques jours plus tard, vos tirages sont prêts : vous récupérez toute la pellicule en archive, et elle quitte le téléphone.',
		aboutHow: 'Tenez le téléphone à l’horizontale, bandeau à gauche. Faites rouler la molette vers la gauche jusqu’au blocage, puis appuyez sur le déclencheur.',
		aboutCredits: 'Logiciel libre (AGPL-3.0).',
		cameraDenied: 'L’accès à la caméra a été refusé. Autorisez-le dans les réglages du navigateur, puis réessayez.',
		cameraUnavailable: 'Aucune caméra n’a pu être ouverte sur cet appareil.',
		cameraInsecure: 'La caméra nécessite une page sécurisée (https).',
		retry: 'Réessayer',
		captureFailed: 'Cette photo n’a pas pris — la pellicule n’a pas avancé.'
	}
} as const;

export type Lang = keyof typeof dict;
export type MessageKey = keyof (typeof dict)['en'];

export function detectLang(languages: readonly string[] = globalThis.navigator?.languages ?? []): Lang {
	for (const l of languages) {
		const base = l.toLowerCase().slice(0, 2);
		if (base === 'fr' || base === 'en') return base;
	}
	return 'en';
}

export function t(key: MessageKey, lang: Lang = detectLang()): string {
	return dict[lang][key];
}
