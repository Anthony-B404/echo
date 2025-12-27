import type { HttpContext } from '@adonisjs/core/http'
import Prompt from '#models/prompt'
import PromptCategory from '#models/prompt_category'
import PromptPolicy from '#policies/prompt_policy'
import {
  promptIndexValidator,
  createPromptValidator,
  updatePromptValidator,
  promptBatchDeleteValidator,
  promptReorderValidator,
} from '#validators/prompt'

export default class PromptsController {
  /**
   * List all prompts for the current organization.
   * Supports pagination, category filtering, favorites, search, and sorting.
   *
   * GET /api/prompts
   */
  async index({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!

    // Check authorization
    if (await bouncer.with(PromptPolicy).denies('listPrompts')) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    // Validate query parameters
    const {
      page = 1,
      limit = 50,
      categoryId,
      favorites,
      search,
      sort = 'sortOrder',
      order = 'asc',
    } = await request.validateUsing(promptIndexValidator)

    // Build query with tenant isolation
    const query = Prompt.query()
      .where('organizationId', user.currentOrganizationId!)
      .preload('category')

    // Apply category filter if provided
    if (categoryId) {
      query.where('categoryId', categoryId)
    }

    // Apply favorites filter if provided
    if (favorites === true) {
      query.where('isFavorite', true)
    }

    // Apply search filter if provided (search in title and content)
    if (search) {
      query.where((subQuery) => {
        subQuery.whereILike('title', `%${search}%`).orWhereILike('content', `%${search}%`)
      })
    }

    // Apply sorting
    query.orderBy(sort, order)

    // Execute with pagination
    const prompts = await query.paginate(page, limit)

    return response.ok(prompts)
  }

  /**
   * Get prompt details.
   *
   * GET /api/prompts/:id
   */
  async show({ params, response, bouncer, i18n }: HttpContext) {
    // Validate ID parameter
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    const prompt = await Prompt.find(id)

    if (!prompt) {
      return response.notFound({
        message: i18n.t('messages.prompt.not_found'),
      })
    }

    // Check authorization
    if (await bouncer.with(PromptPolicy).denies('viewPrompt', prompt)) {
      return response.forbidden({
        message: i18n.t('messages.errors.forbidden'),
      })
    }

    // Load category relationship
    await prompt.load('category')

    return response.ok(prompt)
  }

  /**
   * Create a new prompt.
   *
   * POST /api/prompts
   */
  async store({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!

    // Check authorization
    if (await bouncer.with(PromptPolicy).denies('createPrompt')) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    // Validate request body
    const { title, content, categoryId, isFavorite } =
      await request.validateUsing(createPromptValidator)

    // If categoryId is provided, verify it belongs to the same organization
    if (categoryId) {
      const category = await PromptCategory.find(categoryId)
      if (!category || category.organizationId !== user.currentOrganizationId) {
        return response.badRequest({
          message: i18n.t('messages.prompt_category.not_found'),
        })
      }
    }

    // Get the max sort order for the organization
    const maxSortOrder = await Prompt.query()
      .where('organizationId', user.currentOrganizationId!)
      .max('sort_order as maxOrder')
      .first()

    // Create prompt
    const prompt = await Prompt.create({
      organizationId: user.currentOrganizationId!,
      title,
      content,
      categoryId: categoryId || null,
      isFavorite: isFavorite || false,
      isDefault: false,
      usageCount: 0,
      sortOrder: (maxSortOrder?.$extras.maxOrder || 0) + 1,
    })

    // Load category relationship
    await prompt.load('category')

    return response.created({
      message: i18n.t('messages.prompt.created'),
      prompt,
    })
  }

  /**
   * Update a prompt.
   *
   * PUT /api/prompts/:id
   */
  async update({ params, request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!

    // Validate ID parameter
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    const prompt = await Prompt.find(id)

    if (!prompt) {
      return response.notFound({
        message: i18n.t('messages.prompt.not_found'),
      })
    }

    // Check authorization
    if (await bouncer.with(PromptPolicy).denies('updatePrompt', prompt)) {
      return response.forbidden({
        message: i18n.t('messages.errors.forbidden'),
      })
    }

    // Validate request body
    const { title, content, categoryId, isFavorite, sortOrder } =
      await request.validateUsing(updatePromptValidator)

    // If categoryId is provided, verify it belongs to the same organization
    if (categoryId !== undefined && categoryId !== null) {
      const category = await PromptCategory.find(categoryId)
      if (!category || category.organizationId !== user.currentOrganizationId) {
        return response.badRequest({
          message: i18n.t('messages.prompt_category.not_found'),
        })
      }
    }

    // Update prompt fields
    if (title !== undefined) prompt.title = title
    if (content !== undefined) prompt.content = content
    if (categoryId !== undefined) prompt.categoryId = categoryId
    if (isFavorite !== undefined) prompt.isFavorite = isFavorite
    if (sortOrder !== undefined) prompt.sortOrder = sortOrder

    await prompt.save()

    // Load category relationship
    await prompt.load('category')

    return response.ok({
      message: i18n.t('messages.prompt.updated'),
      prompt,
    })
  }

  /**
   * Delete a prompt.
   *
   * DELETE /api/prompts/:id
   */
  async destroy({ params, response, bouncer, i18n }: HttpContext) {
    // Validate ID parameter
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    const prompt = await Prompt.find(id)

    if (!prompt) {
      return response.notFound({
        message: i18n.t('messages.prompt.not_found'),
      })
    }

    // Check authorization
    if (await bouncer.with(PromptPolicy).denies('deletePrompt', prompt)) {
      return response.forbidden({
        message: i18n.t('messages.errors.forbidden'),
      })
    }

    // Delete prompt record
    await prompt.delete()

    return response.ok({
      message: i18n.t('messages.prompt.deleted'),
    })
  }

  /**
   * Delete multiple prompts.
   *
   * DELETE /api/prompts/batch
   */
  async destroyMultiple({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!

    // Validate request body
    const { ids } = await request.validateUsing(promptBatchDeleteValidator)

    // Check authorization for listing (user must have current organization)
    if (await bouncer.with(PromptPolicy).denies('listPrompts')) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    // Fetch all prompts to delete (only from user's current organization)
    const prompts = await Prompt.query()
      .whereIn('id', ids)
      .where('organizationId', user.currentOrganizationId!)

    if (prompts.length === 0) {
      return response.notFound({
        message: i18n.t('messages.prompt.not_found'),
      })
    }

    // Delete prompts
    let deletedCount = 0
    for (const prompt of prompts) {
      await prompt.delete()
      deletedCount++
    }

    return response.ok({
      message: i18n.t('messages.prompt.batch_deleted', { count: deletedCount }),
      deletedCount,
    })
  }

  /**
   * Toggle favorite status of a prompt.
   *
   * POST /api/prompts/:id/favorite
   */
  async toggleFavorite({ params, response, bouncer, i18n }: HttpContext) {
    // Validate ID parameter
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    const prompt = await Prompt.find(id)

    if (!prompt) {
      return response.notFound({
        message: i18n.t('messages.prompt.not_found'),
      })
    }

    // Check authorization
    if (await bouncer.with(PromptPolicy).denies('updatePrompt', prompt)) {
      return response.forbidden({
        message: i18n.t('messages.errors.forbidden'),
      })
    }

    // Toggle favorite status
    const newFavoriteStatus = await prompt.toggleFavorite()

    return response.ok({
      message: newFavoriteStatus
        ? i18n.t('messages.prompt.added_to_favorites')
        : i18n.t('messages.prompt.removed_from_favorites'),
      isFavorite: newFavoriteStatus,
    })
  }

  /**
   * Increment usage count of a prompt.
   *
   * POST /api/prompts/:id/use
   */
  async incrementUsage({ params, response, bouncer, i18n }: HttpContext) {
    // Validate ID parameter
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    const prompt = await Prompt.find(id)

    if (!prompt) {
      return response.notFound({
        message: i18n.t('messages.prompt.not_found'),
      })
    }

    // Check authorization
    if (await bouncer.with(PromptPolicy).denies('viewPrompt', prompt)) {
      return response.forbidden({
        message: i18n.t('messages.errors.forbidden'),
      })
    }

    // Increment usage count
    await prompt.incrementUsage()

    return response.ok({
      usageCount: prompt.usageCount,
    })
  }

  /**
   * Reorder prompts.
   *
   * POST /api/prompts/reorder
   */
  async reorder({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!

    // Check authorization
    if (await bouncer.with(PromptPolicy).denies('listPrompts')) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    // Validate request body
    const { prompts: promptsToReorder } = await request.validateUsing(promptReorderValidator)

    // Fetch all prompts to reorder (only from user's current organization)
    const promptIds = promptsToReorder.map((p) => p.id)
    const prompts = await Prompt.query()
      .whereIn('id', promptIds)
      .where('organizationId', user.currentOrganizationId!)

    if (prompts.length !== promptsToReorder.length) {
      return response.badRequest({
        message: i18n.t('messages.prompt.not_found'),
      })
    }

    // Update sort order for each prompt
    for (const promptUpdate of promptsToReorder) {
      const prompt = prompts.find((p) => p.id === promptUpdate.id)
      if (prompt) {
        prompt.sortOrder = promptUpdate.sortOrder
        await prompt.save()
      }
    }

    return response.ok({
      message: i18n.t('messages.prompt.reordered'),
    })
  }
}
