<script setup lang="ts">
definePageMeta({
  layout: false,
})

useHead({
  script: [
    { src: 'https://player.vimeo.com/api/player.js', defer: true },
  ],
})

useSeoMeta({
  title: 'Novika — Dictez, votre document est prêt',
  description: 'Transformez vos enregistrements audio en documents structurés prêts à l\'emploi en 2 minutes. Adapté aux avocats, médecins et consultants. Hébergé en France, conforme RGPD.',
  ogTitle: 'Novika — Dictez, votre document est prêt',
  ogDescription: 'De l\'audio brut au document professionnel en 2 minutes. Adapté aux avocats, médecins et consultants.',
})
</script>

<template>
  <div class="min-h-screen bg-slate-50 font-sans selection:bg-purple-200 selection:text-purple-900">
    <LandingNavbar />
    <main>
      <LandingHero />
      <LandingVideoDemo />
      <LandingHowItWorks />
      <LandingFeatures />
      <LandingTargetAudience />
      <LandingSecurity />
      <LandingCTA />
    </main>
    <LandingFooter />
  </div>
</template>
