import db from '@adonisjs/lucid/services/db'
import CreditRequest, { CreditRequestStatus, CreditRequestType } from '#models/credit_request'
import User from '#models/user'
import Organization from '#models/organization'
import Reseller from '#models/reseller'
import CreditService from '#services/credit_service'
import { DateTime } from 'luxon'
import { CreditTransactionType } from '#models/credit_transaction'

export interface CreateRequestResult {
  request: CreditRequest
}

export interface ProcessRequestResult {
  request: CreditRequest
  creditsDistributed?: number
}

export default class CreditRequestService {
  /**
   * Check if user has a pending request of a given type
   */
  async hasPendingRequest(
    userId: number,
    organizationId: number,
    type: CreditRequestType
  ): Promise<boolean> {
    const pendingRequest = await CreditRequest.query()
      .where('requesterId', userId)
      .where('organizationId', organizationId)
      .where('type', type)
      .where('status', CreditRequestStatus.Pending)
      .first()

    return !!pendingRequest
  }

  /**
   * Create a member-to-owner credit request
   */
  async createMemberRequest(
    user: User,
    organization: Organization,
    amount: number,
    justification?: string
  ): Promise<CreateRequestResult> {
    // Check organization is in individual mode
    if (organization.isSharedMode()) {
      throw new Error('INVALID_MODE_FOR_REQUEST')
    }

    // Check no pending request exists
    if (await this.hasPendingRequest(user.id, organization.id, CreditRequestType.MemberToOwner)) {
      throw new Error('PENDING_REQUEST_EXISTS')
    }

    const request = await CreditRequest.create({
      type: CreditRequestType.MemberToOwner,
      requesterId: user.id,
      organizationId: organization.id,
      resellerId: null,
      amount,
      justification: justification || null,
      status: CreditRequestStatus.Pending,
    })

    return { request }
  }

  /**
   * Create an owner-to-reseller credit request
   */
  async createOwnerRequest(
    user: User,
    organization: Organization,
    amount: number,
    justification?: string
  ): Promise<CreateRequestResult> {
    // Verify organization has a reseller
    if (!organization.resellerId) {
      throw new Error('NO_RESELLER_ASSIGNED')
    }

    // Check no pending request exists
    if (await this.hasPendingRequest(user.id, organization.id, CreditRequestType.OwnerToReseller)) {
      throw new Error('PENDING_REQUEST_EXISTS')
    }

    const request = await CreditRequest.create({
      type: CreditRequestType.OwnerToReseller,
      requesterId: user.id,
      organizationId: organization.id,
      resellerId: organization.resellerId,
      amount,
      justification: justification || null,
      status: CreditRequestStatus.Pending,
    })

    return { request }
  }

  /**
   * Approve a member-to-owner request
   * Distributes credits from org pool to user (if individual mode)
   */
  async approveMemberRequest(
    request: CreditRequest,
    approver: User
  ): Promise<ProcessRequestResult> {
    if (request.type !== CreditRequestType.MemberToOwner) {
      throw new Error('INVALID_REQUEST_TYPE')
    }

    if (!request.isPending()) {
      throw new Error('REQUEST_ALREADY_PROCESSED')
    }

    // Get the organization
    const organization = await Organization.findOrFail(request.organizationId)

    // Verify org is in individual mode
    if (organization.isSharedMode()) {
      throw new Error('INVALID_MODE_FOR_DISTRIBUTION')
    }

    // Check org has enough credits (preliminary check)
    if (!organization.hasEnoughCredits(request.amount)) {
      throw new Error('INSUFFICIENT_ORG_CREDITS')
    }

    // Use CreditService for the actual distribution (handles its own transaction)
    await CreditService.distributeToUser(
      organization,
      request.requesterId,
      request.amount,
      approver.id,
      `Credit request #${request.id} approved`
    )

    // Update request status after successful distribution
    request.status = CreditRequestStatus.Approved
    request.processedByUserId = approver.id
    request.processedAt = DateTime.now()
    await request.save()

    return {
      request,
      creditsDistributed: request.amount,
    }
  }

