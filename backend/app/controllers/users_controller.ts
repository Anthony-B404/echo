import type { HttpContext } from '@adonisjs/core/http'
import User, { UserRole } from '#models/user'
import { registerValidator } from '#validators/user'
import mail from '@adonisjs/mail/services/main'
import { randomUUID } from 'node:crypto'
import Invitation from '#models/invitation'

export default class AuthController {
  public async register({ request, response }: HttpContext) {
    const payload = await request.validateUsing(registerValidator)
    const user = await User.create(payload)
    return response.created(user)
  }

  public async login({ request, response }: HttpContext) {
    const { email, password } = request.only(['email', 'password'])

    try {
      const user = await User.verifyCredentials(email, password)
      const token = await User.accessTokens.create(user)
      return response.ok({ user, token })
    } catch {
      return response.unauthorized('Invalid credentials')
    }
  }

  public async logout({ auth, response }: HttpContext) {
    const token = auth.user!.currentAccessToken
    await User.accessTokens.delete(auth.user!, token.identifier)
    return response.ok({ message: 'Logged out' })
  }

  public async me({ auth, response }: HttpContext) {
    const user = auth.user
    return response.ok(user)
  }

  public async checkToken({ response }: HttpContext) {
    return response.ok({ message: 'Token is valid' })
  }

  public async verifyEmail({ params, response }: HttpContext) {
    const { token } = params
    const user = await User.findBy('verification_token', token)
    if (!user) {
      return response.notFound({ message: 'User not found' })
    }
    user.verificationToken = null
    user.emailVerified = true
    await user.save()
    return response.ok({ user })
  }

  public async resendVerification({ auth, response }: HttpContext) {
    const user = await User.findBy('id', auth.user!.id)
    if (!user) {
      return response.notFound({ message: 'User not found' })
    }

    user.verificationToken = randomUUID()
    await user.save()

    try {
      await mail.send((message) => {
        message
          .to(user.email)
          .from('onboarding@resend.dev')
          .subject('Verifiez votre adresse email')
          .htmlView('emails/verify_email', {
            token: user.verificationToken,
          })
      })
    } catch (errors) {
      return response.status(422).json({
        message: "Erreur d'envoie de mail",
        errors: errors,
      })
    }

    return response.ok({ message: 'Verification email sent' })
  }

  public async checkEmailVerification({ auth, response }: HttpContext) {
    const user = await User.findBy('id', auth.user!.id)
    return response.ok({ emailVerified: user?.emailVerified })
  }

  public async deleteMember({ params, response }: HttpContext) {
    const { id } = params

    const user = await User.find(id)
    if (!user) {
      return response.notFound({ message: 'User not found' })
    }
    try {
      await user.delete()
      return response.ok({ message: 'Member deleted' })
    } catch (error) {
      return response.status(500).json({
        message: "Erreur lors de la suppression de l'utilisateur",
        errors: error.messages,
      })
    }
  }

}
