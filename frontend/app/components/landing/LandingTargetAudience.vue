<script setup lang="ts">
const { reveal } = useScrollReveal()

const professions = [
  {
    role: 'Avocats',
    icon: 'i-lucide-scale',
    title: 'Dictez après l\'audience, vos conclusions sont prêtes',
    description: 'Vous dictez 20 minutes après votre audience. Novika produit un projet de conclusions structuré, prêt à être relu et classé au dossier.',
    stats: 'Des heures de rédaction économisées chaque semaine',
  },
  {
    role: 'Professionnels de santé',
    icon: 'i-lucide-heart-pulse',
    title: 'Le CR est prêt avant le patient suivant',
    description: 'Dictez entre deux consultations. Novika génère un compte-rendu médical formaté selon vos habitudes, sans erreur de terminologie.',
    stats: 'Le temps administratif chute drastiquement',
  },
  {
    role: 'Consultants & commerciaux',
    icon: 'i-lucide-briefcase',
    title: 'L\'appel client devient un plan d\'action',
    description: 'Enregistrez un mémo vocal après votre rendez-vous. Novika en extrait les points clés, les décisions et les prochaines étapes.',
    stats: 'Suivi client toujours à jour',
  },
]
</script>

<template>
  <section id="metiers" class="py-24 bg-slate-50">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-3xl mx-auto mb-16">
        <span class="text-purple-600 font-semibold tracking-wider uppercase text-sm">Adapté à votre métier</span>
        <h2 class="mt-2 text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
          Pas juste un transcripteur. Un rédacteur qui comprend votre métier.
        </h2>
        <p class="mt-4 text-lg text-slate-600">
          C'est la différence entre un dictaphone et un assistant rédacteur : Novika ne se contente pas de retranscrire, il restructure.
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-10">
        <div
          v-for="(prof, index) in professions"
          :key="index"
          :ref="(el: any) => reveal(el)"
          class="scroll-reveal bg-white rounded-3xl p-8 shadow-xl shadow-slate-200/50 relative overflow-hidden group"
          :style="{ transitionDelay: `${index * 150}ms` }"
        >
          <!-- Background icon -->
          <div class="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500">
            <UIcon :name="prof.icon" class="w-32 h-32" />
          </div>

          <div class="relative z-10">
            <div class="inline-flex items-center justify-center p-3 bg-slate-900 rounded-xl mb-6 shadow-md">
              <UIcon :name="prof.icon" class="w-8 h-8 text-white" />
            </div>

            <div class="text-sm font-semibold text-purple-600 mb-2">{{ prof.role }}</div>
            <h3 class="text-2xl font-bold text-slate-900 mb-4">{{ prof.title }}</h3>

            <p class="text-slate-600 mb-8 leading-relaxed">{{ prof.description }}</p>

            <div class="mt-auto inline-flex items-center text-sm font-medium text-slate-900 bg-slate-100 px-4 py-2 rounded-lg">
              <UIcon name="i-lucide-circle-check" class="mr-2 h-4 w-4 text-green-500" />
              {{ prof.stats }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