  /**
   * Approve an owner-to-reseller request
   * Distributes credits from reseller pool to organization
   */
  async approveOwnerRequest(
    request: CreditRequest,
    resellerAdmin: User
  ): Promise<ProcessRequestResult> {
    if (request.type !== CreditRequestType.OwnerToReseller) {
      throw new Error('INVALID_REQUEST_TYPE')
    }

    if (!request.isPending()) {
      throw new Error('REQUEST_ALREADY_PROCESSED')
    }

    if (!request.resellerId) {
      throw new Error('NO_RESELLER_ASSIGNED')
    }

    const trx = await db.transaction()

    try {
      // Lock the request
      const lockedRequest = await CreditRequest.query({ client: trx })
        .where('id', request.id)
        .forUpdate()
        .firstOrFail()

      if (!lockedRequest.isPending()) {
        await trx.rollback()
        throw new Error('REQUEST_ALREADY_PROCESSED')
      }

      // Get and lock the reseller
      const reseller = await Reseller.query({ client: trx })
        .where('id', request.resellerId)
        .forUpdate()
        .firstOrFail()

      // Check reseller has enough credits
      if (!reseller.hasEnoughCredits(request.amount)) {
        await trx.rollback()
        throw new Error('INSUFFICIENT_RESELLER_CREDITS')
      }

      // Get and lock the organization
      const organization = await Organization.query({ client: trx })
        .where('id', request.organizationId)
        .forUpdate()
        .firstOrFail()

      // Deduct from reseller - pass trx to avoid deadlock
      await reseller.distributeCredits(
        request.amount,
        request.organizationId,
        `Credit request #${request.id} approved`,
        resellerAdmin.id,
        trx
      )

      // Add to organization - pass trx to avoid deadlock
      await organization.addCredits(
        request.amount,
        CreditTransactionType.Purchase,
        `Credits from reseller - request #${request.id}`,
        resellerAdmin.id,
        trx
      )

      // Update request status
      lockedRequest.status = CreditRequestStatus.Approved
      lockedRequest.processedByUserId = resellerAdmin.id
      lockedRequest.processedAt = DateTime.now()
      await lockedRequest.useTransaction(trx).save()

      await trx.commit()

      return {
        request: lockedRequest,
        creditsDistributed: request.amount,
      }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Reject a credit request
   */
  async rejectRequest(
    request: CreditRequest,
    rejector: User,
    reason?: string
  ): Promise<ProcessRequestResult> {
    if (!request.isPending()) {
      throw new Error('REQUEST_ALREADY_PROCESSED')
    }

    const trx = await db.transaction()

    try {
      // Lock the request
      const lockedRequest = await CreditRequest.query({ client: trx })
        .where('id', request.id)
        .forUpdate()
        .firstOrFail()

      if (!lockedRequest.isPending()) {
        await trx.rollback()
        throw new Error('REQUEST_ALREADY_PROCESSED')
      }

      // Update request status
      lockedRequest.status = CreditRequestStatus.Rejected
      lockedRequest.processedByUserId = rejector.id
      lockedRequest.rejectionReason = reason || null
      lockedRequest.processedAt = DateTime.now()
      await lockedRequest.useTransaction(trx).save()

      await trx.commit()

      return { request: lockedRequest }
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }

  /**
   * Get pending requests for an organization owner
   */
  async getPendingRequestsForOwner(organizationId: number): Promise<CreditRequest[]> {
    return CreditRequest.query()
      .where('organizationId', organizationId)
      .where('type', CreditRequestType.MemberToOwner)
      .where('status', CreditRequestStatus.Pending)
      .preload('requester')
      .orderBy('createdAt', 'asc')
  }

  /**
   * Get pending requests for a reseller
   */
  async getPendingRequestsForReseller(resellerId: number): Promise<CreditRequest[]> {
    return CreditRequest.query()
      .where('resellerId', resellerId)
      .where('type', CreditRequestType.OwnerToReseller)
      .where('status', CreditRequestStatus.Pending)
      .preload('requester')
      .preload('organization')
      .orderBy('createdAt', 'asc')
  }

  /**
   * Get all requests for a reseller (including processed)
   */
  async getAllRequestsForReseller(
    resellerId: number,
    page: number = 1,
    limit: number = 20,
    statusFilter?: string
  ): Promise<{ data: CreditRequest[]; meta: any }> {
    const query = CreditRequest.query()
      .where('resellerId', resellerId)
      .where('type', CreditRequestType.OwnerToReseller)
      .preload('requester')
      .preload('organization')
      .preload('processedBy')
      .orderBy('createdAt', 'desc')

    if (statusFilter && statusFilter !== 'all') {
      query.where('status', statusFilter)
    }

    const result = await query.paginate(page, limit)
    return result.toJSON() as { data: CreditRequest[]; meta: any }
  }

  /**
   * Count pending requests for an organization owner
   */
  async countPendingForOwner(organizationId: number): Promise<number> {
    const result = await CreditRequest.query()
      .where('organizationId', organizationId)
      .where('type', CreditRequestType.MemberToOwner)
      .where('status', CreditRequestStatus.Pending)
      .count('* as total')
      .first()

    return Number(result?.$extras.total ?? 0)
  }

  /**
   * Count pending requests for a reseller
   */
  async countPendingForReseller(resellerId: number): Promise<number> {
    const result = await CreditRequest.query()
      .where('resellerId', resellerId)
      .where('type', CreditRequestType.OwnerToReseller)
      .where('status', CreditRequestStatus.Pending)
      .count('* as total')
      .first()

    return Number(result?.$extras.total ?? 0)
  }

  /**
   * Get user's own requests
   */
  async getUserRequests(
    userId: number,
    organizationId: number,
    page: number = 1,
    limit: number = 20,
    statusFilter?: string
  ): Promise<{ data: CreditRequest[]; meta: any }> {
    const query = CreditRequest.query()
      .where('requesterId', userId)
      .where('organizationId', organizationId)
      .preload('processedBy')
      .orderBy('createdAt', 'desc')

    if (statusFilter && statusFilter !== 'all') {
      query.where('status', statusFilter)
    }

    const result = await query.paginate(page, limit)
    return result.toJSON() as { data: CreditRequest[]; meta: any }
  }

  /**
   * Get all requests in an organization (for owner view)
   */
  async getOrganizationRequests(
    organizationId: number,
    page: number = 1,
    limit: number = 20,
    statusFilter?: string,
    typeFilter?: string
  ): Promise<{ data: CreditRequest[]; meta: any }> {
    const query = CreditRequest.query()
      .where('organizationId', organizationId)
      .preload('requester')
      .preload('processedBy')
      .orderBy('createdAt', 'desc')

    if (statusFilter && statusFilter !== 'all') {
      query.where('status', statusFilter)
    }

    if (typeFilter && typeFilter !== 'all') {
      query.where('type', typeFilter)
    }

    const result = await query.paginate(page, limit)
    return result.toJSON() as { data: CreditRequest[]; meta: any }
  }
}
