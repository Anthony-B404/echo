<script setup lang="ts">
import type { TranscriptionTimestamp } from '~/types/audio'

const props = defineProps<{
  segments: TranscriptionTimestamp[]
  currentTime: number
}>()

const emit = defineEmits<{
  seek: [time: number]
}>()

const segmentRefs = ref<HTMLElement[]>([])

// Search
const searchQuery = ref('')
const debouncedQuery = ref('')
const currentMatchIndex = ref(0)
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (val) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = val.trim().toLowerCase()
    currentMatchIndex.value = 0
  }, 200)
})

// Build flat list of all occurrences: [{ segmentIndex, occurrence }, ...]
const matchPositions = computed(() => {
  if (!debouncedQuery.value) return []
  const positions: { segmentIndex: number }[] = []
  const escaped = debouncedQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(escaped, 'gi')
  props.segments.forEach((seg, segIdx) => {
    let match
    while ((match = regex.exec(seg.text.toLowerCase())) !== null) {
      positions.push({ segmentIndex: segIdx })
    }
  })
  return positions
})

const matchCount = computed(() => matchPositions.value.length)

// Which segment index contains the current active match
const activeMatchSegmentIndex = computed(() => {
  if (matchCount.value === 0) return -1
  return matchPositions.value[currentMatchIndex.value]?.segmentIndex ?? -1
})

// How many matches are in segments before the active one + which occurrence within that segment is active
const activeOccurrenceInSegment = computed(() => {
  if (matchCount.value === 0) return -1
  const activeSegIdx = activeMatchSegmentIndex.value
  let count = 0
  for (let i = 0; i < currentMatchIndex.value; i++) {
    if (matchPositions.value[i]?.segmentIndex === activeSegIdx) count++
  }
  return count
})

function goToNextMatch () {
  if (matchCount.value === 0) return
  currentMatchIndex.value = (currentMatchIndex.value + 1) % matchCount.value
  scrollToActiveMatch()
}

function goToPrevMatch () {
  if (matchCount.value === 0) return
  currentMatchIndex.value = (currentMatchIndex.value - 1 + matchCount.value) % matchCount.value
  scrollToActiveMatch()
}

