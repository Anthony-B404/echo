/**
 * Composable for common formatting functions
 * Centralized date and number formatting with locale support
 */
export function useFormatters () {
  const { locale } = useI18n()

  /**
   * Format a date string to localized format
   * @param dateString - ISO date string
   * @param options - Intl.DateTimeFormatOptions (optional)
   */
  function formatDate (
    dateString: string,
    options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }
  ) {
    return new Date(dateString).toLocaleDateString(locale.value, options)
  }

  /**
   * Format a date string to localized format with time
   * @param dateString - ISO date string
   */
  function formatDateTime (dateString: string) {
    return new Date(dateString).toLocaleDateString(locale.value, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  /**
   * Format a number with locale-specific grouping
   * @param amount - Number to format
   */
  function formatNumber (amount: number) {
    return new Intl.NumberFormat(locale.value).format(amount)
  }

  /**
   * Format credits amount
   * @param credits - Credit amount to format
   */
  function formatCredits (credits: number) {
    return new Intl.NumberFormat(locale.value).format(credits)
  }

  /**
   * Format a date string to relative time (e.g., "2 hours ago", "yesterday")
   * @param dateString - ISO date string or Date object
   */
  function formatRelativeTime (dateString: string | Date) {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })

    // Less than a minute
    if (diffInSeconds < 60) {
      return rtf.format(-diffInSeconds, 'second')
    }

    // Less than an hour
    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
      return rtf.format(-diffInMinutes, 'minute')
    }

    // Less than a day
    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) {
      return rtf.format(-diffInHours, 'hour')
    }

    // Less than a week
    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 7) {
      return rtf.format(-diffInDays, 'day')
    }

    // Less than a month
    const diffInWeeks = Math.floor(diffInDays / 7)
    if (diffInWeeks < 4) {
      return rtf.format(-diffInWeeks, 'week')
    }

    // Less than a year
    const diffInMonths = Math.floor(diffInDays / 30)
    if (diffInMonths < 12) {
      return rtf.format(-diffInMonths, 'month')
    }

    // Years
    const diffInYears = Math.floor(diffInDays / 365)
    return rtf.format(-diffInYears, 'year')
  }

  return {
    formatDate,
    formatDateTime,
    formatNumber,
    formatCredits,
    formatRelativeTime
  }
}
