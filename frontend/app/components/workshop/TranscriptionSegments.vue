<script setup lang="ts">
import type { TranscriptionTimestamp } from '~/types/audio'

const props = defineProps<{
  segments: TranscriptionTimestamp[]
  currentTime: number
}>()

const emit = defineEmits<{
  (e: 'seek', time: number): void
}>()

const segmentRefs = ref<HTMLElement[]>([])

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function isCurrentSegment(segment: TranscriptionTimestamp): boolean {
  return props.currentTime >= segment.start && props.currentTime < segment.end
}

// Find current segment index
const currentSegmentIndex = computed(() =>
  props.segments.findIndex((seg) => isCurrentSegment(seg))
)

// Auto-scroll to current segment
watch(currentSegmentIndex, (index) => {
  if (index >= 0 && segmentRefs.value[index]) {
    segmentRefs.value[index].scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
  }
})
</script>

<template>
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
      <UBadge color="primary" variant="subtle" class="shrink-0 font-mono text-xs h-fit">
        {{ formatTime(segment.start) }}
      </UBadge>
      <span class="text-sm leading-relaxed">{{ segment.text }}</span>
    </div>
  </div>
</template>
