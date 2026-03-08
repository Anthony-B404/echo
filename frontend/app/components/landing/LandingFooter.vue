<script setup lang="ts">
const localePath = useLocalePath()
const currentYear = new Date().getFullYear()
</script>

<template>
  <footer class="bg-white border-t border-slate-200 pt-16 pb-8">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <!-- Brand -->
        <div class="col-span-1">
          <div class="flex items-center gap-2 mb-6">
            <img src="/logo.png" alt="Novika" class="w-8 h-8">
            <span class="font-bold text-2xl tracking-tight text-slate-900">Novika</span>
          </div>
          <p class="text-slate-500 leading-relaxed mb-6 text-sm">
            De l'audio au document structuré en 2 minutes. Adapté aux avocats, médecins, consultants et commerciaux.
          </p>
        </div>

        <!-- Produit -->
        <div>
          <h4 class="font-bold text-slate-900 mb-4 uppercase text-sm tracking-wider">Produit</h4>
          <ul class="space-y-3 text-sm text-slate-500">
            <li><a href="#fonctionnalites" class="hover:text-purple-600 transition-colors">Fonctionnalités</a></li>
            <li><a href="#metiers" class="hover:text-purple-600 transition-colors">Cas d'usage métier</a></li>
            <li><a href="#comment-ca-marche" class="hover:text-purple-600 transition-colors">Comment ça marche</a></li>
            <li><a href="#securite" class="hover:text-purple-600 transition-colors">Sécurité & confidentialité</a></li>
          </ul>
        </div>

        <!-- Partenaires -->
        <div>
          <h4 class="font-bold text-slate-900 mb-4 uppercase text-sm tracking-wider">Partenaires</h4>
          <ul class="space-y-3 text-sm text-slate-500">
            <li><a href="#contact" class="hover:text-purple-600 transition-colors">Devenir revendeur</a></li>
            <li><a href="#contact" class="hover:text-purple-600 transition-colors">Portail partenaire</a></li>
          </ul>
        </div>

        <!-- Légal -->
        <div>
          <h4 class="font-bold text-slate-900 mb-4 uppercase text-sm tracking-wider">Légal</h4>
          <ul class="space-y-3 text-sm text-slate-500">
            <li><NuxtLink :to="localePath('/legal-notice')" class="hover:text-purple-600 transition-colors">Mentions légales</NuxtLink></li>
            <li><NuxtLink :to="localePath('/privacy-policy')" class="hover:text-purple-600 transition-colors">Politique de confidentialité</NuxtLink></li>
            <li><NuxtLink :to="localePath('/terms')" class="hover:text-purple-600 transition-colors">CGV / CGU</NuxtLink></li>
            <li><a href="mailto:contact@novika.app" class="hover:text-purple-600 transition-colors">Contact</a></li>
          </ul>
        </div>
      </div>

      <div class="pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500">
        <p>&copy; {{ currentYear }} Novika. Tous droits réservés.</p>
        <span>Conçu et hébergé en France.</span>
      </div>
    </div>
  </footer>
</template>
