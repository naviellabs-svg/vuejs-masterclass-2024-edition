<script setup lang="ts">
import { supabase } from '@/lib/supabaseClient'

const getProjects = async () => {
  const { data, error } = await supabase.from('projects').select()

  if (error) console.log(error)

  console.log('projects: ', data)
}
</script>
<template>
  <div>
    <h1>Projects Page</h1>
    <RouterLink to="/">Go To Home</RouterLink>
  </div>
</template>
