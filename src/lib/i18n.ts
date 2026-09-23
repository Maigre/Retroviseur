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
		loadNew: 'Load a new roll'
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
		loadNew: 'Charger une pellicule'
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
