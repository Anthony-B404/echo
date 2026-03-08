<script setup lang="ts">
const { reveal } = useScrollReveal()

const securityFeatures = [
  {
    title: 'Hébergé en France',
    description: 'Vos données et fichiers audio sont stockés sur des serveurs situés exclusivement en France. Rien ne sort du territoire européen.',
    icon: 'i-lucide-server',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    title: 'IA conçue en France',
    description: 'Novika utilise Mistral, une IA française. Vos données sont traitées et hébergées en Europe, sous législation européenne.',
    icon: 'i-lucide-shield-check',
    color: 'bg-indigo-100 text-indigo-600',
  },
  {
    title: 'Suppression programmée',
    description: 'Vos enregistrements peuvent être supprimés automatiquement après traitement. Vous gardez le contrôle de la durée de conservation.',
    icon: 'i-lucide-file-key-2',
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    title: 'Chiffrement intégral',
    description: 'Vos audios et vos transcriptions sont chiffrés au repos et en transit. Le secret professionnel de vos échanges est garanti.',
    icon: 'i-lucide-lock-keyhole',
    color: 'bg-slate-100 text-slate-800',
  },
]
</script>

<template>
  <section id="securite" class="py-24 bg-slate-900 overflow-hidden relative">
    <!-- Glow effects -->
    <div class="absolute top-0 right-1/4 w-[40rem] h-[40rem] bg-blue-500/20 rounded-full blur-[100px] pointer-events-none"></div>
    <div class="absolute bottom-0 left-1/4 w-[40rem] h-[40rem] bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none"></div>

    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div class="lg:grid lg:grid-cols-2 lg:gap-16 items-center">
        <!-- Left text -->
        <div
          :ref="(el: any) => reveal(el)"
          class="scroll-reveal mb-12 lg:mb-0"
        >
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm font-semibold mb-6">
            <span class="text-xl">&#x1F1EB;&#x1F1F7;</span> Souveraineté garantie
          </div>

          <h2 class="text-3xl font-extrabold text-white tracking-tight sm:text-4xl mb-6">
            Le secret professionnel, c'est notre point de départ
          </h2>

          <p class="text-lg text-slate-300 mb-8 leading-relaxed">
            Vous êtes avocat, médecin, consultant. La confidentialité n'est pas un bonus, c'est un prérequis. Novika a été conçu dès le premier jour pour respecter les normes les plus strictes de protection des données.
          </p>

          <div class="flex flex-col gap-4">
            <div class="flex items-center gap-3 text-slate-200 bg-white/5 p-4 rounded-xl border border-white/10">
              <UIcon name="i-lucide-shield-check" class="w-6 h-6 text-green-400 shrink-0" />
              <span class="font-medium">Conforme RGPD — par conception</span>
            </div>
            <div class="flex items-center gap-3 text-slate-200 bg-white/5 p-4 rounded-xl border border-white/10">
              <UIcon name="i-lucide-lock" class="w-6 h-6 text-blue-400 shrink-0" />
              <span class="font-medium">Vos données ne sont jamais utilisées pour entraîner nos modèles</span>
            </div>
          </div>
        </div>

        <!-- Right cards -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div
            v-for="(feature, index) in securityFeatures"
            :key="index"
            :ref="(el: any) => reveal(el)"
            class="scroll-reveal bg-slate-800/80 backdrop-blur-sm p-6 rounded-2xl border border-slate-700 hover:border-slate-600 transition-colors"
            :style="{ transitionDelay: `${index * 100}ms` }"
          >
            <div :class="['w-12 h-12 rounded-xl flex items-center justify-center mb-4', feature.color]">
              <UIcon :name="feature.icon" class="w-6 h-6" />
            </div>
            <h3 class="text-lg font-bold text-white mb-2">{{ feature.title }}</h3>
            <p class="text-slate-400 text-sm leading-relaxed">{{ feature.description }}</p>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
