import { expect, it } from 'vitest';
import { detectLang, t } from './i18n';

it('follows the first supported browser language', () => {
	expect(detectLang(['fr-FR', 'en'])).toBe('fr');
	expect(detectLang(['en-GB', 'fr'])).toBe('en');
	expect(detectLang(['de-DE', 'fr'])).toBe('fr');
	expect(detectLang(['de'])).toBe('en');
	expect(t('dropOff', 'fr')).toBe('Déposer au labo');
});
