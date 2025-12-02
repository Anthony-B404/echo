/**
 * Custom error messages for VineJS validator
 */
import vine, { SimpleMessagesProvider } from '@vinejs/vine'
import i18nManager from '@adonisjs/i18n/services/main'

/**
 * Configure VineJS to use i18n translations for validation messages
 */
vine.messagesProvider = new SimpleMessagesProvider(
  {
    // Required field
    'required': 'validation.required',
    // Email validation
    'email': 'validation.email',
    // String validations
    'string.minLength': 'validation.minLength',
    'string.maxLength': 'validation.maxLength',
    // Number validation
    'number': 'validation.number',
    // Boolean validation
    'boolean': 'validation.boolean',
    // UUID validation
    'uuid': 'validation.uuid',
    // URL validation
    'url': 'validation.url',
    // Date validation
    'date': 'validation.date',
    // Enum validation
    'enum': 'validation.enum',
    // Database unique validation
    'database.unique': 'validation.database.unique',
    // Confirmed validation
    'confirmed': 'validation.confirmed',
  },
  (field, rule, options, data) => {
    /**
     * Get the i18n instance for the default locale (fr)
     * In a request context, you can use ctx.i18n instead
     */
    const i18n = i18nManager.locale(i18nManager.defaultLocale)

    /**
     * Get the translation key
     */
    const translationKey = data.messages?.[rule] || rule

    /**
     * Return the translated message with field and options
     */
    return i18n.t(translationKey, { field, ...options })
  }
)