function scrollToActiveMatch () {
  const segIdx = activeMatchSegmentIndex.value
  if (segIdx >= 0 && segmentRefs.value[segIdx]) {
    segmentRefs.value[segIdx].scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// Scroll to first match when search changes
watch(matchPositions, () => {
  if (matchPositions.value.length > 0) {
    nextTick(() => scrollToActiveMatch())
  }
})

function highlightText (text: string, segmentIndex: number): string {
  if (!debouncedQuery.value) return text
  const escaped = debouncedQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const isActiveSegment = segmentIndex === activeMatchSegmentIndex.value
  const activeOcc = activeOccurrenceInSegment.value
  let occIndex = 0
  return text.replace(regex, (match) => {
    const isActive = isActiveSegment && occIndex === activeOcc
    occIndex++
    return isActive
      ? `<mark class="bg-orange-400/60 text-inherit rounded-sm px-0.5">${match}</mark>`
      : `<mark class="bg-yellow-400/40 text-inherit rounded-sm px-0.5">${match}</mark>`
  })
}

// Generate consistent colors for speakers (bg + text pairs)
const speakerColorPairs = [
  { bg: 'bg-blue-500/15', text: 'text-blue-500' },
  { bg: 'bg-green-500/15', text: 'text-green-500' },
  { bg: 'bg-purple-500/15', text: 'text-purple-500' },
  { bg: 'bg-orange-500/15', text: 'text-orange-500' },
  { bg: 'bg-pink-500/15', text: 'text-pink-500' },
  { bg: 'bg-cyan-500/15', text: 'text-cyan-500' },
  { bg: 'bg-yellow-500/15', text: 'text-yellow-500' },
  { bg: 'bg-red-500/15', text: 'text-red-500' },
]

// Map speakers to color pairs
const speakerColorMap = computed(() => {
  const map = new Map<string, { bg: string; text: string }>()
  const uniqueSpeakers = props.segments
    .map(s => s.speaker)
    .filter((s): s is string => typeof s === 'string')
  const uniqueSet = [...new Set(uniqueSpeakers)]
  uniqueSet.forEach((speaker, index) => {
    map.set(speaker, speakerColorPairs[index % speakerColorPairs.length]!)
  })
  return map
})

function getSpeakerColors (speaker: string | undefined): { bg: string; text: string } {
  if (!speaker) return { bg: 'bg-muted/15', text: 'text-muted' }
  return speakerColorMap.value.get(speaker) || { bg: 'bg-muted/15', text: 'text-muted' }
}

function getSpeakerInitials (speaker: string): string {
  // Handle generic speaker IDs like "speaker_1", "Speaker 2", "speaker_10"
  const genericMatch = speaker.match(/^speaker[\s_-]*(\d+)$/i)
  if (genericMatch) {
    return `S${genericMatch[1]}`
  }

  return speaker
    .split(/\s+/)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function formatTime (seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function isCurrentSegment (segment: TranscriptionTimestamp): boolean {
  return props.currentTime >= segment.start && props.currentTime < segment.end
}

// Find current segment index
const currentSegmentIndex = computed(() =>
  props.segments.findIndex(seg => isCurrentSegment(seg))
)

// Auto-scroll to current segment
watch(currentSegmentIndex, (index) => {
  if (index >= 0 && segmentRefs.value[index]) {
    segmentRefs.value[index].scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    })
  }
})
</script>

<template>
  <div>
    <!-- Search bar -->
    <div class="flex items-center gap-2 mb-3">
      <UInput
        v-model="searchQuery"
        icon="i-lucide-search"
        placeholder="Rechercher dans la transcription..."
        size="sm"
        class="flex-1"
        :trailing-icon="searchQuery ? 'i-lucide-x' : undefined"
        @click:trailing="searchQuery = ''"
      />
      <template v-if="debouncedQuery">
        <span class="text-xs text-muted whitespace-nowrap">
          <template v-if="matchCount > 0">{{ currentMatchIndex + 1 }}/{{ matchCount }}</template>
          <template v-else>0 résultat</template>
        </span>
        <UButton
          icon="i-lucide-chevron-up"
          color="neutral"
          variant="ghost"
          size="xs"
          :disabled="matchCount === 0"
          @click="goToPrevMatch"
        />
        <UButton
          icon="i-lucide-chevron-down"
          color="neutral"
          variant="ghost"
          size="xs"
          :disabled="matchCount === 0"
          @click="goToNextMatch"
        />
      </template>
    </div>

    <!-- Segments list -->
    <div class="space-y-2 max-h-96 overflow-y-auto pr-2">
      <div
        v-for="(segment, index) in segments"
        :key="index"
        :ref="(el) => { if (el) segmentRefs[index] = el as HTMLElement }"
        :class="[
          'flex gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200',
          isCurrentSegment(segment)
            ? 'bg-primary/10 border-l-2 border-primary'
            : 'hover:bg-elevated border-l-2 border-transparent',
        ]"
        @click="emit('seek', segment.start)"
      >
        <UBadge color="primary" variant="subtle" class="font-mono text-xs shrink-0 self-start">
          {{ formatTime(segment.start) }}
        </UBadge>
        <UTooltip v-if="segment.speaker" :text="segment.speaker" :delay-duration="0">
          <div
            :class="[
              'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 self-start mt-0.5',
              getSpeakerColors(segment.speaker).bg,
              getSpeakerColors(segment.speaker).text,
            ]"
          >
            {{ getSpeakerInitials(segment.speaker) }}
          </div>
        </UTooltip>
        <!-- eslint-disable-next-line vue/no-v-html -->
        <span class="text-sm leading-relaxed" v-html="highlightText(segment.text, index)" />
      </div>
    </div>
  </div>
</template>

