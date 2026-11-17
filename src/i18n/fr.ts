import type { Copy } from './copy';

export const fr: Copy = {
  htmlLang: 'fr',
  path: '/fr/signup',
  redirectPath: '/getaquote/fr',
  title: 'nesto | Enregistrement',
  heading: 'Créez un compte nesto',
  labels: {
    firstName: 'Prénom',
    lastName: 'Nom',
    phone: 'Téléphone',
    province: "Province de l'achat",
    email: 'Courriel',
    password: 'Mot de passe',
    passwordConfirmation: 'Confirmation du mot de passe',
  },
  consentStart: 'En cochant cette case, vous acceptez d’être contacté par les partenaires de nesto',
  submit: 'Créez votre compte',
  passwordHint: /12.*32.*majuscule.*minuscule.*chiffre/i,
  languageToggle: 'EN',
  otherLanguageName: 'Anglais',
  errors: {
    required: 'Ce champ est obligatoire.',
    invalidName: 'Nom invalide',
    invalidEmail: 'Courriel invalide',
    invalidPhone: 'Valeur invalide.',
    passwordMin: 'Minimum de 12 lettres requises',
    passwordMax: 'Maximum de 32 lettres requises',
    passwordComposition:
      'Le mot de passe doit contenir au moins une lettre majuscule, une lettre minuscule et un chiffre',
    passwordMismatch: 'Les mots de passe ne correspondent pas',
  },
  backendError:
    "Quelque chose n'a pas fonctionné! Veuillez réessayer et si vous avez toujours des problèmes, n'hésitez pas à contacter votre conseiller",
};
