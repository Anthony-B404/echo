import db from '@adonisjs/lucid/services/db'
import { DateTime } from 'luxon'
import i18nManager from '@adonisjs/i18n/services/main'
import Organization, { type CreditMode } from '#models/organization'
import User from '#models/user'
import UserCredit from '#models/user_credit'
import UserCreditTransaction, { UserCreditTransactionType } from '#models/user_credit_transaction'
import CreditTransaction, { CreditTransactionType } from '#models/credit_transaction'

export interface DistributeCreditsResult {
  transaction: UserCreditTransaction
  userBalance: number
  organizationCredits: number
}

export interface RecoverCreditsResult {
  transaction: UserCreditTransaction
  userBalance: number
  organizationCredits: number
}

export interface DeductForProcessingResult {
  transaction: UserCreditTransaction | null
  organizationTransaction: CreditTransaction | null
  source: 'user' | 'organization'
}

export interface AutoRefillResult {
  userId: number
  userName: string
  organizationId: number
  organizationName: string
  status: 'success' | 'skipped' | 'failed'
  creditsTransferred?: number
  reason?: string
}

export interface CleanupMemberCreditsResult {
  creditsRecovered: number
  hadAutoRefill: boolean
}

export interface InitializeNewMemberCreditsResult {
  creditsDistributed: number
  autoRefillEnabled: boolean
}

/**
 * Service for managing credit distribution and consumption.
 * Handles both shared pool and individual distribution modes.
 */
class CreditService {
  /**
   * Get a translated message for credit operations.
   * Uses 'en' as the default locale when no locale is specified.
   */
  private t(key: string, data?: Record<string, string | number>, locale?: string): string {
    const i18n = i18nManager.locale(locale || 'en')
    return i18n.t(`messages.credits.${key}`, data)
  }

  /**
   * Check if there are enough credits for audio processing
   * Respects the organization's credit mode
   */
  async hasEnoughCreditsForProcessing(
    user: User,
    organization: Organization,
    amount: number
  ): Promise<boolean> {
    if (organization.isSharedMode()) {
      return organization.hasEnoughCredits(amount)
    }

    // Individual mode: check user's allocated credits
    const userCredit = await this.getUserCredit(user.id, organization.id)
    if (!userCredit) {
      return false
    }
    return userCredit.hasEnoughCredits(amount)
  }

  /**
   * Get the effective balance for a user in an organization
   * Respects the organization's credit mode
   */
  async getEffectiveBalance(user: User, organization: Organization): Promise<number> {
    if (organization.isSharedMode()) {
      return organization.credits
    }

    // Individual mode: return user's allocated balance
    const userCredit = await this.getUserCredit(user.id, organization.id)
    return userCredit?.balance ?? 0
  }

