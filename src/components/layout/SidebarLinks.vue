<script setup lang="ts">
interface LinkProp {
  title: string
  to?: string
  icon: string
}

defineProps<{
  links: LinkProp[]
}>()
</script>

<template>
  <template v-for="link in links" :key="link.title">
    <RouterLink
      v-if="link.to"
      exactActiveClass="text-primary bg-[#2F80ED]"
      :to="link.to"
      class="nav-link"
    >
      <iconify-icon :icon="link.icon" />
      <span class="hidden lg:block text-nowrap">{{ link.title }}</span>
    </RouterLink>

    <div v-else class="nav-link cursor-pointer">
      <iconify-icon :icon="link.icon" />
      <span class="hidden lg:block text-nowrap">{{ link.title }}</span>
    </div>
  </template>
</template>

<style scoped>
@reference "@/assets/index.css";

.nav-link {
  @apply flex items-center justify-center gap-3 px-4 py-2 mx-2 transition-colors rounded-lg hover:text-primary lg:justify-normal text-muted-foreground;
}
</style>
