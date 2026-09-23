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
		readySoon: 'Your prints are ready. Collecting them arrives in the next version.',
		installTitle: 'Put Retroviseur on your Home Screen',
		installBody: 'On iPhone, your rolls are only kept safe once the app is installed. Tap Share, then “Add to Home Screen”, and open it from there.',
		installSkip: 'Continue in Safari anyway',
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
		readySoon: 'Vos tirages sont prêts. Leur récupération arrive dans la prochaine version.',
		installTitle: 'Ajoutez Retroviseur à l’écran d’accueil',
		installBody: 'Sur iPhone, vos pellicules ne sont en sécurité qu’une fois l’app installée. Touchez Partager, puis « Sur l’écran d’accueil », et ouvrez-la depuis là.',
		installSkip: 'Continuer dans Safari quand même',
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