  /**
   * Deduct credits for audio processing
   * Creates appropriate transaction records based on credit mode
   */
  async deductForAudioProcessing(
    user: User,
    organization: Organization,
    amount: number,
    description: string,
    audioId?: number
  ): Promise<DeductForProcessingResult> {
    if (organization.isSharedMode()) {
      // Shared mode: deduct from organization pool
      const orgTransaction = await organization.deductCredits(amount, description, user.id, audioId)
      return {
        transaction: null,
        organizationTransaction: orgTransaction,
        source: 'organization',
      }
    }

    // Individual mode: deduct from user's allocated credits
    const trx = await db.transaction()

    try {
      const userCredit = await UserCredit.query({ client: trx })
        .where('userId', user.id)
        .where('organizationId', organization.id)
        .forUpdate()
        .firstOrFail()

      if (!userCredit.hasEnoughCredits(amount)) {
        await trx.rollback()
        throw new Error('INSUFFICIENT_USER_CREDITS')
      }

      userCredit.balance -= amount
      await userCredit.useTransaction(trx).save()

      const transaction = await UserCreditTransaction.create(
        {
          userId: user.id,
          organizationId: organization.id,
          performedByUserId: user.id,
          amount: -amount,
          balanceAfter: userCredit.balance,
          type: UserCreditTransactionType.Usage,
          description,
          audioId: audioId || null,
        },
        { client: trx }
      )

      await trx.commit()

      return {
        transaction,
        organizationTransaction: null,
        source: 'user',
      }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Distribute credits from organization pool to a user
   * Only works in individual mode
   */
  async distributeToUser(
    organization: Organization,
    targetUserId: number,
    amount: number,
    performedByUserId: number,
    description?: string
  ): Promise<DistributeCreditsResult> {
    if (organization.isSharedMode()) {
      throw new Error('INVALID_MODE_FOR_DISTRIBUTION')
    }

    // Verify target user is a member of the organization
    const targetUser = await User.findOrFail(targetUserId)
    if (!(await targetUser.hasOrganization(organization.id))) {
      throw new Error('USER_NOT_IN_ORGANIZATION')
    }

    const trx = await db.transaction()

    try {
      // Lock organization for update
      const org = await Organization.query({ client: trx })
        .where('id', organization.id)
        .forUpdate()
        .firstOrFail()

      if (!org.hasEnoughCredits(amount)) {
        await trx.rollback()
        throw new Error('INSUFFICIENT_ORG_CREDITS')
      }

      // Get or create user credit record
      let userCredit = await UserCredit.query({ client: trx })
        .where('userId', targetUserId)
        .where('organizationId', organization.id)
        .forUpdate()
        .first()

      if (!userCredit) {
        userCredit = new UserCredit()
        userCredit.userId = targetUserId
        userCredit.organizationId = organization.id
        userCredit.balance = 0
        userCredit.creditCap = null
        userCredit.autoRefillEnabled = false
      }

      // Check credit cap
      if (!userCredit.canReceiveCredits(amount)) {
        await trx.rollback()
        throw new Error('CANNOT_EXCEED_CAP')
      }

      // Deduct from organization and add to user
      org.credits -= amount
      await org.useTransaction(trx).save()

      userCredit.balance += amount
      await userCredit.useTransaction(trx).save()

      // Create transaction record
      const transaction = await UserCreditTransaction.create(
        {
          userId: targetUserId,
          organizationId: organization.id,
          performedByUserId,
          amount,
          balanceAfter: userCredit.balance,
          type: UserCreditTransactionType.Distribution,
          description: description || null,
        },
        { client: trx }
      )

      // Also create an org-level transaction for audit trail
      await org.related('creditTransactions').create(
        {
          userId: performedByUserId,
          amount: -amount,
          balanceAfter: org.credits,
          type: CreditTransactionType.Usage,
          description: `Distribution to user #${targetUserId}${description ? `: ${description}` : ''}`,
        },
        { client: trx }
      )

      await trx.commit()

      return {
        transaction,
        userBalance: userCredit.balance,
        organizationCredits: org.credits,
      }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Recover credits from a user back to organization pool
   * Only works in individual mode, only Owner can do this
   */
  async recoverFromUser(
    organization: Organization,
    targetUserId: number,
    amount: number,
    performedByUserId: number,
    description?: string
  ): Promise<RecoverCreditsResult> {
    if (organization.isSharedMode()) {
      throw new Error('INVALID_MODE_FOR_RECOVERY')
    }

    const trx = await db.transaction()

    try {
      // Get user credit record
      const userCredit = await UserCredit.query({ client: trx })
        .where('userId', targetUserId)
        .where('organizationId', organization.id)
        .forUpdate()
        .first()

      if (!userCredit || !userCredit.hasEnoughCredits(amount)) {
        await trx.rollback()
        throw new Error('INSUFFICIENT_USER_CREDITS')
      }

      // Lock organization for update
      const org = await Organization.query({ client: trx })
        .where('id', organization.id)
        .forUpdate()
        .firstOrFail()

      // Deduct from user and add to organization
      userCredit.balance -= amount
      await userCredit.useTransaction(trx).save()

      org.credits += amount
      await org.useTransaction(trx).save()

      // Create user transaction record (negative amount for recovery)
      const transaction = await UserCreditTransaction.create(
        {
          userId: targetUserId,
          organizationId: organization.id,
          performedByUserId,
          amount: -amount,
          balanceAfter: userCredit.balance,
          type: UserCreditTransactionType.Recovery,
          description: description || null,
        },
        { client: trx }
      )

      // Also create an org-level transaction for audit trail
      await org.related('creditTransactions').create(
        {
          userId: performedByUserId,
          amount,
          balanceAfter: org.credits,
          type: CreditTransactionType.Refund,
          description: `Recovery from user #${targetUserId}${description ? `: ${description}` : ''}`,
        },
        { client: trx }
      )

      await trx.commit()

      return {
        transaction,
        userBalance: userCredit.balance,
        organizationCredits: org.credits,
      }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Switch organization credit mode
   * When switching to shared: recovers all user credits back to pool AND deletes all user_credit records
   * When switching to individual: no automatic distribution
   */
  async switchCreditMode(
    organization: Organization,
    newMode: CreditMode,
    performedByUserId: number
  ): Promise<{ previousMode: CreditMode; recoveredCredits: number }> {
    if (organization.creditMode === newMode) {
      return { previousMode: newMode, recoveredCredits: 0 }
    }

    const previousMode = organization.creditMode
    let recoveredCredits = 0

    const trx = await db.transaction()

    try {
      // Lock organization for update
      const org = await Organization.query({ client: trx })
        .where('id', organization.id)
        .forUpdate()
        .firstOrFail()

      // If switching from individual to shared, recover all user credits and delete records
      if (previousMode === 'individual' && newMode === 'shared') {
        const userCredits = await UserCredit.query({ client: trx })
          .where('organizationId', organization.id)
          .forUpdate()

        for (const userCredit of userCredits) {
          if (userCredit.balance > 0) {
            recoveredCredits += userCredit.balance

            // Create recovery transaction
            await UserCreditTransaction.create(
              {
                userId: userCredit.userId,
                organizationId: organization.id,
                performedByUserId,
                amount: -userCredit.balance,
                balanceAfter: 0,
                type: UserCreditTransactionType.Recovery,
                description: 'Credits recovered during mode switch to shared',
              },
              { client: trx }
            )
          }

          // Delete the user credit record (removes auto-refill configuration as well)
          await userCredit.useTransaction(trx).delete()
        }

        // Add recovered credits back to organization pool
        if (recoveredCredits > 0) {
          org.credits += recoveredCredits
        }

        // Also disable global auto-refill
        org.autoRefillEnabled = false
      }

      // Update the mode
      org.creditMode = newMode
      await org.useTransaction(trx).save()

      await trx.commit()

      // Update the organization object in memory
      organization.creditMode = newMode
      organization.credits = org.credits
      organization.autoRefillEnabled = org.autoRefillEnabled

      return { previousMode, recoveredCredits }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Enable global auto-refill for an organization.
   * - Stores the default amount and day in the organization (source of truth for new members)
   * - Creates or updates user_credit records for ALL existing members with the specified settings
   * - Distributes initial credits to members who don't have enough (up to target amount)
   */
  async enableGlobalAutoRefill(
    organizationId: number,
    amount: number,
    day: number,
    performedByUserId: number
  ): Promise<{ usersUpdated: number; creditsDistributed: number }> {
    const trx = await db.transaction()

    try {
      // Lock organization for update
      const org = await Organization.query({ client: trx })
        .where('id', organizationId)
        .preload('users')
        .forUpdate()
        .firstOrFail()

      // Verify organization is in individual mode
      if (org.isSharedMode()) {
        await trx.rollback()
        throw new Error('INVALID_MODE_FOR_AUTO_REFILL')
      }

      let usersUpdated = 0
      let totalCreditsDistributed = 0

      // Process each member
      for (const user of org.users) {
        // Get or create user credit record
        let userCredit = await UserCredit.query({ client: trx })
          .where('userId', user.id)
          .where('organizationId', organizationId)
          .forUpdate()
          .first()

        if (userCredit) {
          // Update existing record with auto-refill settings
          userCredit.autoRefillEnabled = true
          userCredit.autoRefillAmount = amount
          userCredit.autoRefillDay = day
          await userCredit.useTransaction(trx).save()
        } else {
          // Create new record
          userCredit = await UserCredit.create(
            {
              userId: user.id,
              organizationId,
              balance: 0,
              creditCap: null,
              autoRefillEnabled: true,
              autoRefillAmount: amount,
              autoRefillDay: day,
            },
            { client: trx }
          )
        }

        // Distribute initial credits if user doesn't have enough (amount is TARGET, not amount to add)
        const creditsNeeded = Math.max(0, amount - userCredit.balance)

        // Respect credit cap if set
        const maxReceivable =
          userCredit.creditCap !== null
            ? Math.max(0, userCredit.creditCap - userCredit.balance)
            : creditsNeeded

        const creditsToTransfer = Math.min(creditsNeeded, maxReceivable)

        if (creditsToTransfer > 0 && org.hasEnoughCredits(creditsToTransfer)) {
          // Deduct from organization
          org.credits -= creditsToTransfer
          await org.useTransaction(trx).save()

          // Add to user
          userCredit.balance += creditsToTransfer
          await userCredit.useTransaction(trx).save()

          // Create user transaction
          await UserCreditTransaction.create(
            {
              userId: user.id,
              organizationId,
              performedByUserId,
              amount: creditsToTransfer,
              balanceAfter: userCredit.balance,
              type: UserCreditTransactionType.Distribution,
              description: this.t('initial_distribution_auto_refill_activation'),
            },
            { client: trx }
          )

          // Create org transaction for audit trail
          await CreditTransaction.create(
            {
              userId: performedByUserId,
              organizationId,
              amount: -creditsToTransfer,
              balanceAfter: org.credits,
              type: CreditTransactionType.Usage,
              description: this.t('initial_distribution_to_user', {
                name: user.fullName || user.email,
              }),
            },
            { client: trx }
          )

          totalCreditsDistributed += creditsToTransfer
        }

        usersUpdated++
      }

      // Update organization with global settings (source of truth for new members)
      org.autoRefillEnabled = true
      org.autoRefillDefaultAmount = amount
      org.autoRefillDefaultDay = day
      await org.useTransaction(trx).save()

      await trx.commit()

      return { usersUpdated, creditsDistributed: totalCreditsDistributed }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Disable global auto-refill for an organization.
   * - Sets autoRefillEnabled=false on the organization and clears default settings
   * - Sets autoRefillEnabled=false on ALL user_credit records but preserves balances
   */
  async disableGlobalAutoRefill(organizationId: number): Promise<{ usersUpdated: number }> {
    const trx = await db.transaction()

    try {
      // Lock organization for update
      const org = await Organization.query({ client: trx })
        .where('id', organizationId)
        .forUpdate()
        .firstOrFail()

      // Update all user credit records - disable auto-refill but keep balances
      const result = await UserCredit.query({ client: trx })
        .where('organizationId', organizationId)
        .update({
          autoRefillEnabled: false,
        })

      // Update organization - disable and clear default settings
      org.autoRefillEnabled = false
      org.autoRefillDefaultAmount = null
      org.autoRefillDefaultDay = null
      await org.useTransaction(trx).save()

      await trx.commit()

      return { usersUpdated: result[0] || 0 }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Get global auto-refill settings for an organization.
   * Returns the settings directly from the organization (source of truth).
   */
  async getGlobalAutoRefillSettings(organizationId: number): Promise<{
    enabled: boolean
    defaultAmount: number | null
    defaultDay: number | null
  }> {
    const org = await Organization.find(organizationId)
    if (!org) {
      return { enabled: false, defaultAmount: null, defaultDay: null }
    }

    return {
      enabled: org.autoRefillEnabled,
      defaultAmount: org.autoRefillDefaultAmount,
      defaultDay: org.autoRefillDefaultDay,
    }
  }

  /**
   * Get user credit record for a user in an organization
   */
  async getUserCredit(userId: number, organizationId: number): Promise<UserCredit | null> {
    return UserCredit.query()
      .where('userId', userId)
      .where('organizationId', organizationId)
      .first()
  }

  /**
   * Get or create user credit record
   */
  async getOrCreateUserCredit(userId: number, organizationId: number): Promise<UserCredit> {
    let userCredit = await this.getUserCredit(userId, organizationId)

    if (!userCredit) {
      userCredit = await UserCredit.create({
        userId,
        organizationId,
        balance: 0,
        creditCap: null,
        autoRefillEnabled: false,
      })
    }

    return userCredit
  }

  /**
   * Configure auto-refill settings for a user's credit allocation
   */
  async configureAutoRefill(
    userCreditId: number,
    enabled: boolean,
    amount?: number,
    day?: number
  ): Promise<UserCredit> {
    const userCredit = await UserCredit.findOrFail(userCreditId)

    userCredit.autoRefillEnabled = enabled
    if (enabled) {
      userCredit.autoRefillAmount = amount || null
      userCredit.autoRefillDay = day || null
    } else {
      userCredit.autoRefillAmount = null
      userCredit.autoRefillDay = null
    }

    await userCredit.save()
    return userCredit
  }

  /**
   * Set credit cap for a user
   */
  async setCreditCap(userCreditId: number, cap: number | null): Promise<UserCredit> {
    const userCredit = await UserCredit.findOrFail(userCreditId)
    userCredit.creditCap = cap
    await userCredit.save()
    return userCredit
  }

  /**
   * List all organization members with their credit info
   */
  async listMemberCredits(organizationId: number) {
    // Get all members of the organization
    const organization = await Organization.query()
      .where('id', organizationId)
      .preload('users', (query) => {
        query.select('id', 'full_name', 'first_name', 'last_name', 'email', 'avatar')
        query.pivotColumns(['role'])
      })
      .firstOrFail()

    // Get existing user credits for this organization
    const userCredits = await UserCredit.query().where('organizationId', organizationId)

    const userCreditsMap = new Map(userCredits.map((uc) => [uc.userId, uc]))

    // Combine members with their credit info
    return organization.users.map((user) => {
      const userCredit = userCreditsMap.get(user.id)
      return {
        userId: user.id,
        user: {
          id: user.id,
          fullName: user.fullName,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          avatar: user.avatar,
        },
        role: user.$extras.pivot_role,
        balance: userCredit?.balance ?? 0,
        creditCap: userCredit?.creditCap ?? null,
        autoRefillEnabled: userCredit?.autoRefillEnabled ?? false,
        autoRefillAmount: userCredit?.autoRefillAmount ?? null,
        autoRefillDay: userCredit?.autoRefillDay ?? null,
        hasUserCredit: !!userCredit,
      }
    })
  }

  /**
   * Get user credit transaction history
   */
  async getUserCreditHistory(
    userId: number,
    organizationId: number,
    page: number = 1,
    limit: number = 20
  ) {
    return UserCreditTransaction.query()
      .where('userId', userId)
      .where('organizationId', organizationId)
      .preload('performedBy', (query) => {
        query.select('id', 'fullName', 'firstName', 'lastName', 'email')
      })
      .preload('audio', (query) => {
        query.select('id', 'title', 'fileName')
      })
      .orderBy('createdAt', 'desc')
      .paginate(page, limit)
  }

  /**
   * Process auto-refill for a single user credit record.
   * Called by the subscription renewal scheduler.
   *
   * Key behavior (aligned with organization renewals):
   * - autoRefillAmount is a TARGET balance, not a fixed amount to add
   * - Credits transferred = max(0, target - current_balance)
   * - Idempotent: lastRefillAt prevents double execution on same day
   */
  async processAutoRefill(userCredit: UserCredit): Promise<AutoRefillResult> {
    // 1. Preload user and organization if not already loaded
    if (!userCredit.user) {
      await userCredit.load('user')
    }
    if (!userCredit.organization) {
      await userCredit.load('organization')
    }

    const user = userCredit.user
    const organization = userCredit.organization

    // 2. Skip if organization is not in individual mode
    if (organization.isSharedMode()) {
      return {
        userId: userCredit.userId,
        userName: user.fullName || user.email,
        organizationId: organization.id,
        organizationName: organization.name,
        status: 'skipped',
        reason: 'Organization is in shared mode',
      }
    }

    // 3. Check idempotence - already refilled today?
    const today = DateTime.now().startOf('day')
    if (userCredit.lastRefillAt && userCredit.lastRefillAt >= today) {
      return {
        userId: userCredit.userId,
        userName: user.fullName || user.email,
        organizationId: organization.id,
        organizationName: organization.name,
        status: 'skipped',
        reason: 'Already refilled today',
        creditsTransferred: 0,
      }
    }

    // 4. Calculate amount as DIFFERENCE to reach target (like org renewals)
    // autoRefillAmount is the TARGET, not the amount to add
    let amountToTransfer = userCredit.getCreditsNeededForRefill()

    // Still respect creditCap as upper limit
    if (userCredit.creditCap !== null) {
      const maxReceivable = Math.max(0, userCredit.creditCap - userCredit.balance)
      amountToTransfer = Math.min(amountToTransfer, maxReceivable)
    }

    // 5. Skip if no credits needed (already at or above target)
    if (amountToTransfer <= 0) {
      // Update lastRefillAt even when skipping (like org updates nextRenewalAt)
      userCredit.lastRefillAt = DateTime.now()
      await userCredit.save()

      return {
        userId: userCredit.userId,
        userName: user.fullName || user.email,
        organizationId: organization.id,
        organizationName: organization.name,
        status: 'skipped',
        reason: 'Credits already at target',
        creditsTransferred: 0,
      }
    }

    // 6. Check organization has enough credits
    if (!organization.hasEnoughCredits(amountToTransfer)) {
      return {
        userId: userCredit.userId,
        userName: user.fullName || user.email,
        organizationId: organization.id,
        organizationName: organization.name,
        status: 'failed',
        reason: `Insufficient org credits. Need: ${amountToTransfer}, Available: ${organization.credits}`,
      }
    }

    // 7. Perform atomic transfer
    const trx = await db.transaction()

    try {
      // Lock records
      const lockedOrg = await Organization.query({ client: trx })
        .where('id', organization.id)
        .forUpdate()
        .firstOrFail()

      const lockedUserCredit = await UserCredit.query({ client: trx })
        .where('id', userCredit.id)
        .forUpdate()
        .firstOrFail()

      // Deduct from organization
      lockedOrg.credits -= amountToTransfer
      await lockedOrg.useTransaction(trx).save()

      // Add to user and update lastRefillAt
      lockedUserCredit.balance += amountToTransfer
      lockedUserCredit.lastRefillAt = DateTime.now()
      await lockedUserCredit.useTransaction(trx).save()

      // Create user transaction
      await UserCreditTransaction.create(
        {
          userId: userCredit.userId,
          organizationId: organization.id,
          performedByUserId: null, // System action
          amount: amountToTransfer,
          balanceAfter: lockedUserCredit.balance,
          type: UserCreditTransactionType.Refill,
          description: this.t('monthly_auto_refill'),
        },
        { client: trx }
      )

      // Create org transaction for audit trail
      await CreditTransaction.create(
        {
          userId: null, // System action
          organizationId: organization.id,
          amount: -amountToTransfer,
          balanceAfter: lockedOrg.credits,
          type: CreditTransactionType.Usage,
          description: this.t('auto_refill_for_user', { name: user.fullName || user.email }),
        },
        { client: trx }
      )

      await trx.commit()

      return {
        userId: userCredit.userId,
        userName: user.fullName || user.email,
        organizationId: organization.id,
        organizationName: organization.name,
        status: 'success',
        creditsTransferred: amountToTransfer,
      }
    } catch (error) {
      await trx.rollback()
      return {
        userId: userCredit.userId,
        userName: user.fullName || user.email,
        organizationId: organization.id,
        organizationName: organization.name,
        status: 'failed',
        reason: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Clean up member credits when removing a user from an organization.
   * - Recovers any remaining credits back to the organization pool
   * - Deletes the UserCredit record (including auto-refill configuration)
   * - Creates transaction records for audit trail
   *
   * This should be called when:
   * - A member is deleted from an organization
   * - A user is removed from an organization by a reseller
   */
  async cleanupMemberCredits(
    userId: number,
    organizationId: number,
    performedByUserId: number | null
  ): Promise<CleanupMemberCreditsResult> {
    const trx = await db.transaction()

    try {
      // Get user credit record if it exists
      const userCredit = await UserCredit.query({ client: trx })
        .where('userId', userId)
        .where('organizationId', organizationId)
        .forUpdate()
        .first()

      // If no credit record exists, nothing to clean up
      if (!userCredit) {
        await trx.commit()
        return {
          creditsRecovered: 0,
          hadAutoRefill: false,
        }
      }

      const creditsToRecover = userCredit.balance
      const hadAutoRefill = userCredit.autoRefillEnabled

      // If user has credits, recover them to the organization pool
      if (creditsToRecover > 0) {
        // Lock organization for update
        const organization = await Organization.query({ client: trx })
          .where('id', organizationId)
          .forUpdate()
          .firstOrFail()

        // Add credits back to organization pool
        organization.credits += creditsToRecover
        await organization.useTransaction(trx).save()

        // Create user transaction record (negative amount for recovery)
        await UserCreditTransaction.create(
          {
            userId,
            organizationId,
            performedByUserId,
            amount: -creditsToRecover,
            balanceAfter: 0,
            type: UserCreditTransactionType.Recovery,
            description: this.t('member_deletion_recovery'),
          },
          { client: trx }
        )

        // Create org-level transaction for audit trail
        await CreditTransaction.create(
          {
            userId: performedByUserId,
            organizationId,
            amount: creditsToRecover,
            balanceAfter: organization.credits,
            type: CreditTransactionType.Refund,
            description: this.t('member_deletion_recovery_org_detail', {
              userId: userId.toString(),
            }),
          },
          { client: trx }
        )
      }

      // Delete the UserCredit record (this also removes auto-refill configuration)
      await userCredit.useTransaction(trx).delete()

      await trx.commit()

      return {
        creditsRecovered: creditsToRecover,
        hadAutoRefill,
      }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Initialize credits for a new member when they join an organization.
   * Only applies when the organization has global auto-refill active.
   *
   * This method should be called when:
   * - A user accepts an invitation (new or existing user)
   * - A reseller creates a user in an organization
   *
   * The method is idempotent - if user_credit already exists, it does nothing.
   *
   * @returns null if no initialization needed, or result with credits distributed
   */
  async initializeNewMemberCredits(
    userId: number,
    organizationId: number,
    performedByUserId: number | null
  ): Promise<InitializeNewMemberCreditsResult | null> {
    const trx = await db.transaction()

    try {
      // Load organization
      const org = await Organization.query({ client: trx })
        .where('id', organizationId)
        .forUpdate()
        .firstOrFail()

      // Skip if organization is in shared mode or global auto-refill is not active
      if (!org.isGlobalAutoRefillActive) {
        await trx.commit()
        return null
      }

      // Check if user_credit already exists (idempotent check)
      const existingCredit = await UserCredit.query({ client: trx })
        .where('userId', userId)
        .where('organizationId', organizationId)
        .first()

      if (existingCredit) {
        // Already initialized, nothing to do
        await trx.commit()
        return null
      }

      // Get the target amount from organization settings
      const targetAmount = org.autoRefillDefaultAmount!
      const refillDay = org.autoRefillDefaultDay!

      // Calculate how much to distribute (target is the balance we want to reach)
      const creditsToDistribute = targetAmount

      // Check if organization has enough credits
      const actualDistribution = org.hasEnoughCredits(creditsToDistribute) ? creditsToDistribute : 0

      // Deduct from organization if we're distributing
      if (actualDistribution > 0) {
        org.credits -= actualDistribution
        await org.useTransaction(trx).save()
      }

      // Create user_credit record with auto-refill enabled
      const userCredit = await UserCredit.create(
        {
          userId,
          organizationId,
          balance: actualDistribution,
          creditCap: null,
          autoRefillEnabled: true,
          autoRefillAmount: targetAmount,
          autoRefillDay: refillDay,
        },
        { client: trx }
      )

      // Create transaction records if credits were distributed
      if (actualDistribution > 0) {
        // Load user for display name
        const user = await User.find(userId)
        const userName = user?.fullName || user?.email || `User #${userId}`

        // User credit transaction
        await UserCreditTransaction.create(
          {
            userId,
            organizationId,
            performedByUserId,
            amount: actualDistribution,
            balanceAfter: userCredit.balance,
            type: UserCreditTransactionType.Distribution,
            description: this.t('initial_credits_new_member'),
          },
          { client: trx }
        )

        // Organization transaction for audit trail
        await CreditTransaction.create(
          {
            userId: performedByUserId,
            organizationId,
            amount: -actualDistribution,
            balanceAfter: org.credits,
            type: CreditTransactionType.Usage,
            description: this.t('initial_distribution_to_user', { name: userName }),
          },
          { client: trx }
        )
      }

      await trx.commit()

      return {
        creditsDistributed: actualDistribution,
        autoRefillEnabled: true,
      }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }
}

export default new CreditService()
