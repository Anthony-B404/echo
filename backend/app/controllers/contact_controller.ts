import type { HttpContext } from '@adonisjs/core/http'
import env from '#start/env'
import mail from '@adonisjs/mail/services/main'
import vine from '@vinejs/vine'

const contactValidator = vine.compile(
  vine.object({
    subject: vine.string().trim().minLength(5).maxLength(200),
    message: vine.string().trim().minLength(20).maxLength(5000),
  })
)

export default class ContactController {
  /**
   * Envoie un email de contact au support
   * L'utilisateur doit être authentifié
   */
  public async send({ request, response, auth, i18n }: HttpContext) {
    const user = auth.user

    if (!user) {
      return response.status(401).json({
        message: i18n.t('messages.auth.unauthorized'),
      })
    }

    const { subject, message } = await request.validateUsing(contactValidator)

    await mail.send((msg) => {
      msg
        .to('betteanthony73@gmail.com')
        .from(env.get('MAIL_FROM', 'Novika <noreply@dh-echo.com>'))
        .replyTo(user.email)
        .subject(i18n.t('emails.contact_support.subject', { subject }))
        .htmlView('emails/contact_support', {
          userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
          userEmail: user.email,
          subject,
          message,
          i18n,
          apiUrl: env.get('API_URL', 'https://api.novika.com'),
        })
    })

    return response.ok({
      message: i18n.t('messages.contact.sent'),
    })
  }
}
