import type { HttpContext } from '@adonisjs/core/http'
import PromptCategory from '#models/prompt_category'
import PromptCategoryPolicy from '#policies/prompt_category_policy'
import {
  promptCategoryIndexValidator,
  createPromptCategoryValidator,
  updatePromptCategoryValidator,
  promptCategoryReorderValidator,
} from '#validators/prompt_category'

export default class PromptCategoriesController {
  /**
   * List all prompt categories for the current organization.
   *
   * GET /api/prompt-categories
   */
  async index({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!

    // Check authorization
    if (await bouncer.with(PromptCategoryPolicy).denies('listCategories')) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    // Validate query parameters
    const { includePromptCount } = await request.validateUsing(promptCategoryIndexValidator)

    // Build query with tenant isolation
    const query = PromptCategory.query()
      .where('organizationId', user.currentOrganizationId!)
      .orderBy('sortOrder', 'asc')

    // Optionally include prompts count
    if (includePromptCount) {
      query.withCount('prompts')
    }

    const categories = await query

    return response.ok(categories)
  }

  /**
   * Get category details.
   *
   * GET /api/prompt-categories/:id
   */
  async show({ params, response, bouncer, i18n }: HttpContext) {
    // Validate ID parameter
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    const category = await PromptCategory.find(id)

    if (!category) {
      return response.notFound({
        message: i18n.t('messages.prompt_category.not_found'),
      })
    }

    // Check authorization
    if (await bouncer.with(PromptCategoryPolicy).denies('viewCategory', category)) {
      return response.forbidden({
        message: i18n.t('messages.errors.forbidden'),
      })
    }

    // Load prompts count
    await category.loadCount('prompts')

    return response.ok(category)
  }

  /**
   * Create a new prompt category.
   *
   * POST /api/prompt-categories
   */
  async store({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!

    // Check authorization
    if (await bouncer.with(PromptCategoryPolicy).denies('createCategory')) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    // Validate request body
    const { name, description, color, icon } = await request.validateUsing(
      createPromptCategoryValidator
    )

    // Get the max sort order for the organization
    const maxSortOrder = await PromptCategory.query()
      .where('organizationId', user.currentOrganizationId!)
      .max('sort_order as maxOrder')
      .first()

    // Create category
    const category = await PromptCategory.create({
      organizationId: user.currentOrganizationId!,
      name,
      description: description || null,
      color: color || null,
      icon: icon || null,
      isDefault: false,
      sortOrder: (maxSortOrder?.$extras.maxOrder || 0) + 1,
    })

    return response.created({
      message: i18n.t('messages.prompt_category.created'),
      category,
    })
  }

  /**
   * Update a prompt category.
   *
   * PUT /api/prompt-categories/:id
   */
  async update({ params, request, response, bouncer, i18n }: HttpContext) {
    // Validate ID parameter
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    const category = await PromptCategory.find(id)

    if (!category) {
      return response.notFound({
        message: i18n.t('messages.prompt_category.not_found'),
      })
    }

    // Check authorization
    if (await bouncer.with(PromptCategoryPolicy).denies('updateCategory', category)) {
      return response.forbidden({
        message: i18n.t('messages.errors.forbidden'),
      })
    }

    // Validate request body
    const { name, description, color, icon, sortOrder } = await request.validateUsing(
      updatePromptCategoryValidator
    )

    // Update category fields
    if (name !== undefined) category.name = name
    if (description !== undefined) category.description = description
    if (color !== undefined) category.color = color
    if (icon !== undefined) category.icon = icon
    if (sortOrder !== undefined) category.sortOrder = sortOrder

    await category.save()

    return response.ok({
      message: i18n.t('messages.prompt_category.updated'),
      category,
    })
  }

  /**
   * Delete a prompt category.
   *
   * DELETE /api/prompt-categories/:id
   */
  async destroy({ params, response, bouncer, i18n }: HttpContext) {
    // Validate ID parameter
    const id = Number(params.id)
    if (!Number.isInteger(id) || id <= 0) {
      return response.badRequest({
        message: i18n.t('messages.errors.invalid_id'),
      })
    }

    const category = await PromptCategory.find(id)

    if (!category) {
      return response.notFound({
        message: i18n.t('messages.prompt_category.not_found'),
      })
    }

    // Check authorization
    if (await bouncer.with(PromptCategoryPolicy).denies('deleteCategory', category)) {
      return response.forbidden({
        message: i18n.t('messages.errors.forbidden'),
      })
    }

    // Check if category has prompts
    await category.loadCount('prompts')
    if (category.$extras.prompts_count > 0) {
      return response.badRequest({
        message: i18n.t('messages.prompt_category.has_prompts'),
      })
    }

    // Delete category record
    await category.delete()

    return response.ok({
      message: i18n.t('messages.prompt_category.deleted'),
    })
  }

  /**
   * Reorder categories.
   *
   * POST /api/prompt-categories/reorder
   */
  async reorder({ request, response, auth, bouncer, i18n }: HttpContext) {
    const user = auth.user!

    // Check authorization
    if (await bouncer.with(PromptCategoryPolicy).denies('listCategories')) {
      return response.badRequest({
        message: i18n.t('messages.errors.no_current_organization'),
      })
    }

    // Validate request body
    const { categories: categoriesToReorder } = await request.validateUsing(
      promptCategoryReorderValidator
    )

    // Fetch all categories to reorder (only from user's current organization)
    const categoryIds = categoriesToReorder.map((c) => c.id)
    const categories = await PromptCategory.query()
      .whereIn('id', categoryIds)
      .where('organizationId', user.currentOrganizationId!)

    if (categories.length !== categoriesToReorder.length) {
      return response.badRequest({
        message: i18n.t('messages.prompt_category.not_found'),
      })
    }

    // Update sort order for each category
    for (const categoryUpdate of categoriesToReorder) {
      const category = categories.find((c) => c.id === categoryUpdate.id)
      if (category) {
        category.sortOrder = categoryUpdate.sortOrder
        await category.save()
      }
    }

    return response.ok({
      message: i18n.t('messages.prompt_category.reordered'),
    })
  }
}
